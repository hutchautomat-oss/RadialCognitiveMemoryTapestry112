import { describe, expect, it } from "vitest";
import { buildDiagnosticShaderGraph, compileGraphToGLSL, compileGraphToWGSL } from "./rcmtShaderGraph";

describe("RCMT shader compilation", () => {
  it("compiles the diagnostic shader graph into valid GLSL function definitions", () => {
    const graph = buildDiagnosticShaderGraph();
    const glsl = compileGraphToGLSL(graph);

    expect(glsl).toContain("float healthDecay(");
    expect(glsl).toContain("float vignetteAlpha(");
    expect(glsl).toContain("vec3 colorLookup(");
    expect(glsl).toContain("vec3 animationLerp(");
    expect(glsl).toContain("texture(cielabLUT, vec2(u, 0.5)).rgb");
    expect(glsl).toContain("return 1.0 - tanh(vCam * normalizedRadius);");
  });

  it("compiles the diagnostic shader graph into WGSL and rewrites texture sampling semantics", () => {
    const graph = buildDiagnosticShaderGraph();
    const wgsl = compileGraphToWGSL(graph);

    expect(wgsl).toContain("let defaultSampler: sampler;");
    expect(wgsl).toContain("fn healthDecay(");
    expect(wgsl).toContain("fn vignetteAlpha(");
    expect(wgsl).toContain("fn colorLookup(");
    expect(wgsl).toContain("fn animationLerp(");
    expect(wgsl).toContain("textureSample(cielabLUT, defaultSampler, vec2<f32>(u, 0.5)).rgb");
    expect(wgsl).toContain("return 1.0 - tanh(vCam * normalizedRadius);");
  });
});
