/**
 * useSaccadeStore — Saccade frame buffer, FIFO slot reclaimer, decay engine,
 *                   and BVH spatial index for picking/lasso on the 8k lattice.
 *
 * Works in two modes:
 *   LIVE   — mockFrames is empty; renders from useStore.nodes directly
 *   BINARY — mockFrames populated from a .bin file; scrubbing plays back frames
 *
 * Float32 stride layout per node (STRIDE = 7):
 *   [0] x   [1] y   [2] z   [3] r   [4] g   [5] b   [6] importance/scale
 *
 * Spatial index:
 *   The collisionBVH wraps a proxy BufferGeometry with exactly one triangle per
 *   VRAM slot, so `triangleIndex === slotIndex` (enforced via maxLeafTris: 1).
 *   Dead slots park their triangles far off-screen so they never produce hits.
 *   Rebuilds are LAZY: mutations only set bvhDirty=true; the actual rebuild
 *   happens on the next call to getCollisionBVH().
 */

import { create } from "zustand";
import { BufferAttribute, BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { SaccadeWorker } from "../workers/SaccadeWorkerManager";
import type { RCMTNode } from "./useStore";

export const MAX_NODES = 8000;
export const STRIDE = 7;

// ── RCMT v5.0 Physics & Density Constants ───────────────────────────
const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
const Z_STRATA_VISUAL = 5.0;
const NODE_DENSITY_BUBBLE = 0.6;
const MIN_SCALE = 0.15;
const SCALE_PER_CHAR = 0.02;
const MAX_SCALE = 1.5;

// BVH proxy triangle radius — MUST match SaccadeInstancedMesh's
// `SphereGeometry(1, 8, 8)` scaled by `scale * 0.15`. Any other multiplier
// desyncs picking from visuals.
const PROXY_SCALE_MULT = 0.15;
// Dead-slot park position. Far enough off-screen to never produce a lasso
// hit at any sane camera position; NOT 0/0/0 (would create a phantom at the
// foveated core), NOT Infinity (NaN-propagation risk inside BVH math).
const DEAD_SLOT_PARK = 1e6;

// Pre-computed equilateral-triangle offsets in the XZ plane (unit radius).
// Multiplied by (scale * PROXY_SCALE_MULT) per slot at proxy build time.
const TRI_OFFSETS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],
  [-0.5, 0, 0.8660254038],
  [-0.5, 0, -0.8660254038],
];

function sphericalFibonacci(i: number, total: number): [number, number, number] {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(total, 1));
  const theta = i * GOLDEN_ANGLE;
  const sinPhi = Math.sin(phi);
  return [sinPhi * Math.cos(theta), sinPhi * Math.sin(theta), Math.cos(phi)];
}

function normalizeColor(
  c: { r: number; g: number; b: number } | [number, number, number] | number,
): [number, number, number] {
  if (Array.isArray(c)) return [c[0], c[1], c[2]];
  if (typeof c === "number") return [c, c, c];
  return [c.r, c.g, c.b];
}

function certaintyToRGB(c: number): [number, number, number] {
  if (c > 0.6) {
    const t = (c - 0.6) / 0.4;
    return [0, t, 1];
  }
  const t = c / 0.6;
  return [0.5 * (1 - t), 0, 0.8 + 0.2 * t];
}

export function nodesToFrame(nodes: RCMTNode[]): Float32Array {
  const buf = new Float32Array(MAX_NODES * STRIDE);
  nodes.forEach((node, i) => {
    if (i >= MAX_NODES) return;
    const offset = i * STRIDE;
    const [r, g, b] = certaintyToRGB(node.certainty);
    buf[offset + 0] = node.position[0];
    buf[offset + 1] = node.position[1];
    buf[offset + 2] = node.position[2];
    buf[offset + 3] = r;
    buf[offset + 4] = g;
    buf[offset + 5] = b;
    buf[offset + 6] = node.size;
  });
  return buf;
}

/**
 * Append `additions` to `existing` without breaking FIFO order.
 * Uses a Set ONLY for dedup membership checks; never reconstructs from a Set
 * (which would collapse the insertion order). Same fix applies everywhere
 * vacantSlots gets new entries — call this helper, never `Array.from(new Set(…))`.
 */
function appendUniqueFIFO(existing: number[], additions: number[]): number[] {
  if (additions.length === 0) return existing;
  const seen = new Set(existing);
  const result = existing.slice();
  for (const idx of additions) {
    if (!seen.has(idx)) {
      seen.add(idx);
      result.push(idx);
    }
  }
  return result;
}

interface SaccadeStore {
  mockFrames: Float32Array[];
  activeFrameIndex: number;
  totalFrames: number;
  isFileLoaded: boolean;

  vacantSlots: number[];
  spawnTime: Float32Array;
  workerReady: boolean;

  // ── Spatial index ─────────────────────────────────────────────
  /** Lazily-built proxy BVH. Access via getCollisionBVH(), not directly. */
  collisionBVH: MeshBVH | null;
  bvhDirty: boolean;

