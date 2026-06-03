import { describe, expect, it } from "vitest";
import {
  FRAME_TIME_TARGET_MS,
  computeHealthBaseline,
  getDreamOccupancyPercent,
  getFrameTimeStats,
  getHealthDecayError,
  getStrikeThresholdAlert,
  getTierDistribution,
  isDreamOvercapacity,
  recentHamiltonianWindow,
} from "./diagnostic";

describe("RCMT diagnostic invariants", () => {
  it("computes the exponential health baseline correctly", () => {
    expect(computeHealthBaseline(1.0, 1.0)).toBeCloseTo(Math.exp(-1.0));
    expect(computeHealthBaseline(0.5, 2.0)).toBeCloseTo(Math.exp(-1.0));
  });

  it("flags Dream overcapacity when tier 5 exceeds 60%", () => {
    const counts = [1000, 1000, 1000, 1000, 4801];
    expect(getDreamOccupancyPercent(counts)).toBeGreaterThan(60);
    expect(isDreamOvercapacity(counts)).toBe(true);
  });

  it("validates the tier occupancy invariant against total node capacity", () => {
    const counts = [2000, 2000, 1500, 1500, 1000];
    const distribution = getTierDistribution(counts);
    expect(distribution.total).toBe(8000);
    expect(distribution.counts.reduce((sum, value) => sum + value, 0)).toBe(8000);
    expect(distribution.overcapacity).toBe(false);
  });

  it("detects GC spike and frame-time alert conditions", () => {
    const samples = [
      { frame: 1, dt: FRAME_TIME_TARGET_MS + 0.5, gcSpike: false },
      { frame: 2, dt: FRAME_TIME_TARGET_MS * 2.5, gcSpike: false },
      { frame: 3, dt: 20.0, gcSpike: true },
    ];
    const stats = getFrameTimeStats(samples);
    expect(stats.count).toBe(3);
    expect(stats.average).toBeGreaterThan(FRAME_TIME_TARGET_MS);
    expect(stats.spikes.length).toBeGreaterThan(0);
    expect(stats.alert).toBe(true);
  });

  it("computes promotion threshold proximity from strike distribution", () => {
    const strikes = [
      { slot: 1, strikes: 2, score: 0.92 },
      { slot: 2, strikes: 1, score: 0.88 },
      { slot: 3, strikes: 3, score: 0.96 },
    ];
    const result = getStrikeThresholdAlert(strikes, 3);
    expect(result.nearPromotionCount).toBe(2);
    expect(result.nearPromotion.map((item) => item.slot)).toEqual([1, 3]);
  });

  it("returns the most recent Hamiltonian points within a 10-second window", () => {
    const now = Date.now();
    const points = [
      { timestamp: now - 15000, H: -1, K: 0.1, V: -1.1 },
      { timestamp: now - 5000, H: -0.5, K: 0.2, V: -0.7 },
      { timestamp: now, H: -0.4, K: 0.15, V: -0.55 },
    ];
    const recent = recentHamiltonianWindow(points, 10000);
    expect(recent).toHaveLength(2);
    expect(recent[0].timestamp).toBeGreaterThan(now - 10000);
  });

  it("computes average and max health decay error", () => {
    const samples = [
      { deltaT: 1, actual: 0.4, baseline: 0.3679, tier: 1 },
      { deltaT: 2, actual: 0.14, baseline: 0.1353, tier: 2 },
    ];
    const error = getHealthDecayError(samples);
    expect(error.maxError).toBeGreaterThanOrEqual(0);
    expect(error.averageError).toBeGreaterThanOrEqual(0);
  });
});
