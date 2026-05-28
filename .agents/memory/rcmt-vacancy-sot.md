---
name: RCMT vacancy source-of-truth
description: Coherence rule between mockFrames init and vacantByTier in useSaccadeStore.
---

When a store carries both a slot-occupancy registry (e.g. per-tier vacant FIFOs) and a pre-allocated frame buffer, **either** the buffer starts empty so a seed/bootstrap path becomes the single occupancy writer, **or** every path that writes into the buffer must reconcile occupancy in the same set() call.

**Why:** Initializing `mockFrames: [new Float32Array(MAX_NODES*STRIDE)]` while leaving `vacantByTier` fully vacant lets the allocator hand out slot indices that already hold legacy/live nodes, silently overwriting them. The bug is invisible until a low-index injection collides with a legacy seed.

**How to apply:** In `useSaccadeStore`, `mockFrames` starts `[]` and `seedFromNodes` is the boot-time occupancy writer. `updateLiveFrame` (the bridge from legacy `useStore.nodes`) reconciles vacancy by removing any newly-occupied slot from its tier's FIFO before returning. Any future write path into a frame buffer must follow the same pattern or extend the bridge.
