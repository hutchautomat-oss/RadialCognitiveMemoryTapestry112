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

### Vision elaboration — the Mycelial Constellation (soft anchor)

A single RCMT is one brain. Any real user ends up with **many** — the same brain on several devices, and different brains for different projects that still share context. The **Mycelial Constellation** is the doctrine for how they combine: a fractal, foveated **federation** (substrates stay separate, byte-stable shards; a query assembles a *transient* cross-shard view) — explicitly **not fusion** into one bigger binary, which would break the wire-format invariants below. The keystone is fractal foveation: a VLM scans a constellation the same way it scans one lattice — dense core first, sparse rim as context — one altitude up.

This is a vision elaboration (soft anchor), not a new invariant. Its main job is to separate three operations the word "stitch" conflates:

- **Replication** — *same brain, many devices.* The existing WebSocket peer-merge (same-slot collision resolution, broadcasting injections to every peer's tapestry). "Many editors, one brain." This is the intra-brain layer, **not** the federation answer.
- **Federation / composition** — *different brains, related context.* A manifest graph index of pointers above the binaries, plus lateral transfer of **source text** (re-classified into the recipient's *own* local slot — position bytes never cross brains).
- **Query / database** — *federated shards.* A router scans the relevant shard(s) for a query; a transient composite view is not storage fusion (same as a federated SQL query is not a table merge).

Full doctrine, the five mechanism-first layers, the DNA-stacking rejection, and the open cross-brain semantic-reconciliation problem: [`docs/roadmap/mycelial-constellation.md`](./docs/roadmap/mycelial-constellation.md).

### Vision elaboration — multimodal substrate (soft anchor)

RCMT's input today is text, but the substrate is meant to ground *any* sense (audio, video, haptics). The doctrine: a non-text sense never rides the 28-byte wire — it is quantized against a frozen, versioned **codebook** and stored in a **sidecar keyed by slot index**. The five tiers stay **epistemic, not per-sense** (a "Fact" sound and a "Fact" phrase share a tier and radial band; modality is sidecar metadata, never a sixth tier and never a Z-plane). Codebooks are immutable / append-only / version-keyed; a client meeting an unknown version drops the sidecar payload and falls back to position-only — never silently remaps. This resolves the federation hand-off: **a modality is a sidecar dimension, not a tapestry boundary**, so tapestries are scoped per-agent / per-domain, never per-sense. Like the Mycelial Constellation, this is a soft anchor wrapped around the hard wire-format invariants below — if any of it ever tensions with an invariant, the invariant wins. Full doctrine: [`docs/roadmap/multimodal-substrate.md`](./docs/roadmap/multimodal-substrate.md).

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

RCMT is a personal cognitive substrate. Input — a typed phrase, a scrubbed `.bin` frame, or a peer broadcast — is classified by a local ONNX model into one of five tiers (**Fact / Scenario / Metric / Theory / Dream**) and injected as one instanced sphere into the 8,000-slot foveated lattice (Facts near the core, Dreams at the rim); spawning is a 250 ms starburst, and memory pressure recycles dead slots via per-tier FIFO. Every mutation broadcasts as a 28-byte Last-Writer-Wins packet; a scrubbable timeline replays history from any binary frame buffer.

The human-readable breakdown lives in [`docs/`](./docs/) (start with [`what-is-rcmt.md`](./docs/what-is-rcmt.md)). The *why* behind the shape — optical compression, the foveal VLM consumer, the Fact→Dream epistemology — is in the Vision / Positioning and Architecture-decisions sections of this file.

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
- **BVH with `maxLeafTris: 1`.** The picking/lasso index uses three-mesh-bvh with one proxy triangle per slot, sized to match the rendered sphere's bounding box. `triangleIndex === slotIndex` by construction. Rebuild is lazy (dirty flag), not per-frame — a 60 fps scrub would otherwise burn ~120 ms/sec on BVH builds.

### Day-1 vs. current

The Day-1 prototype encoded meaning along three labeled semantic axes — Categorical Vector (X), Temporal Scale (Y), Emotional Valence (Z) — with text labels attached directly to nodes. Commit `8767217` ("Spherical Fibonacci Defense") pivoted to the current foveated-shells model to solve a center-knot anomaly and unlock dense packing. The pivot was correct technically but traded *semantic position* (a node's `(x,y,z)` meant something) for *aesthetic geometry* (position now encodes only slot tier + insertion order). Restoring some form of semantic placement within a shell — e.g. cosine-similarity ordering — is on the roadmap, not the current build. Future sessions: do not try to reinvent the original axes.

## Gotchas

- **BVH proxy bounding radius must be `0.15 * scale` (`BVH_PROXY_MULT`).** `SaccadeInstancedMesh` uses `SphereGeometry(1, 8, 8)` scaled by `scale * 0.15 * popMul`. Any other multiplier desyncs picking from visuals — pinned by the `bvh_proxy` invariant.
- **Eviction is per-tier, never global.** `vacantSlotsByTier` gives each ontology tier its own FIFO + decay λ, so Dream churn can never evict Facts. Do NOT reintroduce a single global `vacantSlots` queue — it silently re-breaks the cognitive metaphor (per-tier eviction is pinned by the vitest FIFO-isolation tests).
- **Outward demotion drift is the mirror of inward promotion.** `decaySweep` relocates unreinforced, faded-but-not-dead non-Dream slots (`HEALTH_DEATH ≤ health < HEALTH_DEMOTE`, `reinforcementCount === 0`, not mid-flight) ONE tier outward via `demoteSlot` (bounded by `MAX_DEMOTE_PER_SWEEP`), making capacity pressure shed toward the rim instead of just dying. Demotion stays tier-scoped (only evicts within the *destination* tier), so "Dream churn can never evict Facts" still holds, and Dream (tier 5) never demotes (no outer shell). The render path flashes warm/amber for outward drift vs cyan for inward promotion, distinguished purely by `toR > fromR` — no new state array, no 60 Hz Zustand writes.
- **Candidate-then-batch loops must revalidate the source.** `decaySweep` collects demotion candidates in one pass then relocates in a loop; an earlier relocation can free or re-occupy a later candidate's slot. `demoteSlot` guards `mass[src] > 0 && animStartTime[src] === 0` and returns null otherwise — without it a stale slot is double-processed (corrupting `tierCounts`/FIFO) or a node drifts two tiers in one sweep. Pinned by the "drifts at most ONE tier per sweep" vitest test.
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

The canonical, triaged roadmap — **Built / Planned / Rejected**, every rejection carrying a one-line "why" so it can't quietly slip back in — lives in [`docs/roadmap.md`](./docs/roadmap.md), with a one-page spec per planned item under [`docs/roadmap/`](./docs/roadmap/). That file is the single source of truth for build status; this section deliberately no longer duplicates the list (the duplicate copy had already drifted out of date).

Two notes worth keeping inline because they are decisions, not status:

- The **`10000.0` cleartext-matrix scale** is reserved for a future CKKS / TenSEAL homomorphic export. Do not repurpose it.
- The removed **`5.0` per-tier Z-stride** (old local-render decoration fanning tiers into 5 flat layers) must not be reintroduced — the lattice is one continuous 3D sphere now.

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

### Guided vs. aerospace mode (Task #20)

The HUD has two presentation modes, switched by the `AERO / GUIDED` toggle pinned top-right (just left of the Ontology card). **Mode is pure chrome — it never touches telemetry, invariants, the ticker, or the injection pipeline; aerospace mode is byte-identical to before this task.**

- **AEROSPACE** (default) — the dense EFIS surface for power users. Terse code titles, no help affordances.
- **GUIDED** — for a first-time evaluator. Each card title renders `"{EFIS} · {plainTitle}"` (e.g. `SYNC CORE · Network & Engine`) and grows a `?` button that toggles a ~2-sentence plain-English help popover. The Invariants strip gets the same treatment manually (it's not a `HudCard`).
- Mode persists to `localStorage` key `rcmt:hud:mode:v1` via `useHudStore.setHudMode`. The store reads it once at module load.
- **`HudOnboarding`** is a five-panel walkthrough (ghost scaffold → axiom seed → ticker drip → tier legend → invariants). It auto-opens on first load (no mode key set) and is re-openable any time via the `/tour` console command. Dismiss semantics set the mode preference: **Done → GUIDED**, **Skip on a true first run → AEROSPACE**, **Skip when a preference already exists → unchanged**. `hudModePreferenceExists()` (exported from `useHudStore`) gates that last case.
- `plainTitle` / `helpText` are optional `HudCard` props — adding a new card to guided mode is just passing those two strings.
- `/help` is now grouped plain-English (Lattice / Ticker / Diagnostics / Help).

### Legible & learnable UI (Task #23)

Goal: let a first-time evaluator infer the Fact→Dream epistemology from the *running* lattice without docs — through color, motion, a "mirror," and hovering any node. All four pieces are **render-/telemetry-side only**; none touch the wire packet, node position, or tier authority (`slotTier[]` stays the source of truth).

- **Tier color-opponency.** Canonical `TIER_RGB` palette in `useSaccadeStore` is the single source of truth for node color (vivid cyan-green Fact → faded violet Dream, saturation ramping down so trust reads as chroma). `injectPhrase` and the promotion recolor read it; `OnnxWorkerManager.SLOT_COLORS/colorForSlot` were deleted. HUD chips (`hud/tokens.ts` `COLOR.tier`) use **muted** variants so the lattice carries the vivid contrast and the dense chrome stays low-chroma. Color only ever writes frame stride `[3,4,5]` — never bytes or position.
- **Promotion traces** (`components/PromotionTraces.tsx`, in-canvas `LineSegments`) draw the inward migration vector while a node is promoted. **Live-mode only** (`!isFileLoaded && activeFrameIndex===0`) — a continuous mutator must never run during binary scrub.
- **Peripheral LWW flash.** `applyRemoteUpdate` pushes each incoming remote update onto a bounded module-level queue (`REMOTE_FLASH_CAP = 64`, drained via `drainRemoteFlashes`). `PeripheralFlashBridge` (in-canvas) projects the mutated slot to the nearest viewport edge; `PeripheralFlash` (DOM) renders a fading edge bar — exploiting peripheral motion sensitivity to pull attention to remote activity. The bridge **throttles before draining** (gate first, then drain) so a throttle window can't silently discard a drained batch.
- **Epistemic-balance mirror** (`hud/EpistemicBalance.tsx`) — a tier-mix bar plus a balance beam that tilts when the live mix is lopsided relative to `IDEAL_COM ≈ 0.42`. Reads `tierCounts` only.
- **Self-narration.** Shared `lib/tierNarration.ts` (`TIER_LABEL` / `TIER_PLAIN` / `TIER_BAND` + helpers) feeds plain-English copy into `/why` (tier, radial-band placement, last-move state), the event-stream detail strings, and a dim line on the hover tooltip.
- **Clock-domain gotcha:** animation timing (`animStartTime`, spawn/promotion) is `performance.now()`; the `/why` "migrating now" check must compare in that same clock, not `Date.now()` (different epochs → silent always-false).

Out of scope (roadmap): semantic intra-shell repositioning, federation/codebook/wire-format changes, Gestalt clustering as new code (delivered implicitly via radial-shell proximity + color similarity).

## User preferences

- Audit NotebookLM pastes against the current codebase before applying. They are useful spec drafts but have shipped real bugs in the past (e.g. a `vacantSlots` dedup that collapsed FIFO ordering; a `THREE.Frustum`-based lasso that can't represent a polygon). Never paste a code block from `attached_assets/` verbatim without verifying it against the actual files.
- Keep architectural decisions in this file as they're made, not in scattered chat history.
- **When reviewing protocol-adjacent NotebookLM pastes, state the four wire-format invariants explicitly up front** (28-byte packet, no embedded peerId, no composite clock, single Float64 LWW timestamp). These four claims keep getting "upgraded" in pastes; surface them as a checklist before triaging any other claim in the paste so the comparison is unambiguous.
- **Treat the vision as load-bearing intent, not commentary.** The optical-compression / foveal-VLM-consumer framing and the Fact→Dream scientific-method tier epistemology are the *reason* the geometry is shaped the way it is. NotebookLM elaborations of the vision should be evaluated as vision elaborations (do they sharpen the framing? do they suggest a real roadmap item?) rather than dismissed as drift just because they don't already appear in code. The wire-format invariants above are the hard line; the vision is the soft anchor — both are protected.
- **When several designs are viable, choose the one closest to biology, physics, or mathematical law.** This is the project's default tie-breaker, not a slogan. The existing wins already obey it: golden-angle Fibonacci packing (phyllotaxis + the most-irrational-number result), √index foveation (constant-area annuli), log-polar cell-sizing (cortical magnification). Two fences keep the compass operational: (a) the wire-format invariants stay the hard line if a biological flourish ever tensions with them, and (b) empirical constants like the VLM acuity `s` come from *measurement*, not derivation — biology/physics give the form, confirmation runs give the number.
