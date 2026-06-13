# RCMT Language Specification — Version 001

## Classification: Foundational | Do Not Drift

---

## THE CORE PRINCIPLE

In RCMT, you do not declare meaning. You place things. The geometry reads them.

This is not a design choice. It is a discovery. Every information-dense system
in nature uses geometric position as the primary encoding mechanism:

- DNA encodes meaning in base-pair sequence position along a strand
- Neural tissue encodes certainty by synaptic density and proximity to primary cortex
- Crystal lattices encode energy state in node position
- The fovea encodes resolution priority by distance from center

RCMT is the first AI memory architecture to apply this same principle digitally.
The 28-byte CRVM packet is the atom. The Fibonacci sphere is the periodic table.
Position is the element.

---

## WHY THE SYNTAX IS SELF-EVIDENT

The RCMT language does not require designed syntax rules for certainty, tier,
or relationship. These factors are computed from geometry, not declared by the
programmer. This is what separates RCMT from every existing programming language.

### Certainty — Derived from Radial Distance

The Fibonacci spiral has a mathematical property: node density increases toward
the center. Slots near the core are more tightly packed — more nodes compete for
less space. This creates a natural compression constraint. Only things that
survive compression belong at the center.

The parser computes certainty as:

  certainty = 1.0 - (radius / max_radius)

Where radius = sqrt(slotIndex) * 0.6 (the lattice position formula already
implemented in useSaccadeStore.ts :: latticePosition()).

No certainty declaration needed. The slot index is the certainty declaration.

### Tier — Derived from Fibonacci Band

The 8,000 slots are divided into five contiguous tier bands (TIER_CAPS /
TIER_STARTS in useSaccadeStore.ts):

  Tier 1 — FACT      slots 0–1999     (innermost, densest)
  Tier 2 — SCENARIO  slots 2000–3999
  Tier 3 — METRIC    slots 4000–5499
  Tier 4 — THEORY    slots 5500–6999
  Tier 5 — DREAM     slots 7000–7999  (outermost, sparsest)

The tier is computed from the slot index. It is never declared.

### Relationship — Derived from Angular Proximity

Two slots are related if their angular positions on the sphere are within a
threshold delta. Angular proximity is computed from the golden-angle Fibonacci
distribution. No relationship graph is needed. Proximity IS relationship.

### Temporal Weight — Derived from LWW Timestamp Delta

How recently a slot was updated (the LWW timestamp delta) encodes how actively
a memory is being used. High delta = stale. Low delta = live. The parser reads
this automatically from the 64-bit timestamp in the CRVM packet.

---

## THE RCMT FILE FORMAT — .rcmt

An .rcmt file is a sequence of CRVM records. Nothing else.

  [CRVM record] × N = .rcmt file

Each CRVM record is exactly 28 bytes:

  [16-bit slot index ]  — where in the lattice
  [16-bit intent ID  ]  — what kind of content (maps to tier)
  [32-bit X          ]  — lattice X (computed, not authored)
  [32-bit Y          ]  — lattice Y (computed, not authored)
  [32-bit Z          ]  — lattice Z (computed, not authored)
  [32-bit scale      ]  — visual weight
  [64-bit LWW stamp  ]  — last-write-wins timestamp

A human authoring RCMT provides: slot index + intent ID + content phrase.
The authoring tool computes: X, Y, Z via the same latticePosition() math the
live store uses, plus a scale derived from phrase length. The parser then
re-derives certainty, tier, relationships, and color from the encoded record.

The author places. The geometry reads.

---

## THE PARSER — WHAT IT DOES

The RCMT parser is a translation engine with one input and multiple output targets.

INPUT:  .rcmt binary file
OUTPUT: Any of —
  - TypeScript module (for web/Node.js consumption)
  - Python dict (for ML pipeline consumption)
  - JSON (for REST API consumption)
  - SVG/PNG render (for VLM visual ingestion)
  - Raw binary CRVM stream (for WebSocket sync)

The parser NEVER executes color as instruction. Color is metadata computed
during parsing and attached to the output representation. The color gradient
describes epistemic certainty. It never runs.

---

## THE WALL — WHY PIET DRIFT CANNOT HAPPEN

Piet uses color as executable instruction syntax. RCMT uses color as epistemic
metadata. These are structurally incompatible at the file format level.

An .rcmt file is a binary sequence of 28-byte CRVM records. A Piet interpreter
reads PNG pixel grids. These formats share nothing. No tool that reads one can
accidentally read the other.

The parser IS the wall. Drift Pattern 9 (see RCMT-MASTER-BRIEF-001.md) is
prevented by architecture, not by rules.

---

## WHAT THE RCMT LANGUAGE IS NOT

- NOT a visual programming language (color is metadata, not syntax)
- NOT an esoteric language (it is industry-ready and production-deployable)
- NOT a domain-specific language (it is a universal memory substrate)
- NOT a replacement for TypeScript/Python (it compiles TO them)
- NOT Piet (see above)

---

## CURRENT IMPLEMENTATION STATUS

The RCMT runtime is built and working:
- latticePosition() — slot index to (x,y,z): IMPLEMENTED
- certaintyToRGB() — radius to color gradient: IMPLEMENTED
- 28-byte CRVM packet: IMPLEMENTED
- Binary WebSocket transport: IMPLEMENTED
- LWW timestamp arbiter: IMPLEMENTED
- Five-tier slot system: IMPLEMENTED
- Invariant checking: IMPLEMENTED

The Phase 2 Language layer is built and working:
- .rcmt file format parser — `@workspace/rcmt-parser` (`parse()`,
  `findRelations()`): IMPLEMENTED
- Translation engine (rcmt → TypeScript/Python/JSON/summary) —
  `toTypeScript()`/`toPython()`/`toJSON()`/`toSummary()`: IMPLEMENTED
- `rcmt-parse` CLI: IMPLEMENTED
- .rcmt authoring tooling — `@workspace/rcmt-parser/author`
  (`latticePosition()`, `encodeRecord()`, `encodeRcmtFile()`),
  `rcmt-author` CLI: IMPLEMENTED

Not yet built:
- RCMT grammar definition (formal EBNF for the .rcmt language)
- SVG/PNG render output (for VLM visual ingestion)
- Raw binary CRVM stream output (for WebSocket sync)

---

RCMT-LANG-SPEC-001
The geometry defines the grammar. The parser reads the geometry. The author places.
