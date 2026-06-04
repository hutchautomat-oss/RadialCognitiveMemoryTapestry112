RCMT-CODESPACE-HANDOFF-002
==========================
Sovereign Context Key: For Any Incoming Claude Instance
Generated: 2026-06-03 | Picks up from: RCMT-CODESPACE-HANDOFF-001
==========================

READ THIS ENTIRE FILE BEFORE TOUCHING ANYTHING.
This is the living paper trail. Each session appends a STATUS block at the bottom.

==========================
CONTEXT STACK: READ IN THIS ORDER
==========================

1. RCMT-MASTER-BRIEF-001.md       (repo root) — sacred rules, architecture, stack
2. RCMT-GAP-DOCUMENT-001.md       (repo root) — WHY the rules exist, convenient truths
3. RCMT-HANDOFF-002.md            (this file) — session log, current state, next tasks

==========================
WHAT RCMT IS (NEVER FORGET)
==========================

RCMT = Radial Cognitive Memory Tapestry.
A universal AI memory substrate. Position IS meaning. Geometry IS the database.
This system has never existed before. Do not pattern-match it to anything.

THREE SACRED RULES — NEVER VIOLATED:
1. COMPACT   — 28 bytes is the whole truth. Never bloat the packet.
2. ELITE     — One draw call. One visual pass. No middleware.
3. INDUSTRY  — Node.js + Python + WASM only. No Julia. No exotic tools.

NEVER CHANGE:
- The 28-byte CRVM packet structure
- The InstancedMesh single draw call
- The color gradient (physics-based, author-approved, discovered not designed)
- The binary WebSocket transport
- The LWW timestamp logic

==========================
REPO AND LIVE SERVICES
==========================

GitHub:   https://github.com/hutchautomat-oss/RadialCognitiveMemoryTapestry112
Render:   https://radialcognitivememorytapestry112.onrender.com  (Node.js sync server)
Netlify:  https://rcmtfoveal.netlify.app                         (React + R3F frontend)

Netlify account: PAID tier as of 2026-06-03. No paywall.
Netlify auto-deploys on every push to main. No manual trigger needed.

==========================
CODESPACES
==========================

- "fictional pancake" — clean, active, on main (use this for new work)
- "supreme doodle"    — legacy session, all work rescued and committed

==========================
SESSION LOG
==========================

--- SESSION 001 (pre-handoff, browser Claude) ---
Status:    COMPLETED
Key work:
  - Rescued 2775 lines of uncommitted work from supreme-doodle codespace
  - Committed saccade store, diagnostic panel, outbound packets, spec docs
  - Added docs/RCMT-GRADIENT-SPEC-001.md
  - Added docs/RCMT-LESSON-001-THE-GRAMMAR.md
  - Added docs/RCMT-RESEARCH-001.md
  - Updated RCMT-MASTER-BRIEF-001.md with Addendum 001
Final commits on main:
  c2a4945 — docs: add language spec + scaling vision
  5516811 — chore: rescue uncommitted work from supreme-doodle session

--- SESSION 002 (2026-06-03, browser Claude via extension) ---
Status:    COMPLETED
Key work:
  - Verified vite.config.ts PORT/BASE_PATH already fixed (commit a078a82)
    const port = rawPort ? Number(rawPort) : 5173   OK
    const basePath = process.env.BASE_PATH ?? "/"   OK
  - Verified _redirects exists with correct content OK
  - Verified netlify.toml publish = "artifacts/rcmt/dist/public" OK
  - Confirmed rcmtfoveal.netlify.app IS LIVE. 3D lattice renders.
    ENGINE: READY, draws 4, tris 896.1k, fov 70 degrees, ONNX classifier READY
    Event stream firing: axioms, facts, LOW_CONF signals streaming live
    Session restore working: 1356+ slots restored on load
  - Committed RCMT-GAP-DOCUMENT-001.md (the 20% Claude does not know)
  - Committed RCMT-HANDOFF-002.md (this file)
Final commits this session:
  (see git log for hashes) — docs: add RCMT-GAP-DOCUMENT-001
  (see git log for hashes) — docs: add RCMT-HANDOFF-002

==========================
CURRENT SYSTEM STATE (as of 2026-06-03)
==========================

