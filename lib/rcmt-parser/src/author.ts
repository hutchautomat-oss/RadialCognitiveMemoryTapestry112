/**
 * @workspace/rcmt-parser/author
 *
 * The reverse direction of the parser: given a human-authored
 * `{ nodeIndex, intentId, phrase }`, compute the lattice position via the
 * same `latticePosition()` / `sphericalFibonacci()` math the live store uses,
 * derive a visual scale from the phrase length, and emit a valid 28-byte
 * CRVM record (or a concatenated `.rcmt` file of many).
 *
 * The author places. The geometry reads.
 *
 * Geometry mirrored from `artifacts/rcmt/src/store/useSaccadeStore.ts`
 * (`GOLDEN_ANGLE`, `sphericalFibonacci`, `latticePosition`,
 * `NODE_DENSITY_BUBBLE` from `artifacts/rcmt/src/lib/calibration.ts`,
 * `MIN_SCALE` / `SCALE_PER_CHAR` / `MAX_SCALE`). Any drift in those source
 * constants must be mirrored here and in `index.ts`'s tier-geometry block.
 *
 * See: docs/rcmt-language-spec-001.md
 */

import {
  MAX_NODES,
  STRIDE_BYTES,
  TIER_STARTS,
  TIER_CAPS,
  type TierIndex,
} from "./index.js";

// ── Geometry constants (must match useSaccadeStore.ts) ──────────────────────
export const GOLDEN_ANGLE = 137.508 * (Math.PI / 180);
export const NODE_DENSITY_BUBBLE = 0.6;

// ── Scale constants (must match useSaccadeStore.ts) ─────────────────────────
export const MIN_SCALE = 0.15;
export const SCALE_PER_CHAR = 0.02;
export const MAX_SCALE = 1.5;

// ── Types ────────────────────────────────────────────────────────────────────

export interface AuthorInput {
  /** Absolute slot index — fixes both tier and lattice position. */
  nodeIndex: number;
  /** 0=unknown, 1=Fact..5=Dream. Defaults to the tier implied by nodeIndex. */
  intentId?: number;
  /** Source phrase. Used to derive `scale` when `scale` is not given. */
  phrase?: string;
  /** Visual weight override (0 = vacant). Defaults to `scaleFromPhrase(phrase)` or MIN_SCALE. */
  scale?: number;
  /** LWW timestamp (ms since epoch). Defaults to `Date.now()`. */
  lwwStamp?: number;
}

// ── Geometry helpers ─────────────────────────────────────────────────────────

function sphericalFibonacci(i: number, total: number): [number, number, number] {
  const phi = Math.acos(1 - (2 * (i + 0.5)) / Math.max(total, 1));
  const theta = i * GOLDEN_ANGLE;
  const sinPhi = Math.sin(phi);
  return [sinPhi * Math.cos(theta), sinPhi * Math.sin(theta), Math.cos(phi)];
}

/** Foveated lattice position for an absolute slot index. */
export function latticePosition(absoluteIndex: number): [number, number, number] {
  const radius = Math.sqrt(absoluteIndex) * NODE_DENSITY_BUBBLE;
  const [sx, sy, sz] = sphericalFibonacci(absoluteIndex, MAX_NODES);
  return [sx * radius, sy * radius, sz * radius];
}

/** Visual scale derived from source-phrase length, clamped to [MIN_SCALE, MAX_SCALE]. */
export function scaleFromPhrase(phrase: string): number {
  return Math.min(MIN_SCALE + phrase.length * SCALE_PER_CHAR, MAX_SCALE);
}

function tierFromIndex(nodeIndex: number): TierIndex {
  for (let t = 0; t < TIER_STARTS.length; t++) {
    const start = TIER_STARTS[t];
    const end = start + TIER_CAPS[t];
    if (nodeIndex >= start && nodeIndex < end) return t as TierIndex;
  }
  return 4; // fallback to Dream (outermost)
}

// ── Encoders ─────────────────────────────────────────────────────────────────

/** Encode a single 28-byte CRVM record (little-endian). */
export function encodeRecord(input: AuthorInput): Uint8Array {
  const { nodeIndex, phrase, scale, lwwStamp } = input;

  if (!Number.isInteger(nodeIndex) || nodeIndex < 0 || nodeIndex >= MAX_NODES) {
    throw new RangeError(`nodeIndex ${nodeIndex} out of range [0, ${MAX_NODES})`);
  }

  const intentId = input.intentId ?? tierFromIndex(nodeIndex) + 1;
  const resolvedScale =
    scale ?? (phrase !== undefined ? scaleFromPhrase(phrase) : MIN_SCALE);
  const resolvedStamp = lwwStamp ?? Date.now();

  const [x, y, z] = latticePosition(nodeIndex);

  const buf = new ArrayBuffer(STRIDE_BYTES);
  const view = new DataView(buf);
  view.setUint16(0, nodeIndex, true);
  view.setUint16(2, intentId, true);
  view.setFloat32(4, x, true);
  view.setFloat32(8, y, true);
  view.setFloat32(12, z, true);
  view.setFloat32(16, resolvedScale, true);
  view.setFloat64(20, resolvedStamp, true);
  return new Uint8Array(buf);
}

/** Encode many records into a single `.rcmt` binary (concatenated 28-byte records). */
export function encodeRcmtFile(inputs: AuthorInput[]): Uint8Array {
  const seen = new Set<number>();
  for (const input of inputs) {
    if (seen.has(input.nodeIndex)) {
      throw new RangeError(
        `duplicate nodeIndex ${input.nodeIndex} — each slot may appear once per .rcmt file`,
      );
    }
    seen.add(input.nodeIndex);
  }

  const out = new Uint8Array(inputs.length * STRIDE_BYTES);
  inputs.forEach((input, i) => out.set(encodeRecord(input), i * STRIDE_BYTES));
  return out;
}
