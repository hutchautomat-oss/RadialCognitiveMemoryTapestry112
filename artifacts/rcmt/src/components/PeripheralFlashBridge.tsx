/**
 * PeripheralFlashBridge — lives INSIDE the R3F Canvas. Each frame it drains the
 * queue of incoming peer (LWW) updates, projects each updated node's world
 * position to screen space via the live camera, and pushes a short-lived flash
 * marker pinned to the nearest viewport edge (via useHudStore). A DOM overlay
 * (PeripheralFlash) renders the markers.
 *
 * This exploits peripheral motion sensitivity: when a background node is
 * mutated by a remote peer, attention is pulled to the sector it lives in —
 * the foveal metaphor made interactive. It is read-only w.r.t. the lattice and
 * throttled so a burst of packets cannot spam React re-renders.
 */

import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { drainRemoteFlashes } from "../store/useSaccadeStore";
import { useHudStore } from "../store/useHudStore";
import { COLOR } from "./hud/tokens";

const _v = new Vector3();
const PUSH_THROTTLE_MS = 70;
const MAX_PER_FRAME = 4;

export function PeripheralFlashBridge() {
  const { camera } = useThree();
  const lastPushRef = useRef(0);

  useFrame(() => {
    // Throttle BEFORE draining — otherwise drained flashes would be discarded
    // during the throttle window. The queue is bounded (REMOTE_FLASH_CAP) so
    // deferring the drain a frame or two cannot grow it unbounded.
    const now = performance.now();
    if (now - lastPushRef.current < PUSH_THROTTLE_MS) return;

    const items = drainRemoteFlashes();
    if (items.length === 0) return;
    lastPushRef.current = now;

    const push = useHudStore.getState().pushPeripheralFlash;
    const take = items.length > MAX_PER_FRAME ? items.slice(items.length - MAX_PER_FRAME) : items;

    for (const it of take) {
      _v.set(it.x, it.y, it.z).project(camera);
      let nx = _v.x;
      let ny = _v.y;
      // Behind the camera: the perspective divide flips the sign; mirror so the
      // marker lands on the correct side rather than the opposite edge.
      if (_v.z > 1) {
        nx = -nx;
        ny = -ny;
      }
      const cx = Math.max(-1, Math.min(1, nx));
      const cy = Math.max(-1, Math.min(1, ny));

      let edge: "top" | "bottom" | "left" | "right";
      let pos: number;
      if (Math.abs(nx) >= Math.abs(ny)) {
        edge = nx >= 0 ? "right" : "left";
        pos = (1 - cy) / 2; // 0 = top, 1 = bottom
      } else {
        edge = ny >= 0 ? "top" : "bottom";
        pos = (cx + 1) / 2; // 0 = left, 1 = right
      }

      const color = COLOR.tier[Math.max(0, Math.min(4, it.tier - 1))] ?? COLOR.accent;
      push({ edge, pos, color });
    }
  });

  return null;
}
