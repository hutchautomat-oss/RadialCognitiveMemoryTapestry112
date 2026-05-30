# Aerospace HUD

The UI is laid out as an EFIS-style telemetry suite around the 3D lattice. This is a UI / presentation reference — it pins no runtime invariant. The load-bearing guardrails live in `replit.md` (Gotchas, wire-format invariants, Foveal Gradient Integrity).

## Aerospace HUD (Task #11)

Six fixed cards plus an invisible ticker:

- **INVARIANTS strip** (top-center) — five dots: `STRIDE / TIERS / FIFO / BVH / FOVEA`. Green = nominal, red = the grounding-file format just broke. The legacy `useStore.nodes` graph has been retired, so the VRAM frame buffer is the single source of truth — there is no longer a `parity` dot, because there is no second graph left to drift against.
- **SYNC CORE** (top-left) — LINK (sync/local), ENGINE (DL/WARM/READY/ERR), packets ↓↑ with /s rate, TICKER auto/paused + cadence + Σ fired, FPS.
- **ONTOLOGY** (top-right) — per-tier hairline bars with occupancy/cap, decay λ, rolling 10-s spawn (+) / evict (−) counts pulled from the event ring.
- **COMMAND CONSOLE** (bottom-left of center) — manual phrase input + slash commands: `/help /pause /resume /rate <ms> /axioms /invariants /events /why <slot> /lasso /blast /clear`. Free text routes through `injectPhrase` (the same path the ticker uses).
- **EVENT STREAM** (bottom-right) — newest-first view of the 500-cap event ring with HH:MM:SS.ms timestamps. Event types: `SPAWN / REINFORCE / PROMOTE / EVICT / LWW_REJECT / LOW_CONF / INVARIANT_FAIL / AXIOM / INFO / PAUSE / RESUME / ERROR`.
- **CAMERA · RENDERER** (above the timeline, left side) — pos/dist/fov + draw calls + tris.
- **SACCADE TIMELINE** (full-width bottom strip) — frame scrubber; drop a `.bin` to load. Same component as before, restyled to aerospace tokens.

## Organic growth (axiom seed + thought ticker)

The lattice now starts visually empty (only the dim ghost scaffold visible). After ~1.5 s the **ThoughtTicker** injects the 7 axioms (600 ms gap), then enters a jittered loop drawing from `PHRASE_CORPUS` (default 3 s ±1 s, adjustable via `/rate`). Every injection — axiom, ticker, or console — funnels through `injectPhrase`, so the **ONNX single-in-flight constraint is honored automatically** (Promise chain serializes all callers). The ticker also auto-pauses while `ticker.busy` is true.

## Visual tokens (`components/hud/tokens.ts`)

Aerospace EFIS palette — `bg rgba(8,10,12,0.88)`, `border #2a3338`, `text #c6cdd1`, `nominal #6dd99e`, `warn #e2a458`, `fail #d75f5f`, `accent #4fd1c5`. JetBrains/Share Tech Mono. 1 px hairlines, 2 px radii max, no shadows. Cards lean on legibility — the lattice provides the spectacle, the HUD provides the dial.

## Guided vs. aerospace mode (Task #20)

The HUD has two presentation modes, switched by the `AERO / GUIDED` toggle pinned top-right (just left of the Ontology card). **Mode is pure chrome — it never touches telemetry, invariants, the ticker, or the injection pipeline; aerospace mode is byte-identical to before this task.**

- **AEROSPACE** (default) — the dense EFIS surface for power users. Terse code titles, no help affordances.
- **GUIDED** — for a first-time evaluator. Each card title renders `"{EFIS} · {plainTitle}"` (e.g. `SYNC CORE · Network & Engine`) and grows a `?` button that toggles a ~2-sentence plain-English help popover. The Invariants strip gets the same treatment manually (it's not a `HudCard`).
- Mode persists to `localStorage` key `rcmt:hud:mode:v1` via `useHudStore.setHudMode`. The store reads it once at module load.
- **`HudOnboarding`** is a five-panel walkthrough (ghost scaffold → axiom seed → ticker drip → tier legend → invariants). It auto-opens on first load (no mode key set) and is re-openable any time via the `/tour` console command. Dismiss semantics set the mode preference: **Done → GUIDED**, **Skip on a true first run → AEROSPACE**, **Skip when a preference already exists → unchanged**. `hudModePreferenceExists()` (exported from `useHudStore`) gates that last case.
- `plainTitle` / `helpText` are optional `HudCard` props — adding a new card to guided mode is just passing those two strings.
- `/help` is now grouped plain-English (Lattice / Ticker / Diagnostics / Help).

## Legible & learnable UI (Task #23)

Goal: let a first-time evaluator infer the Fact→Dream epistemology from the *running* lattice without docs — through color, motion, a "mirror," and hovering any node. All four pieces are **render-/telemetry-side only**; none touch the wire packet, node position, or tier authority (`slotTier[]` stays the source of truth).

- **Tier color-opponency.** Canonical `TIER_RGB` palette in `useSaccadeStore` is the single source of truth for node color (vivid cyan-green Fact → faded violet Dream, saturation ramping down so trust reads as chroma). `injectPhrase` and the promotion recolor read it; `OnnxWorkerManager.SLOT_COLORS/colorForSlot` were deleted. HUD chips (`hud/tokens.ts` `COLOR.tier`) use **muted** variants so the lattice carries the vivid contrast and the dense chrome stays low-chroma. Color only ever writes frame stride `[3,4,5]` — never bytes or position.
- **Promotion traces** (`components/PromotionTraces.tsx`, in-canvas `LineSegments`) draw the inward migration vector while a node is promoted. **Live-mode only** (`!isFileLoaded && activeFrameIndex===0`) — a continuous mutator must never run during binary scrub.
- **Peripheral LWW flash.** `applyRemoteUpdate` pushes each incoming remote update onto a bounded module-level queue (`REMOTE_FLASH_CAP = 64`, drained via `drainRemoteFlashes`). `PeripheralFlashBridge` (in-canvas) projects the mutated slot to the nearest viewport edge; `PeripheralFlash` (DOM) renders a fading edge bar — exploiting peripheral motion sensitivity to pull attention to remote activity. The bridge **throttles before draining** (gate first, then drain) so a throttle window can't silently discard a drained batch.
- **Epistemic-balance mirror** (`hud/EpistemicBalance.tsx`) — a tier-mix bar plus a balance beam that tilts when the live mix is lopsided relative to `IDEAL_COM ≈ 0.42`. Reads `tierCounts` only.
- **Self-narration.** Shared `lib/tierNarration.ts` (`TIER_LABEL` / `TIER_PLAIN` / `TIER_BAND` + helpers) feeds plain-English copy into `/why` (tier, radial-band placement, last-move state), the event-stream detail strings, and a dim line on the hover tooltip.
- **Clock-domain gotcha:** animation timing (`animStartTime`, spawn/promotion) is `performance.now()`; the `/why` "migrating now" check must compare in that same clock, not `Date.now()` (different epochs → silent always-false).

Out of scope (roadmap): semantic intra-shell repositioning, federation/codebook/wire-format changes, Gestalt clustering as new code (delivered implicitly via radial-shell proximity + color similarity).
