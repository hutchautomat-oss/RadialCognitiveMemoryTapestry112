/**
 * Per-tier FIFO + decay-vs-replay store invariants.
 *
 * These pin three memory-file decisions:
 *   - `.agents/memory/rcmt-vacancy-sot.md` — per-tier FIFOs are isolated
 *   - `.agents/memory/rcmt-decay-vs-replay.md` — decay is a no-op during scrub
 *   - `.agents/memory/slot-move-return-values.md` — moves return destination
 *
 * The store is exercised through its public actions only — no DOM, no R3F.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  TIER_CAPS,
  TIER_STARTS,
} from "./useSaccadeStore";

function resetStore() {
  // Reset to a freshly-bootable state: empty frame, all tiers vacant.
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
}

describe("per-tier FIFO isolation", () => {
  beforeEach(resetStore);

  it("injecting into tier 5 (Dream) consumes a Dream slot, not any other tier's", () => {
    // Regression: under the old global FIFO, Dream churn could grab a Fact
    // slot. Each tier now owns its own queue.
    const before = useSaccadeStore.getState().vacantSlotsByTier.map((a) => a.length);
    const out = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 5,
      textLength: 12,
      colorRGB: [0.5, 0, 1],
    });
    expect(out).not.toBeNull();
    expect(out!.tier).toBe(5);
    expect(out!.kind).toBe("spawn");
    // Slot index must fall inside Dream's [TIER_STARTS[4], +TIER_CAPS[4]) range.
    expect(out!.index).toBeGreaterThanOrEqual(TIER_STARTS[4]);
    expect(out!.index).toBeLessThan(TIER_STARTS[4] + TIER_CAPS[4]);

    const after = useSaccadeStore.getState().vacantSlotsByTier.map((a) => a.length);
    expect(after[4]).toBe(before[4] - 1); // Dream lost exactly 1
    for (let t = 0; t < 4; t++) expect(after[t]).toBe(before[t]); // others untouched
  });

  it("when a tier is full, eviction stays within that tier", () => {
    // Fill Dream (cap 1000) plus a buffer; assert the next injection lands
    // back in Dream's index range, not anywhere else.
    const cap = TIER_CAPS[4];
    for (let i = 0; i < cap; i++) {
      useSaccadeStore.getState().injectLiveIntentVector({
        slot: 5,
        textLength: 8,
        colorRGB: [0.5, 0, 1],
      });
    }
    expect(useSaccadeStore.getState().vacantSlotsByTier[4].length).toBe(0);
    const evicted = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 5,
      textLength: 8,
      colorRGB: [0.5, 0, 1],
    });
    expect(evicted).not.toBeNull();
    expect(evicted!.kind).toBe("evict");
    expect(evicted!.tier).toBe(5);
    expect(evicted!.index).toBeGreaterThanOrEqual(TIER_STARTS[4]);
    expect(evicted!.index).toBeLessThan(TIER_STARTS[4] + TIER_CAPS[4]);
  });
});

describe("decay sweep is gated to live mode", () => {
  beforeEach(resetStore);

  it("decaySweep is a no-op when activeFrameIndex !== 0 (binary scrub mode)", () => {
    // Plant a slot that would otherwise have evaporated long ago: huge
    // negative injectedAt means dt is huge, Health → 0.
    const s = useSaccadeStore.getState();
    s.injectLiveIntentVector({
      slot: 5,
      textLength: 8,
      colorRGB: [0.5, 0, 1],
    });
    const liveFrame = s.mockFrames[0];
    // Force injectedAt to "ancient" so decay would normally prune.
    const planted = s.vacantSlotsByTier[4][0] - 1; // last consumed Dream slot
    s.injectedAt[planted] = -1_000_000;
    // Switch to scrub mode by adding a second frame and pointing at it.
    const replayFrame = new Float32Array(MAX_NODES * STRIDE);
    replayFrame.set(liveFrame); // start as identical
    useSaccadeStore.setState({
      mockFrames: [liveFrame, replayFrame],
      totalFrames: 2,
      activeFrameIndex: 1,
    });
    const snapshotBefore = new Float32Array(replayFrame);
    useSaccadeStore.getState().decaySweep();
    // Replay snapshot must not have been mutated.
    for (let i = 0; i < replayFrame.length; i++) {
      expect(replayFrame[i]).toBe(snapshotBefore[i]);
    }
  });

  it("decaySweep is a no-op when a binary file is loaded (isFileLoaded=true)", () => {
    const s = useSaccadeStore.getState();
    s.injectLiveIntentVector({ slot: 5, textLength: 8, colorRGB: [0.5, 0, 1] });
    const liveFrame = s.mockFrames[0];
    const snapshotBefore = new Float32Array(liveFrame);
    useSaccadeStore.setState({ isFileLoaded: true });
    useSaccadeStore.getState().decaySweep();
    for (let i = 0; i < liveFrame.length; i++) {
      expect(liveFrame[i]).toBe(snapshotBefore[i]);
    }
  });
});

describe("reinforcement does not consume a new slot", () => {
  beforeEach(resetStore);

  it("re-injecting with the same embedding reinforces rather than spawning", () => {
    const emb = new Float32Array(384);
    emb[0] = 1; // unit vector — pre-normalized
    const s = useSaccadeStore.getState();
    const first = s.injectLiveIntentVector({
      slot: 2,
      textLength: 8,
      colorRGB: [0, 1, 0],
      embedding: emb,
    });
    expect(first?.kind).toBe("spawn");
    const vacantBefore = useSaccadeStore.getState().vacantSlotsByTier[1].length;
    const again = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 2,
      textLength: 8,
      colorRGB: [0, 1, 0],
      embedding: emb,
    });
    // promote/reinforce are both acceptable here — what matters is that no
    // new vacant slot was consumed for the second hit.
    expect(again?.kind === "reinforce" || again?.kind === "promote").toBe(true);
    const vacantAfter = useSaccadeStore.getState().vacantSlotsByTier[1].length;
    expect(vacantAfter).toBe(vacantBefore);
  });
});
