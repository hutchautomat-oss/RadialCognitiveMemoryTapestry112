# Log-polar (cortical-magnification) cell-sizing

## Problem

The optical-compression advantage holds only while the lattice reads in one (or a few) fixed-resolution glances. A VLM is billed per resolution tile, so one glance is a bounded cost regardless of how full memory is — *unless* a region is denser than the model's spatial acuity can resolve. The foveated core is exactly that risk: as Facts fill `[0, 2000)`, the innermost shells pack tightest. If the core exceeds the model's resolvable separation `s`, the model must zoom to read it, and enough zoom-ins multiply the per-glance cost back toward the "bulk" of text-RAG — negating the whole thesis.

A naive fix — spread everything into a uniform-density grid so nothing is ever too dense — would guarantee no-zoom but **flatten the foveal gradient**, erasing the Fact→Dream epistemic prior that the geometry exists to encode. That violates Foveal Gradient Integrity and is rejected.

## Proposed approach

Adopt a **log-polar / cortical-magnification** mapping for resolvable cell size: cells are small near the core and grow toward the rim, mirroring how the retina + cortex devote more area per degree at the fovea. This yields *uniform resolvability in the model's view* while *preserving the non-uniform density gradient in the semantic layout* — the two goals stop fighting.

The gate is the **acuity budget**: with effective resolution `R` and minimum resolvable separation `s`, an image offers ≈ `M = (R / s)²` distinguishable cells; no zoom is required when peak local density ≤ one node per `s`-sized cell. Cell sizes are chosen so even the densest core shell satisfies this. `s` is empirical and model-specific, so step one is measuring it (see acceptance criteria). LOD density-collapse remains the fallback for any region that still overflows.

This is a **render / consumption-side** mapping. It must not touch the 28-byte wire format, the deterministic slot→position function, or byte-stable replay — it changes how the lattice is *rendered for a scanner*, not how it is *stored*.

## Acceptance criteria

- A confirmation/validation harness measures `s` for at least one target VLM by rendering controlled node-density patches and checking whether the model can correctly distinguish and read adjacent nodes; `s` is recorded per model.
- A log-polar cell-sizing function maps slot radius → resolvable cell size such that, at the chosen render resolution `R`, peak core density satisfies `M = (R / s)²` with no zoom.
- The rendered lattice still visibly preserves the dense-core / sparse-rim gradient (Gradient Integrity holds — verified visually and by a density-vs-radius check confirming a monotonic decrease, not uniformity).
- No change to `STRIDE_BYTES`, the slot→position determinism, or replay byte-stability (existing vitest tripwires stay green).
- A measured comparison reports image-tokens-per-query (and answer accuracy) versus a text-RAG baseline as the lattice fills toward 8k, demonstrating the cost stays bounded.
