# RCMT Platinum Monolith — Radial Cognitive Memory Tapestry

## Vision

RCMT is an **optical-compression grounding substrate** for downstream AI consumers. Instead of storing meaning as high-dimensional embeddings in a vector database, it stores meaning as **positions in a 3D foveated lattice** that a vision-capable model reads the same way a human eye reads a scene — **foveally**: dense, high-confidence regions first, sparse peripheral regions as context. The Fact→Dream tier gradient encodes a **scientific-method epistemology** directly into the geometry: irreducible Facts sit at the dense core (highest foveal weight), speculative Dreams disperse to the sparse rim (lowest). A model scanning the lattice inherits the epistemic prior for free — the shape *is* the meaning.

The whole 8,000-slot tapestry fits in **224 KB on the wire** and is byte-stable across model upgrades because no embedding lives in the substrate. Conventional RAG drifts when re-embedded; RCMT cannot drift, because positions are deterministic from slot index + insertion order. Capacity is constant by construction (8,000 slots forever), so the binary doesn't bloat over a year of use. Five runtime invariants and a vitest tripwire suite physically prevent the wire format from changing — drift is observable, not silent.

This is meant to behave like a brain's visual cortex reading a memory hierarchy: dense, append-only, peer-mergeable, picked up mid-thought by any agent that loads the binary.

## Positioning

RCMT is a **licensable product**, not OSS. Two buyer tiers buy the same artifact: **primary** = frontier AI labs (a research/applied engineer evaluating a grounding substrate that isn't a vector DB and isn't a retraining loop); **secondary** = individual AI devs / indie researchers (sovereign grounding experiments). Pricing/licensing are out of scope here. The downstream **consumer of the substrate is always a VLM** doing foveal scanning of the rendered lattice — the product is the substrate, not the UI (the UI exists to demonstrate it to evaluators). Full positioning: [`docs/positioning.md`](./docs/positioning.md). Human-readable concept breakdown: [`docs/`](./docs/).

### Vision elaborations (soft anchors)

Two doctrines extend the vision without adding new invariants. Both are **soft anchors wrapped around the hard wire-format invariants below — if either ever tensions with an invariant, the invariant wins.** Full doctrine lives in `docs/roadmap/`; the load-bearing one-liners:

- **Mycelial Constellation** — how *many* RCMTs combine: a foveated **federation** (separate byte-stable shards; a query assembles a *transient* cross-shard view), **not fusion** into one binary (which would break the invariants). Keeps three operations distinct: **replication** (same brain, many devices = peer-merge), **federation** (different brains — only *source text* transfers, position bytes never cross brains), **query** (transient composite view). Full doctrine: [`docs/roadmap/mycelial-constellation.md`](./docs/roadmap/mycelial-constellation.md).
- **Multimodal substrate** — how a non-text sense (audio, video, haptics) enters: never on the 28-byte wire, but quantized against a frozen, versioned **codebook** in a **sidecar keyed by slot index**. The five tiers stay **epistemic, not per-sense** (a modality is a sidecar dimension, never a sixth tier or Z-plane); unknown codebook version → drop sidecar, fall back to position-only, never silently remap. Full doctrine: [`docs/roadmap/multimodal-substrate.md`](./docs/roadmap/multimodal-substrate.md).

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

RCMT is a personal cognitive substrate. Input — a typed phrase, a scrubbed `.bin` frame, or a peer broadcast — is classified by a local ONNX model into one of five tiers (**Fact / Scenario / Metric / Theory / Dream**) and injected as one instanced sphere into the 8,000-slot foveated lattice (Facts near the core, Dreams at the rim); spawning is a 250 ms starburst, and memory pressure recycles dead slots via per-tier FIFO. Every mutation broadcasts as a 28-byte Last-Writer-Wins packet; a scrubbable timeline replays history from any binary frame buffer. Human-readable breakdown: [`docs/`](./docs/) (start with [`what-is-rcmt.md`](./docs/what-is-rcmt.md)).

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

