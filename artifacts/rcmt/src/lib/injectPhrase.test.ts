/**
 * Bloat-contrast counter semantics.
 *
 * `totalInjected` drives the "vector-DB equivalent" readout (N × vector bytes).
 * The honest contrast is the FULL input-stream volume: a naive vector store
 * appends a fresh vector on every insert — it never dedups a reinforce. So the
 * counter must advance on EVERY injection, not only on new admissions. This
 * pins that semantic against a spawn → reinforce → spawn sequence.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { injectPhrase } from "./injectPhrase";
import { useHudStore } from "../store/useHudStore";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  TIER_CAPS,
  TIER_STARTS,
} from "../store/useSaccadeStore";
import { OnnxWorker } from "../workers/OnnxWorkerManager";

function resetStores() {
  const fresh = new Float32Array(MAX_NODES * STRIDE);
  const vacantSlotsByTier = TIER_CAPS.map((cap, t) => {
    const start = TIER_STARTS[t];
    const out = new Array<number>(cap);
    for (let i = 0; i < cap; i++) out[i] = start + i;
    return out;
  });
  const s = useSaccadeStore.getState();
  s.mass.fill(0);
  s.injectedAt.fill(0);
  s.spawnTime.fill(0);
  s.reinforcementCount.fill(0);
  s.animStartTime.fill(0);
  s.embeddings.fill(0);
  useSaccadeStore.setState({
    mockFrames: [fresh],
    totalFrames: 1,
    activeFrameIndex: 0,
    isFileLoaded: false,
    vacantSlotsByTier,
    tierCounts: TIER_CAPS.map(() => 0),
  });
  useHudStore.setState({ totalInjected: 0 });
}

// Deterministic, near-orthogonal embedding: identical text → identical vector
// (reinforces); different text → different basis index (spawns).
function embFor(text: string): Float32Array {
  const e = new Float32Array(384);
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  e[h % 384] = 1;
  return e;
}

describe("bloat-contrast counter (totalInjected) tracks the full input stream", () => {
  beforeEach(() => {
    resetStores();
    vi.spyOn(OnnxWorker, "classify").mockImplementation(async (text: string) => ({
      slot: 3, // Metric tier — fixed so identical text reinforces in-tier
      similarities: [0, 0, 0.9, 0, 0],
      latencyMs: 1,
      embedding: embFor(text),
    }));
  });
  afterEach(() => vi.restoreAllMocks());

  it("increments on EVERY injection — a reinforce counts the same as a spawn", async () => {
    const r1 = await injectPhrase("the build passed all tests", "console");
    expect(r1.kind).toBe("spawn");
    expect(useHudStore.getState().totalInjected).toBe(1);

    // Same idea seen again → reinforce (no new slot). A naive vector DB would
    // still store the duplicate vector, so the bloat counter MUST advance.
    const r2 = await injectPhrase("the build passed all tests", "console");
    expect(r2.kind).toBe("reinforce");
    expect(useHudStore.getState().totalInjected).toBe(2);

    const r3 = await injectPhrase("a totally different metric result", "console");
    expect(r3.kind).toBe("spawn");
    expect(useHudStore.getState().totalInjected).toBe(3);
  });
});
