/**
 * @workspace/rcmt-parser invariant tests.
 *
 * Pins: binary layout decoding, tier geometry, certainty formula,
 * relation detection, and all output emitters. Every test encodes a
 * deliberate architectural constraint from docs/rcmt-language-spec-001.md.
 */

import { describe, it, expect } from "vitest";
import {
  parse,
  findRelations,
  toJSON,
  toTypeScript,
  toPython,
  toSummary,
  STRIDE_BYTES,
  MAX_NODES,
  TIER_STARTS,
  TIER_CAPS,
  TIER_LABELS,
  TIER_RGB,
  ANGULAR_RELATION_THRESHOLD,
  type ParseResult,
  type CRVMRecord,
} from "./index";

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRecord(opts: {
  nodeIndex: number;
  intentId?: number;
  x?: number;
  y?: number;
  z?: number;
  scale?: number;
  lwwStamp?: number;
}): ArrayBuffer {
  const buf = new ArrayBuffer(STRIDE_BYTES);
  const v = new DataView(buf);
  v.setUint16(0,     opts.nodeIndex,       true);
  v.setUint16(2,     opts.intentId ?? 1,   true);
  v.setFloat32(4,    opts.x ?? 0,          true);
  v.setFloat32(8,    opts.y ?? 0,          true);
  v.setFloat32(12,   opts.z ?? 1,          true);
  v.setFloat32(16,   opts.scale ?? 1.0,    true);
  v.setFloat64(20,   opts.lwwStamp ?? 1e9, true);
  return buf;
}

function concat(...bufs: ArrayBuffer[]): ArrayBuffer {
  const total = bufs.reduce((s, b) => s + b.byteLength, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const b of bufs) { out.set(new Uint8Array(b), off); off += b.byteLength; }
  return out.buffer;
}

function parseOne(opts: Parameters<typeof makeRecord>[0]): CRVMRecord {
  const result = parse(makeRecord(opts));
  if (!("records" in result)) throw new Error(`parse failed: ${(result as {message:string}).message}`);
  return result.records[0];
}

// ── Wire-format ────────────────────────────────────────────────────────────

describe("wire-format", () => {
  it("STRIDE_BYTES is exactly 28", () => {
    expect(STRIDE_BYTES).toBe(28);
  });

  it("rejects an empty buffer", () => {
    const r = parse(new ArrayBuffer(0));
    expect("ok" in r && r.ok === false).toBe(true);
    expect((r as {message:string}).message).toContain("empty");
  });

  it("rejects a buffer not aligned to 28 bytes", () => {
    const r = parse(new ArrayBuffer(30));
    expect("ok" in r && r.ok === false).toBe(true);
    expect((r as {message:string}).message).toContain("multiple");
  });

  it("decodes nodeIndex (u16LE offset 0)", () => {
    const rec = parseOne({ nodeIndex: 0, scale: 1 });
    expect(rec.nodeIndex).toBe(0);

    const rec2 = parseOne({ nodeIndex: 6800, scale: 1 });
    expect(rec2.nodeIndex).toBe(6800);
  });

  it("decodes intentId (u16LE offset 2)", () => {
    const rec = parseOne({ nodeIndex: 0, intentId: 3, scale: 1 });
    expect(rec.intentId).toBe(3);
  });

  it("decodes x/y/z (f32LE offsets 4/8/12) within Float32 precision", () => {
    const rec = parseOne({ nodeIndex: 0, x: 0.5, y: -0.7, z: 0.3, scale: 1 });
    expect(rec.x).toBeCloseTo(0.5, 5);
    expect(rec.y).toBeCloseTo(-0.7, 5);
    expect(rec.z).toBeCloseTo(0.3, 5);
  });

  it("decodes scale (f32LE offset 16)", () => {
    const rec = parseOne({ nodeIndex: 0, scale: 2.5 });
    expect(rec.scale).toBeCloseTo(2.5, 5);
  });

  it("decodes lwwStamp (f64LE offset 20) at full double precision", () => {
    const stamp = 1_700_000_000_123.456;
    const rec = parseOne({ nodeIndex: 0, lwwStamp: stamp, scale: 1 });
    expect(rec.lwwStamp).toBeCloseTo(stamp, 3);
  });

  it("skips vacant records (scale <= 0) and increments vacantCount", () => {
    const occupied = makeRecord({ nodeIndex: 0, scale: 1.0 });
    const vacant   = makeRecord({ nodeIndex: 1, scale: 0.0 });
    const result = parse(concat(occupied, vacant)) as ParseResult;
    expect(result.recordCount).toBe(1);
    expect(result.vacantCount).toBe(1);
    expect(result.records[0].nodeIndex).toBe(0);
  });

  it("negative scale is also treated as vacant", () => {
    const r = parse(makeRecord({ nodeIndex: 0, scale: -0.001 })) as ParseResult;
    expect(r.recordCount).toBe(0);
    expect(r.vacantCount).toBe(1);
  });
});

// ── Tier geometry ──────────────────────────────────────────────────────────

