/**
 * useSaccadeStore — Saccade frame buffer, FIFO slot reclaimer, and decay engine.
 *
 * Works in two modes:
 *   LIVE   — mockFrames is empty; renders from useStore.nodes directly
 *   BINARY — mockFrames populated from a .bin file; scrubbing plays back frames
 *
 * Float32 stride layout per node (STRIDE = 7):
 *   [0] x   [1] y   [2] z   [3] r   [4] g   [5] b   [6] importance/scale
 */

import { create } from "zustand";
import { SaccadeWorker } from "../workers/SaccadeWorkerManager";
import type { RCMTNode } from "./useStore";

export const MAX_NODES = 8000;
export const STRIDE = 7;

// ── RCMT v5.0 Physics & Density Constants ───────────────────────────
// 137.508° in radians — the Golden Angle for Fibonacci phyllotaxis.
// Guarantees maximum nearest-neighbor clearance across the sphere.
const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
// Visual Z-strata gap between ontology slots (1..5).
// NOTE: Phase-4 CKKS export uses 10000.0 on the cleartext matrix BEFORE
// TenSEAL packing — this 5.0 value is for the LOCAL 3D render only, so
// strata are physically separated but stay inside the camera frustum.
const Z_STRATA_VISUAL = 5.0;
// Radius of the spherical lattice. Tuned to keep all 8000 points inside
// the camera's near/far range with a comfortable margin.
const LATTICE_RADIUS = 22.0;
// Dynamic scale cap so a paragraph can't eclipse the foveated core.
const MIN_SCALE = 0.15;
const SCALE_PER_CHAR = 0.02;
const MAX_SCALE = 1.5;

/**
 * True 3D Spherical Fibonacci lattice point.
 * Uses inverse-cosine latitude spacing so points are evenly distributed
 * across the sphere surface — eliminates the center "Knot Anomaly" that
 * the flat-disk spiral suffered from.
 *
 * Returns unit-sphere coordinates [x, y, z]; multiply by your radius.
 */
function sphericalFibonacci(i: number, total: number): [number, number, number] {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(total, 1));
  const theta = i * GOLDEN_ANGLE;
  const sinPhi = Math.sin(phi);
  return [sinPhi * Math.cos(theta), sinPhi * Math.sin(theta), Math.cos(phi)];
}

/** Normalize colorRGB from either {r,g,b} object or [r,g,b] tuple. */
function normalizeColor(
  c: { r: number; g: number; b: number } | [number, number, number] | number,
): [number, number, number] {
  if (Array.isArray(c)) return [c[0], c[1], c[2]];
  if (typeof c === "number") return [c, c, c]; // back-compat with NotebookLM scalar
  return [c.r, c.g, c.b];
}

// ── Color helpers ──────────────────────────────────────────────────
function certaintyToRGB(c: number): [number, number, number] {
  if (c > 0.6) {
    // Cyan  (fact)
    const t = (c - 0.6) / 0.4;
    return [0, t, 1];
  }
  // Purple (dream)
  const t = c / 0.6;
  return [0.5 * (1 - t), 0, 0.8 + 0.2 * t];
}

/** Convert a live-node array into a 7-float-per-node Float32Array frame. */
export function nodesToFrame(nodes: RCMTNode[]): Float32Array {
  const buf = new Float32Array(MAX_NODES * STRIDE); // zeros = hidden
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
    buf[offset + 6] = node.size; // importance / initial scale
  });
  return buf;
}

interface SaccadeStore {
  // Frame buffer (binary file mode)
  mockFrames: Float32Array[];
  activeFrameIndex: number;
  totalFrames: number;
  isFileLoaded: boolean;

  // FIFO vacant-slot reclaimer
  vacantSlots: number[];

  // Worker status
  workerReady: boolean;

  // Actions
  initWorker: () => void;
  loadFile: (file: File) => void;
  setFrameIndex: (index: number) => void;
  seedFromNodes: (nodes: RCMTNode[]) => void;
  updateLiveFrame: (nodes: RCMTNode[]) => void;
  setVacantSlotRegistry: (prunedIndices: number[]) => void;
  /**
   * Inject a freshly-classified intent vector into the live frame buffer.
   * The ONNX classifier returns `slot` (1..5 ontology tier) and confidence;
   * CommandConsole passes those plus `textLength` and a color tuple here.
   * Returns the VRAM slot index used, or null if the kill-switch fired.
   */
  injectLiveIntentVector: (opts: {
    slot: number;
    textLength: number;
    colorRGB:
      | { r: number; g: number; b: number }
      | [number, number, number]
      | number;
  }) => number | null;
}

