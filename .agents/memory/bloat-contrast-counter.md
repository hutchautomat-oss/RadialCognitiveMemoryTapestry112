---
name: Bloat-contrast counter semantics
description: Why RCMT's "vector-DB equivalent" counter counts every injection, not just new admissions
---

# Bloat-contrast counter counts the FULL input stream

The HUD's "would-be vector-DB bloat" readout multiplies an injection counter
(`totalInjected` in `useHudStore`) by per-vector bytes (dim × 4). That counter
must advance on **every** injection that reaches the write path — spawn AND
reinforce alike — incremented unconditionally in the canonical inject path after
the low-confidence/rejected early-return.

**Why:** The figure's whole point is an honest contrast against a naive vector
store. A naive vector DB appends a fresh vector on *every* insert; it never
dedups a repeated idea and never recycles a slot. RCMT does both (reinforce +
per-tier FIFO eviction), so its footprint stays pinned at 224 KB / 8000 while
the counter shows what an un-deduped store would have grown to. Counting only
spawns (admissions) understates the contrast and is wrong — it credits RCMT's
dedup to the *baseline*, erasing the very saving being demonstrated.

**How to apply:** Do not "optimize" the counter back to spawn-only / admissions-
only. Two separate code reviews disagreed on this; the spawn-only view is the
tempting-but-wrong one. The counter is volume-of-stream, the 224 KB is
footprint-of-substrate — that gap IS the thesis. Pinned by an injectPhrase test
asserting the counter increments across a spawn → reinforce → spawn sequence.
