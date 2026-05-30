/**
 * useSaccadeStore — Saccade frame buffer, per-tier FIFO caches, decay engine,
 *                   promotion-on-reinforcement, BVH spatial index, and UI
 *                   selection state for the 8k lattice.
 *
 * This is the SOLE source of truth for node state. The legacy `useStore.nodes`
 * graph was retired in Task #4 — every write path (drag, ONNX injection,
 * network ingest) now mutates `mockFrames[activeFrameIndex]` directly via
 * the actions on this store.
 *
 * Per-tier caches (Task #3): the 0..7999 index space is partitioned into 5
 * disjoint shells, one per ontology tier. Each tier owns its own FIFO of
 * vacant slot indices, its own occupancy count, and its own decay rate λ. When
 * a tier fills, the lowest-Health slot in that tier is evicted (not the
 * globally-oldest). Dream churn therefore can NEVER evict Facts.
 *
 * Float32 stride layout per node (STRIDE = 7):
 *   [0] x   [1] y   [2] z   [3] r   [4] g   [5] b   [6] importance/scale
 *
 * Per-node state arrays (NOT part of the 28-byte CRVM payload — runtime only):
 *   slotTier[i]            Uint8  — 1..5, the ontology tier this slot belongs to
 *   embeddings[i*384..]    Float32 — L2-normalized ONNX vector for cosine reinforcement
 *   reinforcementCount[i]  Uint8  — strikes toward 3-strike promotion
 *   injectedAt[i]          Float64 — wall-clock ms; basis for exp(-λ·Δt) Health
 *   mass[i]                Float32 — resting scale (separate from the rendered
 *                                    scale so promotion pulses don't corrupt it)
 *   animStartTime[i]       Float64 — 0 = no animation; >0 = promotion in flight
 *   animFromPos[i*3..]     Float32 — promotion origin XYZ
 *   animToPos[i*3..]       Float32 — promotion destination XYZ
 *
 * Spatial index:
 *   The collisionBVH wraps a proxy BufferGeometry with exactly one triangle per
 *   VRAM slot, so `triangleIndex === slotIndex`. Rebuilds are LAZY: mutations
 *   only set bvhDirty=true; rebuild happens on the next getCollisionBVH().
 */

