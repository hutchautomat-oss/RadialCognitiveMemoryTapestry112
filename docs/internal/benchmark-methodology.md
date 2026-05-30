# Efficiency benchmark methodology (NDA — stub)

> **CONFIDENTIAL — NDA only.** Do not ship in a buyer distribution.

The efficiency proof is the second genuinely protectable asset (after the
calibration values). It is mostly **not built yet** — this stub reserves the
home so the result lands here and not in a public doc.

## The claim to be proven

A VLM reading the rendered lattice foveally answers a grounding query at
**O(resolution)** optical cost — the same token budget at 100 or 8,000
populated slots — beating a text-RAG baseline that scales with retrieved
context length.

## Method (to be filled in)

- **Baseline.** A text-RAG pipeline answering the same query set; measure
  retrieved-context tokens per query.
- **RCMT.** A VLM reading the rendered lattice; measure image tokens per query
  (fixed tiles → fixed cost).
- **Metric.** Tokens-per-query (and answer quality at equal budget) across a
  populated-slot sweep, demonstrating the flat optical cost.
- **Acuity constant `s`.** Measure the spatial acuity at which the dense core
  stops being resolvable in a single glance — this fixes `VLM_ACUITY_S` and the
  no-zoom cell budget `M = (R / s)²`. `s` is **measured, never derived**.

## Where the result goes

The *number* and the *method* both stay in this NDA tier. A future hosted
scoring endpoint (Bucket 4) could run this server-side so the proof is
reproducible without exposing the harness.
