/**
 * useSaccadeStore — Saccade frame buffer, per-tier FIFO reclaimer, decay engine,
 *                   cosine reinforcement, promotion animator, and BVH index for
 *                   the 8k cognitive lattice.
 *
 * Modes:
 *   LIVE   — mockFrames[0] is the source of truth; in-place mutation
 *   BINARY — mockFrames populated from a .bin file; scrubbing replays frames
 *
 * Float32 stride layout per node (STRIDE = 7):
 *   [0] x   [1] y   [2] z   [3] r   [4] g   [5] b   [6] importance/scale
 *
 * Task #3 — Per-tier ontology pools:
 *   Tier 1 Fact      slots [0,    2000)   cap 2000   λ 0.005/s
 *   Tier 2 Scenario  slots [2000, 4000)   cap 2000   λ 0.015/s
 *   Tier 3 Metric    slots [4000, 5500)   cap 1500   λ 0.030/s
 *   Tier 4 Theory    slots [5500, 7000)   cap 1500   λ 0.060/s
 *   Tier 5 Dream     slots [7000, 8000)   cap 1000   λ 0.120/s
 *
 *   Each tier has its own FIFO of vacant slot indices. Dream churn can only
 *   evict Dreams; Fact slots are protected by their slow decay + isolated pool.
 *
 *   Pre-allocated 12.28 MB embedding bank (Float32Array(8000 * 384)) backs
 *   cosine-similarity reinforcement: if incoming text has cos>0.92 against an
 *   existing occupied slot, that slot is reinforced (scale bumped, count++)
 *   rather than spawning a fresh node. After 3 reinforcements a node promotes
 *   inward (tier N → N-1) with a 400ms cubic-ease animation, pulsing 1.5×
 *   and flashing cyan during transit.
 */

