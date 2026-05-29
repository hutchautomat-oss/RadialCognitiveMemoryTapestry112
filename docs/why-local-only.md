# Why local-only ONNX?

The intent classifier — the model that decides which tier a phrase belongs in — runs **entirely in the browser**, in a dedicated web worker, via `@xenova/transformers` loading a quantized `all-MiniLM-L6-v2`. The phrase being classified never reaches a server. The 384-dimensional embedding never reaches a server. The only thing that touches the network is the resulting position update — a 28-byte packet that contains slot index, tier ID, (x, y, z), scale, and timestamp, with **no text and no embedding**.

Three reasons:

1. **Sovereignty.** RCMT is sold as a grounding substrate that a buyer can run inside their own model pipeline. The moment classification requires a third-party API call, that promise dies. Every dependency that *can* be local *is* local.
2. **Drift control.** A server-side classifier could be upgraded out from under the lattice, silently shifting which phrases land in which tier. A local quantized ONNX file is byte-stable until the user deliberately replaces it.
3. **Latency.** The classifier sits in front of every injection. A round trip to a server would dominate the user-visible cost of typing a phrase. Local inference is sub-100 ms on consumer hardware.

The 25 MB model downloads once and is cached by the browser. The worker is a HMR singleton — a hot module reload keeps it warm, a hard refresh re-downloads. This is intentional; the model is not part of the dev loop, it is part of the substrate.

See also: [`why-28-bytes.md`](./why-28-bytes.md) for what the wire packet does and does not carry.
