/**
 * HudBridge — lives INSIDE the R3F Canvas. Pushes live camera + FPS samples
 * into useHudStore so the off-canvas HUD cards can render them.
 *
 * Sampling cadence: ~4 Hz for camera/fps, ~1 Hz for invariants. We DON'T
 * call setState on every frame — that would re-render the HUD cards 60 times
 * per second and tank the frame rate.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useHudStore } from "../store/useHudStore";
import { runAllInvariants } from "../lib/invariants";

const SAMPLE_INTERVAL_MS = 250;
const INVARIANT_INTERVAL_MS = 1000;

export function HudBridge() {
  const { camera, controls, gl, scene } = useThree();
  const lastSampleRef = useRef(0);
  const lastInvariantRef = useRef(0);
  const fpsAccumRef = useRef({ frames: 0, since: performance.now() });

  // Initial invariant sweep so the strip doesn't show "uninitialized" forever.
  useEffect(() => {
    runInvariantSweep();
    (window as any).__rcmtRenderer = gl;
    (window as any).__rcmtScene = scene;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    fpsAccumRef.current.frames += 1;
    const now = performance.now();

    if (now - lastSampleRef.current >= SAMPLE_INTERVAL_MS) {
      const elapsed = now - fpsAccumRef.current.since;
      const fps = elapsed > 0 ? (fpsAccumRef.current.frames * 1000) / elapsed : 0;
      fpsAccumRef.current.frames = 0;
      fpsAccumRef.current.since = now;

      const pos = camera.position;
      const tgt = (controls as { target?: { x: number; y: number; z: number } } | null)?.target;
      const tx = tgt?.x ?? 0;
      const ty = tgt?.y ?? 0;
      const tz = tgt?.z ?? 0;
      const dx = pos.x - tx;
      const dy = pos.y - ty;
      const dz = pos.z - tz;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const fov =
        "fov" in camera ? (camera as unknown as { fov: number }).fov : 0;

      useHudStore.getState().setCamera({
        px: pos.x,
        py: pos.y,
        pz: pos.z,
        tx,
        ty,
        tz,
        fov,
        distance,
      });
      useHudStore.getState().setFps(fps);

      const info = gl.info;
      useHudStore.getState().setRendererStats(
        info.render.calls,
        info.render.triangles,
      );

      lastSampleRef.current = now;
    }

    if (now - lastInvariantRef.current >= INVARIANT_INTERVAL_MS) {
      runInvariantSweep();
      lastInvariantRef.current = now;
    }
  });

  return null;
}

function runInvariantSweep() {
  const results = runAllInvariants();
  const setInv = useHudStore.getState().setInvariant;
  setInv("stride", results.stride.ok, results.stride.detail);
  setInv("tier_contiguity", results.tier_contiguity.ok, results.tier_contiguity.detail);
  setInv("fifo", results.fifo.ok, results.fifo.detail);
  setInv("bvh_proxy", results.bvh_proxy.ok, results.bvh_proxy.detail);
  setInv("foveation", results.foveation.ok, results.foveation.detail);
}
