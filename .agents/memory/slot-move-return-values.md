---
name: Slot-move operations return the destination
description: Operations that relocate a node between slots must return the destination slot.
---

When an operation moves a node from `fromSlot` to `toSlot` (e.g. promotion-inward in `_promoteSlot`), the post-condition is: `fromSlot` is zeroed and re-added to vacancy, `toSlot` holds the node. Callers that subsequently broadcast over the network or log the slot index MUST reference `toSlot`, not the original `fromSlot`, or they advertise an empty slot to peers (an LWW write of "scale=0 at fromSlot") and lose the actual move.

**Why:** In RCMT's LWW WebSocket sync, every mutation broadcasts a 28-byte CRVM packet keyed by `nodeIndex`. Broadcasting the source slot after a move tells every peer to zero the wrong slot, while the real destination never propagates — peers diverge silently.

**How to apply:** Move/promotion functions return `destSlot | null` (not boolean). The reinforcement path stores the destination as `resultSlot` and that is what gets broadcast and logged. Same pattern applies to any future migration (e.g. tier-demotion, semantic re-pinning).
