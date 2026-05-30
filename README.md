# RCMT — Radial Cognitive Memory Tapestry

> A context-compression and epistemic-anchoring primitive for AI.

---

## Why

AI systems ground themselves against memory that is expensive to store, that
**drifts** every time the underlying model is upgraded, and that silently
reshapes meaning whenever it's re-embedded. RCMT exists because grounding
shouldn't work that way. Meaning should be cheap to carry, **stable** across
model upgrades, and **honest** when something is missing — never confidently
wrong.

So RCMT stores meaning not as high-dimensional embeddings in a vector database,
but as **positions in a fixed geometric lattice** — a shape a model can read the
way an eye reads a scene: the most-trusted things at the dense center, the
most-speculative at the sparse edge. The shape *is* the meaning.

## How

- **Meaning as position, not embedding.** Every memory is placed at a
  deterministic position in a 3D foveated lattice, derived from slot index +
  insertion order. That makes the format **byte-stable**: it can't drift when the
  model changes, and it can't be re-embedded into something different.
- **An epistemic gradient built into the geometry.** Memories sort
  Fact → Scenario → Metric → Theory → Dream, from a dense, high-confidence core
  outward to a sparse rim. A model scanning the lattice inherits the
  "how much should I trust this?" prior for free.
- **Small and portable.** The whole tapestry is a compact binary that can live
  wherever you need it — on a device, in a function, or beside whatever retrieval
  or memory stack you already run. It's an *ingredient*, not a platform.
- **Honest under failure.** When something it points to is gone, it degrades to
  "I had something here" — it never fabricates the missing piece.

## What

A working substrate plus a live demonstrator:

- An **8,000-slot** foveated lattice, rendered in real time in a single draw call.
- A **local** intent classifier (runs in-browser, in a worker — text never leaves
  the machine) that sorts each input into one of the five tiers.
- A **Last-Writer-Wins sync core** so multiple peers converge on the same tapestry.
- A scrubbable **timeline** that replays history from the binary frames.

> **Status:** working prototype / proof-of-concept. The efficiency thesis —
> grounding cost decoupled from corpus size — is the *design goal*, not yet an
> independently measured benchmark.

### Run it

```bash
pnpm install
pnpm --filter @workspace/api-server run dev   # sync core
pnpm --filter @workspace/rcmt run dev         # web demo
```

Deeper architecture, the wire-format invariants, and design rationale live in
[`replit.md`](./replit.md) and [`docs/`](./docs/).

---

## License

Proprietary — all rights reserved. This is a licensable product, **not** open
source. Licensing and partnership inquiries welcome.
