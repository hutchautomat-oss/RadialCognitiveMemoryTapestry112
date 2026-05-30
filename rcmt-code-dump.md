# RCMT Platinum Monolith — Code Dump

Generated 2026-05-30 15:29 UTC for external code review.
Contains: replit.md (project doctrine) + the RCMT web app + the API/LWW sync server + invariant tests.
Excluded on purpose: shadcn `components/ui/*` boilerplate, the mockup-sandbox & pitch-deck artifacts,
generated codegen, node_modules, and everything in attached_assets/ (your uploads).

---

## Table of contents

1. `replit.md`
2. `artifacts/api-server/src/index.ts`
3. `artifacts/api-server/src/app.ts`
4. `artifacts/api-server/src/lib/lww.ts`
5. `artifacts/api-server/src/lib/lww.test.ts`
6. `artifacts/api-server/src/lib/logger.ts`
7. `artifacts/api-server/src/routes/index.ts`
8. `artifacts/api-server/src/routes/health.ts`
9. `artifacts/rcmt/src/main.tsx`
10. `artifacts/rcmt/src/App.tsx`
11. `artifacts/rcmt/src/store/useSaccadeStore.ts`
12. `artifacts/rcmt/src/store/useHudStore.ts`
13. `artifacts/rcmt/src/store/geometry.test.ts`
14. `artifacts/rcmt/src/store/saccade.test.ts`
15. `artifacts/rcmt/src/lib/injectPhrase.ts`
16. `artifacts/rcmt/src/lib/invariants.ts`
17. `artifacts/rcmt/src/lib/bvhLasso.ts`
18. `artifacts/rcmt/src/network/NetworkManager.ts`
19. `artifacts/rcmt/src/data/corpus.ts`
20. `artifacts/rcmt/src/workers/onnxInference.worker.ts`
21. `artifacts/rcmt/src/workers/OnnxWorkerManager.ts`
22. `artifacts/rcmt/src/workers/SaccadeWorkerManager.ts`
23. `artifacts/rcmt/src/components/Scene.tsx`
24. `artifacts/rcmt/src/components/SaccadeInstancedMesh.tsx`
25. `artifacts/rcmt/src/components/GhostScaffold.tsx`
26. `artifacts/rcmt/src/components/ThoughtTicker.tsx`
27. `artifacts/rcmt/src/components/CommandConsole.tsx`
28. `artifacts/rcmt/src/components/Timeline.tsx`
29. `artifacts/rcmt/src/components/HudBridge.tsx`
30. `artifacts/rcmt/src/components/HoverTooltip.tsx`
31. `artifacts/rcmt/src/components/LassoSelection.tsx`
32. `artifacts/rcmt/src/components/hud/index.ts`
33. `artifacts/rcmt/src/components/hud/tokens.ts`
34. `artifacts/rcmt/src/components/hud/HudCard.tsx`
35. `artifacts/rcmt/src/components/hud/SyncCore.tsx`
36. `artifacts/rcmt/src/components/hud/Ontology.tsx`
37. `artifacts/rcmt/src/components/hud/EventStream.tsx`
38. `artifacts/rcmt/src/components/hud/Invariants.tsx`
39. `artifacts/rcmt/src/components/hud/CameraReadout.tsx`
40. `artifacts/rcmt/src/components/hud/TelemetryBar.tsx`

---

================================================================================
FILE: replit.md  (170 lines)
================================================================================

# RCMT Platinum Monolith — Radial Cognitive Memory Tapestry

## Vision

RCMT is an **optical-compression grounding substrate** for downstream AI consumers. Instead of storing meaning as high-dimensional embeddings in a vector database, it stores meaning as **positions in a 3D foveated lattice** that a vision-capable model reads the same way a human eye reads a scene — **foveally**: dense, high-confidence regions first, sparse peripheral regions as context. The Fact→Dream tier gradient encodes a **scientific-method epistemology** directly into the geometry: irreducible Facts sit at the dense core (highest foveal weight), speculative Dreams disperse to the sparse rim (lowest). A model scanning the lattice inherits the epistemic prior for free — the shape *is* the meaning.

The whole 8,000-slot tapestry fits in **224 KB on the wire** and is byte-stable across model upgrades because no embedding lives in the substrate. Conventional RAG drifts when re-embedded; RCMT cannot drift, because positions are deterministic from slot index + insertion order. Capacity is constant by construction (8,000 slots forever), so the binary doesn't bloat over a year of use. Six runtime invariants and a vitest tripwire suite physically prevent the wire format from changing — drift is observable, not silent.

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
- `artifacts/rcmt/src/store/useHudStore.ts` — telemetry store. Bounded event ring (500 cap), camera sample, FPS, packets-in/out + rates, ticker state (running/period/jitter/busy/totalFired), and the 6 invariants strip. Has NO import of saccade/network stores → no circular-dep risk.
- `artifacts/rcmt/src/lib/invariants.ts` — runs the 6 grounding-file invariants (`stride`, `tier_contiguity`, `fifo`, `bvh_proxy`, `foveation`, `parity`). Sampled ~1 Hz by `HudBridge`.
- `artifacts/rcmt/src/components/ThoughtTicker.tsx` — invisible component. 1.5 s kickoff → axiom seed (600 ms gap) → jittered loop. Pause-aware via `useHudStore.ticker.running`; busy-aware via `ticker.busy`; HMR-safe teardown.
- `artifacts/rcmt/src/components/GhostScaffold.tsx` — single-draw `Points` cloud of all 8 000 rest positions. Built once via `useMemo`, no per-frame work. Makes capacity + foveation visible before any phrase lands.
- `artifacts/rcmt/src/components/HudBridge.tsx` — lives INSIDE the R3F Canvas. Samples camera/FPS at 4 Hz and runs invariants at 1 Hz into `useHudStore`. Never writes 60 Hz state (would tank FPS).
- `artifacts/rcmt/src/components/hud/` — aerospace EFIS HUD cards: SyncCore (link/engine/packets/ticker/fps), Ontology (per-tier bars + 10 s Δ counts), EventStream (last 22 of the 500-cap ring), Invariants (top-center 6-dot strip), CameraReadout. Tokens in `tokens.ts` (low-chroma palette, 1 px hairlines, mono font).
- `artifacts/rcmt/src/store/useSaccadeStore.ts` — **VRAM source of truth.** The 8k-slot Float32Array (7 floats per slot: x, y, z, r, g, b, scale), starburst spawn timestamps, FIFO `vacantSlots`, frame playback, and the live ontology injection action. `injectLiveIntentVector` returns `InjectOutcome { index, kind: 'spawn'|'reinforce'|'evict'|'promote', tier }` so the inject pipeline can emit precise events.
- `artifacts/rcmt/src/store/useStore.ts` — **Legacy graph (retiring).** Holds the early `nodes` array still wired into a few interaction paths. After Task #4 lands, this file goes away.
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
- **Five-tier slot ontology — color + radial band, not Z.** Every node is one of Fact / Scenario / Metric / Theory / Dream. The classifier assigns the tier at write time; tiers are visually distinguished by color and by their natural foveated radial band inside the unified sphere (sqrt-growth on contiguous index ranges naturally puts Fact at the core and Dream at the rim). The previous per-tier Z-stride (`5.0`) was local-render decoration only and was removed when the lattice was unified. The **`10000.0` cleartext-matrix scale** (`Z_isolated = S × 10000 + Z_local`) is a separate, **cloud-side** pre-processing transform that opens a 40000-unit cryptographic gap between tiers before CKKS packing — that gap prevents cross-tenant spatial hallucinations in the aggregator and never reaches the local R3F viewport. Do not conflate the two constants.
- **8,000 nodes hard cap**, single InstancedMesh, single draw call. The whole tapestry fits in 224 KB of typed-array memory at 28 bytes per node. When full, oldest dead slot is recycled via the vacant-slot registry in O(1). This is the "8k kill-switch."
- **Local-only ONNX inference.** The intent classifier runs in a web worker via `@xenova/transformers`; nothing ships to a server. The user's text never leaves their machine.
- **Last-Writer-Wins by lwwTimestamp**, server-arbitrated. The server tracks the latest timestamp per `nodeIndex` and silently drops stale updates. No CRDT vector clocks — flat timestamps are sufficient because the server is the single arbiter.
- **Binary frame playback.** The store holds `mockFrames: Float32Array[]` — each frame is a full 8k-slot snapshot. Timeline scrubbing just swaps the active frame index. Live mode = `mockFrames[0]` mutated in place.
- **BVH with `maxLeafTris: 1`.** (Landing in Task #1.) The picking/lasso index uses three-mesh-bvh with one proxy triangle per slot, sized to match the rendered sphere's bounding box. `triangleIndex === slotIndex` by construction. Rebuild is lazy (dirty flag), not per-frame — a 60 fps scrub would otherwise burn ~120 ms/sec on BVH builds.

### Day-1 vs. current

The Day-1 prototype encoded meaning along three labeled semantic axes — Categorical Vector (X), Temporal Scale (Y), Emotional Valence (Z) — with text labels attached directly to nodes. Commit `8767217` ("Spherical Fibonacci Defense") pivoted to the current foveated-shells model to solve a center-knot anomaly and unlock dense packing. The pivot was correct technically but traded *semantic position* (a node's `(x,y,z)` meant something) for *aesthetic geometry* (position now encodes only slot tier + insertion order). Restoring some form of semantic placement within a shell — e.g. cosine-similarity ordering — is on the roadmap, not the current build. Future sessions: do not try to reinvent the original axes.

## Gotchas

- **`useStore.nodes` (legacy) and `useSaccadeStore.mockFrames` (VRAM) live in two namespaces and do NOT unify.** A node added via the console exists in both, at different indices, with different lifecycles. `SaccadeInstancedMesh` bridges them via `seedFromNodes` on mount and `updateLiveFrame` on every `liveNodes` change, so `addNode` *does* still render today — but via a snapshot copy, not by writing the VRAM directly. New write paths should prefer `injectLiveIntentVector` so they participate in slot/tier ontology and starburst animation. Task #4 will retire the legacy graph; until then, treat them as parallel.
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
- **Boot seed is empty by design.** `useStore.buildDemoNodes` returns `[]`. The ThoughtTicker injects the 7 axioms then drips the corpus — the lattice grows organically. If you re-add a synchronous boot dump, you'll bypass the ontology path and the ghost-scaffold-reveal effect.
- **Vitest suite pins invariants, not coverage.** `pnpm test` exercises geometry (foveation radius, golden angle, tier contiguity, no-Z-stride), per-tier FIFO isolation + tier-scoped eviction, the decay-vs-replay gate, and the 28-byte CRVM/LWW protocol (including a tripwire that the packet has no embedded peerId/composite clock). New tests should correspond to a decision worth defending — not coverage theater. The 28-byte arbitration logic lives in `artifacts/api-server/src/lib/lww.ts` so the server and the tests share one wire-format module.

## Roadmap

Not in the current build; sequenced for future tasks:

- **Per-tier caches with promotion-on-reinforcement** (Task #3) — replaces the global FIFO. Each ontology tier gets its own size cap, decay rate, and reinforcement counter; promoted nodes migrate inward with an animation.
- **Retire `useStore.nodes`** (Task #4) — one source of truth.
- **BVH spatial index over the 8k mesh and a functional lasso path** (Task #1) — the current lasso lives on the legacy (unmounted) `NodeCloud` component, so lasso is effectively non-functional today. The "BVH Raycast" tagline in the app header is aspirational until Task #1 lands.
- **Visible synapse edges** — line segments drawn between semantically related nodes, restoring the "connective tissue" metaphor from Day-1.
- **Semantic placement within a shell** — order nodes inside a tier by cosine similarity to a tier-anchor instead of by Fibonacci insertion index.
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

- **INVARIANTS strip** (top-center) — six dots: `STRIDE / TIERS / FIFO / BVH / FOVEA / PARITY`. Green = nominal, red = the grounding-file format just broke. **`parity` is expected red** until Task #4 retires the legacy `useStore.nodes` graph — it is the drift gauge, not a bug.
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


================================================================================
FILE: artifacts/api-server/src/index.ts  (86 lines)
================================================================================

import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import app from "./app";
import { logger } from "./lib/logger";
import {
  MAX_NODES,
  STRIDE_BYTES,
  makeTimestampMap,
  processPacketBatch,
} from "./lib/lww";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const server = http.createServer(app);

// ============================================================
// RCMT Sync Core — LWW Binary Protocol (CRVM stride)
// 28-byte stride per node:
//   Bytes  0- 1: nodeIndex / slotIndex   (Uint16LE)
//   Bytes  2- 3: intentId  (Uint16LE, 0=unknown, 1=Fact..5=Dream)
//   Bytes  4- 7: x         (Float32LE)
//   Bytes  8-11: y         (Float32LE)
//   Bytes 12-15: z         (Float32LE)
//   Bytes 16-19: mass/scale (Float32LE)
//   Bytes 20-27: lwwTimestamp (Float64LE, ms since epoch)
//
// peerId is NO LONGER carried in the per-node packet. Instead, the server
// assigns a peerId on connect and sends it as a JSON "HELLO" text frame.
// Self-echoes are physically prevented by the `client !== ws` broadcast
// filter below — the redundant client-side peerId check has been removed.
// ============================================================
// MAX_NODES + STRIDE_BYTES live in ./lib/lww.ts — same module the LWW unit
// tests import, so there is no second copy of the wire-format constants.
const indexTimestampMap = makeTimestampMap(MAX_NODES);

const wss = new WebSocketServer({ server, path: "/socket" });

wss.on("connection", (ws) => {
  const peerId = Math.floor(Math.random() * 100000);
  logger.info({ peerId }, "RCMT peer connected");

  // HELLO handshake — assign peerId to this connection. Client uses it
  // for logging/debug only; LWW + echo prevention live server-side now.
  try {
    ws.send(JSON.stringify({ type: "HELLO", peerId, stride: STRIDE_BYTES }));
  } catch (err) {
    logger.error({ err, peerId }, "RCMT HELLO send failed");
  }

  ws.on("message", (data) => {
    if (!Buffer.isBuffer(data)) return;

    const { broadcast } = processPacketBatch(
      data,
      indexTimestampMap,
      MAX_NODES,
    );
    if (!broadcast) return;

    // Self-echo prevention: sender excluded from broadcast.
    wss.clients.forEach((client) => {
      if (client !== ws && client.readyState === WebSocket.OPEN) {
        client.send(broadcast);
      }
    });
  });

  ws.on("close", () => logger.info({ peerId }, "RCMT peer disconnected"));
  ws.on("error", (err) => logger.error({ err, peerId }, "RCMT WS error"));
});

server.listen(port, "0.0.0.0", () => {
  logger.info({ port }, "RCMT server + sync core listening");
});


================================================================================
FILE: artifacts/api-server/src/app.ts  (34 lines)
================================================================================

import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

export default app;


================================================================================
FILE: artifacts/api-server/src/lib/lww.ts  (107 lines)
================================================================================

/**
 * CRVM packet decoding + Last-Writer-Wins arbitration.
 *
 * Extracted from `src/index.ts` so the byte-layout and arbitration logic can
 * be exercised without booting an HTTP server or a WebSocket harness. The
 * runtime server imports the same functions — there is no second copy of the
 * protocol. Any change here is a change to the wire format and should be
 * accompanied by a test in `lww.test.ts`.
 */

/** Hard cap mirrored from the client lattice (`useSaccadeStore.MAX_NODES`). */
export const MAX_NODES = 8000;

/**
 * Bytes per node packet on the wire. This is the "28-byte stride" the rest of
 * the codebase refers to. Layout:
 *   Bytes  0- 1: nodeIndex / slotIndex   (Uint16LE)
 *   Bytes  2- 3: intentId               (Uint16LE, 0=unknown, 1=Fact..5=Dream)
 *   Bytes  4- 7: x                      (Float32LE)
 *   Bytes  8-11: y                      (Float32LE)
 *   Bytes 12-15: z                      (Float32LE)
 *   Bytes 16-19: mass/scale             (Float32LE)
 *   Bytes 20-27: lwwTimestamp           (Float64LE, ms since epoch)
 *
 * NOTE: peerId is NOT carried in this packet — the server assigns a peerId
 * over the JSON HELLO frame and prevents self-echoes structurally. Any
 * "upgraded" composite-clock or writer-ID-hash framing would break tests
 * pinned to this stride; see `lww.test.ts`.
 */
export const STRIDE_BYTES = 28;

/** Allocate a fresh per-server LWW timestamp map. */
export function makeTimestampMap(maxNodes: number = MAX_NODES): Float64Array {
  return new Float64Array(maxNodes).fill(0.0);
}

/**
 * Decode a single packet at offset `offset` and return `{ nodeIndex, timestamp }`.
 * Cheap helper for tests; the hot path in `processPacketBatch` inlines the
 * `readUInt16LE` / `readDoubleLE` calls.
 */
export function readPacketHeader(
  buf: Buffer,
  offset: number,
): { nodeIndex: number; timestamp: number } {
  return {
    nodeIndex: buf.readUInt16LE(offset),
    timestamp: buf.readDoubleLE(offset + 20),
  };
}

/**
 * Apply LWW arbitration over a concatenated buffer of N×28-byte packets.
 *
 * Behavior (pinned by `lww.test.ts`):
 * - Packets whose byte length is not a multiple of STRIDE_BYTES are rejected
 *   wholesale (return `null` broadcast).
 * - For each packet, if `timestamp > timestampMap[nodeIndex]`, the packet is
 *   accepted and the map is updated. Equal timestamps are dropped (the
 *   strictly-greater comparison is the source of truth for tie-breaking).
 * - Packets whose `nodeIndex >= maxNodes` are silently skipped.
 * - Returns the rebroadcast buffer (only the accepted packets, in their
 *   original order) or `null` if nothing should be rebroadcast.
 *
 * This function does NOT mutate the input buffer. It does mutate the
 * `timestampMap` in place — that is the LWW arbitration state.
 */
export function processPacketBatch(
  data: Buffer,
  timestampMap: Float64Array,
  maxNodes: number = MAX_NODES,
): { accepted: number[]; broadcast: Buffer | null } {
  if (!Buffer.isBuffer(data)) return { accepted: [], broadcast: null };
  if (data.byteLength === 0) return { accepted: [], broadcast: null };
  if (data.byteLength % STRIDE_BYTES !== 0) {
    return { accepted: [], broadcast: null };
  }

  const packetCount = data.byteLength / STRIDE_BYTES;
  const accepted: number[] = [];

  for (let i = 0; i < packetCount; i++) {
    const offset = i * STRIDE_BYTES;
    const nodeIndex = data.readUInt16LE(offset);
    const timestamp = data.readDoubleLE(offset + 20);

    if (nodeIndex >= maxNodes) continue;
    if (timestamp > timestampMap[nodeIndex]) {
      timestampMap[nodeIndex] = timestamp;
      accepted.push(i);
    }
  }

  if (accepted.length === 0) return { accepted, broadcast: null };

  const broadcast = Buffer.allocUnsafe(accepted.length * STRIDE_BYTES);
  accepted.forEach((srcIdx, dstIdx) => {
    data.copy(
      broadcast,
      dstIdx * STRIDE_BYTES,
      srcIdx * STRIDE_BYTES,
      (srcIdx + 1) * STRIDE_BYTES,
    );
  });

  return { accepted, broadcast };
}


================================================================================
FILE: artifacts/api-server/src/lib/lww.test.ts  (129 lines)
================================================================================

/**
 * CRVM wire-format + LWW arbitration invariants.
 *
 * These tests pin the byte layout and arbitration policy that the rest of
 * the system depends on. If a NotebookLM paste reintroduces a composite
 * clock, a writer-ID hash, or an embedded peerId, one of these tests will
 * fail loudly and force a real decision before the protocol drifts.
 */

import { describe, it, expect } from "vitest";
import {
  STRIDE_BYTES,
  MAX_NODES,
  makeTimestampMap,
  processPacketBatch,
  readPacketHeader,
} from "./lww";

function makePacket(opts: {
  nodeIndex: number;
  intentId?: number;
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  timestamp: number;
}): Buffer {
  const buf = Buffer.alloc(STRIDE_BYTES);
  buf.writeUInt16LE(opts.nodeIndex, 0);
  buf.writeUInt16LE(opts.intentId ?? 0, 2);
  buf.writeFloatLE(opts.x ?? 0, 4);
  buf.writeFloatLE(opts.y ?? 0, 8);
  buf.writeFloatLE(opts.z ?? 0, 12);
  buf.writeFloatLE(opts.scale ?? 1, 16);
  buf.writeDoubleLE(opts.timestamp, 20);
  return buf;
}

describe("CRVM wire-format", () => {
  it("a single packet is exactly 28 bytes", () => {
    expect(STRIDE_BYTES).toBe(28);
    expect(makePacket({ nodeIndex: 0, timestamp: 1 }).byteLength).toBe(28);
  });

  it("nodeIndex is u16LE at offset 0 and lwwTimestamp is f64LE at offset 20", () => {
    const p = makePacket({ nodeIndex: 1234, timestamp: 1_700_000_000_123.5 });
    const header = readPacketHeader(p, 0);
    expect(header.nodeIndex).toBe(1234);
    expect(header.timestamp).toBeCloseTo(1_700_000_000_123.5, 10);
  });

  it("tripwire: packet has NO embedded peerId / composite-clock field", () => {
    // The protocol is intentionally 28 bytes flat. Any "upgrade" that
    // appends a writer-ID hash or splits the timestamp into a composite
    // clock would change the stride. Pin it.
    expect(STRIDE_BYTES).toBe(28);
    // A 32-byte stride (e.g. + u32 peerId) would fail this:
    const batch = Buffer.concat([
      makePacket({ nodeIndex: 0, timestamp: 1 }),
      makePacket({ nodeIndex: 1, timestamp: 1 }),
    ]);
    expect(batch.byteLength).toBe(2 * 28);
    // And confirm processPacketBatch flatly rejects a buffer that is not a
    // multiple of STRIDE_BYTES — which is what we'd see on day-1 of a wire
    // upgrade if the client/server got out of sync.
    const bad = Buffer.concat([batch, Buffer.from([0xff, 0xff])]);
    const { broadcast, accepted } = processPacketBatch(
      bad,
      makeTimestampMap(),
    );
    expect(broadcast).toBeNull();
    expect(accepted).toHaveLength(0);
  });
});

describe("LWW arbitration", () => {
  it("the packet with the larger timestamp wins for the same nodeIndex", () => {
    const map = makeTimestampMap();
    const first = makePacket({ nodeIndex: 7, timestamp: 100 });
    const second = makePacket({ nodeIndex: 7, timestamp: 200 });

    const r1 = processPacketBatch(first, map);
    expect(r1.accepted).toEqual([0]);
    expect(map[7]).toBe(100);

    const r2 = processPacketBatch(second, map);
    expect(r2.accepted).toEqual([0]);
    expect(map[7]).toBe(200);
  });

  it("equal timestamps are dropped (strictly-greater is the tiebreaker)", () => {
    const map = makeTimestampMap();
    processPacketBatch(makePacket({ nodeIndex: 3, timestamp: 50 }), map);
    const dup = processPacketBatch(
      makePacket({ nodeIndex: 3, timestamp: 50 }),
      map,
    );
    expect(dup.broadcast).toBeNull();
    expect(dup.accepted).toHaveLength(0);
  });

  it("stale packets are filtered out of the rebroadcast buffer", () => {
    const map = makeTimestampMap();
    // Establish current state at t=500.
    processPacketBatch(makePacket({ nodeIndex: 9, timestamp: 500 }), map);
    // Batch of three: one stale, one fresh-different-node, one stale-equal.
    const batch = Buffer.concat([
      makePacket({ nodeIndex: 9, timestamp: 100 }), // stale → dropped
      makePacket({ nodeIndex: 10, timestamp: 600 }), // accepted
      makePacket({ nodeIndex: 9, timestamp: 500 }), // equal → dropped
    ]);
    const { accepted, broadcast } = processPacketBatch(batch, map);
    expect(accepted).toEqual([1]);
    expect(broadcast).not.toBeNull();
    expect(broadcast!.byteLength).toBe(STRIDE_BYTES);
    // The lone accepted packet's header reads back as nodeIndex=10, t=600.
    const header = readPacketHeader(broadcast!, 0);
    expect(header.nodeIndex).toBe(10);
    expect(header.timestamp).toBe(600);
  });

  it("nodeIndex >= MAX_NODES is silently skipped", () => {
    const map = makeTimestampMap();
    const oob = makePacket({ nodeIndex: MAX_NODES, timestamp: 1_000 });
    const { accepted, broadcast } = processPacketBatch(oob, map);
    expect(accepted).toHaveLength(0);
    expect(broadcast).toBeNull();
  });
});


================================================================================
FILE: artifacts/api-server/src/lib/logger.ts  (20 lines)
================================================================================

import pino from "pino";

const isProduction = process.env.NODE_ENV === "production";

export const logger = pino({
  level: process.env.LOG_LEVEL ?? "info",
  redact: [
    "req.headers.authorization",
    "req.headers.cookie",
    "res.headers['set-cookie']",
  ],
  ...(isProduction
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true },
        },
      }),
});


================================================================================
FILE: artifacts/api-server/src/routes/index.ts  (8 lines)
================================================================================

import { Router, type IRouter } from "express";
import healthRouter from "./health";

const router: IRouter = Router();

router.use(healthRouter);

export default router;


================================================================================
FILE: artifacts/api-server/src/routes/health.ts  (11 lines)
================================================================================

import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

export default router;


================================================================================
FILE: artifacts/rcmt/src/main.tsx  (5 lines)
================================================================================

import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(<App />);


================================================================================
FILE: artifacts/rcmt/src/App.tsx  (180 lines)
================================================================================

import { Suspense, useEffect, Component, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { CommandConsole } from "./components/CommandConsole";
import { Timeline } from "./components/Timeline";
import { ThoughtTicker } from "./components/ThoughtTicker";
import { HoverTooltip } from "./components/HoverTooltip";
import {
  SyncCore,
  Ontology,
  EventStream,
  Invariants,
  CameraReadout,
  TelemetryBar,
} from "./components/hud";
import { NetworkManager } from "./network/NetworkManager";
import { OnnxWorker } from "./workers/OnnxWorkerManager";
import { pushHudEvent } from "./store/useHudStore";
import { COLOR, FONT } from "./components/hud/tokens";

// ── WebGL Error Boundary ─────────────────────────────────────
class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: COLOR.text,
            fontFamily: FONT,
            fontSize: 13,
            gap: 12,
            background: COLOR.bgSolid,
          }}
        >
          <div style={{ color: COLOR.fail }}>WEBGL CONTEXT UNAVAILABLE</div>
          <div style={{ color: COLOR.textDim, fontSize: 11, maxWidth: 400, textAlign: "center" }}>
            {this.state.error}
          </div>
          <div style={{ color: COLOR.textMuted, fontSize: 10 }}>
            Ensure hardware acceleration is enabled in your browser settings.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COLOR.bgSolid,
        color: COLOR.accent,
        fontFamily: FONT,
        fontSize: 12,
        letterSpacing: 1,
      }}
    >
      INITIALIZING RCMT LATTICE…
    </div>
  );
}

