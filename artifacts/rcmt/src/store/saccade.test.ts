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

describe("promotion returns the destination slot index, not the source", () => {
  beforeEach(resetStore);

  it("after enough reinforcements on a Dream slot, the returned index is the new (inner-tier) slot", () => {
    // Regression for `.agents/memory/slot-move-return-values.md`. Broadcasting
    // the source index after a move would tell every peer to zero the wrong
    // slot — peers diverge silently. Lock the destination-return semantics.
    const emb = new Float32Array(384);
    emb[0] = 1;
    const first = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 5,
      textLength: 8,
      colorRGB: [0.5, 0, 1],
      embedding: emb,
    });
    expect(first?.kind).toBe("spawn");
    expect(first?.tier).toBe(5);
    const sourceIdx = first!.index;

    // Reinforce repeatedly. Promotion fires once reinforcementCount crosses
    // the 3-strike threshold on a tier 4 or 5 slot.
    let lastOutcome = first;
    for (let i = 0; i < 5; i++) {
      lastOutcome = useSaccadeStore.getState().injectLiveIntentVector({
        slot: 5,
        textLength: 8,
        colorRGB: [0.5, 0, 1],
        embedding: emb,
      });
      if (lastOutcome?.kind === "promote") break;
    }
    expect(lastOutcome?.kind).toBe("promote");
    // Destination must be a different absolute slot AND belong to an inner
    // tier (4 = Theory) — never the original Dream source slot.
    expect(lastOutcome!.index).not.toBe(sourceIdx);
    expect(lastOutcome!.tier).toBe(4);
    expect(lastOutcome!.index).toBeGreaterThanOrEqual(TIER_STARTS[3]);
    expect(lastOutcome!.index).toBeLessThan(TIER_STARTS[3] + TIER_CAPS[3]);
  });
});

describe("outward demotion drift (mirror of inward promotion)", () => {
  beforeEach(resetStore);

  it("an unreinforced, faded non-Dream node drifts one tier OUTWARD, not inward", () => {
    // Spawn a Scenario (tier 2) node, then age it so its Health falls into the
    // demotion band (HEALTH_DEATH=0.05 < h < HEALTH_DEMOTE=0.3) without ever
    // being reinforced. The decay sweep must relocate it to tier 3 (outer),
    // never tier 1 (inner) and never leave it central.
    const spawn = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 2,
      textLength: 8,
      colorRGB: [0, 1, 0],
    });
    expect(spawn?.kind).toBe("spawn");
    expect(spawn?.tier).toBe(2);
    const sourceIdx = spawn!.index;

    // Scenario λ=0.015 → h=0.2 at dt≈107s. Set an ancient injectedAt so the
    // sweep sees a faded-but-not-dead node.
    useSaccadeStore.getState().injectedAt[sourceIdx] = performance.now() - 107_000;

    expect(useSaccadeStore.getState().tierCounts[1]).toBe(1);
    expect(useSaccadeStore.getState().tierCounts[2]).toBe(0);

    useSaccadeStore.getState().decaySweep();

    const s = useSaccadeStore.getState();
    // Source (tier 2) slot is freed.
    expect(s.mass[sourceIdx]).toBe(0);
    // Exactly one occupant now lives in the tier 3 (outer) range, animating.
    const t3Start = TIER_STARTS[2];
    const t3End = t3Start + TIER_CAPS[2];
    let destIdx = -1;
    for (let i = t3Start; i < t3End; i++) {
      if (s.mass[i] > 0) {
        destIdx = i;
        break;
      }
    }
    expect(destIdx).toBeGreaterThanOrEqual(0);
    expect(s.animStartTime[destIdx]).toBeGreaterThan(0); // orbital-shift staged
    // Tier bookkeeping: Scenario lost it, Metric gained it.
    expect(s.tierCounts[1]).toBe(0);
    expect(s.tierCounts[2]).toBe(1);
  });

  it("a node drifts at most ONE tier per sweep, even when an earlier demotion re-occupies a later candidate's slot", () => {
    // Regression: candidates are collected once (pre-relocation). A worst-health
    // Fact demoting into a full Scenario tier evicts the single Scenario
    // occupant AND re-occupies that exact slot. That slot is itself still in the
    // candidate list; without the mid-flight guard it would be demoted a SECOND
    // time, pushing a just-placed node two tiers out in one sweep.
    resetStore();
    const st = useSaccadeStore.getState();
    const frame = st.mockFrames[0]!;

    // Worst-health Fact (tier 1) at slot 0: h≈0.06 (λ=0.005, dt≈562s) — alive,
    // demote-eligible, and the first candidate processed.
    st.mass[0] = 1;
    st.injectedAt[0] = performance.now() - 562_000;
    st.reinforcementCount[0] = 0;
    st.animStartTime[0] = 0;
    frame[0 * STRIDE + 6] = 1;

    // Lone Scenario (tier 2) occupant, higher health (h≈0.2, λ=0.015, dt≈107s):
    // demote-eligible too, but processed AFTER the Fact.
    const T2 = TIER_STARTS[1];
    st.mass[T2] = 1;
    st.injectedAt[T2] = performance.now() - 107_000;
    st.reinforcementCount[T2] = 0;
    st.animStartTime[T2] = 0;
    frame[T2 * STRIDE + 6] = 1;

    // Force the Fact's demotion to EVICT (no free Scenario slot), and keep the
    // bookkeeping coherent with the two slots we placed by hand.
    useSaccadeStore.setState({
      tierCounts: [1, 1, 0, 0, 0],
      vacantSlotsByTier: st.vacantSlotsByTier.map((arr, t) =>
        t === 1 ? [] : arr.filter((idx) => idx !== 0 && idx !== T2),
      ),
    });

    useSaccadeStore.getState().decaySweep();

    const s = useSaccadeStore.getState();
    const occ = (t: number) => {
      const start = TIER_STARTS[t];
      const end = start + TIER_CAPS[t];
      let n = 0;
      for (let i = start; i < end; i++) if (s.mass[i] > 0) n++;
      return n;
    };
    // The Fact landed in Scenario (one tier out). NOTHING reached Metric.
    expect(occ(0)).toBe(0); // Fact source freed
    expect(occ(1)).toBe(1); // exactly one node in Scenario
    expect(occ(2)).toBe(0); // no double-demotion into Metric
    // tierCounts stay consistent with actual occupancy (no double-decrement).
    for (let t = 0; t < 5; t++) expect(s.tierCounts[t]).toBe(occ(t));
    s.tierCounts.forEach((c) => expect(c).toBeGreaterThanOrEqual(0));
    // Every registered vacant slot is genuinely empty.
    s.vacantSlotsByTier.forEach((arr) =>
      arr.forEach((idx) => expect(s.mass[idx]).toBe(0)),
    );
  });

  it("a Dream (tier 5, rim) node never demotes — it is already at the periphery", () => {
    const spawn = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 5,
      textLength: 8,
      colorRGB: [0.5, 0, 1],
    });
    expect(spawn?.tier).toBe(5);
    const sourceIdx = spawn!.index;
    // Dream λ=0.12 → h≈0.2 at dt≈13.4s: faded into the demote band but alive.
    useSaccadeStore.getState().injectedAt[sourceIdx] = performance.now() - 13_400;

    const dreamCountBefore = useSaccadeStore.getState().tierCounts[4];
    useSaccadeStore.getState().decaySweep();
    const s = useSaccadeStore.getState();
    // Still alive, still in Dream — no outer tier to drift to.
    expect(s.mass[sourceIdx]).toBeGreaterThan(0);
    expect(s.tierCounts[4]).toBe(dreamCountBefore);
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
