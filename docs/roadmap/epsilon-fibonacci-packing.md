# Roadmap: Epsilon Fibonacci packing correction

## Problem

The canonical spherical Fibonacci lattice with golden-angle 137.508° has a known small inefficiency near the poles: a handful of points cluster slightly tighter than the rest of the surface. For our use case this manifests as a faintly visible "knot" tendency at the lattice's top and bottom, and a marginally reduced nearest-neighbor distance for slots that happen to land near the poles.

A well-documented modification — applying a small epsilon offset to the index when computing the polar angle — improves nearest-neighbor distance by up to ~8.3% with no other change.

## Proposed approach

Modify `sphericalFibonacci()` in `useSaccadeStore.ts` to incorporate the epsilon offset. The exact form (from Marques et al., among others) replaces `(i + 0.5) / total` with `(i + epsilon) / (total - 1 + 2·epsilon)` where epsilon depends on `total` (small values like `0.36` work for `total >= 100`).

This is a pure geometric refinement: no wire-format change, no tier or capacity change, no behavioral change to injection / decay / reinforcement. Existing vitest geometry tests will need their expected values regenerated, but the *invariants* (foveation monotonicity, golden-angle ratio, tier contiguity, no Z-stride) all still hold.

## Acceptance criteria

- New positions still satisfy all four foveation invariants (`stride`, `tier_contiguity`, `bvh_proxy`, `foveation`).
- Nearest-neighbor distance across the full 8,000-slot lattice improves measurably (target: ≥ 5% over current values).
- No change to wire format or 28-byte CRVM packet.
- Existing replay binaries continue to decode (positions are not part of the wire packet — they are derived from slot index — so replay is automatic, but verify).
- New vitest case: epsilon-corrected lattice does not produce duplicate positions and preserves Fact-at-core / Dream-at-rim ordering.

## Not in scope

- Changing the golden-angle constant.
- Changing the radius growth function (still `√(slotIndex) · 0.6`).
- Visualizing the improvement in the HUD.
