# RCMT MASTER MISSION BRIEF

## Complete Onboarding Document For Any Claude Instance

**Version 001 | Classification: Sacred**

---

## CRITICAL FIRST READ

You are about to work on RCMT — the Radial Cognitive Memory Tapestry. This system has never existed before. You will not find it in your training data. You will not find analogues that map cleanly onto it. Do not pattern-match it to anything you already know.

Before writing a single line of code, read this entire document. Every section is load-bearing.

---

## WHAT RCMT IS

RCMT is a universal memory substrate — a geometric architecture that replaces how artificial intelligence stores, retrieves, and reasons about knowledge.

Traditional AI feeds models sequential strings of text, triggering an O(N2) quadratic attention penalty. This causes hardware degradation, temporal confusion, and "Middle Loss" — models forgetting information buried inside long documents.

RCMT eliminates context rot structurally by bypassing text retrieval entirely.

Instead of searching, it addresses. Instead of reading, it sees. Instead of retrieving, it renders.

Memory meaning is encoded as a fixed position on a Spherical Fibonacci Lattice derived deterministically from a slot index. A Vision-Language Model ingests the complete geometric landscape simultaneously in one visual pass via native convolutional layers.

---

## WHAT RCMT IS NOT

Read this section carefully. Every item listed here is a drift pattern that has already corrupted previous AI-assisted builds. If you find yourself thinking about any of these, stop and re-read this document.

- NOT a visualization library
- NOT a game engine
- NOT a physics simulator
- NOT a scientific computing project
- NOT a monolithic application
- NOT a Python project at its core
- NOT a REST API system
- NOT a traditional database
- NOT a 3D UI framework

---

## THE THREE SACRED RULES

These rules are NEVER violated. Every architectural decision is measured against them. If a proposed solution violates any of these, reject it regardless of how elegant it seems.

**RULE 1: COMPACT**

28 bytes is the whole truth. Bloat breaks zero-copy. The CRVM packet structure is frozen and immutable.

**RULE 2: ELITE**

One draw call. One visual pass. No middleware. No abstraction layers that add overhead.

**RULE 3: INDUSTRY READY**

Node.js + Python + WASM. Every DevOps team already knows this stack. No exotic languages. No academic runtimes. No Julia. No Rust unless compiled to WASM. No Haskell. No Erlang.

---

## THE 28-BYTE CRVM PACKET - SACRED AND IMMUTABLE

This is the atomic unit of RCMT. It is never changed, never extended, never padded.

```
[ 16-bit slot index   ]
[ 16-bit intent ID    ]
[ 32-bit X coordinate ]
[ 32-bit Y coordinate ]
[ 32-bit Z coordinate ]
[ 32-bit scale        ]
[ 64-bit LWW timestamp]
= 28 bytes unpadded
```

Transmitted as raw ArrayBuffer over persistent Binary WebSockets. Never as JSON. Never as text. Never as REST.

Zero-Copy Deserialization: raw network packet blasts directly into GPU VRAM buffer (pre-allocated Float32Array) in a single CPU cycle.

---

## THE COLOR COSMOLOGY - DO NOT CHANGE

The color gradient was discovered in the RGB origin and blackbody radiation physics. It was not designed. It cannot be improved. Do not change it.

| Zone | Color | Meaning |
|---|---|---|
| Foveal Core | RED (RGB origin 255,0,0) | Irreducible fact, physical law |
| Inner Ring | BURNT ORANGE | Lived experience, muscle memory |
| Terra Band | TERRACOTTA/WARM BROWN | Cultural knowledge, personal truth |
| Mid Ring | OCHRE/GOLD | Working hypothesis, malleable idea |
| Transitional | GREEN | Questioning, reconsidering |
| Outer Ring | BLUE | Speculation, imagination |
| Rim | VIOLET/BLACK | Dreams, the unknown |

Red is at the core because RGB origin is (0,0,0) — red at maximum intensity is the densest signal. This aligns with blackbody radiation physics, astronomical color temperature, and human foveal vision biology. It is a convenient truth embedded in the math, not a design choice.

---

## THE HAMILTONIAN LAYER

