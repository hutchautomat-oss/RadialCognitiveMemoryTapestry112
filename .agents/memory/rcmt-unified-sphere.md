---
name: RCMT unified-sphere geometry
description: Why the lattice renders as one continuous 3D sphere instead of per-tier sub-spirals or Z-strata.
---

The 8000-slot lattice is a single continuous 3D sphere. Two pieces produce it:

1. **One global Golden-Angle Fibonacci spiral** over all 8000 slots. By construction no two slots share an angular vector from the origin, so radial collinearity cannot occur — multiple tiers stacked at different radii on the same ray would be a Z-fighting hazard, but the global spiral makes the hazard impossible.
2. **Foveated radius via `sqrt(slot) * NODE_DENSITY_BUBBLE`**. Because tier slot ranges are contiguous (Fact `[0,2000)`, …, Dream `[7000,8000)`), sqrt-growth naturally places facts at the foveated core and dreams at the rim *without* an explicit per-tier radius table.

**Why:** Per-tier sub-spirals (one Fibonacci per tier) reuse the same low indices in each tier, so multiple nodes share angular vectors at different radii → radial collinearity, depth-sorting artifacts, and a "shells" look. A per-tier Z-stride masks this by physically separating tiers in Z, but the result is 5 flat layers, not a sphere. The unified spiral + sqrt-radius approach gives a true sphere AND preserves the "closer to fact, closer to act" foveation maxim with one formula.

**How to apply:** `slotRestPosition(slot)` is the only function that owns this geometry. Never reintroduce a Z-stride per tier. Never split the spiral into per-tier sub-spirals. Tier differentiation belongs to color (and naturally to radial band via sqrt-growth on the contiguous index range), not to a Z offset.
