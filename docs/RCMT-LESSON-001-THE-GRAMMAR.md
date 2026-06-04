# RCMT LESSON 1: THE GRAMMAR
## Understanding What Makes a Valid .rcmt File
### Classification: VIOLET — Hypothesis Stage | Track 2
### Prerequisite: Track 1 (Core RCMT) must be working before implementing this

---

## BEFORE YOU READ THIS

This lesson describes Track 2 — the .rcmt language layer. It is a hypothesis.
Track 1 (the 28-byte packet, binary WebSocket, InstancedMesh lattice) is the real product.
This lesson exists so the idea is formally documented and teachable.
Nothing here changes Track 1. Nothing here executes until a parser exists.

---

## WHAT A GRAMMAR IS — ELI5

A grammar is a rulebook that tells a parser what is legal in a language.

English has grammar rules: sentences need a subject and a verb. "Cat the ran" is illegal. "The cat ran" is legal. A grammar defines the difference.

Programming languages have grammars too. TypeScript's grammar says: a function must have parentheses, a return type, and a body. If you write a function without parentheses, the TypeScript compiler rejects it — because it violates the grammar.

An .rcmt file needs its own grammar. Without one, no parser can read it. Without a parser, nothing can translate it to TypeScript or Python or binary CRVM.

The grammar is Step 1. Everything else depends on it.

---

## WHAT AN .rcmt FILE CONTAINS

An .rcmt file is NOT a visual file. It does NOT contain color pixels.

This is a critical point. The color gradient is a rendered representation — what a human or AI sees when they look at .rcmt code. Underneath, the file contains:

1. Node declarations — what memory nodes exist
2. Epistemic scores — how certain each node is (expressed in nanometers)
3. Relationships — how nodes connect to each other
4. Logic blocks — what the code actually does
5. Gradient metadata — the certainty layer that drives the color

The parser reads all five. The IDE renders the gradient visually from the scores. The translation engine strips the gradient and outputs pure logic.

---

## THE SEVEN TOKENS OF RCMT GRAMMAR

Every language has tokens — the smallest meaningful units. English tokens include words, punctuation, and spaces. RCMT has seven token types:

### TOKEN 1: NODE

Declares a memory node on the Spherical Fibonacci Lattice.

```
NODE <slot_index> <intent_id> {
  certainty: <wavelength in nm>
  content: <any value>
}
```

Example:

```
NODE 0 1 {
  certainty: 700nm
  content: "gravity is 9.8m/s²"
}
```

Slot 0, Intent 1. Certainty 700nm = deep red = empirically confirmed fact.
This node never moves. Its coordinate is mathematically derived from slot 0.

### TOKEN 2: LINK

Declares a relationship between two nodes.

```
LINK <slot_a> -> <slot_b> {
  weight: <0.0-1.0>
  type: <supports | contradicts | extends | requires>
}
```

Example:

```
LINK 0 -> 7 {
  weight: 0.8
  type: supports
}
```

Node at slot 0 supports node at slot 7 with 80% weight.

### TOKEN 3: FUNC

Declares a logic block — actual executable code.

```
FUNC <name> {
  certainty: <566nm-780nm>
  target: <typescript | python | wasm>
  body: {
    <standard code in target language>
  }
}
```

Example:

```
FUNC sendCRVMPacket {
  certainty: 720nm
  target: typescript
  body: {
    const buf = new ArrayBuffer(28)
    const view = new DataView(buf)
    view.setUint16(0, slotIndex, true)
    view.setUint16(2, intentId, true)
    view.setFloat32(4, x, true)
    view.setFloat32(8, y, true)
    view.setFloat32(12, z, true)
    view.setFloat32(16, scale, true)
    view.setBigUint64(20, timestamp, true)
    socket.send(buf)
  }
}
```

Certainty 720nm = deep red = this function is proven. Parser tags it DEEP RED.
Translation engine outputs it verbatim.

### TOKEN 4: ASSERT

Declares an invariant — something that must always be true.

```
ASSERT <name> {
  certainty: >780nm
  rule: <condition>
  violation: <error message>
}
```

