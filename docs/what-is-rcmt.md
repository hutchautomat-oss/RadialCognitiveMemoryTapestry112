# What is RCMT?

RCMT — Radial Cognitive Memory Tapestry — is a **fixed-size 3D lattice of 8,000 slots** that stores meaning as *position*, not as embedding vectors. Each slot is one tiny sphere at deterministic (x, y, z) coordinates. The whole tapestry weighs about 224 KB on the wire (8,000 slots × 28 bytes), small enough to ship as a single binary file.

It is **not** a vector database, **not** a RAG index, and **not** a fine-tuning loop. It is a **grounding substrate** — a shape a downstream AI can scan to recover an entire memory hierarchy in a single pass, with the epistemic priority of each piece of memory encoded in *where it sits in the sphere* rather than in any metadata field.

The user (or an upstream pipeline) feeds RCMT short textual phrases. A local ONNX classifier (MiniLM-L6-v2, runs in a web worker, never leaves the device) assigns each phrase to one of five ontology tiers — **Fact / Scenario / Metric / Theory / Dream** — and the lattice writes the phrase into the next free slot in that tier's contiguous index range. Position is then fixed forever for that slot: the (x, y, z) is `√(slotIndex) · 0.6` along the golden-angle Fibonacci spiral, and *both the radius and the angle are deterministic*. The lattice never reflows.

The result is a small, dense, append-only, byte-stable visual artifact that any vision-capable model can ingest by *looking* at it.

See also: [`why-foveation.md`](./why-foveation.md), [`why-five-tiers.md`](./why-five-tiers.md), [`why-28-bytes.md`](./why-28-bytes.md).
