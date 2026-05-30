/**
 * RCMT Calibration Seam — the single "behind-the-seam" home for the tuned and
 * curated values the engine reads but does not derive.
 *
 * ─── Why this module exists ──────────────────────────────────────────────
 * RCMT is licensed, not open-sourced. The engine (deterministic geometry, the
 * 28-byte CRVM wire format, LWW arbitration, per-tier FIFO, the BVH index) is
 * lawfully rederivable and is treated as the OPEN layer. The genuinely
 * protectable assets are the *calibration*: the numbers and the curated tier
 * anchors that were arrived at by judgment and (eventually) measurement, not by
 * derivation. This module gathers those scattered values into ONE clearly
 * labeled place so the engine/secret-sauce boundary is explicit and future work
 * cannot accidentally leak calibration into the open engine.
 *
 * Full boundary doctrine + the four-bucket asset map:
 * see `docs/protection-boundary.md`.
 *
 * ─── Rules for this file ─────────────────────────────────────────────────
 * - This is SEPARATION ONLY. Centralizing a value here changes NO behavior;
 *   the literal values are identical to where they used to live. The vitest
 *   invariant suite still pins them (it imports them via the engine modules
 *   that re-export them).
 * - NO tricks. No obfuscation, no watermarks/canaries, nothing that could
 *   weaken or corrupt the substrate. Protection lives at the *boundary*
 *   (what is withheld), never inside the artifact.
 * - This module MUST stay dependency-free (pure literals + types). It is
 *   imported by both the main thread (`useSaccadeStore`) AND the ONNX web
 *   worker, so pulling in `three`/`zustand` here would bloat or break the
 *   worker bundle.
 * - Empirical constants (e.g. the future VLM acuity `s`) come from
 *   MEASUREMENT, not derivation — biology/physics give the form, a
 *   confirmation run gives the number.
 */

// ── Classifier prototype anchors ─────────────────────────────────────────
// The five seed phrases the ONNX worker embeds at warmup; incoming text is
// routed to a tier by cosine similarity to these prototypes. This curation IS
// the working definition of what each tier *means* — the highest-value
// calibration asset in the substrate. Order is load-bearing: slot 1..5.
export const CLASSIFIER_SEED_PHRASES: ReadonlyArray<string> = [
  "a verified fact that has already happened", // Slot 1: Facts / Executions
  "a comparison between expected and actual outcome", // Slot 2: Scenario vs Reality
  "a pass or fail measurement result", // Slot 3: Pass/Fail Metrics
  "a theory or plan for what should happen next", // Slot 4: Theories / Plans
  "a dream or speculative inspiration", // Slot 5: Dreams / Inspirations
];

// ── Foveation / density factor ───────────────────────────────────────────
// Radial foveation coefficient: radius = sqrt(absoluteIndex) * BUBBLE. Tunes
// how tightly the lattice packs (constant-area annuli). Pinned by the geometry
// invariant test via the engine's re-export.
export const NODE_DENSITY_BUBBLE = 0.6;

// ── Per-tier decay tuning ────────────────────────────────────────────────
// Decay rate λ for Health(t) = exp(-λ · Δt_seconds), one per tier (1..5).
// Facts barely decay; Dreams hyper-decay. The gradient itself is calibration.
export const TIER_LAMBDA: ReadonlyArray<number> = [
  0.005, // Fact — barely decays
  0.015, // Scenario
  0.03, // Metric
  0.06, // Theory
  0.12, // Dream — hyper-decay
];

// ── Reinforcement / promotion / health tuning ────────────────────────────
/** Cosine-similarity threshold for treating an input as reinforcement. */
export const REINFORCE_SIM_THRESHOLD = 0.92;
/** Strikes required before promotion fires (slots 4 & 5 only). */
export const REINFORCE_PROMOTE_COUNT = 3;
/** Health below this value → node evaporates. */
export const HEALTH_DEATH = 0.05;
/**
 * Health below this value (but still above HEALTH_DEATH) → an *unreinforced*
 * node drifts one tier OUTWARD toward the Dream rim instead of staying central.
 * The mirror of inward promotion: low-confidence memories sort themselves to
 * the periphery before they evaporate, so the foveal core stays dense.
 */
export const HEALTH_DEMOTE = 0.3;
/** Per-reinforcement scale bump. */
export const MASS_REINFORCE_INCR = 0.15;
/** Max scale a single slot can grow to via reinforcement. */
export const MASS_REINFORCE_CAP = 3.0;

// ── Empirical (measured, not derived) — reserved home ────────────────────
/**
 * VLM spatial acuity `s` — the no-zoom budget is M = (R / s)² cells. This is an
 * EMPIRICAL constant: it comes from a confirmation/benchmark run, never from
 * derivation. Null until measured (see the benchmark methodology under
 * `docs/internal/`). Lives here so the protectable benchmark output has a home
 * the day it is measured, rather than being scattered back into the engine.
 */
export const VLM_ACUITY_S: number | null = null;
