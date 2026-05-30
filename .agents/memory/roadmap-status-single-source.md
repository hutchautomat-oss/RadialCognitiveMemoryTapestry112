---
name: Roadmap status single source
description: Where build status (Built/Planned/Rejected) lives, and why replit.md must not duplicate it.
---

# Roadmap status: docs/roadmap.md is the single source of truth

`docs/roadmap.md` (Built / Planned / Rejected, each rejection with a one-line
"why") is the **only** place build status should live. `replit.md` must point to
it, not re-list it.

**Why:** the two copies drifted. `replit.md` had a "Roadmap — not in the current
build" list that still called Task #1 (BVH + lasso) and Task #3 (per-tier caches)
future work long after both shipped, and a Gotcha that `NodeCloud.tsx` "still
exists" after it was deleted. Duplicated status is duplicated maintenance and it
silently goes stale.

**How to apply:**
- New planned/built/rejected status → edit `docs/roadmap.md` only.
- Keep in `replit.md` only *decisions* that aren't status (e.g. the `10000.0`
  cleartext-matrix scale is reserved; the `5.0` Z-stride must not return).
- Before trusting any "Task #N is future work" note in `replit.md`, verify
  against code (grep the file/symbol); status notes there are suspect.
