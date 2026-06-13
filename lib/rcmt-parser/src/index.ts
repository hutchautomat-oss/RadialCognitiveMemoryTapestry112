/**
 * @workspace/rcmt-parser
 *
 * Decodes a .rcmt binary file (sequence of 28-byte CRVM records) into a
 * structured representation, then emits it in multiple target formats.
 *
 * The author places. The geometry reads.
 *
 * Binary layout per record (28 bytes, little-endian):
 *   Bytes  0-1:  nodeIndex  Uint16LE  — absolute slot index (0..7999)
 *   Bytes  2-3:  intentId   Uint16LE  — 0=unknown, 1=Fact..5=Dream
 *   Bytes  4-7:  x          Float32LE
 *   Bytes  8-11: y          Float32LE
 *   Bytes 12-15: z          Float32LE
 *   Bytes 16-19: scale      Float32LE — visual weight (0 = vacant)
 *   Bytes 20-27: lwwStamp   Float64LE — ms since epoch (LWW timestamp)
 *
 * Derived fields (computed, never authored):
 *   tier        — 1..5 (Fact/Scenario/Metric/Theory/Dream) from slot index
 *   tierLabel   — human name
 *   certainty   — 0.0..1.0 (1 = absolute fact, 0 = speculative dream)
 *   color       — [r, g, b] 0..1, render-side tier palette (TIER_RGB)
 *   radius      — sqrt(nodeIndex) * 0.6 (lattice radial distance)
 *
 * See: docs/rcmt-language-spec-001.md
 */

// ── Wire constants (must match api-server/src/lib/lww.ts) ──────────────────
export const STRIDE_BYTES = 28;
export const MAX_NODES = 8000;

// ── Tier geometry (must match useSaccadeStore.ts TIER_CAPS / TIER_STARTS) ──
export const TIER_CAPS   = [2000, 2000, 1500, 1500, 1000] as const;
export const TIER_STARTS = [0, 2000, 4000, 5500, 7000]    as const;
export const TIER_LABELS = ["Fact", "Scenario", "Metric", "Theory", "Dream"] as const;

// Render-side tier palette — single source of truth for node color, mirrored
// from useSaccadeStore.ts TIER_RGB. Color opponency + certainty-by-saturation:
// hues spread across opponent channels for pre-attentive separation; saturation
// ramps down Fact -> Dream (sharp cyan-green at max certainty, faded violet at
// the speculative rim).
export const TIER_RGB: [number, number, number][] = [
  [0.15, 0.95, 0.89], // Fact     — sharp cyan-green, max saturation
  [0.37, 0.90, 0.20], // Scenario — vivid green
  [0.87, 0.80, 0.29], // Metric   — yellow
  [0.83, 0.53, 0.31], // Theory   — orange
  [0.73, 0.46, 0.78], // Dream    — faded violet, low saturation
];

export const ANGULAR_RELATION_THRESHOLD = 0.25; // radians — within ~14°

// Radial foveation factor — radius = sqrt(nodeIndex) * NODE_DENSITY_BUBBLE.
// Must match useSaccadeStore.ts / calibration.ts NODE_DENSITY_BUBBLE.
export const NODE_DENSITY_BUBBLE = 0.6;

// ── Types ──────────────────────────────────────────────────────────────────

export type TierIndex = 0 | 1 | 2 | 3 | 4;

export interface CRVMRecord {
  // Raw wire fields
  nodeIndex:  number;
  intentId:   number;
  x:          number;
  y:          number;
  z:          number;
  scale:      number;
  lwwStamp:   number;
  // Derived fields
  tier:       number;         // 1-based (1=Fact, 5=Dream)
  tierLabel:  string;
  certainty:  number;         // 0.0..1.0
  color:      [number, number, number]; // RGB 0..1
  radius:     number;         // radial distance in lattice units
}

export interface ParseResult {
  recordCount:  number;
  vacantCount:  number;
  records:      CRVMRecord[];
  tierHistogram: Record<string, number>;
}

export interface ParseError {
  ok: false;
  message: string;
}

// ── Geometry helpers ───────────────────────────────────────────────────────

function tierFromIndex(nodeIndex: number): TierIndex {
  for (let t = 0; t < TIER_STARTS.length; t++) {
    const start = TIER_STARTS[t];
    const end   = start + TIER_CAPS[t];
    if (nodeIndex >= start && nodeIndex < end) return t as TierIndex;
  }
  return 4; // fallback to Dream (outermost)
}