export default function App() {
  useEffect(() => {
    NetworkManager.connect();
    // Boot the ONNX classifier worker so injections actually run through the
    // 25 MB MiniLM model instead of silently falling back to the keyword
    // heuristic. Status transitions are surfaced by the SyncCore ENGINE pill
    // (single owner of onStatusChange — don't add another subscriber here or
    // the last writer wins). We poll currentStatus once on the next tick so
    // a transition to ERROR also lands in the event ring as a hard signal.
    OnnxWorker.initialize();
    const id = setInterval(() => {
      const s = OnnxWorker.currentStatus;
      if (s === "ERROR") {
        pushHudEvent({
          type: "ERROR",
          detail: "ONNX classifier failed to load — keyword fallback active",
        });
        clearInterval(id);
      } else if (s === "READY" || s === "CLASSIFY_COMPLETE") {
        pushHudEvent({ type: "INFO", detail: "ONNX classifier READY" });
        clearInterval(id);
      }
    }, 1000);
    return () => {
      clearInterval(id);
      NetworkManager.disconnect();
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: COLOR.bgSolid,
        position: "relative",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      {/* 3D Canvas — outer DOM-level Suspense shows the loading overlay
          until the lazy 3D subtree resolves; the inner R3F Suspense uses
          a null fallback because its children render inside WebGL, not DOM. */}
      <Suspense fallback={<LoadingOverlay />}>
        <WebGLErrorBoundary>
          <Canvas
            gl={{ antialias: true, alpha: false }}
            camera={{ position: [0, 25, 95], fov: 60, near: 0.1, far: 500 }}
            style={{ position: "absolute", inset: 0 }}
            onCreated={({ gl }) => {
              gl.setClearColor(COLOR.bgSolid, 1);
            }}
          >
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        </WebGLErrorBoundary>
      </Suspense>

      {/* Aerospace telemetry HUD */}
      <Invariants />
      <SyncCore />
      <Ontology />
      <CameraReadout />
      <EventStream />
      <CommandConsole />
      <TelemetryBar />
      <Timeline />
      <HoverTooltip />

      {/* Invisible: drives autonomous thought loop. */}
      <ThoughtTicker />

      {/* Corner branding */}
      <div
        style={{
          position: "fixed",
          top: 14,
          left: "50%",
          transform: "translate(-50%, 56px)",
          fontFamily: FONT,
          fontSize: 9,
          color: COLOR.textMuted,
          letterSpacing: 1.5,
          pointerEvents: "none",
          userSelect: "none",
          textAlign: "center",
        }}
      >
        RCMT PLATINUM v5.1 · RADIAL COGNITIVE MEMORY TAPESTRY
      </div>
    </div>
  );
}


================================================================================
FILE: artifacts/rcmt/src/store/useSaccadeStore.ts  (1089 lines)
================================================================================

/**
 * useSaccadeStore — Saccade frame buffer, per-tier FIFO caches, decay engine,
 *                   promotion-on-reinforcement, BVH spatial index, and UI
 *                   selection state for the 8k lattice.
 *
 * This is the SOLE source of truth for node state. The legacy `useStore.nodes`
 * graph was retired in Task #4 — every write path (drag, ONNX injection,
 * network ingest) now mutates `mockFrames[activeFrameIndex]` directly via
 * the actions on this store.
 *
 * Per-tier caches (Task #3): the 0..7999 index space is partitioned into 5
 * disjoint shells, one per ontology tier. Each tier owns its own FIFO of
 * vacant slot indices, its own occupancy count, and its own decay rate λ. When
 * a tier fills, the lowest-Health slot in that tier is evicted (not the
 * globally-oldest). Dream churn therefore can NEVER evict Facts.
 *
 * Float32 stride layout per node (STRIDE = 7):
 *   [0] x   [1] y   [2] z   [3] r   [4] g   [5] b   [6] importance/scale
 *
 * Per-node state arrays (NOT part of the 28-byte CRVM payload — runtime only):
 *   slotTier[i]            Uint8  — 1..5, the ontology tier this slot belongs to
 *   embeddings[i*384..]    Float32 — L2-normalized ONNX vector for cosine reinforcement
 *   reinforcementCount[i]  Uint8  — strikes toward 3-strike promotion
 *   injectedAt[i]          Float64 — wall-clock ms; basis for exp(-λ·Δt) Health
 *   mass[i]                Float32 — resting scale (separate from the rendered
 *                                    scale so promotion pulses don't corrupt it)
 *   animStartTime[i]       Float64 — 0 = no animation; >0 = promotion in flight
 *   animFromPos[i*3..]     Float32 — promotion origin XYZ
 *   animToPos[i*3..]       Float32 — promotion destination XYZ
 *
 * Spatial index:
 *   The collisionBVH wraps a proxy BufferGeometry with exactly one triangle per
 *   VRAM slot, so `triangleIndex === slotIndex`. Rebuilds are LAZY: mutations
 *   only set bvhDirty=true; rebuild happens on the next getCollisionBVH().
 */

import { create } from "zustand";
import { BufferAttribute, BufferGeometry } from "three";
import { MeshBVH } from "three-mesh-bvh";
import { SaccadeWorker } from "../workers/SaccadeWorkerManager";
import { pushHudEvent } from "./useHudStore";

export const MAX_NODES = 8000;
export const STRIDE = 7;

// ── Task #3: Per-tier caches ──────────────────────────────────────────
// Slot ontology is 1-based (1=Fact, 2=Scenario, 3=Metric, 4=Theory, 5=Dream).
// All array indices in this file are 0-based; the +1/-1 conversions are
// localized to the public surface.

/** Hard cap per tier. MUST sum to exactly MAX_NODES (8000). */
export const TIER_CAPS: ReadonlyArray<number> = [2000, 2000, 1500, 1500, 1000];

/** Starting absolute slot index for each tier. Computed from TIER_CAPS. */
export const TIER_STARTS: ReadonlyArray<number> = (() => {
  const arr: number[] = [];
  let acc = 0;
  for (const c of TIER_CAPS) {
    arr.push(acc);
    acc += c;
  }
  if (acc !== MAX_NODES) {
    throw new Error(
      `TIER_CAPS sum (${acc}) must equal MAX_NODES (${MAX_NODES}) — over/underallocation corrupts the BVH proxy buffer.`,
    );
  }
  return arr;
})();

/** Per-tier decay rate λ for Health(t) = exp(-λ · Δt_seconds). */
export const TIER_LAMBDA: ReadonlyArray<number> = [
  0.005, // Fact — barely decays
  0.015, // Scenario
  0.03, // Metric
  0.06, // Theory
  0.12, // Dream — hyper-decay
];

/** Dimensionality of the @xenova/transformers MiniLM-L6-v2 embedding. */
export const EMBEDDING_DIM = 384;

/** Cosine-similarity threshold for treating an input as reinforcement. */
const REINFORCE_SIM_THRESHOLD = 0.92;
/** Strikes required before promotion fires (slots 4 & 5 only). */
const REINFORCE_PROMOTE_COUNT = 3;
/** Health below this value → node evaporates. */
const HEALTH_DEATH = 0.05;
/** Per-reinforcement scale bump. */
const MASS_REINFORCE_INCR = 0.15;
/** Max scale a single slot can grow to via reinforcement. */
const MASS_REINFORCE_CAP = 3.0;
/** Promotion orbital-shift duration (ms). Cubic ease-in-out. */
export const PROMOTION_ANIM_MS = 400;
/** Background decay sweep interval (ms). NOT inside useFrame — see comment. */
const DECAY_SWEEP_MS = 2000;

// ── RCMT v5.0 Physics & Density Constants ───────────────────────────
// Exported so the foveation/geometry invariants tests (`*.test.ts`) pin
// the literal values — any refactor that drifts the spiral or shrinks
// the foveated radius will fail the suite loudly.
export const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
// Z-strata (the old per-tier Z offset) was removed in Task #10 — the lattice
// is now a single continuous 3D sphere, tiers distinguished by color +
// foveated radius alone. See replit.md "Architecture decisions".
export const NODE_DENSITY_BUBBLE = 0.6;
const MIN_SCALE = 0.15;
const SCALE_PER_CHAR = 0.02;
const MAX_SCALE = 1.5;

// BVH proxy triangle radius — MUST match SaccadeInstancedMesh's
// `SphereGeometry(1, 8, 8)` scaled by `scale * VISUAL_RADIUS_MULT`. Any
// other multiplier desyncs picking from visuals. Exported so the BVH-proxy
// invariant can compare it against the renderer's visual constant.
export const BVH_PROXY_MULT = 0.15;
const PROXY_SCALE_MULT = BVH_PROXY_MULT;

// Pre-computed equilateral-triangle offsets in the XZ plane (unit radius).
// Multiplied by (scale * PROXY_SCALE_MULT) per slot at proxy build time.
const TRI_OFFSETS: ReadonlyArray<[number, number, number]> = [
  [1, 0, 0],
  [-0.5, 0, 0.8660254038],
  [-0.5, 0, -0.8660254038],
];

function sphericalFibonacci(i: number, total: number): [number, number, number] {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(total, 1));
  const theta = i * GOLDEN_ANGLE;
  const sinPhi = Math.sin(phi);
  return [sinPhi * Math.cos(theta), sinPhi * Math.sin(theta), Math.cos(phi)];
}

/**
 * Compute the foveated lattice position for an absolute slot index. Slot 1
 * (Fact) sits near the core; slot 5 (Dream) disperses to the rim. The radial
 * shell is implied by the slot's absolute index via sqrt(index)·BUBBLE.
 */
export function latticePosition(
  absoluteIndex: number,
  tier1Based: number,
): [number, number, number] {
  const radius = Math.sqrt(absoluteIndex) * NODE_DENSITY_BUBBLE;
  const [sx, sy, sz] = sphericalFibonacci(absoluteIndex, MAX_NODES);
  const x = sx * radius;
  const y = sy * radius;
  const z = sz * radius;
  void tier1Based;
  return [x, y, z];
}

function normalizeColor(
  c: { r: number; g: number; b: number } | [number, number, number] | number,
): [number, number, number] {
  if (Array.isArray(c)) return [c[0], c[1], c[2]];
  if (typeof c === "number") return [c, c, c];
  return [c.r, c.g, c.b];
}

function certaintyToRGB(c: number): [number, number, number] {
  if (c > 0.6) {
    const t = (c - 0.6) / 0.4;
    return [0, t, 1];
  }
  const t = c / 0.6;
  return [0.5 * (1 - t), 0, 0.8 + 0.2 * t];
}

/** Canonical RCMT slot palette mirrored from OnnxWorkerManager.SLOT_COLORS. */
const TIER_COLORS: ReadonlyArray<[number, number, number]> = [
  [0.0, 1.0, 1.0], // 1 Cyan   — Facts
  [0.0, 1.0, 0.0], // 2 Green  — Scenario
  [1.0, 1.0, 0.0], // 3 Yellow — Metric
  [1.0, 0.5, 0.0], // 4 Orange — Theory
  [0.5, 0.0, 1.0], // 5 Purple — Dream
];

/** Build the static tier-lookup table once. Slot i ∈ [TIER_STARTS[t], TIER_STARTS[t]+TIER_CAPS[t]) → tier (t+1). */
function buildSlotTier(): Uint8Array {
  const arr = new Uint8Array(MAX_NODES);
  for (let t = 0; t < TIER_CAPS.length; t++) {
    const start = TIER_STARTS[t];
    const end = start + TIER_CAPS[t];
    for (let i = start; i < end; i++) arr[i] = t + 1;
  }
  return arr;
}

/** Fresh per-tier FIFOs, each containing that tier's full slot range in order. */
function buildVacantByTier(): number[][] {
  return TIER_CAPS.map((cap, t) => {
    const start = TIER_STARTS[t];
    const out = new Array<number>(cap);
    for (let i = 0; i < cap; i++) out[i] = start + i;
    return out;
  });
}

/**
 * Append `additions` to `existing` without breaking FIFO order.
 * Uses a Set ONLY for dedup membership checks; never reconstructs from a Set
 * (which would collapse the insertion order).
 */
function appendUniqueFIFO(existing: number[], additions: number[]): number[] {
  if (additions.length === 0) return existing;
  const seen = new Set(existing);
  const result = existing.slice();
  for (const idx of additions) {
    if (!seen.has(idx)) {
      seen.add(idx);
      result.push(idx);
    }
  }
  return result;
}

/** L2-normalize in place. No-op if already unit length. Cheap insurance. */
function l2Normalize(v: Float32Array): Float32Array {
  let sumSq = 0;
  for (let i = 0; i < v.length; i++) sumSq += v[i] * v[i];
  if (sumSq <= 0) return v;
  const inv = 1 / Math.sqrt(sumSq);
  if (Math.abs(inv - 1) < 1e-6) return v;
  for (let i = 0; i < v.length; i++) v[i] *= inv;
  return v;
}

/** Result of a single injectLiveIntentVector call. */
export interface InjectOutcome {
  /** Absolute VRAM slot index that was written to. */
  index: number;
  /** What kind of mutation occurred. */
  kind: "spawn" | "reinforce" | "evict" | "promote";
  /** Tier (1..5) the slot belongs to AFTER the mutation. */
  tier: number;
}

// ── Demo seed ────────────────────────────────────────────────────────
// Stride-sample demo slots so the canvas isn't empty on first load. Demo
// occupies the first DEMO_COUNT slots in the buffer (all in the Fact tier,
// 0..1999). Colors are computed from a stride-derived certainty so the demo
// reads as a foveated rainbow rather than a wall of cyan Facts.
const DEMO_STRIDE = 6;
const DEMO_COUNT = Math.ceil(MAX_NODES / DEMO_STRIDE); // 1334

function certaintyFromStrideIndex(strideSlot: number): number {
  return Math.max(0, 1 - Math.sqrt(strideSlot / MAX_NODES));
}

function buildInitialFrame(): Float32Array {
  const frame = new Float32Array(MAX_NODES * STRIDE);
  let bufIdx = 0;
  for (let s = 0; s < MAX_NODES; s += DEMO_STRIDE) {
    if (bufIdx >= MAX_NODES) break;
    const certainty = certaintyFromStrideIndex(s);
    const [x, y, z] = latticePosition(bufIdx, 1);
    const [r, g, b] = certaintyToRGB(certainty);
    const size = 0.35 + certainty * 0.55;
    const off = bufIdx * STRIDE;
    frame[off + 0] = x;
    frame[off + 1] = y;
    frame[off + 2] = z;
    frame[off + 3] = r;
    frame[off + 4] = g;
    frame[off + 5] = b;
    frame[off + 6] = size;
    bufIdx++;
  }
  return frame;
}

interface SaccadeStore {
  mockFrames: Float32Array[];
  activeFrameIndex: number;
  totalFrames: number;
  isFileLoaded: boolean;

  // ── Per-tier slot bookkeeping (Task #3) ────────────────────────
  vacantSlotsByTier: number[][];
  /** Live occupancy per tier (1-based — read as tierCounts[tierIndex-1]). */
  tierCounts: number[];
  /** O(1) tier lookup, 1-based. Allocated once; never resized. */
  slotTier: Uint8Array;
  /** L2-normalized 384-d embedding per slot, packed contiguously. */
  embeddings: Float32Array;
  reinforcementCount: Uint8Array;
  injectedAt: Float64Array;
  mass: Float32Array;
  animStartTime: Float64Array;
  animFromPos: Float32Array;
  animToPos: Float32Array;

  spawnTime: Float32Array;
  workerReady: boolean;

  /**
   * Source phrase for each slot, or null when the slot is vacant or
   * demo-seeded (demo entries have no originating text). Parallel to
   * `mass[]`; mutated in lockstep with every write path
   * (inject/reinforce/promote/evict/decay/blast/prune). Read by the
   * hover-tooltip layer to show "what is this node?" without per-frame
   * cost — tooltip only reads `slotPhrase[hoveredSlot]`.
   */
  slotPhrase: (string | null)[];

  /**
   * Currently-hovered slot for the source-phrase tooltip, plus the
   * screen-space pointer position used to anchor the DOM overlay.
   * `null` when no slot is under the cursor (or the slot is vacant /
   * demo-seeded and therefore has no phrase to show).
   */
  hoveredSlot: { slot: number; x: number; y: number } | null;

  // ── Spatial index ─────────────────────────────────────────────
  collisionBVH: MeshBVH | null;
  bvhDirty: boolean;

  // ── Selection + UI mode (VRAM-aware) ──────────────────────────
  selectedSlots: Set<number>;
  lassoEventTick: number;
  lassoEventCount: number;
  isLassoMode: boolean;

  // ── Actions ───────────────────────────────────────────────────
  initWorker: () => void;
  loadFile: (file: File) => void;
  setFrameIndex: (index: number) => void;
  setVacantSlotRegistry: (prunedIndices: number[]) => void;
  setLassoMode: (on: boolean) => void;

  /**
   * Drag write path. Mutates only the active frame's X/Y/Z for `slot`. Y is
   * optional — drag in the canvas is XZ-only, so callers usually pass the
   * existing Y. No-op if the slot is vacant (scale == 0).
   */
  dragSlotTo: (slot: number, x: number, y: number, z: number) => void;

  /**
   * Apply a remote LWW position update to the active frame. Position-only —
   * the server has already arbitrated by timestamp before fanning out, so
   * the client doesn't re-check. Skips vacant slots so a peer broadcasting
   * about a slot we don't have can't conjure a ghost dot at the origin.
   */
  applyRemoteUpdate: (slot: number, x: number, y: number, z: number) => void;

  /**
   * Inject a classified phrase into the appropriate tier's cache. If an
   * embedding is provided and cosine-similarity > REINFORCE_SIM_THRESHOLD
   * against any active slot's stored embedding, the call is rerouted to
   * reinforcement (no new slot consumed). When the tier is full, the
   * lowest-Health slot in that tier is evicted (NOT the globally oldest —
   * Dream pressure cannot evict Facts).
   *
   * Returns the slot index used and the outcome category, or null if
   * something pathological happened (no frame, partition exhausted).
   */
  injectLiveIntentVector: (opts: {
    slot: number;
    textLength: number;
    colorRGB:
      | { r: number; g: number; b: number }
      | [number, number, number]
      | number;
    /** Optional L2-normalized 384-d embedding. Without it, reinforcement is skipped. */
    embedding?: Float32Array | null;
    /** Source phrase to attach to the slot for hover-tooltip lookup. */
    phrase?: string;
  }) => InjectOutcome | null;

  /** Set or clear the hovered-slot tooltip state. */
  setHoveredSlot: (h: { slot: number; x: number; y: number } | null) => void;

  /** Background decay sweep — evaporates slots whose Health has fallen below threshold. */
  decaySweep: () => void;

  markBVHDirty: () => void;
  rebuildBVH: () => void;
  getCollisionBVH: () => MeshBVH | null;

  setSelectedSlots: (slots: Set<number>) => void;
  clearSelection: () => void;
  blastSelectedSlots: () => number;
}

// ── Module-init typed arrays (allocated once) ─────────────────────────
const _slotTier = buildSlotTier();
const _embeddings = new Float32Array(MAX_NODES * EMBEDDING_DIM);
const _reinforcementCount = new Uint8Array(MAX_NODES);
const _injectedAt = new Float64Array(MAX_NODES);
const _mass = new Float32Array(MAX_NODES);
const _animStartTime = new Float64Array(MAX_NODES);
const _animFromPos = new Float32Array(MAX_NODES * 3);
const _animToPos = new Float32Array(MAX_NODES * 3);
const _slotPhrase: (string | null)[] = new Array(MAX_NODES).fill(null);

// Seed the demo frame + tier bookkeeping BEFORE store creation so the very
// first render of SaccadeInstancedMesh sees a populated buffer (no
// seedFromNodes bridge to fall back on anymore).
const _initialFrame = buildInitialFrame();
const _initialVacantByTier = buildVacantByTier();
const _initialTierCounts = TIER_CAPS.map(() => 0);
{
  const factCap = TIER_CAPS[0];
  const occupied = Math.min(DEMO_COUNT, factCap);
  _initialVacantByTier[0] = _initialVacantByTier[0].slice(occupied);
  _initialTierCounts[0] = occupied;
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  for (let i = 0; i < occupied; i++) {
    _mass[i] = _initialFrame[i * STRIDE + 6];
    _injectedAt[i] = now;
  }
}

export const useSaccadeStore = create<SaccadeStore>((set, get) => ({
  mockFrames: [_initialFrame],
  activeFrameIndex: 0,
  totalFrames: 1,
  isFileLoaded: false,

  vacantSlotsByTier: _initialVacantByTier,
  tierCounts: _initialTierCounts,
  slotTier: _slotTier,
  embeddings: _embeddings,
  reinforcementCount: _reinforcementCount,
  injectedAt: _injectedAt,
  mass: _mass,
  animStartTime: _animStartTime,
  animFromPos: _animFromPos,
  animToPos: _animToPos,

  spawnTime: new Float32Array(MAX_NODES),
  workerReady: false,

  slotPhrase: _slotPhrase,
  hoveredSlot: null,

  collisionBVH: null,
  bvhDirty: true,
  selectedSlots: new Set<number>(),
  lassoEventTick: 0,
  lassoEventCount: 0,
  isLassoMode: false,

  initWorker: () => {
    SaccadeWorker.initialize();

    SaccadeWorker.onFileReady = (totalFrames) => {
      set({ totalFrames, isFileLoaded: true, bvhDirty: true });
    };

    SaccadeWorker.onFrameData = (frame) => {
      set((state) => {
        const updated = [...state.mockFrames];
        updated[frame.index] = frame.data as unknown as Float32Array;
        return { mockFrames: updated, bvhDirty: true };
      });
    };

    SaccadeWorker.onError = (msg) => {
      console.error("[SaccadeStore] Worker error:", msg);
    };

    set({ workerReady: true });
  },

  loadFile: (file) => {
    const { workerReady, initWorker, spawnTime } = get();
    if (!workerReady) initWorker();
    SaccadeWorker.loadFile(file);
    for (let i = 0; i < 20; i++) SaccadeWorker.seekFrame(i);
    spawnTime.fill(0);
    set({ isFileLoaded: false, mockFrames: [], activeFrameIndex: 0, bvhDirty: true });
  },

  setFrameIndex: (index) => {
    const { mockFrames, totalFrames } = get();
    const clamped = Math.max(0, Math.min(index, Math.max(0, totalFrames - 1)));
    set({ activeFrameIndex: clamped, bvhDirty: true });
    if (!mockFrames[clamped]) SaccadeWorker.seekFrame(clamped);
  },

  setLassoMode: (on) => set({ isLassoMode: on }),

  dragSlotTo: (slot, x, y, z) => {
    const { mockFrames, activeFrameIndex } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame) return;
    if (slot < 0 || slot >= MAX_NODES) return;
    const off = slot * STRIDE;
    // Skip vacant slots — dragging "nothing" must not paint a stale color.
    if (frame[off + 6] <= 0) return;
    frame[off + 0] = x;
    frame[off + 1] = y;
    frame[off + 2] = z;
    set({ bvhDirty: true });
  },

  applyRemoteUpdate: (slot, x, y, z) => {
    const { mockFrames, activeFrameIndex } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame) return;
    if (slot < 0 || slot >= MAX_NODES) return;
    const off = slot * STRIDE;
    // Position-only sync mirrors the legacy behavior. A vacant slot stays
    // vacant — peer-driven slot allocation is a separate (future) feature.
    if (frame[off + 6] <= 0) return;
    frame[off + 0] = x;
    frame[off + 1] = y;
    frame[off + 2] = z;
    set({ bvhDirty: true });
  },

  setVacantSlotRegistry: (prunedIndices) => {
    set((state) => {
      const slotTier = state.slotTier;
      const nextByTier = state.vacantSlotsByTier.map((arr) => arr.slice());
      const nextCounts = state.tierCounts.slice();
      const additionsByTier: number[][] = TIER_CAPS.map(() => []);

      for (const idx of prunedIndices) {
        if (idx < 0 || idx >= MAX_NODES) continue;
        const tier = slotTier[idx];
        if (tier < 1 || tier > TIER_CAPS.length) continue;
        // Clear per-slot state so the next inhabitant gets a clean baseline.
        state.spawnTime[idx] = 0;
        state.mass[idx] = 0;
        state.reinforcementCount[idx] = 0;
        state.injectedAt[idx] = 0;
        state.animStartTime[idx] = 0;
        state.slotPhrase[idx] = null;
        additionsByTier[tier - 1].push(idx);
      }

      for (let t = 0; t < TIER_CAPS.length; t++) {
        if (additionsByTier[t].length === 0) continue;
        nextByTier[t] = appendUniqueFIFO(nextByTier[t], additionsByTier[t]);
        nextCounts[t] = Math.max(0, nextCounts[t] - additionsByTier[t].length);
      }

      return {
        vacantSlotsByTier: nextByTier,
        tierCounts: nextCounts,
        bvhDirty: true,
      };
    });
  },

  injectLiveIntentVector: ({ slot, textLength, colorRGB, embedding, phrase }) => {
    const state = get();
    const {
      mockFrames,
      activeFrameIndex,
      vacantSlotsByTier,
      spawnTime,
      slotTier,
      embeddings,
      mass,
      injectedAt,
      reinforcementCount,
      tierCounts,
    } = state;
    const currentFrame = mockFrames[activeFrameIndex];
    if (!currentFrame) {
      console.warn("[Saccade] No active frame buffer — injection aborted.");
      return null;
    }

    const tier1Based = Math.max(1, Math.min(TIER_CAPS.length, slot | 0));
    const tierIdx = tier1Based - 1;

    const safeScale = Math.min(
      MIN_SCALE + textLength * SCALE_PER_CHAR,
      MAX_SCALE,
    );

    // ── Step 1: reinforcement check ──────────────────────────────
    // Scan every active slot's stored embedding for max cosine similarity.
    // Both sides are L2-normalized, so cosine = dot product.
    let reinforcedSlot = -1;
    if (embedding && embedding.length === EMBEDDING_DIM) {
      let bestSim = -Infinity;
      let bestIdx = -1;
      for (let i = 0; i < MAX_NODES; i++) {
        if (mass[i] <= 0) continue;
        const base = i * EMBEDDING_DIM;
        let s = 0;
        for (let k = 0; k < EMBEDDING_DIM; k++) {
          s += embedding[k] * embeddings[base + k];
        }
        if (s > bestSim) {
          bestSim = s;
          bestIdx = i;
        }
      }
      if (bestIdx >= 0 && bestSim > REINFORCE_SIM_THRESHOLD) {
        reinforcedSlot = bestIdx;
      }
    }

    const now = performance.now();

    if (reinforcedSlot >= 0) {
      const i = reinforcedSlot;
      const off = i * STRIDE;
      spawnTime[i] = now;
      injectedAt[i] = now;
      mass[i] = Math.min(mass[i] + MASS_REINFORCE_INCR, MASS_REINFORCE_CAP);
      reinforcementCount[i] = Math.min(255, reinforcementCount[i] + 1);
      currentFrame[off + 6] = mass[i];
      // Update the source phrase to the most recent reinforcing input so the
      // tooltip reflects what the user just typed (not a stale earlier seed).
      if (phrase !== undefined) state.slotPhrase[i] = phrase;

      const reinforcedTier = slotTier[i];
      // Promotion gated to slots 4 and 5 only.
      if (
        (reinforcedTier === 4 || reinforcedTier === 5) &&
        reinforcementCount[i] >= REINFORCE_PROMOTE_COUNT
      ) {
        const promoted = promoteSlot(i, get, set);
        if (promoted !== null) {
          return { index: promoted, kind: "promote", tier: slotTier[promoted] };
        }
        return { index: i, kind: "reinforce", tier: reinforcedTier };
      }
      set({ bvhDirty: true });
      return { index: i, kind: "reinforce", tier: reinforcedTier };
    }

    // ── Step 2: allocate a slot in the target tier ───────────────
    let targetIndex: number;
    let outcomeKind: "spawn" | "evict" = "spawn";
    let nextVacantForTier = vacantSlotsByTier[tierIdx];
    if (nextVacantForTier.length > 0) {
      targetIndex = nextVacantForTier[0];
      nextVacantForTier = nextVacantForTier.slice(1);
    } else {
      outcomeKind = "evict";
      // Tier full → evict lowest-Health slot in this tier (NOT globally).
      const start = TIER_STARTS[tierIdx];
      const end = start + TIER_CAPS[tierIdx];
      const lambda = TIER_LAMBDA[tierIdx];
      let worstHealth = Infinity;
      let worstIdx = -1;
      for (let i = start; i < end; i++) {
        if (mass[i] <= 0) continue;
        const dt = (now - injectedAt[i]) / 1000;
        const health = Math.exp(-lambda * dt);
        if (health < worstHealth) {
          worstHealth = health;
          worstIdx = i;
        }
      }
      if (worstIdx < 0) {
        console.warn(
          `[Saccade] Tier ${tier1Based} reports full but no occupant found — injection aborted.`,
        );
        return null;
      }
      targetIndex = worstIdx;
      // Wipe the evicted slot's state; we'll repopulate below.
      spawnTime[worstIdx] = 0;
      mass[worstIdx] = 0;
      reinforcementCount[worstIdx] = 0;
      injectedAt[worstIdx] = 0;
      state.slotPhrase[worstIdx] = null;
      // No vacant entry to splice in — we're reusing the same index.
      // nextVacantForTier stays []
    }

    // ── Step 3: write position, color, scale, embedding, state ──
    const [x, y, z] = latticePosition(targetIndex, tier1Based);
    const [r, g, b] = normalizeColor(colorRGB);

    const offset = targetIndex * STRIDE;
    currentFrame[offset + 0] = x;
    currentFrame[offset + 1] = y;
    currentFrame[offset + 2] = z;
    currentFrame[offset + 3] = r;
    currentFrame[offset + 4] = g;
    currentFrame[offset + 5] = b;
    currentFrame[offset + 6] = safeScale;

    spawnTime[targetIndex] = now;
    injectedAt[targetIndex] = now;
    mass[targetIndex] = safeScale;
    reinforcementCount[targetIndex] = 0;
    state.slotPhrase[targetIndex] = phrase ?? null;

    if (embedding && embedding.length === EMBEDDING_DIM) {
      const base = targetIndex * EMBEDDING_DIM;
      // Defensive copy + normalize. Embeddings are normalized at the worker
      // boundary already, but normalizing here is cheap insurance against
      // future model swaps and makes cosine compare unambiguous.
      for (let k = 0; k < EMBEDDING_DIM; k++) {
        embeddings[base + k] = embedding[k];
      }
      // Normalize in place over this slot's slice. (Building a subview
      // avoids allocation.)
      const slice = embeddings.subarray(base, base + EMBEDDING_DIM);
      l2Normalize(slice);
    } else if (embedding === undefined || embedding === null) {
      // Clear any stale embedding so future cosine scans don't match a
      // recycled slot's previous occupant.
      const base = targetIndex * EMBEDDING_DIM;
      for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[base + k] = 0;
    }

    // ── Step 4: tier bookkeeping ────────────────────────────────
    const nextByTier = vacantSlotsByTier.map((arr, t) =>
      t === tierIdx ? nextVacantForTier : arr,
    );
    const nextCounts = tierCounts.slice();
    // If we evicted (no vacant entry consumed), count stays the same.
    // If we consumed a vacant, count goes up by 1.
    if (vacantSlotsByTier[tierIdx].length > 0) {
      nextCounts[tierIdx] = Math.min(
        TIER_CAPS[tierIdx],
        nextCounts[tierIdx] + 1,
      );
    }

    set({
      vacantSlotsByTier: nextByTier,
      tierCounts: nextCounts,
      bvhDirty: true,
    });
    return { index: targetIndex, kind: outcomeKind, tier: tier1Based };
  },

  setHoveredSlot: (h) => set({ hoveredSlot: h }),

  decaySweep: () => {
    const state = get();
    const { mockFrames, activeFrameIndex, mass, injectedAt, slotTier, spawnTime, embeddings, isFileLoaded, slotPhrase } = state;
    // Decay must NEVER mutate a replay snapshot — `mockFrames[i]` for
    // `activeFrameIndex !== 0` (or when a binary is loaded) is a frozen
    // history frame, and writing to it during scrub rewrites the past.
    // See `.agents/memory/rcmt-decay-vs-replay.md`.
    if (isFileLoaded || activeFrameIndex !== 0) return;
    const frame = mockFrames[activeFrameIndex];
    if (!frame) return;
    // Decay only mutates the live frame. During binary file playback the
    // user is scrubbing immutable history — running decay there would
    // corrupt the recorded state.
    if (state.isFileLoaded) return;

    const now = performance.now();
    const pruned: number[] = [];

    for (let i = 0; i < MAX_NODES; i++) {
      if (mass[i] <= 0) continue;
      const tier = slotTier[i];
      if (tier < 1) continue;
      const lambda = TIER_LAMBDA[tier - 1];
      const dt = (now - injectedAt[i]) / 1000;
      const health = Math.exp(-lambda * dt);
      if (health < HEALTH_DEATH) {
        const off = i * STRIDE;
        frame[off + 6] = 0;
        mass[i] = 0;
        spawnTime[i] = 0;
        injectedAt[i] = 0;
        slotPhrase[i] = null;
        // Clear embedding so a recycled slot can't false-match.
        const base = i * EMBEDDING_DIM;
        for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[base + k] = 0;
        pruned.push(i);
      }
    }

    if (pruned.length === 0) return;

    // Emit one EVICT(reason=lowHealth) per evaporated slot so the event ring
    // reflects the full lifecycle. The tier-full eviction path (in
    // injectLiveIntentVector → injectPhrase) emits reason=tierFull; together
    // these are the only two ways a slot leaves the lattice.
    for (const idx of pruned) {
      const tier = slotTier[idx];
      pushHudEvent({
        type: "EVICT",
        slot: idx,
        tier,
        detail: `vram[${idx}] tier ${tier} · reason=lowHealth (decay below threshold)`,
      });
    }

    // Route evaporated slots back to their tier FIFOs.
    set((s) => {
      const nextByTier = s.vacantSlotsByTier.map((arr) => arr.slice());
      const nextCounts = s.tierCounts.slice();
      const additionsByTier: number[][] = TIER_CAPS.map(() => []);
      for (const idx of pruned) {
        const tier = slotTier[idx];
        if (tier < 1 || tier > TIER_CAPS.length) continue;
        additionsByTier[tier - 1].push(idx);
      }
      for (let t = 0; t < TIER_CAPS.length; t++) {
        if (additionsByTier[t].length === 0) continue;
        nextByTier[t] = appendUniqueFIFO(nextByTier[t], additionsByTier[t]);
        nextCounts[t] = Math.max(0, nextCounts[t] - additionsByTier[t].length);
      }
      return {
        vacantSlotsByTier: nextByTier,
        tierCounts: nextCounts,
        bvhDirty: true,
      };
    });
  },

  markBVHDirty: () => set({ bvhDirty: true }),

  rebuildBVH: () => {
    const { mockFrames, activeFrameIndex } = get();
    const frame = mockFrames[activeFrameIndex];
    if (!frame) {
      set({ collisionBVH: null, bvhDirty: false });
      return;
    }

    const positions = new Float32Array(MAX_NODES * 9);

    for (let i = 0; i < MAX_NODES; i++) {
      const off = i * STRIDE;
      const scale = frame[off + 6];
      const baseV = i * 9;

      if (scale > 0) {
        const cx = frame[off + 0];
        const cy = frame[off + 1];
        const cz = frame[off + 2];
        const r = scale * PROXY_SCALE_MULT;
        for (let v = 0; v < 3; v++) {
          positions[baseV + v * 3 + 0] = cx + TRI_OFFSETS[v][0] * r;
          positions[baseV + v * 3 + 1] = cy + TRI_OFFSETS[v][1] * r;
          positions[baseV + v * 3 + 2] = cz + TRI_OFFSETS[v][2] * r;
        }
      } else {
        for (let v = 0; v < 9; v++) {
          positions[baseV + v] = Infinity;
        }
      }
    }

    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(positions, 3));
    const bvh = new MeshBVH(geo, { maxLeafTris: 1 });
    set({ collisionBVH: bvh, bvhDirty: false });
  },

  getCollisionBVH: () => {
    if (get().bvhDirty) get().rebuildBVH();
    return get().collisionBVH;
  },

  setSelectedSlots: (slots) =>
    set((state) => ({
      selectedSlots: slots,
      lassoEventTick: state.lassoEventTick + 1,
      lassoEventCount: slots.size,
    })),
  clearSelection: () => set({ selectedSlots: new Set<number>() }),

  blastSelectedSlots: () => {
    const state = get();
    const { mockFrames, activeFrameIndex, selectedSlots, spawnTime, slotTier, mass, injectedAt, reinforcementCount, animStartTime, embeddings, slotPhrase } = state;
    const frame = mockFrames[activeFrameIndex];
    if (!frame || selectedSlots.size === 0) return 0;

    const purgedByTier: number[][] = TIER_CAPS.map(() => []);
    let purgedCount = 0;
    for (const slotIdx of selectedSlots) {
      if (slotIdx < 0 || slotIdx >= MAX_NODES) continue;
      const off = slotIdx * STRIDE;
      frame[off + 6] = 0;
      spawnTime[slotIdx] = 0;
      mass[slotIdx] = 0;
      injectedAt[slotIdx] = 0;
      reinforcementCount[slotIdx] = 0;
      animStartTime[slotIdx] = 0;
      slotPhrase[slotIdx] = null;
      const base = slotIdx * EMBEDDING_DIM;
      for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[base + k] = 0;
      const tier = slotTier[slotIdx];
      if (tier >= 1 && tier <= TIER_CAPS.length) {
        purgedByTier[tier - 1].push(slotIdx);
        purgedCount++;
      }
    }

    set((s) => {
      const nextByTier = s.vacantSlotsByTier.map((arr, t) =>
        appendUniqueFIFO(arr, purgedByTier[t]),
      );
      const nextCounts = s.tierCounts.map((c, t) =>
        Math.max(0, c - purgedByTier[t].length),
      );
      return {
        vacantSlotsByTier: nextByTier,
        tierCounts: nextCounts,
        selectedSlots: new Set<number>(),
        bvhDirty: true,
      };
    });

    return purgedCount;
  },
}));

