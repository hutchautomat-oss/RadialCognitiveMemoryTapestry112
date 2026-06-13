/**
 * @workspace/rcmt-parser/author invariant tests.
 *
 * Pins: lattice-position math (must match useSaccadeStore.ts
 * `sphericalFibonacci` / `latticePosition`), scale-from-phrase clamping,
 * default intentId derivation from nodeIndex tier, 28-byte encode layout,
 * multi-record file concatenation, and the encode -> parse round trip.
 */

import { describe, it, expect } from "vitest";
import {
  GOLDEN_ANGLE,
  NODE_DENSITY_BUBBLE,
  MIN_SCALE,
  SCALE_PER_CHAR,
  MAX_SCALE,
  latticePosition,
  scaleFromPhrase,
  encodeRecord,
  encodeRcmtFile,
} from "./author.js";
import { parse, STRIDE_BYTES, MAX_NODES } from "./index.js";

describe("constants", () => {
  it("GOLDEN_ANGLE is 137.508 degrees in radians", () => {
    expect(GOLDEN_ANGLE).toBeCloseTo(137.508 * (Math.PI / 180), 12);
  });

  it("NODE_DENSITY_BUBBLE matches the lattice foveation factor", () => {
    expect(NODE_DENSITY_BUBBLE).toBe(0.6);
  });
});

describe("latticePosition", () => {
  it("places nodeIndex 0 at the exact center (radius 0)", () => {
    const [x, y, z] = latticePosition(0);
    expect(x).toBe(0);
    expect(y).toBe(0);
    expect(z).toBe(0);
  });

  it("radius grows as sqrt(nodeIndex) * NODE_DENSITY_BUBBLE", () => {
    const [x, y, z] = latticePosition(100);
    const radius = Math.sqrt(x * x + y * y + z * z);
    expect(radius).toBeCloseTo(Math.sqrt(100) * NODE_DENSITY_BUBBLE, 5);
  });

  it("the outermost slot (MAX_NODES - 1) sits near the rim", () => {
    const [x, y, z] = latticePosition(MAX_NODES - 1);
    const radius = Math.sqrt(x * x + y * y + z * z);
    expect(radius).toBeCloseTo(Math.sqrt(MAX_NODES - 1) * NODE_DENSITY_BUBBLE, 4);
  });

  it("is deterministic — same index always yields the same position", () => {
    expect(latticePosition(4242)).toEqual(latticePosition(4242));
  });
});

describe("scaleFromPhrase", () => {
  it("clamps short phrases to MIN_SCALE", () => {
    expect(scaleFromPhrase("")).toBeCloseTo(MIN_SCALE, 6);
  });

  it("grows linearly with phrase length", () => {
    const phrase = "a".repeat(10);
    expect(scaleFromPhrase(phrase)).toBeCloseTo(MIN_SCALE + 10 * SCALE_PER_CHAR, 6);
  });

  it("clamps long phrases to MAX_SCALE", () => {
    const phrase = "a".repeat(1000);
    expect(scaleFromPhrase(phrase)).toBe(MAX_SCALE);
  });
});

describe("encodeRecord", () => {
  it("produces exactly STRIDE_BYTES (28) bytes", () => {
    const rec = encodeRecord({ nodeIndex: 0, intentId: 1, phrase: "hello" });
    expect(rec.byteLength).toBe(STRIDE_BYTES);
  });

  it("rejects out-of-range nodeIndex", () => {
    expect(() => encodeRecord({ nodeIndex: -1 })).toThrow(RangeError);
    expect(() => encodeRecord({ nodeIndex: MAX_NODES })).toThrow(RangeError);
    expect(() => encodeRecord({ nodeIndex: 1.5 })).toThrow(RangeError);
  });

  it("defaults intentId to the tier implied by nodeIndex", () => {
    const fact = encodeRecord({ nodeIndex: 0, phrase: "x" });
    const view = new DataView(fact.buffer, fact.byteOffset, fact.byteLength);
    expect(view.getUint16(2, true)).toBe(1); // Fact

    const dream = encodeRecord({ nodeIndex: 7999, phrase: "x" });
    const dreamView = new DataView(dream.buffer, dream.byteOffset, dream.byteLength);
    expect(dreamView.getUint16(2, true)).toBe(5); // Dream
  });

  it("defaults lwwStamp to roughly now", () => {
    const before = Date.now();
    const rec = encodeRecord({ nodeIndex: 0, phrase: "x" });
    const after = Date.now();
    const view = new DataView(rec.buffer, rec.byteOffset, rec.byteLength);
    const stamp = view.getFloat64(20, true);
    expect(stamp).toBeGreaterThanOrEqual(before);
    expect(stamp).toBeLessThanOrEqual(after);
  });
});

describe("encodeRcmtFile round trip", () => {
  it("encodes multiple records and decodes them back via parse()", () => {
    const inputs = [
      { nodeIndex: 0, phrase: "first fact", lwwStamp: 1000 },
      { nodeIndex: 2000, phrase: "first scenario", lwwStamp: 2000 },
      { nodeIndex: 7999, phrase: "a fading dream", lwwStamp: 3000 },
    ];
    const bytes = encodeRcmtFile(inputs);
    expect(bytes.byteLength).toBe(inputs.length * STRIDE_BYTES);

    const result = parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    if (!("recordCount" in result)) throw new Error(result.message);

    expect(result.recordCount).toBe(3);
    expect(result.records[0].nodeIndex).toBe(0);
    expect(result.records[0].tierLabel).toBe("Fact");
    expect(result.records[0].lwwStamp).toBe(1000);

    expect(result.records[1].nodeIndex).toBe(2000);
    expect(result.records[1].tierLabel).toBe("Scenario");

    expect(result.records[2].nodeIndex).toBe(7999);
    expect(result.records[2].tierLabel).toBe("Dream");

    const expectedPos = latticePosition(2000);
    expect(result.records[1].x).toBeCloseTo(expectedPos[0], 4);
    expect(result.records[1].y).toBeCloseTo(expectedPos[1], 4);
    expect(result.records[1].z).toBeCloseTo(expectedPos[2], 4);
  });

  it("rejects duplicate nodeIndex within the same file", () => {
    const inputs = [
      { nodeIndex: 5, phrase: "a" },
      { nodeIndex: 5, phrase: "b" },
    ];
    expect(() => encodeRcmtFile(inputs)).toThrow(/duplicate nodeIndex/);
  });

  it("an empty input list yields an empty buffer", () => {
    expect(encodeRcmtFile([]).byteLength).toBe(0);
  });
});
