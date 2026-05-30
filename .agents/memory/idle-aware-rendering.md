---
name: Idle-aware energy savings (ticker + render loop)
description: How RCMT quiets down when the tab is hidden, and why frameloop is gated on visibility only
---

# Idle-aware energy savings

Two independent idle gates, both driven by the Page Visibility API from `App`:

1. **Ticker auto-pause** lives in `ticker.autoPaused` (separate from the user's
   manual `ticker.running`). The autonomous loop fires only when
   `running && !autoPaused`. **Why two flags:** a manual `/pause` must survive a
   tab return, and the visibility auto-pause must never clobber the user's
   choice — collapsing them into one flag re-breaks that composition.

2. **Render loop** switches `<Canvas frameloop>` to `"demand"` when the tab is
   hidden and back to `"always"` when visible.

**Why gate the render loop on visibility ONLY (not on a visible-static scene):**
the scene has a continuously-drifting light; going demand-mode while the tab is
visible would freeze it and read as a hang. Keeping `"always"` whenever the user
is actually watching preserves the intended ambiance with zero behavior change.

**How to apply / safety:** the frame buffer is mutated in place by injections
regardless of render mode, so on return to the tab `"always"` repaints the
current state on the next frame — no stale/frozen frame, no missing nodes.
Time-based animations (starburst, promotion/demotion) use `performance.now()`,
so anything whose window elapsed while hidden snaps to its final state on
return rather than resuming a stale overshoot. This is a pure efficiency layer:
it touches no wire format, geometry, FIFO, or invariant.