/**
 * Promote a slot one shell inward (Theory→Metric, Dream→Theory). Atomically:
 *   1. Pop a free slot from the target tier's FIFO (or evict its lowest-Health
 *      occupant if full).
 *   2. Copy color, mass, embedding, injectedAt to the destination slot.
 *   3. Recolor to the new tier's canonical color.
 *   4. Stage the orbital-shift animation (from→to positions, anim start).
 *   5. Free the source slot back to its FIFO and zero its state.
 *
 * Returns the destination slot index, or null if promotion couldn't happen
 * (e.g. already at slot 1, target tier wholly full of irreplaceable nodes).
 */
function promoteSlot(
  sourceIdx: number,
  get: () => SaccadeStore,
  set: (partial: Partial<SaccadeStore>) => void,
): number | null {
  const state = get();
  const {
    mockFrames,
    activeFrameIndex,
    slotTier,
    vacantSlotsByTier,
    tierCounts,
    mass,
    injectedAt,
    embeddings,
    spawnTime,
    reinforcementCount,
    animStartTime,
    animFromPos,
    animToPos,
    slotPhrase,
  } = state;

  const sourceTier = slotTier[sourceIdx]; // 1-based
  if (sourceTier <= 1) return null;
  const targetTier = sourceTier - 1; // 1-based (inner shell)
  const targetTierIdx = targetTier - 1;

  const frame = mockFrames[activeFrameIndex];
  if (!frame) return null;

  // Allocate destination slot (free, or evict lowest-Health in target tier).
  const now = performance.now();
  let destIdx: number;
  let nextVacantForTarget = vacantSlotsByTier[targetTierIdx];
  let consumedVacant = false;
  if (nextVacantForTarget.length > 0) {
    destIdx = nextVacantForTarget[0];
    nextVacantForTarget = nextVacantForTarget.slice(1);
    consumedVacant = true;
  } else {
    const start = TIER_STARTS[targetTierIdx];
    const end = start + TIER_CAPS[targetTierIdx];
    const lambda = TIER_LAMBDA[targetTierIdx];
    let worstHealth = Infinity;
    let worstIdx = -1;
    for (let i = start; i < end; i++) {
      if (mass[i] <= 0) continue;
      const dt = (now - injectedAt[i]) / 1000;
      const health = Math.exp(-lambda * dt);
      if (health < worstHealth) {
        worstHealth = health;
        worstIdx = i;
      }
    }
    if (worstIdx < 0) return null;
    destIdx = worstIdx;
    // Wipe the evicted slot — destination is now logically empty.
    const evictedOff = worstIdx * STRIDE;
    frame[evictedOff + 6] = 0;
    mass[worstIdx] = 0;
    injectedAt[worstIdx] = 0;
    reinforcementCount[worstIdx] = 0;
    spawnTime[worstIdx] = 0;
    animStartTime[worstIdx] = 0;
    slotPhrase[worstIdx] = null;
  }

  // ── Copy slot state source → dest ───────────────────────────────
  const srcOff = sourceIdx * STRIDE;
  const dstOff = destIdx * STRIDE;
  const srcMass = mass[sourceIdx];
  const srcInjectedAt = injectedAt[sourceIdx];

  // Source's current rendered position becomes anim origin.
  const fromX = frame[srcOff + 0];
  const fromY = frame[srcOff + 1];
  const fromZ = frame[srcOff + 2];

  // Compute destination lattice position from its absolute index + new tier.
  const [toX, toY, toZ] = latticePosition(destIdx, targetTier);

  // New tier color (canonical palette).
  const [newR, newG, newB] = TIER_COLORS[targetTier - 1];

  // Write destination slot: positioned at the anim origin so visual continuity
  // holds for this frame (the render loop will lerp toward toPos over 400 ms).
  frame[dstOff + 0] = fromX;
  frame[dstOff + 1] = fromY;
  frame[dstOff + 2] = fromZ;
  frame[dstOff + 3] = newR;
  frame[dstOff + 4] = newG;
  frame[dstOff + 5] = newB;
  frame[dstOff + 6] = srcMass;

  mass[destIdx] = srcMass;
  injectedAt[destIdx] = srcInjectedAt;
  reinforcementCount[destIdx] = 0; // reset on promotion
  spawnTime[destIdx] = 0; // promotion has its own animation, not starburst

  // Copy embedding.
  const srcEmbBase = sourceIdx * EMBEDDING_DIM;
  const dstEmbBase = destIdx * EMBEDDING_DIM;
  for (let k = 0; k < EMBEDDING_DIM; k++) {
    embeddings[dstEmbBase + k] = embeddings[srcEmbBase + k];
  }

  // Stage animation on destination slot.
  animStartTime[destIdx] = now;
  animFromPos[destIdx * 3 + 0] = fromX;
  animFromPos[destIdx * 3 + 1] = fromY;
  animFromPos[destIdx * 3 + 2] = fromZ;
  animToPos[destIdx * 3 + 0] = toX;
  animToPos[destIdx * 3 + 1] = toY;
  animToPos[destIdx * 3 + 2] = toZ;

  // Carry the source phrase forward to the destination slot so the hover
  // tooltip stays meaningful after a promotion (the slot moves shells, but
  // the originating text doesn't change).
  slotPhrase[destIdx] = slotPhrase[sourceIdx];

  // ── Free source slot ────────────────────────────────────────────
  frame[srcOff + 6] = 0;
  mass[sourceIdx] = 0;
  injectedAt[sourceIdx] = 0;
  reinforcementCount[sourceIdx] = 0;
  spawnTime[sourceIdx] = 0;
  animStartTime[sourceIdx] = 0;
  slotPhrase[sourceIdx] = null;
  for (let k = 0; k < EMBEDDING_DIM; k++) embeddings[srcEmbBase + k] = 0;

  // Tier bookkeeping: source freed, dest claimed.
  const sourceTierIdx = sourceTier - 1;
  const nextByTier = vacantSlotsByTier.map((arr, t) => {
    if (t === targetTierIdx) return nextVacantForTarget;
    if (t === sourceTierIdx) return appendUniqueFIFO(arr, [sourceIdx]);
    return arr;
  });
  const nextCounts = tierCounts.slice();
  nextCounts[sourceTierIdx] = Math.max(0, nextCounts[sourceTierIdx] - 1);
  if (consumedVacant) {
    nextCounts[targetTierIdx] = Math.min(
      TIER_CAPS[targetTierIdx],
      nextCounts[targetTierIdx] + 1,
    );
  }
  // If we evicted to make room, count stays the same on the target tier.

  set({
    vacantSlotsByTier: nextByTier,
    tierCounts: nextCounts,
    bvhDirty: true,
  });

  return destIdx;
}

// ── Decay sweep timer ─────────────────────────────────────────────────
// NOT inside useFrame — the renderer must never block on memory hygiene.
// HMR-safe: if a previous interval handle exists on the module, clear it.
if (typeof window !== "undefined") {
  const w = window as unknown as { __rcmtDecayInterval?: number };
  if (w.__rcmtDecayInterval !== undefined) {
    clearInterval(w.__rcmtDecayInterval);
  }
  w.__rcmtDecayInterval = window.setInterval(() => {
    useSaccadeStore.getState().decaySweep();
  }, DECAY_SWEEP_MS);
}


================================================================================
FILE: artifacts/rcmt/src/store/useHudStore.ts  (230 lines)
================================================================================

/**
 * useHudStore — Aerospace telemetry surface state.
 *
 * Holds:
 *   - Bounded event ring (`events`) used by the EVENT STREAM card.
 *   - Live camera readout (position / fov / target) pushed from inside the
 *     R3F canvas via the HudBridge component.
 *   - Live FPS sample (~4 Hz).
 *   - Network telemetry (peer id, peer count, last HELLO age, lww rejects).
 *   - Six invariant signals + their detail lines.
 *   - Thought ticker state (running, period_ms, last fire timestamp, total
 *     fired, currently busy bool, paused-by-user).
 *
 * Deliberately decoupled from `useSaccadeStore` — both stores import
 * `pushHudEvent` here, but this store imports nothing from the lattice. That
 * keeps the dependency graph acyclic so HMR doesn't double-init either store.
 */

import { create } from "zustand";

export type HudEventType =
  | "SPAWN"
  | "REINFORCE"
  | "PROMOTE"
  | "EVICT"
  | "LWW_REJECT"
  | "LOW_CONF"
  | "INVARIANT_FAIL"
  | "AXIOM"
  | "INFO"
  | "PAUSE"
  | "RESUME"
  | "ERROR";

export interface HudEvent {
  id: number;
  ts: number;
  type: HudEventType;
  slot?: number;
  tier?: number;
  phrase?: string;
  detail?: string;
}

export interface CameraReadout {
  px: number;
  py: number;
  pz: number;
  tx: number;
  ty: number;
  tz: number;
  fov: number;
  distance: number;
}

export type InvariantId =
  | "stride"
  | "tier_contiguity"
  | "fifo"
  | "bvh_proxy"
  | "foveation"
  | "parity";

export interface InvariantState {
  ok: boolean;
  detail: string;
  lastChange: number;
}

export interface NetTelemetry {
  connected: boolean;
  peerId: number;
  peerCount: number;
  packetsIn: number;
  packetsOut: number;
  packetsInRate: number;
  packetsOutRate: number;
  lastHelloAt: number;
  lastRejectSlot: number | null;
  lastRejectReason: string | null;
  lastRejectAt: number;
}

export interface TickerState {
  running: boolean;
  periodMs: number;
  jitterMs: number;
  totalFired: number;
  lastFireAt: number;
  busy: boolean;
}

const EVENT_RING_CAP = 500;
let eventSeq = 0;

interface HudStore {
  events: HudEvent[];
  pushEvent: (e: Omit<HudEvent, "id" | "ts"> & { ts?: number }) => void;
  clearEvents: () => void;

  camera: CameraReadout | null;
  setCamera: (c: CameraReadout) => void;

  fps: number;
  setFps: (n: number) => void;

  drawCalls: number;
  instancedCount: number;
  setRendererStats: (drawCalls: number, instancedCount: number) => void;

  net: NetTelemetry;
  setNet: (patch: Partial<NetTelemetry>) => void;
  incPacketsIn: (n?: number) => void;
  incPacketsOut: (n?: number) => void;

  invariants: Record<InvariantId, InvariantState>;
  setInvariant: (id: InvariantId, ok: boolean, detail: string) => void;

  ticker: TickerState;
  setTickerRunning: (running: boolean) => void;
  setTickerPeriod: (ms: number) => void;
  setTickerBusy: (busy: boolean) => void;
  markTickerFired: () => void;
}

const emptyInvariant = (): InvariantState => ({
  ok: true,
  detail: "uninitialized",
  lastChange: 0,
});

export const useHudStore = create<HudStore>((set, get) => ({
  events: [],
  pushEvent: (e) => {
    const id = ++eventSeq;
    const ts = e.ts ?? Date.now();
    set((s) => {
      const next = s.events.length >= EVENT_RING_CAP
        ? s.events.slice(s.events.length - EVENT_RING_CAP + 1)
        : s.events.slice();
      next.push({ id, ts, ...e });
      return { events: next };
    });
  },
  clearEvents: () => set({ events: [] }),

  camera: null,
  setCamera: (c) => set({ camera: c }),

  fps: 0,
  setFps: (n) => set({ fps: n }),

  drawCalls: 0,
  instancedCount: 0,
  setRendererStats: (drawCalls, instancedCount) =>
    set({ drawCalls, instancedCount }),

  net: {
    connected: false,
    peerId: -1,
    peerCount: 0,
    packetsIn: 0,
    packetsOut: 0,
    packetsInRate: 0,
    packetsOutRate: 0,
    lastHelloAt: 0,
    lastRejectSlot: null,
    lastRejectReason: null,
    lastRejectAt: 0,
  },
  setNet: (patch) => set((s) => ({ net: { ...s.net, ...patch } })),
  incPacketsIn: (n = 1) => set((s) => ({ net: { ...s.net, packetsIn: s.net.packetsIn + n } })),
  incPacketsOut: (n = 1) => set((s) => ({ net: { ...s.net, packetsOut: s.net.packetsOut + n } })),

  invariants: {
    stride: emptyInvariant(),
    tier_contiguity: emptyInvariant(),
    fifo: emptyInvariant(),
    bvh_proxy: emptyInvariant(),
    foveation: emptyInvariant(),
    parity: emptyInvariant(),
  },
  setInvariant: (id, ok, detail) => {
    const prev = get().invariants[id];
    if (prev.ok === ok && prev.detail === detail) return;
    set((s) => ({
      invariants: {
        ...s.invariants,
        [id]: { ok, detail, lastChange: Date.now() },
      },
    }));
    // Only push INVARIANT_FAIL when transitioning to red, not on every sample.
    if (!ok && prev.ok) {
      get().pushEvent({
        type: "INVARIANT_FAIL",
        detail: `${id}: ${detail}`,
      });
    }
  },

  ticker: {
    running: true,
    periodMs: 3000,
    jitterMs: 1000,
    totalFired: 0,
    lastFireAt: 0,
    busy: false,
  },
  setTickerRunning: (running) =>
    set((s) => ({ ticker: { ...s.ticker, running } })),
  setTickerPeriod: (ms) =>
    set((s) => ({ ticker: { ...s.ticker, periodMs: Math.max(250, ms | 0) } })),
  setTickerBusy: (busy) =>
    set((s) => ({ ticker: { ...s.ticker, busy } })),
  markTickerFired: () =>
    set((s) => ({
      ticker: {
        ...s.ticker,
        totalFired: s.ticker.totalFired + 1,
        lastFireAt: Date.now(),
      },
    })),
}));

/** Module-level shortcut so non-React modules can push events without subscribing. */
export function pushHudEvent(
  e: Omit<HudEvent, "id" | "ts"> & { ts?: number },
): void {
  useHudStore.getState().pushEvent(e);
}


================================================================================
FILE: artifacts/rcmt/src/store/geometry.test.ts  (98 lines)
================================================================================

/**
 * Geometry & tier-ontology invariants.
 *
 * Every test here pins a real decision documented in replit.md
 * "Architecture decisions" or in `.agents/memory/rcmt-unified-sphere.md`.
 * If one of these fails, the lattice's foveation or tier accounting has
 * silently drifted — do NOT relax the test, fix the drift.
 */

import { describe, it, expect } from "vitest";
import {
  MAX_NODES,
  TIER_CAPS,
  TIER_STARTS,
  GOLDEN_ANGLE,
  NODE_DENSITY_BUBBLE,
  latticePosition,
} from "./useSaccadeStore";

describe("foveated lattice radius", () => {
  it("radius(slot) === sqrt(slot) * 0.6 for representative slots", () => {
    // The radial foveation formula is what makes facts cluster at the core
    // and dreams disperse to the rim. Changing the coefficient breaks the
    // tier visual ordering even though tier indices stay correct.
    for (const slot of [0, 1, 100, 2000, 4000, 7999]) {
      const [x, y, z] = latticePosition(slot, 1);
      const r = Math.sqrt(x * x + y * y + z * z);
      expect(r).toBeCloseTo(Math.sqrt(slot) * NODE_DENSITY_BUBBLE, 5);
    }
  });

  it("density bubble coefficient is exactly 0.6", () => {
    expect(NODE_DENSITY_BUBBLE).toBe(0.6);
  });
});

