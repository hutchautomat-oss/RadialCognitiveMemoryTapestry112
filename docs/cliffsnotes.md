# RCMT CliffsNotes (public / buyer layer)

A one-page orientation for an evaluator. This is the **public** documentation
tier — safe to share with a prospective buyer. It explains *what RCMT is, why it
exists, how to integrate it, and how to read the running instrument*. It links
to the deeper public docs rather than repeating them.

> The *how it was tuned* and *how the efficiency proof is measured* live in the
> NDA tier (`docs/internal/`), not here. See
> [`docs/protection-boundary.md`](./protection-boundary.md).

## What it is

RCMT stores meaning as **positions in a 3D foveated lattice** instead of as
high-dimensional embeddings in a vector database. A vision-capable model reads
the lattice **foveally** — dense, high-confidence Facts at the core first;
sparse, speculative Dreams at the rim as context. The whole 8,000-slot tapestry
is **224 KB on the wire** and **byte-stable** across model upgrades. Deeper:
[`what-is-rcmt.md`](./what-is-rcmt.md).

## Why it exists

A grounding substrate that **isn't a vector DB** (which drifts on re-embed and
bloats unboundedly) and **isn't a retraining loop** (slow, expensive, opaque).
Positions are deterministic from slot index + insertion order, so the substrate
**cannot drift**. Who it's for: [`who-its-for.md`](./who-its-for.md) and
[`positioning.md`](./positioning.md).

## The shape *is* the meaning

- **Five epistemic tiers** — Fact / Scenario / Metric / Theory / Dream — encode
  a scientific-method gradient into the geometry. Why five:
  [`why-five-tiers.md`](./why-five-tiers.md).
- **Foveation** — a VLM's optical cost is O(resolution), not O(node count), so
  one glance costs the same at 100 or 8,000 slots. Why:
  [`why-foveation.md`](./why-foveation.md).
- **28-byte wire packet** — the contract that makes the substrate portable and
  un-driftable. Why: [`why-28-bytes.md`](./why-28-bytes.md).
- **Local-only inference** — text never leaves the machine. Why:
  [`why-local-only.md`](./why-local-only.md).

## How to integrate (evaluator path)

1. **Run it.** `pnpm --filter @workspace/api-server run dev` (sync core) and
   `pnpm --filter @workspace/rcmt run dev` (the demonstrator UI). See
   `replit.md` → *Run & Operate*.
2. **Feed it.** Input is a typed phrase, a peer broadcast, or a scrubbed `.bin`
   frame. A local ONNX model classifies each input into a tier and injects one
   sphere into the lattice.
3. **Consume it (the real product).** The substrate is meant to be read by a
   downstream VLM scanning the rendered lattice foveally. The UI exists to
   *demonstrate* the substrate to evaluators — the product is the substrate.

## How to read the instrument (HUD)

The UI is an EFIS-style telemetry suite around the lattice:

- **Invariants strip** (top center) — five dots; green = the substrate's
  load-bearing guarantees hold, red = a drift was observed.
- **Sync Core** — link state, engine status, packet in/out rates, FPS.
- **Ontology** — per-tier occupancy bars and recent deltas.
- **Command Console** — type a phrase to inject; `/find` for read-only semantic
  targeting; `/lasso`, `/blast`, `/clear`, `/help`.
- **Event Stream** — the most recent mutations.
- **Camera · Renderer** — viewport + render telemetry.

Full card-by-card breakdown: [`hud.md`](./hud.md).
