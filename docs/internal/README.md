# Internal / NDA documentation tier

> **CONFIDENTIAL — NDA only. Bucket 3 of the protection boundary.**
> This directory must be **excluded from any buyer distribution.** It holds
> *knowledge* (how things were derived/measured), not code. See
> [`../protection-boundary.md`](../protection-boundary.md).

The public/buyer tier is [`../cliffsnotes.md`](../cliffsnotes.md) plus the
`docs/why-*.md` set. Everything here is the layer behind the seam.

## What lives here

- [`calibration-derivation.md`](./calibration-derivation.md) — how the Bucket-2
  calibration values (`artifacts/rcmt/src/lib/calibration.ts`) were arrived at.
  The *values* ship in the engine; the *method* does not. (Stub.)
- [`benchmark-methodology.md`](./benchmark-methodology.md) — how the efficiency
  proof is run and how the VLM acuity constant `s` is measured. (Stub — the
  measurement itself is separate, planned work.)

## Rule

When you write down *how* a tunable was chosen or *what a benchmark returned*,
it goes here — never into a public doc and never into an engine code comment.