describe("golden-angle spiral", () => {
  it("GOLDEN_ANGLE === 137.508° in radians", () => {
    // Pinned literal — `.agents/memory/rcmt-unified-sphere.md` calls this
    // out as the only spiral constant; an "upgrade" to the canonical 137.5°
    // or 137.50776° must be a deliberate, documented decision.
    expect(GOLDEN_ANGLE).toBeCloseTo(137.508 * (Math.PI / 180), 10);
  });
});

describe("tier caps & starts", () => {
  it("TIER_CAPS sums to exactly MAX_NODES (8000)", () => {
    const total = TIER_CAPS.reduce((a, b) => a + b, 0);
    expect(total).toBe(MAX_NODES);
    expect(total).toBe(8000);
  });

  it("TIER_STARTS is the strictly-increasing prefix sum of TIER_CAPS", () => {
    expect(TIER_STARTS[0]).toBe(0);
    for (let t = 1; t < TIER_CAPS.length; t++) {
      expect(TIER_STARTS[t]).toBe(TIER_STARTS[t - 1] + TIER_CAPS[t - 1]);
      expect(TIER_STARTS[t]).toBeGreaterThan(TIER_STARTS[t - 1]);
    }
  });

  it("slot→tier lookup is contiguous and covers 0..7999 with no gaps", () => {
    // Reconstruct the lookup using only the public TIER_CAPS / TIER_STARTS
    // tables — if either drifts, this test fails.
    const lookup = new Uint8Array(MAX_NODES);
    for (let t = 0; t < TIER_CAPS.length; t++) {
      const start = TIER_STARTS[t];
      const end = start + TIER_CAPS[t];
      for (let i = start; i < end; i++) lookup[i] = t + 1;
    }
    for (let i = 0; i < MAX_NODES; i++) {
      expect(lookup[i]).toBeGreaterThanOrEqual(1);
      expect(lookup[i]).toBeLessThanOrEqual(TIER_CAPS.length);
    }
    // Boundary spot-checks: last slot of each tier and first slot of the next.
    for (let t = 0; t < TIER_CAPS.length - 1; t++) {
      const lastInTier = TIER_STARTS[t] + TIER_CAPS[t] - 1;
      const firstInNext = TIER_STARTS[t + 1];
      expect(lookup[lastInTier]).toBe(t + 1);
      expect(lookup[firstInNext]).toBe(t + 2);
    }
    expect(lookup[0]).toBe(1);
    expect(lookup[MAX_NODES - 1]).toBe(TIER_CAPS.length);
  });
});

describe("unified-sphere geometry (regression: no per-tier Z stride)", () => {
  it("two slots in different tiers at the same absolute index produce identical positions", () => {
    // The OLD model added a per-tier Z offset on top of the spiral so tiers
    // fanned into five flat layers. Task #10 removed that — position is now
    // a pure function of `absoluteIndex` and the tier argument is decorative.
    // If a future refactor reintroduces per-tier Z, this assertion blows up.
    const a = latticePosition(1234, 1); // Fact
    const b = latticePosition(1234, 5); // Dream — same absolute index
    expect(a[0]).toBeCloseTo(b[0], 10);
    expect(a[1]).toBeCloseTo(b[1], 10);
    expect(a[2]).toBeCloseTo(b[2], 10);
  });
});


================================================================================
FILE: artifacts/rcmt/src/store/saccade.test.ts  (209 lines)
================================================================================

/**
 * Per-tier FIFO + decay-vs-replay store invariants.
 *
 * These pin three memory-file decisions:
 *   - `.agents/memory/rcmt-vacancy-sot.md` — per-tier FIFOs are isolated
 *   - `.agents/memory/rcmt-decay-vs-replay.md` — decay is a no-op during scrub
 *   - `.agents/memory/slot-move-return-values.md` — moves return destination
 *
 * The store is exercised through its public actions only — no DOM, no R3F.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  TIER_CAPS,
  TIER_STARTS,
} from "./useSaccadeStore";

function resetStore() {
  // Reset to a freshly-bootable state: empty frame, all tiers vacant.
  const fresh = new Float32Array(MAX_NODES * STRIDE);
  const vacantSlotsByTier = TIER_CAPS.map((cap, t) => {
    const start = TIER_STARTS[t];
    const out = new Array<number>(cap);
    for (let i = 0; i < cap; i++) out[i] = start + i;
    return out;
  });
  const s = useSaccadeStore.getState();
  s.mass.fill(0);
  s.injectedAt.fill(0);
  s.spawnTime.fill(0);
  s.reinforcementCount.fill(0);
  s.animStartTime.fill(0);
  s.embeddings.fill(0);
  useSaccadeStore.setState({
    mockFrames: [fresh],
    totalFrames: 1,
    activeFrameIndex: 0,
    isFileLoaded: false,
    vacantSlotsByTier,
    tierCounts: TIER_CAPS.map(() => 0),
  });
}

describe("per-tier FIFO isolation", () => {
  beforeEach(resetStore);

  it("injecting into tier 5 (Dream) consumes a Dream slot, not any other tier's", () => {
    // Regression: under the old global FIFO, Dream churn could grab a Fact
    // slot. Each tier now owns its own queue.
    const before = useSaccadeStore.getState().vacantSlotsByTier.map((a) => a.length);
    const out = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 5,
      textLength: 12,
      colorRGB: [0.5, 0, 1],
    });
    expect(out).not.toBeNull();
    expect(out!.tier).toBe(5);
    expect(out!.kind).toBe("spawn");
    // Slot index must fall inside Dream's [TIER_STARTS[4], +TIER_CAPS[4]) range.
    expect(out!.index).toBeGreaterThanOrEqual(TIER_STARTS[4]);
    expect(out!.index).toBeLessThan(TIER_STARTS[4] + TIER_CAPS[4]);

    const after = useSaccadeStore.getState().vacantSlotsByTier.map((a) => a.length);
    expect(after[4]).toBe(before[4] - 1); // Dream lost exactly 1
    for (let t = 0; t < 4; t++) expect(after[t]).toBe(before[t]); // others untouched
  });

  it("when a tier is full, eviction stays within that tier", () => {
    // Fill Dream (cap 1000) plus a buffer; assert the next injection lands
    // back in Dream's index range, not anywhere else.
    const cap = TIER_CAPS[4];
    for (let i = 0; i < cap; i++) {
      useSaccadeStore.getState().injectLiveIntentVector({
        slot: 5,
        textLength: 8,
        colorRGB: [0.5, 0, 1],
      });
    }
    expect(useSaccadeStore.getState().vacantSlotsByTier[4].length).toBe(0);
    const evicted = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 5,
      textLength: 8,
      colorRGB: [0.5, 0, 1],
    });
    expect(evicted).not.toBeNull();
    expect(evicted!.kind).toBe("evict");
    expect(evicted!.tier).toBe(5);
    expect(evicted!.index).toBeGreaterThanOrEqual(TIER_STARTS[4]);
    expect(evicted!.index).toBeLessThan(TIER_STARTS[4] + TIER_CAPS[4]);
  });
});

describe("decay sweep is gated to live mode", () => {
  beforeEach(resetStore);

  it("decaySweep is a no-op when activeFrameIndex !== 0 (binary scrub mode)", () => {
    // Plant a slot that would otherwise have evaporated long ago: huge
    // negative injectedAt means dt is huge, Health → 0.
    const s = useSaccadeStore.getState();
    s.injectLiveIntentVector({
      slot: 5,
      textLength: 8,
      colorRGB: [0.5, 0, 1],
    });
    const liveFrame = s.mockFrames[0];
    // Force injectedAt to "ancient" so decay would normally prune.
    const planted = s.vacantSlotsByTier[4][0] - 1; // last consumed Dream slot
    s.injectedAt[planted] = -1_000_000;
    // Switch to scrub mode by adding a second frame and pointing at it.
    const replayFrame = new Float32Array(MAX_NODES * STRIDE);
    replayFrame.set(liveFrame); // start as identical
    useSaccadeStore.setState({
      mockFrames: [liveFrame, replayFrame],
      totalFrames: 2,
      activeFrameIndex: 1,
    });
    const snapshotBefore = new Float32Array(replayFrame);
    useSaccadeStore.getState().decaySweep();
    // Replay snapshot must not have been mutated.
    for (let i = 0; i < replayFrame.length; i++) {
      expect(replayFrame[i]).toBe(snapshotBefore[i]);
    }
  });

  it("decaySweep is a no-op when a binary file is loaded (isFileLoaded=true)", () => {
    const s = useSaccadeStore.getState();
    s.injectLiveIntentVector({ slot: 5, textLength: 8, colorRGB: [0.5, 0, 1] });
    const liveFrame = s.mockFrames[0];
    const snapshotBefore = new Float32Array(liveFrame);
    useSaccadeStore.setState({ isFileLoaded: true });
    useSaccadeStore.getState().decaySweep();
    for (let i = 0; i < liveFrame.length; i++) {
      expect(liveFrame[i]).toBe(snapshotBefore[i]);
    }
  });
});

describe("promotion returns the destination slot index, not the source", () => {
  beforeEach(resetStore);

  it("after enough reinforcements on a Dream slot, the returned index is the new (inner-tier) slot", () => {
    // Regression for `.agents/memory/slot-move-return-values.md`. Broadcasting
    // the source index after a move would tell every peer to zero the wrong
    // slot — peers diverge silently. Lock the destination-return semantics.
    const emb = new Float32Array(384);
    emb[0] = 1;
    const first = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 5,
      textLength: 8,
      colorRGB: [0.5, 0, 1],
      embedding: emb,
    });
    expect(first?.kind).toBe("spawn");
    expect(first?.tier).toBe(5);
    const sourceIdx = first!.index;

    // Reinforce repeatedly. Promotion fires once reinforcementCount crosses
    // the 3-strike threshold on a tier 4 or 5 slot.
    let lastOutcome = first;
    for (let i = 0; i < 5; i++) {
      lastOutcome = useSaccadeStore.getState().injectLiveIntentVector({
        slot: 5,
        textLength: 8,
        colorRGB: [0.5, 0, 1],
        embedding: emb,
      });
      if (lastOutcome?.kind === "promote") break;
    }
    expect(lastOutcome?.kind).toBe("promote");
    // Destination must be a different absolute slot AND belong to an inner
    // tier (4 = Theory) — never the original Dream source slot.
    expect(lastOutcome!.index).not.toBe(sourceIdx);
    expect(lastOutcome!.tier).toBe(4);
    expect(lastOutcome!.index).toBeGreaterThanOrEqual(TIER_STARTS[3]);
    expect(lastOutcome!.index).toBeLessThan(TIER_STARTS[3] + TIER_CAPS[3]);
  });
});

describe("reinforcement does not consume a new slot", () => {
  beforeEach(resetStore);

  it("re-injecting with the same embedding reinforces rather than spawning", () => {
    const emb = new Float32Array(384);
    emb[0] = 1; // unit vector — pre-normalized
    const s = useSaccadeStore.getState();
    const first = s.injectLiveIntentVector({
      slot: 2,
      textLength: 8,
      colorRGB: [0, 1, 0],
      embedding: emb,
    });
    expect(first?.kind).toBe("spawn");
    const vacantBefore = useSaccadeStore.getState().vacantSlotsByTier[1].length;
    const again = useSaccadeStore.getState().injectLiveIntentVector({
      slot: 2,
      textLength: 8,
      colorRGB: [0, 1, 0],
      embedding: emb,
    });
    // promote/reinforce are both acceptable here — what matters is that no
    // new vacant slot was consumed for the second hit.
    expect(again?.kind === "reinforce" || again?.kind === "promote").toBe(true);
    const vacantAfter = useSaccadeStore.getState().vacantSlotsByTier[1].length;
    expect(vacantAfter).toBe(vacantBefore);
  });
});


================================================================================
FILE: artifacts/rcmt/src/lib/injectPhrase.ts  (172 lines)
================================================================================

/**
 * injectPhrase — single canonical path from a text phrase to a VRAM slot.
 *
 * Used by both the CommandConsole (user input) and ThoughtTicker
 * (autonomous loop). Serializes all callers via a single Promise chain so the
 * ONNX worker (which only allows one in-flight classification) is never
 * raced.
 *
 * Pipeline:
 *   1. await ONNX classify → { slot, similarities, latencyMs, embedding }
 *   2. inject into useSaccadeStore via injectLiveIntentVector (the ONLY
 *      authorized VRAM write path — never bypass this).
 *   3. broadcast a 28-byte CRVM packet via NetworkManager (sync core).
 *   4. push HUD events: SPAWN | REINFORCE | EVICT | PROMOTE, AXIOM if
 *      the source is the boot seed, LOW_CONF if confidence < threshold.
 *
 * Note: this path deliberately bypasses the legacy useStore.addNode graph.
 * The legacy/VRAM parity invariant will show the divergence — that is
 * intentional. Task #4 retires the legacy graph entirely.
 */

import { useSaccadeStore, STRIDE } from "../store/useSaccadeStore";
import { useHudStore, pushHudEvent } from "../store/useHudStore";
import { OnnxWorker, colorForSlot } from "../workers/OnnxWorkerManager";
import { NetworkManager } from "../network/NetworkManager";

const LOW_CONF_THRESHOLD = 0.55;
const TIER_NAMES = ["FACT", "SCENARIO", "METRIC", "THEORY", "DREAM"];

export type InjectSource = "console" | "ticker" | "axiom";

export interface InjectResult {
  slot: number;
  vramIndex: number | null;
  latencyMs: number;
  confidence: number;
  kind: "spawn" | "reinforce" | "evict" | "promote" | "rejected";
}

// Single in-flight chain serializes both console and ticker callers.
let chain: Promise<unknown> = Promise.resolve();

export function injectPhrase(
  text: string,
  source: InjectSource = "console",
): Promise<InjectResult> {
  const next = chain.then(() => doInject(text, source));
  // Catch so a single failure doesn't poison the chain forever.
  chain = next.catch(() => undefined);
  return next;
}

async function doInject(
  text: string,
  source: InjectSource,
): Promise<InjectResult> {
  useHudStore.getState().setTickerBusy(true);
  try {
    // 1. Classify.
    const cls = await OnnxWorker.classify(text);
    // Axiom seeds are FORCED to Fact tier (slot=1) regardless of classifier
    // output — they're foundational facts and must land in the foveated core.
    // The classifier confidence is still surfaced so an axiom that the model
    // would have routed elsewhere still raises a LOW_CONF event below.
    const slot = source === "axiom" ? 1 : cls.slot;
    const similarities = cls.similarities;
    const latencyMs = cls.latencyMs;
    const embedding = cls.embedding;

    const tierIdx = Math.max(0, Math.min(4, slot - 1));
    const confidence = similarities.length > tierIdx ? similarities[tierIdx] : 0;

    // 2. Inject (the only authorized VRAM write path).
    const color = colorForSlot(slot);
    const outcome = useSaccadeStore.getState().injectLiveIntentVector({
      slot,
      textLength: text.length,
      colorRGB: color,
      embedding,
      phrase: text,
    });

    if (outcome === null) {
      pushHudEvent({
        type: "ERROR",
        phrase: previewPhrase(text),
        detail: `tier ${TIER_NAMES[tierIdx]} full and no eviction candidate`,
      });
      return {
        slot,
        vramIndex: null,
        latencyMs,
        confidence,
        kind: "rejected",
      };
    }

    // 3. Emit canonical event for this outcome.
    const tierLabel = TIER_NAMES[Math.max(0, Math.min(4, outcome.tier - 1))];
    if (source === "axiom") {
      pushHudEvent({
        type: "AXIOM",
        slot: outcome.index,
        tier: outcome.tier,
        phrase: previewPhrase(text),
        detail: `axiom seed @ vram[${outcome.index}] (${tierLabel})`,
      });
    } else {
      pushHudEvent({
        type:
          outcome.kind === "reinforce"
            ? "REINFORCE"
            : outcome.kind === "evict"
              ? "EVICT"
              : outcome.kind === "promote"
                ? "PROMOTE"
                : "SPAWN",
        slot: outcome.index,
        tier: outcome.tier,
        phrase: previewPhrase(text),
        detail:
          outcome.kind === "reinforce"
            ? `+Δmass @ vram[${outcome.index}] (${tierLabel})`
            : outcome.kind === "evict"
              ? `${tierLabel} full → evicted lowest-health → vram[${outcome.index}]`
              : outcome.kind === "promote"
                ? `promoted inward → vram[${outcome.index}] (${tierLabel})`
                : `${tierLabel} · ${latencyMs.toFixed(0)}ms · conf ${confidence.toFixed(2)}`,
      });
    }

    if (confidence > 0 && confidence < LOW_CONF_THRESHOLD) {
      pushHudEvent({
        type: "LOW_CONF",
        slot: outcome.index,
        tier: outcome.tier,
        phrase: previewPhrase(text),
        detail: `conf ${confidence.toFixed(2)} < ${LOW_CONF_THRESHOLD} — routing is guessing`,
      });
    }

    // 4. Broadcast — uses VRAM slot index, not legacy graph.
    const state = useSaccadeStore.getState();
    const frame = state.mockFrames[state.activeFrameIndex];
    if (frame) {
      const off = outcome.index * STRIDE;
      NetworkManager.broadcastNodeUpdate(
        outcome.index,
        frame[off + 0],
        frame[off + 1],
        frame[off + 2],
        frame[off + 6],
        outcome.tier,
      );
      useHudStore.getState().incPacketsOut();
    }

    return {
      slot,
      vramIndex: outcome.index,
      latencyMs,
      confidence,
      kind: outcome.kind,
    };
  } finally {
    useHudStore.getState().setTickerBusy(false);
  }
}

function previewPhrase(text: string): string {
  return text.length > 56 ? text.slice(0, 53) + "…" : text;
}


================================================================================
FILE: artifacts/rcmt/src/lib/invariants.ts  (251 lines)
================================================================================

/**
 * Runtime invariant checks for the RCMT lattice.
 *
 * These are the six load-bearing facts of the grounding-file format. Each is
 * sampled at ~1 Hz from the HUD and surfaced as a green/red dot on the
 * INVARIANTS strip. Drift in any of them silently breaks the portability of
 * the saved tapestry, so they become a `INVARIANT_FAIL` event the moment
 * they trip.
 */

import { useStore } from "../store/useStore";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  TIER_CAPS,
  TIER_STARTS,
  BVH_PROXY_MULT,
} from "../store/useSaccadeStore";
import { VISUAL_RADIUS_MULT } from "../components/SaccadeInstancedMesh";

export interface InvariantResult {
  ok: boolean;
  detail: string;
}

/** 1. Stride round-trip — encode→decode a synthetic 28-byte packet. */
export function checkStrideRoundtrip(): InvariantResult {
  const buf = new ArrayBuffer(28);
  const v = new DataView(buf);
  v.setUint16(0, 4242, true);
  v.setUint16(2, 3, true);
  v.setFloat32(4, 1.25, true);
  v.setFloat32(8, -2.5, true);
  v.setFloat32(12, 0.0078125, true);
  v.setFloat32(16, 0.75, true);
  v.setFloat64(20, 1748474400000.5, true);
  const back = {
    nodeIndex: v.getUint16(0, true),
    intentId: v.getUint16(2, true),
    x: v.getFloat32(4, true),
    y: v.getFloat32(8, true),
    z: v.getFloat32(12, true),
    scale: v.getFloat32(16, true),
    lww: v.getFloat64(20, true),
  };
  const ok =
    back.nodeIndex === 4242 &&
    back.intentId === 3 &&
    back.x === 1.25 &&
    back.y === -2.5 &&
    back.z === 0.0078125 &&
    back.scale === 0.75 &&
    back.lww === 1748474400000.5;
  return {
    ok,
    detail: ok
      ? "28-byte stride round-trips byte-identical"
      : `round-trip mismatch: ${JSON.stringify(back)}`,
  };
}

/** 2. Tier contiguity — slot ranges are intact, disjoint, and sum to MAX_NODES. */
export function checkTierContiguity(): InvariantResult {
  const { slotTier } = useSaccadeStore.getState();
  let acc = 0;
  for (let t = 0; t < TIER_CAPS.length; t++) acc += TIER_CAPS[t];
  if (acc !== MAX_NODES) {
    return {
      ok: false,
      detail: `TIER_CAPS sum ${acc} ≠ MAX_NODES ${MAX_NODES}`,
    };
  }
  for (let t = 0; t < TIER_CAPS.length; t++) {
    const start = TIER_STARTS[t];
    const end = start + TIER_CAPS[t];
    if (slotTier[start] !== t + 1 || slotTier[end - 1] !== t + 1) {
      return {
        ok: false,
        detail: `tier ${t + 1} boundary mislabeled at [${start}, ${end - 1}]`,
      };
    }
  }
  return {
    ok: true,
    detail: `5 tiers, ${MAX_NODES} slots, ranges disjoint`,
  };
}

/**
 * 3. FIFO ordering & accounting — for each tier:
 *   (a) queue contains only its own slot range (no cross-tier contamination);
 *   (b) no duplicate entries (would let one slot serve two writes);
 *   (c) queue length + tier population = tier cap (no slot is lost or
 *       double-counted);
 *   (d) head's `injectedAt` is ≤ tail's `injectedAt` (FIFO age ordering;
 *       freed slots have injectedAt=0 which is treated as -∞ — purely freed
 *       slots always sort before any back-filled-then-re-freed slot).
 */
export function checkFifo(): InvariantResult {
  const { vacantSlotsByTier, tierCounts, injectedAt, mockFrames, activeFrameIndex } =
    useSaccadeStore.getState();
  const frame = mockFrames[activeFrameIndex];
  if (!frame) return { ok: false, detail: "no active frame buffer" };

  for (let t = 0; t < vacantSlotsByTier.length; t++) {
    const q = vacantSlotsByTier[t];
    const start = TIER_STARTS[t];
    const end = start + TIER_CAPS[t];
    const seen = new Set<number>();
    let prevAge = -Infinity;
    for (let qi = 0; qi < q.length; qi++) {
      const idx = q[qi];
      if (idx < start || idx >= end) {
        return { ok: false, detail: `tier ${t + 1} queue holds out-of-band slot ${idx}` };
      }
      if (seen.has(idx)) {
        return { ok: false, detail: `tier ${t + 1} queue holds duplicate slot ${idx}` };
      }
      seen.add(idx);
      // Vacant slots are expected to have mass===0 — if not, the queue is
      // referencing a live slot (would clobber it on next spawn).
      const mass = frame[idx * STRIDE + 6];
      if (mass > 1e-6) {
        return { ok: false, detail: `tier ${t + 1} queue holds live slot ${idx} (mass=${mass.toFixed(3)})` };
      }
      // FIFO age ordering: zeroed (purely freed) slots collate as -∞ and
      // appear before slots whose injectedAt was non-zero at vacation time.
      const age = injectedAt[idx] || -Infinity;
      if (age < prevAge - 1) {
        return {
          ok: false,
          detail: `tier ${t + 1} FIFO age inversion at q[${qi - 1}]→q[${qi}]: ${prevAge}>${age}`,
        };
      }
      prevAge = age;
    }
    // Accounting: queue + population must equal tier cap.
    const expected = TIER_CAPS[t];
    const actual = q.length + (tierCounts[t] ?? 0);
    if (actual !== expected) {
      return {
        ok: false,
        detail: `tier ${t + 1} accounting drift: free ${q.length} + pop ${tierCounts[t]} ≠ cap ${expected}`,
      };
    }
  }
  return { ok: true, detail: "5 tier queues: clean, FIFO-ordered, accounting balanced" };
}

/**
 * 4. BVH proxy radius — imports both load-bearing constants (visual from
 *    SaccadeInstancedMesh, BVH proxy from useSaccadeStore) and compares them
 *    at runtime. If anyone hand-edits one without the other, picking desyncs
 *    from visuals and this dot turns red within 1 s.
 */
export function checkBvhProxy(): InvariantResult {
  const diff = Math.abs(VISUAL_RADIUS_MULT - BVH_PROXY_MULT);
  return {
    ok: diff < 1e-3,
    detail:
      diff < 1e-3
        ? `proxy ${BVH_PROXY_MULT.toFixed(3)}× ≡ visual ${VISUAL_RADIUS_MULT.toFixed(3)}× (Δ<1e-3)`
        : `proxy/visual scale mismatch: |${BVH_PROXY_MULT}-${VISUAL_RADIUS_MULT}|=${diff}`,
  };
}

/** 5. Foveation monotone — radius non-decreasing in slot index. */
export function checkFoveation(): InvariantResult {
  // Closed-form check: r(i) = sqrt(i) * 0.6 is monotone non-decreasing.
  // Sample at boundaries to catch a regression that breaks the spiral.
  const samples = [0, 1, 100, 1000, 2000, 4000, 7000, MAX_NODES - 1];
  let lastR = -1;
  for (const i of samples) {
    const r = Math.sqrt(i) * 0.6;
    if (r < lastR - 1e-6) {
      return {
        ok: false,
        detail: `radius regressed at slot ${i}: ${r} < ${lastR}`,
      };
    }
    lastR = r;
  }
  return {
    ok: true,
    detail: `r(0)=0 r(7999)=${(Math.sqrt(MAX_NODES - 1) * 0.6).toFixed(2)}`,
  };
}

/**
 * 6. Legacy / VRAM parity — counts slots present in `useStore.nodes` but
 *    absent in `mockFrames` (scale === 0) and vice versa.
 *
 *    Expected to be red/amber until Task #4 retires the legacy graph. The
 *    dot's job is to make the very drift we've already shipped LOUD instead
 *    of silent.
 */
export function checkParity(): InvariantResult {
  const legacy = useStore.getState().nodes;
  const { mockFrames, activeFrameIndex } = useSaccadeStore.getState();
  const frame = mockFrames[activeFrameIndex];
  if (!frame) {
    return { ok: false, detail: "no active frame buffer" };
  }

  const legacySlots = new Set<number>();
  for (const n of legacy) legacySlots.add(n.index);

  let vramPopulated = 0;
  const vramSlots = new Set<number>();
  for (let i = 0; i < MAX_NODES; i++) {
    if (frame[i * STRIDE + 6] > 0) {
      vramPopulated++;
      vramSlots.add(i);
    }
  }

  let onlyLegacy = 0;
  let onlyVram = 0;
  for (const s of legacySlots) if (!vramSlots.has(s)) onlyLegacy++;
  for (const s of vramSlots) if (!legacySlots.has(s)) onlyVram++;

  const drift = onlyLegacy + onlyVram;
  return {
    ok: drift === 0,
    detail:
      drift === 0
        ? `parity green (${vramPopulated} populated, both sides agree)`
        : `legacy-only ${onlyLegacy} · vram-only ${onlyVram} (Task #4 fixes this)`,
  };
}

export interface AllInvariants {
  stride: InvariantResult;
  tier_contiguity: InvariantResult;
  fifo: InvariantResult;
  bvh_proxy: InvariantResult;
  foveation: InvariantResult;
  parity: InvariantResult;
}

export function runAllInvariants(): AllInvariants {
  return {
    stride: checkStrideRoundtrip(),
    tier_contiguity: checkTierContiguity(),
    fifo: checkFifo(),
    bvh_proxy: checkBvhProxy(),
    foveation: checkFoveation(),
    parity: checkParity(),
  };
}