Example:

```
ASSERT packetSize {
  certainty: 800nm
  rule: sizeof(CRVMPacket) == 28
  violation: "CRVM packet size violation — sacred rule broken"
}
```

ASSERTs always have certainty > 780nm (WHITE/AXIOMATIC). They live at the foveal core.
They never migrate outward.

### TOKEN 5: HYPO

Declares a hypothesis — code that exists but is not proven.

```
HYPO <name> {
  certainty: <380nm-495nm>
  status: <testing | speculative | broken>
  body: {
    <experimental code>
  }
}
```

Example:

```
HYPO hamiltonianVelocity {
  certainty: 460nm
  status: testing
  body: {
    // velocity vector per node — 8 bytes
    // position = epistemic state
    // momentum = rate of foveal migration
  }
}
```

HYPO blocks render BLUE (460nm) or INDIGO (400nm). The translation engine wraps them
in feature flags automatically.

### TOKEN 6: EMIT

Tells the translation engine what to output and where.

```
EMIT <target> <filename> {
  include: [<func_names> | all | red | orange | terra | gold]
  exclude: [<func_names> | hypo | violet]
}
```

Example:

```
EMIT typescript "artifacts/rcmt/src/network/crvm.ts" {
  include: [sendCRVMPacket, receiveCRVMPacket]
  exclude: [hypo]
}

EMIT python "artifacts/rcmt-extensions/homomorphic.py" {
  include: [tensealAggregation]
  exclude: [violet]
}

EMIT binary "sovereign_save_key.bin" {
  include: all
  exclude: [hypo, violet]
}
```

### TOKEN 7: REVIEW — THE GREEN TOKEN

Declares code that was working but is now under active reconsideration.
This is the seventh token, added in June 2026. It fills the GREEN band.

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

Example:

```
REVIEW viteConfig {
  certainty: 530nm
  reason: "Fails on Netlify without PORT env var — was working in Replit"
  since: "2026-06-03"
  body: {
    const rawPort = process.env.PORT;
    const port = rawPort ? Number(rawPort) : 5173;
  }
}
```

GREEN is epistemically distinct from all other bands:
- It is not untested (that would be Blue/HYPO)
- It is not broken (that would be Indigo/HYPO)
- It is not speculative (that would be Blue/Indigo/HYPO)
- It was previously trusted and is now being questioned

The REVIEW token is the only token whose certainty can increase.
It resolves upward into FUNC (certainty rises above 566nm) or
downward into HYPO (certainty falls below 495nm) based on findings.

REVIEW blocks run in production. They are flagged for active attention.
They are never auto-demoted. Only the human author changes their state.

---

## HOW CERTAINTY MAPS TO THE GRADIENT

The certainty score in every token drives the rendered color. This is deterministic —
no human assigns colors manually. Certainty is expressed in nanometers.

```
certainty: > 780nm      → WHITE      (axiomatic — ASSERT only)
certainty: 700-780nm    → DEEP RED   (proven/empirical — FUNC)
certainty: 627-700nm    → RED        (confirmed — FUNC)
certainty: 589-627nm    → ORANGE     (reliable — FUNC)
certainty: 566-589nm    → YELLOW     (functional — FUNC)
certainty: 495-566nm    → GREEN      (questioning — REVIEW)
certainty: 436-495nm    → BLUE       (experimental — HYPO)
certainty: 380-436nm    → INDIGO     (speculative — HYPO)
certainty: < 380nm      → BLACK      (void — nothing)
```

The parser reads the score. The IDE renders the color. The translation engine uses
the score to decide what ships to production and what gets wrapped in feature flags.

The color is never assigned manually. It is always computed from certainty.

---

## THE FOUR SACRED GRAMMAR RULES

These rules apply to the grammar itself. They are never violated.

### GRAMMAR RULE 1: CERTAINTY IS IMMUTABLE AT WHITE

Any token with certainty > 780nm cannot have its certainty reduced by any automated
process. Only the human author can change it. A tool that automatically reduces
certainty on a >780nm node has violated the grammar.

