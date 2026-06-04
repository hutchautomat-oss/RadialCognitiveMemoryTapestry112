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
| BVH spatial index + functional lasso selection (Task #1)            | `getCollisionBVH`/`collisionBVH` in `useSaccadeStore.ts`, `LassoSelection.tsx` |
| Semantic saccade — read-only `/find` foveal targeting (Task #29)    | `rankBySimilarity`/`searchMatches` in `useSaccadeStore.ts`, `embedQuery` in `injectPhrase.ts`, `SearchFocus` in `Scene.tsx` |
| `sovereign_save_key.bin` persistence — lattice survives refresh      | `tapestryPersist.ts` (encode/decode/autosave/boot-load/flush); wired into `App.tsx` boot + `beforeunload`; `/save` + `/load` commands in `CommandConsole.tsx`; round-trip invariants in `persist.test.ts` |

## Planned

Things we have not built but intend to. Each has its own one-page spec in `docs/roadmap/`.

- **[Sovereign Session Wrapper](./roadmap/sovereign-session-wrapper.md)** — a product layer that takes any AI instance and feeds it an RCMT sovereign context stack automatically, maintaining epistemic continuity across sessions. The first real-world RCMT product demo: RCMT managing its own development context is the pitch. Market: every enterprise team where AI decisions are re-litigated because no session knows what the last one decided.

- **[Variable node radii](./roadmap/variable-node-radii.md)** — make a slot's visual radius scale with the length of the source phrase, so "long thought" occupies more visual real estate. Matches the optical-compression metaphor and gives a VLM a stronger foveal signal for high-content slots.
- **[Epsilon Fibonacci packing correction](./roadmap/epsilon-fibonacci-packing.md)** — apply the well-known epsilon-offset variant of the spherical Fibonacci lattice for ~8% nearest-neighbor improvement near the poles, without changing the wire format.
- **[`sovereign_save_key.bin` persistence](./roadmap/sovereign-save-key.md)** — ~~write the 224 KB in-memory tapestry to disk on shutdown and re-load it on boot, so the lattice survives a refresh.~~ **BUILT** — see Built table above.
- **[Log-polar cell-sizing](./roadmap/log-polar-cell-sizing.md)** — vary resolvable cell size by radius (cortical magnification) so the dense core stays within a VLM's spatial-acuity budget `M = (R/s)²` and never needs zoom, while preserving the foveal gradient. First step: measure the acuity constant `s` empirically via a confirmation/validation harness that also benchmarks image-tokens-per-query against a text-RAG baseline.
- **[Multimodal substrate doctrine](./roadmap/multimodal-substrate.md)** — how a non-text sense (audio, video, haptics) enters the lattice without touching the wire format. The rule: any sense is a frozen, versioned codebook entry in a **sidecar keyed by slot index**, never on the 28-byte wire; the five tiers stay **epistemic, not per-sense**; codebooks are immutable / append-only / version-keyed / drop-unknown-version (ITU-T/IETF model). Resolves the federation hand-off: **a modality is a sidecar dimension, not a tapestry boundary** — tapestries are scoped per-agent/per-domain, never per-sense.
- **[Mycelial Constellation federation doctrine](./roadmap/mycelial-constellation.md)** — how multiple RCMTs combine. A fractal, foveated *federation* model (substrates stay separate byte-stable shards; a query assembles a transient cross-shard view) rather than fusion into one bigger binary. Names the three distinct operations the word "stitch" conflates: **replication** (same brain, many devices — the existing peer-merge work), **federation/composition** (different brains, related context — a manifest graph index + lateral text-payload transfer), and **query/database** (federated shards under usage-weighted routing). Cross-brain semantic reconciliation without shared embeddings is the named open problem.
- Visible synapse edges between semantically related nodes — *Day-1 metaphor restoration.*
- Semantic placement within a tier shell (cosine-similarity ordering instead of pure insertion index).
- Text labels on the lattice (billboarded sprites on hover) — *partially landed via the Task #13 tooltip; full Day-1 sprite labels still pending.*
- Multimedia ingestion (video / audio frames via a separate embedding worker + sidecar payload) — the *implementation* of the [Multimodal substrate doctrine](./roadmap/multimodal-substrate.md) above; the doctrine sets the rules (sidecar codebook, epistemic tiers, drop-unknown-version), this is the eventual ingestion worker.
- Serializable "context ground" export — the parallel text-payload binary so another AI inherits source phrases, not just positions.
- CKKS / TenSEAL homomorphic export — the `10000.0` cleartext-matrix scale is reserved for this.

## Rejected

Claims from the pastes that contradict the wire format, the vitest tripwires, or the deliberate architecture. Each has a one-line "why we don't do this" so the same claim cannot quietly slip back in.

- **32-byte packet stride.** Rejected — the wire packet is 28 bytes, pinned by `lww.test.ts`. A 32-byte stride is what we'd see day-1 of a wire-format regression.
- **Decay / episodic-recency state packed into `intentId` on the wire.** Rejected — decay is continuously-derived *local* state, not an LWW mutation; broadcasting it floods the wire and buys nothing the receiver can't derive locally. If an episodic channel is wanted it is a local visual/temporal cue (brightness/pulse) or a sidecar attribute, never a wire field. See [Multimodal substrate doctrine](./roadmap/multimodal-substrate.md) (experience-vs-memory fork).
- **64-bit Composite Clock (48-bit timestamp + 16-bit peer-ID tiebreaker).** Rejected — the timestamp is a plain Float64; peerId is not in the packet. Composite clocks buy nothing when the server is the single arbiter.
- **Embedded peerId in every packet.** Rejected — server assigns peerId via JSON HELLO and prevents self-echoes by sender-exclusion. Embedding it wastes bytes and couples identity to every position update.
- **Per-tier Z-stride / 5 flat Z layers.** Rejected — the lattice is a single continuous 3D sphere; tier is encoded by contiguous index range + sqrt-radius foveation, not by Z plane. Reintroducing Z-stride breaks the unified-sphere invariant.
- **`find_safe_coordinate(layer_index, text_content)` runtime spatial search.** Rejected — position is a deterministic function of absolute slot index. A runtime search would make positions non-reproducible and break byte-stable replay. (Not to be confused with the *built* read-only semantic saccade `/find` above: that retrieves and **highlights** existing slots and moves only the camera — it never *places* or relocates a node, so it preserves byte-stable replay.)
- **`SAFE_COMPRESSION_RATIO = 10.0` as a runtime compression algorithm inside RCMT.** Rejected — RCMT does not compress text tokens into vision tokens via an internal function. The optical compression is realized by the downstream VLM scanning the lattice foveally; that is the whole point. (The *consumer* compresses; we shape the substrate so the compression lands well.)
- **`MAX_TOKENS_PER_VIEW = 8000` as a token-count kill-switch.** Rejected — we have an 8,000 *slot* cap, not an 8,000 *token* cap. The cap exists because of memory + single-draw-call budget, not because of a VLM attention-collapse threshold. Renaming the constant would confuse two different things.
- **CKKS / TenSEAL homomorphic encryption as a shipped feature.** Not rejected, but **not shipped** — see Planned. The `10000.0` cleartext-matrix scale is the reserved hook; nothing else is wired up.
- **Vite proxy bridge intercepting `/socket` → `ws://0.0.0.0:8080`, `concurrently` script.** Rejected — this is a pnpm monorepo behind a shared path-based proxy. The API server binds `0.0.0.0` and serves `/socket` directly; each artifact runs as its own workflow. No Vite proxy, no `concurrently`.
- **Padded 128-element tensor arrays in the ONNX worker.** Rejected — the MiniLM-L6-v2 embedding is 384-dimensional. 128 is a phantom number.
- **"Sub-5 ms latency floor" enforced by the worker.** Rejected — no such floor exists in the code, and an enforced floor would only mask, not improve, real latency.
- **DNA stacking / fusing lattices into one binary.** Rejected — permanently merging two substrates into one larger binary or global coordinate system (e.g. 16k slots, a shared coordinate space) breaks the load-bearing invariants: capacity-constant-by-construction, 8k forever, 224 KB on the wire, byte-stability, and local-coordinate slot indices. The lawful model is **federation, not fusion** — substrates stay separate byte-stable shards and a query assembles a transient cross-shard view. See [Mycelial Constellation](./roadmap/mycelial-constellation.md). (Biology agrees: endosymbiosis kept separate genomes rather than fusing them.)
- **`saccadeIndexer.worker.js` memory-mapping persistence frames.** Rejected as described — the actual worker (`SaccadeWorkerManager.ts`) handles frame decompression / playback prep, not persistence. The 224,000-byte (8,000 × 28) math is correct on paper but no memory-mapping happens. If/when persistence lands, see the [sovereign-save-key roadmap page](./roadmap/sovereign-save-key.md).