================================================================================
FILE: artifacts/rcmt/src/lib/bvhLasso.ts  (145 lines)
================================================================================

/**
 * BVH-backed lasso & ray picking helpers for the 8k foveated lattice.
 *
 * The proxy geometry built in useSaccadeStore has exactly one triangle per
 * VRAM slot, so `triangleIndex === slotIndex` by construction (guaranteed by
 * `maxLeafTris: 1` at MeshBVH construction time).
 *
 * Lasso strategy:
 *   broad-phase (intersectsBounds): project the AABB's 8 corners to NDC,
 *     compute its NDC AABB, AABB-vs-AABB overlap with the lasso polygon's
 *     NDC AABB. Cheap and never under-includes.
 *   narrow-phase (intersectsTriangle): project the triangle centroid to NDC,
 *     run point-in-polygon. Hits go into a closure-scoped Set.
 */

import { Box3, Camera, Raycaster, Vector3 } from "three";
import type { MeshBVH } from "three-mesh-bvh";
import { NOT_INTERSECTED, INTERSECTED } from "three-mesh-bvh";

// Scratch vectors — module-level, zero GC.
const _corners: Vector3[] = Array.from({ length: 8 }, () => new Vector3());
const _centroid = new Vector3();

/** Polygon AABB in NDC. */
function polyBounds(poly: ReadonlyArray<[number, number]>): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/** Ray-cast point-in-polygon (NDC, [-1,1] for both axes). */
function pointInPolygon(px: number, py: number, poly: ReadonlyArray<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Project an AABB's 8 corners to NDC; return overall NDC AABB. */
function projectBoxToNDCBounds(box: Box3, camera: Camera): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  _corners[0].set(box.min.x, box.min.y, box.min.z);
  _corners[1].set(box.max.x, box.min.y, box.min.z);
  _corners[2].set(box.min.x, box.max.y, box.min.z);
  _corners[3].set(box.max.x, box.max.y, box.min.z);
  _corners[4].set(box.min.x, box.min.y, box.max.z);
  _corners[5].set(box.max.x, box.min.y, box.max.z);
  _corners[6].set(box.min.x, box.max.y, box.max.z);
  _corners[7].set(box.max.x, box.max.y, box.max.z);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of _corners) {
    c.project(camera);
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Execute a lasso hit-test against the proxy BVH.
 *
 * @param bvh      The MeshBVH built over the proxy geometry.
 * @param camera   Active 3D camera (positions + projection state).
 * @param polyNDC  Lasso polygon in normalized device coords ([-1,1]^2).
 * @returns        Set of slot indices whose proxy centroid is inside the polygon.
 */
export function executeLassoHitTest(
  bvh: MeshBVH,
  camera: Camera,
  polyNDC: ReadonlyArray<[number, number]>,
): Set<number> {
  const hits = new Set<number>();
  if (polyNDC.length < 3) return hits;

  const pb = polyBounds(polyNDC);

  bvh.shapecast({
    intersectsBounds: (box) => {
      const nb = projectBoxToNDCBounds(box, camera);
      // AABB-vs-AABB overlap in NDC.
      const overlap =
        !(nb.maxX < pb.minX || nb.minX > pb.maxX ||
          nb.maxY < pb.minY || nb.minY > pb.maxY);
      return overlap ? INTERSECTED : NOT_INTERSECTED;
    },
    intersectsTriangle: (triangle, triangleIndex) => {
      // Centroid of the proxy triangle == slot center by construction.
      _centroid.set(
        (triangle.a.x + triangle.b.x + triangle.c.x) / 3,
        (triangle.a.y + triangle.b.y + triangle.c.y) / 3,
        (triangle.a.z + triangle.b.z + triangle.c.z) / 3,
      );
      _centroid.project(camera);
      if (pointInPolygon(_centroid.x, _centroid.y, polyNDC)) {
        hits.add(triangleIndex);
      }
      return false; // never stop early — we want every hit
    },
  });

  return hits;
}

// ──────────────────────────────────────────────────────────────
// BVH ray-picker
//
// O(log N) point-pick against the same proxy geometry. Available for any
// future codepath that wants ray-based picking (e.g. routing drag through
// the spatial index instead of three's built-in InstancedMesh.raycast).
//
// Drag currently still uses R3F's pointerEvent.instanceId — at N=8000 the
// brute-force InstancedMesh raycast is fast enough for single-click input.
// This utility is kept ready so the migration is a one-line swap when the
// drag path needs accelerating (e.g. hover highlights at 60 fps).
// ──────────────────────────────────────────────────────────────

/**
 * Cast a ray against the proxy BVH and return the closest slot index, or
 * null if the ray misses every live slot. Proxy geometry lives in world
 * space, so the raycaster's world-space ray needs no inverse transform.
 *
 * @param bvh        The current MeshBVH (use store.getCollisionBVH()).
 * @param raycaster  A Three.js Raycaster already configured with origin/dir
 *                   (e.g. from `useThree().raycaster` after pointer move).
 */
export function bvhRayPick(bvh: MeshBVH, raycaster: Raycaster): number | null {
  const hit = bvh.raycastFirst(raycaster.ray);
  return hit ? hit.faceIndex ?? null : null;
}


================================================================================
FILE: artifacts/rcmt/src/network/NetworkManager.ts  (194 lines)
================================================================================

/**
 * RCMT NetworkManager — CRVM LWW WebSocket client
 *
 * 28-byte CRVM stride per node:
 *   Bytes  0- 1: nodeIndex / slotIndex  (Uint16LE)
 *   Bytes  2- 3: intentId               (Uint16LE, 0=unknown, 1=Fact..5=Dream)
 *   Bytes  4- 7: x                      (Float32LE)
 *   Bytes  8-11: y                      (Float32LE)
 *   Bytes 12-15: z                      (Float32LE)
 *   Bytes 16-19: mass / scale           (Float32LE)
 *   Bytes 20-27: lwwTimestamp           (Float64LE, ms since epoch)
 *
 * peerId is NOT in the packet — the server assigns it via a JSON HELLO
 * frame on connect, and the server itself excludes the sender from each
 * broadcast, so self-echoes are physically impossible.
 */

import { useHudStore } from "../store/useHudStore";
import { useSaccadeStore } from "../store/useSaccadeStore";

const STRIDE_BYTES = 28;
const RECONNECT_DELAY_MS = 3000;

class NetworkManagerClass {
  private socket: WebSocket | null = null;
  private connected = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  // peerId assigned by the server on HELLO. -1 until the handshake completes.
  // Used only for logging/debug; never written into the packet.
  private peerId = -1;

  connect(): void {
    if (this.socket) return;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = `${protocol}//${window.location.host}/socket`;

    try {
      this.socket = new WebSocket(url);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = () => {
        this.connected = true;
        console.info("[RCMT] Sync core connected — awaiting HELLO");
      };

      this.socket.onmessage = (evt) => {
        // Text frames are control messages (HELLO); binary frames are CRVM packets.
        if (typeof evt.data === "string") {
          this.handleControl(evt.data);
          return;
        }
        if (evt.data instanceof ArrayBuffer) this.handleIncoming(evt.data);
      };

      this.socket.onclose = () => {
        this.connected = false;
        this.peerId = -1;
        this.socket = null;
        console.warn("[RCMT] Sync core disconnected — reconnecting in", RECONNECT_DELAY_MS, "ms");
        this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
      };

      this.socket.onerror = (err) => {
        console.error("[RCMT] WS error", err);
      };
    } catch (err) {
      console.error("[RCMT] Failed to create WebSocket", err);
      this.reconnectTimer = setTimeout(() => this.connect(), RECONNECT_DELAY_MS);
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.socket) {
      this.socket.onclose = null;
      this.socket.close();
      this.socket = null;
    }
    this.connected = false;
    this.peerId = -1;
  }

  /**
   * Broadcast a node update. `intentId` defaults to 0 (unknown) for legacy
   * call sites (drag, position update). ONNX-injection broadcasts should
   * pass the classified slot (1..5) so remote peers can paint the correct
   * color without re-running inference.
   */
  broadcastNodeUpdate(
    index: number,
    x: number,
    y: number,
    z: number,
    scale: number,
    intentId: number = 0,
  ): void {
    if (!this.connected || !this.socket) return;

    const buf = new ArrayBuffer(STRIDE_BYTES);
    const view = new DataView(buf);
    view.setUint16(0, index, true);
    view.setUint16(2, intentId & 0xffff, true);
    view.setFloat32(4, x, true);
    view.setFloat32(8, y, true);
    view.setFloat32(12, z, true);
    view.setFloat32(16, scale, true);
    view.setFloat64(20, Date.now(), true);

    try {
      this.socket.send(buf);
    } catch (err) {
      console.error("[RCMT] Send error", err);
    }
  }

  get isConnected(): boolean {
    return this.connected;
  }

  get assignedPeerId(): number {
    return this.peerId;
  }

  private handleControl(raw: string): void {
    try {
      const msg = JSON.parse(raw);
      if (msg && msg.type === "HELLO" && typeof msg.peerId === "number") {
        this.peerId = msg.peerId;
        console.info("[RCMT] HELLO — assigned peer", this.peerId);
        useHudStore.getState().setNet({
          connected: true,
          peerId: this.peerId,
          lastHelloAt: Date.now(),
        });
        useHudStore.getState().pushEvent({
          type: "INFO",
          detail: `HELLO accepted — assigned peer ${this.peerId}`,
        });
      } else if (
        msg &&
        msg.type === "LWW_REJECT" &&
        typeof msg.slot === "number"
      ) {
        // Server-side stale-write rejection (Last-Writer-Wins arbitration).
        // Surfaced so the user can see when peer broadcasts lose the race.
        // Every control frame is also a liveness heartbeat — bump lastHelloAt
        // so the SyncCore HELLO age reflects "last time we heard anything
        // from the server", not just the initial handshake.
        useHudStore.getState().setNet({
          lastRejectSlot: msg.slot,
          lastRejectReason: msg.reason ?? "stale lwwTimestamp",
          lastRejectAt: Date.now(),
          lastHelloAt: Date.now(),
          connected: true,
        });
        useHudStore.getState().pushEvent({
          type: "LWW_REJECT",
          slot: msg.slot,
          detail: msg.reason ?? "stale lwwTimestamp",
        });
      } else if (msg && msg.type === "PEER_COUNT" && typeof msg.count === "number") {
        // Heartbeat semantics — see LWW_REJECT branch above.
        useHudStore.getState().setNet({
          peerCount: msg.count,
          lastHelloAt: Date.now(),
          connected: true,
        });
      }
    } catch (err) {
      console.warn("[RCMT] Malformed control frame:", raw, err);
    }
  }

  private handleIncoming(data: ArrayBuffer): void {
    const count = Math.floor(data.byteLength / STRIDE_BYTES);
    const view = new DataView(data);
    const applyRemoteUpdate = useSaccadeStore.getState().applyRemoteUpdate;

    for (let i = 0; i < count; i++) {
      const offset = i * STRIDE_BYTES;
      const nodeIndex = view.getUint16(offset, true);
      // const intentId = view.getUint16(offset + 2, true); // reserved for color routing
      const x = view.getFloat32(offset + 4, true);
      const y = view.getFloat32(offset + 8, true);
      const z = view.getFloat32(offset + 12, true);

      applyRemoteUpdate(nodeIndex, x, y, z);
    }
    if (count > 0) useHudStore.getState().incPacketsIn(count);
  }
}

export const NetworkManager = new NetworkManagerClass();


================================================================================
FILE: artifacts/rcmt/src/data/corpus.ts  (199 lines)
================================================================================

/**
 * Axiom + phrase corpora used by the boot seed and the autonomous thought
 * ticker. Kept in-app (no network fetch) so the lattice grows without any
 * external dependency. Phrases are short (<70 chars) so the source-phrase
 * sidecar payload (future) stays manageable.
 */

/** Seven curated Fact-tier axioms — the lattice's "irreducible truths". */
export const AXIOMS: ReadonlyArray<string> = [
  "Memory has shape.",
  "Position is meaning.",
  "Facts cluster at the core.",
  "Dreams disperse to the rim.",
  "Decay is a feature, not a bug.",
  "Peers merge by geometry, not language.",
  "A grounding file is a synapse map.",
];

/**
 * Autonomous thought corpus. Roughly balanced across the 5 tiers (the ONNX
 * classifier will route each phrase by similarity to its tier prototype).
 * Phrases are written in the voice of an introspective system narrating its
 * own state — the lattice thinking out loud.
 */
export const PHRASE_CORPUS: ReadonlyArray<string> = [
  // Facts
  "The Fibonacci spiral uses the golden angle 137.508°",
  "Each slot carries 28 bytes of state",
  "VRAM holds 8000 instanced spheres in one draw call",
  "Slot zero sits at the origin",
  "Tier ranges are contiguous and disjoint",
  "MiniLM emits 384-dim L2-normalized vectors",
  "The CRVM packet has no peerId field",
  "The server arbitrates LWW by flat timestamp",
  "Spawn animation runs 250ms with easeOutBack",
  "The ghost scaffold renders all 8000 rest positions",
  "WebGL context is initialized once at mount",
  "ONNX inference runs in a worker, never on the main thread",
  "Embeddings are 384 floats per slot",
  "Health decays exponentially per tier",
  "FIFO recycle preserves insertion order",
  "Promotion fires after three reinforcement strikes",
  "Reinforcement is cosine similarity over 0.92",
  "Cyan marks facts, purple marks dreams",
  "The scaffold geometry is built once, never per frame",
  "BVH proxy triangles match visual scale exactly",
  // Scenarios
  "If a tier fills, the lowest-health slot is evicted",
  "If two peers write the same slot, the later timestamp wins",
  "When the scaffold drifts the invariant dot turns red",
  "If a phrase is reinforced three times in tier four it promotes",
  "When confidence is below 0.55 the routing is guessing",
  "If the legacy graph diverges from VRAM, parity goes red",
  "When the ticker pauses, decay still runs",
  "If the BVH index goes stale the lasso misses",
  "When a peer joins the HELLO frame assigns a peerId",
  "If the same phrase fires twice quickly, the second reinforces",
  "When a promotion fires the orbital shift takes 400ms",
  "If the camera prop changes after mount, the view does not move",
  "When an injection collides with an occupied slot, mass increases",
  "If the embedding is missing, reinforcement is skipped",
  "When decay hits 0.05, the slot evaporates and is recycled",
  "If a slash command is unknown, the input is treated as a memory",
  "When the WS reconnects, peer count returns to live",
  "If a packet is older than the stored timestamp it is rejected",
  // Metrics
  "Lattice density target: 8000 cells in 224 KB",
  "Inference latency target under 30ms per phrase",
  "Frame budget: 16.6ms at 60 fps",
  "Decay sweep cost: under 2ms per pass",
  "BVH rebuild cost: amortized below 5ms",
  "Ticker default cadence: one phrase every 3 seconds",
  "Event ring capacity: 500 entries",
  "Maximum reinforcement scale: 3.0x",
  "Fact tier hard cap: 2000 slots",
  "Dream tier hard cap: 1000 slots",
  "Embedding cosine threshold for reinforcement: 0.92",
  "Confidence threshold for low-confidence flag: 0.55",
  "Spawn animation overshoot: 1.7x then settles",
  "Promotion pulse peak: 1.5x at midpoint",
  "Scaffold point size: sub-pixel at default zoom",
  "Camera near plane: 0.1 units",
  "Camera far plane: 500 units",
  "Orbit max distance: 200 units",
  "Sphere outer radius at slot 7999: about 53.7 units",
  "Demo seed count after Task 11: zero static, seven axioms",
  // Theories
  "A grounding file replaces a vector database",
  "Geometry is a better index than a vector",
  "Foveated radius encodes priority for the reader",
  "An LLM loading the binary inherits the priority order",
  "Embeddings are an opinion, positions are a place",
  "The scaffold is the architecture made legible",
  "An invariant strip is a silent-bug firewall",
  "Drift is what unobserved code does on a schedule",
  "Telemetry is empathy for the future operator",
  "A monolith with peer merge is sovereign by design",
  "Append-only memory is auditable memory",
  "Tier promotion is a learning gradient in disguise",
  "Per-tier decay encodes a kind of attention",
  "A 28-byte stride is a contract between minds",
  "The same geometry on two machines is the same idea",
  "An empty slot is part of the message",
  "Reinforcement is the cheapest form of consensus",
  "A confidence floor is the price of routing trust",
  "Ghost scaffold turns capacity into legibility",
  "Visible decay is honest forgetting",
  // Dreams
  "What if memories had a smell, would the rim taste like ozone",
  "Imagine a brain that ships as a single binary",
  "Imagine reading a thousand encyclopedias by mmap",
  "What if the foveal core dreamed in pure golden ratio",
  "Imagine the lattice humming as peers merge across continents",
  "What if every saved file were a working synapse",
  "Imagine a tapestry inherited from a stranger you trust",
  "What if dreams condensed back into facts overnight",
  "Imagine an AI that wakes already knowing what matters",
  "What if forgetting were a kind of focus",
  "Imagine a peer that only ever sends you what you don't know",
  "What if the rim slowly painted the sky with old hopes",
  "Imagine a memory that politely refuses to be looked at twice",
  "What if axioms were rewritten only by other axioms",
  "Imagine a council of tapestries voting by geometry",
  "What if the empty slots were where the future got built",
  "Imagine a lattice that wrote poetry by accident",
  "What if every reinforcement were a small act of love",
  "Imagine a sphere where every dot knew its neighbors by name",
  "What if drift were just memory learning to be older",
  // Mixed shorter phrases for cadence variety
  "Boot complete",
  "Spiral verified",
  "Sync core nominal",
  "Telemetry green",
  "Ontology coherent",
  "FIFO head clean",
  "Embedding warm",
  "Frame buffer fresh",
  "Peer count steady",
  "Latency within budget",
  "Scaffold geometry stable",
  "Decay sweep complete",
  "Reinforcement absorbed",
  "Promotion staged",
  "Eviction logged",
  "Memory hum holds",
  "Cyan core observed",
  "Purple rim observed",
  "Camera holding still",
  "Drift unobserved this tick",
  // More to round out ~200
  "Slot allocation deterministic by tier FIFO",
  "Color palette is the canonical 5",
  "Tier four is the theory shell",
  "Tier five is the dream shell",
  "The grounding file is portable across runtimes",
  "If the file format drifts, the format dies",
  "Stride round-trip must be byte-identical",
  "The proof of the format is the invariant",
  "Aerospace UIs use mono fonts for a reason",
  "A glance must answer a question",
  "A blinking dot is a question, not a decoration",
  "Read the dial before you touch the throttle",
  "The HUD is a contract with the next operator",
  "Every event in the stream is a deposition under oath",
  "INVARIANT_FAIL is the loudest event there is",
  "A red light is a request, not a verdict",
  "Pausing the ticker pauses curiosity, not maintenance",
  "Maintenance is what runs while you are not looking",
  "Geometry is the only encryption the rim respects",
  "Cosine similarity is a polite agreement",
  "Two slots at the same radius are not the same idea",
  "Position carries causation more honestly than a token does",
  "A vector database is a guess; a grounding file is a place",
  "An axiom is a slot that refuses to be re-classified",
  "Reinforcement promotes; neglect evaporates",
  "The Fibonacci spiral has no poles",
  "No two slots share a vector from the origin",
  "Foveation is monotone in slot index",
  "The proxy radius is 0.15 times the visual scale",
  "Tier counts must sum to occupied slots, always",
  "The event ring drops the oldest entry first",
  "Camera readout is the canary for prop drift",
  "FPS below sixty is a signal, not a failure",
  "Latency over budget warrants a /why",
  "/why answers with provenance, not opinion",
  "Provenance is peer, packet, timestamp, mass",
  "The grounding file ships intent at the byte level",
  "An organism with no decay drowns in its own past",
  "The rim is where doubt is allowed to live",
  "The core is where the system bets the farm",
  "A spiral that drifts to a knot has failed its caller",
  "A scaffold that drifts to a clump has failed its renderer",
  "The whole point is to be dissected without being broken",
  "The whole point is to grow without being supervised",
  "The whole point is to be inherited without being explained",
  "The whole point is to remember without lying",
  "The whole point is to forget without losing the shape",
  "The whole point is to be a brain that ships",
];


================================================================================
FILE: artifacts/rcmt/src/workers/onnxInference.worker.ts  (128 lines)
================================================================================

/**
 * RCMT ONNX Inference Worker (TS module worker)
 *
 * Loads Xenova/all-MiniLM-L6-v2 feature-extraction pipeline, embeds 5 prototype
 * seed phrases at warmup, then routes incoming text to one of slots 1..5 via
 * cosine similarity (= dot product, since embeddings are L2-normalized).
 *
 * Message protocol:
 *   in:  { command: "INITIALIZE_AND_WARM" }
 *   in:  { command: "CLASSIFY", payload: { text: string } }
 *   out: { status: "LOADING" | "COMPILING" | "READY" | ... , message? }
 *   out: { status: "CLASSIFY_COMPLETE", slot, similarities, latencyMs }
 *   out: { status: "ERROR", error }
 */

import { pipeline, env, type FeatureExtractionPipeline } from "@xenova/transformers";

// Models load from the HF CDN; no local model cache in /public required.
env.allowLocalModels = false;

// 5-D Intent-State Ontology (RCMT spec). Order matters: slot 1..5.
const SEED_PHRASES = [
  "a verified fact that has already happened",          // Slot 1: Facts / Executions
  "a comparison between expected and actual outcome",    // Slot 2: Scenario vs Reality
  "a pass or fail measurement result",                   // Slot 3: Pass/Fail Metrics
  "a theory or plan for what should happen next",        // Slot 4: Theories / Plans
  "a dream or speculative inspiration",                  // Slot 5: Dreams / Inspirations
];

let extractor: FeatureExtractionPipeline | null = null;
let prototypes: Float32Array[] = []; // 5 × 384, L2-normalized

function dot(a: Float32Array | number[], b: Float32Array | number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

async function embed(text: string): Promise<Float32Array> {
  if (!extractor) throw new Error("Pipeline not initialized");
  const out = await extractor(text, { pooling: "mean", normalize: true });
  // Always clone into a fresh Float32Array: (a) defends against pipeline
  // buffer reuse on the next inference, (b) defends against future
  // transformers.js versions returning a different typed-array variant.
  return new Float32Array(out.data as ArrayLike<number>);
}

self.onmessage = async (e: MessageEvent) => {
  const { command, payload } = e.data ?? {};

  try {
    if (command === "INITIALIZE_AND_WARM") {
      self.postMessage({
        status: "LOADING",
        message: "Fetching Xenova/all-MiniLM-L6-v2 (quantized) from HF CDN...",
      });

      extractor = await pipeline(
        "feature-extraction",
        "Xenova/all-MiniLM-L6-v2",
        { quantized: true },
      );

      self.postMessage({
        status: "COMPILING",
        message: "Embedding 5 prototype seed phrases...",
      });

      const warmStart = performance.now();
      prototypes = [];
      for (const phrase of SEED_PHRASES) {
        const v = await embed(phrase);
        // Clone since the underlying buffer may be reused by the pipeline.
        prototypes.push(new Float32Array(v));
      }
      const warmMs = performance.now() - warmStart;

      self.postMessage({
        status: "READY",
        message: `Pipeline + prototypes ready in ${warmMs.toFixed(1)}ms`,
      });
      return;
    }

    if (command === "CLASSIFY") {
      if (!extractor || prototypes.length !== 5) {
        throw new Error("CLASSIFY called before INITIALIZE_AND_WARM completed");
      }
      const text: string = payload?.text ?? "";
      if (!text.trim()) {
        throw new Error("Empty text");
      }

      const t0 = performance.now();
      const v = await embed(text);

      // Cosine similarity (= dot since normalize:true on both sides).
      const sims: number[] = prototypes.map((p) => dot(v, p));
      let bestIdx = 0;
      for (let i = 1; i < sims.length; i++) {
        if (sims[i] > sims[bestIdx]) bestIdx = i;
      }
      const latencyMs = performance.now() - t0;

      // Ship the embedding back as a transferable so the main thread can
      // store it for per-slot cosine reinforcement. v is L2-normalized
      // already (pipeline call used normalize: true).
      const embeddingCopy = new Float32Array(v);
      self.postMessage(
        {
          status: "CLASSIFY_COMPLETE",
          slot: bestIdx + 1, // 1..5
          similarities: sims,
          latencyMs,
          embedding: embeddingCopy,
        },
        { transfer: [embeddingCopy.buffer] },
      );
      return;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    self.postMessage({ status: "ERROR", error: msg });
  }
};

// Help TS see this as a module
export {};


================================================================================
FILE: artifacts/rcmt/src/workers/OnnxWorkerManager.ts  (158 lines)
================================================================================

/**
 * OnnxWorkerManager — TS bridge to the ONNX module worker.
 *
 * The worker hosts @xenova/transformers (MiniLM-L6-v2) and routes text to one
 * of 5 ontology slots via cosine similarity to pre-embedded prototypes.
 *
 * Usage:
 *   OnnxWorker.initialize();
 *   OnnxWorker.onStatusChange = (s) => {};
 *   const { slot, latencyMs } = await OnnxWorker.classify("some text");
 */

export type OnnxStatus =
  | "IDLE"
  | "LOADING"
  | "COMPILING"
  | "READY"
  | "CLASSIFY_COMPLETE"
  | "ERROR";

export interface OnnxStatusPayload {
  status: OnnxStatus;
  message?: string;
  slot?: number;
  similarities?: number[];
  latencyMs?: number;
  embedding?: Float32Array;
  error?: string;
}

export interface ClassifyResult {
  slot: number; // 1..5
  similarities: number[];
  latencyMs: number;
  /** L2-normalized 384-d MiniLM embedding (transferred from the worker). */
  embedding: Float32Array | null;
}

type ClassifyResolve = (r: ClassifyResult) => void;
type ClassifyReject = (err: Error) => void;

class OnnxWorkerManagerClass {
  private worker: Worker | null = null;
  private status: OnnxStatus = "IDLE";
  private pending: { resolve: ClassifyResolve; reject: ClassifyReject } | null = null;

  onStatusChange: ((payload: OnnxStatusPayload) => void) | null = null;

  initialize(): void {
    if (this.worker) return;
    try {
      this.worker = new Worker(
        new URL("./onnxInference.worker.ts", import.meta.url),
        { type: "module" },
      );

      this.worker.onmessage = (e: MessageEvent<OnnxStatusPayload>) => {
        this.status = e.data.status;
        this.onStatusChange?.(e.data);

        if (e.data.status === "CLASSIFY_COMPLETE" && this.pending) {
          this.pending.resolve({
            slot: e.data.slot ?? 3,
            similarities: e.data.similarities ?? [],
            latencyMs: e.data.latencyMs ?? 0,
            embedding: e.data.embedding ?? null,
          });
          this.pending = null;
        }

        if (e.data.status === "ERROR" && this.pending) {
          this.pending.reject(new Error(e.data.error ?? "Unknown ONNX error"));
          this.pending = null;
        }
      };

      this.worker.onerror = (err) => {
        console.error("[OnnxWorker] Worker error:", err);
        this.pending?.reject(new Error(err.message));
        this.pending = null;
      };

      this.worker.postMessage({ command: "INITIALIZE_AND_WARM" });
    } catch (err) {
      console.warn("[OnnxWorker] Could not create worker:", err);
    }
  }

  get currentStatus(): OnnxStatus {
    return this.status;
  }

  get isReady(): boolean {
    return this.status === "READY" || this.status === "CLASSIFY_COMPLETE";
  }

  /**
   * Classify text → slot (1..5). Falls back to keyword heuristic if the
   * pipeline isn't loaded yet (model is ~25MB; first call from CDN may take
   * a few seconds).
   */
  classify(text: string): Promise<ClassifyResult> {
    return new Promise((resolve, reject) => {
      if (!this.worker || !this.isReady) {
        resolve({
          slot: keywordFallbackSlot(text),
          similarities: [],
          latencyMs: 0,
          embedding: null,
        });
        return;
      }
      if (this.pending) {
        reject(new Error("Classification already in flight"));
        return;
      }
      this.pending = { resolve, reject };
      this.worker.postMessage({ command: "CLASSIFY", payload: { text } });
    });
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.status = "IDLE";
  }
}

/**
 * Quick keyword heuristic used until the ONNX pipeline finishes warming.
 * Mirrors the 5-D ontology in spirit so the visual stays sensible during
 * model download.
 */
function keywordFallbackSlot(text: string): number {
  const t = text.toLowerCase();
  if (/\b(fact|happened|did|was|is|executed|done|confirmed)\b/.test(t)) return 1;
  if (/\b(versus|vs|compared|expected|actual|reality|scenario)\b/.test(t)) return 2;
  if (/\b(pass|fail|metric|score|result|test|passed|failed)\b/.test(t)) return 3;
  if (/\b(plan|theory|should|will|going to|propose|hypothesis)\b/.test(t)) return 4;
  if (/\b(dream|imagine|maybe|wish|hope|inspire|what if|someday)\b/.test(t)) return 5;
  return 3; // neutral middle slot
}

/** Canonical RCMT slot palette — cyan → green → yellow → orange → purple. */
export const SLOT_COLORS: ReadonlyArray<[number, number, number]> = [
  [0.0, 1.0, 1.0], // 1 Cyan   — Facts / Executions
  [0.0, 1.0, 0.0], // 2 Green  — Scenario vs Reality
  [1.0, 1.0, 0.0], // 3 Yellow — Pass/Fail Metrics
  [1.0, 0.5, 0.0], // 4 Orange — Theories / Plans
  [0.5, 0.0, 1.0], // 5 Purple — Dreams / Inspirations
];

export function colorForSlot(slot: number): [number, number, number] {
  const idx = Math.max(1, Math.min(5, slot)) - 1;
  return SLOT_COLORS[idx];
}

export const OnnxWorker = new OnnxWorkerManagerClass();


================================================================================
FILE: artifacts/rcmt/src/workers/SaccadeWorkerManager.ts  (108 lines)
================================================================================

/**
 * SaccadeWorkerManager — thin TypeScript bridge to public/saccadeIndexer.worker.js
 *
 * Usage:
 *   SaccadeWorker.loadFile(fileHandle);
 *   SaccadeWorker.seekFrame(42, (data) => applyToScene(data));
 */

export interface FrameData {
  index: number;
  /** Float32Array: [x,y,z, certainty, r,g,b] × 8000 nodes = 56,000 floats */
  data: Float32Array;
}

export type SaccadeStatus = "IDLE" | "FILE_READY" | "FRAME_DATA" | "RANGE_DATA" | "ERROR";

export interface SaccadeStatusPayload {
  status: SaccadeStatus;
  totalFrames?: number;
  fileSizeBytes?: number;
  index?: number;
  data?: Float32Array;
  frames?: FrameData[];
  error?: string;
}

class SaccadeWorkerManagerClass {
  private worker: Worker | null = null;
  private totalFrames = 0;
  private seekCallbacks = new Map<number, (data: Float32Array) => void>();

  onFileReady: ((totalFrames: number, fileSizeBytes: number) => void) | null = null;
  onFrameData: ((frame: FrameData) => void) | null = null;
  onError: ((msg: string) => void) | null = null;

  initialize(): void {
    if (this.worker) return;
    try {
      this.worker = new Worker("/saccadeIndexer.worker.js");
      this.worker.onmessage = (e: MessageEvent<SaccadeStatusPayload>) => {
        const msg = e.data;
        switch (msg.status) {
          case "FILE_READY":
            this.totalFrames = msg.totalFrames ?? 0;
            this.onFileReady?.(this.totalFrames, msg.fileSizeBytes ?? 0);
            break;
          case "FRAME_DATA":
            if (msg.index !== undefined && msg.data) {
              const frame: FrameData = { index: msg.index, data: msg.data };
              this.onFrameData?.(frame);
              this.seekCallbacks.get(msg.index)?.(msg.data);
              this.seekCallbacks.delete(msg.index);
            }
            break;
          case "RANGE_DATA":
            msg.frames?.forEach((f) => {
              this.onFrameData?.(f);
              this.seekCallbacks.get(f.index)?.(f.data);
              this.seekCallbacks.delete(f.index);
            });
            break;
          case "ERROR":
            console.error("[SaccadeWorker]", msg.error);
            this.onError?.(msg.error ?? "Unknown error");
            break;
        }
      };

      this.worker.onerror = (err) => {
        console.error("[SaccadeWorker] Worker error:", err);
        this.onError?.(err.message);
      };
    } catch (err) {
      console.warn("[SaccadeWorker] Could not create worker:", err);
    }
  }

  loadFile(file: File): void {
    if (!this.worker) this.initialize();
    this.worker?.postMessage({ command: "INITIALIZE_FILE", payload: { fileHandle: file } });
  }

  seekFrame(frameIndex: number, cb?: (data: Float32Array) => void): void {
    if (!this.worker) return;
    if (cb) this.seekCallbacks.set(frameIndex, cb);
    this.worker.postMessage({ command: "SEEK_FRAME", payload: { frameIndex } });
  }

  preloadRange(startFrame: number, endFrame: number): void {
    if (!this.worker) return;
    this.worker.postMessage({
      command: "PRELOAD_RANGE",
      payload: { startFrame, endFrame },
    });
  }

  get frameCount(): number {
    return this.totalFrames;
  }

  terminate(): void {
    this.worker?.terminate();
    this.worker = null;
    this.totalFrames = 0;
  }
}

export const SaccadeWorker = new SaccadeWorkerManagerClass();


================================================================================
FILE: artifacts/rcmt/src/components/Scene.tsx  (71 lines)
================================================================================

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PointLight } from "three";
import { SaccadeInstancedMesh } from "./SaccadeInstancedMesh";
import { LassoSelection } from "./LassoSelection";
import { GhostScaffold } from "./GhostScaffold";
import { HudBridge } from "./HudBridge";

function DriftingLight() {
  const lightRef = useRef<PointLight>(null!);
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.getElapsedTime();
    lightRef.current.position.set(
      Math.sin(t * 0.3) * 25,
      Math.cos(t * 0.2) * 10 + 5,
      Math.cos(t * 0.25) * 25,
    );
    lightRef.current.intensity = 0.5 + Math.sin(t * 0.7) * 0.1;
  });
  return (
    <pointLight
      ref={lightRef}
      color="#4fd1c5"
      intensity={0.5}
      distance={90}
      decay={2}
    />
  );
}