describe("tier geometry", () => {
  const cases: [number, string][] = [
    [0,    "Fact"],
    [1999, "Fact"],
    [2000, "Scenario"],
    [3999, "Scenario"],
    [4000, "Metric"],
    [5499, "Metric"],
    [5500, "Theory"],
    [6999, "Theory"],
    [7000, "Dream"],
    [7999, "Dream"],
  ];

  for (const [nodeIndex, expected] of cases) {
    it(`nodeIndex ${nodeIndex} → tier "${expected}"`, () => {
      const rec = parseOne({ nodeIndex, scale: 1 });
      expect(rec.tierLabel).toBe(expected);
      expect(rec.tier).toBe(TIER_LABELS.indexOf(expected as typeof TIER_LABELS[number]) + 1);
    });
  }

  it("TIER_STARTS + TIER_CAPS covers exactly MAX_NODES slots without gap or overlap", () => {
    let covered = 0;
    for (let t = 0; t < TIER_STARTS.length; t++) {
      covered += TIER_CAPS[t];
    }
    expect(covered).toBe(MAX_NODES);
  });
});

// ── Derived fields ─────────────────────────────────────────────────────────

describe("derived fields", () => {
  it("radius = sqrt(nodeIndex) * 0.6", () => {
    const idx = 100;
    const rec = parseOne({ nodeIndex: idx, scale: 1 });
    expect(rec.radius).toBeCloseTo(Math.sqrt(idx) * 0.6, 5);
  });

  it("nodeIndex 0 has certainty ≈ 1 (innermost Fact slot)", () => {
    const rec = parseOne({ nodeIndex: 0, scale: 1 });
    expect(rec.certainty).toBeCloseTo(1, 4);
  });

  it("certainty decreases monotonically from Fact toward Dream", () => {
    const innerRec = parseOne({ nodeIndex: 0,    scale: 1 });
    const outerRec = parseOne({ nodeIndex: 7999, scale: 1 });
    expect(outerRec.certainty).toBeLessThan(innerRec.certainty);
  });

  it("certainty is clamped to [0, 1]", () => {
    for (const idx of [0, 3999, 7999]) {
      const rec = parseOne({ nodeIndex: idx, scale: 1 });
      expect(rec.certainty).toBeGreaterThanOrEqual(0);
      expect(rec.certainty).toBeLessThanOrEqual(1);
    }
  });

  it("color is the physics-based TIER_RGB entry for the slot's tier", () => {
    const rec = parseOne({ nodeIndex: 0, scale: 1 }); // Fact → index 0
    expect(rec.color).toEqual(TIER_RGB[0]);
  });
});

// ── Histogram ──────────────────────────────────────────────────────────────

describe("tier histogram", () => {
  it("all five tier labels are present with zero counts on empty parse", () => {
    // Single vacant record produces a properly initialised histogram
    const r = parse(makeRecord({ nodeIndex: 0, scale: 0 })) as ParseResult;
    for (const label of TIER_LABELS) {
      expect(r.tierHistogram[label]).toBe(0);
    }
  });

  it("histogram correctly tallies mixed tier records", () => {
    const factSlot     = makeRecord({ nodeIndex: 0,    scale: 1 }); // Fact
    const scenarioSlot = makeRecord({ nodeIndex: 2000, scale: 1 }); // Scenario
    const factSlot2    = makeRecord({ nodeIndex: 1,    scale: 1 }); // Fact
    const r = parse(concat(factSlot, scenarioSlot, factSlot2)) as ParseResult;
    expect(r.tierHistogram["Fact"]).toBe(2);
    expect(r.tierHistogram["Scenario"]).toBe(1);
    expect(r.tierHistogram["Metric"]).toBe(0);
  });
});

// ── findRelations ──────────────────────────────────────────────────────────

