export type ShaderValueType = "float" | "vec2" | "vec3" | "vec4" | "sampler2D";

export interface ShaderFnNode {
  name: string;
  inputs: Record<string, ShaderValueType>;
  output: ShaderValueType;
  source: string;
  dependencies: string[];
}

export function createShaderFnNode(
  name: string,
  inputs: Record<string, ShaderValueType>,
  output: ShaderValueType,
  source: string,
  dependencies: string[] = [],
): ShaderFnNode {
  return { name, inputs, output, source, dependencies };
}

export const R_MAX = 89.4;

export const healthDecayFn = createShaderFnNode(
  "healthDecay",
  { lambda: "float", deltaT: "float" },
  "float",
  `
    // Computes exponential health decay for a node.
    // Corresponds to exp(-lambda * deltaT) with deltaT in seconds.
    return exp(-lambda * deltaT);
  `,
);

export const vignetteFn = createShaderFnNode(
  "vignetteAlpha",
  { vCam: "float", r: "float" },
  "float",
  `
    // Vestibular-safe peripheral opacity fade.
    float normalizedRadius = (r * r) / (${R_MAX.toFixed(1)} * ${R_MAX.toFixed(1)});
    return 1.0 - tanh(vCam * normalizedRadius);
  `,
);

export const colorLookupFn = createShaderFnNode(
  "colorLookup",
  { tierCertainty: "float", cielabLUT: "sampler2D" },
  "vec3",
  `
    // O(1) LUT sampling of the CIELAB texture for perceptual tier color.
    float index = clamp(round(tierCertainty * 255.0), 0.0, 255.0);
    float u = (index + 0.5) / 256.0;
    return texture(cielabLUT, vec2(u, 0.5)).rgb;
  `,
  ["healthDecay"],
);

export const animationLerpFn = createShaderFnNode(
  "animationLerp",
  { t: "float", fromPos: "vec3", toPos: "vec3" },
  "vec3",
  `
    // Cubic smoothstep interpolation for smooth foveal transitions.
    float eased = t * t * (3.0 - 2.0 * t);
    return mix(fromPos, toPos, eased);
  `,
);

export interface ShaderGraph {
  nodes: ShaderFnNode[];
  root: string;
}

export function buildDiagnosticShaderGraph(): ShaderGraph {
  return {
    nodes: [healthDecayFn, vignetteFn, colorLookupFn, animationLerpFn],
    root: "colorLookup",
  };
}

export function glslType(type: ShaderValueType): string {
  switch (type) {
    case "float":
      return "float";
    case "vec2":
      return "vec2";
    case "vec3":
      return "vec3";
    case "vec4":
      return "vec4";
    case "sampler2D":
      return "sampler2D";
  }
}

export function wgslType(type: ShaderValueType): string {
  switch (type) {
    case "float":
      return "f32";
    case "vec2":
      return "vec2<f32>";
    case "vec3":
      return "vec3<f32>";
    case "vec4":
      return "vec4<f32>";
    case "sampler2D":
      return "texture_2d<f32>";
  }
}

export function compileFunctionToGLSL(node: ShaderFnNode): string {
  const args = Object.entries(node.inputs)
    .map(([name, type]) => `${glslType(type)} ${name}`)
    .join(", ");
  return `
${glslType(node.output)} ${node.name}(${args}) {
  ${node.source.trim()}
}
`;
}

export function compileFunctionToWGSL(node: ShaderFnNode): string {
  const args = Object.entries(node.inputs)
    .map(([name, type]) => `${name}: ${wgslType(type)}`)
    .join(", ");
  const body = node.source
    .replace(/texture\(([^,]+),\s*vec2\(([^,]+),\s*([^\)]+)\)\)\.rgb/g,
      "textureSample($1, defaultSampler, vec2<f32>($2, $3)).rgb")
    .replace(/float\(/g, "f32(")
    .replace(/vec2\(/g, "vec2<f32>(")
    .replace(/vec3\(/g, "vec3<f32>(")
    .replace(/vec4\(/g, "vec4<f32>(");

  return `
fn ${node.name}(${args}) -> ${wgslType(node.output)} {
  ${body.trim()}
}
`;
}

export function compileGraphToGLSL(graph: ShaderGraph): string {
  return graph.nodes.map(compileFunctionToGLSL).join("\n\n");
}

export function compileGraphToWGSL(graph: ShaderGraph): string {
  const header = `
let defaultSampler: sampler;
`;
  return header + graph.nodes.map(compileFunctionToWGSL).join("\n\n");
}

export function computeHealthDecay(lambda: number, deltaT: number): number {
  return Math.exp(-lambda * deltaT);
}

export function computeVignetteAlpha(vCam: number, r: number, rMax = R_MAX): number {
  const normalizedRadius = (r * r) / (rMax * rMax);
  return 1 - Math.tanh(vCam * normalizedRadius);
}

export function cubicEase(t: number): number {
  const clamped = Math.min(1, Math.max(0, t));
  return clamped * clamped * (3 - 2 * clamped);
}

export function animationLerp(fromPos: [number, number, number], toPos: [number, number, number], t: number): [number, number, number] {
  const eased = cubicEase(t);
  return [
    fromPos[0] + (toPos[0] - fromPos[0]) * eased,
    fromPos[1] + (toPos[1] - fromPos[1]) * eased,
    fromPos[2] + (toPos[2] - fromPos[2]) * eased,
  ];
}

export function sampleCIELABLUT(lut: Uint8Array, tierCertainty: number): [number, number, number] {
  const safe = Math.min(1, Math.max(0, tierCertainty));
  const index = Math.round(safe * 255);
  const base = index * 3;
  return [lut[base] / 255, lut[base + 1] / 255, lut[base + 2] / 255];
}