- **28-byte CRVM stride** (Cognitive Realtime VRAM Mutation). `[nodeIndex u16][intentId u16][x f32][y f32][z f32][scale f32][lwwTimestamp f64]`. peerId is *not* in the packet — the server assigns it via a JSON `HELLO` frame and prevents self-echoes by sender-exclusion (the client-side peerId check was deleted). Rationale: [`docs/why-28-bytes.md`](./docs/why-28-bytes.md).
- **`intentId` at bytes 2-3 is reserved**, not yet consumed. Today drag broadcasts write 0. The ONNX classifier produces a slot but the injection-side broadcast path doesn't wire it through yet (follow-up).
- **Unified 3D Fibonacci sphere.** A node's position is a deterministic function of its global slot index. ONE Golden-Angle spiral (137.508°) covers all 8000 slots — by construction no two slots share an angular vector from the origin, so radial collinearity / Z-fighting cannot occur. Radius = `sqrt(slot) * 0.6`: slot 0 sits at the foveated core, slot 7999 at the rim (~53.7). Because tier slot ranges are contiguous (Fact `[0,2000)`, …, Dream `[7000,8000)`), sqrt-growth naturally produces foveated tier shells *without* an explicit per-tier radius table. Replaces an earlier flat-disk spiral that had a "Knot Anomaly" at the center.
- **Optical cost is O(resolution), not O(node count) — the "acuity budget."** A VLM tokenizes by *resolution* (fixed tiles), so one foveal glance costs the same whether 100 or 8,000 slots are populated (the optical-compression win over text-RAG). It collapses only if the dense core out-packs the model's spatial acuity `s` (no-zoom budget `M = (R / s)²` cells; `s` is empirical, never derived). Lawful fix: log-polar cell-sizing, never flatten to uniform density. Full cost model in [`docs/why-foveation.md`](./docs/why-foveation.md).
- **Five-tier slot ontology — color + radial band, not Z.** Every node is Fact / Scenario / Metric / Theory / Dream; the classifier assigns the tier at write time, distinguished by color + natural foveated radial band (sqrt-growth on contiguous index ranges puts Fact at the core, Dream at the rim). **Two constants must never be conflated:** the removed per-tier Z-stride (`5.0`) was local-render decoration; the **`10000.0` cleartext-matrix scale** (`Z_isolated = S × 10000 + Z_local`) is a separate **cloud-side** pre-CKKS transform opening a 40000-unit gap between tiers (prevents cross-tenant spatial hallucinations) that never reaches the R3F viewport. Why five tiers: [`docs/why-five-tiers.md`](./docs/why-five-tiers.md).
- **8,000 nodes hard cap**, single InstancedMesh, single draw call. The whole tapestry fits in 224 KB of typed-array memory at 28 bytes per node. When full, oldest dead slot is recycled via the vacant-slot registry in O(1). This is the "8k kill-switch."
- **Local-only ONNX inference.** The intent classifier runs in a web worker via `@xenova/transformers`; nothing ships to a server. The user's text never leaves their machine.
- **Last-Writer-Wins by lwwTimestamp**, server-arbitrated. The server tracks the latest timestamp per `nodeIndex` and silently drops stale updates. No CRDT vector clocks — flat timestamps are sufficient because the server is the single arbiter.
- **Binary frame playback.** The store holds `mockFrames: Float32Array[]` — each frame is a full 8k-slot snapshot. Timeline scrubbing just swaps the active frame index. Live mode = `mockFrames[0]` mutated in place.
- **BVH with `maxLeafTris: 1`.** The picking/lasso index uses three-mesh-bvh with one proxy triangle per slot, sized to match the rendered sphere's bounding box. `triangleIndex === slotIndex` by construction. Rebuild is lazy (dirty flag), not per-frame — a 60 fps scrub would otherwise burn ~120 ms/sec on BVH builds.

### Day-1 vs. current

The Day-1 prototype encoded meaning along three labeled semantic axes (X/Y/Z) with text labels on nodes; commit `8767217` pivoted to the current foveated-shells model. Position now encodes only slot tier + insertion order, not semantics. Future sessions: do not try to reinvent the original axes. Full history: [`docs/day1-vs-current.md`](./docs/day1-vs-current.md).

## Gotchas

The full guardrail detail — 15 non-obvious traps, each with the code path it protects and the test/invariant that pins it — lives in [`docs/gotchas.md`](./docs/gotchas.md) (single source). **Read the relevant entry before touching its code path.** Index of what's covered:

- BVH proxy bounding radius (`0.15 * scale`, `BVH_PROXY_MULT`) — picking/visual sync
- Eviction is per-tier, never global (no single `vacantSlots` queue)
- Outward demotion drift mirrors inward promotion (tier-scoped `decaySweep`)
- Candidate-then-batch loops must revalidate the source (`demoteSlot` guard)
- `mockFrames[activeFrameIndex]` is mutated in place in live mode (no Zustand `set` in `useFrame`)
- ONNX worker is a HMR singleton (hard reload re-downloads the 25 MB model)
- Server `client !== ws` is the echo-prevention source of truth
- Spawn-time sentinel (`spawnTime[i] === 0` ≠ "spawned at t=0")
- `OnnxWorker.onStatusChange` has a SINGLE owner (SyncCore); others poll `currentStatus`
- `OnnxWorker.initialize()` must run once at boot or classify silently falls back to keywords
- All phrase injection must go through `injectPhrase`
- Boot seed is empty by design (ghost scaffold only; ticker grows the lattice)
- Idle auto-pause is `ticker.autoPaused`, NOT `ticker.running` (the two compose)
- `frameloop` is gated on tab visibility only (`hidden`→demand, `visible`→always)
- Vitest suite pins invariants, not coverage (geometry, FIFO, decay-vs-replay, 28-byte CRVM/LWW)

## Roadmap

The canonical, triaged roadmap — **Built / Planned / Rejected**, every rejection carrying a one-line "why" so it can't quietly slip back in — lives in [`docs/roadmap.md`](./docs/roadmap.md), with a one-page spec per planned item under [`docs/roadmap/`](./docs/roadmap/). That file is the single source of truth for build status; this section deliberately no longer duplicates the list (the duplicate copy had already drifted out of date).