### GRAMMAR RULE 2: ASSERTS ARE ALWAYS > 780nm

An ASSERT block with certainty below 780nm is a grammar error. The parser rejects it.

### GRAMMAR RULE 3: HYPOS NEVER EXCEED 495nm

A HYPO block with certainty above 495nm is a grammar error. Hypotheses cannot
self-promote to working theory. Only the human author upgrades a HYPO to a FUNC
or REVIEW.

### GRAMMAR RULE 4: THE GRADIENT NEVER EXECUTES

No token's color value is ever passed to the execution environment. The translation
engine strips all certainty metadata before outputting to TypeScript, Python, or
binary. If any certainty value appears in an output file, the translation engine
has a bug.

---

## WHAT THE PARSER WILL DO

When the RCMT parser is built, it will:

1. Read an .rcmt file character by character
2. Identify the seven token types by their keywords
3. Validate certainty scores against grammar rules
4. Build the RCMT AST (Abstract Syntax Tree)
5. Pass the AST to the translation engine

The parser will be written in TypeScript — industry ready, no exotic tools.
It will live in /rcmt-core/parser/ — RED folder, sacred.

---

## WHAT THE .rcmt FILE IS NOT

To prevent drift:

- It is NOT a visual image file
- It is NOT color pixel data
- It is NOT a Piet program (DRIFT PATTERN 9 — REJECT)
- It is NOT JSON with color fields
- It is NOT YAML
- It is NOT a configuration file
- It is NOT TypeScript with comments
- It is its own grammar, its own tokens, its own file type

The gradient annotates. Standard code executes. They never merge.

---

## WHAT HAPPENS IF THE GRAMMAR IS WRONG

If the grammar design has flaws, Track 1 is completely unaffected.

The fallback procedure:
1. Delete /rcmt-dev-view/ folder
2. Delete any .rcmt files
3. Track 1 continues exactly as designed
4. The grammar is redesigned from this document
5. A new attempt begins

The grammar failing does not break RCMT. RCMT exists independently of its grammar.

---

## LESSON 1 COMPLETE

When you are ready for Lesson 2, the topic will be:

LESSON 2: THE PARSER
How to build a program that reads .rcmt files and produces an AST.
What tools we use. How we test it. How we know it works.

Prerequisites before Lesson 2:
- Track 1 Netlify 404 fixed ✅ (pending)
- Lattice renders in browser ✅ (pending)
- Phase 2 two-browser sync confirmed ✅ (pending)

---

## SUMMARY — ONE PAGE

```
.rcmt grammar has 7 tokens:

NODE    — declares a memory node with certainty score (nm)
LINK    — declares a relationship between nodes
FUNC    — declares executable logic (566-780nm, drives gradient color)
ASSERT  — declares an invariant (always > 780nm, always WHITE)
HYPO    — declares a hypothesis (380-495nm, always BLUE/INDIGO)
EMIT    — tells translation engine what to output and where
REVIEW  — declares code under active reconsideration (495-566nm, GREEN) ←NEW

> 780nm  → WHITE  → ASSERT only — axiomatic, precedes proof
700-780nm → DEEP RED → FUNC — empirically proven
627-700nm → RED → FUNC — ships to production
566-589nm → YELLOW → FUNC — ships with documented assumptions
495-566nm → GREEN → REVIEW — runs, flagged for reconsideration
380-495nm → BLUE/INDIGO → HYPO — wrapped in feature flags, never ships alone

Grammar has 4 sacred rules:
1. WHITE certainty (>780nm) is immutable except by human author
2. ASSERTs are always >780nm or the parser rejects them
3. HYPOs never exceed 495nm or the parser rejects them
4. The gradient NEVER executes — stripped before output

If the grammar fails → delete rcmt-dev-view → Track 1 continues untouched.
```

---

RCMT-LESSON-001 — Classification: VIOLET | Status: Hypothesis
The grammar is the wall. The parser enforces it. The certainty scores drive the color.
Standard code executes. The gradient annotates. They never merge.
