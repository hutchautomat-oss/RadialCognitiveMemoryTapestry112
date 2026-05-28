import { create } from "zustand";
import { v4 as uuidv4 } from "uuid";

export interface RCMTNode {
  id: string;
  index: number;
  label: string;
  certainty: number; // 1 = Fact (center), 0 = Dream (outer rim)
  position: [number, number, number];
  basePosition: [number, number, number];
  timestamp: number;
  size: number;
}

export interface Snapshot {
  timestamp: number;
  nodeCount: number;
  positions: Float32Array; // flat array: [x0,y0,z0, x1,y1,z1, ...]
}

const MAX_NODES = 8000;
const MAX_RADIUS = 45;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

// Deterministic Y-spread using a hash of the index (no Math.random)
function hashFloat(i: number): number {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x); // 0..1
}

export function fibonacciPosition(
  index: number,
  _total: number,
): [number, number, number] {
  const t = index / MAX_NODES;
  const r = Math.sqrt(t) * MAX_RADIUS;
  const angle = index * GOLDEN_ANGLE;
  const ySpread = (hashFloat(index) - 0.5) * 4 * t; // denser at center
  return [r * Math.cos(angle), ySpread, r * Math.sin(angle)];
}

export function certaintyFromIndex(index: number): number {
  // Higher index → larger radius → lower certainty (Dream)
  return Math.max(0, 1 - Math.sqrt(index / MAX_NODES));
}

// ── Demo nodes so the canvas isn't empty on first load ──────────────
const DEMO_LABELS = [
  "Claude is a transformer-based LLM",
  "Fibonacci spiral = golden ratio geometry",
  "WebSocket latency target < 30ms",
  "BVH raycasting: O(log N) complexity",
  "VRAM budget: 2 GB allocated",
  "Float64 timestamp = 8 bytes",
  "Context compression ratio: 10:1",
  "LWW conflict resolution via logical clock",
  "Spherical fibonacci = uniform node density",
  "28-byte binary stride per node update",
  "Dreams are speculative future hypotheses",
  "Facts are empirically verified memories",
  "Repulsion blast clears dense node knots",
  "Timeline scrubber = 4D memory playback",
  "Vision tokens: 100 ≈ 1000 text tokens",
];

function buildDemoNodes(): RCMTNode[] {
  const nodes: RCMTNode[] = [];
  const count = 480;
  for (let i = 0; i < count; i++) {
    const certainty = certaintyFromIndex(i);
    const pos = fibonacciPosition(i, MAX_NODES);
    nodes.push({
      id: `demo-${i}`,
      index: i,
      label: i < DEMO_LABELS.length ? DEMO_LABELS[i] : `Memory fragment #${i}`,
      certainty,
      position: [...pos] as [number, number, number],
      basePosition: [...pos] as [number, number, number],
      timestamp: Date.now() - (count - i) * 800,
      size: 0.25 + certainty * 0.65,
    });
  }
  return nodes;
}

interface RCMTStore {
  nodes: RCMTNode[];
  selectedIndices: Set<number>;
  timelinePos: number; // 0 = oldest, 1 = now
  snapshots: Snapshot[];
  isLassoMode: boolean;
  nextIndex: number;

  addNode: (label: string, certainty?: number) => void;
  updateNodePosition: (index: number, pos: [number, number, number]) => void;
  setTimelinePos: (pos: number) => void;
  setLassoMode: (on: boolean) => void;
  applyRepulsion: (indices: number[]) => void;
  setSelectedIndices: (indices: Set<number>) => void;
  saveSnapshot: () => void;
}

export const useStore = create<RCMTStore>((set, get) => ({
  nodes: buildDemoNodes(),
  selectedIndices: new Set(),
  timelinePos: 1,
  snapshots: [],
  isLassoMode: false,
  nextIndex: 480,

  addNode: (label, certaintyOverride) => {
    const { nextIndex, nodes } = get();
    if (nextIndex >= MAX_NODES) return;

    const certainty =
      certaintyOverride !== undefined
        ? certaintyOverride
        : inferCertainty(label);
    const pos = fibonacciPosition(nextIndex, MAX_NODES);

    const node: RCMTNode = {
      id: uuidv4(),
      index: nextIndex,
      label,
      certainty,
      position: [...pos] as [number, number, number],
      basePosition: [...pos] as [number, number, number],
      timestamp: Date.now(),
      size: 0.25 + certainty * 0.65,
    };

    set({ nodes: [...nodes, node], nextIndex: nextIndex + 1 });
    get().saveSnapshot();
  },

  updateNodePosition: (index, pos) => {
    set((state) => ({
      nodes: state.nodes.map((n) =>
        n.index === index ? { ...n, position: pos, timestamp: Date.now() } : n,
      ),
    }));
  },

  setTimelinePos: (pos) => set({ timelinePos: pos }),

  setLassoMode: (on) => set({ isLassoMode: on }),

  setSelectedIndices: (indices) => set({ selectedIndices: indices }),

  applyRepulsion: (indices) => {
    set((state) => {
      const indexSet = new Set(indices);
      const centerX =
        indices.reduce(
          (sum, i) => sum + (state.nodes.find((n) => n.index === i)?.position[0] ?? 0),
          0,
        ) / (indices.length || 1);
      const centerZ =
        indices.reduce(
          (sum, i) => sum + (state.nodes.find((n) => n.index === i)?.position[2] ?? 0),
          0,
        ) / (indices.length || 1);

      return {
        nodes: state.nodes.map((n) => {
          if (!indexSet.has(n.index)) return n;
          const dx = n.position[0] - centerX;
          const dz = n.position[2] - centerZ;
          const dist = Math.sqrt(dx * dx + dz * dz) || 1;
          const force = 8 / dist;
          return {
            ...n,
            position: [
              n.position[0] + (dx / dist) * force,
              n.position[1],
              n.position[2] + (dz / dist) * force,
            ] as [number, number, number],
          };
        }),
        selectedIndices: new Set<number>(),
      };
    });
    get().saveSnapshot();
  },

  saveSnapshot: () => {
    const { nodes, snapshots } = get();
    const positions = new Float32Array(nodes.length * 3);
    nodes.forEach((n, i) => {
      positions[i * 3 + 0] = n.position[0];
      positions[i * 3 + 1] = n.position[1];
      positions[i * 3 + 2] = n.position[2];
    });
    const snap: Snapshot = {
      timestamp: Date.now(),
      nodeCount: nodes.length,
      positions,
    };
    // Keep last 100 snapshots
    const trimmed = [...snapshots.slice(-99), snap];
    set({ snapshots: trimmed, timelinePos: 1 });
  },
}));

// Simple heuristic: certain keywords → closer to fact (high certainty)
function inferCertainty(text: string): number {
  const lower = text.toLowerCase();
  const factKeywords = ["is", "are", "was", "=", "equals", "defined", "means", "fact", "proven", "confirmed"];
  const dreamKeywords = ["maybe", "perhaps", "dream", "idea", "what if", "imagine", "could", "might", "hypothesis"];
  const factScore = factKeywords.filter((k) => lower.includes(k)).length;
  const dreamScore = dreamKeywords.filter((k) => lower.includes(k)).length;
  const raw = 0.5 + (factScore - dreamScore) * 0.15;
  return Math.max(0.05, Math.min(0.95, raw));
}
