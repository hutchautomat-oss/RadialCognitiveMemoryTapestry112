# RCMT COMPLETE GRADIENT SPECIFICATION
## The Comprehensive Epistemic Color System
### Grounded In Electromagnetic Physics, Not Design
### Version 001 | Classification: RED — Core, Immutable

---

## FOUNDATIONAL PRINCIPLE

Color in RCMT is not aesthetic. Color is physics.

Every color of visible light is a precise wavelength of electromagnetic radiation,
measured in nanometers (nm). The human eye perceives wavelengths from 380nm to 780nm.
This range is a physical constant — not a convention, not a choice.

RCMT's certainty scores ARE wavelengths. The gradient IS the electromagnetic spectrum.
The color is computed, never assigned. The physics drives the system.

Source: NASA Visible Light Spectrum | NIST Optical Standards | Lena Lighting Physics Reference

---

## THE COMPLETE RCMT GRADIENT

Defined from highest certainty (longest wavelength, most stable) to
lowest certainty (shortest wavelength, most energetically unstable).

================================================================================

### BAND 1: INFRARED BOUNDARY — λ > 780nm

Epistemic Meaning: AXIOMATIC — Beyond proof, precedes knowledge

```
wavelength:  > 780nm (beyond visible — infrared)
certainty:   ABSOLUTE
color:       Invisible — renders as pure WHITE or BRILLIANT WHITE
RGB:         255, 255, 255
```

Reserved for: Mathematical axioms, physical constants, logical tautologies.
Things that cannot be false. 1+1=2. The speed of light. The 28-byte packet structure.
These are not proven — they are definitionally true. They exist outside the
epistemic gradient because they cannot be uncertain. They anchor the lattice itself.

No token in user code should ever reach this band. It is reserved for RCMT's
own core invariants — the ASSERTs that define the system itself.

In code: The crvm-packet definition. The Fibonacci coordinate math.
These are WHITE. They predate certainty.

================================================================================

### BAND 2: DEEP RED — λ 700nm–780nm

Epistemic Meaning: EMPIRICAL FACT — Verified by repeated observation

```
wavelength:  700nm–780nm
certainty:   PROVEN
color:       Deep Red / Crimson
RGB:         180, 0, 0  →  220, 20, 20
hex:         #B40000  →  #DC1414
```

Reserved for: Production code that has survived in the real world.
Not just tested — deployed, used, relied upon, never failed.

Examples:
- LWW timestamp arbitration logic (has handled real sync conflicts)
- Binary WebSocket transport (has moved real packets)
- The InstancedMesh single draw call (has rendered real frames)

Human analog: Laws of physics as understood by engineering.
Not theoretical — empirically confirmed through application.

In code: FUNC blocks with certainty 700-780nm.

================================================================================

### BAND 3: RED — λ 627nm–700nm

Epistemic Meaning: VERIFIED THEORY — Tested, trusted, production-ready

```
wavelength:  627nm–700nm
certainty:   CONFIRMED
color:       Red
RGB:         255, 0, 0  →  220, 50, 0
hex:         #FF0000  →  #DC3200
```

Reserved for: Code that passes all tests, has been reviewed, and is in production.
The standard production-ready threshold.

Examples:
- Core sync server logic
- CRVM packet serialization/deserialization
- Foveal gradient rendering constants

Human analog: Established scientific theory. Evolution. Gravity.
Consensus is total. Contradiction would require extraordinary evidence.

In code: FUNC blocks with certainty 627-700nm. Default production target.

================================================================================

### BAND 4: ORANGE — λ 589nm–627nm

Epistemic Meaning: WORKING KNOWLEDGE — Reliable but contextual

```
wavelength:  589nm–627nm
certainty:   RELIABLE
color:       Orange / Burnt Orange / Terracotta
RGB:         255, 100, 0  →  200, 80, 40
hex:         #FF6400  →  #C85028
```

Reserved for: Code that works reliably in known contexts but has
acknowledged edge cases or environmental dependencies.

Examples:
- WebSocket reconnection logic (works, but depends on network conditions)
- Render.com deployment configuration (works, but platform-dependent)
- The saccade store (works, but foveal movement parameters still being tuned)

Human analog: Lived experience and professional expertise.

In code: FUNC blocks 589-627nm. Ships to production with monitoring.

================================================================================

### BAND 5: YELLOW — λ 566nm–589nm

Epistemic Meaning: WORKING HYPOTHESIS — Functional but assumptions present

