import { describe, expect, it } from "vitest";
import { useSaccadeStore } from "./useSaccadeStore";

describe("useSaccadeStore functional decay and injection", () => {
  it("decaySweep prunes a very-old slot and returns it to its tier FIFO", () => {
    const s = useSaccadeStore.getState();
    // Inject into tier 2 to create an occupant
    const outcome = s.injectLiveIntentVector({ slot: 2, textLength: 1, colorRGB: [0, 1, 0], phrase: "old" });
    expect(outcome).not.toBeNull();
    if (!outcome) return;
    const idx = outcome.index;
    const tier = s.slotTier[idx];
    const tierIdx = tier - 1;
    const beforeCount = s.vacantSlotsByTier[tierIdx].length;
    // Age the slot far into the past so it decays below death
    s.injectedAt[idx] = performance.now() - 1000 * 60 * 60 * 24; // 24 hours ago

    s.decaySweep();

    const frame = s.mockFrames[s.activeFrameIndex];
    const off = idx * 7;
    expect(frame[off + 6]).toBe(0);
    // The slot should now be back in the tier's vacant FIFO
    const afterList = s.vacantSlotsByTier[tierIdx];
    expect(afterList.includes(idx)).toBeTruthy();
  });
});
