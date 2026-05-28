---
name: RCMT decay vs binary replay
description: Why continuous frame-buffer mutators must be gated to live mode.
---

Per-tier exponential decay (and any future continuous mutator: fades, drift, ambient animation) writes directly into `mockFrames[activeFrameIndex]`. In LIVE mode that is `mockFrames[0]` — the authoritative state, mutation is desired. In BINARY mode `mockFrames[i]` is a replay snapshot loaded from disk, and mutating it during scrub rewrites history each frame so re-scrubbing the same frame returns a different image.

**Why:** Timeline scrub semantics depend on frames being immutable replay snapshots. Append-only is a product invariant per replit.md.

**How to apply:** Gate any continuous mutator on `!isFileLoaded` (live mode). If a visual effect must run during replay, derive it into the per-instance render value (e.g. `renderScale`) without writing back into `frameData`.