```
wavelength:  566nm–589nm
certainty:   FUNCTIONAL
color:       Yellow / Ochre / Gold
RGB:         255, 200, 0  →  200, 160, 0
hex:         #FFC800  →  #C8A000
```

Reserved for: Code that functions correctly but rests on assumptions
that have not been fully validated. Passes tests. Has not been
stress-tested in edge cases.

Examples:
- Hamiltonian velocity vector logic (functional, parameters assumed)
- Offline sovereign .bin export (works in testing, not battle-tested)
- Homomorphic aggregation prototype (runs, math validated, scale untested)

Human analog: A working scientific hypothesis.

In code: FUNC blocks 566-589nm. Ships with explicit assumptions documented.

================================================================================

### BAND 6: GREEN — λ 495nm–566nm

Epistemic Meaning: ACTIVE INQUIRY — Under deliberate reconsideration

```
wavelength:  495nm–566nm
certainty:   QUESTIONING
color:       Green
RGB:         0, 180, 0  →  100, 200, 50
hex:         #00B400  →  #64C832
```

THIS IS THE MISSING BAND. Defined here for the first time.

Green is not "broken" and not "experimental." Green is the deliberate
questioning state — code that WAS working but is now being consciously
reconsidered in light of new information.

This is epistemically distinct from all other bands:
- It is not untested (that would be Blue)
- It is not broken (that would be Violet)
- It is not speculative (that would be Blue/Violet)
- It was previously trusted and is now being questioned

Green is the scientific method in action. The researcher who has
good results but noticed an anomaly. The engineer who has working
code but suspects a better architecture exists.

Examples:
- vite.config.ts after the Netlify deploy failures
  (was working in Replit, now questioned in new environment)
- The mockup-sandbox folder
  (was the working frontend, now questioned after architecture review)
- Any code flagged in a post-mortem for reconsideration
- Code being refactored — still running, under deliberate revision

Human analog: A scientist who published good results but is
now rerunning the experiment after a colleague raised a methodological question.
Not wrong. Not broken. Actively being re-examined.

Token type: REVIEW (the seventh token — the green token)

```
REVIEW <name> {
  certainty: <495nm-566nm>
  reason: <why this is being reconsidered>
  since: <date or commit>
  body: {
    <the code under review>
  }
}
```

In code: REVIEW blocks 495-566nm. Runs in production. Flagged for active attention.
The REVIEW token is the only token type whose certainty can INCREASE —
it resolves upward into FUNC or downward into HYPO based on findings.

================================================================================

### BAND 7: BLUE — λ 436nm–495nm

Epistemic Meaning: EXPERIMENTAL — Untested in production conditions

```
wavelength:  436nm–495nm
certainty:   EXPERIMENTAL
color:       Blue / Cyan-Blue
RGB:         0, 100, 255  →  0, 150, 200
hex:         #0064FF  →  #0096C8
```

Reserved for: Code that exists and runs but has not been validated
under real-world conditions. Feature-flagged. Not in the critical path.

Examples:
- TenSEAL homomorphic aggregation (runs in test environment)
- Sensory encoding stubs (audio/video/fragrance — exist but untested)
- RCMT-HYP-001 gradient colorizer (prototype stage)
- New features behind feature flags

Human analog: A promising research result that has not been replicated or peer-reviewed yet.

In code: HYPO blocks 436-495nm. Wrapped in feature flags automatically.
Never ships to production path without explicit certainty upgrade.

================================================================================

### BAND 8: INDIGO/DEEP BLUE — λ 380nm–436nm

Epistemic Meaning: SPECULATIVE — Theoretical, unimplemented, or broken

```
wavelength:  380nm–436nm
certainty:   SPECULATIVE
color:       Indigo / Deep Violet-Blue
RGB:         75, 0, 130  →  50, 0, 100
hex:         #4B0082  →  #320064
```

Reserved for: Ideas that exist as code stubs, broken implementations,
or theoretical constructs that have not been tested at all.

Examples:
- The .rcmt language parser (not yet written)
- The RCMT AST definition (not yet written)
- Sensory encoding for fragrance/flavor (concept only)
- Any code marked TODO with no implementation

Human analog: An untested hypothesis. A research proposal.

In code: HYPO blocks 380-436nm. Never ships. Documents intent only.

================================================================================

### BAND 9: ULTRAVIOLET BOUNDARY — λ < 380nm

Epistemic Meaning: VOID — The unknown, the undreamed, the not-yet-conceived