describe("findRelations", () => {
  it("ANGULAR_RELATION_THRESHOLD is ~14° (0.25 rad)", () => {
    expect(ANGULAR_RELATION_THRESHOLD).toBeCloseTo(0.25, 2);
  });

  it("two records at the same position (angle ≈ 0) are related", () => {
    const a: CRVMRecord = {
      nodeIndex: 0, intentId: 1, x: 0, y: 0, z: 1, scale: 1, lwwStamp: 1e9,
      tier: 1, tierLabel: "Fact", certainty: 1, color: TIER_RGB[0], radius: 0,
    };
    const b: CRVMRecord = { ...a, nodeIndex: 1 };
    const rels = findRelations([a, b]);
    expect(rels).toHaveLength(1);
    expect(rels[0].angle).toBeCloseTo(0, 4);
  });

  it("two orthogonal records (angle = π/2) are not related", () => {
    const a: CRVMRecord = {
      nodeIndex: 0, intentId: 1, x: 1, y: 0, z: 0, scale: 1, lwwStamp: 1e9,
      tier: 1, tierLabel: "Fact", certainty: 1, color: TIER_RGB[0], radius: 0,
    };
    const b: CRVMRecord = {
      nodeIndex: 1, intentId: 1, x: 0, y: 1, z: 0, scale: 1, lwwStamp: 1e9,
      tier: 1, tierLabel: "Fact", certainty: 1, color: TIER_RGB[0], radius: 0,
    };
    const rels = findRelations([a, b]);
    expect(rels).toHaveLength(0);
  });

  it("returns all pairs within the threshold when many records provided", () => {
    // All pointing in the same direction — every pair should be related
    const make = (idx: number): CRVMRecord => ({
      nodeIndex: idx, intentId: 1, x: 0, y: 0, z: 1, scale: 1, lwwStamp: 1e9,
      tier: 1, tierLabel: "Fact", certainty: 1, color: TIER_RGB[0], radius: 0,
    });
    const records = [make(0), make(1), make(2)];
    const rels = findRelations(records);
    // 3 choose 2 = 3 pairs
    expect(rels).toHaveLength(3);
  });

  it("custom threshold is honoured", () => {
    const a: CRVMRecord = {
      nodeIndex: 0, intentId: 1, x: 0, y: 0, z: 1, scale: 1, lwwStamp: 1e9,
      tier: 1, tierLabel: "Fact", certainty: 1, color: TIER_RGB[0], radius: 0,
    };
    // Slightly different angle — 1° apart (0.0175 rad)
    const angle = 0.0175;
    const b: CRVMRecord = {
      ...a, nodeIndex: 1,
      x: Math.sin(angle), z: Math.cos(angle),
    };
    expect(findRelations([a, b], 0.01)).toHaveLength(0); // below custom threshold
    expect(findRelations([a, b], 0.10)).toHaveLength(1); // above custom threshold
  });
});

// ── Output emitters ────────────────────────────────────────────────────────

describe("toJSON", () => {
  it("produces valid JSON containing recordCount and tierHistogram", () => {
    const r = parse(makeRecord({ nodeIndex: 0, scale: 1 })) as ParseResult;
    const json = toJSON(r);
    const parsed = JSON.parse(json);
    expect(parsed.recordCount).toBe(1);
    expect(typeof parsed.tierHistogram).toBe("object");
    expect(parsed.records).toHaveLength(1);
  });

  it("includes relations array when includeRelations=true", () => {
    const r = parse(makeRecord({ nodeIndex: 0, scale: 1 })) as ParseResult;
    const json = JSON.parse(toJSON(r, true));
    expect(Array.isArray(json.relations)).toBe(true);
  });

  it("omits relations array by default", () => {
    const r = parse(makeRecord({ nodeIndex: 0, scale: 1 })) as ParseResult;
    const json = JSON.parse(toJSON(r));
    expect("relations" in json).toBe(false);
  });
});

describe("toTypeScript", () => {
  it("emits a valid TypeScript export block with slot data", () => {
    const r = parse(makeRecord({ nodeIndex: 0, scale: 1 })) as ParseResult;
    const ts = toTypeScript(r);
    expect(ts).toContain("export const RCMT_SLOTS");
    expect(ts).toContain("export interface RCMTSlot");
    expect(ts).toContain("RCMT_TIER_HISTOGRAM");
    // Slot 0 should appear in the output
    expect(ts).toContain('"nodeIndex":0');
  });
});

describe("toPython", () => {
  it("emits a Python assignment block with slot data", () => {
    const r = parse(makeRecord({ nodeIndex: 0, scale: 1 })) as ParseResult;
    const py = toPython(r);
    expect(py).toContain("RCMT_SLOTS = [");
    expect(py).toContain("RCMT_TIER_HISTOGRAM");
    expect(py).toContain('"nodeIndex":0');
  });
});

describe("toSummary", () => {
  it("emits a human-readable summary with correct counts", () => {
    const r = parse(concat(
      makeRecord({ nodeIndex: 0, scale: 1 }),
      makeRecord({ nodeIndex: 1, scale: 0 }),
    )) as ParseResult;
    const s = toSummary(r);
    expect(s).toContain("occupied slots : 1");
    expect(s).toContain("vacant slots   : 1");
    expect(s).toContain("Fact");
  });
});

// ── Round-trip integrity ───────────────────────────────────────────────────

describe("round-trip integrity", () => {
  it("parsing N records produces exactly N entries in result.records", () => {
    const bufs = [0, 100, 800, 2400, 4800, 6800].map(idx =>
      makeRecord({ nodeIndex: idx, scale: 1 })
    );
    const r = parse(concat(...bufs)) as ParseResult;
    expect(r.recordCount).toBe(6);
    expect(r.records).toHaveLength(6);
  });

  it("recordCount + vacantCount equals total records in buffer", () => {
    const bufs = [
      makeRecord({ nodeIndex: 0, scale: 1.0 }),
      makeRecord({ nodeIndex: 1, scale: 0.0 }),
      makeRecord({ nodeIndex: 2, scale: 0.5 }),
    ];
    const r = parse(concat(...bufs)) as ParseResult;
    expect(r.recordCount + r.vacantCount).toBe(3);
  });
});