import { create } from "zustand";
import { BufferAttribute, BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { SaccadeWorker } from "../workers/SaccadeWorkerManager";
import { pushHudEvent } from "./useHudStore";
import { TIER_LABEL, TIER_BAND } from "../lib/tierNarration";

/**
 * Peripheral-flash queue — incoming remote (LWW) updates push the mutated
 * node's world position + tier here; `PeripheralFlashBridge` (in-canvas) drains
 * it each frame to flash the corresponding viewport edge. Module-level (not
 * store state) so high-frequency packet ingest never triggers React renders.
 */
export interface RemoteFlash {
  x: number;
  y: number;
  z: number;
  tier: number;
}
const REMOTE_FLASH_CAP = 64;
let _remoteFlashQueue: RemoteFlash[] = [];
const EMPTY_FLASHES: RemoteFlash[] = [];

/** Drain (and clear) the pending remote-update flashes. */
export function drainRemoteFlashes(): RemoteFlash[] {
  if (_remoteFlashQueue.length === 0) return EMPTY_FLASHES;
  const out = _remoteFlashQueue;
  _remoteFlashQueue = [];
  return out;
}

export const MAX_NODES = 8000;
export const STRIDE = 7;

// ── Task #3: Per-tier caches ──────────────────────────────────────────
// Slot ontology is 1-based (1=Fact, 2=Scenario, 3=Metric, 4=Theory, 5=Dream).
// All array indices in this file are 0-based; the +1/-1 conversions are
// localized to the public surface.

/** Hard cap per tier. MUST sum to exactly MAX_NODES (8000). */
export const TIER_CAPS: ReadonlyArray<number> = [2000, 2000, 1500, 1500, 1000];

/** Starting absolute slot index for each tier. Computed from TIER_CAPS. */
export const TIER_STARTS: ReadonlyArray<number> = (() => {
  const arr: number[] = [];
  let acc = 0;
  for (const c of TIER_CAPS) {
    arr.push(acc);
    acc += c;
  }
  if (acc !== MAX_NODES) {
    throw new Error(
      `TIER_CAPS sum (${acc}) must equal MAX_NODES (${MAX_NODES}) — over/underallocation corrupts the BVH proxy buffer.`,
    );
  }
  return arr;
})();

/** Per-tier decay rate λ for Health(t) = exp(-λ · Δt_seconds). */
export const TIER_LAMBDA: ReadonlyArray<number> = [
  0.005, // Fact — barely decays
  0.015, // Scenario
  0.03, // Metric
  0.06, // Theory
  0.12, // Dream — hyper-decay
];

/** Dimensionality of the @xenova/transformers MiniLM-L6-v2 embedding. */
export const EMBEDDING_DIM = 384;

/** Cosine-similarity threshold for treating an input as reinforcement. */
const REINFORCE_SIM_THRESHOLD = 0.92;
/** Strikes required before promotion fires (slots 4 & 5 only). */
const REINFORCE_PROMOTE_COUNT = 3;
/** Health below this value → node evaporates. */
const HEALTH_DEATH = 0.05;
/**
 * Health below this value (but still above HEALTH_DEATH) → an *unreinforced*
 * node drifts one tier OUTWARD toward the Dream rim instead of staying central.
 * This is the mirror of inward promotion: low-confidence memories that were
 * never reinforced sort themselves to the periphery before they evaporate, so
 * the foveal core stays dense with high-certainty Facts.
 */
const HEALTH_DEMOTE = 0.3;
/** Max outward demotions per decay sweep — bounds animation/relayout churn. */
const MAX_DEMOTE_PER_SWEEP = 6;
/** Per-reinforcement scale bump. */
const MASS_REINFORCE_INCR = 0.15;
/** Max scale a single slot can grow to via reinforcement. */
const MASS_REINFORCE_CAP = 3.0;
/** Promotion orbital-shift duration (ms). Cubic ease-in-out. */
export const PROMOTION_ANIM_MS = 400;
/** Background decay sweep interval (ms). NOT inside useFrame — see comment. */
const DECAY_SWEEP_MS = 2000;

// ── RCMT v5.0 Physics & Density Constants ───────────────────────────
// Exported so the foveation/geometry invariants tests (`*.test.ts`) pin
// the literal values — any refactor that drifts the spiral or shrinks
// the foveated radius will fail the suite loudly.
export const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
// Z-strata (the old per-tier Z offset) was removed in Task #10 — the lattice
// is now a single continuous 3D sphere, tiers distinguished by color +
// foveated radius alone. See replit.md "Architecture decisions".
export const NODE_DENSITY_BUBBLE = 0.6;
const MIN_SCALE = 0.15;
const SCALE_PER_CHAR = 0.02;
const MAX_SCALE = 1.5;

// BVH proxy triangle radius — MUST match SaccadeInstancedMesh's
// `SphereGeometry(1, 8, 8)` scaled by `scale * VISUAL_RADIUS_MULT`. Any
// other multiplier desyncs picking from visuals. Exported so the BVH-proxy
// invariant can compare it against the renderer's visual constant.
export const BVH_PROXY_MULT = 0.15;
const PROXY_SCALE_MULT = BVH_PROXY_MULT;

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

/**
 * Compute the foveated lattice position for an absolute slot index. Slot 1
 * (Fact) sits near the core; slot 5 (Dream) disperses to the rim. The radial
 * shell is implied by the slot's absolute index via sqrt(index)·BUBBLE.
 */
export function latticePosition(
  absoluteIndex: number,
  tier1Based: number,
): [number, number, number] {
  const radius = Math.sqrt(absoluteIndex) * NODE_DENSITY_BUBBLE;
  const [sx, sy, sz] = sphericalFibonacci(absoluteIndex, MAX_NODES);
  const x = sx * radius;
  const y = sy * radius;
  const z = sz * radius;
  void tier1Based;
  return [x, y, z];
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

/**
 * Canonical RCMT tier palette — the SINGLE source of truth for node color.
 * `injectPhrase` reads it at spawn time and `promoteSlot` reads it on recolor;
 * the HUD chips in `tokens.ts` carry deliberately muted versions of the same
 * hues so the dense chrome stays legible while the lattice carries the contrast.
 *
 * Design — color opponency + certainty-by-saturation:
 *   - Hues are spread across the opponent channels (cyan↔yellow on blue-yellow,
 *     green↔orange/red on red-green, violet at the rim) so adjacent tiers are
 *     pre-attentively separable at a glance.
 *   - Saturation ramps DOWN Fact→Dream: Facts are sharp and vivid (high
 *     certainty), Dreams fade to washed-out violet (low certainty). The color
 *     itself encodes the Fact→Dream epistemology, reinforcing the foveal
 *     radial gradient.
 *
 * These are RENDER-side RGB values written into the frame-buffer stride
 * [3,4,5]. They never touch the 28-byte wire packet, slot position, or the
 * authoritative `slotTier` map — recoloring is purely visual.
 */
export const TIER_RGB: ReadonlyArray<[number, number, number]> = [
  [0.15, 0.95, 0.89], // 1 Fact     — sharp cyan-green, max saturation
  [0.37, 0.9, 0.2], //   2 Scenario — vivid green
  [0.87, 0.8, 0.29], //  3 Metric   — yellow
  [0.83, 0.53, 0.31], // 4 Theory   — orange
  [0.73, 0.46, 0.78], // 5 Dream    — faded violet, low saturation
];

/** Build the static tier-lookup table once. Slot i ∈ [TIER_STARTS[t], TIER_STARTS[t]+TIER_CAPS[t]) → tier (t+1). */
function buildSlotTier(): Uint8Array {
  const arr = new Uint8Array(MAX_NODES);
  for (let t = 0; t < TIER_CAPS.length; t++) {
    const start = TIER_STARTS[t];
    const end = start + TIER_CAPS[t];
    for (let i = start; i < end; i++) arr[i] = t + 1;
  }
  return arr;
}

/** Fresh per-tier FIFOs, each containing that tier's full slot range in order. */
function buildVacantByTier(): number[][] {
  return TIER_CAPS.map((cap, t) => {
    const start = TIER_STARTS[t];
    const out = new Array<number>(cap);
    for (let i = 0; i < cap; i++) out[i] = start + i;
    return out;
  });
}

/**
 * Append `additions` to `existing` without breaking FIFO order.
 * Uses a Set ONLY for dedup membership checks; never reconstructs from a Set
 * (which would collapse the insertion order).
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

/** L2-normalize in place. No-op if already unit length. Cheap insurance. */
function l2Normalize(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  if (sumSq <= 0) return v;
  const inv = 1 / Math.sqrt(sumSq);
  if (Math.abs(inv - 1) < 1e-6) return v;
  for (let i = 0; i < v.length; i++) v[i] *= inv;
  return v;
}

/** Result of a single injectLiveIntentVector call. */
export interface InjectOutcome {
  /** Absolute VRAM slot index that was written to. */
  index: number;
  /** What kind of mutation occurred. */
  kind: "spawn" | "reinforce" | "evict" | "promote" | "demote";
  /** Tier (1..5) the slot belongs to AFTER the mutation. */
  tier: number;
}

// ── Demo seed ────────────────────────────────────────────────────────
// Stride-sample demo slots so the canvas isn't empty on first load. Demo
// occupies the first DEMO_COUNT slots in the buffer (all in the Fact tier,
// 0..1999). Colors are computed from a stride-derived certainty so the demo
// reads as a foveated rainbow rather than a wall of cyan Facts.
const DEMO_STRIDE = 6;
const DEMO_COUNT = Math.ceil(MAX_NODES / DEMO_STRIDE); // 1334

function certaintyFromStrideIndex(strideSlot: number): number {
  return Math.max(0, 1 - Math.sqrt(strideSlot / MAX_NODES));
}

function buildInitialFrame(): Float32Array {
  const frame = new Float32Array(MAX_NODES * STRIDE);
  let bufIdx = 0;
  for (let s = 0; s < MAX_NODES; s += DEMO_STRIDE) {
    if (bufIdx >= MAX_NODES) break;
    const certainty = certaintyFromStrideIndex(s);
    const [x, y, z] = latticePosition(bufIdx, 1);
    const [r, g, b] = certaintyToRGB(certainty);
    const size = 0.35 + certainty * 0.55;
    const off = bufIdx * STRIDE;
    frame[off + 0] = x;
    frame[off + 1] = y;
    frame[off + 2] = z;
    frame[off + 3] = r;
    frame[off + 4] = g;
    frame[off + 5] = b;
    frame[off + 6] = size;
    bufIdx++;
  }
  return frame;
}

interface SaccadeStore {
  mockFrames: Float32Array[];
  activeFrameIndex: number;
  totalFrames: number;
  isFileLoaded: boolean;

  // ── Per-tier slot bookkeeping (Task #3) ────────────────────────
  vacantSlotsByTier: number[][];
  /** Live occupancy per tier (1-based — read as tierCounts[tierIndex-1]). */
  tierCounts: number[];
  /** O(1) tier lookup, 1-based. Allocated once; never resized. */
  slotTier: Uint8Array;
  /** L2-normalized 384-d embedding per slot, packed contiguously. */
  embeddings: Float32Array;
  reinforcementCount: Uint8Array;
  injectedAt: Float64Array;
  mass: Float32Array;
  animStartTime: Float64Array;
  animFromPos: Float32Array;
  animToPos: Float32Array;

  spawnTime: Float32Array;
  workerReady: boolean;

  /**
   * Source phrase for each slot, or null when the slot is vacant or
   * demo-seeded (demo entries have no originating text). Parallel to
   * `mass[]`; mutated in lockstep with every write path
   * (inject/reinforce/promote/evict/decay/blast/prune). Read by the
   * hover-tooltip layer to show "what is this node?" without per-frame
   * cost — tooltip only reads `slotPhrase[hoveredSlot]`.
   */
  slotPhrase: (string | null)[];

  /**
   * Currently-hovered slot for the source-phrase tooltip, plus the
   * screen-space pointer position used to anchor the DOM overlay.
   * `null` when no slot is under the cursor (or the slot is vacant /
   * demo-seeded and therefore has no phrase to show).
   */
  hoveredSlot: { slot: number; x: number; y: number } | null;

  // ── Spatial index ─────────────────────────────────────────────
  collisionBVH: MeshBVH | null;
  bvhDirty: boolean;

  // ── Selection + UI mode (VRAM-aware) ──────────────────────────
  selectedSlots: Set<number>;
  lassoEventTick: number;
  lassoEventCount: number;
  isLassoMode: boolean;

  // ── Semantic search overlay (read-only foveal targeting) ──────
  // A `/find` query embeds text, cosine-ranks active slots, then brightens
  // matches + dims the rest and eases the camera toward their centroid. It
  // NEVER moves a node, changes a tier, or touches the wire — positions stay
  // a deterministic function of slot index. This is targeting, not placement.
  /** slot → cosine score (0..1), inserted in descending-score order. Empty when idle. */
  searchMatches: Map<number, number>;
  /** True while a search highlight is active (matches found and not cleared). */
  searchActive: boolean;
  /** Bumped on every search set/clear so render subscribers re-kick on demand. */
  searchEpoch: number;
  /** Centroid of the top matches for camera convergence, or null. */
  searchFocus: { x: number; y: number; z: number } | null;

  // ── Actions ───────────────────────────────────────────────────
  initWorker: () => void;
  loadFile: (file: File) => void;
  setFrameIndex: (index: number) => void;
  setVacantSlotRegistry: (prunedIndices: number[]) => void;
  setLassoMode: (on: boolean) => void;

  /**
   * Drag write path. Mutates only the active frame's X/Y/Z for `slot`. Y is
   * optional — drag in the canvas is XZ-only, so callers usually pass the
   * existing Y. No-op if the slot is vacant (scale == 0).
   */
  dragSlotTo: (slot: number, x: number, y: number, z: number) => void;

  /**
   * Apply a remote LWW position update to the active frame. Position-only —
   * the server has already arbitrated by timestamp before fanning out, so
   * the client doesn't re-check. Skips vacant slots so a peer broadcasting
   * about a slot we don't have can't conjure a ghost dot at the origin.
   */
  applyRemoteUpdate: (slot: number, x: number, y: number, z: number) => void;

  /**
   * Inject a classified phrase into the appropriate tier's cache. If an
   * embedding is provided and cosine-similarity > REINFORCE_SIM_THRESHOLD
   * against any active slot's stored embedding, the call is rerouted to
   * reinforcement (no new slot consumed). When the tier is full, the
   * lowest-Health slot in that tier is evicted (NOT the globally oldest —
   * Dream pressure cannot evict Facts).
   *
   * Returns the slot index used and the outcome category, or null if
   * something pathological happened (no frame, partition exhausted).
   */
  injectLiveIntentVector: (opts: {
    slot: number;
    textLength: number;
    colorRGB:
      | { r: number; g: number; b: number }
      | [number, number, number]
      | number;
    /** Optional L2-normalized 384-d embedding. Without it, reinforcement is skipped. */
    embedding?: Float32Array | null;
    /** Source phrase to attach to the slot for hover-tooltip lookup. */
    phrase?: string;
  }) => InjectOutcome | null;

  /** Set or clear the hovered-slot tooltip state. */
  setHoveredSlot: (h: { slot: number; x: number; y: number } | null) => void;

  /** Background decay sweep — evaporates slots whose Health has fallen below threshold. */
  decaySweep: () => void;

  markBVHDirty: () => void;
  rebuildBVH: () => void;
  getCollisionBVH: () => MeshBVH | null;

  setSelectedSlots: (slots: Set<number>) => void;
  clearSelection: () => void;
  blastSelectedSlots: () => number;

  /**
   * Pure read-only cosine scan over every active slot's stored embedding.
   * Returns the top-K slots whose similarity is >= `threshold`, ranked
   * descending. Mutates nothing — no frame write, no broadcast.
   */
  rankBySimilarity: (
    query: Float32Array,
    topK: number,
    threshold: number,
  ) => { slot: number; score: number }[];
  /** Apply a ranked match list as the search highlight overlay (render-side only). */
  setSearchMatches: (ranked: { slot: number; score: number }[]) => void;
  /** Clear the search highlight overlay and release the camera. */
  clearSearch: () => void;
}

// ── Module-init typed arrays (allocated once) ─────────────────────────
const _slotTier = buildSlotTier();
const _embeddings = new Float32Array(MAX_NODES * EMBEDDING_DIM);
const _reinforcementCount = new Uint8Array(MAX_NODES);
const _injectedAt = new Float64Array(MAX_NODES);
const _mass = new Float32Array(MAX_NODES);
const _animStartTime = new Float64Array(MAX_NODES);
const _animFromPos = new Float32Array(MAX_NODES * 3);
const _animToPos = new Float32Array(MAX_NODES * 3);
const _slotPhrase: (string | null)[] = new Array(MAX_NODES).fill(null);

// Seed the demo frame + tier bookkeeping BEFORE store creation so the very
// first render of SaccadeInstancedMesh sees a populated buffer (no
// seedFromNodes bridge to fall back on anymore).
const _initialFrame = buildInitialFrame();
const _initialVacantByTier = buildVacantByTier();
const _initialTierCounts = TIER_CAPS.map(() => 0);
{
  const factCap = TIER_CAPS[0];
  const occupied = Math.min(DEMO_COUNT, factCap);
  _initialVacantByTier[0] = _initialVacantByTier[0].slice(occupied);
  _initialTierCounts[0] = occupied;
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  for (let i = 0; i < occupied; i++) {
    _mass[i] = _initialFrame[i * STRIDE + 6];
    _injectedAt[i] = now;
  }
}

export const useSaccadeStore = create<SaccadeStore>((set, get) => ({
  mockFrames: [_initialFrame],
  activeFrameIndex: 0,
  totalFrames: 1,
  isFileLoaded: false,

  vacantSlotsByTier: _initialVacantByTier,
  tierCounts: _initialTierCounts,
  slotTier: _slotTier,
  embeddings: _embeddings,
  reinforcementCount: _reinforcementCount,
  injectedAt: _injectedAt,
  mass: _mass,
  animStartTime: _animStartTime,
  animFromPos: _animFromPos,
  animToPos: _animToPos,

  spawnTime: new Float32Array(MAX_NODES),
  workerReady: false,

  slotPhrase: _slotPhrase,
  hoveredSlot: null,

  collisionBVH: null,
  bvhDirty: true,
  selectedSlots: new Set<number>(),
  lassoEventTick: 0,
  lassoEventCount: 0,
  searchMatches: new Map<number, number>(),
  searchActive: false,
  searchEpoch: 0,
  searchFocus: null,
  isLassoMode: false,

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

  setLassoMode: (on) => set({ isLassoMode: on }),

  dragSlotTo: (slot, x, y, z) => {
    const { mockFrames, activeFrameIndex } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame) return;
    if (slot < 0 || slot >= MAX_NODES) return;
    const off = slot * STRIDE;
    // Skip vacant slots — dragging "nothing" must not paint a stale color.
    if (frame[off + 6] <= 0) return;
    frame[off + 0] = x;
    frame[off + 1] = y;
    frame[off + 2] = z;
    set({ bvhDirty: true });
  },

  applyRemoteUpdate: (slot, x, y, z) => {
    const { mockFrames, activeFrameIndex, slotTier } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame) return;
    if (slot < 0 || slot >= MAX_NODES) return;
    const off = slot * STRIDE;
    // Position-only sync mirrors the legacy behavior. A vacant slot stays
    // vacant — peer-driven slot allocation is a separate (future) feature.
    if (frame[off + 6] <= 0) return;
    frame[off + 0] = x;
    frame[off + 1] = y;
    frame[off + 2] = z;
    // Queue a peripheral-motion cue: a remote peer just mutated a (background)
    // node. PeripheralFlashBridge drains this each frame and flashes the edge
    // sector the node projects to. Bounded so a packet burst can't grow it.
    if (_remoteFlashQueue.length < REMOTE_FLASH_CAP) {
      _remoteFlashQueue.push({ x, y, z, tier: slotTier[slot] });
    }
    set({ bvhDirty: true });
  },

  setVacantSlotRegistry: (prunedIndices) => {
    set((state) => {
      const slotTier = state.slotTier;
      const nextByTier = state.vacantSlotsByTier.map((arr) => arr.slice());
      const nextCounts = state.tierCounts.slice();
      const additionsByTier: number[][] = TIER_CAPS.map(() => []);

      for (const idx of prunedIndices) {
        if (idx < 0 || idx >= MAX_NODES) continue;
        const tier = slotTier[idx];
        if (tier < 1 || tier > TIER_CAPS.length) continue;
        // Clear per-slot state so the next inhabitant gets a clean baseline.
        state.spawnTime[idx] = 0;
        state.mass[idx] = 0;
        state.reinforcementCount[idx] = 0;
        state.injectedAt[idx] = 0;
        state.animStartTime[idx] = 0;
        state.slotPhrase[idx] = null;
        additionsByTier[tier - 1].push(idx);
      }

      for (let t = 0; t < TIER_CAPS.length; t++) {
        if (additionsByTier[t].length === 0) continue;
        nextByTier[t] = appendUniqueFIFO(nextByTier[t], additionsByTier[t]);
        nextCounts[t] = Math.max(0, nextCounts[t] - additionsByTier[t].length);
      }

      return {
        vacantSlotsByTier: nextByTier,
        tierCounts: nextCounts,
        bvhDirty: true,
      };
    });
  },

  injectLiveIntentVector: ({ slot, textLength, colorRGB, embedding, phrase }) => {
    const state = get();
    const {
      mockFrames,
      activeFrameIndex,
      vacantSlotsByTier,
      spawnTime,
      slotTier,
      embeddings,
      mass,
      injectedAt,
      reinforcementCount,
      tierCounts,
    } = state;
    const currentFrame = mockFrames[activeFrameIndex];
    if (!currentFrame) {
      console.warn("[Saccade] No active frame buffer — injection aborted.");
      return null;
    }

    const tier1Based = Math.max(1, Math.min(TIER_CAPS.length, slot | 0));
    const tierIdx = tier1Based - 1;

    const safeScale = Math.min(
      MIN_SCALE + textLength * SCALE_PER_CHAR,
      MAX_SCALE,
    );

    // ── Step 1: reinforcement check ──────────────────────────────
    // Scan every active slot's stored embedding for max cosine similarity.
    // Both sides are L2-normalized, so cosine = dot product.
    let reinforcedSlot = -1;
    if (embedding && embedding.length === EMBEDDING_DIM) {
      let bestSim = -Infinity;
      let bestIdx = -1;
      for (let i = 0; i < MAX_NODES; i++) {
        if (mass[i] <= 0) continue;
        const base = i * EMBEDDING_DIM;
        let s = 0;
        for (let k = 0; k < EMBEDDING_DIM; k++) {
          s += embedding[k] * embeddings[base + k];
        }
        if (s > bestSim) {
          bestSim = s;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0 && bestSim > REINFORCE_SIM_THRESHOLD) {
        reinforcedSlot = bestIdx;
      }
    }

    const now = performance.now();

    if (reinforcedSlot >= 0) {
      const i = reinforcedSlot;
      const off = i * STRIDE;
      spawnTime[i] = now;
      injectedAt[i] = now;
      mass[i] = Math.min(mass[i] + MASS_REINFORCE_INCR, MASS_REINFORCE_CAP);
      reinforcementCount[i] = Math.min(255, reinforcementCount[i] + 1);
      currentFrame[off + 6] = mass[i];
      // Update the source phrase to the most recent reinforcing input so the
      // tooltip reflects what the user just typed (not a stale earlier seed).
      if (phrase !== undefined) state.slotPhrase[i] = phrase;

      const reinforcedTier = slotTier[i];
      // Promotion gated to slots 4 and 5 only.
      if (
        (reinforcedTier === 4 || reinforcedTier === 5) &&
        reinforcementCount[i] >= REINFORCE_PROMOTE_COUNT
      ) {
        const promoted = promoteSlot(i, get, set);
        if (promoted !== null) {
          return { index: promoted, kind: "promote", tier: slotTier[promoted] };
        }
        return { index: i, kind: "reinforce", tier: reinforcedTier };
      }
      set({ bvhDirty: true });
      return { index: i, kind: "reinforce", tier: reinforcedTier };
    }

    // ── Step 2: allocate a slot in the target tier ───────────────
    let targetIndex: number;
    let outcomeKind: "spawn" | "evict" = "spawn";
    let nextVacantForTier = vacantSlotsByTier[tierIdx];
    if (nextVacantForTier.length > 0) {
      targetIndex = nextVacantForTier[0];
      nextVacantForTier = nextVacantForTier.slice(1);
    } else {
      outcomeKind = "evict";
      // Tier full → evict lowest-Health slot in this tier (NOT globally).
      const start = TIER_STARTS[tierIdx];
      const end = start + TIER_CAPS[tierIdx];
      const lambda = TIER_LAMBDA[tierIdx];
      let worstHealth = Infinity;
      let worstIdx = -1;
      for (let i = start; i < end; i++) {
        if (mass[i] <= 0) continue;
        const dt = (now - injectedAt[i]) / 1000;
        const health = Math.exp(-lambda * dt);
        if (health < worstHealth) {
          worstHealth = health;
          worstIdx = i;
        }
      }
      if (worstIdx < 0) {
        console.warn(
          `[Saccade] Tier ${tier1Based} reports full but no occupant found — injection aborted.`,
        );
        return null;
      }
      targetIndex = worstIdx;
      // Wipe the evicted slot's state; we'll repopulate below.
      spawnTime[worstIdx] = 0;
      mass[worstIdx] = 0;
      reinforcementCount[worstIdx] = 0;
      injectedAt[worstIdx] = 0;
      state.slotPhrase[worstIdx] = null;
      // No vacant entry to splice in — we're reusing the same index.
      // nextVacantForTier stays []
    }

    // ── Step 3: write position, color, scale, embedding, state ──
    const [x, y, z] = latticePosition(targetIndex, tier1Based);
    const [r, g, b] = normalizeColor(colorRGB);

    const offset = targetIndex * STRIDE;
    currentFrame[offset + 0] = x;
    currentFrame[offset + 1] = y;
    currentFrame[offset + 2] = z;
    currentFrame[offset + 3] = r;
    currentFrame[offset + 4] = g;
    currentFrame[offset + 5] = b;
    currentFrame[offset + 6] = safeScale;

    spawnTime[targetIndex] = now;
    injectedAt[targetIndex] = now;
    mass[targetIndex] = safeScale;
    reinforcementCount[targetIndex] = 0;
    state.slotPhrase[targetIndex] = phrase ?? null;

    if (embedding && embedding.length === EMBEDDING_DIM) {
      const base = targetIndex * EMBEDDING_DIM;
      // Defensive copy + normalize. Embeddings are normalized at the worker
      // boundary already, but normalizing here is cheap insurance against
      // future model swaps and makes cosine compare unambiguous.
      for (let k = 0; k < EMBEDDING_DIM; k++) {
        embeddings[base + k] = embedding[k];
      }
      // Normalize in place over this slot's slice. (Building a subview
      // avoids allocation.)
      const slice = embeddings.subarray(base, base + EMBEDDING_DIM);
      l2Normalize(slice);
    } else if (embedding === undefined || embedding === null) {
      // Clear any stale embedding so future cosine scans don't match a
      // recycled slot's previous occupant.
      const base = targetIndex * EMBEDDING_DIM;
      for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[base + k] = 0;
    }

    // ── Step 4: tier bookkeeping ────────────────────────────────
    const nextByTier = vacantSlotsByTier.map((arr, t) =>
      t === tierIdx ? nextVacantForTier : arr,
    );
    const nextCounts = tierCounts.slice();
    // If we evicted (no vacant entry consumed), count stays the same.
    // If we consumed a vacant, count goes up by 1.
    if (vacantSlotsByTier[tierIdx].length > 0) {
      nextCounts[tierIdx] = Math.min(
        TIER_CAPS[tierIdx],
        nextCounts[tierIdx] + 1,
      );
    }

    set({
      vacantSlotsByTier: nextByTier,
      tierCounts: nextCounts,
      bvhDirty: true,
    });
    return { index: targetIndex, kind: outcomeKind, tier: tier1Based };
  },

  setHoveredSlot: (h) => set({ hoveredSlot: h }),

  decaySweep: () => {
    const state = get();
    const { mockFrames, activeFrameIndex, mass, injectedAt, slotTier, spawnTime, embeddings, isFileLoaded, slotPhrase, reinforcementCount, animStartTime } = state;
    // Decay must NEVER mutate a replay snapshot — `mockFrames[i]` for
    // `activeFrameIndex !== 0` (or when a binary is loaded) is a frozen
    // history frame, and writing to it during scrub rewrites the past.
    // See `.agents/memory/rcmt-decay-vs-replay.md`.
    if (isFileLoaded || activeFrameIndex !== 0) return;
    const frame = mockFrames[activeFrameIndex];
    if (!frame) return;
    // Decay only mutates the live frame. During binary file playback the
    // user is scrubbing immutable history — running decay there would
    // corrupt the recorded state.
    if (state.isFileLoaded) return;

    const now = performance.now();
    const pruned: number[] = [];
    // Candidates for outward demotion: { idx, health } for unreinforced,
    // non-Dream slots that have faded below HEALTH_DEMOTE but are not yet dead.
    const demoteCandidates: { idx: number; health: number }[] = [];

    for (let i = 0; i < MAX_NODES; i++) {
      if (mass[i] <= 0) continue;
      const tier = slotTier[i];
      if (tier < 1) continue;
      const lambda = TIER_LAMBDA[tier - 1];
      const dt = (now - injectedAt[i]) / 1000;
      const health = Math.exp(-lambda * dt);
      if (health < HEALTH_DEATH) {
        const off = i * STRIDE;
        frame[off + 6] = 0;
        mass[i] = 0;
        spawnTime[i] = 0;
        injectedAt[i] = 0;
        slotPhrase[i] = null;
        // Clear embedding so a recycled slot can't false-match.
        const base = i * EMBEDDING_DIM;
        for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[base + k] = 0;
        pruned.push(i);
      } else if (
        health < HEALTH_DEMOTE &&
        tier < TIER_CAPS.length && // Dream (tier 5) is the outer rim — can't drift further
        reinforcementCount[i] === 0 && // reinforced nodes have earned grounding
        animStartTime[i] === 0 // not already mid-flight (promotion or a prior demotion)
      ) {
        demoteCandidates.push({ idx: i, health });
      }
    }

    // ── Outward demotion drift (mirror of inward promotion) ──────────
    // The lowest-health unreinforced nodes sort outward toward the rim. Bounded
    // per sweep so relayout/animation churn stays predictable. demoteSlot is
    // tier-scoped (only ever evicts within the destination tier) so "Dream
    // churn can never evict Facts" still holds.
    if (demoteCandidates.length > 0) {
      demoteCandidates.sort((a, b) => a.health - b.health);
      const budget = Math.min(MAX_DEMOTE_PER_SWEEP, demoteCandidates.length);
      for (let c = 0; c < budget; c++) {
        const sourceIdx = demoteCandidates[c].idx;
        const fromTier = slotTier[sourceIdx];
        const dest = demoteSlot(sourceIdx, get, set);
        if (dest === null) continue;
        const toTier = slotTier[dest];
        pushHudEvent({
          type: "DEMOTE",
          slot: dest,
          tier: toTier,
          detail: `${TIER_LABEL[fromTier - 1]} drifted outward to the ${TIER_BAND[toTier - 1]} — faded without reinforcement · vram[${dest}]`,
        });
      }
    }

    if (pruned.length === 0) return;

    // Emit one EVICT(reason=lowHealth) per evaporated slot so the event ring
    // reflects the full lifecycle. The tier-full eviction path (in
    // injectLiveIntentVector → injectPhrase) emits reason=tierFull; together
    // these are the only two ways a slot leaves the lattice.
    for (const idx of pruned) {
      const tier = slotTier[idx];
      pushHudEvent({
        type: "EVICT",
        slot: idx,
        tier,
        detail: `${TIER_LABEL[tier - 1]} faded from the ${TIER_BAND[tier - 1]} — decayed below survival health · vram[${idx}]`,
      });
    }

    // Route evaporated slots back to their tier FIFOs.
    set((s) => {
      const nextByTier = s.vacantSlotsByTier.map((arr) => arr.slice());
      const nextCounts = s.tierCounts.slice();
      const additionsByTier: number[][] = TIER_CAPS.map(() => []);
      for (const idx of pruned) {
        const tier = slotTier[idx];
        if (tier < 1 || tier > TIER_CAPS.length) continue;
        additionsByTier[tier - 1].push(idx);
      }
      for (let t = 0; t < TIER_CAPS.length; t++) {
        if (additionsByTier[t].length === 0) continue;
        nextByTier[t] = appendUniqueFIFO(nextByTier[t], additionsByTier[t]);
        nextCounts[t] = Math.max(0, nextCounts[t] - additionsByTier[t].length);
      }
      return {
        vacantSlotsByTier: nextByTier,
        tierCounts: nextCounts,
        bvhDirty: true,
      };
    });
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
        for (let v = 0; v < 9; v++) {
          positions[baseV + v] = Infinity;
        }
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
    const state = get();
    const { mockFrames, activeFrameIndex, selectedSlots, spawnTime, slotTier, mass, injectedAt, reinforcementCount, animStartTime, embeddings, slotPhrase } = state;
    const frame = mockFrames[activeFrameIndex];
    if (!frame || selectedSlots.size === 0) return 0;

    const purgedByTier: number[][] = TIER_CAPS.map(() => []);
    let purgedCount = 0;
    for (const slotIdx of selectedSlots) {
      if (slotIdx < 0 || slotIdx >= MAX_NODES) continue;
      const off = slotIdx * STRIDE;
      frame[off + 6] = 0;
      spawnTime[slotIdx] = 0;
      mass[slotIdx] = 0;
      injectedAt[slotIdx] = 0;
      reinforcementCount[slotIdx] = 0;
      animStartTime[slotIdx] = 0;
      slotPhrase[slotIdx] = null;
      const base = slotIdx * EMBEDDING_DIM;
      for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[base + k] = 0;
      const tier = slotTier[slotIdx];
      if (tier >= 1 && tier <= TIER_CAPS.length) {
        purgedByTier[tier - 1].push(slotIdx);
        purgedCount++;
      }
    }

    set((s) => {
      const nextByTier = s.vacantSlotsByTier.map((arr, t) =>
        appendUniqueFIFO(arr, purgedByTier[t]),
      );
      const nextCounts = s.tierCounts.map((c, t) =>
        Math.max(0, c - purgedByTier[t].length),
      );
      return {
        vacantSlotsByTier: nextByTier,
        tierCounts: nextCounts,
        selectedSlots: new Set<number>(),
        bvhDirty: true,
      };
    });

    return purgedCount;
  },

  rankBySimilarity: (query, topK, threshold) => {
    if (!query || query.length !== EMBEDDING_DIM) return [];
    const { embeddings, mass } = get();
    const matches: { slot: number; score: number }[] = [];
    for (let i = 0; i < MAX_NODES; i++) {
      if (mass[i] <= 0) continue;
      const base = i * EMBEDDING_DIM;
      let s = 0;
      for (let k = 0; k < EMBEDDING_DIM; k++) {
        s += query[k] * embeddings[base + k];
      }
      if (s >= threshold) matches.push({ slot: i, score: s });
    }
    matches.sort((a, b) => b.score - a.score);
    return matches.slice(0, Math.max(0, topK));
  },

  setSearchMatches: (ranked) => {
    // Insert in descending-score order so the Map iterates ranked while still
    // giving O(1) has()/get() to the render loop.
    const map = new Map<number, number>();
    for (const m of ranked) map.set(m.slot, m.score);

    // Camera focus = centroid of matched slots in the ACTIVE frame. Read-only.
    let focus: { x: number; y: number; z: number } | null = null;
    const state = get();
    const frame = state.mockFrames[state.activeFrameIndex];
    if (frame && ranked.length > 0) {
      let cx = 0,
        cy = 0,
        cz = 0;
      for (const m of ranked) {
        const off = m.slot * STRIDE;
        cx += frame[off];
        cy += frame[off + 1];
        cz += frame[off + 2];
      }
      focus = {
        x: cx / ranked.length,
        y: cy / ranked.length,
        z: cz / ranked.length,
      };
    }

    set((s) => ({
      searchMatches: map,
      searchActive: map.size > 0,
      searchEpoch: s.searchEpoch + 1,
      searchFocus: focus,
    }));
  },

  clearSearch: () =>
    set((s) => ({
      searchMatches: new Map<number, number>(),
      searchActive: false,
      searchEpoch: s.searchEpoch + 1,
      searchFocus: null,
    })),
}));

/**
 * Promote a slot one shell inward (Theory→Metric, Dream→Theory). Atomically:
 *   1. Pop a free slot from the target tier's FIFO (or evict its lowest-Health
 *      occupant if full).
 *   2. Copy color, mass, embedding, injectedAt to the destination slot.
 *   3. Recolor to the new tier's canonical color.
 *   4. Stage the orbital-shift animation (from→to positions, anim start).
 *   5. Free the source slot back to its FIFO and zero its state.
 *
 * Returns the destination slot index, or null if promotion couldn't happen
 * (e.g. already at slot 1, target tier wholly full of irreplaceable nodes).
 */
function promoteSlot(
  sourceIdx: number,
  get: () => SaccadeStore,
  set: (partial: Partial<SaccadeStore>) => void,
): number | null {
  const state = get();
  const {
    mockFrames,
    activeFrameIndex,
    slotTier,
    vacantSlotsByTier,
    tierCounts,
    mass,
    injectedAt,
    embeddings,
    spawnTime,
    reinforcementCount,
    animStartTime,
    animFromPos,
    animToPos,
    slotPhrase,
  } = state;

  const sourceTier = slotTier[sourceIdx]; // 1-based
  if (sourceTier <= 1) return null;
  const targetTier = sourceTier - 1; // 1-based (inner shell)
  const targetTierIdx = targetTier - 1;

  const frame = mockFrames[activeFrameIndex];
  if (!frame) return null;

  // Allocate destination slot (free, or evict lowest-Health in target tier).
  const now = performance.now();
  let destIdx: number;
  let nextVacantForTarget = vacantSlotsByTier[targetTierIdx];
  let consumedVacant = false;
  if (nextVacantForTarget.length > 0) {
    destIdx = nextVacantForTarget[0];
    nextVacantForTarget = nextVacantForTarget.slice(1);
    consumedVacant = true;
  } else {
    const start = TIER_STARTS[targetTierIdx];
    const end = start + TIER_CAPS[targetTierIdx];
    const lambda = TIER_LAMBDA[targetTierIdx];
    let worstHealth = Infinity;
    let worstIdx = -1;
    for (let i = start; i < end; i++) {
      if (mass[i] <= 0) continue;
      const dt = (now - injectedAt[i]) / 1000;
      const health = Math.exp(-lambda * dt);
      if (health < worstHealth) {
        worstHealth = health;
        worstIdx = i;
      }
    }
    if (worstIdx < 0) return null;
    destIdx = worstIdx;
    // Wipe the evicted slot — destination is now logically empty.
    const evictedOff = worstIdx * STRIDE;
    frame[evictedOff + 6] = 0;
    mass[worstIdx] = 0;
    injectedAt[worstIdx] = 0;
    reinforcementCount[worstIdx] = 0;
    spawnTime[worstIdx] = 0;
    animStartTime[worstIdx] = 0;
    slotPhrase[worstIdx] = null;
  }

  // ── Copy slot state source → dest ───────────────────────────────
  const srcOff = sourceIdx * STRIDE;
  const dstOff = destIdx * STRIDE;
  const srcMass = mass[sourceIdx];
  const srcInjectedAt = injectedAt[sourceIdx];

  // Source's current rendered position becomes anim origin.
  const fromX = frame[srcOff + 0];
  const fromY = frame[srcOff + 1];
  const fromZ = frame[srcOff + 2];

  // Compute destination lattice position from its absolute index + new tier.
  const [toX, toY, toZ] = latticePosition(destIdx, targetTier);

  // New tier color (canonical palette).
  const [newR, newG, newB] = TIER_RGB[targetTier - 1];

  // Write destination slot: positioned at the anim origin so visual continuity
  // holds for this frame (the render loop will lerp toward toPos over 400 ms).
  frame[dstOff + 0] = fromX;
  frame[dstOff + 1] = fromY;
  frame[dstOff + 2] = fromZ;
  frame[dstOff + 3] = newR;
  frame[dstOff + 4] = newG;
  frame[dstOff + 5] = newB;
  frame[dstOff + 6] = srcMass;

  mass[destIdx] = srcMass;
  injectedAt[destIdx] = srcInjectedAt;
  reinforcementCount[destIdx] = 0; // reset on promotion
  spawnTime[destIdx] = 0; // promotion has its own animation, not starburst

  // Copy embedding.
  const srcEmbBase = sourceIdx * EMBEDDING_DIM;
  const dstEmbBase = destIdx * EMBEDDING_DIM;
  for (let k = 0; k < EMBEDDING_DIM; k++) {
    embeddings[dstEmbBase + k] = embeddings[srcEmbBase + k];
  }

  // Stage animation on destination slot.
  animStartTime[destIdx] = now;
  animFromPos[destIdx * 3 + 0] = fromX;
  animFromPos[destIdx * 3 + 1] = fromY;
  animFromPos[destIdx * 3 + 2] = fromZ;
  animToPos[destIdx * 3 + 0] = toX;
  animToPos[destIdx * 3 + 1] = toY;
  animToPos[destIdx * 3 + 2] = toZ;

  // Carry the source phrase forward to the destination slot so the hover
  // tooltip stays meaningful after a promotion (the slot moves shells, but
  // the originating text doesn't change).
  slotPhrase[destIdx] = slotPhrase[sourceIdx];

  // ── Free source slot ────────────────────────────────────────────
  frame[srcOff + 6] = 0;
  mass[sourceIdx] = 0;
  injectedAt[sourceIdx] = 0;
  reinforcementCount[sourceIdx] = 0;
  spawnTime[sourceIdx] = 0;
  animStartTime[sourceIdx] = 0;
  slotPhrase[sourceIdx] = null;
  for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[srcEmbBase + k] = 0;

  // Tier bookkeeping: source freed, dest claimed.
  const sourceTierIdx = sourceTier - 1;
  const nextByTier = vacantSlotsByTier.map((arr, t) => {
    if (t === targetTierIdx) return nextVacantForTarget;
    if (t === sourceTierIdx) return appendUniqueFIFO(arr, [sourceIdx]);
    return arr;
  });
  const nextCounts = tierCounts.slice();
  nextCounts[sourceTierIdx] = Math.max(0, nextCounts[sourceTierIdx] - 1);
  if (consumedVacant) {
    nextCounts[targetTierIdx] = Math.min(
      TIER_CAPS[targetTierIdx],
      nextCounts[targetTierIdx] + 1,
    );
  }
  // If we evicted to make room, count stays the same on the target tier.

  set({
    vacantSlotsByTier: nextByTier,
    tierCounts: nextCounts,
    bvhDirty: true,
  });

  return destIdx;
}

/**
 * Demote a slot one shell OUTWARD (Fact→Scenario … Theory→Dream) — the mirror
 * of promoteSlot. An unreinforced node that has faded below HEALTH_DEMOTE sorts
 * itself toward the Dream rim instead of dying in place, so the foveal core
 * stays dense with high-certainty memories.
 *
 * Identical relocation mechanics to promotion (pop a free destination slot, or
 * evict the lowest-Health occupant WITHIN the destination tier), with two
 * deliberate differences:
 *   - targetTier = sourceTier + 1 (outer shell), capped at Dream.
 *   - injectedAt is reset to `now`: the node gets a fresh decay clock in its
 *     new, faster-decaying tier so it keeps drifting/fading rather than
 *     instantly re-qualifying for another demotion the same sweep.
 *
 * Returns the destination slot index, or null if demotion couldn't happen
 * (already at Dream, or the outer tier is wholly full of irreplaceable nodes).
 */
function demoteSlot(
  sourceIdx: number,
  get: () => SaccadeStore,
  set: (partial: Partial<SaccadeStore>) => void,
): number | null {
  const state = get();
  const {
    mockFrames,
    activeFrameIndex,
    slotTier,
    vacantSlotsByTier,
    tierCounts,
    mass,
    injectedAt,
    embeddings,
    spawnTime,
    reinforcementCount,
    animStartTime,
    animFromPos,
    animToPos,
    slotPhrase,
  } = state;

  // Revalidate the source: an earlier demotion in the SAME sweep may have
  // chosen this slot as its destination-tier eviction victim (freeing it) or
  // staged an animation on it. Candidates are collected once, before any
  // relocation, so without this guard a stale index would be demoted a second
  // time with mass 0 — double-decrementing tierCounts and corrupting the FIFO.
  if (mass[sourceIdx] <= 0) return null; // freed by an earlier demotion
  if (animStartTime[sourceIdx] !== 0) return null; // already mid-flight

  const sourceTier = slotTier[sourceIdx]; // 1-based
  if (sourceTier >= TIER_CAPS.length) return null; // already Dream — no outer shell
  const targetTier = sourceTier + 1; // 1-based (outer shell)
  const targetTierIdx = targetTier - 1;

  const frame = mockFrames[activeFrameIndex];
  if (!frame) return null;

  // Allocate destination slot (free, or evict lowest-Health in target tier).
  const now = performance.now();
  let destIdx: number;
  let nextVacantForTarget = vacantSlotsByTier[targetTierIdx];
  let consumedVacant = false;
  if (nextVacantForTarget.length > 0) {
    destIdx = nextVacantForTarget[0];
    nextVacantForTarget = nextVacantForTarget.slice(1);
    consumedVacant = true;
  } else {
    const start = TIER_STARTS[targetTierIdx];
    const end = start + TIER_CAPS[targetTierIdx];
    const lambda = TIER_LAMBDA[targetTierIdx];
    let worstHealth = Infinity;
    let worstIdx = -1;
    for (let i = start; i < end; i++) {
      if (mass[i] <= 0) continue;
      const dt = (now - injectedAt[i]) / 1000;
      const health = Math.exp(-lambda * dt);
      if (health < worstHealth) {
        worstHealth = health;
        worstIdx = i;
      }
    }
    if (worstIdx < 0) return null;
    destIdx = worstIdx;
    // Wipe the evicted slot — destination is now logically empty.
    const evictedOff = worstIdx * STRIDE;
    frame[evictedOff + 6] = 0;
    mass[worstIdx] = 0;
    injectedAt[worstIdx] = 0;
    reinforcementCount[worstIdx] = 0;
    spawnTime[worstIdx] = 0;
    animStartTime[worstIdx] = 0;
    slotPhrase[worstIdx] = null;
  }

  // ── Copy slot state source → dest ───────────────────────────────
  const srcOff = sourceIdx * STRIDE;
  const dstOff = destIdx * STRIDE;
  const srcMass = mass[sourceIdx];

  // Source's current rendered position becomes anim origin.
  const fromX = frame[srcOff + 0];
  const fromY = frame[srcOff + 1];
  const fromZ = frame[srcOff + 2];

  // Compute destination lattice position from its absolute index + new tier.
  const [toX, toY, toZ] = latticePosition(destIdx, targetTier);

  // New (outer) tier color.
  const [newR, newG, newB] = TIER_RGB[targetTier - 1];

  // Write destination slot at the anim origin for visual continuity (the render
  // loop lerps toward toPos over PROMOTION_ANIM_MS).
  frame[dstOff + 0] = fromX;
  frame[dstOff + 1] = fromY;
  frame[dstOff + 2] = fromZ;
  frame[dstOff + 3] = newR;
  frame[dstOff + 4] = newG;
  frame[dstOff + 5] = newB;
  frame[dstOff + 6] = srcMass;

  mass[destIdx] = srcMass;
  // Fresh decay clock in the new, faster-decaying tier.
  injectedAt[destIdx] = now;
  reinforcementCount[destIdx] = 0;
  spawnTime[destIdx] = 0; // demotion has its own animation, not starburst

  // Copy embedding.
  const srcEmbBase = sourceIdx * EMBEDDING_DIM;
  const dstEmbBase = destIdx * EMBEDDING_DIM;
  for (let k = 0; k < EMBEDDING_DIM; k++) {
    embeddings[dstEmbBase + k] = embeddings[srcEmbBase + k];
  }

  // Stage animation on destination slot.
  animStartTime[destIdx] = now;
  animFromPos[destIdx * 3 + 0] = fromX;
  animFromPos[destIdx * 3 + 1] = fromY;
  animFromPos[destIdx * 3 + 2] = fromZ;
  animToPos[destIdx * 3 + 0] = toX;
  animToPos[destIdx * 3 + 1] = toY;
  animToPos[destIdx * 3 + 2] = toZ;

  // Carry the source phrase forward (the slot moves shells, the text doesn't).
  slotPhrase[destIdx] = slotPhrase[sourceIdx];

  // ── Free source slot ────────────────────────────────────────────
  frame[srcOff + 6] = 0;
  mass[sourceIdx] = 0;
  injectedAt[sourceIdx] = 0;
  reinforcementCount[sourceIdx] = 0;
  spawnTime[sourceIdx] = 0;
  animStartTime[sourceIdx] = 0;
  slotPhrase[sourceIdx] = null;
  for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[srcEmbBase + k] = 0;

  // Tier bookkeeping: source freed, dest claimed.
  const sourceTierIdx = sourceTier - 1;
  const nextByTier = vacantSlotsByTier.map((arr, t) => {
    if (t === targetTierIdx) return nextVacantForTarget;
    if (t === sourceTierIdx) return appendUniqueFIFO(arr, [sourceIdx]);
    return arr;
  });
  const nextCounts = tierCounts.slice();
  nextCounts[sourceTierIdx] = Math.max(0, nextCounts[sourceTierIdx] - 1);
  if (consumedVacant) {
    nextCounts[targetTierIdx] = Math.min(
      TIER_CAPS[targetTierIdx],
      nextCounts[targetTierIdx] + 1,
    );
  }
  // If we evicted to make room, count stays the same on the target tier.

  set({
    vacantSlotsByTier: nextByTier,
    tierCounts: nextCounts,
    bvhDirty: true,
  });

  return destIdx;
}

// ── Decay sweep timer ─────────────────────────────────────────────────
// NOT inside useFrame — the renderer must never block on memory hygiene.
// HMR-safe: if a previous interval handle exists on the module, clear it.
if (typeof window !== "undefined") {
  const w = window as unknown as { __rcmtDecayInterval?: number };
  if (w.__rcmtDecayInterval !== undefined) {
    clearInterval(w.__rcmtDecayInterval);
  }
  w.__rcmtDecayInterval = window.setInterval(() => {
    useSaccadeStore.getState().decaySweep();
  }, DECAY_SWEEP_MS);
}
