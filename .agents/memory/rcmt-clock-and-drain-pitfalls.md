---
name: RCMT clock-domain & drain-queue pitfalls
description: Two recurring bug shapes in RCMT's animation/telemetry code — mixed time clocks and drain-before-gate queues.
---

## Mixed clock domains (Date.now vs performance.now)

RCMT's per-slot animation timestamps (`animStartTime`, spawn/promotion timing) are
written with `performance.now()` in the store. Any consumer comparing "is this slot
still animating?" MUST also use `performance.now()`. Comparing against `Date.now()`
yields a huge delta (the two clocks have different epochs), so the animation always
reads as "finished" / "not in flight" and the check silently never fires.

**Why:** monotonic perf clock and wall-clock are different time bases; mixing them is
a no-error silent logic bug.
**How to apply:** before comparing any timestamp field, confirm which clock wrote it
and match it. In RCMT, animation/frame timing = `performance.now()`; `injectedAt`
(decay basis) = wall-clock `Date.now()`.

## Drain-before-gate loses queued items

A throttled `useFrame` consumer that drains a shared queue must check the throttle
gate BEFORE draining. If it drains first and then early-returns on the throttle
window, the drained items are discarded forever. Reorder to: throttle-check → return
early (items stay queued) → drain. Safe only because the queue is bounded
(`REMOTE_FLASH_CAP`), so deferring a frame or two cannot grow it unbounded.

**Why:** `drain*()` clears the source; an early-return after draining drops the batch.
**How to apply:** for any "drain + throttle/batch" loop, gate first, drain second; and
make sure the producer side caps the queue so deferral is bounded.
