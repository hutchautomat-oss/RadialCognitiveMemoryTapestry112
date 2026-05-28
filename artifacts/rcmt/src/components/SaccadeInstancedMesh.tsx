/**
 * SaccadeInstancedMesh — 1-draw-call visual cortex for the RCMT Tapestry.
 *
 * Operates in two modes:
 *   LIVE   — reads directly from useStore.nodes, no binary file needed
 *   BINARY — reads from useSaccadeStore.mockFrames[activeFrameIndex]
 *
 * Zero-allocation per-frame: tempObject and tempColor are module-level singletons.
 * Dead nodes are hidden via hiddenMatrix (scale = 0), not removed from the buffer.
 * The FIFO slot reclaimer feeds vacantSlots back to the store for reuse.
 */

import { useRef, useEffect, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  InstancedMesh,
  Object3D,
  Color,
  Matrix4,
  Plane,
  Vector3,
  SphereGeometry,
  MeshBasicMaterial,
} from "three";
import { useStore } from "../store/useStore";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  nodesToFrame,
  tierForSlot,
  TIER_LAMBDA,
  DEATH_THRESHOLD,
  PROMOTION_DURATION_MS,
} from "../store/useSaccadeStore";
import { NetworkManager } from "../network/NetworkManager";

// ── Module-level singletons (zero GC pressure inside useFrame) ────
const tempObject = new Object3D();
const tempColor   = new Color();
const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
const _dragPlane   = new Plane(new Vector3(0, 1, 0), 0);
const _hit         = new Vector3();

// How many frames between bounding sphere recomputes (expensive)
const BOUNDS_REFRESH_INTERVAL = 60;
// Starburst spawn animation window (ms). Within this window, scale is multiplied
// by an easeOutBack curve that overshoots ~1.7× then settles back to 1.0×.
const SPAWN_ANIM_MS = 250;
const EASE_BACK_C1 = 1.70158;
const EASE_BACK_C3 = EASE_BACK_C1 + 1;

/** easeOutBack — overshoot-and-settle pop. t in [0,1] → multiplier in [0, ~1.7, 1]. */
function easeOutBack(t: number): number {
  const x = t - 1;
  return 1 + EASE_BACK_C3 * x * x * x + EASE_BACK_C1 * x * x;
}

/** Cubic ease-in-out — symmetric S-curve, t in [0,1] → [0,1]. */
function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// CTO mandate: during the 400ms promotion transit, the node pulses to 1.5×
// (sine peak at t=0.5) and flashes cyan before adopting the destination
// tier color. Cyan = [0, 1, 1].
const CYAN_R = 0.0;
const CYAN_G = 1.0;
const CYAN_B = 1.0;

