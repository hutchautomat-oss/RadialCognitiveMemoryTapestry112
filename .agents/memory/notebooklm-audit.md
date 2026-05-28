---
name: Auditing NotebookLM pastes
description: Pattern for vetting NotebookLM-style spec drafts before applying them.
---

NotebookLM pastes attached to RCMT requests are useful spec drafts but have shipped real bugs (per replit.md). The recurring pattern is: **the math is usually correct, but the rationale/labeling is often wrong** — constants get conflated, local-render decorations get described as cryptographic primitives, and "one-pass changes" are presented for things that are real architectural decisions.

**Why:** The user preferences in `replit.md` explicitly require auditing pastes against the codebase before applying them. Past bugs include a `vacantSlots` dedup that collapsed FIFO ordering and a `THREE.Frustum`-based lasso that can't represent a polygon. A more recent example: a paste claimed "Z-Strata separation is a pre-processing step for cloud Homomorphic Encryption" when in fact the `5.0` Z-strata constant is local-render decoration and the `10000.0` cleartext-matrix scale is the HE-reserved one — these were swapped.

**How to apply:** When a paste arrives:
1. Itemize the claims (numeric constants, math, architectural rationales) into a small table.
2. Cross-reference each against `replit.md` "Architecture decisions" and "Gotchas" and against the actual code (grep for the constants and function names mentioned).
3. Surface a verdict per claim before changing code. If the paste's rationale conflicts with `replit.md`, trust `replit.md` and either correct the paste's labeling in code comments or push back to the user.
4. Never paste a code block from `attached_assets/` verbatim.