  // ── Selection (VRAM-aware) ────────────────────────────────────
  /** Set of slot indices currently highlighted by the lasso. */
  selectedSlots: Set<number>;

  // ── Actions ───────────────────────────────────────────────────
  initWorker: () => void;
  loadFile: (file: File) => void;
  setFrameIndex: (index: number) => void;
  seedFromNodes: (nodes: RCMTNode[]) => void;
  updateLiveFrame: (nodes: RCMTNode[]) => void;
  setVacantSlotRegistry: (prunedIndices: number[]) => void;
  injectLiveIntentVector: (opts: {
    slot: number;
    textLength: number;
    colorRGB:
      | { r: number; g: number; b: number }
      | [number, number, number]
      | number;
  }) => number | null;

  /** Mark BVH stale — next getCollisionBVH() will rebuild. Cheap, idempotent. */
  markBVHDirty: () => void;
  /** Rebuild now from the active frame. Called lazily; user code should prefer getCollisionBVH(). */
  rebuildBVH: () => void;
  /** Get the current proxy BVH; rebuilds in place if dirty. */
  getCollisionBVH: () => MeshBVH | null;

  setSelectedSlots: (slots: Set<number>) => void;
  clearSelection: () => void;
  /**
   * Pure-VRAM purge: writes scale=0 for each selected slot, zeros its spawnTime
   * (so a half-running starburst doesn't keep animating into the dead window),
   * returns the slot indices to the FIFO vacantSlots queue (FIFO-preserving),
   * clears the selection, and marks the BVH dirty.
   *
   * Returns the number of slots actually purged.
   */
  blastSelectedSlots: () => number;
}