export function SaccadeInstancedMesh() {
  const meshRef  = useRef<InstancedMesh>(null!);
  const frameRef = useRef(0); // frame counter for throttling

  // Decay timestamps: -1 = vacant slot
  const nodeTimestamps = useRef(new Float32Array(MAX_NODES).fill(-1.0));

  // Drag state
  const dragRef = useRef<{ instanceId: number } | null>(null);

  const { raycaster, gl } = useThree();

  // ── Stores ───────────────────────────────────────────────────────
  const liveNodes        = useStore((s) => s.nodes);
  const updateNodePos    = useStore((s) => s.updateNodePosition);
  const isLassoMode      = useStore((s) => s.isLassoMode);

  const mockFrames       = useSaccadeStore((s) => s.mockFrames);
  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const seedFromNodes    = useSaccadeStore((s) => s.seedFromNodes);
  const updateLiveFrame  = useSaccadeStore((s) => s.updateLiveFrame);
  const setVacant        = useSaccadeStore((s) => s.setVacantSlotRegistry);
  const isFileLoaded     = useSaccadeStore((s) => s.isFileLoaded);
  // Read selection non-reactively inside useFrame to avoid re-render churn —
  // see useFrame body. We only subscribe here to keep the component reactive
  // when the lasso clears/sets selection so the highlight kicks in on the
  // very next tick.
  useSaccadeStore((s) => s.selectedSlots);

  // ── Seed initial frame from live nodes on mount ──────────────────
  useEffect(() => {
    if (liveNodes.length > 0 && mockFrames.length === 0) {
      seedFromNodes(liveNodes);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When live nodes change and no binary file is loaded, append a snapshot
  useEffect(() => {
    if (!isFileLoaded && liveNodes.length > 0) {
      updateLiveFrame(liveNodes);
    }
  }, [liveNodes, isFileLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── useFrame — direct VRAM mutation ─────────────────────────────
  useFrame((_state, _delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    frameRef.current++;

    // Pull state non-reactively (mutated in-place each tick).
    const storeState = useSaccadeStore.getState();
    const spawnTime = storeState.spawnTime;
    const selectedSlots = storeState.selectedSlots;
    const promotionAnims = storeState.promotionAnims;
    const hasSelection = selectedSlots.size > 0;
    const hasPromotions = promotionAnims.size > 0;
    const nowMs = performance.now();

    // ── Drag follow ──────────────────────────────────────────────
    if (dragRef.current) {
      raycaster.ray.intersectPlane(_dragPlane, _hit);
      const idx = dragRef.current.instanceId;
      const node = liveNodes[idx];
      if (node) {
        const pos: [number, number, number] = [_hit.x, node.position[1], _hit.z];
        updateNodePos(node.index, pos);
        NetworkManager.broadcastNodeUpdate(node.index, pos[0], pos[1], pos[2], node.certainty);
      }
    }

    // ── Resolve frame data ───────────────────────────────────────
    let frameData: Float32Array | null = mockFrames[activeFrameIndex] ?? null;
    if (!frameData && liveNodes.length > 0) {
      frameData = nodesToFrame(liveNodes);
    }
    if (!frameData) return;

    const newlyPruned: number[] = [];
    const finishedAnims: number[] = [];

    for (let i = 0; i < MAX_NODES; i++) {
      const offset = i * STRIDE;
      let scale = frameData[offset + 6];

      // ── Per-tier exponential decay (LIVE MODE ONLY). λ varies per tier
      //    (Facts persist; Dreams evaporate). Replay frames are immutable
      //    snapshots — mutating them during scrub would rewrite history and
      //    break timeline replay semantics, so we gate on !isFileLoaded.
      //    Skip decay for slots in active promotion (animation owns state).
      const inPromotion = hasPromotions && promotionAnims.has(i);
      if (!isFileLoaded && scale > 0 && !inPromotion) {
        const lambda = TIER_LAMBDA[tierForSlot(i) - 1];
        scale *= Math.exp(-lambda * _delta);
        if (scale < DEATH_THRESHOLD) {
          scale = 0;
          newlyPruned.push(i);
        }
        frameData[offset + 6] = scale;
      }

      if (scale > 0 || inPromotion) {
        // Defaults: read from frame buffer (the resting state).
        let px = frameData[offset + 0];
        let py = frameData[offset + 1];
        let pz = frameData[offset + 2];
        let cr = frameData[offset + 3];
        let cg = frameData[offset + 4];
        let cb = frameData[offset + 5];
        let renderScale = scale;

        // ── Promotion animation override (CTO spec: 1.5× pulse + cyan flash)
        if (inPromotion) {
          const anim = promotionAnims.get(i)!;
          const rawT = (nowMs - anim.startMs) / PROMOTION_DURATION_MS;
          if (rawT >= 1) {
            // Settle into destination state, then drop the animation.
            px = anim.toPos[0]; py = anim.toPos[1]; pz = anim.toPos[2];
            cr = anim.toColor[0]; cg = anim.toColor[1]; cb = anim.toColor[2];
            renderScale = anim.baseScale;
            // Write the settled state back into the frame so subsequent ticks
            // (without the anim) render correctly.
            frameData[offset + 0] = px; frameData[offset + 1] = py; frameData[offset + 2] = pz;
            frameData[offset + 3] = cr; frameData[offset + 4] = cg; frameData[offset + 5] = cb;
            frameData[offset + 6] = renderScale;
            spawnTime[i] = nowMs; // give the new home a starburst pop
            finishedAnims.push(i);
          } else {
            const e = easeInOutCubic(rawT);
            // Position lerp: from → to via cubic-ease.
            px = anim.fromPos[0] + (anim.toPos[0] - anim.fromPos[0]) * e;
            py = anim.fromPos[1] + (anim.toPos[1] - anim.fromPos[1]) * e;
            pz = anim.fromPos[2] + (anim.toPos[2] - anim.fromPos[2]) * e;
            // Color: from → cyan (first half) → to (second half).
            if (rawT < 0.5) {
              const k = rawT * 2;
              cr = anim.fromColor[0] + (CYAN_R - anim.fromColor[0]) * k;
              cg = anim.fromColor[1] + (CYAN_G - anim.fromColor[1]) * k;
              cb = anim.fromColor[2] + (CYAN_B - anim.fromColor[2]) * k;
            } else {
              const k = (rawT - 0.5) * 2;
              cr = CYAN_R + (anim.toColor[0] - CYAN_R) * k;
              cg = CYAN_G + (anim.toColor[1] - CYAN_G) * k;
              cb = CYAN_B + (anim.toColor[2] - CYAN_B) * k;
            }
            // 1.5× pulse via half-sine: peaks at t=0.5.
            const pulseMul = 1 + 0.5 * Math.sin(rawT * Math.PI);
            renderScale = anim.baseScale * pulseMul;
          }
        }

        // Starburst pop (only applies when not in promotion).
        let popMul = 1;
        if (!inPromotion) {
          const ts = spawnTime[i];
          if (ts > 0) {
            const t = (nowMs - ts) / SPAWN_ANIM_MS;
            if (t >= 0 && t < 1) popMul = easeOutBack(t);
          }
        }

        // Lasso highlight: bump scale 1.6× and tint cyan for captured slots.
        const isSelected = hasSelection && selectedSlots.has(i);
        const selMul = isSelected ? 1.6 : 1;

        tempObject.position.set(px, py, pz);
        tempObject.scale.setScalar(renderScale * 0.15 * popMul * selMul);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);

        if (isSelected) {
          tempColor.setRGB(0, 1, 1);
        } else {
          tempColor.setRGB(cr, cg, cb);
        }
        mesh.setColorAt(i, tempColor);

        // Track timestamp for legacy bookkeeping (kept for parity with the
        // pre-Task-3 ref; future cleanup can remove).
        if (nodeTimestamps.current[i] === -1.0) {
          nodeTimestamps.current[i] = nowMs;
        }
      } else {
        mesh.setMatrixAt(i, hiddenMatrix);
        if (nodeTimestamps.current[i] !== -1.0) nodeTimestamps.current[i] = -1.0;
      }
    }

    // Drop finished promotion animations after the loop (avoid mutating
    // the Map while iterating it).
    if (finishedAnims.length > 0) {
      for (const slot of finishedAnims) promotionAnims.delete(slot);
      storeState.markBVHDirty();
    }

    // Bridge dead slots to the FIFO reclaimer (per-tier bucketing happens inside).
    if (newlyPruned.length > 0) setVacant(newlyPruned);

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    if (frameRef.current % BOUNDS_REFRESH_INTERVAL === 0) {
      mesh.computeBoundingSphere();
    }
  });

  // ── Pointer events for drag ──────────────────────────────────────
  const onPointerDown = useCallback(
    (e: { instanceId?: number; stopPropagation: () => void }) => {
      if (isLassoMode || e.instanceId === undefined) return;
      e.stopPropagation();
      dragRef.current = { instanceId: e.instanceId };
      gl.domElement.style.cursor = "grabbing";
    },
    [isLassoMode, gl],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    gl.domElement.style.cursor = "auto";
  }, [gl]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[new SphereGeometry(1, 8, 8), new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), MAX_NODES]}
      onPointerDown={onPointerDown as never}
      onPointerUp={onPointerUp}
      frustumCulled={false}
    />
  );
}