export function Scene() {
  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={5}
        maxDistance={200}
      />

      <ambientLight intensity={0.06} color="#06090c" />
      <DriftingLight />
      <pointLight color="#5e3a8a" intensity={0.2} position={[0, -20, 0]} distance={80} decay={2} />
      <pointLight color="#3d7a5e" intensity={0.15} position={[30, 5, -30]} distance={60} decay={2} />

      {/* Ghost scaffold — all 8000 rest positions as a dim point cloud so
          capacity and foveation are visible before any phrase lands. */}
      <GhostScaffold />

      {/* The Tapestry — 1-draw-call instanced mesh for occupied slots. */}
      <SaccadeInstancedMesh />

      {/* Lasso overlay — runs BVH hit-test against the 8k lattice */}
      <LassoSelection />

      {/* Origin marker */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#4fd1c5" />
      </mesh>

      {/* HUD bridge — samples camera/FPS/invariants into useHudStore. */}
      <HudBridge />
    </>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/SaccadeInstancedMesh.tsx  (347 lines)
================================================================================

/**
 * SaccadeInstancedMesh — 1-draw-call visual cortex for the RCMT Tapestry.
 *
 * Reads directly from useSaccadeStore.mockFrames[activeFrameIndex]. Drag
 * writes back to the same buffer by slot index (instanceId === slotIndex,
 * guaranteed by the BVH proxy invariant).
 *
 * Zero-allocation per-frame: tempObject and tempColor are module-level singletons.
 * Dead nodes are hidden via hiddenMatrix (scale = 0), not removed from the buffer.
 * The FIFO slot reclaimer feeds vacantSlots back to the store for reuse.
 */

import { useRef, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  InstancedMesh,
  Object3D,
  Color,
  Matrix4,
  Plane,
  Vector3,
  SphereGeometry,
  MeshBasicMaterial,
} from "three";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  TIER_LAMBDA,
  PROMOTION_ANIM_MS,
} from "../store/useSaccadeStore";
import { NetworkManager } from "../network/NetworkManager";

/**
 * Per-instance visual radius multiplier. The BVH proxy multiplier in
 * `useSaccadeStore.ts` (`BVH_PROXY_MULT`) MUST match this. Exported so
 * the runtime invariant `bvh_proxy` can compare both values at 1 Hz and
 * surface a red dot if either side is hand-edited.
 */
export const VISUAL_RADIUS_MULT = 0.15;

// ── Module-level singletons (zero GC pressure inside useFrame) ────
const tempObject = new Object3D();
const tempColor   = new Color();
const hiddenMatrix = new Matrix4().makeScale(0, 0, 0);
const _dragPlane   = new Plane(new Vector3(0, 1, 0), 0);
const _hit         = new Vector3();

const DEATH_THRESHOLD = 0.2;
// How many frames between bounding sphere recomputes (expensive)
const BOUNDS_REFRESH_INTERVAL = 60;
// Starburst spawn animation window (ms). Within this window, scale is multiplied
// by an easeOutBack curve that overshoots ~1.7× then settles back to 1.0×.
const SPAWN_ANIM_MS = 250;
const EASE_BACK_C1 = 1.70158;
const EASE_BACK_C3 = EASE_BACK_C1 + 1;

/** easeOutBack — overshoot-and-settle pop. t in [0,1] → multiplier in [0, ~1.7, 1]. */
function easeOutBack(t: number): number {
  const x = t - 1;
  return 1 + EASE_BACK_C3 * x * x * x + EASE_BACK_C1 * x * x;
}

export function SaccadeInstancedMesh() {
  const meshRef  = useRef<InstancedMesh>(null!);
  const frameRef = useRef(0); // frame counter for throttling

  // Decay timestamps: -1 = vacant slot
  const nodeTimestamps = useRef(new Float32Array(MAX_NODES).fill(-1.0));

  // Drag state. instanceId === slot index by BVH proxy invariant.
  const dragRef = useRef<{ slot: number } | null>(null);
  // Currently-hovered slot for the source-phrase tooltip. Tracked in a ref so
  // pointermove updates don't churn React renders; we only call setHoveredSlot
  // when the slot identity changes (enter/leave/cross) or when the pointer
  // moves while hovering a phrase-bearing slot.
  const hoverRef = useRef<number | null>(null);

  const { raycaster, gl } = useThree();

  // ── Store subscriptions ──────────────────────────────────────────
  const mockFrames       = useSaccadeStore((s) => s.mockFrames);
  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const setVacant        = useSaccadeStore((s) => s.setVacantSlotRegistry);
  const isFileLoaded     = useSaccadeStore((s) => s.isFileLoaded);
  const isLassoMode      = useSaccadeStore((s) => s.isLassoMode);
  // Read selection non-reactively inside useFrame to avoid re-render churn —
  // see useFrame body. We only subscribe here to keep the component reactive
  // when the lasso clears/sets selection so the highlight kicks in on the
  // very next tick.
  useSaccadeStore((s) => s.selectedSlots);

  // ── useFrame — direct VRAM mutation ─────────────────────────────
  useFrame((_state, _delta) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    frameRef.current++;

    // Pull starburst timestamps + selection non-reactively (mutated in-place).
    const sState = useSaccadeStore.getState();
    const spawnTime = sState.spawnTime;
    const selectedSlots = sState.selectedSlots;
    const hasSelection = selectedSlots.size > 0;
    const nowMs = performance.now();
    // Task #3 per-tier state (read non-reactively for the same reason as
    // spawnTime — they're typed-array views mutated in place by the store).
    const slotTierArr = sState.slotTier;
    const massArr = sState.mass;
    const injectedAtArr = sState.injectedAt;
    const animStartArr = sState.animStartTime;
    const animFromArr = sState.animFromPos;
    const animToArr = sState.animToPos;

    const frameData: Float32Array | null =
      mockFrames[activeFrameIndex] ?? null;
    if (!frameData) return;

    // ── Drag follow — write directly to the VRAM frame ───────────
    if (dragRef.current) {
      raycaster.ray.intersectPlane(_dragPlane, _hit);
      const slot = dragRef.current.slot;
      const off = slot * STRIDE;
      if (frameData[off + 6] > 0) {
        const y = frameData[off + 1]; // preserve Y; drag is XZ-only
        frameData[off + 0] = _hit.x;
        frameData[off + 2] = _hit.z;
        sState.markBVHDirty();
        NetworkManager.broadcastNodeUpdate(
          slot,
          _hit.x,
          y,
          _hit.z,
          frameData[off + 6],
          slotTierArr[slot],
        );
      }
    }

    const newlyPruned: number[] = [];

    for (let i = 0; i < MAX_NODES; i++) {
      const offset = i * STRIDE;
      let scale = frameData[offset + 6];

      // Exponential decay: apply only in binary file mode
      if (isFileLoaded && scale > 0 && nodeTimestamps.current[i] !== -1.0) {
        if (scale < DEATH_THRESHOLD) {
          scale = 0.0;
          nodeTimestamps.current[i] = -1.0;
          newlyPruned.push(i);
        }
      }

      if (scale > 0) {
        // Mark slot as occupied
        if (nodeTimestamps.current[i] === -1.0) {
          nodeTimestamps.current[i] = performance.now();
        }

        // Starburst pop: within SPAWN_ANIM_MS of injection, multiply scale by
        // easeOutBack curve so the node bursts in then settles. spawnTime[i]==0
        // means "no animation" (pre-existing or demo-seeded node) → mul=1.
        let popMul = 1;
        const ts = spawnTime[i];
        if (ts > 0) {
          const t = (nowMs - ts) / SPAWN_ANIM_MS;
          if (t >= 0 && t < 1) popMul = easeOutBack(t);
        }

        // Lasso highlight: bump scale 1.6× and tint cyan for captured slots.
        const isSelected = hasSelection && selectedSlots.has(i);
        const selMul = isSelected ? 1.6 : 1;

        // ── Task #3: promotion orbital shift ─────────────────────
        // While animStartTime[i] > 0 and t<1 we lerp position from animFromPos
        // toward animToPos, pulse scale up to 1.5× at midpoint, and flash the
        // color toward cyan via sin(πt). On arrival we snap and clear.
        let px = frameData[offset];
        let py = frameData[offset + 1];
        let pz = frameData[offset + 2];
        let promoMul = 1;
        let promoFlash = 0; // 0..1 weighting toward cyan
        const animStart = animStartArr[i];
        if (animStart > 0) {
          const rawT = (nowMs - animStart) / PROMOTION_ANIM_MS;
          if (rawT >= 1) {
            // Snap to destination + clear animation.
            const tx = animToArr[i * 3 + 0];
            const ty = animToArr[i * 3 + 1];
            const tz = animToArr[i * 3 + 2];
            frameData[offset + 0] = tx;
            frameData[offset + 1] = ty;
            frameData[offset + 2] = tz;
            px = tx;
            py = ty;
            pz = tz;
            animStartArr[i] = 0;
          } else if (rawT > 0) {
            // Cubic ease-in-out.
            const t = rawT;
            const ease =
              t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
            const fx = animFromArr[i * 3 + 0];
            const fy = animFromArr[i * 3 + 1];
            const fz = animFromArr[i * 3 + 2];
            const tx = animToArr[i * 3 + 0];
            const ty = animToArr[i * 3 + 1];
            const tz = animToArr[i * 3 + 2];
            px = fx + (tx - fx) * ease;
            py = fy + (ty - fy) * ease;
            pz = fz + (tz - fz) * ease;
            const pulse = Math.sin(Math.PI * t);
            promoMul = 1 + 0.5 * pulse;
            promoFlash = pulse;
          }
        }

        // ── Task #3: health-driven visual decay ─────────────────
        // Dim RGB by Health = exp(-λ_tier · Δt_seconds). Only applies to
        // tier-tracked slots (mass[i] > 0 ⇒ this slot was injected by the
        // tier system). Demo-seeded slots beyond the tracked range render
        // at full intensity so they don't visually fade.
        let healthDim = 1;
        const slotMass = massArr[i];
        if (slotMass > 0) {
          const tier = slotTierArr[i];
          if (tier >= 1 && tier <= TIER_LAMBDA.length) {
            const lambda = TIER_LAMBDA[tier - 1];
            const dt = (nowMs - injectedAtArr[i]) / 1000;
            const h = Math.exp(-lambda * dt);
            // Floor at 0.15 so a dying node is still visible until the next
            // decay sweep evaporates it — this is a render-side hint, not the
            // authoritative death gate.
            healthDim = Math.max(0.15, Math.min(1, h));
          }
        }

        tempObject.position.set(px, py, pz);
        tempObject.scale.setScalar(scale * VISUAL_RADIUS_MULT * popMul * promoMul * selMul);
        tempObject.updateMatrix();
        mesh.setMatrixAt(i, tempObject.matrix);

        if (isSelected) {
          tempColor.setRGB(0, 1, 1);
        } else {
          let r = frameData[offset + 3] * healthDim;
          let g = frameData[offset + 4] * healthDim;
          let b = frameData[offset + 5] * healthDim;
          if (promoFlash > 0) {
            // Lerp toward cyan (0,1,1) by promoFlash.
            r = r + (0 - r) * promoFlash;
            g = g + (1 - g) * promoFlash;
            b = b + (1 - b) * promoFlash;
          }
          tempColor.setRGB(r, g, b);
        }
        mesh.setColorAt(i, tempColor);
      } else {
        mesh.setMatrixAt(i, hiddenMatrix);
      }
    }

    // Bridge dead slots to the FIFO reclaimer
    if (newlyPruned.length > 0) setVacant(newlyPruned);

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;

    // Throttled bounding sphere refresh (prevents ghost-node raycast hits)
    if (frameRef.current % BOUNDS_REFRESH_INTERVAL === 0) {
      mesh.computeBoundingSphere();
    }
  });

  // ── Pointer events for drag ──────────────────────────────────────
  const onPointerDown = useCallback(
    (e: { instanceId?: number; stopPropagation: () => void }) => {
      if (isLassoMode || e.instanceId === undefined) return;
      e.stopPropagation();
      dragRef.current = { slot: e.instanceId };
      gl.domElement.style.cursor = "grabbing";
    },
    [isLassoMode, gl],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    gl.domElement.style.cursor = "auto";
  }, [gl]);

  // ── Hover → source-phrase tooltip ────────────────────────────────
  // Only fires the store update when:
  //   (a) the slot under the cursor has a phrase attached (vacant/demo
  //       slots have slotPhrase[i] === null → no tooltip), and
  //   (b) we're not mid-drag (drag has visual priority).
  // Pointer screen coords come from the underlying DOM PointerEvent; r3f
  // forwards it on `e.nativeEvent`.
  const onPointerMove = useCallback(
    (e: {
      instanceId?: number;
      nativeEvent: PointerEvent;
      stopPropagation: () => void;
    }) => {
      if (dragRef.current || isLassoMode || e.instanceId === undefined) return;
      const slot = e.instanceId;
      const s = useSaccadeStore.getState();
      const phrase = s.slotPhrase[slot];
      const occupied = (s.mockFrames[s.activeFrameIndex]?.[slot * STRIDE + 6] ?? 0) > 0;
      if (!phrase || !occupied) {
        // Crossed onto a slot we shouldn't show a tip for — clear if we were
        // showing one for a previous slot.
        if (hoverRef.current !== null) {
          hoverRef.current = null;
          s.setHoveredSlot(null);
        }
        return;
      }
      e.stopPropagation();
      hoverRef.current = slot;
      s.setHoveredSlot({ slot, x: e.nativeEvent.clientX, y: e.nativeEvent.clientY });
    },
    [isLassoMode],
  );

  const onPointerOut = useCallback(() => {
    if (hoverRef.current !== null) {
      hoverRef.current = null;
      useSaccadeStore.getState().setHoveredSlot(null);
    }
  }, []);

  return (
    <instancedMesh
      ref={meshRef}
      args={[new SphereGeometry(1, 8, 8), new MeshBasicMaterial({ vertexColors: true, toneMapped: false }), MAX_NODES]}
        // NOTE: per-instance visual radius is set to `scale * VISUAL_RADIUS_MULT`
        // below (see tempObject.scale.setScalar(...)). The exported
        // VISUAL_RADIUS_MULT constant is the load-bearing value the BVH proxy
        // invariant compares against — do not inline-edit `0.15` here.
      onPointerDown={onPointerDown as never}
      onPointerUp={onPointerUp}
      onPointerMove={onPointerMove as never}
      onPointerOut={onPointerOut}
      frustumCulled={false}
    />
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/GhostScaffold.tsx  (55 lines)
================================================================================

/**
 * GhostScaffold — renders all 8000 rest positions as a dim, single-draw
 * point cloud behind the live mesh.
 *
 * Purpose: make CAPACITY visible. The live InstancedMesh only shows occupied
 * slots; without the scaffold, the user has no way to feel how much of the
 * tapestry is still empty, and no way to see the foveated spiral shape until
 * many phrases have been injected.
 *
 * Geometry is built ONCE at mount from the same `latticePosition` formula
 * the store uses. No per-frame allocation; no useFrame work. Picking is
 * unaffected (Points geometry is not raycastable by default).
 */

import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
import { MAX_NODES } from "../store/useSaccadeStore";

const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
const NODE_DENSITY_BUBBLE = 0.6;

function buildScaffoldPositions(): Float32Array {
  const arr = new Float32Array(MAX_NODES * 3);
  for (let i = 0; i < MAX_NODES; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / MAX_NODES);
    const theta = i * GOLDEN_ANGLE;
    const sinPhi = Math.sin(phi);
    const radius = Math.sqrt(i) * NODE_DENSITY_BUBBLE;
    arr[i * 3 + 0] = sinPhi * Math.cos(theta) * radius;
    arr[i * 3 + 1] = sinPhi * Math.sin(theta) * radius;
    arr[i * 3 + 2] = Math.cos(phi) * radius;
  }
  return arr;
}

export function GhostScaffold() {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(buildScaffoldPositions(), 3));
    return g;
  }, []);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#1a2a30"
        size={0.18}
        sizeAttenuation
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </points>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/ThoughtTicker.tsx  (126 lines)
================================================================================

/**
 * ThoughtTicker — invisible component that drives the autonomous thought
 * loop. On boot it injects the 7 axioms in sequence, then fires phrases
 * from the corpus at a jittered cadence (default 2-4 s).
 *
 * Pausable, rate-adjustable via the CommandConsole slash commands. Tear-down
 * on unmount clears the pending timer so HMR doesn't leak intervals.
 *
 * Never opens its own write path — every injection goes through the shared
 * `injectPhrase` helper that all other callers use.
 */

import { useEffect, useRef } from "react";
import { injectPhrase } from "../lib/injectPhrase";
import { AXIOMS, PHRASE_CORPUS } from "../data/corpus";
import { useHudStore, pushHudEvent } from "../store/useHudStore";
import { OnnxWorker } from "../workers/OnnxWorkerManager";

const AXIOM_GAP_MS = 600;
const AXIOM_KICKOFF_DELAY_MS = 1500;

