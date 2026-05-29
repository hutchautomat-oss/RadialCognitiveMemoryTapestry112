# Why foveation?

A human eye doesn't scan a scene pixel by pixel. The **fovea** — the dense center of the retina — takes in only a few degrees of high-detail signal at a time, and the brain saccades it across the scene, picking up high-fidelity samples in priority order and treating peripheral signal as low-resolution context. A complete scene is assembled from a small number of well-chosen samples, not from a uniform raster scan.

Vision-capable AI models read images the same way. Attention concentrates on dense, structured regions first; sparse regions get less weight. This is just how the architecture works.

RCMT exploits this directly. The lattice radius grows as `√(slotIndex) · 0.6` — slowly at first, then faster — which means **slots packed near the center are visually dense and slots near the rim are visually sparse**. Because the five tiers occupy *contiguous* index ranges (Facts 0–1999, Scenarios 2000–3999, …, Dreams 7000–7999), the dense core is *mathematically forced* to belong to Facts, and the sparse rim is *mathematically forced* to belong to Dreams.

The consequence: when a VLM points its eye at the lattice, foveal attention naturally lands on Facts first — not because we labeled them, but because that is where the visual signal is densest. Dreams at the rim get scanned but get less weight. The geometry tells the model what to trust most, with no instruction needed.

This is the "optical compression" claim. We are not compressing text tokens into vision tokens via some new algorithm. We are arranging memory in a shape that a foveal scanner reads as an epistemic priority — the prior is encoded in space, decoded for free by attention.

See also: [`why-five-tiers.md`](./why-five-tiers.md).
