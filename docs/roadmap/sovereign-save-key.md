# Roadmap: `sovereign_save_key.bin` persistence

## Problem

Today the lattice lives only in the browser tab's memory. A page refresh erases the entire tapestry, and the user has no way to hand a grounded RCMT state to a downstream consumer as a file. For an artifact whose central pitch is "another AI can `wget` your grounded memory," this is a load-bearing gap.

The persistence story has been deferred deliberately while the in-memory model stabilized. With per-tier caches, decay engine, hover tooltips, and the wire-format tripwires all locked in, the in-memory shape is stable enough to commit to a binary.

## Proposed approach

Define a sovereign save format that is the natural disk representation of the in-memory lattice:

- A small header (magic bytes, version, `MAX_NODES`, `STRIDE_BYTES`, tier counts, timestamp).
- The full `mockFrames[0]` Float32Array (8,000 × 7 floats = 224 KB).
- The full per-slot state arrays needed to rehydrate behavior: `slotPhrase[]` (as a length-prefixed UTF-8 block), `injectedAt[]`, `reinforcementCount[]`, `mass[]`, `embeddings[]` (optional — debatable whether we want to serialize the 384-d vectors or recompute on demand).

Write on a debounced timer (e.g. every 30 seconds when dirty) plus on `beforeunload`. Read on boot, falling back to the empty initial frame if absent or version-mismatched.

Surface a `/save` and `/load <file>` command in the CommandConsole so users can hand-roll exports for downstream consumers.

## Acceptance criteria

- Refreshing the page restores the lattice byte-identically (or, if `embeddings[]` is excluded, restores positions/scales byte-identically and rebuilds embeddings lazily).
- Save file is self-describing: another agent can decode it without access to the running app.
- Save format version is checked on load; a mismatch is rejected loudly, not silently.
- Wire format unchanged (this is a *disk* format, not a wire format).
- New vitest case: round-trip write → read → re-write produces byte-identical output.

## Open questions

- Should embeddings be serialized? Pro: faster boot, downstream consumers get the vectors. Con: bloats the file from ~250 KB to ~12 MB, breaks the "224 KB shippable" pitch.
- Should the save format optionally include source phrases? For a buyer that wants the substrate without the text payload, an opt-in flag could suppress `slotPhrase[]`.
- Encryption-at-rest? A file labeled "sovereign" arguably warrants symmetric encryption out of the box; tie to a passphrase the user controls.
