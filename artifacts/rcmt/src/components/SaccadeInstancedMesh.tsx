/**
 * SaccadeInstancedMesh — 1-draw-call visual cortex for the RCMT Tapestry.
 *
 * Reads directly from useSaccadeStore.mockFrames[activeFrameIndex]. Drag
 * writes back to the same buffer by slot index (instanceId === slotIndex,
 * guaranteed by the BVH proxy invariant).
 *
 * Zero-allocation per-frame: tempObject and tempColor are module-level singletons.
 * Dead nodes are hidden via hiddenMatrix (scale = 0), not removed from the buffer.
 * The FIFO slot reclaimer feeds vacantSlots back to the store for reuse.
 */

import { useRef, useCallback } from "react";
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
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  TIER_LAMBDA,
  PROMOTION_ANIM_MS,
} from "../store/useSaccadeStore";
import { useHudStore } from "../store/useHudStore";
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
// Pointer travel (CSS px) past which a pointerdown becomes a relocate-drag
// instead of a select-click. Small enough that a deliberate drag registers
// instantly, large enough that a normal click never jitters into a move.
const DRAG_THRESHOLD_PX = 5;
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

  // Drag state. instanceId === slot index by BVH proxy invariant.
  // `moved` distinguishes a relocate-drag from a clean click: the drag-follow
  // in useFrame only kicks in once the pointer has travelled past
  // DRAG_THRESHOLD_PX, so a tap selects the node instead of teleporting it onto
  // the y=0 drag plane.
  const dragRef = useRef<{
    slot: number;
    startX: number;
    startY: number;
    moved: boolean;
  } | null>(null);
  // Currently-hovered slot for the source-phrase tooltip. Tracked in a ref so
  // pointermove updates don't churn React renders; we only call setHoveredSlot
  // when the slot identity changes (enter/leave/cross) or when the pointer
  // moves while hovering a phrase-bearing slot.
  const hoverRef = useRef<number | null>(null);

  const { raycaster, gl } = useThree();
  // OrbitControls instance (makeDefault). Disabled for the duration of an
  // actual node relocate-drag so the camera doesn't orbit while you reposition
  // a memory; left enabled for clicks so selection feels free.
  const controls = useThree((s) => s.controls) as { enabled?: boolean } | null;

  // ── Store subscriptions ──────────────────────────────────────────
  const mockFrames       = useSaccadeStore((s) => s.mockFrames);
  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const setVacant        = useSaccadeStore((s) => s.setVacantSlotRegistry);
  const isFileLoaded     = useSaccadeStore((s) => s.isFileLoaded);
  const isLassoMode      = useSaccadeStore((s) => s.isLassoMode);
  // Read selection non-reactively inside useFrame to avoid re-render churn —
  // see useFrame body. We only subscribe here to keep the component reactive
  // when the lasso clears/sets selection so the highlight kicks in on the
  // very next tick.
  useSaccadeStore((s) => s.selectedSlots);
  // Same rationale for the semantic-search overlay: re-kick render when a
  // /find sets or clears matches so the highlight lands on the very next tick.
  useSaccadeStore((s) => s.searchEpoch);

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
    // Semantic-search overlay state (read non-reactively — replaced wholesale
    // by setSearchMatches/clearSearch, not mutated in place).
    const searchActive = sState.searchActive;
    const searchMatches = sState.searchMatches;
    const nowMs = performance.now();
    const reducedMotion = useHudStore.getState().reducedMotion;
    // Task #3 per-tier state (read non-reactively for the same reason as
    // spawnTime — they're typed-array views mutated in place by the store).
    const slotTierArr = sState.slotTier;
    const massArr = sState.mass;
    const injectedAtArr = sState.injectedAt;
    const animStartArr = sState.animStartTime;
    const animFromArr = sState.animFromPos;
    const animToArr = sState.animToPos;

    const frameData: Float32Array | null =
      mockFrames[activeFrameIndex] ?? null;
    if (!frameData) return;

    // ── Drag follow — write directly to the VRAM frame ───────────
    // Only once the pointer has crossed DRAG_THRESHOLD_PX (dragRef.moved). A
    // clean click never relocates the node — it selects it (see onPointerDown).
    if (dragRef.current?.moved) {
      raycaster.ray.intersectPlane(_dragPlane, _hit);
      const slot = dragRef.current.slot;
      const off = slot * STRIDE;
      if (frameData[off + 6] > 0) {
        const y = frameData[off + 1]; // preserve Y; drag is XZ-only
        frameData[off + 0] = _hit.x;
        frameData[off + 2] = _hit.z;
        sState.markBVHDirty();
        NetworkManager.broadcastNodeUpdate(
          slot,
          _hit.x,
          y,
          _hit.z,
          frameData[off + 6],
          slotTierArr[slot],
        );
      }
    }

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
        // means "no animation" (pre-existing or demo-seeded node) → mul=1.
        let popMul = 1;
        const ts = spawnTime[i];
        if (ts > 0 && !reducedMotion) {
          const t = (nowMs - ts) / SPAWN_ANIM_MS;
          if (t >= 0 && t < 1) popMul = easeOutBack(t);
        }

        // Lasso highlight: bump scale 1.6× and tint cyan for captured slots.
        const isSelected = hasSelection && selectedSlots.has(i);
        const selMul = isSelected ? 1.6 : 1;

        // Semantic-search overlay (read-only): matches pop bigger + brighter,
        // non-matches dim to a faint context field. NEVER relocates a node —
        // position stays a deterministic function of slot index.
        const isMatch = searchActive && searchMatches.has(i);
        const searchScaleMul = searchActive && isMatch ? 1.5 : 1;

        // ── Task #3: promotion orbital shift ─────────────────────
        // While animStartTime[i] > 0 and t<1 we lerp position from animFromPos
        // toward animToPos, pulse scale up to 1.5× at midpoint, and flash the
        // color toward cyan via sin(πt). On arrival we snap and clear.
        let px = frameData[offset];
        let py = frameData[offset + 1];
        let pz = frameData[offset + 2];
        let promoMul = 1;
        let promoFlash = 0; // 0..1 weighting toward the flash color
        // Direction of the orbital shift: inward (promotion) flashes cyan,
        // outward (demotion drift toward the Dream rim) flashes warm/amber so
        // the two reads as opposite radial motions, not the same event.
        let flashOutward = false;
        const animStart = animStartArr[i];
        if (animStart > 0) {
          if (reducedMotion) {
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
          } else {
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
              // Compare radii (origin-distance) of the endpoints: a larger
              // destination radius = outward drift = demotion.
              flashOutward =
                tx * tx + ty * ty + tz * tz > fx * fx + fy * fy + fz * fz;
              const pulse = Math.sin(Math.PI * t);
              promoMul = 1 + 0.5 * pulse;
              promoFlash = pulse;
            }
          }
        }

        // ── Task #3: health-driven visual decay ─────────────────
        // Dim RGB by Health = exp(-λ_tier · Δt_seconds). Only applies to
        // tier-tracked slots (mass[i] > 0 ⇒ this slot was injected by the
        // tier system). Demo-seeded slots beyond the tracked range render
        // at full intensity so they don't visually fade.
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
        tempObject.scale.setScalar(scale * VISUAL_RADIUS_MULT * popMul * promoMul * selMul * searchScaleMul);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);

        if (isSelected) {
          tempColor.setRGB(0, 1, 1);
        } else {
          let r = frameData[offset + 3] * healthDim;
          let g = frameData[offset + 4] * healthDim;
          let b = frameData[offset + 5] * healthDim;
          if (promoFlash > 0) {
            // Inward (promotion) → cyan (0,1,1). Outward (demotion drift) →
            // warm amber (1, 0.47, 0.2), reading as "shedding to the rim".
            const fr = flashOutward ? 1 : 0;
            const fg = flashOutward ? 0.47 : 1;
            const fb = flashOutward ? 0.2 : 1;
            r = r + (fr - r) * promoFlash;
            g = g + (fg - g) * promoFlash;
            b = b + (fb - b) * promoFlash;
          }
          if (searchActive) {
            if (isMatch) {
              // Brighten matches toward white-hot (clamped at 1).
              r = Math.min(1, r * 1.7);
              g = Math.min(1, g * 1.7);
              b = Math.min(1, b * 1.7);
            } else {
              // Dim the non-matching field so matches pre-attentively pop.
              r *= 0.12;
              g *= 0.12;
              b *= 0.12;
            }
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

  // ── Pointer events: click-to-select vs drag-to-relocate ──────────
  // pointerdown arms a candidate drag. Window-level move/up listeners then
  // decide: travel past DRAG_THRESHOLD_PX → relocate-drag (camera frozen);
  // released without travelling → clean click → select that single memory.
  // Window listeners (not the mesh's pointerup) so a fast drag that leaves the
  // node still resolves correctly.
  const onPointerDown = useCallback(
    (e: {
      instanceId?: number;
      nativeEvent: PointerEvent;
      stopPropagation: () => void;
    }) => {
      if (isLassoMode || e.instanceId === undefined) return;
      e.stopPropagation();
      const slot = e.instanceId;
      dragRef.current = {
        slot,
        startX: e.nativeEvent.clientX,
        startY: e.nativeEvent.clientY,
        moved: false,
      };

      const onWinMove = (ev: PointerEvent) => {
        const d = dragRef.current;
        if (!d || d.moved) return;
        if (
          Math.hypot(ev.clientX - d.startX, ev.clientY - d.startY) >
          DRAG_THRESHOLD_PX
        ) {
          d.moved = true;
          gl.domElement.style.cursor = "grabbing";
          if (controls) controls.enabled = false; // freeze orbit during relocate
        }
      };
      const onWinUp = () => {
        window.removeEventListener("pointermove", onWinMove);
        window.removeEventListener("pointerup", onWinUp);
        const d = dragRef.current;
        dragRef.current = null;
        gl.domElement.style.cursor = "auto";
        if (controls) controls.enabled = true;
        // Clean click (never crossed the threshold) = pick this single memory.
        if (d && !d.moved) {
          useSaccadeStore.getState().setSelectedSlots(new Set([d.slot]));
        }
      };
      window.addEventListener("pointermove", onWinMove);
      window.addEventListener("pointerup", onWinUp);
    },
    [isLassoMode, gl, controls],
  );

  // ── Hover → source-phrase tooltip ────────────────────────────────
  // Only fires the store update when:
  //   (a) the slot under the cursor has a phrase attached (vacant/demo
  //       slots have slotPhrase[i] === null → no tooltip), and
  //   (b) we're not mid-drag (drag has visual priority).
  // Pointer screen coords come from the underlying DOM PointerEvent; r3f
  // forwards it on `e.nativeEvent`.
  const onPointerMove = useCallback(
    (e: {
      instanceId?: number;
      nativeEvent: PointerEvent;
      stopPropagation: () => void;
    }) => {
      if (dragRef.current || isLassoMode || e.instanceId === undefined) return;
      const slot = e.instanceId;
      const s = useSaccadeStore.getState();
      const phrase = s.slotPhrase[slot];
      const occupied = (s.mockFrames[s.activeFrameIndex]?.[slot * STRIDE + 6] ?? 0) > 0;
      // Cursor affordance: any live node is clickable, so hovering one shows a
      // pointer cursor — makes "this is selectable" obvious even from birds-eye.
      gl.domElement.style.cursor = occupied ? "pointer" : "auto";
      if (!phrase || !occupied) {
        // Crossed onto a slot we shouldn't show a tip for — clear if we were
        // showing one for a previous slot.
        if (hoverRef.current !== null) {
          hoverRef.current = null;
          s.setHoveredSlot(null);
        }
        return;
      }
      e.stopPropagation();
      hoverRef.current = slot;
      s.setHoveredSlot({ slot, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    },
    [isLassoMode, gl],
  );

  const onPointerOut = useCallback(() => {
    // Don't fight the grabbing cursor mid-relocate; only reset when idle.
    if (!dragRef.current) gl.domElement.style.cursor = "auto";
    if (hoverRef.current !== null) {
      hoverRef.current = null;
      useSaccadeStore.getState().setHoveredSlot(null);
    }
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
      onPointerMove={onPointerMove as never}
      onPointerOut={onPointerOut}
      frustumCulled={false}
    />
  );
}
