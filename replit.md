# RCMT Platinum Monolith — Radial Cognitive Memory Tapestry

## Vision

RCMT is an **optical-compression grounding substrate** for downstream AI consumers. Instead of storing meaning as high-dimensional embeddings in a vector database, it stores meaning as **positions in a 3D foveated lattice** that a vision-capable model reads the same way a human eye reads a scene — **foveally**: dense, high-confidence regions first, sparse peripheral regions as context. The Fact→Dream tier gradient encodes a **scientific-method epistemology** directly into the geometry: irreducible Facts sit at the dense core (highest foveal weight), speculative Dreams disperse to the sparse rim (lowest). A model scanning the lattice inherits the epistemic prior for free — the shape *is* the meaning.

The whole 8,000-slot tapestry fits in **224 KB on the wire** and is byte-stable across model upgrades because no embedding lives in the substrate. Conventional RAG drifts when re-embedded; RCMT cannot drift, because positions are deterministic from slot index + insertion order. Capacity is constant by construction (8,000 slots forever), so the binary doesn't bloat over a year of use. Five runtime invariants and a vitest tripwire suite physically prevent the wire format from changing — drift is observable, not silent.

This is meant to behave like a brain's visual cortex reading a memory hierarchy: dense, append-only, peer-mergeable, picked up mid-thought by any agent that loads the binary.

## Positioning

RCMT is a **licensable product**, not OSS. Two buyer tiers:

- **Primary — frontier AI labs (Anthropic / OpenAI / DeepMind / similar).** A research or applied engineer evaluating a grounding substrate for their own model. The product hypothesis: *frontier labs need a grounding mechanism that isn't a vector DB (drifts on re-embed, bloats unboundedly) and isn't a retraining loop (slow, expensive, opaque)*. RCMT is a third option — a position-as-meaning substrate that ships as a 224 KB binary, scans foveally, and physically cannot drift.
- **Secondary — individual AI devs and indie researchers.** A consumer tier of the same product for personal sovereign grounding experiments.

Both tiers buy the same artifact. Pricing, licensing terms, and distribution mechanics are real concerns but **out of scope for this document** — they will be handled separately.

The downstream **consumer of the substrate** is always a VLM / multimodal AI doing foveal scanning of the rendered lattice. The product is the substrate, not the UI; the UI exists to demonstrate the substrate to evaluators.

For the human-readable concept breakdown, see [`docs/`](./docs/).

## Confirmed wire-format invariants

These four facts are non-negotiable. Every one is defended by a vitest tripwire in `artifacts/api-server/src/lib/lww.test.ts`. NotebookLM-style pastes have repeatedly tried to "upgrade" the wire format in ways that would break all four; do not accept such changes without rewriting the tripwires and explaining why in this section.

- **28-byte CRVM packet.** Pinned by `lww.test.ts` ("STRIDE_BYTES is 28"). A 32-byte stride (e.g. + u32 peerId) would fail.
  *Why:* Eight bytes of every packet are the LWW timestamp; the other 20 carry slot + intent + position + scale. Anything else doesn't fit and breaks byte-stable replay.
- **No embedded peerId.** Pinned by the "packet has NO embedded peerId / composite-clock field" tripwire. The server assigns a peerId over a JSON HELLO frame on connect and prevents self-echoes structurally by excluding the sender from each broadcast.
  *Why:* A per-packet peerId is wire bloat *and* a security/identity coupling the protocol intentionally avoids — the server arbitrates, not the packets.
- **No composite clock.** Same tripwire. The timestamp is a plain Float64 (ms since epoch), not split into "48-bit physical + 16-bit peer-ID tiebreaker."
  *Why:* The server is the single arbiter, so a vector clock or composite clock buys nothing and breaks the byte layout.
- **Single Float64 LWW timestamp.** Strictly-greater wins; equal timestamps drop. Pinned by `processPacketBatch` tests.
  *Why:* This is the entire arbitration policy. Any tie-breaker beyond strict-greater requires re-examining replay semantics.

## Confirmed geometry invariant — Foveal Gradient Integrity

The four facts above protect the *bytes*. This one protects the *shape* — and in RCMT the shape **is** the meaning, so it is equally non-negotiable. It is a *design* invariant, not one of the five runtime HUD dots: it constrains every future geometry / placement / render decision.