export const useSaccadeStore = create<SaccadeStore>((set, get) => ({
  mockFrames: [],
  activeFrameIndex: 0,
  totalFrames: 0,
  isFileLoaded: false,
  vacantSlots: [],
  workerReady: false,

  initWorker: () => {
    SaccadeWorker.initialize();

    SaccadeWorker.onFileReady = (totalFrames) => {
      set({ totalFrames, isFileLoaded: true });
    };

    SaccadeWorker.onFrameData = (frame) => {
      set((state) => {
        const updated = [...state.mockFrames];
        updated[frame.index] = frame.data as unknown as Float32Array;
        return { mockFrames: updated };
      });
    };

    SaccadeWorker.onError = (msg) => {
      console.error("[SaccadeStore] Worker error:", msg);
    };

    set({ workerReady: true });
  },

  loadFile: (file) => {
    const { workerReady, initWorker } = get();
    if (!workerReady) initWorker();
    SaccadeWorker.loadFile(file);
    // Pre-load first 20 frames
    for (let i = 0; i < 20; i++) SaccadeWorker.seekFrame(i);
    set({ isFileLoaded: false, mockFrames: [], activeFrameIndex: 0 });
  },

  setFrameIndex: (index) => {
    const { mockFrames, totalFrames } = get();
    const clamped = Math.max(0, Math.min(index, Math.max(0, totalFrames - 1)));
    set({ activeFrameIndex: clamped });
    // Demand-load if not in cache
    if (!mockFrames[clamped]) SaccadeWorker.seekFrame(clamped);
  },

  // Seed initial mock frame(s) from live node data
  seedFromNodes: (nodes) => {
    const frame = nodesToFrame(nodes);
    set({ mockFrames: [frame], totalFrames: 1, activeFrameIndex: 0 });
  },

  // Replace frame 0 with current live node positions (called after drag / add)
  updateLiveFrame: (nodes) => {
    const frame = nodesToFrame(nodes);
    set((state) => {
      const updated = [...state.mockFrames];
      // Append a new snapshot frame; cap at 200 to avoid memory blow-up
      const trimmed = updated.length >= 200 ? updated.slice(-199) : updated;
      return {
        mockFrames: [...trimmed, frame],
        totalFrames: trimmed.length + 1,
        activeFrameIndex: trimmed.length, // point to newest
      };
    });
  },

  setVacantSlotRegistry: (prunedIndices) => {
    set((state) => ({
      // Deduplicate and cap the queue at MAX_NODES
      vacantSlots: Array.from(
        new Set([...state.vacantSlots, ...prunedIndices]),
      ).slice(0, MAX_NODES),
    }));
  },

  injectLiveIntentVector: ({ slot, textLength, colorRGB }) => {
    const { mockFrames, activeFrameIndex, vacantSlots } = get();
    const currentFrame = mockFrames[activeFrameIndex];

    // 8k Kill-Switch: halt if density cap reached or no frame buffer.
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

    // 1. Pop oldest dead VRAM index (O(1) recycle).
    const targetIndex = vacantSlots[0];
    const newVacant = vacantSlots.slice(1);

    // 2. Safe-Zone Data Block Sizing (DeepSeek-OCR standard, capped).
    const safeScale = Math.min(
      MIN_SCALE + textLength * SCALE_PER_CHAR,
      MAX_SCALE,
    );

    // 3. True 3D Spherical Fibonacci position — kills the Knot Anomaly.
    const [sx, sy, sz] = sphericalFibonacci(targetIndex, MAX_NODES);
    const x = sx * LATTICE_RADIUS;
    const y = sy * LATTICE_RADIUS;
    const zLattice = sz * LATTICE_RADIUS;

    // 4. Orthogonal Z-Strata: visible separation between ontology tiers.
    // Centered on slot 3 (the median) so the foveated core stays near z=0.
    const z = zLattice + (slot - 3) * Z_STRATA_VISUAL;

    // 5. Color (accepts {r,g,b}, [r,g,b], or scalar back-compat).
    const [r, g, b] = normalizeColor(colorRGB);

    // 6. Direct VRAM mutation — 28-byte binary stride.
    const offset = targetIndex * STRIDE;
    currentFrame[offset + 0] = x;
    currentFrame[offset + 1] = y;
    currentFrame[offset + 2] = z;
    currentFrame[offset + 3] = r;
    currentFrame[offset + 4] = g;
    currentFrame[offset + 5] = b;
    currentFrame[offset + 6] = safeScale;

    set({ vacantSlots: newVacant });
    return targetIndex;
  },
}));