Hamiltonian mechanics are NOT simulated. Their rules are borrowed as lightweight metadata.

The geometry already encodes phase space:

- Position = current epistemic state (5D coordinate)
- Momentum = rate and direction of foveal migration
- Energy conservation = total epistemic weight constant across lattice
- Trajectory = LWW timestamp delta history

Optional: 8-byte velocity vector per node makes RCMT predictive. A node drifting outward signals contradiction before crash occurs.

No Julia. No symplectic integrator. No physics simulation.

---

## THE DEPLOYMENT ARCHITECTURE - THREE SEPARATE SERVICES

This is NOT a monolith. Never consolidate these into one service.

GitHub (hutchautomat-oss/RadialCognitiveMemoryTapestry112) is the source of truth. Push to main = auto-deploy both services.

RENDER.COM hosts artifacts/api-server: Node.js sync server, Binary WebSocket, LWW timestamp arbiter.
LIVE URL: radialcognitivememorytapestry112.onrender.com

NETLIFY hosts artifacts/rcmt: React + R3F + WASM frontend, Static CDN delivery, Global edge network.
LIVE URL: rcmtfoveal.netlify.app
STATUS: 404 - NEEDS FIX

---

## THE TECHNOLOGY STACK - LOCKED

| Layer | Technology | Why |
|---|---|---|
| Sync Server | Node.js | Native binary buffers, non-blocking I/O |
| Frontend | React + React-Three-Fiber | VRAM access, Web Workers |
| 3D Rendering | InstancedMesh (ONE draw call) | Zero GC thrashing |
| Binary Transport | WebSocket ArrayBuffer | Zero-copy deserialization |
| Homomorphic Layer | Python + TenSEAL | Primary TenSEAL SDK |
| Velocity Logic | WASM | Deterministic, zero GC |
| Package Manager | pnpm workspaces | Already configured |

---

## REPOSITORY STRUCTURE

```
RadialCognitiveMemoryTapestry112/
├── artifacts/
│   ├── api-server/          <- Node.js sync server (deploys to Render)
│   │   ├── src/
│   │   ├── build.mjs
│   │   └── package.json
│   ├── rcmt/                <- React frontend (deploys to Netlify)
│   │   ├── src/
│   │   ├── public/
│   │   │   └── _redirects   <- /* /index.html 200
│   │   ├── vite.config.ts   <- ISSUE: requires PORT + BASE_PATH env vars at build time
│   │   └── package.json
│   └── mockup-sandbox/      <- IGNORE - Replit artifact, do not deploy
├── package.json             <- Workspace root
└── pnpm-workspace.yaml
```

---

## KNOWN ISSUES - FIX THESE IN ORDER

### ISSUE 1 - CRITICAL: Netlify 404

**Problem:** rcmtfoveal.netlify.app returns 404
**Cause:** The _redirects file was committed to artifacts/rcmt/public/ but may not have triggered a redeploy, OR vite.config.ts is requiring environment variables at build time that block the build
**Fix:**