- **Foveal Gradient Integrity.** The density gradient — dense, high-confidence Facts at the core; sparse, speculative Dreams at the rim — *is* the encoded Fact→Dream epistemology. Any change to placement, cell-sizing, or render mapping must **vary cell size to preserve the gradient, never flatten it into uniform density.**
  *Why:* A downstream VLM inherits the epistemic prior for free only because the densest visual signal coincides with the most-trusted memories. Flattening to uniform density would win a local engineering argument (e.g. "guarantee no zoom") while erasing the prior — and the whole optical-compression thesis collapses with it.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server + LWW sync core (port wired by workflow)
- `pnpm --filter @workspace/rcmt run dev` — run the web artifact (path-routed by the shared proxy)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm test` — run the vitest invariant suite (geometry, per-tier FIFO, CRVM/LWW). Per-package: `pnpm --filter @workspace/rcmt run test` or `pnpm --filter @workspace/api-server run test`. CI: `pnpm test -- --run`.
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string (currently unused by RCMT runtime; reserved for future persistence)

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web artifact: React 19, Vite, @react-three/fiber + drei, three, three-mesh-bvh, zustand
- API: Express 5 + ws (WebSocket) for the LWW sync core
- ML: onnxruntime-web + @xenova/transformers running fully in a web worker, no server inference
- DB: PostgreSQL + Drizzle ORM (reserved for future use)
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle for the server)

## Product

RCMT is a personal cognitive substrate. The user types a phrase (or scrubs a binary file, or receives a peer broadcast). A local ONNX classifier assigns it to one of five ontology tiers — **Fact / Scenario / Metric / Theory / Dream**. The injection lands in an 8,000-slot VRAM-backed lattice as one instanced sphere in a foveated Fibonacci shell: facts cluster near the core, dreams disperse to the rim. Spawning is a 250 ms starburst animation. Memory pressure recycles dead slots through a FIFO queue.

Every mutation broadcasts over WebSocket as a 28-byte binary packet to all peers, where a Last-Writer-Wins timestamp arbitrates conflicts. A scrubbable timeline replays history from any binary frame buffer.

Because each node is just a 28-byte position + tier + timestamp record rather than a 1500-dim float vector, the in-memory footprint is roughly two orders of magnitude denser than an equivalent vector store (~224 KB for the full 8k cognitive ground state). The lattice is foveated: early slots cluster tightly at the center (high-attention core), later slots spiral outward on a spherical Fibonacci shell (sparse periphery). All five tiers share one continuous 3D sphere — they are distinguished by color and by their natural foveated radial band (Facts inner, Dreams outer), not by Z-plane separation. Memory is append-only with FIFO reclamation when the 8k cap is hit, and peer instances merge state via the LWW binary protocol — no central authority, no embeddings ever leave the device.

This is meant to behave like a brain: dense, append-only, peer-mergeable, picked up mid-thought by any agent that loads the binary.

## Where things live

- `artifacts/rcmt/src/lib/injectPhrase.ts` — **the single canonical VRAM write path** for a text phrase. Serializes all callers via a module-level Promise chain (the ONNX worker accepts only one in-flight classify). Calls ONNX → `injectLiveIntentVector` → broadcast → HUD events. Both the CommandConsole and the autonomous ThoughtTicker route through this; nothing else writes to the lattice except direct store actions like `seedFromNodes` / scrub.
- `artifacts/rcmt/src/data/corpus.ts` — 7 boot **AXIOMS** (Fact-tier seeds for the first 4.2 s of operation) + ~150 PHRASE_CORPUS entries the ticker drips out at a jittered 2-4 s cadence.
- `artifacts/rcmt/src/store/useHudStore.ts` — telemetry store. Bounded event ring (500 cap), camera sample, FPS, packets-in/out + rates, ticker state (running/period/jitter/busy/totalFired), and the 5 invariants strip. Has NO import of saccade/network stores → no circular-dep risk.
- `artifacts/rcmt/src/lib/invariants.ts` — runs the 5 grounding-file invariants (`stride`, `tier_contiguity`, `fifo`, `bvh_proxy`, `foveation`). Sampled ~1 Hz by `HudBridge`.
- `artifacts/rcmt/src/components/ThoughtTicker.tsx` — invisible component. 1.5 s kickoff → axiom seed (600 ms gap) → jittered loop. Pause-aware via `useHudStore.ticker.running`; busy-aware via `ticker.busy`; HMR-safe teardown.
- `artifacts/rcmt/src/components/GhostScaffold.tsx` — single-draw `Points` cloud of all 8 000 rest positions. Built once via `useMemo`, no per-frame work. Makes capacity + foveation visible before any phrase lands.
- `artifacts/rcmt/src/components/HudBridge.tsx` — lives INSIDE the R3F Canvas. Samples camera/FPS at 4 Hz and runs invariants at 1 Hz into `useHudStore`. Never writes 60 Hz state (would tank FPS).
- `artifacts/rcmt/src/components/hud/` — aerospace EFIS HUD cards: SyncCore (link/engine/packets/ticker/fps), Ontology (per-tier bars + 10 s Δ counts), EventStream (last 22 of the 500-cap ring), Invariants (top-center 5-dot strip), CameraReadout. Tokens in `tokens.ts` (low-chroma palette, 1 px hairlines, mono font).
- `artifacts/rcmt/src/store/useSaccadeStore.ts` — **VRAM source of truth.** The 8k-slot Float32Array (7 floats per slot: x, y, z, r, g, b, scale), starburst spawn timestamps, FIFO `vacantSlots`, frame playback, and the live ontology injection action. `injectLiveIntentVector` returns `InjectOutcome { index, kind: 'spawn'|'reinforce'|'evict'|'promote', tier }` so the inject pipeline can emit precise events.
- `artifacts/rcmt/src/components/SaccadeInstancedMesh.tsx` — single-draw-call renderer for the 8k lattice. Reads the active frame each tick, writes per-instance matrices and colors into the InstancedMesh.
- `artifacts/rcmt/src/components/CommandConsole.tsx` — terminal-style overlay for typing phrases, running `/lasso`, `/blast`, `/clear`, `/help`.
- `artifacts/rcmt/src/components/Timeline.tsx` — binary-frame scrubber.
- `artifacts/rcmt/src/components/Scene.tsx` — R3F scene root: lights, orbit controls, mesh mount.
- `artifacts/rcmt/src/network/NetworkManager.ts` — WebSocket client. Receives HELLO handshake from the server, broadcasts 28-byte CRVM packets, applies incoming LWW updates.
- `artifacts/rcmt/src/workers/OnnxWorkerManager.ts` + `onnxInference.worker.ts` — ONNX-in-a-worker intent classifier (5-class).
- `artifacts/rcmt/src/workers/SaccadeWorkerManager.ts` — background worker for frame decompression / playback prep.
- `artifacts/api-server/src/index.ts` — Express server + WebSocket LWW core. Assigns a peerId on connect via JSON HELLO frame, arbitrates timestamps, fans out broadcasts to all clients except the sender.

## Architecture decisions

These are the non-obvious choices that a reader couldn't infer from the code:

- **28-byte CRVM stride** (Cognitive Realtime VRAM Mutation). `[nodeIndex u16][intentId u16][x f32][y f32][z f32][scale f32][lwwTimestamp f64]`. peerId is *not* in the packet — the server assigns it via a JSON `HELLO` text frame on connect and physically prevents self-echoes by excluding the sender from each broadcast, so the redundant client-side peerId check was deleted.
- **`intentId` at bytes 2-3 is reserved**, not yet consumed. Today drag broadcasts write 0. The ONNX classifier produces a slot but the injection-side broadcast path doesn't wire it through yet (follow-up).
- **Unified 3D Fibonacci sphere.** A node's position is a deterministic function of its global slot index. ONE Golden-Angle spiral (137.508°) covers all 8000 slots — by construction no two slots share an angular vector from the origin, so radial collinearity / Z-fighting cannot occur. Radius = `sqrt(slot) * 0.6`: slot 0 sits at the foveated core, slot 7999 at the rim (~53.7). Because tier slot ranges are contiguous (Fact `[0,2000)`, …, Dream `[7000,8000)`), sqrt-growth naturally produces foveated tier shells *without* an explicit per-tier radius table. Replaces an earlier flat-disk spiral that had a "Knot Anomaly" at the center.
- **Optical cost is O(resolution), not O(node count) — the "acuity budget."** A VLM tokenizes an image by *resolution* (fixed tiles), not by visual complexity, so one foveal glance at the lattice costs a fixed, bounded image-token bill whether 100 or 8,000 slots are populated — that is the optical-compression win over text-RAG, whose cost scales with retrieved items. The win holds only while the lattice stays *legible in one glance*: if the dense core packs more slots than the model's spatial acuity `s` can resolve, reading it forces zoom-ins, and many zooms drag cost back toward "bulk." The no-zoom budget is `M = (R / s)²` distinguishable cells; `s` is **empirical and model-specific** (measured per VLM, not derived). The lawful fix that keeps a single glance sufficient *without* flattening the gradient is log-polar cell-sizing (roadmap), with LOD density-collapse as the fallback. Detail in [`docs/why-foveation.md`](./docs/why-foveation.md).
- **Five-tier slot ontology — color + radial band, not Z.** Every node is one of Fact / Scenario / Metric / Theory / Dream. The classifier assigns the tier at write time; tiers are visually distinguished by color and by their natural foveated radial band inside the unified sphere (sqrt-growth on contiguous index ranges naturally puts Fact at the core and Dream at the rim). The previous per-tier Z-stride (`5.0`) was local-render decoration only and was removed when the lattice was unified. The **`10000.0` cleartext-matrix scale** (`Z_isolated = S × 10000 + Z_local`) is a separate, **cloud-side** pre-processing transform that opens a 40000-unit cryptographic gap between tiers before CKKS packing — that gap prevents cross-tenant spatial hallucinations in the aggregator and never reaches the local R3F viewport. Do not conflate the two constants.
- **8,000 nodes hard cap**, single InstancedMesh, single draw call. The whole tapestry fits in 224 KB of typed-array memory at 28 bytes per node. When full, oldest dead slot is recycled via the vacant-slot registry in O(1). This is the "8k kill-switch."
- **Local-only ONNX inference.** The intent classifier runs in a web worker via `@xenova/transformers`; nothing ships to a server. The user's text never leaves their machine.
- **Last-Writer-Wins by lwwTimestamp**, server-arbitrated. The server tracks the latest timestamp per `nodeIndex` and silently drops stale updates. No CRDT vector clocks — flat timestamps are sufficient because the server is the single arbiter.
- **Binary frame playback.** The store holds `mockFrames: Float32Array[]` — each frame is a full 8k-slot snapshot. Timeline scrubbing just swaps the active frame index. Live mode = `mockFrames[0]` mutated in place.
- **BVH with `maxLeafTris: 1`.** (Landing in Task #1.) The picking/lasso index uses three-mesh-bvh with one proxy triangle per slot, sized to match the rendered sphere's bounding box. `triangleIndex === slotIndex` by construction. Rebuild is lazy (dirty flag), not per-frame — a 60 fps scrub would otherwise burn ~120 ms/sec on BVH builds.

### Day-1 vs. current

The Day-1 prototype encoded meaning along three labeled semantic axes — Categorical Vector (X), Temporal Scale (Y), Emotional Valence (Z) — with text labels attached directly to nodes. Commit `8767217` ("Spherical Fibonacci Defense") pivoted to the current foveated-shells model to solve a center-knot anomaly and unlock dense packing. The pivot was correct technically but traded *semantic position* (a node's `(x,y,z)` meant something) for *aesthetic geometry* (position now encodes only slot tier + insertion order). Restoring some form of semantic placement within a shell — e.g. cosine-similarity ordering — is on the roadmap, not the current build. Future sessions: do not try to reinvent the original axes.

## Gotchas

- **`NodeCloud.tsx` still exists but is not mounted.** `Scene.tsx` only renders `SaccadeInstancedMesh`. Don't add features to `NodeCloud` — it's dead code on the render path even though the file lives in the tree. Task #1 will delete the file.
- **BVH proxy bounding radius must be `0.15 * scale`.** `SaccadeInstancedMesh` uses `SphereGeometry(1, 8, 8)` scaled by `scale * 0.15 * popMul`. Any other multiplier desyncs picking from visuals. This invariant lands with Task #1's BVH index.
- **`vacantSlots` is currently a single global FIFO across all 8k slots.** Dream churn can evict facts — broken by the cognitive metaphor. Task #3 introduces per-tier caches with promotion-on-reinforcement to fix this.
- **`mockFrames[activeFrameIndex]` is mutated in place during live mode.** Don't `set({mockFrames: ...})` from a useFrame loop — Zustand re-renders will tank the frame rate. Mutate the Float32Array directly and let `SaccadeInstancedMesh` re-read it each tick.
- **ONNX worker is a HMR singleton — re-running `pnpm dev` keeps the worker alive but a hard reload re-downloads the 25 MB model.** Intentional; don't "fix" it without a plan.
- **Server `client !== ws` is the source of truth for echo prevention.** Removing it would flood every client with its own broadcasts. The client-side peerId check that used to back this up has been deleted on purpose.
- **Spawn-time sentinel.** `spawnTime[i] === 0` means "no starburst animation," not "spawned at t=0." Reclaimers must zero the slot on prune, and seed paths must zero the whole array, or stale pops will fire on the wrong slots.
- **`OnnxWorker.onStatusChange` has a SINGLE owner.** SyncCore subscribes to drive the ENGINE pill. Do NOT register a second handler in another component — the last writer silently wins and you'll lose the pill. If another consumer needs status, poll `OnnxWorker.currentStatus` instead (App does this on a 1 s interval to surface ERROR/READY transitions into the event ring).
- **`OnnxWorker.initialize()` must be called once at boot** (it is, from `App.useEffect`). Without it, every `OnnxWorker.classify()` silently falls back to a keyword heuristic — injections succeed and look fine, but the model never runs. Don't remove the initialize call.
- **All phrase injection must go through `injectPhrase`.** The console, ticker, and `/axioms` re-seed all use it. New entry points (file ingestion, peer-driven injects, etc.) must too — otherwise the ONNX single-in-flight constraint races and the HUD event ring loses canonical SPAWN/EVICT/PROMOTE typing.
- **Boot seed is empty by design.** The lattice boots with no synchronous node dump — only the dim ghost scaffold is visible. The ThoughtTicker injects the 7 axioms then drips the corpus — the lattice grows organically. If you re-add a synchronous boot dump, you'll bypass the ontology path and the ghost-scaffold-reveal effect.
- **Vitest suite pins invariants, not coverage.** `pnpm test` exercises geometry (foveation radius, golden angle, tier contiguity, no-Z-stride), per-tier FIFO isolation + tier-scoped eviction, the decay-vs-replay gate, and the 28-byte CRVM/LWW protocol (including a tripwire that the packet has no embedded peerId/composite clock). New tests should correspond to a decision worth defending — not coverage theater. The 28-byte arbitration logic lives in `artifacts/api-server/src/lib/lww.ts` so the server and the tests share one wire-format module.

## Roadmap

Not in the current build; sequenced for future tasks:

- **Per-tier caches with promotion-on-reinforcement** (Task #3) — replaces the global FIFO. Each ontology tier gets its own size cap, decay rate, and reinforcement counter; promoted nodes migrate inward with an animation.
- **BVH spatial index over the 8k mesh and a functional lasso path** (Task #1) — the current lasso lives on the legacy (unmounted) `NodeCloud` component, so lasso is effectively non-functional today. The "BVH Raycast" tagline in the app header is aspirational until Task #1 lands.
- **Visible synapse edges** — line segments drawn between semantically related nodes, restoring the "connective tissue" metaphor from Day-1.
- **Semantic placement within a shell** — order nodes inside a tier by cosine similarity to a tier-anchor instead of by Fibonacci insertion index.
- **Log-polar (cortical-magnification) cell-sizing** — vary a slot's resolvable cell size by radius (small at the core, large at the rim) so the densest core stays within a VLM's spatial-acuity budget `M = (R/s)²` and never needs zoom — while *preserving* the foveal density gradient (Foveal Gradient Integrity). First step is measuring the acuity constant `s` empirically via a confirmation/validation harness. See [`docs/roadmap/log-polar-cell-sizing.md`](./docs/roadmap/log-polar-cell-sizing.md).
- **Text labels on the lattice** — billboarded sprites that show the source phrase on hover, like Day-1.
- **Multimedia ingestion** — video/audio frames embedded into the lattice via a separate ingestion worker. Requires a new frame embedding model and a sidecar payload format.
- **Serializable "context ground" export** — a single binary another AI loads to inherit the whole memory including the source text. Today the 28-byte stride carries position + scale + color but no text. Needs a parallel text-payload binary (or sidecar JSON) referenced by slot index.
- **Persistence** (`sovereign_save_key.bin`) — write the in-memory tapestry to disk; user-confirmed deferred.
- **CKKS / TenSEAL homomorphic export** — the `10000.0` cleartext-matrix scale is reserved for this. (Historical: an earlier `5.0` per-tier Z-stride existed as local-render decoration to fan tiers into 5 flat layers; it was removed when the lattice was unified into one continuous 3D sphere. Do not reintroduce it.)

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- See `.local/tasks/` for the current task plans.
- See `attached_assets/` for the NotebookLM conversation transcripts that drove early architecture decisions. Treat these as historical context, not authoritative — the canonical source of truth is this file plus the current code.

## Aerospace HUD (Task #11)

The UI is laid out as an EFIS-style telemetry suite around the 3D lattice. Six fixed cards plus an invisible ticker:

- **INVARIANTS strip** (top-center) — five dots: `STRIDE / TIERS / FIFO / BVH / FOVEA`. Green = nominal, red = the grounding-file format just broke. The legacy `useStore.nodes` graph has been retired, so the VRAM frame buffer is the single source of truth — there is no longer a `parity` dot, because there is no second graph left to drift against.
- **SYNC CORE** (top-left) — LINK (sync/local), ENGINE (DL/WARM/READY/ERR), packets ↓↑ with /s rate, TICKER auto/paused + cadence + Σ fired, FPS.
- **ONTOLOGY** (top-right) — per-tier hairline bars with occupancy/cap, decay λ, rolling 10-s spawn (+) / evict (−) counts pulled from the event ring.
- **COMMAND CONSOLE** (bottom-left of center) — manual phrase input + slash commands: `/help /pause /resume /rate <ms> /axioms /invariants /events /why <slot> /lasso /blast /clear`. Free text routes through `injectPhrase` (the same path the ticker uses).
- **EVENT STREAM** (bottom-right) — newest-first view of the 500-cap event ring with HH:MM:SS.ms timestamps. Event types: `SPAWN / REINFORCE / PROMOTE / EVICT / LWW_REJECT / LOW_CONF / INVARIANT_FAIL / AXIOM / INFO / PAUSE / RESUME / ERROR`.
- **CAMERA · RENDERER** (above the timeline, left side) — pos/dist/fov + draw calls + tris.
- **SACCADE TIMELINE** (full-width bottom strip) — frame scrubber; drop a `.bin` to load. Same component as before, restyled to aerospace tokens.

### Organic growth (axiom seed + thought ticker)

The lattice now starts visually empty (only the dim ghost scaffold visible). After ~1.5 s the **ThoughtTicker** injects the 7 axioms (600 ms gap), then enters a jittered loop drawing from `PHRASE_CORPUS` (default 3 s ±1 s, adjustable via `/rate`). Every injection — axiom, ticker, or console — funnels through `injectPhrase`, so the **ONNX single-in-flight constraint is honored automatically** (Promise chain serializes all callers). The ticker also auto-pauses while `ticker.busy` is true.

### Visual tokens (`components/hud/tokens.ts`)

Aerospace EFIS palette — `bg rgba(8,10,12,0.88)`, `border #2a3338`, `text #c6cdd1`, `nominal #6dd99e`, `warn #e2a458`, `fail #d75f5f`, `accent #4fd1c5`. JetBrains/Share Tech Mono. 1 px hairlines, 2 px radii max, no shadows. Cards lean on legibility — the lattice provides the spectacle, the HUD provides the dial.

