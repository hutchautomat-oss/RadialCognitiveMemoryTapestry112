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
  TIER_LAMBDA,
  PROMOTION_ANIM_MS,
} from "../store/useSaccadeStore";
import { NetworkManager } from "../network/NetworkManager";

/**
 * Per-instance visual radius multiplier. The BVH proxy multiplier in
 * `useSaccadeStore.ts` (`BVH_PROXY_MULT`) MUST match this. Exported so
 * the runtime invariant `bvh_proxy` can compare both values at 1 Hz and
 * surface a red dot if either side is hand-edited.
 */
export const VISUAL_RADIUS_MULT = 0.15;

// ── Module-level singletons (zero GC pressure inside useFrame) ────
const tempObject = new Object3D();
const tempColor   = new Color();
const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
const _dragPlane   = new Plane(new Vector3(0, 1, 0), 0);
const _hit         = new Vector3();

const DEATH_THRESHOLD = 0.2;
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

    // Pull starburst timestamps + selection non-reactively (mutated in-place).
    const sState = useSaccadeStore.getState();
    const spawnTime = sState.spawnTime;
    const selectedSlots = sState.selectedSlots;
    const hasSelection = selectedSlots.size > 0;
    const nowMs = performance.now();
    // Task #3 per-tier state (read non-reactively for the same reason as
    // spawnTime — they're typed-array views mutated in place by the store).
    const slotTierArr = sState.slotTier;
    const massArr = sState.mass;
    const injectedAtArr = sState.injectedAt;
    const animStartArr = sState.animStartTime;
    const animFromArr = sState.animFromPos;
    const animToArr = sState.animToPos;

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
    // BINARY mode: use the stored frame buffer
    // LIVE mode: convert live nodes on the fly
    let frameData: Float32Array | null = mockFrames[activeFrameIndex] ?? null;
    if (!frameData && liveNodes.length > 0) {
      frameData = nodesToFrame(liveNodes);
    }
    if (!frameData) return;

    const newlyPruned: number[] = [];

    for (let i = 0; i < MAX_NODES; i++) {
      const offset = i * STRIDE;
      let scale = frameData[offset + 6];

      // Exponential decay: apply only in binary file mode
      if (isFileLoaded && scale > 0 && nodeTimestamps.current[i] !== -1.0) {
        if (scale < DEATH_THRESHOLD) {
          scale = 0.0;
          nodeTimestamps.current[i] = -1.0;
          newlyPruned.push(i);
        }
      }

      if (scale > 0) {
        // Mark slot as occupied
        if (nodeTimestamps.current[i] === -1.0) {
          nodeTimestamps.current[i] = performance.now();
        }

        // Starburst pop: within SPAWN_ANIM_MS of injection, multiply scale by
        // easeOutBack curve so the node bursts in then settles. spawnTime[i]==0
        // means "no animation" (pre-existing or legacy-added node) → mul=1.
        let popMul = 1;
        const ts = spawnTime[i];
        if (ts > 0) {
          const t = (nowMs - ts) / SPAWN_ANIM_MS;
          if (t >= 0 && t < 1) popMul = easeOutBack(t);
        }

        // Lasso highlight: bump scale 1.6× and tint cyan for captured slots.
        const isSelected = hasSelection && selectedSlots.has(i);
        const selMul = isSelected ? 1.6 : 1;

        // ── Task #3: promotion orbital shift ─────────────────────
        // While animStartTime[i] > 0 and t<1 we lerp position from animFromPos
        // toward animToPos, pulse scale up to 1.5× at midpoint, and flash the
        // color toward cyan via sin(πt). On arrival we snap and clear.
        let px = frameData[offset];
        let py = frameData[offset + 1];
        let pz = frameData[offset + 2];
        let promoMul = 1;
        let promoFlash = 0; // 0..1 weighting toward cyan
        const animStart = animStartArr[i];
        if (animStart > 0) {
          const rawT = (nowMs - animStart) / PROMOTION_ANIM_MS;
          if (rawT >= 1) {
            // Snap to destination + clear animation.
            const tx = animToArr[i * 3 + 0];
            const ty = animToArr[i * 3 + 1];
            const tz = animToArr[i * 3 + 2];
            frameData[offset + 0] = tx;
            frameData[offset + 1] = ty;
            frameData[offset + 2] = tz;
            px = tx;
            py = ty;
            pz = tz;
            animStartArr[i] = 0;
          } else if (rawT > 0) {
            // Cubic ease-in-out.
            const t = rawT;
            const ease =
              t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const fx = animFromArr[i * 3 + 0];
            const fy = animFromArr[i * 3 + 1];
            const fz = animFromArr[i * 3 + 2];
            const tx = animToArr[i * 3 + 0];
            const ty = animToArr[i * 3 + 1];
            const tz = animToArr[i * 3 + 2];
            px = fx + (tx - fx) * ease;
            py = fy + (ty - fy) * ease;
            pz = fz + (tz - fz) * ease;
            const pulse = Math.sin(Math.PI * t);
            promoMul = 1 + 0.5 * pulse;
            promoFlash = pulse;
          }
        }

        // ── Task #3: health-driven visual decay ─────────────────
        // Dim RGB by Health = exp(-λ_tier · Δt_seconds). Only applies to
        // tier-tracked slots (mass[i] > 0 ⇒ this slot was injected by the
        // tier system). Legacy snapshot slots (mass == 0) render at full
        // intensity so they don't visually fade.
        let healthDim = 1;
        const slotMass = massArr[i];
        if (slotMass > 0) {
          const tier = slotTierArr[i];
          if (tier >= 1 && tier <= TIER_LAMBDA.length) {
            const lambda = TIER_LAMBDA[tier - 1];
            const dt = (nowMs - injectedAtArr[i]) / 1000;
            const h = Math.exp(-lambda * dt);
            // Floor at 0.15 so a dying node is still visible until the next
            // decay sweep evaporates it — this is a render-side hint, not the
            // authoritative death gate.
            healthDim = Math.max(0.15, Math.min(1, h));
          }
        }

        tempObject.position.set(px, py, pz);
        tempObject.scale.setScalar(scale * VISUAL_RADIUS_MULT * popMul * promoMul * selMul);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);

        if (isSelected) {
          tempColor.setRGB(0, 1, 1);
        } else {
          let r = frameData[offset + 3] * healthDim;
          let g = frameData[offset + 4] * healthDim;
          let b = frameData[offset + 5] * healthDim;
          if (promoFlash > 0) {
            // Lerp toward cyan (0,1,1) by promoFlash.
            r = r + (0 - r) * promoFlash;
            g = g + (1 - g) * promoFlash;
            b = b + (1 - b) * promoFlash;
          }
          tempColor.setRGB(r, g, b);
        }
        mesh.setColorAt(i, tempColor);
      } else {
        mesh.setMatrixAt(i, hiddenMatrix);
      }
    }

    // Bridge dead slots to the FIFO reclaimer
    if (newlyPruned.length > 0) setVacant(newlyPruned);

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Throttled bounding sphere refresh (prevents ghost-node raycast hits)
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
        // NOTE: per-instance visual radius is set to `scale * VISUAL_RADIUS_MULT`
        // below (see tempObject.scale.setScalar(...)). The exported
        // VISUAL_RADIUS_MULT constant is the load-bearing value the BVH proxy
        // invariant compares against — do not inline-edit `0.15` here.
      onPointerDown={onPointerDown as never}
      onPointerUp={onPointerUp}
      frustumCulled={false}
    />
  );
}
