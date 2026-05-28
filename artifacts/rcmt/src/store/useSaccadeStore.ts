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
  injectLiveIntentVector: (opts: {
    label: string;
    certainty: number;
    position: [number, number, number];
    size: number;
  }) => number | null; // returns the slot index used, or null
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

  injectLiveIntentVector: ({ label: _label, certainty, position, size }) => {
    const { mockFrames, activeFrameIndex, vacantSlots } = get();
    const currentFrame = mockFrames[activeFrameIndex];
    if (!currentFrame) return null;

    // Pop the oldest dead slot from the FIFO queue
    if (vacantSlots.length === 0) return null;
    const targetIndex = vacantSlots[0];
    const newVacant = vacantSlots.slice(1);

    const offset = targetIndex * STRIDE;
    const [r, g, b] = certaintyToRGB(certainty);
    currentFrame[offset + 0] = position[0];
    currentFrame[offset + 1] = position[1];
    currentFrame[offset + 2] = position[2];
    currentFrame[offset + 3] = r;
    currentFrame[offset + 4] = g;
    currentFrame[offset + 5] = b;
    currentFrame[offset + 6] = size;

    set({ vacantSlots: newVacant });
    return targetIndex;
  },
}));
