# Roadmap: Sovereign Session Wrapper

## The insight

Every session-start protocol, every handoff document, every gap document in this
repo is a symptom of broken AI memory. RCMT is the cure. The first product demo
is RCMT curing its own development process.

An AI wrapper that:
- Takes any AI instance (Claude, GPT, Gemini, local model)
- Loads a sovereign RCMT context stack at session start automatically
- Maintains epistemic continuity — the next instance knows what the last decided
- Routes tasks to the right instance based on what it knows vs. what it doesn't
- Tracks per-session knowledge deltas so drift is visible, not silent

This is not a side project. It is the first real-world application of RCMT as a
memory substrate — applied to AI session management itself.

## The problem it solves

| Symptom | Today | With wrapper |
|---|---|---|
| New session, no context | Paste a handoff doc, re-explain everything | RCMT file loads — geometry is the context |
| Drift between sessions | Sacred rules forgotten, re-litigated | Fact-tier axioms at foveal core — never evicted |
| Two instances contradict each other | No reconciliation mechanism | LWW arbitration — later timestamp wins |
| "What did we decide about X?" | Search chat history | `/find X` — semantic saccade, read-only retrieval |

## Market

Every enterprise team using AI has this problem. Different team members. Different
sessions. No continuity. Decisions re-litigated. AI drift because no session knows
what the last one decided.

The wrapper solves it for any team, any AI, using RCMT as substrate. The pricing
model is consistent with the broader RCMT licensing model: open spec,
licensed optimized runtime.

## Proposed architecture

```
User / Team
    │
    ▼
Sovereign Session Wrapper
    ├── Boot: load sovereign_save_key.bin → hydrate RCMT lattice
    ├── Inject: session-start key phrases into Fact tier (forced)
    ├── Route: classify incoming task → find best-matching prior instance context
    ├── Delta: on session end, write new decisions back to the .bin
    └── Sync: 28-byte LWW packets → peer instances stay converged
    │
    ▼
Any AI instance (Claude, GPT, local)
```

The wrapper speaks the existing 28-byte CRVM protocol. It requires no changes to
the RCMT core invariants.

## Acceptance criteria

- A new Claude instance receives the RCMT sovereign context and can continue work
  without a handoff document.
- Per-session knowledge deltas are captured and written back to the .bin on close.
- Two parallel instances (e.g. one on architecture, one on code) converge their
  shared context via LWW without manual merging.
- The wrapper itself is not monolithic — it is a thin coordinator, not a new
  sync server.

## Dependency

Requires **[`sovereign_save_key.bin` persistence](./sovereign-save-key.md)** to be
shipped first. The wrapper has no value without a portable binary to load and save.

## Classification

`VIOLET / SPECULATIVE` — the insight is locked in. The spec is written.
The implementation waits on Track 1 (sovereign save key) being production-stable.
