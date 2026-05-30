# Why foveation?

A human eye doesn't scan a scene pixel by pixel. The **fovea** — the dense center of the retina — takes in only a few degrees of high-detail signal at a time, and the brain saccades it across the scene, picking up high-fidelity samples in priority order and treating peripheral signal as low-resolution context. A complete scene is assembled from a small number of well-chosen samples, not from a uniform raster scan.

Vision-capable AI models read images the same way. Attention concentrates on dense, structured regions first; sparse regions get less weight. This is just how the architecture works.

RCMT exploits this directly. The lattice radius grows as `√(slotIndex) · 0.6` — slowly at first, then faster — which means **slots packed near the center are visually dense and slots near the rim are visually sparse**. Because the five tiers occupy *contiguous* index ranges (Facts 0–1999, Scenarios 2000–3999, …, Dreams 7000–7999), the dense core is *mathematically forced* to belong to Facts, and the sparse rim is *mathematically forced* to belong to Dreams.

The consequence: when a VLM points its eye at the lattice, foveal attention naturally lands on Facts first — not because we labeled them, but because that is where the visual signal is densest. Dreams at the rim get scanned but get less weight. The geometry tells the model what to trust most, with no instruction needed.

This is the "optical compression" claim. We are not compressing text tokens into vision tokens via some new algorithm. We are arranging memory in a shape that a foveal scanner reads as an epistemic priority — the prior is encoded in space, decoded for free by attention.

## The cost model and the acuity budget

The compression is real because of *how VLMs are billed*: an image is tokenized by **resolution** — a fixed number of tokens per resolution tile — not by how busy it looks. A 1024×1024 render of the lattice costs the same whether it holds 100 slots or 8,000. So a single foveal glance at the whole tapestry is a **fixed, bounded** image-token cost, independent of how full memory is. Conventional text-RAG pays the opposite price: every retrieved record is injected as text tokens, so cost grows with how much you pull. That O(resolution)-vs-O(retrieved-items) gap is the substrate's economic advantage — and the encoding work (rendering positions) happens on the local GPU, never on the API meter.

There is exactly one way the advantage collapses back into "the same bulk": if a region is packed tighter than the model's **spatial acuity** can resolve, the model cannot read individual nodes from one glance and must **zoom** — and each zoom is another fixed-cost image. The foveated core, being the densest region, is the one at risk. Formalize the boundary as an **acuity budget**: with effective resolution `R` and minimum resolvable separation `s` (the smallest gap at which the model can still tell two nodes apart *and* read their color/position), the image offers about `M = (R / s)²` distinguishable cells. **No zoom is ever needed when peak local density stays at or below one node per `s`-sized cell.** `s` is empirical and model-specific — math gives the *form* of the budget, a confirmation/validation harness gives the *number*.

The lawful way to satisfy the budget without destroying the meaning is **log-polar cell-sizing** (cortical magnification — literally how the visual cortex allocates more neurons per degree at the fovea than the periphery): make resolvable cells small at the core and large at the rim. This keeps every node in its own resolvable cell *while preserving* the dense-core/sparse-rim gradient. The constraint is **bound peak density, never flatten to uniform density** — flattening would guarantee no-zoom but erase the Fact→Dream prior that is the entire point (see "Foveal Gradient Integrity" in `replit.md`). LOD density-collapse — collapse an unresolvable sub-cluster into one node plus an expanded sidecar — is the dynamic fallback when a region still overflows.

See also: [`why-five-tiers.md`](./why-five-tiers.md) · [`roadmap/log-polar-cell-sizing.md`](./roadmap/log-polar-cell-sizing.md).