/** Outermost radial distance reachable by any slot in the lattice. */
export const MAX_RADIUS = Math.sqrt(MAX_NODES - 1) * NODE_DENSITY_BUBBLE;

function certaintyFromIndex(nodeIndex: number): number {
  // certainty = 1 - (radius / max_radius)
  // radius = sqrt(nodeIndex) * NODE_DENSITY_BUBBLE  (the lattice formula)
  const radius = Math.sqrt(nodeIndex) * NODE_DENSITY_BUBBLE;
  return Math.max(0, Math.min(1, 1 - radius / MAX_RADIUS));
}

function angularDistance(a: CRVMRecord, b: CRVMRecord): number {
  // Great-circle angle between two unit-sphere positions (dot product → acos)
  const dot = a.x * b.x + a.y * b.y + a.z * b.z;
  return Math.acos(Math.max(-1, Math.min(1, dot)));
}

// ── Core parser ────────────────────────────────────────────────────────────

export function parse(buf: ArrayBuffer): ParseResult | ParseError {
  if (buf.byteLength === 0) {
    return { ok: false, message: "empty buffer" };
  }
  if (buf.byteLength % STRIDE_BYTES !== 0) {
    return {
      ok: false,
      message: `buffer length ${buf.byteLength} is not a multiple of ${STRIDE_BYTES} — not a valid .rcmt file`,
    };
  }

  const view = new DataView(buf);
  const total = buf.byteLength / STRIDE_BYTES;
  const records: CRVMRecord[] = [];
  let vacantCount = 0;

  for (let i = 0; i < total; i++) {
    const off = i * STRIDE_BYTES;
    const nodeIndex = view.getUint16(off,      true);
    const intentId  = view.getUint16(off + 2,  true);
    const x         = view.getFloat32(off + 4,  true);
    const y         = view.getFloat32(off + 8,  true);
    const z         = view.getFloat32(off + 12, true);
    const scale     = view.getFloat32(off + 16, true);
    const lwwStamp  = view.getFloat64(off + 20, true);

    if (scale <= 0) { vacantCount++; continue; }

    const tierIdx   = tierFromIndex(nodeIndex);
    const radius    = Math.sqrt(nodeIndex) * NODE_DENSITY_BUBBLE;
    const certainty = certaintyFromIndex(nodeIndex);

    records.push({
      nodeIndex,
      intentId,
      x, y, z,
      scale,
      lwwStamp,
      tier:      tierIdx + 1,
      tierLabel: TIER_LABELS[tierIdx],
      certainty,
      color:     TIER_RGB[tierIdx],
      radius,
    });
  }

  const tierHistogram: Record<string, number> = {};
  for (const label of TIER_LABELS) tierHistogram[label] = 0;
  for (const r of records) tierHistogram[r.tierLabel]++;

  return { recordCount: records.length, vacantCount, records, tierHistogram };
}

// ── Relationship finder ────────────────────────────────────────────────────

export interface Relation {
  a: number; // nodeIndex
  b: number; // nodeIndex
  angle: number; // radians
}

export function findRelations(
  records: CRVMRecord[],
  threshold = ANGULAR_RELATION_THRESHOLD,
): Relation[] {
  const relations: Relation[] = [];
  for (let i = 0; i < records.length; i++) {
    for (let j = i + 1; j < records.length; j++) {
      const angle = angularDistance(records[i], records[j]);
      if (angle <= threshold) {
        relations.push({ a: records[i].nodeIndex, b: records[j].nodeIndex, angle });
      }
    }
  }
  return relations;
}

// ── Output emitters ────────────────────────────────────────────────────────

export function toJSON(result: ParseResult, includeRelations = false): string {
  const out: Record<string, unknown> = {
    recordCount:   result.recordCount,
    vacantCount:   result.vacantCount,
    tierHistogram: result.tierHistogram,
    records:       result.records,
  };
  if (includeRelations) {
    out.relations = findRelations(result.records);
  }
  return JSON.stringify(out, null, 2);
}

export function toTypeScript(result: ParseResult): string {
  const lines: string[] = [
    `// Auto-generated by @workspace/rcmt-parser — do not edit`,
    `// Source: .rcmt binary (${result.recordCount} occupied slots)`,
    ``,
    `export interface RCMTSlot {`,
    `  nodeIndex: number; intentId: number;`,
    `  x: number; y: number; z: number; scale: number; lwwStamp: number;`,
    `  tier: number; tierLabel: string; certainty: number;`,
    `  color: [number, number, number]; radius: number;`,
    `}`,
    ``,
    `export const RCMT_TIER_HISTOGRAM = ${JSON.stringify(result.tierHistogram)} as const;`,
    ``,
    `export const RCMT_SLOTS: RCMTSlot[] = [`,
    ...result.records.map((r) =>
      `  ${JSON.stringify(r)},`
    ),
    `];`,
  ];
  return lines.join("\n");
}

