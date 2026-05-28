/**
 * Geometry & tier-ontology invariants.
 *
 * Every test here pins a real decision documented in replit.md
 * "Architecture decisions" or in `.agents/memory/rcmt-unified-sphere.md`.
 * If one of these fails, the lattice's foveation or tier accounting has
 * silently drifted — do NOT relax the test, fix the drift.
 */

import { describe, it, expect } from "vitest";
import {
  MAX_NODES,
  TIER_CAPS,
  TIER_STARTS,
  GOLDEN_ANGLE,
  NODE_DENSITY_BUBBLE,
  latticePosition,
} from "./useSaccadeStore";

describe("foveated lattice radius", () => {
  it("radius(slot) === sqrt(slot) * 0.6 for representative slots", () => {
    // The radial foveation formula is what makes facts cluster at the core
    // and dreams disperse to the rim. Changing the coefficient breaks the
    // tier visual ordering even though tier indices stay correct.
    for (const slot of [0, 1, 100, 2000, 4000, 7999]) {
      const [x, y, z] = latticePosition(slot, 1);
      const r = Math.sqrt(x * x + y * y + z * z);
      expect(r).toBeCloseTo(Math.sqrt(slot) * NODE_DENSITY_BUBBLE, 5);
    }
  });

  it("density bubble coefficient is exactly 0.6", () => {
    expect(NODE_DENSITY_BUBBLE).toBe(0.6);
  });
});

describe("golden-angle spiral", () => {
  it("GOLDEN_ANGLE === 137.508° in radians", () => {
    // Pinned literal — `.agents/memory/rcmt-unified-sphere.md` calls this
    // out as the only spiral constant; an "upgrade" to the canonical 137.5°
    // or 137.50776° must be a deliberate, documented decision.
    expect(GOLDEN_ANGLE).toBeCloseTo(137.508 * (Math.PI / 180), 10);
  });
});

describe("tier caps & starts", () => {
  it("TIER_CAPS sums to exactly MAX_NODES (8000)", () => {
    const total = TIER_CAPS.reduce((a, b) => a + b, 0);
    expect(total).toBe(MAX_NODES);
    expect(total).toBe(8000);
  });

  it("TIER_STARTS is the strictly-increasing prefix sum of TIER_CAPS", () => {
    expect(TIER_STARTS[0]).toBe(0);
    for (let t = 1; t < TIER_CAPS.length; t++) {
      expect(TIER_STARTS[t]).toBe(TIER_STARTS[t - 1] + TIER_CAPS[t - 1]);
      expect(TIER_STARTS[t]).toBeGreaterThan(TIER_STARTS[t - 1]);
    }
  });

  it("slot→tier lookup is contiguous and covers 0..7999 with no gaps", () => {
    // Reconstruct the lookup using only the public TIER_CAPS / TIER_STARTS
    // tables — if either drifts, this test fails.
    const lookup = new Uint8Array(MAX_NODES);
    for (let t = 0; t < TIER_CAPS.length; t++) {
      const start = TIER_STARTS[t];
      const end = start + TIER_CAPS[t];
      for (let i = start; i < end; i++) lookup[i] = t + 1;
    }
    for (let i = 0; i < MAX_NODES; i++) {
      expect(lookup[i]).toBeGreaterThanOrEqual(1);
      expect(lookup[i]).toBeLessThanOrEqual(TIER_CAPS.length);
    }
    // Boundary spot-checks: last slot of each tier and first slot of the next.
    for (let t = 0; t < TIER_CAPS.length - 1; t++) {
      const lastInTier = TIER_STARTS[t] + TIER_CAPS[t] - 1;
      const firstInNext = TIER_STARTS[t + 1];
      expect(lookup[lastInTier]).toBe(t + 1);
      expect(lookup[firstInNext]).toBe(t + 2);
    }
    expect(lookup[0]).toBe(1);
    expect(lookup[MAX_NODES - 1]).toBe(TIER_CAPS.length);
  });
});

describe("unified-sphere geometry (regression: no per-tier Z stride)", () => {
  it("two slots in different tiers at the same absolute index produce identical positions", () => {
    // The OLD model added a per-tier Z offset on top of the spiral so tiers
    // fanned into five flat layers. Task #10 removed that — position is now
    // a pure function of `absoluteIndex` and the tier argument is decorative.
    // If a future refactor reintroduces per-tier Z, this assertion blows up.
    const a = latticePosition(1234, 1); // Fact
    const b = latticePosition(1234, 5); // Dream — same absolute index
    expect(a[0]).toBeCloseTo(b[0], 10);
    expect(a[1]).toBeCloseTo(b[1], 10);
    expect(a[2]).toBeCloseTo(b[2], 10);
  });
});
