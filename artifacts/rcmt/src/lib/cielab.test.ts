import { describe, expect, it } from "vitest";
import { generateCIELABLUT, tierToCIELAB, tierToSRGB } from "./cielab";

function hueFromLab({ a, b }: { a: number; b: number }): number {
  const degrees = (Math.atan2(b, a) * 180) / Math.PI;
  return degrees < 0 ? degrees + 360 : degrees;
}

describe("CIELAB tier mapping", () => {
  it("maps Facts to dark Amber values", () => {
    const lab = tierToCIELAB(1);
    expect(lab.L).toBeCloseTo(30, 1);
    expect(hueFromLab(lab)).toBeCloseTo(60, 1);
    expect(lab.a).toBeGreaterThan(0);
    expect(lab.b).toBeGreaterThan(0);
  });

  it("maps Metrics to mid Cyan values", () => {
    const lab = tierToCIELAB(3);
    expect(lab.L).toBeCloseTo(60, 1);
    expect(hueFromLab(lab)).toBeCloseTo(180, 1);
    expect(lab.a).toBeLessThan(0);
    expect(lab.b).toBeCloseTo(0, 1);
  });

  it("maps Dreams to light Violet values", () => {
    const lab = tierToCIELAB(5);
    expect(lab.L).toBeCloseTo(90, 1);
    expect(hueFromLab(lab)).toBeCloseTo(270, 1);
    expect(lab.a).toBeLessThan(0);
    expect(lab.b).toBeLessThan(0);
  });

  it("generates a 256-entry LUT with exactly 768 bytes", () => {
    const lut = generateCIELABLUT();
    expect(lut).toHaveLength(768);
    for (let i = 0; i < lut.length; i++) {
      expect(lut[i]).toBeGreaterThanOrEqual(0);
      expect(lut[i]).toBeLessThanOrEqual(255);
    }
  });

  it("produces a monotonic tier ramp for luminance, hue, and saturation", () => {
    const checkpoints = [1, 2, 3, 4, 5].map((q4) => {
      const lab = tierToCIELAB(q4);
      const hue = hueFromLab(lab);
      const saturation = Math.sqrt(lab.a ** 2 + lab.b ** 2);
      return { q4, L: lab.L, hue, saturation };
    });

    for (let i = 1; i < checkpoints.length; i++) {
      expect(checkpoints[i].L).toBeGreaterThan(checkpoints[i - 1].L);
      expect(checkpoints[i].hue).toBeGreaterThan(checkpoints[i - 1].hue);
      expect(checkpoints[i].saturation).toBeLessThan(checkpoints[i - 1].saturation);
    }
  });

  it("returns valid sRGB values for a tier-to-RGB conversion", () => {
    const [r, g, b] = tierToSRGB(1);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(1);
    expect(r + g + b).toBeGreaterThan(0.1);
  });
});