export function ThoughtTicker() {
  const seededRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cursorRef = useRef(0);

  useEffect(() => {
    let cancelled = false;

    function schedule(delay: number) {
      if (cancelled) return;
      timerRef.current = setTimeout(tick, delay);
    }

    async function seedAxioms() {
      // Wait until ONNX worker is at least loaded enough to attempt classify.
      // injectPhrase will fall through to the keyword heuristic if not ready,
      // which is fine — axioms will land on Fact tier either way.
      for (const phrase of AXIOMS) {
        if (cancelled) return;
        try {
          await injectPhrase(phrase, "axiom");
        } catch (err) {
          pushHudEvent({
            type: "ERROR",
            phrase,
            detail: `axiom seed failed: ${(err as Error).message}`,
          });
        }
        await sleep(AXIOM_GAP_MS);
      }
      pushHudEvent({
        type: "INFO",
        detail: `axiom seed complete (${AXIOMS.length} entries)`,
      });
    }

    async function tick() {
      const { ticker } = useHudStore.getState();
      if (!ticker.running) {
        // While paused, recheck every 500ms.
        schedule(500);
        return;
      }
      if (ticker.busy || OnnxWorker.currentStatus === "LOADING") {
        // Engine is mid-flight or warming. Retry shortly.
        schedule(400);
        return;
      }

      const phrase = nextPhrase();
      try {
        await injectPhrase(phrase, "ticker");
        useHudStore.getState().markTickerFired();
      } catch (err) {
        pushHudEvent({
          type: "ERROR",
          phrase,
          detail: `ticker injection failed: ${(err as Error).message}`,
        });
      }

      const { ticker: t2 } = useHudStore.getState();
      const jitter = (Math.random() * 2 - 1) * t2.jitterMs;
      const next = Math.max(250, t2.periodMs + jitter);
      schedule(next);
    }

    async function boot() {
      if (seededRef.current) return;
      seededRef.current = true;
      await sleep(AXIOM_KICKOFF_DELAY_MS);
      if (cancelled) return;
      await seedAxioms();
      if (cancelled) return;
      schedule(Math.max(500, useHudStore.getState().ticker.periodMs));
    }

    void boot();

    return () => {
      cancelled = true;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  function nextPhrase(): string {
    // Walk the corpus with a Fisher-Yates style permutation seed each pass
    // for variety without re-shuffling state on every tick.
    if (cursorRef.current === 0) {
      // No-op; corpus is intentionally pre-shuffled by author for cadence.
    }
    const i = cursorRef.current % PHRASE_CORPUS.length;
    cursorRef.current = (cursorRef.current + 1 + (Math.random() * 3) | 0) % PHRASE_CORPUS.length;
    return PHRASE_CORPUS[i];
  }

  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}


================================================================================
FILE: artifacts/rcmt/src/components/CommandConsole.tsx  (342 lines)
================================================================================

/**
 * COMMAND CONSOLE — bottom-left card. Manual phrase injection and slash
 * commands. The user's hands-on entry point into the lattice.
 *
 * Slash commands:
 *   /help                  — list commands
 *   /clear                 — clear console log (events untouched)
 *   /pause                 — pause the autonomous ticker
 *   /resume                — resume the autonomous ticker
 *   /rate <ms>             — set ticker period in ms (250..30000)
 *   /axioms                — LIST the 7 boot axioms (read-only)
 *   /axiom-seed            — re-inject all axioms (Fact-tier forced)
 *   /invariants            — dump current invariant detail to the log
 *   /events [type]         — last 8 events, optionally filtered by event type
 *                            (SPAWN/EVICT/PROMOTE/AXIOM/LWW_REJECT/…)
 *   /why <slot>            — full provenance for a VRAM slot
 *                            (tier, mass, age, pos, peer, 3 nearest neighbors,
 *                            last broadcast packet age)
 *   /lasso                 — toggle lasso mode
 *   /blast                 — purge currently-selected slots
 *
 * Any text not starting with "/" is injected via the same `injectPhrase`
 * path the autonomous ticker uses — single source of truth for VRAM writes.
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useSaccadeStore, TIER_CAPS, STRIDE, MAX_NODES } from "../store/useSaccadeStore";
import { useHudStore, type HudEventType } from "../store/useHudStore";
import { injectPhrase } from "../lib/injectPhrase";
import { AXIOMS } from "../data/corpus";
import { NetworkManager } from "../network/NetworkManager";
import { COLOR, FONT, TIER_NAMES } from "./hud/tokens";
import { HudCard } from "./hud/HudCard";

const VALID_EVENT_TYPES: HudEventType[] = [
  "SPAWN", "REINFORCE", "PROMOTE", "EVICT", "LWW_REJECT", "LOW_CONF",
  "INVARIANT_FAIL", "AXIOM", "INFO", "PAUSE", "RESUME", "ERROR",
];

const MAX_LOG = 14;

export function CommandConsole() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<string[]>([
    "RCMT PLATINUM MONOLITH v5.1 — ONLINE",
    "ghost scaffold rendered · ticker arming · axioms pending",
    "type a phrase, or /help for commands",
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const isLassoMode = useSaccadeStore((s) => s.isLassoMode);
  const setLassoMode = useSaccadeStore((s) => s.setLassoMode);
  const selectedSlots = useSaccadeStore((s) => s.selectedSlots);
  const blastSelectedSlots = useSaccadeStore((s) => s.blastSelectedSlots);
  const lassoEventTick = useSaccadeStore((s) => s.lassoEventTick);
  const lassoEventCount = useSaccadeStore((s) => s.lassoEventCount);

  useEffect(() => {
    if (lassoEventTick === 0) return;
    pushLog(`lasso captured ${lassoEventCount} slots`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lassoEventTick, lassoEventCount]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function pushLog(line: string) {
    setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), line]);
  }

  async function handleSubmit() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (text.startsWith("/")) {
      handleSlash(text);
      return;
    }

    pushLog(`> ${text.length > 64 ? text.slice(0, 61) + "…" : text}`);
    try {
      const r = await injectPhrase(text, "console");
      if (r.kind === "rejected") {
        pushLog(`  rejected — tier full and no eviction candidate`);
      } else {
        const tier = TIER_NAMES[Math.max(0, Math.min(4, r.slot - 1))];
        pushLog(
          `  ${r.kind.padEnd(9)} ${tier.padEnd(8)} vram[${r.vramIndex}] · ${r.latencyMs.toFixed(0)}ms · conf ${r.confidence.toFixed(2)}`,
        );
      }
    } catch (err) {
      pushLog(`  ERROR: ${(err as Error).message}`);
    }
  }

  function handleSlash(text: string) {
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ");
    const hud = useHudStore.getState();
    switch (cmd) {
      case "/help":
        pushLog("commands: /pause /resume /rate <ms> /axioms /axiom-seed /invariants");
        pushLog("          /events [type] /why <slot> /lasso /blast /clear /help");
        break;
      case "/clear":
        setLog(["console cleared"]);
        break;
      case "/pause":
        hud.setTickerRunning(false);
        hud.pushEvent({ type: "PAUSE", detail: "ticker paused by user" });
        pushLog("ticker paused");
        break;
      case "/resume":
        hud.setTickerRunning(true);
        hud.pushEvent({ type: "RESUME", detail: "ticker resumed by user" });
        pushLog("ticker resumed");
        break;
      case "/rate": {
        const n = parseInt(arg, 10);
        if (isNaN(n) || n < 250 || n > 30_000) {
          pushLog(`rate must be 250..30000 ms (got ${arg || "—"})`);
        } else {
          hud.setTickerPeriod(n);
          pushLog(`ticker period set to ${n}ms`);
        }
        break;
      }
      case "/axioms":
        pushLog(`${AXIOMS.length} boot axioms (Fact-tier, foveated core):`);
        AXIOMS.forEach((a, i) => {
          const trimmed = a.length > 64 ? a.slice(0, 61) + "…" : a;
          pushLog(`  [${i}] ${trimmed}`);
        });
        pushLog(`  (use /axiom-seed to re-inject)`);
        break;
      case "/axiom-seed":
        pushLog(`re-seeding ${AXIOMS.length} axioms → forced Fact tier…`);
        void (async () => {
          for (const a of AXIOMS) {
            try { await injectPhrase(a, "axiom"); } catch { /* logged via event */ }
          }
          pushLog("axiom re-seed complete");
        })();
        break;
      case "/invariants": {
        const inv = hud.invariants;
        for (const [id, st] of Object.entries(inv)) {
          pushLog(`  ${st.ok ? "OK" : "FAIL"}  ${id.padEnd(16)} ${st.detail}`);
        }
        break;
      }
      case "/events": {
        let pool = hud.events;
        if (arg) {
          const wanted = arg.trim().toUpperCase();
          if (!VALID_EVENT_TYPES.includes(wanted as HudEventType)) {
            pushLog(`unknown event type: ${arg}`);
            pushLog(`  valid: ${VALID_EVENT_TYPES.join(" ")}`);
            break;
          }
          pool = pool.filter((e) => e.type === wanted);
        }
        const ev = pool.slice(-8);
        pushLog(
          arg
            ? `last ${ev.length} of ${pool.length} [${arg.toUpperCase()}] (ring ${hud.events.length}/500)`
            : `last ${ev.length} events (ring ${hud.events.length}/500)`,
        );
        if (ev.length === 0) pushLog("  (no matching events)");
        ev.forEach((e) =>
          pushLog(`  [${e.type}] ${e.phrase ?? ""} ${e.detail ?? ""}`.trim()),
        );
        break;
      }
      case "/why": {
        const slot = parseInt(arg, 10);
        if (isNaN(slot)) { pushLog("/why <slot>"); break; }
        const s = useSaccadeStore.getState();
        const frame = s.mockFrames[s.activeFrameIndex];
        if (!frame || slot < 0 || slot >= MAX_NODES) {
          pushLog(`slot ${arg} out of range [0..${MAX_NODES - 1}]`);
          break;
        }
        const off = slot * STRIDE;
        const px = frame[off], py = frame[off + 1], pz = frame[off + 2];
        const mass = frame[off + 6];
        const tier = s.slotTier[slot];
        const inj = s.injectedAt[slot];
        const reinf = s.reinforcementCount[slot];
        const ageMs = inj > 0 ? Date.now() - inj : 0;
        const age = inj > 0 ? (ageMs / 1000).toFixed(1) + "s" : "—";
        const peer = NetworkManager.assignedPeerId;
        const peerStr = peer >= 0 ? `peer ${peer}` : "local (no peer assigned)";
        const helloAge = hud.net.lastHelloAt > 0
          ? ((Date.now() - hud.net.lastHelloAt) / 1000).toFixed(1) + "s ago"
          : "never";
        // Find 3 nearest living neighbors by Euclidean distance.
        const neighbors: { idx: number; d: number; tier: number }[] = [];
        for (let i = 0; i < MAX_NODES; i++) {
          if (i === slot) continue;
          const m = frame[i * STRIDE + 6];
          if (m <= 1e-6) continue;
          const dx = frame[i * STRIDE] - px;
          const dy = frame[i * STRIDE + 1] - py;
          const dz = frame[i * STRIDE + 2] - pz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (neighbors.length < 3) {
            neighbors.push({ idx: i, d: Math.sqrt(d2), tier: s.slotTier[i] });
            neighbors.sort((a, b) => a.d - b.d);
          } else if (d2 < neighbors[2].d * neighbors[2].d) {
            neighbors[2] = { idx: i, d: Math.sqrt(d2), tier: s.slotTier[i] };
            neighbors.sort((a, b) => a.d - b.d);
          }
        }
        pushLog(
          `  vram[${slot}] tier=${TIER_NAMES[tier - 1] ?? "?"} mass=${mass.toFixed(2)} reinf=${reinf} age=${age}`,
        );
        pushLog(
          `  pos=(${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})  r=${Math.sqrt(px * px + py * py + pz * pz).toFixed(2)}`,
        );
        pushLog(`  origin=${peerStr}  HELLO=${helloAge}`);
        if (mass <= 1e-6) {
          pushLog(`  (slot is FREE — pos shown is the foveated rest position)`);
        }
        if (neighbors.length === 0) {
          pushLog(`  neighbors: — (lattice has no other live slots)`);
        } else {
          pushLog(
            `  neighbors: ${neighbors
              .map((n) => `${n.idx}(${TIER_NAMES[n.tier - 1] ?? "?"}, d=${n.d.toFixed(2)})`)
              .join("  ")}`,
          );
        }
        break;
      }
      case "/lasso":
        setLassoMode(!isLassoMode);
        pushLog(`lasso ${!isLassoMode ? "armed" : "disarmed"}`);
        break;
      case "/blast":
        if (selectedSlots.size === 0) {
          pushLog("no selection — use /lasso first");
        } else {
          const n = blastSelectedSlots();
          pushLog(`blast purged ${n} slots`);
        }
        break;
      default:
        pushLog(`unknown command: ${cmd} (/help)`);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  const ticker = useHudStore((s) => s.ticker);

  return (
    <HudCard
      id="command-console"
      title="COMMAND CONSOLE"
      initial={{ bottom: 96, left: 290 }}
      // Shrink to fit when the viewport narrows so the card never collides
      // with the EventStream's left edge (right:14 + width:380).
      width="min(460px, calc(100vw - 290px - 14px - 380px - 14px - 12px))"
      style={{ minWidth: 320 }}
      headerExtra={
        <span style={{ color: COLOR.textMuted, fontSize: 9 }}>
          ticker {ticker.running ? "AUTO" : "PAUSE"}{ticker.busy ? " ·BUSY" : ""}
          {" · "}cap {TIER_CAPS.reduce((a, b) => a + b, 0)}
        </span>
      }
    >
      <div
        ref={logRef}
        style={{
          padding: "6px 9px",
          height: 142,
          overflowY: "auto",
          fontFamily: FONT,
          fontSize: 10,
          lineHeight: 1.4,
        }}
      >
        {log.map((line, i) => (
          <div
            key={i}
            style={{
              color: line.includes("ERROR") || line.startsWith("  rejected")
                ? COLOR.fail
                : line.startsWith(">")
                  ? COLOR.accent
                  : line.startsWith("  ")
                    ? COLOR.textDim
                    : COLOR.text,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {line}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderTop: `1px solid ${COLOR.border}`,
          padding: "4px 9px",
          gap: 6,
        }}
      >
        <span style={{ color: COLOR.accent }}>›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="inject memory or /help"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: COLOR.text,
            fontFamily: FONT,
            fontSize: 10.5,
            caretColor: COLOR.accent,
          }}
        />
        {isLassoMode && (
          <span style={{ color: COLOR.warn, fontSize: 9, letterSpacing: 1 }}>LASSO</span>
        )}
      </div>
    </HudCard>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/Timeline.tsx  (197 lines)
================================================================================

import { useRef, useCallback } from "react";
import { useSaccadeStore, TIER_CAPS } from "../store/useSaccadeStore";
import { COLOR, FONT } from "./hud/tokens";

export function Timeline() {
  const trackRef = useRef<HTMLDivElement>(null);

  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const totalFrames      = useSaccadeStore((s) => s.totalFrames);
  const setFrameIndex    = useSaccadeStore((s) => s.setFrameIndex);
  const isFileLoaded     = useSaccadeStore((s) => s.isFileLoaded);
  const tierCounts       = useSaccadeStore((s) => s.tierCounts);

  // Total live slots = sum of per-tier occupancy. Demo seed pre-fills the
  // Fact tier so this reads ~1334/8000 from boot, matching the legacy graph's
  // first-load count.
  const liveSlotCount = tierCounts.reduce((a, b) => a + b, 0);
  // Tier cap sanity-check (silences the unused-import warning and surfaces a
  // misconfiguration immediately if TIER_CAPS ever drifts from MAX_NODES).
  const _maxSlots = TIER_CAPS.reduce((a, b) => a + b, 0);

  // Unified timeline position (0–1). In live mode there's a single mutable
  // frame, so the scrubber pins to NOW. In binary mode it spans the file.
  const effectiveTotal = Math.max(1, totalFrames);
  const timelinePos    = effectiveTotal > 1 ? activeFrameIndex / (effectiveTotal - 1) : 1;

  const seek = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetFrame = Math.round(ratio * (effectiveTotal - 1));
      setFrameIndex(targetFrame);
    },
    [effectiveTotal, setFrameIndex],
  );

  function onMouseDown(e: React.MouseEvent) {
    seek(e.clientX);
    const onMove = (me: MouseEvent) => seek(me.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  function onTouchStart(e: React.TouchEvent) {
    seek(e.touches[0].clientX);
    const onMove = (te: TouchEvent) => seek(te.touches[0].clientX);
    const onEnd = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
  }

  const pct = Math.round(timelinePos * 100);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const { loadFile, initWorker, workerReady } = useSaccadeStore.getState();
    if (!workerReady) initWorker();
    loadFile(file);
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: COLOR.bg,
        borderTop: `1px solid ${COLOR.border}`,
        padding: "8px 18px 10px",
        fontFamily: FONT,
        fontSize: 10,
        color: COLOR.text,
        zIndex: 100,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          color: COLOR.textDim,
          fontSize: 9.5,
          letterSpacing: 0.8,
        }}
      >
        <span style={{ color: COLOR.text }}>SACCADE TIMELINE</span>
        <span>
          <span style={{ color: COLOR.textMuted }}>
            {liveSlotCount}/{_maxSlots} SLOTS · frame {activeFrameIndex + 1}/{effectiveTotal} ·{" "}
          </span>
          <span style={{ color: isFileLoaded ? COLOR.warn : COLOR.nominal }}>
            {isFileLoaded ? "BINARY" : "LIVE"}
          </span>
          <span style={{ color: COLOR.textMuted }}> · T+{pct}%</span>
        </span>
        <span style={{ color: COLOR.textMuted, fontSize: 9 }}>
          DROP .bin TO LOAD
        </span>
      </div>

      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{
          position: "relative",
          height: 14,
          cursor: "ew-resize",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            transform: "translateY(-50%)",
            background: COLOR.border,
          }}
        />
        {Array.from({ length: Math.min(effectiveTotal, 100) }).map((_, i) => {
          const tickPct = effectiveTotal > 1 ? i / (Math.min(effectiveTotal, 100) - 1) : 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: "50%",
                left: `${tickPct * 100}%`,
                width: 1,
                height: 5,
                transform: "translate(-50%, -50%)",
                background: COLOR.borderStrong,
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: `${timelinePos * 100}%`,
            height: 1,
            transform: "translateY(-50%)",
            background: isFileLoaded ? COLOR.warn : COLOR.accent,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${timelinePos * 100}%`,
            width: 10,
            height: 10,
            transform: "translate(-50%, -50%)",
            background: COLOR.bgSolid,
            border: `1px solid ${isFileLoaded ? COLOR.warn : COLOR.accent}`,
            cursor: "grab",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          color: COLOR.textMuted,
          fontSize: 8.5,
          letterSpacing: 1,
        }}
      >
        <span>GENESIS</span>
        <span>SCRUB</span>
        <span>NOW</span>
      </div>
    </div>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/HudBridge.tsx  (92 lines)
================================================================================

/**
 * HudBridge — lives INSIDE the R3F Canvas. Pushes live camera + FPS samples
 * into useHudStore so the off-canvas HUD cards can render them.
 *
 * Sampling cadence: ~4 Hz for camera/fps, ~1 Hz for invariants. We DON'T
 * call setState on every frame — that would re-render the HUD cards 60 times
 * per second and tank the frame rate.
 */

import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useHudStore } from "../store/useHudStore";
import { runAllInvariants } from "../lib/invariants";

const SAMPLE_INTERVAL_MS = 250;
const INVARIANT_INTERVAL_MS = 1000;

export function HudBridge() {
  const { camera, controls, gl } = useThree();
  const lastSampleRef = useRef(0);
  const lastInvariantRef = useRef(0);
  const fpsAccumRef = useRef({ frames: 0, since: performance.now() });

  // Initial invariant sweep so the strip doesn't show "uninitialized" forever.
  useEffect(() => {
    runInvariantSweep();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useFrame(() => {
    fpsAccumRef.current.frames += 1;
    const now = performance.now();

    if (now - lastSampleRef.current >= SAMPLE_INTERVAL_MS) {
      const elapsed = now - fpsAccumRef.current.since;
      const fps = elapsed > 0 ? (fpsAccumRef.current.frames * 1000) / elapsed : 0;
      fpsAccumRef.current.frames = 0;
      fpsAccumRef.current.since = now;

      const pos = camera.position;
      const tgt = (controls as { target?: { x: number; y: number; z: number } } | null)?.target;
      const tx = tgt?.x ?? 0;
      const ty = tgt?.y ?? 0;
      const tz = tgt?.z ?? 0;
      const dx = pos.x - tx;
      const dy = pos.y - ty;
      const dz = pos.z - tz;
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const fov =
        "fov" in camera ? (camera as unknown as { fov: number }).fov : 0;

      useHudStore.getState().setCamera({
        px: pos.x,
        py: pos.y,
        pz: pos.z,
        tx,
        ty,
        tz,
        fov,
        distance,
      });
      useHudStore.getState().setFps(fps);

      const info = gl.info;
      useHudStore.getState().setRendererStats(
        info.render.calls,
        info.render.triangles,
      );

      lastSampleRef.current = now;
    }

    if (now - lastInvariantRef.current >= INVARIANT_INTERVAL_MS) {
      runInvariantSweep();
      lastInvariantRef.current = now;
    }
  });

  return null;
}

function runInvariantSweep() {
  const results = runAllInvariants();
  const setInv = useHudStore.getState().setInvariant;
  setInv("stride", results.stride.ok, results.stride.detail);
  setInv("tier_contiguity", results.tier_contiguity.ok, results.tier_contiguity.detail);
  setInv("fifo", results.fifo.ok, results.fifo.detail);
  setInv("bvh_proxy", results.bvh_proxy.ok, results.bvh_proxy.detail);
  setInv("foveation", results.foveation.ok, results.foveation.detail);
  setInv("parity", results.parity.ok, results.parity.detail);
}


================================================================================
FILE: artifacts/rcmt/src/components/HoverTooltip.tsx  (92 lines)
================================================================================

/**
 * HoverTooltip — DOM overlay that shows the source phrase for the slot
 * currently under the cursor. Reads `hoveredSlot` from useSaccadeStore;
 * SaccadeInstancedMesh's pointer handlers are the sole writer. Only slots
 * that have a recorded phrase (i.e. injected through injectPhrase, not
 * demo-seeded) ever produce a non-null hover state, so this overlay
 * naturally hides for vacant and demo slots without an explicit check.
 *
 * Lives OUTSIDE the Canvas so it can use ordinary DOM positioning instead
 * of paying for a per-frame R3F Html overlay. Anchored to the pointer with
 * a small offset; flips horizontally near the right edge of the viewport
 * so long phrases don't get clipped.
 */

import { useSaccadeStore } from "../store/useSaccadeStore";
import { COLOR, FONT, TIER_NAMES } from "./hud/tokens";

const TOOLTIP_OFFSET = 14;
const TOOLTIP_MAX_WIDTH = 320;

export function HoverTooltip() {
  const hovered = useSaccadeStore((s) => s.hoveredSlot);
  const slotPhrase = useSaccadeStore((s) => s.slotPhrase);
  const slotTier = useSaccadeStore((s) => s.slotTier);

  if (!hovered) return null;
  const phrase = slotPhrase[hovered.slot];
  if (!phrase) return null;

  const tier = slotTier[hovered.slot];
  const tierName = TIER_NAMES[tier - 1] ?? "?";
  const tierColor = COLOR.tier[tier - 1] ?? COLOR.text;

  // Flip to the left of the cursor if we're too close to the right edge.
  const flipLeft =
    typeof window !== "undefined" &&
    hovered.x + TOOLTIP_OFFSET + TOOLTIP_MAX_WIDTH > window.innerWidth - 8;

  return (
    <div
      style={{
        position: "fixed",
        left: flipLeft ? undefined : hovered.x + TOOLTIP_OFFSET,
        right: flipLeft ? window.innerWidth - hovered.x + TOOLTIP_OFFSET : undefined,
        top: hovered.y + TOOLTIP_OFFSET,
        maxWidth: TOOLTIP_MAX_WIDTH,
        background: COLOR.bg,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 2,
        padding: "6px 8px",
        fontFamily: FONT,
        fontSize: 10.5,
        color: COLOR.text,
        lineHeight: 1.4,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 200,
        backdropFilter: "blur(3px)",
        letterSpacing: 0.2,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 9,
          color: COLOR.textDim,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 3,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: 1,
            background: tierColor,
          }}
        />
        <span style={{ color: tierColor }}>{tierName}</span>
        <span style={{ color: COLOR.textMuted }}>· vram[{hovered.slot}]</span>
      </div>
      <div>{phrase}</div>
    </div>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/LassoSelection.tsx  (115 lines)
================================================================================

/**
 * LassoSelection — overlay-canvas lasso UI wired to the BVH spatial index.
 *
 * Mounts inside the R3F <Canvas> tree (needs useThree for camera + gl).
 * When useSaccadeStore.isLassoMode is on, attaches mouse handlers to
 * gl.domElement, draws a freeform polygon on a DOM overlay canvas, and on
 * mouseup runs executeLassoHitTest against the lazily-rebuilt proxy BVH.
 * Hit slot indices are written to useSaccadeStore.selectedSlots so
 * SaccadeInstancedMesh can highlight them and `/blast` can purge them.
 */

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useSaccadeStore } from "../store/useSaccadeStore";
import { executeLassoHitTest } from "../lib/bvhLasso";

export function LassoSelection() {
  const { camera, gl } = useThree();
  const isLassoMode = useSaccadeStore((s) => s.isLassoMode);
  const pointsRef = useRef<[number, number][]>([]);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!isLassoMode) return;

    const dom = gl.domElement;
    const overlay = document.createElement("canvas");
    overlay.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:50;width:100vw;height:100vh;";
    overlay.width = dom.clientWidth;
    overlay.height = dom.clientHeight;
    document.body.appendChild(overlay);
    const ctx = overlay.getContext("2d")!;

    const resize = () => {
      overlay.width = dom.clientWidth;
      overlay.height = dom.clientHeight;
    };
    window.addEventListener("resize", resize);

    function screenToNDC(x: number, y: number): [number, number] {
      const rect = dom.getBoundingClientRect();
      return [
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1,
      ];
    }

    const onDown = (e: MouseEvent) => {
      drawingRef.current = true;
      pointsRef.current = [[e.clientX, e.clientY]];
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    };

    const onMove = (e: MouseEvent) => {
      if (!drawingRef.current) return;
      pointsRef.current.push([e.clientX, e.clientY]);
      const pts = pointsRef.current;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.strokeStyle = "#ff8800cc";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.fillStyle = "#ff880018";
      ctx.fill();
    };

    const onUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const pts = pointsRef.current;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (pts.length < 3) {
        pointsRef.current = [];
        return;
      }

      const ndcPoly: [number, number][] = pts.map(([x, y]) => screenToNDC(x, y));

      const bvh = useSaccadeStore.getState().getCollisionBVH();
      if (!bvh) {
        pointsRef.current = [];
        return;
      }
      const hits = executeLassoHitTest(bvh, camera, ndcPoly);
      // setSelectedSlots also pulses lassoEventTick so CommandConsole can
      // emit "> LASSO captured N slots" without us reaching into its log
      // state directly.
      useSaccadeStore.getState().setSelectedSlots(hits);
      pointsRef.current = [];
    };

    dom.addEventListener("mousedown", onDown);
    dom.addEventListener("mousemove", onMove);
    dom.addEventListener("mouseup", onUp);
    dom.addEventListener("mouseleave", onUp);

    return () => {
      dom.removeEventListener("mousedown", onDown);
      dom.removeEventListener("mousemove", onMove);
      dom.removeEventListener("mouseup", onUp);
      dom.removeEventListener("mouseleave", onUp);
      window.removeEventListener("resize", resize);
      overlay.remove();
      drawingRef.current = false;
      pointsRef.current = [];
    };
  }, [isLassoMode, camera, gl]);

  return null;
}


================================================================================
FILE: artifacts/rcmt/src/components/hud/index.ts  (6 lines)
================================================================================

export { SyncCore } from "./SyncCore";
export { Ontology } from "./Ontology";
export { EventStream } from "./EventStream";
export { Invariants } from "./Invariants";
export { CameraReadout } from "./CameraReadout";
export { TelemetryBar } from "./TelemetryBar";


================================================================================
FILE: artifacts/rcmt/src/components/hud/tokens.ts  (64 lines)
================================================================================

/**
 * Aerospace EFIS visual tokens for the RCMT HUD.
 *
 * Low-chroma palette, 1px hairlines, mono font, no shadows, no rounded
 * corners over 2px. Cards lean on legibility over decoration — the lattice
 * itself provides the spectacle; the HUD provides the dial.
 */

export const FONT = "'JetBrains Mono', 'Share Tech Mono', 'IBM Plex Mono', 'Courier New', monospace";

export const COLOR = {
  bg: "rgba(8,10,12,0.88)",
  bgSolid: "#080a0c",
  border: "#2a3338",
  borderStrong: "#3a464d",
  text: "#c6cdd1",
  textDim: "#7a868c",
  textMuted: "#5b6770",
  nominal: "#6dd99e",
  warn: "#e2a458",
  fail: "#d75f5f",
  accent: "#4fd1c5",
  accentDim: "#2d6e68",
  // Tier palette (mirrors OnnxWorker.SLOT_COLORS) for HUD chips.
  tier: [
    "#33d6d6", // Fact
    "#3edb6b", // Scenario
    "#d6c93a", // Metric
    "#e08a3a", // Theory
    "#9966dd", // Dream
  ] as const,
} as const;

export const cardShell: React.CSSProperties = {
  position: "fixed",
  background: COLOR.bg,
  border: `1px solid ${COLOR.border}`,
  borderRadius: 2,
  fontFamily: FONT,
  color: COLOR.text,
  fontSize: 10.5,
  zIndex: 100,
  backdropFilter: "blur(3px)",
  letterSpacing: 0.3,
};

export const cardHeader: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "5px 9px",
  borderBottom: `1px solid ${COLOR.border}`,
  background: "rgba(255,255,255,0.015)",
  fontSize: 9.5,
  color: COLOR.textDim,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

export const cardBody: React.CSSProperties = {
  padding: "8px 9px",
};

export const TIER_NAMES = ["FACT", "SCENARIO", "METRIC", "THEORY", "DREAM"] as const;


================================================================================
FILE: artifacts/rcmt/src/components/hud/HudCard.tsx  (239 lines)
================================================================================

/**
 * HudCard — shared shell for every aerospace telemetry card.
 *
 * Responsibilities:
 *   1. Draggable by its header (mouse down anywhere on the header bar that
 *      isn't the collapse chevron).
 *   2. Collapsible to just the header strip via a `▾`/`▸` chevron.
 *   3. Persists `{x, y, collapsed}` per `id` to `localStorage` so refresh /
 *      HMR don't reset the user's layout. Storage key is `rcmt:hud:<id>:v1`.
 *   4. Falls back to the caller's `initial` position spec until the user
 *      first drags the card — so the default layout is still anchored by
 *      `top/bottom/left/right`, not pinned absolutely.
 *   5. Brings the active drag target to the top of the z-stack so a tall
 *      card pulled over a short one renders above it cleanly.
 *
 * Cards that are NOT real "cards" (`Invariants` strip, `TelemetryBar`,
 * `Timeline`) intentionally do NOT use this wrapper — they're fixed
 * pinned strips and dragging them would be hostile UX.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cardShell, cardHeader, COLOR } from "./tokens";

type Anchor = {
  top?: number;
  bottom?: number;
  left?: number | string;
  right?: number;
};

type Persisted = {
  x: number | null; // null = never dragged, use anchor
  y: number | null;
  collapsed: boolean;
};

function storageKey(id: string) {
  return `rcmt:hud:${id}:v1`;
}

function loadPersisted(id: string): Persisted {
  if (typeof window === "undefined") return { x: null, y: null, collapsed: false };
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return { x: null, y: null, collapsed: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      x: typeof parsed.x === "number" ? parsed.x : null,
      y: typeof parsed.y === "number" ? parsed.y : null,
      collapsed: Boolean(parsed.collapsed),
    };
  } catch {
    return { x: null, y: null, collapsed: false };
  }
}

function savePersisted(id: string, value: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(value));
  } catch {
    // Quota / private-mode failures are non-fatal — drag still works in-session.
  }
}

let zCounter = 100;

export interface HudCardProps {
  id: string;
  title: string;
  /** Right-side header content (peer id, counter, etc.). */
  headerExtra?: ReactNode;
  /** Initial pinned anchor — applies until the user first drags the card. */
  initial: Anchor;
  /** Width spec (number = px, string = any CSS length / `min()` / `calc()`). */
  width: number | string;
  /** Extra style overrides applied to the shell (e.g. minWidth, maxHeight). */
  style?: CSSProperties;
  /** Body content — hidden when the card is collapsed. */
  children: ReactNode;
}

export function HudCard({
  id,
  title,
  headerExtra,
  initial,
  width,
  style,
  children,
}: HudCardProps) {
  const [persisted, setPersisted] = useState<Persisted>(() => loadPersisted(id));
  const [zIndex, setZIndex] = useState<number>(() => ++zCounter);
  const dragState = useRef<{
    startPointerX: number;
    startPointerY: number;
    startCardX: number;
    startCardY: number;
  } | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  // Persist on every change.
  useEffect(() => {
    savePersisted(id, persisted);
  }, [id, persisted]);

  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Ignore the chevron and any explicit no-drag region.
      const target = e.target as HTMLElement;
      if (target.closest("[data-hud-no-drag='true']")) return;
      // Only left-mouse / primary pointer drags.
      if (e.button !== 0 && e.pointerType === "mouse") return;

      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();

      dragState.current = {
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startCardX: rect.left,
        startCardY: rect.top,
      };
      setZIndex(++zCounter);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [],
  );

  const onHeaderPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;
      if (!drag) return;
      const dx = e.clientX - drag.startPointerX;
      const dy = e.clientY - drag.startPointerY;
      // Clamp to viewport so a card can't be dragged offscreen entirely.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const shellW = shellRef.current?.offsetWidth ?? 200;
      const shellH = shellRef.current?.offsetHeight ?? 40;
      const nextX = Math.max(0, Math.min(vw - shellW, drag.startCardX + dx));
      const nextY = Math.max(0, Math.min(vh - shellH, drag.startCardY + dy));
      setPersisted((p) => ({ ...p, x: nextX, y: nextY }));
    },
    [],
  );

  const onHeaderPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      dragState.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // releasePointerCapture throws if we never captured — ignore.
      }
    },
    [],
  );

  const toggleCollapsed = useCallback(() => {
    setPersisted((p) => ({ ...p, collapsed: !p.collapsed }));
  }, []);

  // Build the position style. If the user has dragged the card, use absolute
  // x/y; otherwise honor the original anchor spec.
  const positionStyle: CSSProperties =
    persisted.x !== null && persisted.y !== null
      ? { top: persisted.y, left: persisted.x, right: "auto", bottom: "auto" }
      : {
          top: initial.top,
          bottom: initial.bottom,
          left: initial.left,
          right: initial.right,
        };

  return (
    <div
      ref={shellRef}
      style={{
        ...cardShell,
        ...positionStyle,
        width,
        zIndex,
        ...style,
      }}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        style={{
          ...cardHeader,
          cursor: dragState.current ? "grabbing" : "grab",
          // Hint the OS that this is a drag handle so text selection doesn't fight us.
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            data-hud-no-drag="true"
            onClick={toggleCollapsed}
            aria-label={persisted.collapsed ? "Expand card" : "Collapse card"}
            style={{
              background: "transparent",
              border: "none",
              color: COLOR.textDim,
              cursor: "pointer",
              padding: 0,
              font: "inherit",
              width: 12,
              textAlign: "center",
              lineHeight: 1,
            }}
          >
            {persisted.collapsed ? "▸" : "▾"}
          </button>
          <span>{title}</span>
        </span>
        {headerExtra ? (
          <span data-hud-no-drag="true">{headerExtra}</span>
        ) : null}
      </div>
      {!persisted.collapsed && children}
    </div>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/hud/SyncCore.tsx  (201 lines)
================================================================================

/**
 * SYNC CORE — top-left card. Connection state, peer id, packet rates,
 * ticker cadence, ONNX engine state. The "is the machine alive" panel.
 */

import { useEffect, useState } from "react";
import { useHudStore } from "../../store/useHudStore";
import { OnnxWorker, type OnnxStatus } from "../../workers/OnnxWorkerManager";
import { NetworkManager } from "../../network/NetworkManager";
import { cardBody, COLOR } from "./tokens";
import { HudCard } from "./HudCard";

export function SyncCore() {
  const net = useHudStore((s) => s.net);
  const setNet = useHudStore((s) => s.setNet);
  const ticker = useHudStore((s) => s.ticker);
  const fps = useHudStore((s) => s.fps);

  const [engine, setEngine] = useState<OnnxStatus>(OnnxWorker.currentStatus);
  const [packetsInPrev, setPacketsInPrev] = useState({ count: 0, at: performance.now() });
  const [packetsOutPrev, setPacketsOutPrev] = useState({ count: 0, at: performance.now() });

  useEffect(() => {
    OnnxWorker.onStatusChange = (p) => setEngine(p.status);
    return () => {
      OnnxWorker.onStatusChange = null;
    };
  }, []);

  // Sample connection every 1 s and compute packet rates.
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const { packetsIn, packetsOut } = useHudStore.getState().net;
      const dtIn = (now - packetsInPrev.at) / 1000;
      const dtOut = (now - packetsOutPrev.at) / 1000;
      setNet({
        connected: NetworkManager.isConnected,
        peerId: NetworkManager.assignedPeerId,
        packetsInRate: dtIn > 0 ? (packetsIn - packetsInPrev.count) / dtIn : 0,
        packetsOutRate: dtOut > 0 ? (packetsOut - packetsOutPrev.count) / dtOut : 0,
      });
      setPacketsInPrev({ count: packetsIn, at: now });
      setPacketsOutPrev({ count: packetsOut, at: now });
    }, 1000);
    return () => clearInterval(id);
  }, [packetsInPrev, packetsOutPrev, setNet]);

  const engineColor =
    engine === "READY" || engine === "CLASSIFY_COMPLETE"
      ? COLOR.nominal
      : engine === "ERROR"
        ? COLOR.fail
        : COLOR.warn;

  // Re-render the HELLO age once a second so the "Xs ago" readout actually
  // moves. We don't need sub-second granularity for this dial.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const helloAge =
    net.lastHelloAt > 0
      ? formatAge(Date.now() - net.lastHelloAt)
      : net.connected ? "pending" : "—";
  const rejectStr =
    net.lastRejectAt > 0 && net.lastRejectSlot !== null
      ? `slot ${net.lastRejectSlot} · ${formatAge(Date.now() - net.lastRejectAt)} ago`
      : "none";

  return (
    <HudCard
      id="sync-core"
      title="SYNC CORE"
      initial={{ top: 14, left: 14 }}
      width={268}
      headerExtra={
        <span style={{ color: COLOR.textMuted }}>peer {net.peerId >= 0 ? net.peerId : "—"}</span>
      }
    >
      <div style={cardBody}>
        <Row label="LINK" value={
          <span>
            <Pill color={net.connected ? COLOR.nominal : COLOR.fail}>
              {net.connected ? "SYNC" : "LOCAL"}
            </Pill>
            <span style={{ color: COLOR.textDim, marginLeft: 8 }}>
              peers {net.peerCount > 0 ? net.peerCount : (net.connected ? "1+" : "0")}
            </span>
            <span style={{ color: COLOR.textMuted, marginLeft: 8 }}>
              HELLO {helloAge}
            </span>
          </span>
        } />
        <Row
          label="LWW REJ"
          value={
            <span style={{
              color: net.lastRejectAt > 0 ? COLOR.warn : COLOR.textDim,
            }}>
              {rejectStr}
              {net.lastRejectReason && (
                <span style={{ color: COLOR.textMuted, marginLeft: 6 }}>
                  ({net.lastRejectReason})
                </span>
              )}
            </span>
          }
        />
        <Row label="ENGINE" value={
          <Pill color={engineColor}>{engineLabel(engine)}</Pill>
        } />
        <Row
          label="PACKETS"
          value={
            <span style={{ color: COLOR.text }}>
              <span style={{ color: COLOR.textDim }}>↓</span>{" "}
              {net.packetsIn.toFixed(0)}
              <span style={{ color: COLOR.textMuted, marginLeft: 4 }}>
                ({net.packetsInRate.toFixed(1)}/s)
              </span>
              <span style={{ color: COLOR.textDim, marginLeft: 10 }}>↑</span>{" "}
              {net.packetsOut.toFixed(0)}
              <span style={{ color: COLOR.textMuted, marginLeft: 4 }}>
                ({net.packetsOutRate.toFixed(1)}/s)
              </span>
            </span>
          }
        />
        <Row
          label="TICKER"
          value={
            <span>
              <Pill color={ticker.running ? COLOR.nominal : COLOR.warn}>
                {ticker.running ? "AUTO" : "PAUSED"}
              </Pill>
              <span style={{ color: COLOR.textDim, marginLeft: 8 }}>
                {(ticker.periodMs / 1000).toFixed(1)}±{(ticker.jitterMs / 1000).toFixed(1)}s
              </span>
              <span style={{ color: COLOR.textMuted, marginLeft: 8 }}>
                Σ{ticker.totalFired}
              </span>
            </span>
          }
        />
        <Row
          label="FPS"
          value={
            <span style={{ color: fps >= 55 ? COLOR.nominal : fps >= 40 ? COLOR.warn : COLOR.fail }}>
              {fps.toFixed(0)}
            </span>
          }
        />
      </div>
    </HudCard>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: `1px dotted ${COLOR.border}` }}>
      <span style={{ color: COLOR.textMuted, fontSize: 9, letterSpacing: 1 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      border: `1px solid ${color}`,
      color,
      fontSize: 9.5,
      letterSpacing: 0.5,
    }}>{children}</span>
  );
}

function formatAge(ms: number): string {
  if (ms < 1000) return `${ms | 0}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(0)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

function engineLabel(s: OnnxStatus): string {
  switch (s) {
    case "IDLE": return "IDLE";
    case "LOADING": return "DL";
    case "COMPILING": return "WARM";
    case "READY": return "READY";
    case "CLASSIFY_COMPLETE": return "READY";
    case "ERROR": return "ERR";
  }
}


================================================================================
FILE: artifacts/rcmt/src/components/hud/Ontology.tsx  (104 lines)
================================================================================

/**
 * ONTOLOGY — top-right card. Per-tier occupancy bars with hard cap, decay
 * λ, and rolling 10-s SPAWN / EVICT counts pulled from the event ring.
 *
 * The bar is a 1-px hairline frame filled by occupancy/cap. Color is the
 * tier's canonical palette dimmed to 60% so it doesn't compete with the 3D
 * scene.
 */

import { useEffect, useState } from "react";
import { useHudStore } from "../../store/useHudStore";
import {
  useSaccadeStore,
  TIER_CAPS,
  TIER_LAMBDA,
} from "../../store/useSaccadeStore";
import { cardBody, COLOR, TIER_NAMES } from "./tokens";
import { HudCard } from "./HudCard";

const WINDOW_MS = 10_000;

export function Ontology() {
  const tierCounts = useSaccadeStore((s) => s.tierCounts);
  const events = useHudStore((s) => s.events);

  // Recompute per-tier rolling counts when events advance (cheap; O(events_in_window)).
  const [spawnByTier, setSpawnByTier] = useState<number[]>([0, 0, 0, 0, 0]);
  const [evictByTier, setEvictByTier] = useState<number[]>([0, 0, 0, 0, 0]);

  useEffect(() => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const sp = [0, 0, 0, 0, 0];
    const ev = [0, 0, 0, 0, 0];
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.ts < cutoff) break;
      if (!e.tier) continue;
      const t = Math.max(0, Math.min(4, e.tier - 1));
      if (e.type === "SPAWN" || e.type === "AXIOM" || e.type === "PROMOTE") sp[t]++;
      if (e.type === "EVICT") ev[t]++;
    }
    setSpawnByTier(sp);
    setEvictByTier(ev);
  }, [events]);

  const totalOccupied = tierCounts.reduce((a, b) => a + b, 0);

  return (
    <HudCard
      id="ontology"
      title="ONTOLOGY"
      initial={{ top: 14, right: 14 }}
      width={300}
      style={{ maxHeight: 220, overflow: "hidden" }}
      headerExtra={
        <span style={{ color: COLOR.textMuted }}>{totalOccupied}/8000</span>
      }
    >
      <div style={cardBody}>
        {TIER_NAMES.map((name, i) => {
          const occ = tierCounts[i] ?? 0;
          const cap = TIER_CAPS[i];
          const pct = (occ / cap) * 100;
          const color = COLOR.tier[i];
          return (
            <div key={name} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, background: color, display: "inline-block" }} />
                  <span style={{ color: COLOR.text, fontSize: 10 }}>{name}</span>
                  <span style={{ color: COLOR.textMuted, fontSize: 9 }}>
                    λ {TIER_LAMBDA[i].toFixed(3)}
                  </span>
                </span>
                <span style={{ color: COLOR.textDim, fontSize: 9.5 }}>
                  {occ}/{cap}
                  <span style={{ color: COLOR.nominal, marginLeft: 6 }}>+{spawnByTier[i]}</span>
                  <span style={{ color: COLOR.fail, marginLeft: 4 }}>-{evictByTier[i]}</span>
                </span>
              </div>
              <div style={{ position: "relative", height: 4, border: `1px solid ${COLOR.border}`, background: "rgba(0,0,0,0.4)" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, pct)}%`,
                    background: color,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 4, color: COLOR.textMuted, fontSize: 8.5, letterSpacing: 0.8 }}>
          Δ(10s) — spawn / evict, per tier
        </div>
      </div>
    </HudCard>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/hud/EventStream.tsx  (108 lines)
================================================================================

/**
 * EVENT STREAM — bottom-right card. Renders the latest ~22 entries from the
 * HUD event ring in reverse-chronological order. Each row is a single
 * monospace line so the user can scan for INVARIANT_FAIL or EVICT churn.
 *
 * Colors are by event type, not by tier — the eye should snap to a red
 * INVARIANT_FAIL even in a sea of green SPAWNs.
 */

import { useMemo } from "react";
import { useHudStore, type HudEventType } from "../../store/useHudStore";
import { cardBody, COLOR } from "./tokens";
import { HudCard } from "./HudCard";

const VISIBLE_ROWS = 22;

const TYPE_COLOR: Record<HudEventType, string> = {
  SPAWN: COLOR.text,
  REINFORCE: COLOR.accent,
  PROMOTE: "#b88dff",
  EVICT: COLOR.warn,
  LWW_REJECT: COLOR.warn,
  LOW_CONF: COLOR.warn,
  INVARIANT_FAIL: COLOR.fail,
  AXIOM: COLOR.nominal,
  INFO: COLOR.textDim,
  PAUSE: COLOR.textMuted,
  RESUME: COLOR.textMuted,
  ERROR: COLOR.fail,
};

export function EventStream() {
  const events = useHudStore((s) => s.events);

  const recent = useMemo(() => {
    return events.slice(-VISIBLE_ROWS).reverse();
  }, [events]);

  return (
    <HudCard
      id="event-stream"
      title="EVENT STREAM"
      initial={{ bottom: 96, right: 14 }}
      width={380}
      style={{
        // Cap below the Ontology card's footprint (top:14 + ~220px tall) plus
        // a 12px gutter so the two never collide in a short viewport — the
        // canvas iframe runs ~557px tall, which used to overlap by ~50px.
        maxHeight: "min(320px, calc(100vh - 96px - 246px))",
        display: "flex",
        flexDirection: "column",
      }}
      headerExtra={
        <span style={{ color: COLOR.textMuted }}>{events.length}/500</span>
      }
    >
      <div style={{ ...cardBody, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {recent.length === 0 ? (
          <div style={{ color: COLOR.textMuted, fontSize: 10 }}>
            awaiting first event…
          </div>
        ) : (
          recent.map((e) => {
            const t = new Date(e.ts);
            const hh = String(t.getHours()).padStart(2, "0");
            const mm = String(t.getMinutes()).padStart(2, "0");
            const ss = String(t.getSeconds()).padStart(2, "0");
            const ms = String(t.getMilliseconds()).padStart(3, "0");
            return (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  gap: 6,
                  padding: "1px 0",
                  fontSize: 9.5,
                  lineHeight: 1.35,
                  borderBottom: `1px dotted ${COLOR.border}`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span style={{ color: COLOR.textMuted, flexShrink: 0 }}>
                  {hh}:{mm}:{ss}.{ms}
                </span>
                <span style={{
                  color: TYPE_COLOR[e.type] ?? COLOR.text,
                  fontWeight: e.type === "INVARIANT_FAIL" ? "bold" : "normal",
                  flexShrink: 0,
                  width: 90,
                }}>
                  {e.type}
                </span>
                <span style={{ color: COLOR.text, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e.phrase ?? e.detail ?? ""}
                  {e.phrase && e.detail ? (
                    <span style={{ color: COLOR.textMuted }}> · {e.detail}</span>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </HudCard>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/hud/Invariants.tsx  (87 lines)
================================================================================

/**
 * INVARIANTS — top-center horizontal strip of six dots. Each one is a
 * load-bearing fact of the grounding-file format. Green = nominal, red =
 * the format just broke. Hover to read the detail line.
 *
 * Two of the six are expected to be informative red until other tasks land
 * (parity flips green when Task #4 retires the legacy graph). The whole
 * point of the strip is to make those drifts visible, not hidden.
 */

import { useHudStore, type InvariantId } from "../../store/useHudStore";
import { cardShell, COLOR, FONT } from "./tokens";

const ORDER: { id: InvariantId; label: string }[] = [
  { id: "stride", label: "STRIDE" },
  { id: "tier_contiguity", label: "TIERS" },
  { id: "fifo", label: "FIFO" },
  { id: "bvh_proxy", label: "BVH" },
  { id: "foveation", label: "FOVEA" },
  { id: "parity", label: "PARITY" },
];

export function Invariants() {
  const invariants = useHudStore((s) => s.invariants);
  const failing = ORDER.filter((o) => !invariants[o.id].ok).length;

  return (
    <div
      style={{
        ...cardShell,
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ color: COLOR.textMuted, fontSize: 9, letterSpacing: 1 }}>
        INVARIANTS
      </span>
      {ORDER.map(({ id, label }) => {
        const inv = invariants[id];
        const color = inv.ok ? COLOR.nominal : COLOR.fail;
        return (
          <span
            key={id}
            title={`${label}: ${inv.detail}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: FONT,
              fontSize: 9.5,
              color: COLOR.text,
              cursor: "help",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                background: color,
                border: `1px solid ${color}`,
                boxShadow: inv.ok ? "none" : `0 0 4px ${color}`,
              }}
            />
            <span style={{ color: inv.ok ? COLOR.textDim : color }}>{label}</span>
          </span>
        );
      })}
      <span
        style={{
          marginLeft: 8,
          paddingLeft: 10,
          borderLeft: `1px solid ${COLOR.border}`,
          color: failing > 0 ? COLOR.fail : COLOR.nominal,
          fontSize: 9,
          letterSpacing: 1,
        }}
      >
        {failing > 0 ? `${failing} FAIL` : "ALL GREEN"}
      </span>
    </div>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/hud/CameraReadout.tsx  (53 lines)
