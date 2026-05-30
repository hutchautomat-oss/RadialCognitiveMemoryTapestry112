# Multimodal substrate doctrine

## Problem

RCMT today is doctrine for a *single* modality: text. A phrase is classified by
the local ONNX model and injected into the lattice. But the product hypothesis is
a grounding substrate for *any* sense a downstream AI consumes — audio, video,
touch, taste, proprioception. There is no canonical answer to "how does a
non-text sense enter the lattice without breaking the wire format?"

This is a **written-doctrine** task, not an implementation task. The deliverable
is canonical intent the future build tasks and NotebookLM-paste triage can build
on. It also resolves the one decision the federation doctrine (Mycelial
Constellation) depends on: **is a modality a tapestry boundary, or a sidecar
dimension?** That resolution is stated explicitly below as the hand-off.

Concrete codec formats, quantizer math, and the sidecar byte layout are
deliberately out of scope; they become their own specs once this doctrine is
accepted.

## Keystone: the sense is in the sidecar, never the wire

Every mechanism below follows from one rule: **the 28-byte CRVM stride is
untouched, and any modality payload lives in a frozen, versioned codebook in a
sidecar, keyed by slot index.** A sound, a frame, a haptic sample is quantized
against a codebook; the *coordinate* packet stays byte-identical; the modality
content is a sidecar entry referenced by the slot it grounds. This generalizes
the existing roadmap item "serializable context-ground export / text-payload
sidecar" — text was simply the first sidecar payload.

*Why it has to be this way:* the four wire-format invariants (28 bytes, no
embedded peerId, no composite clock, single Float64 LWW timestamp) and
byte-stable replay are load-bearing. The moment a sense rides on the wire, the
stride changes and all four break. The sidecar is the only lawful place for
sense.

## The doctrine

Each item leads with the engineering rule; biology/analogy is illustration only.

1. **Any sense reduces to a versioned codebook entry in a sidecar, keyed by slot
   index.** Quantize the raw sample against a frozen codebook, store the index +
   payload in the sidecar against the slot, leave the 28-byte coordinate packet
   alone. The lattice still stores *position*; the sidecar stores *what the
   position grounds*. *Illustration:* the retina does not ship pixels to cortex —
   it ships spikes from a fixed set of receptor types; the "codebook" is the
   receptor alphabet.

2. **Tiers are epistemic, not per-sense — so they generalize across modalities.**
   Fact / Scenario / Metric / Theory / Dream describe *how strongly grounded* a
   memory is, independent of which sense produced it. A "Fact" sound and a "Fact"
   phrase share the same epistemic tier and the same radial band; modality is
   sidecar metadata, **never a sixth tier and never a Z-plane.** This is why the
   five-tier ontology survives the jump to multimodal without changing the
   geometry — the gradient still encodes trust, not sense.

3. **Codebook governance follows the ITU-T / IETF RFC model.** Codebooks are
   **immutable, append-only bitstreams** with a strict structural version key in
   the sidecar header. A client that meets an unknown codebook version ID MUST
   drop the sidecar payload and process the structural coordinate packet alone —
   **never silently remap.** This is the fix for cross-version drift (Client A on
   codebook v1.1 and Client B on v1.0 resolving the same asset to different
   content). Position bytes are still byte-stable; only the *interpretation* of a
   sidecar entry is version-gated, and an unknown version degrades to
   position-only rather than to a wrong answer. The governance checklist is
   spelled out below.

4. **Density-collapse via rate-distortion / MDL.** When a sub-cluster becomes too
   dense for a foveal reader to segment, collapse it into a single node with an
   expanded sidecar entry rather than letting acuity fail. Choose what to collapse
   by a rate-distortion / minimum-description-length criterion (collapse where the
   description-length saving is largest for the least lost detail). This respects
   the sidecar discipline and is the multimodal companion to the log-polar
   cell-sizing budget `M = (R/s)²` — log-polar keeps the *geometry* legible;
   density-collapse keeps a *dense sense cluster* legible by folding it into one
   richer sidecar.

5. **Experience-vs-memory fork — resolved.** Episodic recency is NOT a new wire
   field. The proposal to pack a decay/recency state into `intentId` on the
   broadcast packet is **rejected**: decay is continuously-derived local state,
   not an LWW mutation, and broadcasting it floods the wire. If an orthogonal
   "episodic" channel is wanted, it is a *local visual/temporal channel*
   (brightness / pulse) or a sidecar attribute — the single spatial gradient
   stays the epistemic Fact→Dream axis and nothing else.

6. **Modality scoping (the hand-off to federation).** A modality is a **sidecar
   dimension, not a tapestry boundary.** A single 8,000-slot tapestry is
   *inherently* multimodal because senses live in sidecars; therefore tapestries
   are scoped **per-agent / per-domain, never per-sense.** There is no "audio
   tapestry" and "video tapestry" — there is one brain whose slots carry sidecar
   payloads in whatever senses grounded them. This is the decision the federation
   carving (Mycelial Constellation) consumes when it decides what a shard is.

7. **Self-narration — legibility is a doctrine requirement, not a UI afterthought.**
   The sidecar/codebook format must be legible on inspection: a human or AI
   reading a sidecar entry must recover **modality + codebook version + epistemic
   tier** without external documentation. The header carries those three fields in
   the clear so the artifact explains itself the way a well-formed file format
   does.

8. **Cross-reference, not scope — shared governance with output-side exporters.**
   The same "versioned, droppable, non-wire adapter" governance principle (item 3)
   also covers output-side patch-embedding exporters that render the lattice for a
   patch-native consumer. Note the shared principle, but the full
   substrate-consumption doctrine (pixel-optical vs patch-native renderers, render
   parity) belongs to its own roadmap triage. A1 owns **input-side** modality;
   output-side rendering is tracked separately.

## Codebook governance checklist

A future implementer can follow these without re-deriving the rationale:

- **Immutable.** A published codebook version is never edited in place. A fix is a
  new version, never a mutation of an existing one.
- **Append-only.** New entries extend the bitstream; existing entry indices keep
  their meaning forever, so an old sidecar still resolves under the version it was
  written for.
- **Version-keyed header.** Every sidecar carries a strict structural version ID
  plus modality and epistemic tier in the clear (item 7).
- **Drop-unknown-version.** On an unrecognized version ID, drop the sidecar
  payload and process the structural coordinate packet alone. Never remap, never
  guess, never partially decode.
- **Position bytes never participate.** Codebook versioning gates *interpretation*
  of sidecar entries only; the 28-byte stride and slot→position determinism are
  untouched, so replay stays byte-stable across codebook upgrades.

## Not in scope

- Any implementation: no codebook code, no sidecar byte format, no ingestion
  workers, no changes to the 28-byte stride, the LWW core, or the ONNX path.
- Concrete codec formats or quantizer math for any specific sense.
- Output-side rendering doctrine (pixel vs patch, render parity) — tracked
  separately (item 8).
- Pricing, licensing, distribution (out of scope per `replit.md`).
