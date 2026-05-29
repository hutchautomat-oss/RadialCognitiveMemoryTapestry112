# Roadmap: Variable node radii by text length

## Problem

Today every slot renders at a uniform visual scale (modulated only by mass / reinforcement count, not by the source phrase). A two-word phrase and a fifty-word phrase occupy identical visual real estate. From a foveal-VLM-consumer perspective this is a missed signal: a longer, denser phrase carries more content and could legitimately demand more pixels of the visual field, sharpening the optical-compression payoff.

## Proposed approach

Extend `injectLiveIntentVector` to take an optional `radiusMultiplier` derived from the source phrase length (or, longer-term, from a content-aware metric like token count or embedding norm). Apply the multiplier to the slot's `mass` value at spawn time, leaving the existing reinforcement + decay math intact. No wire-format change: the 28-byte CRVM packet already carries `scale` as a Float32.

Bound the multiplier (e.g. `0.5×` to `3.0×`) so a single very-long phrase cannot dominate a tier's visual field. Reinforcement still bumps the rendered scale on top of the base radius.

## Acceptance criteria

- A user pasting a 50-word phrase sees a visibly larger sphere than a user pasting a 5-word phrase, *in the same tier*.
- Wire format unchanged (`STRIDE_BYTES === 28`, tripwires green).
- BVH proxy radius continues to match visual radius (existing `BVH_PROXY_MULT = 0.15` invariant).
- Decay + reinforcement math unchanged for any given slot's base mass.
- New vitest case: variable-radius slot survives a replay through `mockFrames` with byte-identical reconstruction.

## Not in scope

- Changing the wire format. Scale is already a Float32 in the packet.
- Content-aware radius (embedding-norm based). Start with text length; revisit if useful.
- Variable radius for demo-seeded slots. Demo is uniform-scale on purpose.
