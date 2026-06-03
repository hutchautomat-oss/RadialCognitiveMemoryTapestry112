import { describe, expect, it } from "vitest";
import {
  animationLerp,
  buildDiagnosticShaderGraph,
  colorLookupFn,
  computeHealthDecay,
  computeVignetteAlpha,
  cubicEase,
  healthDecayFn,
  R_MAX,
  sampleCIELABLUT,
  vignetteFn,
} from "./rcmtShaderGraph";
import { generateCIELABLUT, tierToSRGB } from "./cielab";

describe("RCMT shader graph architecture", () => {
  it("builds a valid diagnostic shader graph with the expected node set", () => {
    const graph = buildDiagnosticShaderGraph();
    expect(graph.root).toBe("colorLookup");
    expect(graph.nodes.map((node) => node.name)).toEqual([
      "healthDecay",
      "vignetteAlpha",
      "colorLookup",
      "animationLerp",
    ]);
    expect(graph.nodes.find((node) => node.name === "healthDecay")?.output).toBe("float");
    expect(graph.nodes.find((node) => node.name === "vignetteAlpha")?.output).toBe("float");
    expect(graph.nodes.find((node) => node.name === "colorLookup")?.output).toBe("vec3");
    expect(graph.nodes.find((node) => node.name === "animationLerp")?.output).toBe("vec3");
  });

  it("defines health decay as exp(-lambda * deltaT)", () => {
    expect(healthDecayFn.source).toContain("exp(-lambda * deltaT)");
    expect(computeHealthDecay(1.2, 0.5)).toBeCloseTo(Math.exp(-1.2 * 0.5));
    expect(computeHealthDecay(0.6, 2.0)).toBeCloseTo(Math.exp(-1.2));
  });

  it("defines vestibular vignette alpha using 1 - tanh(vCam * r^2 / R_max^2)", () => {
    expect(vignetteFn.source).toContain("1.0 - tanh");
    expect(vignetteFn.source).toContain("r * r");
    expect(vignetteFn.source).toContain(`${R_MAX.toFixed(1)} * ${R_MAX.toFixed(1)}`);
    expect(computeVignetteAlpha(0.0, 50)).toBeCloseTo(1);
    expect(computeVignetteAlpha(1.0, 0)).toBeCloseTo(1);
    expect(computeVignetteAlpha(1.0, R_MAX)).toBeLessThan(1);
    expect(computeVignetteAlpha(2.0, R_MAX * 0.75)).toBeLessThan(1);
  });

  it("defines color lookup as a constant-time LUT texture sample", () => {
    expect(colorLookupFn.source).toContain("texture(cielabLUT");
    expect(colorLookupFn.source).toContain("round(tierCertainty * 255.0)");
    const lut = generateCIELABLUT();
    const [r, g, b] = sampleCIELABLUT(lut, 0.0);
    expect([r, g, b]).toEqual([lut[0] / 255, lut[1] / 255, lut[2] / 255]);
    const [rMid, gMid, bMid] = sampleCIELABLUT(lut, 0.5);
    expect(rMid).toBeGreaterThanOrEqual(0);
    expect(gMid).toBeGreaterThanOrEqual(0);
    expect(bMid).toBeGreaterThanOrEqual(0);
    expect(rMid).toBeLessThanOrEqual(1);
    expect(gMid).toBeLessThanOrEqual(1);
    expect(bMid).toBeLessThanOrEqual(1);
  });

  it("defines animation lerp as cubic ease continuity", () => {
    expect(cubicEase(0)).toBe(0);
    expect(cubicEase(1)).toBe(1);
    expect(cubicEase(0.5)).toBeCloseTo(0.5, 2);
    expect(animationLerp([0, 0, 0], [10, 0, 0], 0.5)[0]).toBeCloseTo(5, 1);
    expect(animationLerp([0, 0, 0], [0, 10, 0], 0.25)[1]).toBeGreaterThan(0);
  });
});
