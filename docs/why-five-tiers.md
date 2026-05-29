# Why five tiers?

The five tiers — **Fact / Scenario / Metric / Theory / Dream** — are not a taxonomy chosen for cuteness. They are the **scientific method, projected into memory**:

- **Fact** — irreducible, observed, low-decay. The things you would stake a claim on.
- **Scenario** — modeled situations and what-ifs that reference Facts.
- **Metric** — measured outcomes, pass/fail signals, empirical feedback.
- **Theory** — proposed explanations and unverified roadmaps.
- **Dream** — speculation, abstraction, untested ideas at the periphery of the model's belief.

Each tier has its own **decay rate λ**: Facts barely decay (λ = 0.005), Dreams decay fast (λ = 0.12). Each tier has its own **FIFO queue of vacant slots**, so when a tier fills, the lowest-Health slot *in that tier* is evicted — Dream churn cannot evict Facts. The cognitive metaphor and the implementation match.

The tiers also map directly to **radial position**: Facts at the dense foveated core, Dreams at the sparse rim. A VLM's foveal scan therefore lands on Facts first, Dreams last, in exact agreement with the epistemology. *Where* a piece of memory sits in the sphere literally encodes *how much the model should trust it*.

Five is the number because five is the smallest count that gives a clean fact-→-speculation gradient with intermediate steps for hypothesis, measurement, and modeling. Three would collapse Scenario/Theory together. Seven would add bookkeeping without changing the gradient.

See also: [`why-foveation.md`](./why-foveation.md).