import { create } from "zustand";
import { BufferAttribute, BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { SaccadeWorker } from "../workers/SaccadeWorkerManager";
import type { RCMTNode } from "./useStore";
import { colorForSlot } from "../workers/OnnxWorkerManager";

export const MAX_NODES = 8000;
export const STRIDE = 7;
export const EMBED_DIM = 384;

// ── Tier ontology (locked Task #3 spec) ─────────────────────────────
export const TIER_COUNT = 5;
/** Tier slot caps — Facts/Scenarios bulk, Dreams sparse. Sum = MAX_NODES. */
export const TIER_CAPS: ReadonlyArray<number> = [2000, 2000, 1500, 1500, 1000];
/** Per-second exponential decay rate λ. Facts persist; Dreams evaporate. */
export const TIER_LAMBDA: ReadonlyArray<number> = [
  0.005, 0.015, 0.03, 0.06, 0.12,
];
/** Cumulative start indices: [0, 2000, 4000, 5500, 7000, 8000]. */
export const TIER_OFFSETS: ReadonlyArray<number> = (() => {
  const out = [0];
  for (let i = 0; i < TIER_CAPS.length; i++) out.push(out[i] + TIER_CAPS[i]);
  return out;
})();

/** Map a slot index → tier number (1..5). O(log n) but n=5, so unrolled. */
export function tierForSlot(slot: number): 1 | 2 | 3 | 4 | 5 {
  if (slot < TIER_OFFSETS[1]) return 1;
  if (slot < TIER_OFFSETS[2]) return 2;
  if (slot < TIER_OFFSETS[3]) return 3;
  if (slot < TIER_OFFSETS[4]) return 4;
  return 5;
}

// ── Reinforcement + promotion knobs (locked) ────────────────────────
export const REINFORCE_THRESHOLD = 0.92;
const REINFORCE_BOOST = 0.3;
export const PROMOTION_THRESHOLD = 3;
export const PROMOTION_DURATION_MS = 400;
/** Death threshold for decay. ln(MAX/DEATH)/λ gives lifespan: Facts ~11min, Dreams ~28s. */
export const DEATH_THRESHOLD = 0.05;

// ── RCMT geometry constants ─────────────────────────────────────────
const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
// Z-strata (the old per-tier Z offset that fanned the lattice into 5 flat
// layers) was removed when the lattice was unified into one continuous 3D
// sphere. Tiers are now visually distinguished by color + foveated radius
// alone. The 5.0 constant was local-render decoration and never had any
// network/HE meaning — see replit.md "Architecture decisions".
const NODE_DENSITY_BUBBLE = 0.6;
const MIN_SCALE = 0.15;
const SCALE_PER_CHAR = 0.02;
const MAX_SCALE = 1.5;

// BVH proxy triangle radius — MUST match SaccadeInstancedMesh's
// `SphereGeometry(1, 8, 8)` scaled by `scale * 0.15`.
const PROXY_SCALE_MULT = 0.15;

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

/**
 * Compute the resting (x,y,z) for any slot index on the unified 3D sphere.
 *
 * Geometry contract (one continuous sphere, no Z-strata):
 *   - Angular position: ONE global Golden-Angle Fibonacci spiral over all
 *     8000 slots — by construction no two slots ever share an angular
 *     vector from the origin, so radial collinearity / Z-fighting cannot
 *     occur even when foveation pushes tiers onto different shells.
 *   - Radius: sqrt(slot) * NODE_DENSITY_BUBBLE — slot 0 sits at the
 *     foveated core, slot 7999 at the rim (~53.7). Because the per-tier
 *     index ranges are contiguous (Fact [0,2000), …, Dream [7000,8000)),
 *     sqrt-growth naturally produces foveated tier shells: Facts inner,
 *     Dreams outer, preserving the "closer to fact, closer to act" maxim
 *     without any explicit per-tier radius table.
 *
 * Z-strata were removed at the same time as the unified-sphere
 * migration; see replit.md "Architecture decisions" for the rationale.
 */
export function slotRestPosition(slot: number): [number, number, number] {
  const radius = Math.sqrt(slot) * NODE_DENSITY_BUBBLE;
  const [sx, sy, sz] = sphericalFibonacci(slot, MAX_NODES);
  return [sx * radius, sy * radius, sz * radius];
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
 * FIFO-preserving append. Uses a Set ONLY for dedup membership; never
 * reconstructs from a Set (which would collapse insertion order).
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

/** Build the initial vacant-by-tier registry: every slot vacant, in its tier. */
function freshVacantByTier(): number[][] {
  const out: number[][] = [];
  for (let t = 0; t < TIER_COUNT; t++) {
    const start = TIER_OFFSETS[t];
    const end = TIER_OFFSETS[t + 1];
    const arr = new Array<number>(end - start);
    for (let i = 0; i < arr.length; i++) arr[i] = start + i;
    out.push(arr);
  }
  return out;
}

/** Compute dot product of an incoming embedding with the slot's stored embedding. */
function dotWithSlot(
  embedding: Float32Array,
  bank: Float32Array,
  slot: number,
): number {
  let s = 0;
  const base = slot * EMBED_DIM;
  for (let i = 0; i < EMBED_DIM; i++) s += embedding[i] * bank[base + i];
  return s;
}

// ── Promotion animation record ──────────────────────────────────────
export interface PromotionAnim {
  /** The slot being animated (destination slot, occupied for the full duration). */
  destSlot: number;
  fromPos: [number, number, number];
  toPos: [number, number, number];
  fromColor: [number, number, number];
  toColor: [number, number, number];
  baseScale: number;
  startMs: number;
}

export type ReinforceResult =
  | { kind: "reinforced"; slotIndex: number; similarity: number; promoted: boolean }
  | { kind: "injected"; slotIndex: number }
  | { kind: "tier-full"; slotIndex: null }
  | { kind: "failed"; slotIndex: null };

interface SaccadeStore {
  mockFrames: Float32Array[];
  activeFrameIndex: number;
  totalFrames: number;
  isFileLoaded: boolean;

  /** Per-tier vacant FIFOs. 5 arrays, one per ontological tier (1-indexed externally). */
  vacantByTier: number[][];
  spawnTime: Float32Array;
  workerReady: boolean;

  /** Pre-allocated 12.28 MB embedding bank: Float32Array(8000 * 384). */
  embeddings: Float32Array;
  /** Per-slot reinforcement counter. Cleared on inject/promote/blast. */
  reinforcementCount: Uint16Array;
  /**
   * Active promotion animations keyed by destination slot. Mutated in place
   * (Map is a stable reference; readers in useFrame iterate every tick).
   */
  promotionAnims: Map<number, PromotionAnim>;

  // ── Spatial index ─────────────────────────────────────────────
  collisionBVH: MeshBVH | null;
  bvhDirty: boolean;

  // ── Selection ─────────────────────────────────────────────────
  selectedSlots: Set<number>;
  lassoEventTick: number;
  lassoEventCount: number;

  // ── Actions ───────────────────────────────────────────────────
  initWorker: () => void;
  loadFile: (file: File) => void;
  setFrameIndex: (index: number) => void;
  seedFromNodes: (nodes: RCMTNode[]) => void;
  updateLiveFrame: (nodes: RCMTNode[]) => void;
  setVacantSlotRegistry: (prunedIndices: number[]) => void;

  /**
   * Legacy direct-write injection (no embedding, no reinforcement check).
   * New code should prefer reinforceOrInject. Returns the slot index used.
   */
  injectLiveIntentVector: (opts: {
    slot: number;
    textLength: number;
    colorRGB:
      | { r: number; g: number; b: number }
      | [number, number, number]
      | number;
  }) => number | null;

  /**
   * Embedding-aware injection. Scans all occupied slots for cosine
   * similarity > REINFORCE_THRESHOLD; if found, reinforces the existing slot
   * (and possibly promotes it inward); otherwise allocates from the target
   * tier's FIFO and stores the embedding.
   */
  reinforceOrInject: (opts: {
    slot: number;
    textLength: number;
    colorRGB:
      | { r: number; g: number; b: number }
      | [number, number, number]
      | number;
    embedding: Float32Array;
  }) => ReinforceResult;

  markBVHDirty: () => void;
  rebuildBVH: () => void;
  getCollisionBVH: () => MeshBVH | null;

  setSelectedSlots: (slots: Set<number>) => void;
  clearSelection: () => void;
  blastSelectedSlots: () => number;

  /** Total vacant slots across all tiers (cheap; sums 5 ints). */
  totalVacant: () => number;

  /** Internal — promote a slot inward. Returns true on success. */
  /** Returns destination slot on success, null on failure. */
  _promoteSlot: (fromSlot: number, newTier: 1 | 2 | 3 | 4) => number | null;
}

export const useSaccadeStore = create<SaccadeStore>((set, get) => ({
  // Start EMPTY so the mount-time `seedFromNodes` path is the single source
  // of truth for initial occupancy. A pre-allocated frame here would leave
  // `vacantByTier` fully vacant while slots already hold legacy nodes,
  // letting the allocator hand out already-occupied indices. Components
  // gate on `mockFrames[activeFrameIndex]` being defined.
  mockFrames: [],
  activeFrameIndex: 0,
  totalFrames: 0,
  isFileLoaded: false,
  vacantByTier: freshVacantByTier(),
  spawnTime: new Float32Array(MAX_NODES),
  workerReady: false,

  // 8000 * 384 * 4 bytes = 12,288,000 bytes = 12.288 MB. Allocated once,
  // mutated in place via .set(). CTO mandate: zero per-slot JS-array indirection.
  embeddings: new Float32Array(MAX_NODES * EMBED_DIM),
  reinforcementCount: new Uint16Array(MAX_NODES),
  promotionAnims: new Map<number, PromotionAnim>(),

  collisionBVH: null,
  bvhDirty: true,
  selectedSlots: new Set<number>(),
  lassoEventTick: 0,
  lassoEventCount: 0,

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
    const { workerReady, initWorker, spawnTime, reinforcementCount, embeddings } = get();
    if (!workerReady) initWorker();
    SaccadeWorker.loadFile(file);
    for (let i = 0; i < 20; i++) SaccadeWorker.seekFrame(i);
    spawnTime.fill(0);
    reinforcementCount.fill(0);
    // Wipe the embedding bank — stale vectors from the prior session must not
    // influence cosine reinforcement after a file load. The bank is rebuilt
    // organically as new live injections happen on top of the replay.
    embeddings.fill(0);
    get().promotionAnims.clear();
    set({
      isFileLoaded: false,
      mockFrames: [],
      activeFrameIndex: 0,
      vacantByTier: freshVacantByTier(),
      bvhDirty: true,
    });
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
    // Mark first N slots as occupied — they fall into whichever tier their
    // index lands in (typically all Fact tier for small seeds).
    const vacantByTier = freshVacantByTier();
    for (let t = 0; t < TIER_COUNT; t++) {
      vacantByTier[t] = vacantByTier[t].filter((idx) => idx >= occupied);
    }
    get().spawnTime.fill(0);
    get().reinforcementCount.fill(0);
    get().promotionAnims.clear();
    set({
      mockFrames: [frame],
      totalFrames: 1,
      activeFrameIndex: 0,
      vacantByTier,
      bvhDirty: true,
    });
  },

  /**
   * Live-mode bridge from legacy useStore.nodes. Mutates the active frame
   * IN PLACE so VRAM-injected slots (held at high indices via the per-tier
   * FIFOs) survive across legacy node updates. Does NOT push new history
   * frames — that's BINARY mode's job.
   */
  updateLiveFrame: (nodes) => {
    const { mockFrames, activeFrameIndex, vacantByTier } = get();
    let frame = mockFrames[activeFrameIndex];
    let totalFrames = get().totalFrames;
    if (!frame) {
      frame = new Float32Array(MAX_NODES * STRIDE);
      const updated = [...mockFrames];
      updated[activeFrameIndex] = frame;
      totalFrames = Math.max(totalFrames, activeFrameIndex + 1);
      set({ mockFrames: updated, totalFrames });
    }
    // Track which legacy-node slots are newly occupied so we can evict them
    // from per-tier vacancy. Without this, the per-tier allocator can later
    // hand out a slot that's already showing a legacy node and silently
    // overwrite it. This is the source-of-truth fix called out in review.
    const newlyOccupiedByTier: number[][] = [[], [], [], [], []];
    for (const node of nodes) {
      if (node.index < 0 || node.index >= MAX_NODES) continue;
      const off = node.index * STRIDE;
      const wasVacant = frame[off + 6] <= 0;
      const [r, g, b] = certaintyToRGB(node.certainty);
      frame[off + 0] = node.position[0];
      frame[off + 1] = node.position[1];
      frame[off + 2] = node.position[2];
      frame[off + 3] = r;
      frame[off + 4] = g;
      frame[off + 5] = b;
      frame[off + 6] = node.size;
      if (wasVacant && node.size > 0) {
        newlyOccupiedByTier[tierForSlot(node.index) - 1].push(node.index);
      }
    }
    // Reconcile per-tier vacancy by removing newly occupied indices.
    let vacancyChanged = false;
    const nextByTier = vacantByTier.map((arr, t) => {
      const occ = newlyOccupiedByTier[t];
      if (occ.length === 0) return arr;
      const occSet = new Set(occ);
      const filtered = arr.filter((idx) => !occSet.has(idx));
      if (filtered.length !== arr.length) vacancyChanged = true;
      return filtered;
    });
    if (vacancyChanged) set({ vacantByTier: nextByTier, bvhDirty: true });
    else set({ bvhDirty: true });
  },

  setVacantSlotRegistry: (prunedIndices) => {
    if (prunedIndices.length === 0) return;
    set((state) => {
      const { spawnTime, reinforcementCount } = state;
      // Bucket pruned indices by tier and FIFO-append per-tier.
      const buckets: number[][] = [[], [], [], [], []];
      for (const idx of prunedIndices) {
        if (idx < 0 || idx >= MAX_NODES) continue;
        spawnTime[idx] = 0;
        reinforcementCount[idx] = 0;
        buckets[tierForSlot(idx) - 1].push(idx);
      }
      const next = state.vacantByTier.map((arr, t) =>
        buckets[t].length === 0 ? arr : appendUniqueFIFO(arr, buckets[t]),
      );
      return { vacantByTier: next, bvhDirty: true };
    });
  },

  injectLiveIntentVector: ({ slot, textLength, colorRGB }) => {
    const { mockFrames, activeFrameIndex, vacantByTier, spawnTime } = get();
    const currentFrame = mockFrames[activeFrameIndex];
    if (!currentFrame) {
      console.warn("[Saccade] No active frame buffer — injection aborted.");
      return null;
    }
    const tierIdx = Math.max(1, Math.min(TIER_COUNT, slot)) - 1;
    const tierVacant = vacantByTier[tierIdx];
    if (tierVacant.length === 0) {
      console.warn(`[Saccade] Tier ${tierIdx + 1} FULL — awaiting reclamation.`);
      return null;
    }

    const targetIndex = tierVacant[0];
    const [x, y, z] = slotRestPosition(targetIndex);
    const safeScale = Math.min(
      MIN_SCALE + textLength * SCALE_PER_CHAR,
      MAX_SCALE,
    );
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
    get().reinforcementCount[targetIndex] = 0;

    const nextByTier = vacantByTier.slice();
    nextByTier[tierIdx] = tierVacant.slice(1);
    set({ vacantByTier: nextByTier, bvhDirty: true });
    return targetIndex;
  },

  reinforceOrInject: ({ slot, textLength, colorRGB, embedding }) => {
    const {
      mockFrames,
      activeFrameIndex,
      vacantByTier,
      spawnTime,
      embeddings,
      reinforcementCount,
    } = get();
    const currentFrame = mockFrames[activeFrameIndex];
    if (!currentFrame) return { kind: "failed", slotIndex: null };

    // ── 1. Scan occupied slots for cosine reinforcement ─────────────
    // 8000 * 384 = 3.07M FLOPs per scan; ~0.3ms in modern V8. Acceptable.
    let bestSlot = -1;
    let bestSim = -Infinity;
    for (let i = 0; i < MAX_NODES; i++) {
      if (currentFrame[i * STRIDE + 6] <= 0) continue;
      // Skip slots whose embedding bank is all-zero (legacy seed nodes that
      // never had an embedding stored).
      const base = i * EMBED_DIM;
      if (embeddings[base] === 0 && embeddings[base + 1] === 0) continue;
      const s = dotWithSlot(embedding, embeddings, i);
      if (s > bestSim) {
        bestSim = s;
        bestSlot = i;
      }
    }

    if (bestSlot >= 0 && bestSim > REINFORCE_THRESHOLD) {
      // ── 2a. Reinforce existing slot ────────────────────────────────
      const off = bestSlot * STRIDE;
      currentFrame[off + 6] = Math.min(
        MAX_SCALE,
        currentFrame[off + 6] + REINFORCE_BOOST,
      );
      spawnTime[bestSlot] = performance.now(); // re-trigger pop animation
      reinforcementCount[bestSlot] = reinforcementCount[bestSlot] + 1;

      const curTier = tierForSlot(bestSlot);
      let promoted = false;
      let resultSlot = bestSlot;
      if (
        reinforcementCount[bestSlot] >= PROMOTION_THRESHOLD &&
        curTier > 1
      ) {
        const destSlot = get()._promoteSlot(bestSlot, (curTier - 1) as 1 | 2 | 3 | 4);
        if (destSlot !== null) {
          promoted = true;
          // After promotion, bestSlot is zeroed and the node lives at destSlot.
          // Network broadcasts and console logs must reference the destination
          // or they will advertise an empty slot.
          resultSlot = destSlot;
        }
      }
      set({ bvhDirty: true });
      return { kind: "reinforced", slotIndex: resultSlot, similarity: bestSim, promoted };
    }

    // ── 2b. Fresh inject into target tier's FIFO ──────────────────
    const tierIdx = Math.max(1, Math.min(TIER_COUNT, slot)) - 1;
    const tierVacant = vacantByTier[tierIdx];
    if (tierVacant.length === 0) {
      return { kind: "tier-full", slotIndex: null };
    }

    const targetIndex = tierVacant[0];
    const [x, y, z] = slotRestPosition(targetIndex);
    const safeScale = Math.min(
      MIN_SCALE + textLength * SCALE_PER_CHAR,
      MAX_SCALE,
    );
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
    reinforcementCount[targetIndex] = 0;

    // Store embedding into the pre-allocated bank at the slot's offset.
    embeddings.set(embedding, targetIndex * EMBED_DIM);

    const nextByTier = vacantByTier.slice();
    nextByTier[tierIdx] = tierVacant.slice(1);
    set({ vacantByTier: nextByTier, bvhDirty: true });
    return { kind: "injected", slotIndex: targetIndex };
  },

  _promoteSlot: (fromSlot: number, newTier: 1 | 2 | 3 | 4): number | null => {
    const state = get();
    const {
      mockFrames,
      activeFrameIndex,
      vacantByTier,
      embeddings,
      reinforcementCount,
      promotionAnims,
      spawnTime,
    } = state;
    const frame = mockFrames[activeFrameIndex];
    if (!frame) return null;

    const newTierIdx = newTier - 1;
    const destVacant = vacantByTier[newTierIdx];
    if (destVacant.length === 0) {
      // Destination tier full — leave node in place, reset counter to try again later.
      reinforcementCount[fromSlot] = 0;
      return null;
    }

    const toSlot = destVacant[0];
    const fromOff = fromSlot * STRIDE;
    const toOff = toSlot * STRIDE;

    const fromPos: [number, number, number] = [
      frame[fromOff + 0],
      frame[fromOff + 1],
      frame[fromOff + 2],
    ];
    const fromColor: [number, number, number] = [
      frame[fromOff + 3],
      frame[fromOff + 4],
      frame[fromOff + 5],
    ];
    const baseScale = frame[fromOff + 6];
    const toPos = slotRestPosition(toSlot);
    const toColor = colorForSlot(newTier);

    // Copy embedding from old slot → new slot.
    embeddings.set(
      embeddings.subarray(fromSlot * EMBED_DIM, (fromSlot + 1) * EMBED_DIM),
      toSlot * EMBED_DIM,
    );

    // Initialize destination at FROM position so animation interpolates cleanly.
    frame[toOff + 0] = fromPos[0];
    frame[toOff + 1] = fromPos[1];
    frame[toOff + 2] = fromPos[2];
    frame[toOff + 3] = fromColor[0];
    frame[toOff + 4] = fromColor[1];
    frame[toOff + 5] = fromColor[2];
    frame[toOff + 6] = baseScale;
    spawnTime[toSlot] = 0; // promotion animation handles its own visual flair
    reinforcementCount[toSlot] = 0;

    // Free the old slot.
    frame[fromOff + 6] = 0;
    spawnTime[fromSlot] = 0;
    reinforcementCount[fromSlot] = 0;
    // Zero its embedding bank entry to avoid stale matches.
    embeddings.fill(
      0,
      fromSlot * EMBED_DIM,
      (fromSlot + 1) * EMBED_DIM,
    );

    // Register animation (Map mutated in place — promotionAnims ref stable).
    promotionAnims.set(toSlot, {
      destSlot: toSlot,
      fromPos,
      toPos,
      fromColor,
      toColor,
      baseScale,
      startMs: performance.now(),
    });

    // Update vacant pools: pop dest, return source.
    const nextByTier = vacantByTier.slice();
    nextByTier[newTierIdx] = destVacant.slice(1);
    const fromTierIdx = tierForSlot(fromSlot) - 1;
    nextByTier[fromTierIdx] = appendUniqueFIFO(
      nextByTier[fromTierIdx],
      [fromSlot],
    );
    set({ vacantByTier: nextByTier, bvhDirty: true });
    return toSlot;
  },

  markBVHDirty: () => set({ bvhDirty: true }),

  rebuildBVH: () => {
    const { mockFrames, activeFrameIndex } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame) {
      set({ collisionBVH: null, bvhDirty: false });
      return;
    }

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
        // Dead slot parked at Infinity (Task #1 locked spec).
        for (let v = 0; v < 9; v++) positions[baseV + v] = Infinity;
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    const bvh = new MeshBVH(geo, { maxLeafTris: 1 });
    set({ collisionBVH: bvh, bvhDirty: false });
  },

  getCollisionBVH: () => {
    if (get().bvhDirty) get().rebuildBVH();
    return get().collisionBVH;
  },

  setSelectedSlots: (slots) =>
    set((state) => ({
      selectedSlots: slots,
      lassoEventTick: state.lassoEventTick + 1,
      lassoEventCount: slots.size,
    })),
  clearSelection: () => set({ selectedSlots: new Set<number>() }),

  blastSelectedSlots: () => {
    const { mockFrames, activeFrameIndex, selectedSlots, spawnTime, reinforcementCount, embeddings } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame || selectedSlots.size === 0) return 0;

    const purged: number[] = [];
    for (const slotIdx of selectedSlots) {
      if (slotIdx < 0 || slotIdx >= MAX_NODES) continue;
      const off = slotIdx * STRIDE;
      frame[off + 6] = 0;
      spawnTime[slotIdx] = 0;
      reinforcementCount[slotIdx] = 0;
      embeddings.fill(
        0,
        slotIdx * EMBED_DIM,
        (slotIdx + 1) * EMBED_DIM,
      );
      purged.push(slotIdx);
    }

    // Bucket by tier and return per-tier FIFO.
    const buckets: number[][] = [[], [], [], [], []];
    for (const idx of purged) buckets[tierForSlot(idx) - 1].push(idx);

    set((state) => {
      const next = state.vacantByTier.map((arr, t) =>
        buckets[t].length === 0 ? arr : appendUniqueFIFO(arr, buckets[t]),
      );
      return {
        vacantByTier: next,
        selectedSlots: new Set<number>(),
        bvhDirty: true,
      };
    });

    return purged.length;
  },

  totalVacant: () => {
    const v = get().vacantByTier;
    return v[0].length + v[1].length + v[2].length + v[3].length + v[4].length;
  },
}));
