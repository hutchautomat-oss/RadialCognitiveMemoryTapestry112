# Protection boundary — engine vs. calibration

RCMT is a **licensable product, not OSS**. This document is the architecture
decision that records *where the protection boundary sits* and *what is
withheld* — never how the artifact is tampered with.

## Doctrine (the one rule)

**Protection lives at the boundary, never inside the artifact.** The only
protections compatible with RCMT's integrity are about *where the line is drawn*
and *what is held back* — not about modifying the substrate. Specifically:

- **No tricks.** No obfuscation, no minified-on-purpose engine, no
  watermarks/easter-eggs in code, no canary traps. Anything that could weaken,
  corrupt, or destabilize the substrate is forbidden — it would damage the very
  thing being sold.
- **The wire-format invariants and the deterministic geometry are untouchable.**
  Nothing in a protection measure may alter the 28-byte CRVM packet, LWW
  arbitration, the unified-sphere geometry, or Foveal Gradient Integrity. (See
  `replit.md`.)
- **Honest reality.** Most of RCMT is *lawfully rederivable* engine — and that
  is correct: it is the open layer. The genuinely protectable assets
  (calibration constants, the efficiency benchmark) are mostly *not built yet*.
  This boundary exists so that when they are built they have a clean home and
  cannot leak into the open engine by accident.

## The four buckets

Every significant asset falls into exactly one bucket.

### Bucket 1 — Open engine (lawfully rederivable; the open layer)

Shipping these does not give away the moat — a competent engineer could
rederive them from first principles, and several are mathematical/physical law.

| Asset | Where |
| --- | --- |
| Unified 3D Fibonacci geometry (golden angle, √index foveation, `latticePosition`) | `artifacts/rcmt/src/store/useSaccadeStore.ts` |
| 28-byte CRVM wire format + LWW arbitration | `artifacts/api-server/src/lib/lww.ts`, `network/NetworkManager.ts` |
| Per-tier FIFO, decay-engine *mechanics*, promotion/demotion *mechanics* | `useSaccadeStore.ts` |
| BVH spatial index, lasso, single-draw InstancedMesh renderer | `useSaccadeStore.ts`, `SaccadeInstancedMesh.tsx`, `LassoSelection.tsx` |
| Local-only ONNX classifier *plumbing* (worker protocol, embed/classify flow) | `workers/onnxInference.worker.ts`, `OnnxWorkerManager.ts` |
| The HUD / telemetry suite, ghost scaffold, timeline | `components/`, `components/hud/` |
| The invariant tripwire suite | `*.test.ts`, `lib/invariants.ts` |
| The structural constants (`MAX_NODES`, `STRIDE`, `TIER_CAPS`, `EMBEDDING_DIM`) | `useSaccadeStore.ts` |

### Bucket 2 — Behind-a-seam calibration (the tunable secret sauce)

The values arrived at by judgment and (eventually) measurement, not by
derivation. Centralized in **one** clearly-labeled module so they cannot scatter
back into the engine:

> **`artifacts/rcmt/src/lib/calibration.ts`**

Contents today:

- **Classifier prototype anchors** (`CLASSIFIER_SEED_PHRASES`) — the curated
  definition of what each of the five tiers *means*. The highest-value asset.
- **Foveation density factor** (`NODE_DENSITY_BUBBLE`).
- **Per-tier decay gradient** (`TIER_LAMBDA`).
- **Reinforcement / promotion / health tuning** (`REINFORCE_SIM_THRESHOLD`,
  `REINFORCE_PROMOTE_COUNT`, `HEALTH_DEATH`, `HEALTH_DEMOTE`,
  `MASS_REINFORCE_INCR`, `MASS_REINFORCE_CAP`).
- **Reserved empirical home** (`VLM_ACUITY_S`) — null until measured.

The seam is **separation only**: centralizing these changed no behavior, and the
vitest invariant suite still pins them via the engine modules that re-export the
previously-public ones. Where a value was previously a public export
(`NODE_DENSITY_BUBBLE`, `TIER_LAMBDA`), the engine re-exports it so the import
surface and the tests are unchanged.

### Bucket 3 — NDA-docs-only (never ships in the box)

Knowledge, not code — distributed under NDA, excluded from any buyer
distribution:

> **`docs/internal/`**

- How the calibration values were *derived* (the method behind the Bucket-2
  numbers).
- The **efficiency benchmark methodology** — image-tokens-per-query vs. a
  text-RAG baseline, and how the VLM acuity constant `s` is measured. (Stub
  today; the measurement is separate, planned work.)
- Pricing / licensing internals (handled separately).

### Bucket 4 — Hosted (future, optional)

Assets that never leave a server we control. Out of scope to build now; named
here only so they have a home:

- A hosted scoring / benchmark endpoint (run the efficiency proof server-side).
- License validation, if ever wanted.

## How to use this boundary

- **Adding a tunable number?** It goes in `calibration.ts` (Bucket 2), not
  inline in the engine.
- **Writing down *how* a tunable was chosen, or a benchmark result?** That is
  Bucket 3 — `docs/internal/`, never a public doc or a code comment in the
  engine.
- **Tempted by a watermark / canary / obfuscation?** Re-read the doctrine: no.
- **Public/buyer-facing explanation of the product?** See the CliffsNotes layer:
  [`docs/cliffsnotes.md`](./cliffsnotes.md).