export function toPython(result: ParseResult): string {
  const lines: string[] = [
    `# Auto-generated by rcmt-parser — do not edit`,
    `# Source: .rcmt binary (${result.recordCount} occupied slots)`,
    ``,
    `RCMT_TIER_HISTOGRAM = ${JSON.stringify(result.tierHistogram)}`,
    ``,
    `RCMT_SLOTS = [`,
    ...result.records.map((r) =>
      `    ${JSON.stringify(r)},`
    ),
    `]`,
  ];
  return lines.join("\n");
}

export function toSummary(result: ParseResult): string {
  const lines = [
    `RCMT parse summary`,
    `  occupied slots : ${result.recordCount}`,
    `  vacant slots   : ${result.vacantCount}`,
    `  tier breakdown :`,
    ...Object.entries(result.tierHistogram).map(
      ([label, count]) => `    ${label.padEnd(10)} ${count}`
    ),
  ];
  return lines.join("\n");
}

/**
 * Re-encode occupied records back into a raw 28-byte-per-record CRVM stream
 * (the same byte layout `parse()` reads). Vacant slots are not re-emitted —
 * round-tripping `parse()` -> `toBinary()` drops them, matching the
 * "nothing else" rule for `.rcmt` files (a sequence of CRVM records, only
 * occupied ones carry information).
 */
export function toBinary(result: ParseResult): Uint8Array {
  const out = new Uint8Array(result.records.length * STRIDE_BYTES);
  const view = new DataView(out.buffer);
  result.records.forEach((r, i) => {
    const off = i * STRIDE_BYTES;
    view.setUint16(off,      r.nodeIndex, true);
    view.setUint16(off + 2,  r.intentId,  true);
    view.setFloat32(off + 4, r.x,         true);
    view.setFloat32(off + 8, r.y,         true);
    view.setFloat32(off + 12, r.z,        true);
    view.setFloat32(off + 16, r.scale,    true);
    view.setFloat64(off + 20, r.lwwStamp, true);
  });
  return out;
}

// ── Visual output (SVG) ─────────────────────────────────────────────────────

// Visual radius (SVG units) per unit of `scale`. Purely a presentation
// choice for this 2D projection — does not need to match the 3D renderer's
// VISUAL_RADIUS_MULT, which scales a sphere mesh, not an SVG circle.
const SVG_RADIUS_PER_SCALE = 0.5;
// Largest possible node circle radius (MAX_SCALE=1.5 * SVG_RADIUS_PER_SCALE),
// used as canvas margin so rim nodes are never clipped.
const MAX_SCALE_RADIUS = 1.5 * SVG_RADIUS_PER_SCALE;

/**
 * Render a top-down (XY) orthographic projection of the lattice as an SVG
 * document — one circle per occupied slot, positioned at (x, y), sized by
 * `scale`, and colored by the slot's TIER_RGB. Fact slots cluster near the
 * center (high certainty); Dream slots disperse toward the rim (low
 * certainty), reproducing the foveal gradient for VLM visual ingestion.
 *
 * This is a vector (SVG) output by design — no raster/canvas dependency is
 * introduced. Rasterizing to PNG, if needed, is a downstream step using
 * standard external tooling.
 */
export function toSVG(result: ParseResult): string {
  const margin = MAX_SCALE_RADIUS;
  const size = 2 * (MAX_RADIUS + margin);
  const center = MAX_RADIUS + margin;

  const circles = result.records.map((r) => {
    const cx = (r.x + center).toFixed(3);
    const cy = (r.y + center).toFixed(3);
    const radius = Math.max(0.05, r.scale * SVG_RADIUS_PER_SCALE).toFixed(3);
    const [cr, cg, cb] = r.color;
    const fill = `rgb(${Math.round(cr * 255)},${Math.round(cg * 255)},${Math.round(cb * 255)})`;
    return `<circle cx="${cx}" cy="${cy}" r="${radius}" fill="${fill}"><title>#${r.nodeIndex} ${r.tierLabel}</title></circle>`;
  });

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size.toFixed(3)} ${size.toFixed(3)}">`,
    `<rect width="100%" height="100%" fill="#0a0a12"/>`,
    ...circles,
    `</svg>`,
  ].join("\n");
}