## User preferences

- Audit NotebookLM pastes against the current codebase before applying. They are useful spec drafts but have shipped real bugs in the past (e.g. a `vacantSlots` dedup that collapsed FIFO ordering; a `THREE.Frustum`-based lasso that can't represent a polygon). Never paste a code block from `attached_assets/` verbatim without verifying it against the actual files.
- Keep architectural decisions in this file as they're made, not in scattered chat history.
- **When reviewing protocol-adjacent NotebookLM pastes, state the four wire-format invariants explicitly up front** (28-byte packet, no embedded peerId, no composite clock, single Float64 LWW timestamp). These four claims keep getting "upgraded" in pastes; surface them as a checklist before triaging any other claim in the paste so the comparison is unambiguous.
- **Treat the vision as load-bearing intent, not commentary.** The optical-compression / foveal-VLM-consumer framing and the Fact→Dream scientific-method tier epistemology are the *reason* the geometry is shaped the way it is. NotebookLM elaborations of the vision should be evaluated as vision elaborations (do they sharpen the framing? do they suggest a real roadmap item?) rather than dismissed as drift just because they don't already appear in code. The wire-format invariants above are the hard line; the vision is the soft anchor — both are protected.
- **When several designs are viable, choose the one closest to biology, physics, or mathematical law.** This is the project's default tie-breaker, not a slogan. The existing wins already obey it: golden-angle Fibonacci packing (phyllotaxis + the most-irrational-number result), √index foveation (constant-area annuli), log-polar cell-sizing (cortical magnification). Two fences keep the compass operational: (a) the wire-format invariants stay the hard line if a biological flourish ever tensions with them, and (b) empirical constants like the VLM acuity `s` come from *measurement*, not derivation — biology/physics give the form, confirmation runs give the number.
