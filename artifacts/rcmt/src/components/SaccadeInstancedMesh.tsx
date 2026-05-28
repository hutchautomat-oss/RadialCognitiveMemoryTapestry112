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
import { useSaccadeStore, MAX_NODES, STRIDE, nodesToFrame } from "../store/useSaccadeStore";
import { NetworkManager } from "../network/NetworkManager";

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
    const spawnTime = useSaccadeStore.getState().spawnTime;
    const selectedSlots = useSaccadeStore.getState().selectedSlots;
    const hasSelection = selectedSlots.size > 0;
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

        tempObject.position.set(frameData[offset], frameData[offset + 1], frameData[offset + 2]);
        tempObject.scale.setScalar(scale * 0.15 * popMul * selMul);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);

        if (isSelected) {
          tempColor.setRGB(0, 1, 1);
        } else {
          tempColor.setRGB(frameData[offset + 3], frameData[offset + 4], frameData[offset + 5]);
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
      onPointerDown={onPointerDown as never}
      onPointerUp={onPointerUp}
      frustumCulled={false}
    />
  );
}
