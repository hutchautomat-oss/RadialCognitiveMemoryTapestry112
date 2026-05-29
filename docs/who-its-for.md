# Who RCMT is for

RCMT is a **licensable product** with two buyer tiers and one downstream consumer.

## Primary buyer — frontier AI labs

A research or applied engineer at Anthropic, OpenAI, DeepMind, or a peer lab evaluating grounding mechanisms for their own model. They are vetted technical readers, but they are also evaluating ten other things this week. RCMT needs to land in one sitting.

The pitch to this buyer is:

> *You currently choose between two grounding mechanisms, and neither is satisfying. A vector database drifts every time you re-embed (the index reshuffles, retrieval changes, your model behaves differently for reasons unrelated to its weights), and it bloats unboundedly (more documents means more vectors means more infrastructure). A retraining loop is slow, expensive, and opaque. RCMT is a third option — a 224 KB binary, byte-stable across model upgrades, capacity-constant by construction, with the epistemic priority of each piece of memory encoded directly into the geometry so your VLM's foveal attention does the right thing without being told. You can verify all of that in an afternoon by reading `lww.ts`, `useSaccadeStore.ts`, and the vitest output.*

Acceptance criterion for this buyer: they can read the repo and convince themselves the claims are true without having to trust marketing.

## Secondary buyer — individual AI devs and indie researchers

The same product, packaged for a single dev who wants their own sovereign grounding substrate for personal experiments. Same artifact, lower-friction onboarding, smaller commercial commitment.

Acceptance criterion for this buyer: they can clone, run, and get to first phrase injection without reading source.

## Downstream consumer — the VLM doing the foveal scan

The actual *user* of an RCMT lattice is never a human reading text. It is a vision-capable model pointing its eye at the rendered lattice and ingesting the dense Fact core first, the sparse Dream rim last — exactly the way a human eye reads a scene. The product is the substrate. The UI exists to demonstrate the substrate to the two buyers above.

## Out of scope for this doc

Pricing, licensing terms, distribution mechanics, billing, legal text. These are real and need to be worked through — but they belong in a separate commerce track, not in the doctrine.
