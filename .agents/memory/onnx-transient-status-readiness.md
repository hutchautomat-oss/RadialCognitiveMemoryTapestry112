---
name: ONNX worker transient-status readiness trap
description: Why encoding "model is ready" by enumerating transient completion statuses is fragile, and what breaks when you add a new worker op.
---

# Transient-status-as-readiness is a trap

The single-in-flight ONNX worker manager derives `isReady` by enumerating
*transient* completion statuses (e.g. `READY`, `CLASSIFY_COMPLETE`, and now
`EMBED_COMPLETE`) rather than tracking a sticky "pipeline loaded" boolean.

**Why this matters:** every time you add a new worker operation that ends with
its own completion status, you MUST also add that status to `isReady`. If you
forget, the very next `classify()`/`embed()` sees `isReady === false` and
*silently* takes the keyword fallback (returns `embedding: null`) — no error,
no log. A `/find` once, and all later classification quietly degrades.

**How to apply:** when adding any new worker op + completion status, update
`isReady` in lockstep. Better long-term shape (not yet done): set a sticky
`loaded = true` on first `READY` and never unset it on transient op-complete
events, so readiness is decoupled from "what op just finished."
