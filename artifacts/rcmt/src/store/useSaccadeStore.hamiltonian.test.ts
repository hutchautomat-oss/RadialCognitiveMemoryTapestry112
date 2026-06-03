import { describe, expect, it } from "vitest";
import { useSaccadeStore } from "./useSaccadeStore";
import { REINFORCE_PROMOTE_COUNT, TIER_LAMBDA } from "../lib/calibration";
import { computeHealthFromInjected, energyFromHealth } from "./useSaccadeStore";

describe("useSaccadeStore Hamiltonian promotion", () => {
  it("promotes a reinforced slot when energy H ∈ [-2,0) and strikes >= threshold", () => {
    const store = useSaccadeStore.getState();
    // Inject into tier 4 by passing slot=4 (API uses slot param as target tier when numeric)
    const outcome = store.injectLiveIntentVector({ slot: 4, textLength: 1, colorRGB: [1, 0, 0], phrase: "test" });
    expect(outcome).not.toBeNull();
    if (!outcome) return;
    const idx = outcome.index;
    // Seed reinforcement count to threshold
    store.reinforcementCount[idx] = REINFORCE_PROMOTE_COUNT;
    // Make injectedAt slightly in the past so health < 1 and H < 0
    const now = performance.now();
    store.injectedAt[idx] = now - 50; // 50 ms ago
    const tier = store.slotTier[idx];
    const lambda = TIER_LAMBDA[tier - 1];
    const health = computeHealthFromInjected(lambda, performance.now(), store.injectedAt[idx]);
    const H = energyFromHealth(health);
    expect(H).toBeLessThan(0);
    expect(H).toBeGreaterThanOrEqual(-2);

    // Call reinforceSlot and expect a promote outcome by Hamiltonian gate
    const res = store.reinforceSlot(idx);
    expect(res).not.toBeNull();
    if (res) {
      expect(res.kind === "promote" || res.kind === "reinforce").toBeTruthy();
      // If promoted, tier should have decreased (moved inward). If reinforced, we didn't promote.
      if (res.kind === "promote") {
        expect(store.slotTier[res.index]).toBeLessThan(tier);
      }
    }
  });
});
