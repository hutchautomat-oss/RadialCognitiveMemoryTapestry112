import { describe, expect, it } from "vitest";
import { BufferGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, ShaderMaterial } from "three";
import {
  buildDiagnosticShaderGraph,
  compileGraphToGLSL,
  compileGraphToWGSL,
  computeVignetteAlpha,
  sampleCIELABLUT,
} from "./rcmtShaderGraph";
import { generateCIELABLUT } from "./cielab";

function makeMasterBuffer(instanceCount: number) {
  const floatCount = instanceCount * 7;
  const buffer = new Float32Array(floatCount);
  for (let i = 0; i < floatCount; i += 7) {
    buffer[i + 0] = Math.random();
    buffer[i + 1] = Math.random();
    buffer[i + 2] = Math.random();
    buffer[i + 3] = Math.random();
    buffer[i + 4] = Math.random();
    buffer[i + 5] = Math.random();
    buffer[i + 6] = Math.random();
  }
  return buffer;
}

describe("RCMT shader runtime validation", () => {
  it("allocates an instanced mesh with a 224KB master buffer layout", () => {
    const instanceCount = 8000;
    const masterBuffer = makeMasterBuffer(instanceCount);

    expect(masterBuffer.byteLength).toBe(224000);
    expect(masterBuffer.length).toBe(instanceCount * 7);

    const geometry = new BufferGeometry();
    const instanceMatrices = new Float32Array(instanceCount * 16);
    for (let i = 0; i < instanceCount; i += 1) {
      const matrix = new Matrix4();
      matrix.setPosition((i % 10) * 0.1, Math.floor(i / 10) * 0.1, 0);
      matrix.toArray(instanceMatrices, i * 16);
    }

    geometry.setAttribute("instanceMatrix", new InstancedBufferAttribute(instanceMatrices, 16));
    const material = new ShaderMaterial({
      vertexShader: "void main() { gl_Position = vec4(0.0); }",
      fragmentShader: "void main() { gl_FragColor = vec4(1.0); }",
    });
    const mesh = new InstancedMesh(geometry, material, instanceCount);

    expect(mesh.count).toBe(instanceCount);
    expect(mesh.geometry.getAttribute("instanceMatrix").array).toBe(instanceMatrices);
    expect(mesh.instanceMatrix).toBeDefined();
  });

  it("validates shader graph output semantics for GLSL and WGSL runtime targets", () => {
    const graph = buildDiagnosticShaderGraph();
    const glsl = compileGraphToGLSL(graph);
    const wgsl = compileGraphToWGSL(graph);

    expect(glsl).toContain("texture(cielabLUT, vec2(u, 0.5)).rgb");
    expect(wgsl).toContain("textureSample(cielabLUT, defaultSampler, vec2<f32>(u, 0.5)).rgb");

    const lut = generateCIELABLUT();
    const [r, g, b] = sampleCIELABLUT(lut, 0.42);
    expect(r).toBeGreaterThanOrEqual(0);
    expect(g).toBeGreaterThanOrEqual(0);
    expect(b).toBeGreaterThanOrEqual(0);
    expect(r).toBeLessThanOrEqual(1);
    expect(g).toBeLessThanOrEqual(1);
    expect(b).toBeLessThanOrEqual(1);

    const alpha = computeVignetteAlpha(1.5, 67);
    expect(alpha).toBeGreaterThanOrEqual(0);
    expect(alpha).toBeLessThanOrEqual(1);
  });
});
