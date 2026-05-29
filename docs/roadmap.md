# RCMT roadmap & paste triage

This file is the single source of truth for "did we build this, are we planning to, or did we reject it and why." It triages every claim from the two recent NotebookLM pastes (`attached_assets/Pasted-The-Radial-Cognitive-Memory-Tapestry-RCMT-v5-0-Platinum_*.txt` and `attached_assets/Pasted-The-5D-Slot-tier-radial-boundaries-and-their-geometric-_*.txt`) into one of three buckets.

The point is so that next time a paste arrives with similar claims, you can diff the paste against this file in five minutes instead of re-litigating the audit.

---

## Built

Things that are in the code today, with a pointer to verify.

| Claim                                                              | Where to verify                                              |
|---------------------------------------------------------------------|--------------------------------------------------------------|
| 5-tier ontology (Fact / Scenario / Metric / Theory / Dream)         | `TIER_CAPS`, `TIER_LAMBDA` in `useSaccadeStore.ts`           |
| Golden-angle Fibonacci spiral (137.508°)                            | `GOLDEN_ANGLE`, `sphericalFibonacci()` in `useSaccadeStore.ts` |
| 8,000-node hard cap                                                 | `MAX_NODES = 8000`                                           |
| Single-draw-call InstancedMesh, 1-draw-call mandate                 | `SaccadeInstancedMesh.tsx`                                   |
| Exponential time-decay `Health(t) = exp(-λ·Δt)`                     | `decaySweep` in `useSaccadeStore.ts`                         |
| Per-tier FIFO `vacantSlotsByTier`                                   | `vacantSlotsByTier`, `injectLiveIntentVector` outcomes       |
| Local ONNX inference (MiniLM-L6-v2 quantized, in a worker)          | `onnxInference.worker.ts`                                    |
| 28-byte CRVM wire stride                                            | `STRIDE_BYTES = 28` in `api-server/src/lib/lww.ts`           |
| LWW arbitration by Float64 timestamp, server-side                   | `processPacketBatch` in `api-server/src/lib/lww.ts`          |
| Binary frame playback / timeline scrub                              | `mockFrames`, `setFrameIndex` in `useSaccadeStore.ts`        |
| Hover tooltip showing source phrase                                 | `HoverTooltip.tsx`, `slotPhrase[]` (Task #13)                |

## Planned

Things we have not built but intend to. Each has its own one-page spec in `docs/roadmap/`.

- **[Variable node radii](./roadmap/variable-node-radii.md)** — make a slot's visual radius scale with the length of the source phrase, so "long thought" occupies more visual real estate. Matches the optical-compression metaphor and gives a VLM a stronger foveal signal for high-content slots.
- **[Epsilon Fibonacci packing correction](./roadmap/epsilon-fibonacci-packing.md)** — apply the well-known epsilon-offset variant of the spherical Fibonacci lattice for ~8% nearest-neighbor improvement near the poles, without changing the wire format.
- **[`sovereign_save_key.bin` persistence](./roadmap/sovereign-save-key.md)** — write the 224 KB in-memory tapestry to disk on shutdown and re-load it on boot, so the lattice survives a refresh.
- BVH spatial index over the 8k mesh + functional lasso path (Task #1) — *see existing task plan.*
- Visible synapse edges between semantically related nodes — *Day-1 metaphor restoration.*
- Semantic placement within a tier shell (cosine-similarity ordering instead of pure insertion index).
- Text labels on the lattice (billboarded sprites on hover) — *partially landed via the Task #13 tooltip; full Day-1 sprite labels still pending.*
- Multimedia ingestion (video / audio frames via a separate embedding worker + sidecar payload).
- Serializable "context ground" export — the parallel text-payload binary so another AI inherits source phrases, not just positions.
- CKKS / TenSEAL homomorphic export — the `10000.0` cleartext-matrix scale is reserved for this.

## Rejected

Claims from the pastes that contradict the wire format, the vitest tripwires, or the deliberate architecture. Each has a one-line "why we don't do this" so the same claim cannot quietly slip back in.

- **32-byte packet stride.** Rejected — the wire packet is 28 bytes, pinned by `lww.test.ts`. A 32-byte stride is what we'd see day-1 of a wire-format regression.
- **64-bit Composite Clock (48-bit timestamp + 16-bit peer-ID tiebreaker).** Rejected — the timestamp is a plain Float64; peerId is not in the packet. Composite clocks buy nothing when the server is the single arbiter.
- **Embedded peerId in every packet.** Rejected — server assigns peerId via JSON HELLO and prevents self-echoes by sender-exclusion. Embedding it wastes bytes and couples identity to every position update.
- **Per-tier Z-stride / 5 flat Z layers.** Rejected — the lattice is a single continuous 3D sphere; tier is encoded by contiguous index range + sqrt-radius foveation, not by Z plane. Reintroducing Z-stride breaks the unified-sphere invariant.
- **`find_safe_coordinate(layer_index, text_content)` runtime spatial search.** Rejected — position is a deterministic function of absolute slot index. A runtime search would make positions non-reproducible and break byte-stable replay.
- **`SAFE_COMPRESSION_RATIO = 10.0` as a runtime compression algorithm inside RCMT.** Rejected — RCMT does not compress text tokens into vision tokens via an internal function. The optical compression is realized by the downstream VLM scanning the lattice foveally; that is the whole point. (The *consumer* compresses; we shape the substrate so the compression lands well.)
- **`MAX_TOKENS_PER_VIEW = 8000` as a token-count kill-switch.** Rejected — we have an 8,000 *slot* cap, not an 8,000 *token* cap. The cap exists because of memory + single-draw-call budget, not because of a VLM attention-collapse threshold. Renaming the constant would confuse two different things.
- **CKKS / TenSEAL homomorphic encryption as a shipped feature.** Not rejected, but **not shipped** — see Planned. The `10000.0` cleartext-matrix scale is the reserved hook; nothing else is wired up.
- **Vite proxy bridge intercepting `/socket` → `ws://0.0.0.0:8080`, `concurrently` script.** Rejected — this is a pnpm monorepo behind a shared path-based proxy. The API server binds `0.0.0.0` and serves `/socket` directly; each artifact runs as its own workflow. No Vite proxy, no `concurrently`.
- **Padded 128-element tensor arrays in the ONNX worker.** Rejected — the MiniLM-L6-v2 embedding is 384-dimensional. 128 is a phantom number.
- **"Sub-5 ms latency floor" enforced by the worker.** Rejected — no such floor exists in the code, and an enforced floor would only mask, not improve, real latency.
- **`saccadeIndexer.worker.js` memory-mapping persistence frames.** Rejected as described — the actual worker (`SaccadeWorkerManager.ts`) handles frame decompression / playback prep, not persistence. The 224,000-byte (8,000 × 28) math is correct on paper but no memory-mapping happens. If/when persistence lands, see the [sovereign-save-key roadmap page](./roadmap/sovereign-save-key.md).