1. Verify artifacts/rcmt/public/_redirects contains exactly: /* /index.html 200
2. Check vite.config.ts — remove any process.env.PORT or process.env.BASE_PATH requirements that run at build time
3. These variables should only be read at runtime, not during Vite build
4. Trigger a fresh Netlify deploy after fixing

### ISSUE 2 - IMPORTANT: vite.config.ts env var requirements

**Problem:** vite.config.ts throws errors if PORT and BASE_PATH are not set at build time
**Cause:** Replit artifact — these were set automatically in Replit's environment
**Fix:** Make PORT and BASE_PATH optional with fallback values:

```typescript
const PORT = process.env.PORT ?? '3000'
const BASE_PATH = process.env.BASE_PATH ?? '/'
```

### ISSUE 3 - CLEANUP: mockup-sandbox

**Problem:** Netlify sometimes detects mockup-sandbox instead of rcmt
**Cause:** Multiple Vite projects in workspace confuses autodetection
**Fix:** Ensure Netlify base directory is explicitly set to artifacts/rcmt

---

## ENVIRONMENT VARIABLES - COMPLETE LIST

**Render (api-server):**
- PORT → assigned automatically by Render
- NODE_VERSION → 24

**Netlify (rcmt frontend):**
- VITE_WS_URL → wss://radialcognitivememorytapestry112.onrender.com
- PORT → 3000
- BASE_PATH → /
- NODE_VERSION → 24

---

## KNOWN DRIFT PATTERNS - THESE HAVE ALREADY HAPPENED

Previous AI instances working on RCMT have drifted in these specific ways. Recognize and reject them immediately:

1. **Julia drift** — suggesting Julia for scientific computation. REJECT. Industry ready means Node.js/Python/WASM only.
2. **Monolith drift** — combining api-server and rcmt into one service. REJECT. Always three separate deployments.
3. **REST drift** — replacing WebSocket binary packets with REST endpoints. REJECT. Binary WebSocket is sacred.
4. **JSON drift** — serializing CRVM packets as JSON. REJECT. ArrayBuffer only.
5. **Python server drift** — using Python for the sync server. REJECT. Node.js only for sync.
6. **3D UI drift** — treating RCMT as a 3D interface framework. REJECT. It is a memory substrate.
7. **Database drift** — adding PostgreSQL or MongoDB. REJECT. The geometry IS the database.
8. **Over-engineering drift** — adding Hamiltonian simulation, symplectic integrators, physics engines. REJECT. Borrow the rules as metadata only.

---

## WHAT "DONE" LOOKS LIKE FOR PHASE 2 (PROOF OF LIFE)

Phase 2 is complete when:

1. rcmtfoveal.netlify.app loads without 404
2. The 3D InstancedMesh lattice renders in the browser
3. The foveal gradient is visible — red core, terra band, cool outer, dark rim
4. Two browser tabs can connect to the Render sync server simultaneously
5. A CRVM packet sent from Tab A updates a node position visible in Tab B
6. The update latency is under 100ms
7. No garbage collection pauses visible in Chrome DevTools performance tab

---

## THE VISION - CONTEXT FOR ALL DECISIONS

RCMT is the memory layer the AI industry is missing. It replaces:

- Context windows
- RAG pipelines
- Embedding databases
- Re-ranking models

For Anthropic and OpenAI the pitch is: RCMT gives AI a geometric substrate where position IS meaning, certainty IS proximity to center, and the entire knowledge state is readable in one visual pass.

The beach scenario: A sandbox Claude holds an RCMT file offline for a month. No internet. No token limit. No context rot. When you return, delta sync is 28 bytes per changed node.

Three products emerge from one geometry:

1. **RCMT Core** — AI memory substrate
2. **RCMT Dev** — Codebase diagnostic tool (color gradient = epistemic health)
3. **RCMT Cognitive** — Knowledge geometry for research

---

## INSTRUCTIONS FOR CLAUDE CODE

When using Claude Code on this repository:

```bash
# Start from repo root
# DO NOT run pnpm install at root without --filter
# Each service installs independently

# Test api-server build:
cd artifacts/api-server
pnpm install
node ./build.mjs

# Test frontend build:
cd artifacts/rcmt
pnpm install
pnpm run build
```

**DO NOT TOUCH:**
- The 28-byte packet structure in any sync-related files
- The InstancedMesh implementation
- The color gradient values
- The WebSocket binary transport layer
- The LWW timestamp logic

**SAFE TO MODIFY:**
- vite.config.ts environment variable handling
- Netlify configuration files
- README and documentation
- CSS and visual styling (within color cosmology rules)
- Test files

---

## CONTEXT KEY FOR QUICK RESTORATION

```
RCMT-KEY-001 | Phase 1 Day 1 Complete
Render: LIVE at radialcognitivememorytapestry112.onrender.com
Netlify: PUBLISHED but 404 — _redirects committed, vite.config.ts needs env var fix
Next: Fix vite.config.ts PORT/BASE_PATH -> trigger redeploy -> confirm lattice renders
```

---

*RCMT-MASTER-BRIEF-001 — The geometry is the knowledge. The color was discovered, not designed. This system was found, not invented.*