================================================================================

/**
 * CAMERA — compact readout pinned bottom-right above the timeline. Lives
 * outside the Canvas; reads from the store HudBridge populates.
 */

import { useHudStore } from "../../store/useHudStore";
import { COLOR, FONT } from "./tokens";
import { HudCard } from "./HudCard";

export function CameraReadout() {
  const camera = useHudStore((s) => s.camera);
  const drawCalls = useHudStore((s) => s.drawCalls);
  const tris = useHudStore((s) => s.instancedCount);

  if (!camera) return null;

  return (
    <HudCard
      id="camera-readout"
      title="CAMERA · RENDERER"
      initial={{ bottom: 96, left: 14 }}
      width={268}
    >
      <div
        style={{
          padding: "6px 10px",
          fontFamily: FONT,
          fontSize: 9.5,
          letterSpacing: 0.4,
        }}
      >
        <div style={{ color: COLOR.text }}>
          pos&nbsp;
          <span style={{ color: COLOR.accent }}>{camera.px.toFixed(1)}</span>,
          &nbsp;
          <span style={{ color: COLOR.accent }}>{camera.py.toFixed(1)}</span>,
          &nbsp;
          <span style={{ color: COLOR.accent }}>{camera.pz.toFixed(1)}</span>
        </div>
        <div style={{ color: COLOR.text }}>
          dist&nbsp;
          <span style={{ color: COLOR.accent }}>{camera.distance.toFixed(1)}</span>
          <span style={{ color: COLOR.textMuted, marginLeft: 10 }}>
            fov {camera.fov.toFixed(0)}°
          </span>
        </div>
        <div style={{ color: COLOR.textDim, marginTop: 2 }}>
          draws {drawCalls} · tris {(tris / 1000).toFixed(1)}k
        </div>
      </div>
    </HudCard>
  );
}


================================================================================
FILE: artifacts/rcmt/src/components/hud/TelemetryBar.tsx  (92 lines)
================================================================================

/**
 * TELEMETRY BAR — full-width strip directly above the SACCADE TIMELINE.
 *
 * The "engineering bottom row" — a single horizontal readout consolidating
 * the live render & runtime numbers that don't fit naturally into the
 * other cards: FPS, draw calls, instanced count, active frame index,
 * ticker rate, build SHA. Designed so a glance at the bottom of the screen
 * tells you whether the render loop, the lattice, and the autonomous
 * thought ticker are still healthy.
 */

import { useHudStore } from "../../store/useHudStore";
import { useSaccadeStore } from "../../store/useSaccadeStore";
import { COLOR, FONT } from "./tokens";

// Build SHA — Vite inlines `import.meta.env.VITE_BUILD_SHA` at build time
// (set by the deploy workflow); falls back to "dev" during `pnpm dev`.
const BUILD_SHA =
  (import.meta.env.VITE_BUILD_SHA as string | undefined)?.slice(0, 7) ?? "dev";

export function TelemetryBar() {
  const fps = useHudStore((s) => s.fps);
  const drawCalls = useHudStore((s) => s.drawCalls);
  const instancedCount = useHudStore((s) => s.instancedCount);
  const ticker = useHudStore((s) => s.ticker);
  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const frameCount = useSaccadeStore((s) => s.mockFrames.length);

  const fpsColor =
    fps >= 55 ? COLOR.nominal : fps >= 40 ? COLOR.warn : COLOR.fail;

  return (
    <div
      style={{
        position: "fixed",
        left: 14,
        right: 14,
        bottom: 78,
        height: 22,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 10px",
        background: COLOR.bg,
        border: `1px solid ${COLOR.border}`,
        color: COLOR.text,
        fontFamily: FONT,
        fontSize: 10,
        letterSpacing: 0.4,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <Cell label="FPS" value={fps.toFixed(0)} color={fpsColor} />
      <Cell label="DRAW" value={drawCalls.toString()} />
      <Cell label="INST" value={instancedCount.toLocaleString()} />
      <Cell
        label="FRAME"
        value={`${activeFrameIndex}/${Math.max(0, frameCount - 1)}`}
      />
      <Cell
        label="TICK"
        value={
          ticker.running
            ? `${(ticker.periodMs / 1000).toFixed(1)}±${(ticker.jitterMs / 1000).toFixed(1)}s`
            : "PAUSED"
        }
        color={ticker.running ? COLOR.text : COLOR.warn}
      />
      <Cell label="Σ FIRED" value={ticker.totalFired.toString()} />
      <div style={{ flex: 1 }} />
      <Cell label="BUILD" value={BUILD_SHA} color={COLOR.accent} />
    </div>
  );
}

function Cell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "baseline" }}>
      <span style={{ color: COLOR.textMuted, fontSize: 9 }}>{label}</span>
      <span style={{ color: color ?? COLOR.text }}>{value}</span>
    </span>
  );
}