Two notes worth keeping inline because they are decisions, not status:

- The **`10000.0` cleartext-matrix scale** is reserved for a future CKKS / TenSEAL homomorphic export. Do not repurpose it.
- The removed **`5.0` per-tier Z-stride** (old local-render decoration fanning tiers into 5 flat layers) must not be reintroduced — the lattice is one continuous 3D sphere now.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
- See `.local/tasks/` for the current task plans.
- See `attached_assets/` for the NotebookLM conversation transcripts that drove early architecture decisions. Treat these as historical context, not authoritative — the canonical source of truth is this file plus the current code.
- Demoted detail (single-source, linked inline above): [`docs/gotchas.md`](./docs/gotchas.md) (the 15 guardrails), [`docs/hud.md`](./docs/hud.md) (full HUD breakdown), [`docs/positioning.md`](./docs/positioning.md) (buyer tiers), [`docs/day1-vs-current.md`](./docs/day1-vs-current.md) (axes history), [`docs/roadmap.md`](./docs/roadmap.md) (build status), and the `docs/why-*.md` rationale set.

## Maintenance

`replit.md` is **always loaded into the agent's system prompt**, so its size is a per-turn tax. Keep it a lean index of load-bearing intent + pointers, not a full manual.

- **Budget: ~6,000 est-tokens** (estimated as `chars / 4`). Enforced *advisorily* by `scripts/src/check-replitmd-size.ts` (npm: `pnpm --filter @workspace/scripts run check-replit-md`), wired into `scripts/post-merge.sh`. The check **never fails the build** — it only prints a warning when over budget, as a nudge to run a trim pass. The `chars/4` proxy slightly *under*-counts vs a real BPE tokenizer (~3.5 chars/token here), so staying under the proxy budget keeps the real token count near ~6k.
- **Keep inline (never demote):** the four wire-format invariants, Foveal Gradient Integrity, Run & Operate, Where things live, Stack, and User preferences. These are the always-needed guardrails + orientation.
- **Safe to demote to a `docs/*.md` file with a pointer:** deep gotcha detail, per-decision architecture rationale, HUD/UI breakdowns, positioning/go-to-market prose, and historical narrative (e.g. Day-1 vs current). Leave behind a one-line index entry + a link so nothing is lost.
- **Single-source rule:** demoted content lives in **exactly one** place (the `docs/` file). `replit.md` keeps only a summary/index + pointer — never a second copy that can drift. Build status lives only in `docs/roadmap.md`; do not re-list it here.
- **When you exceed budget:** run a demote pass (pick the largest non-keep-list block, move its detail to `docs/`, leave an index+pointer) rather than deleting guardrails.

## Aerospace HUD

The UI is an EFIS-style telemetry suite around the 3D lattice — six fixed cards (Invariants strip, Sync Core, Ontology, Command Console, Event Stream, Camera·Renderer) plus a full-width Saccade timeline and an invisible ThoughtTicker. All of it is render-/telemetry-side chrome; it pins no runtime invariant. Full breakdown — card-by-card layout, organic-growth seeding, visual tokens, guided/aerospace mode (Task #20), and the legible-UI pieces (Task #23): [`docs/hud.md`](./docs/hud.md).

## User preferences

- Audit NotebookLM pastes against the current codebase before applying. They are useful spec drafts but have shipped real bugs in the past (e.g. a `vacantSlots` dedup that collapsed FIFO ordering; a `THREE.Frustum`-based lasso that can't represent a polygon). Never paste a code block from `attached_assets/` verbatim without verifying it against the actual files.
- Keep architectural decisions in this file as they're made, not in scattered chat history.
- **When reviewing protocol-adjacent NotebookLM pastes, state the four wire-format invariants explicitly up front** (28-byte packet, no embedded peerId, no composite clock, single Float64 LWW timestamp). These four claims keep getting "upgraded" in pastes; surface them as a checklist before triaging any other claim in the paste so the comparison is unambiguous.
- **Treat the vision as load-bearing intent, not commentary.** The optical-compression / foveal-VLM-consumer framing and the Fact→Dream scientific-method tier epistemology are the *reason* the geometry is shaped the way it is. NotebookLM elaborations of the vision should be evaluated as vision elaborations (do they sharpen the framing? do they suggest a real roadmap item?) rather than dismissed as drift just because they don't already appear in code. The wire-format invariants above are the hard line; the vision is the soft anchor — both are protected.
- **When several designs are viable, choose the one closest to biology, physics, or mathematical law.** This is the project's default tie-breaker, not a slogan. The existing wins already obey it: golden-angle Fibonacci packing (phyllotaxis + the most-irrational-number result), √index foveation (constant-area annuli), log-polar cell-sizing (cortical magnification). Two fences keep the compass operational: (a) the wire-format invariants stay the hard line if a biological flourish ever tensions with them, and (b) empirical constants like the VLM acuity `s` come from *measurement*, not derivation — biology/physics give the form, confirmation runs give the number.