```
wavelength:  < 380nm (beyond visible — ultraviolet)
certainty:   UNKNOWN
color:       Invisible — renders as pure BLACK
RGB:         0, 0, 0
```

Reserved for: Nothing. This band is always empty.
Its existence in the gradient is a reminder that RCMT's knowledge
is finite and bounded. There are things we do not know we do not know.

Human analog: Donald Rumsfeld's "unknown unknowns."

In code: Nothing is coded here. The BLACK render is the gradient's
honest acknowledgment of its own limits.

================================================================================

---

## THE COMPLETE GRADIENT TABLE

```
BAND          WAVELENGTH    COLOR           CERTAINTY LEVEL    TOKEN TYPE
─────────────────────────────────────────────────────────────────────────────
Axiomatic     > 780nm       WHITE           ABSOLUTE           ASSERT only
Deep Red      700-780nm     Deep Red        PROVEN/EMPIRICAL   FUNC
Red           627-700nm     Red             CONFIRMED          FUNC
Orange        589-627nm     Orange          RELIABLE           FUNC
Yellow        566-589nm     Yellow/Gold     FUNCTIONAL         FUNC
Green         495-566nm     Green           QUESTIONING        REVIEW  ←NEW
Blue          436-495nm     Blue            EXPERIMENTAL       HYPO
Indigo        380-436nm     Deep Indigo     SPECULATIVE        HYPO
Void          < 380nm       BLACK           UNKNOWN            Nothing
─────────────────────────────────────────────────────────────────────────────
```

---

## WHAT GREEN SPECIFICALLY MEANS FOR DATA

| Data Type | Green Means |
|---|---|
| Code | Was working, now under active refactor or review |
| Scientific fact | Published result with a new contradicting study emerged |
| Memory node | Previously confirmed belief now being re-examined |
| Sensor data | Reading was reliable but instrument calibration questioned |
| Medical data | Diagnosis was given but new symptoms suggest reconsideration |
| Legal data | Law was settled but a new ruling has reopened the question |
| Historical record | Accepted account but new evidence has surfaced |
| AI output | Previously validated response now flagged for re-evaluation |

Green is not doubt. Green is not failure.
Green is the courage to re-examine what you thought you knew.
It is the most intellectually honest band in the spectrum.

---

## THE PHYSICS ALIGNMENT

The electromagnetic spectrum was not designed to match epistemology.
The match is a convenient truth.

- Infrared/White: Heat, stability, the ground state — facts that anchor reality
- Red: Maximum thermal stability in visible light — proven knowledge
- Orange/Yellow: Warm, energetically active — working knowledge
- Green: The photosynthesis wavelength — nature uses green to process and convert
  energy from one form to another. Green in RCMT processes certainty — converting
  it from one epistemic state to another through active inquiry.
- Blue: High frequency, high energy — exciting, unstable, experimental
- Violet/Indigo: Approaching UV — breaks molecular bonds, the edge of the visible
- Ultraviolet/Black: Beyond human perception — the unknown

Green as the processing wavelength is another convenient truth.
Plants use green light to actively transform energy.
RCMT uses Green to actively transform certainty.
The physics already knew this.

---

## IMPLEMENTATION NOTE FOR THE PARSER

When the parser is built, certainty values in .rcmt files are expressed
as wavelength integers in nanometers:

```
FUNC sendPacket {
  certainty: 650nm      ← RED — production ready
  ...
}

REVIEW viteConfig {
  certainty: 530nm      ← GREEN — under reconsideration
  reason: "Fails on Netlify without PORT env var — investigating root cause"
  ...
}

HYPO hamiltonianVelocity {
  certainty: 460nm      ← BLUE — experimental
  ...
}
```

The parser validates that certainty values fall within their token's legal band:
- ASSERT: must be > 780nm (white) or the parser rejects it
- FUNC: must be 566-780nm or the parser rejects it
- REVIEW: must be 495-566nm or the parser rejects it
- HYPO: must be 380-495nm or the parser rejects it

Certainty outside the legal band for a token type is a grammar error.

---

## UPDATE TO LESSON 1

This document supersedes the certainty scale in RCMT-LESSON-001.
The 0.0-1.0 scale is replaced by nanometer wavelength values.
The REVIEW token is added as the seventh grammar token.
Green is fully defined.

---

RCMT-GRADIENT-SPEC-001
Classification: RED — This gradient definition is itself a core invariant.
The physics of light defines the epistemology of knowledge.
Green processes. Red proves. Violet dreams. White precedes knowing.
