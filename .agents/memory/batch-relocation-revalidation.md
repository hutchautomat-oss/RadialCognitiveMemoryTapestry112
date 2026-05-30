---
name: Batch relocation must revalidate the source slot
description: When a sweep collects relocation candidates once and then processes them in a loop, each relocation can invalidate a later candidate — guard before acting.
---

# Batch relocation must revalidate the source slot

In the RCMT decay sweep, demotion/promotion candidates are collected in ONE pass
(snapshot of eligible slots), then relocated in a sorted loop. A relocation that
evicts-and-re-occupies a destination-tier slot, or stages an animation on it, can
turn a *still-listed* later candidate into a stale or mid-flight slot.

**Rule:** a relocation helper (`demoteSlot` / `promoteSlot`) must revalidate its
source before mutating — at minimum `mass[src] > 0` and `animStartTime[src] === 0`
— and return null if the slot is no longer a valid, idle occupant.

**Why:** without the guard a freed slot gets relocated a second time
(double-decrementing `tierCounts`, corrupting `vacantSlotsByTier`), or a
just-placed node drifts two tiers in a single sweep. The arithmetic can even stay
*coincidentally* consistent in some interleavings, so a pure count-consistency
test is not enough — assert the stronger "moves at most one tier per sweep".

**How to apply:** any future "collect candidates, then batch-mutate shared slot
arrays" loop (eviction, compaction, federation transfer) needs the same
pre-mutation revalidation. Don't trust a candidate index captured before the loop.