PHASE 2 PROOF-OF-LIFE CHECKLIST:
  [x] rcmtfoveal.netlify.app loads without 404
  [x] 3D InstancedMesh lattice renders in browser
  [x] Foveal gradient visible (red core -> terra band -> cool outer -> dark rim)
  [x] ONNX classifier READY
  [x] Event stream live (axioms, facts, LOW_CONF signals)
  [x] Session restore working (1356+ slots restored on load)
  [ ] Two browser tabs sync via Render WebSocket (not yet verified this session)
  [ ] CRVM packet Tab A -> Tab B update latency < 100ms (not yet verified)
  [ ] Hamiltonian velocity layer (optional, Phase 3)

Render sync server: presumed LIVE (free tier may spin down — wait 30s if timeout)
Netlify frontend:   CONFIRMED LIVE AND RENDERING

==========================
KNOWN ISSUES AND NEXT TASKS
==========================

PRIORITY 1 — VERIFY LIVE MULTI-TAB SYNC
  Open two tabs to rcmtfoveal.netlify.app
  Both should show LINK status connecting to Render WS server
  Inject a phrase in Tab A — verify node moves in Tab B
  Target latency: under 100ms
  If LINK shows LOCAL (not connected to server), check VITE_WS_URL env var
  in Netlify dashboard -> Site configuration -> Environment variables
  Should be: wss://radialcognitivememorytapestry112.onrender.com

PRIORITY 2 — WRAPPER PRODUCT (new insight, do not lose)
  The author identified a second product: an AI wrapper that feeds any AI
  instance a sovereign context stack automatically. This IS an RCMT application.
  RCMT managing its own development context is the first product demo.
  Document this in the product roadmap when Phase 2 is confirmed complete.
  See RCMT-GAP-DOCUMENT-001.md section: THE WRAPPER PRODUCT INSIGHT.

PRIORITY 3 — PHASE 3 PLANNING
  Once multi-tab sync confirmed, Phase 2 is complete.
  Phase 3 = homomorphic encryption layer (Python + TenSEAL)
  Read: docs/rcmt-scaling-vision.md for roadmap
  Python for TenSEAL only. Node.js stays as sync server.

PRIORITY 4 — DOCS AUDIT
  docs/ folder has grown organically. Consider docs/INDEX.md.

==========================
HOW TO EXTEND THIS HANDOFF
==========================

When your session ends, append a new block to the SESSION LOG above:

  --- SESSION 00N (YYYY-MM-DD, description) ---
  Status:    COMPLETED / IN PROGRESS / BLOCKED
  Key work:
    - bullet list of what you did
  Final commits on main:
    <hash> — <message>
  Left off at:
    <what the next session should do first>

Then commit this file:
  git add RCMT-HANDOFF-002.md
  git commit -m "docs: update RCMT-HANDOFF-002 — session 00N complete"
  git push origin main

==========================
WHAT YOU MUST NOT DO
==========================

DO NOT add a database (PostgreSQL, MongoDB, Redis, etc.)
DO NOT convert WebSocket binary to REST or JSON
DO NOT combine api-server and rcmt into one service
DO NOT use Python for the sync server
DO NOT add Julia, Haskell, Erlang, or any non-standard language
DO NOT modify the 28-byte packet structure
DO NOT modify the InstancedMesh single draw call
DO NOT deploy the mockup-sandbox folder anywhere
DO NOT treat the color gradient as a design choice (it was discovered, not designed)

==========================
QUICK ORIENTATION LINKS
==========================

Master brief:       https://github.com/hutchautomat-oss/RadialCognitiveMemoryTapestry112/blob/main/RCMT-MASTER-BRIEF-001.md
Gap document:       https://github.com/hutchautomat-oss/RadialCognitiveMemoryTapestry112/blob/main/RCMT-GAP-DOCUMENT-001.md
This handoff:       https://github.com/hutchautomat-oss/RadialCognitiveMemoryTapestry112/blob/main/RCMT-HANDOFF-002.md
Commits log:        https://github.com/hutchautomat-oss/RadialCognitiveMemoryTapestry112/commits/main
Docs folder:        https://github.com/hutchautomat-oss/RadialCognitiveMemoryTapestry112/tree/main/docs
Live frontend:      https://rcmtfoveal.netlify.app
Live sync server:   https://radialcognitivememorytapestry112.onrender.com

==========================
RCMT-HANDOFF-002-END
Three sacred rules. Seven grammar tokens. 28 bytes. One draw call.
The geometry is the knowledge. The color was discovered, not designed.
Pass the key forward.
==========================
