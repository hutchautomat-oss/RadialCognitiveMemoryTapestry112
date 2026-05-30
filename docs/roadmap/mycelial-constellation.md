# Mycelial Constellation: how multiple RCMTs combine

## Problem

RCMT today is doctrine for a *single* brain — one 8,000-slot, 224 KB, byte-stable binary. But the product is a grounding substrate for AI, and any real user ends up with **many** RCMTs: the same brain replicated across devices, and *different* brains for different projects that nonetheless share context and need to relate to each other.

There is no canonical answer to "how do two (or two thousand) RCMTs combine?" The existing WebSocket peer-merge silently assumes "many editors, one brain" — a shared 8k coordinate space arbitrated by LWW. It was never designed for composing *distinct* brains. Naively overlaying two independent brains on the shared grid would destroy data, because **slot index is a local coordinate, not a global one**: slot 412 in brain A and slot 412 in brain B are unrelated memories (Invariant 4). This spec writes the missing doctrine.

This is a **vision/roadmap doctrine**, not an implementation task. The deliverable is canonical written intent — the layers, the mechanisms, and the rejected alternative — that future specs and NotebookLM-paste triage can build on. Concrete wire/encoding details for the manifest and text-payload layers, and the unsolved semantic-reconciliation question, become their own specs once this doctrine is accepted.

## Keystone: fractal foveation

The Fact→Dream foveal gradient — "the shape is the meaning" — repeats self-similarly at every scale: a memory inside a brain, a brain inside a company, a company inside an industry. A VLM foveal-scanning a *constellation* reads it the same way it reads one lattice — dense confident core first, sparse speculative rim as context — one altitude up.

This is primarily a **query-traversal property**, not just an aesthetic claim. A scan descends scales the way it descends one lattice: catalog → shelf → book. It does not scan all N brains; it foveal-scans a constellation-level index (which brains are relevant), then zooms into the one or few that matter. This scale-invariance is what unifies the layers below into one law rather than bolted-on features.

## Fusion vs. federation

This distinction is a **storage-layer** distinction, not a query-layer one, and it is the crux of the whole model:

- **Fusion (REJECTED).** Permanently merging two substrates into one larger binary / global coordinate system. Breaks Invariants 1–4 (see "Why DNA stacking is rejected").
- **Federation (the model).** Substrates stay separate, byte-stable shards. A query assembles a **transient, query-time view** across the relevant shards.

The most natural misread is "doesn't a combined view just mean fusion?" — so state it directly: it does not. A transient rendered view for one query is *not* storage fusion, the same way a federated SQL query is not a table merge. The shards on disk never change; only the assembled view for that one query is composite, and it is discarded after.

## The layers

Each layer leads with its **engineering mechanism** and cites biology only as **illustration**. "Because slime mold" is never a reason; "because usage-weighted adaptive routing works, and slime mold is a vivid instance of it" is.

