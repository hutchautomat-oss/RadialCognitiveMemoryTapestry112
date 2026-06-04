# RCMT Docs Index

Single-entry navigation for the `docs/` folder. Every file has exactly one home.

---

## Start here

| File | What it is |
|---|---|
| [`what-is-rcmt.md`](./what-is-rcmt.md) | Plain-language explanation of RCMT for a first-time reader |
| [`who-its-for.md`](./who-its-for.md) | Buyer tiers and use cases |
| [`cliffsnotes.md`](./cliffsnotes.md) | Public/buyer-facing orientation — the fast path |

---

## Architecture & decisions

| File | What it is |
|---|---|
| [`architecture-decisions.md`](./architecture-decisions.md) | Non-obvious choices: byte layout, acuity budget math, the two-constants warning |
| [`day1-vs-current.md`](./day1-vs-current.md) | History: how the lattice changed from labeled semantic axes to foveated shells |
| [`why-28-bytes.md`](./why-28-bytes.md) | Why the CRVM packet is exactly 28 bytes |
| [`why-five-tiers.md`](./why-five-tiers.md) | Why five tiers and not four or six |
| [`why-foveation.md`](./why-foveation.md) | Why the density gradient is the meaning, not decoration |
| [`why-local-only.md`](./why-local-only.md) | Why classification runs on-device and text never leaves the machine |

---

## Specifications

| File | What it is |
|---|---|
| [`RCMT-GRADIENT-SPEC-001.md`](./RCMT-GRADIENT-SPEC-001.md) | Complete epistemic color gradient — grounded in electromagnetic physics. **Classification: RED / immutable.** |
| [`RCMT-LESSON-001-THE-GRAMMAR.md`](./RCMT-LESSON-001-THE-GRAMMAR.md) | Seven grammar tokens, wavelength-based certainty scale, the REVIEW token |
| [`rcmt-language-spec-001.md`](./rcmt-language-spec-001.md) | The `.rcmt` language syntax spec (Track 2 — VIOLET/hypothesis) |
| [`rcmt-scaling-vision.md`](./rcmt-scaling-vision.md) | Three-phase scaling roadmap from Proof-of-Life to federation |
| [`diagnostic-layer-specification.md`](./diagnostic-layer-specification.md) | Diagnostic layer — shader graph, CIELAB LUT, invariant tripwires |
| [`hud.md`](./hud.md) | Aerospace EFIS HUD — card layout, tokens, guided vs aerospace mode |

---

## Research & positioning

| File | What it is |
|---|---|
| [`RCMT-RESEARCH-001.md`](./RCMT-RESEARCH-001.md) | Competitive landscape, energy crisis framing, market positioning |
| [`positioning.md`](./positioning.md) | Buyer tiers, go-to-market, licensing model detail |
| [`protection-boundary.md`](./protection-boundary.md) | Engine vs. calibration boundary — four-bucket asset map, no-tricks doctrine |

---

## Guardrails

| File | What it is |
|---|---|
| [`gotchas.md`](./gotchas.md) | 15 non-obvious traps, each with the code path it protects and the test that pins it. **Read before touching any guarded path.** |

---

## Roadmap

| File | What it is |
|---|---|
| [`roadmap.md`](./roadmap.md) | **Single source of truth for build status.** Built / Planned / Rejected — every rejection carries a one-line why. |
| [`roadmap/sovereign-session-wrapper.md`](./roadmap/sovereign-session-wrapper.md) | Planned: AI wrapper that feeds any instance a sovereign context stack — the first RCMT product demo |
| [`roadmap/sovereign-save-key.md`](./roadmap/sovereign-save-key.md) | Planned: `sovereign_save_key.bin` — persist the lattice across page refreshes |
| [`roadmap/log-polar-cell-sizing.md`](./roadmap/log-polar-cell-sizing.md) | Planned: cortical magnification cell sizing so the VLM acuity budget is never exceeded |
| [`roadmap/variable-node-radii.md`](./roadmap/variable-node-radii.md) | Planned: visual radius scales with source phrase length |
| [`roadmap/epsilon-fibonacci-packing.md`](./roadmap/epsilon-fibonacci-packing.md) | Planned: epsilon-offset variant for ~8% pole improvement |
| [`roadmap/mycelial-constellation.md`](./roadmap/mycelial-constellation.md) | Planned: federation doctrine — how multiple RCMTs combine without fusing |
| [`roadmap/multimodal-substrate.md`](./roadmap/multimodal-substrate.md) | Planned: how non-text senses enter via sidecar, never on the 28-byte wire |

---

## Internal / NDA only

| File | What it is |
|---|---|
| [`internal/README.md`](./internal/README.md) | Bucket 3 overview — never ships in buyer distribution |
| [`internal/calibration-derivation.md`](./internal/calibration-derivation.md) | How the calibration values were arrived at (stub) |
| [`internal/benchmark-methodology.md`](./internal/benchmark-methodology.md) | How the VLM acuity constant `s` will be measured (stub) |