export const useSaccadeStore = create<SaccadeStore>((set, get) => ({
  mockFrames: [new Float32Array(MAX_NODES * STRIDE)],
  activeFrameIndex: 0,
  totalFrames: 1,
  isFileLoaded: false,
  vacantSlots: Array.from({ length: MAX_NODES }, (_, i) => i),
  spawnTime: new Float32Array(MAX_NODES),
  workerReady: false,

  collisionBVH: null,
  bvhDirty: true,
  selectedSlots: new Set<number>(),

  initWorker: () => {
    SaccadeWorker.initialize();

    SaccadeWorker.onFileReady = (totalFrames) => {
      set({ totalFrames, isFileLoaded: true, bvhDirty: true });
    };

    SaccadeWorker.onFrameData = (frame) => {
      set((state) => {
        const updated = [...state.mockFrames];
        updated[frame.index] = frame.data as unknown as Float32Array;
        return { mockFrames: updated, bvhDirty: true };
      });
    };

    SaccadeWorker.onError = (msg) => {
      console.error("[SaccadeStore] Worker error:", msg);
    };

    set({ workerReady: true });
  },

  loadFile: (file) => {
    const { workerReady, initWorker, spawnTime } = get();
    if (!workerReady) initWorker();
    SaccadeWorker.loadFile(file);
    for (let i = 0; i < 20; i++) SaccadeWorker.seekFrame(i);
    spawnTime.fill(0);
    set({ isFileLoaded: false, mockFrames: [], activeFrameIndex: 0, bvhDirty: true });
  },

  setFrameIndex: (index) => {
    const { mockFrames, totalFrames } = get();
    const clamped = Math.max(0, Math.min(index, Math.max(0, totalFrames - 1)));
    set({ activeFrameIndex: clamped, bvhDirty: true });
    if (!mockFrames[clamped]) SaccadeWorker.seekFrame(clamped);
  },

  seedFromNodes: (nodes) => {
    const frame = nodesToFrame(nodes);
    const occupied = Math.min(nodes.length, MAX_NODES);
    const vacantSlots = Array.from(
      { length: MAX_NODES - occupied },
      (_, i) => i + occupied,
    );
    get().spawnTime.fill(0);
    set({
      mockFrames: [frame],
      totalFrames: 1,
      activeFrameIndex: 0,
      vacantSlots,
      bvhDirty: true,
    });
  },

  updateLiveFrame: (nodes) => {
    const frame = nodesToFrame(nodes);
    set((state) => {
      const updated = [...state.mockFrames];
      const trimmed = updated.length >= 200 ? updated.slice(-199) : updated;
      return {
        mockFrames: [...trimmed, frame],
        totalFrames: trimmed.length + 1,
        activeFrameIndex: trimmed.length,
        bvhDirty: true,
      };
    });
  },

  setVacantSlotRegistry: (prunedIndices) => {
    set((state) => {
      // Clear spawn timestamps for reclaimed slots so the next injection
      // into those slots gets a fresh 250ms starburst.
      for (const idx of prunedIndices) {
        if (idx >= 0 && idx < MAX_NODES) state.spawnTime[idx] = 0;
      }
      // FIFO-preserving append (do NOT use Array.from(new Set(…)) — that
      // collapses ordering when a reclaimed slot is already present).
      return {
        vacantSlots: appendUniqueFIFO(state.vacantSlots, prunedIndices),
        bvhDirty: true,
      };
    });
  },

  injectLiveIntentVector: ({ slot, textLength, colorRGB }) => {
    const { mockFrames, activeFrameIndex, vacantSlots, spawnTime } = get();
    const currentFrame = mockFrames[activeFrameIndex];

    if (!currentFrame) {
      console.warn("[Saccade] No active frame buffer — injection aborted.");
      return null;
    }
    if (vacantSlots.length === 0) {
      console.warn(
        "[Saccade] MAX DENSITY REACHED — awaiting pruning reclamation.",
      );
      return null;
    }

    const targetIndex = vacantSlots[0];
    const newVacant = vacantSlots.slice(1);

    const safeScale = Math.min(
      MIN_SCALE + textLength * SCALE_PER_CHAR,
      MAX_SCALE,
    );

    const radius = Math.sqrt(targetIndex) * NODE_DENSITY_BUBBLE;
    const [sx, sy, sz] = sphericalFibonacci(targetIndex, MAX_NODES);
    const x = sx * radius;
    const y = sy * radius;
    const zLattice = sz * radius;
    const z = zLattice + (slot - 3) * Z_STRATA_VISUAL;

    const [r, g, b] = normalizeColor(colorRGB);

    const offset = targetIndex * STRIDE;
    currentFrame[offset + 0] = x;
    currentFrame[offset + 1] = y;
    currentFrame[offset + 2] = z;
    currentFrame[offset + 3] = r;
    currentFrame[offset + 4] = g;
    currentFrame[offset + 5] = b;
    currentFrame[offset + 6] = safeScale;

    spawnTime[targetIndex] = performance.now();

    // Only set the dirty flag; do NOT rebuild here. The lazy getCollisionBVH()
    // will rebuild on the next picking query.
    set({ vacantSlots: newVacant, bvhDirty: true });
    return targetIndex;
  },

  markBVHDirty: () => set({ bvhDirty: true }),

  rebuildBVH: () => {
    const { mockFrames, activeFrameIndex } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame) {
      set({ collisionBVH: null, bvhDirty: false });
      return;
    }

    // 3 vertices per slot × 3 floats per vertex = 9 floats per slot.
    const positions = new Float32Array(MAX_NODES * 9);

    for (let i = 0; i < MAX_NODES; i++) {
      const off = i * STRIDE;
      const scale = frame[off + 6];
      const baseV = i * 9;

      if (scale > 0) {
        const cx = frame[off + 0];
        const cy = frame[off + 1];
        const cz = frame[off + 2];
        const r = scale * PROXY_SCALE_MULT;
        for (let v = 0; v < 3; v++) {
          positions[baseV + v * 3 + 0] = cx + TRI_OFFSETS[v][0] * r;
          positions[baseV + v * 3 + 1] = cy + TRI_OFFSETS[v][1] * r;
          positions[baseV + v * 3 + 2] = cz + TRI_OFFSETS[v][2] * r;
        }
      } else {
        // Park dead slot far off-screen. NOT at origin (would create a
        // phantom hit at the foveated core); NOT at Infinity (NaN risk
        // inside BVH bounds math).
        for (let v = 0; v < 3; v++) {
          positions[baseV + v * 3 + 0] = DEAD_SLOT_PARK;
          positions[baseV + v * 3 + 1] = DEAD_SLOT_PARK;
          positions[baseV + v * 3 + 2] = DEAD_SLOT_PARK;
        }
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    // maxLeafTris: 1 is non-negotiable — it's what guarantees
    // triangleIndex === slotIndex on shapecast/raycast hits.
    const bvh = new MeshBVH(geo, { maxLeafTris: 1 });
    set({ collisionBVH: bvh, bvhDirty: false });
  },

  getCollisionBVH: () => {
    if (get().bvhDirty) get().rebuildBVH();
    return get().collisionBVH;
  },

  setSelectedSlots: (slots) => set({ selectedSlots: slots }),
  clearSelection: () => set({ selectedSlots: new Set<number>() }),

  blastSelectedSlots: () => {
    const { mockFrames, activeFrameIndex, selectedSlots, spawnTime } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame || selectedSlots.size === 0) return 0;

    const purged: number[] = [];
    for (const slotIdx of selectedSlots) {
      if (slotIdx < 0 || slotIdx >= MAX_NODES) continue;
      const off = slotIdx * STRIDE;
      // Pure-VRAM purge: zero scale (hides the instance) and zero starburst
      // timestamp so a partially-running pop doesn't keep decaying through
      // the dead window after the slot is reused.
      frame[off + 6] = 0;
      spawnTime[slotIdx] = 0;
      purged.push(slotIdx);
    }

    // FIFO-preserving return-to-pool. Same fix as setVacantSlotRegistry —
    // never reconstruct from a Set.
    set((state) => ({
      vacantSlots: appendUniqueFIFO(state.vacantSlots, purged),
      selectedSlots: new Set<number>(),
      bvhDirty: true,
    }));

    return purged.length;
  },
}));