1. **Inside one brain (built today) — radial foveation + reinforcement.**
   *Mechanism:* `sqrt(slot)` radial placement + reinforcement-on-use + per-tier FIFO pruning. *Illustration:* cortical maps (position-as-meaning), hippocampal consolidation. This is the anchor; nothing new. The existing peer-merge work (peers sharing one brain — deterministic same-slot collision resolution, broadcasting injections to every peer's tapestry) is the **intra-brain replication** layer *of this same brain* — "many editors, one brain." It is not the federation answer; it is Layer 1 viewed across devices.

2. **Binding sibling brains — a manifest graph index.**
   *Mechanism:* an out-of-band index of edges (pointers) between brains plus transferable text payloads, stored *above* the binaries. The 28-byte stride is never touched. *Illustration:* mycorrhizal networks linking separate trees; endosymbiosis — mitochondria keep their own DNA even after absorption, so brains never fuse. Name this layer honestly: it is a **graph index of pointers + transferable text payloads over byte-stable shards**, not "a connectome." In a brain, structure *is* memory; here data and relationships are deliberately separated. That separation is the federation layer (every sharded system has one), not a demotion of the binaries, which remain the substrate of meaning a VLM actually scans.

3. **Lateral capability transfer — content re-grounding.**
   *Mechanism:* what crosses between brains is **source content, never position bytes.** A lateral transfer ships the **source phrase (text payload)**; the receiving brain re-injects it through its *own* classifier and lands it in its *own* local slot — exactly how a recipient cell re-expresses a transferred gene in its own machinery. Raw slot-position bytes are meaningless across brains and must never be the transfer unit. *Illustration:* plasmid / horizontal gene transfer. This rides on the existing roadmap "serializable context-ground export / text-payload sidecar" item — without that text payload, there is nothing lawful to transfer.

4. **Keeping the constellation coherent — coordination cadence + triggers.**
   *Mechanism:* a federation registry/coordinator schedules manifest exchange; a density/quorum trigger decides *when* to run a federation pass. **Synchronization is a coordination cadence, never a re-layout of memory** — keeping brains "in rhythm" means agreeing on *when* to exchange manifest state, not rearranging slots inside any brain. Per-brain byte layout is never touched by sync, so Invariant 3 (byte-stability) holds. *Illustration:* Kuramoto coupled-oscillator timing and quorum sensing — **as metaphors only.** Kuramoto is at most a timing metaphor for the cadence; it is NOT a mechanism for aligning semantic state, and brains do not "phase-lock their Fact cores." Quorum sensing is at most a **trigger** ("enough peers online → run a pass"), never a state-sync mechanism.

5. **The org as a federated query surface — usage-weighted routing.**
   *Mechanism:* a router treats the set as federated shards. A query is a transient foveal scan routed to the relevant shard(s); hot routing paths reinforce, cold ones decay. This answers "can they form a database?" — yes, as a **federated query**, not a monolith. *Illustration:* slime-mold path optimization.

## The coordination role is real — say so

The replication path already uses a server arbiter (LWW). Federation needs a manifest registry / coordinator too. "No central authority" is **aspirational** and must be stated as such, not as a fact. Quorum sensing is a trigger, not a state-sync mechanism. Do not oversell decentralization: there is an index/coordinator role in this model, and pretending otherwise is exactly the kind of metaphor-doing-logical-work this doctrine exists to prevent.

## Why DNA stacking is rejected

Fusing two lattices into one bigger structure — 16k slots, a global coordinate system — breaks the load-bearing invariants: capacity-constant-by-construction, 8k forever, 224 KB on the wire, byte-stability, and local coordinates. It is recorded here as a rejection so it is not re-litigated.

Biology backs the rejection: endosymbiosis had every chance to fuse two genomes into one and still kept them separate (mitochondria retain their own DNA). Separate genomes, coordinated behavior — that is federation, not fusion.

## The guardrail

Biology grows *and* prunes. Import the pruning — FIFO eviction is synaptic pruning / slime-mold tube abandonment — and leave the growth: every individual brain stays fixed at 8k / 224 KB / byte-stable. **All federation lives *above* the binaries** (manifest index, coordination, routing). The four wire-format invariants stay the hard line; the constellation model is the soft anchor wrapped around them. If any biological flourish ever tensions with an invariant, the invariant wins.

## Open questions

- **Cross-brain semantic reconciliation is unsolved.** *How* semantic state is reconciled across brains without shared embeddings — i.e. how the manifest decides that a memory in brain A is "the same as" or "related to" one in brain B when positions are local and no embedding is shared on the wire — is a genuinely open problem. It is not hand-waved by the cadence layer (which only sets *timing*) and it is not solved by the text-payload transfer (which re-grounds content but does not align it). This belongs to a future spec.
- **Manifest wire/encoding format.** The edge-index and text-payload encodings are deliberately unspecified here; they become their own specs once this doctrine is accepted.
- **Trust and provenance across shards.** A federated query crossing org boundaries needs an authority model for which shards a query may touch; out of scope here, flagged for licensing/multi-tenant work.

## Not in scope

- Any implementation — no manifest format code, no router, no sync engine, no registry, no changes to the 28-byte stride, the LWW core, or the WebSocket path.
- Changing the peer-merge tasks themselves — they keep their own scope; this doctrine only adds cross-referencing vocabulary so they read as the intra-brain replication layer.
- Pricing, licensing, multi-tenant billing (out of scope per `replit.md`).
