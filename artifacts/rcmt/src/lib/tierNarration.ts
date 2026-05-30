/**
 * tierNarration — single source of plain-language descriptions for the five
 * ontology tiers. Shared by the console `/why`, the hover tooltip, the event
 * stream, and the epistemic-balance card so the substrate narrates itself the
 * same way everywhere.
 *
 * Pure data + helpers — no React, no store import — so any layer (store, lib,
 * component) can import it without creating a dependency cycle.
 *
 * Tiers are 1-based on the public surface (1=Fact … 5=Dream); index with
 * `tier - 1`.
 */

/** Uppercase tier labels (mirror of the HUD's TIER_NAMES, kept here so the
 *  store/lib layers can narrate without importing component tokens). */
export const TIER_LABEL = ["FACT", "SCENARIO", "METRIC", "THEORY", "DREAM"] as const;

/** One short clause describing what each tier *means*, in plain English. */
export const TIER_PLAIN = [
  "irreducible fact — highest confidence",
  "an observed scenario — situation vs. reality",
  "a measured metric — a pass/fail result",
  "a theory or plan — proposed, not yet grounded",
  "a speculative dream — lowest confidence",
] as const;

/** The radial band each tier occupies, dense core → sparse rim. This is the
 *  foveal gradient made legible: Facts sit densest at the core, Dreams thin
 *  out at the rim. */
export const TIER_BAND = [
  "dense foveated core",
  "inner shell",
  "mid shell",
  "outer shell",
  "sparse rim",
] as const;

function clampTierIdx(tier: number): number {
  return Math.max(0, Math.min(4, (tier | 0) - 1));
}

export function tierLabel(tier: number): string {
  return TIER_LABEL[clampTierIdx(tier)];
}

export function tierPlain(tier: number): string {
  return TIER_PLAIN[clampTierIdx(tier)];
}

export function tierBand(tier: number): string {
  return TIER_BAND[clampTierIdx(tier)];
}
