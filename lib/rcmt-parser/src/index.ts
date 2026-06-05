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
 *   color       — [r, g, b] 0..1, epistemic gradient (physics-based)
 *   radius      — sqrt(nodeIndex) * 0.6 (lattice radial distance)
 *
 * See: docs/rcmt-language-spec-001.md
 */

// ── Wire constants (must match api-server/src/lib/lww.ts) ──────────────────
export const STRIDE_BYTES = 28;
export const MAX_NODES = 8000;

// ── Tier geometry (must match useSaccadeStore.ts TIER_CAPS / TIER_STARTS) ──
export const TIER_CAPS   = [800, 1600, 2400, 2000, 1200] as const;
export const TIER_STARTS = [0, 800, 2400, 4800, 6800]    as const;
export const TIER_LABELS = ["Fact", "Scenario", "Metric", "Theory", "Dream"] as const;

// Epistemic color gradient — physics-based wavelength mapping, never modified.
// Red (Fact/certain) → terra/amber → cool blue → violet (Dream/speculative)
export const TIER_RGB: [number, number, number][] = [
  [0.95, 0.15, 0.10], // Fact    — red   (650 nm)
  [0.87, 0.80, 0.29], // Scenario— amber (580 nm)
  [0.15, 0.95, 0.89], // Metric  — cyan  (490 nm)
  [0.37, 0.90, 0.20], // Theory  — green (530 nm)
  [0.50, 0.00, 1.00], // Dream   — violet(400 nm)
];

export const ANGULAR_RELATION_THRESHOLD = 0.25; // radians — within ~14°

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

function certaintyFromIndex(nodeIndex: number): number {
  // certainty = 1 - (radius / max_radius)
  // radius = sqrt(nodeIndex) * 0.6  (the lattice formula)
  const MAX_RADIUS = Math.sqrt(MAX_NODES - 1) * 0.6;
  const radius = Math.sqrt(nodeIndex) * 0.6;
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
    const radius    = Math.sqrt(nodeIndex) * 0.6;
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
