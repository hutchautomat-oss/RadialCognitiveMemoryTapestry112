/**
 * GhostScaffold — renders all 8000 rest positions as a single-draw point cloud
 * behind the live mesh, with a FOVEAL gradient baked in: a bright, larger,
 * denser core fading to a dim, smaller, sparse rim.
 *
 * Purpose: reveal that the lattice's STRUCTURE pre-exists its content. Because
 * every slot's position is a deterministic function of its index, the full
 * 8,000-point shape exists at t=0, before any phrase lands. Surfacing it (a) makes
 * capacity visible and (b) makes the amber migration/promotion comets read as
 * travelling toward real points in a present structure, not seeking at random.
 *
 * Foveal Gradient Integrity (a project invariant): the gradient IS the encoded
 * Fact→Dream epistemology, so the scaffold varies per-point SIZE + brightness +
 * opacity by normalized radius — it never flattens to a uniform field. It does
 * NOT change node placement, count, or the lattice formula (those are read from
 * the canonical engine module).
 *
 * Render-side chrome only: geometry + per-vertex attributes are built ONCE at
 * mount from the same formula the store uses; the only per-frame work is a
 * single uniform write (uTime) for a slow, subtle breathing shimmer — no
 * per-frame allocation and no store writes. Points are not raycastable, so
 * picking is unaffected.
 */

import { useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  NormalBlending,
  ShaderMaterial,
} from "three";
// Geometry constants come from the canonical engine module (NODE_DENSITY_BUBBLE
// is re-exported from the calibration seam) so the scaffold can never drift from
// the lattice the store actually renders.
import {
  MAX_NODES,
  GOLDEN_ANGLE,
  NODE_DENSITY_BUBBLE,
} from "../store/useSaccadeStore";
import { useHudStore, type ScaffoldIntensity } from "../store/useHudStore";

// Brightness/size multiplier per user-selected intensity. `off` short-circuits
// to no render, so it never reaches the shader.
const INTENSITY_FACTOR: Record<ScaffoldIntensity, number> = {
  off: 0,
  subtle: 1.0,
  full: 1.7,
};

// Core → rim color ramp. Cool teal at the dense core (high foveal weight),
// deep desaturated teal at the sparse rim. Kept low-chroma so the scaffold
// stays secondary to the vivid, opaque live nodes.
const CORE_COLOR = new Color("#8af5e8");
const RIM_COLOR = new Color("#16323b");

// The scaffold is pure render-side chrome: it must never participate in picking
// (RCMT picks live nodes via the BVH proxy on the InstancedMesh). THREE.Points
// is raycastable by default, so we explicitly no-op its raycast.
const NO_RAYCAST = () => {};

interface ScaffoldAttrs {
  positions: Float32Array;
  colors: Float32Array;
  sizes: Float32Array;
  alphas: Float32Array;
  seeds: Float32Array;
}

function buildScaffold(): ScaffoldAttrs {
  const positions = new Float32Array(MAX_NODES * 3);
  const colors = new Float32Array(MAX_NODES * 3);
  const sizes = new Float32Array(MAX_NODES);
  const alphas = new Float32Array(MAX_NODES);
  const seeds = new Float32Array(MAX_NODES);
  const c = new Color();
  const denom = Math.sqrt(MAX_NODES);

  for (let i = 0; i < MAX_NODES; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / MAX_NODES);
    const theta = i * GOLDEN_ANGLE;
    const sinPhi = Math.sin(phi);
    const radius = Math.sqrt(i) * NODE_DENSITY_BUBBLE;
    positions[i * 3 + 0] = sinPhi * Math.cos(theta) * radius;
    positions[i * 3 + 1] = sinPhi * Math.sin(theta) * radius;
    positions[i * 3 + 2] = Math.cos(phi) * radius;

    // p = normalized radial distance, 0 at the foveated core → 1 at the rim.
    // radius ∝ sqrt(i), so p = sqrt(i)/sqrt(MAX_NODES) is perceptually even.
    const p = Math.sqrt(i) / denom;
    const core = 1 - p; // 1 at core, 0 at rim

    // Bias the color toward the rim hue except near the very center (core²),
    // so only the dense fovea reads bright — the Fact→Dream gradient, in light.
    c.copy(RIM_COLOR).lerp(CORE_COLOR, core * core);
    colors[i * 3 + 0] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;

    // Vary cell SIZE and opacity to preserve (never flatten) the gradient.
    sizes[i] = 0.22 + core * 0.55;
    alphas[i] = 0.14 + core * core * 0.66;
    seeds[i] = Math.random() * Math.PI * 2;
  }

  return { positions, colors, sizes, alphas, seeds };
}

const VERT = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uIntensity;
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSeed;
  varying vec3 vColor;
  varying float vAlpha;
  // Auto-declutter band (camera-space depth, world units): points nearer than
  // NEAR_GONE are fully faded; opacity ramps back to full by NEAR_FULL.
  const float NEAR_GONE = 1.5;
  const float NEAR_FULL = 7.0;
  void main() {
    vColor = aColor;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float depth = -mv.z;
    // As the camera pushes into the dense core, dots right in front of it
    // dissolve and ramp back to full by NEAR_FULL — opening a viewing tunnel
    // instead of a wall of overlapping points. Pure camera-distance effect: it
    // never touches the per-point foveal size/brightness ramp, so Foveal
    // Gradient Integrity still holds at normal viewing range.
    float nearFade = smoothstep(NEAR_GONE, NEAR_FULL, depth);
    // Slow, low-amplitude breathing so the empty lattice feels alive without
    // distracting from live nodes. Per-point phase (aSeed) avoids a flat pulse.
    float shimmer = 0.85 + 0.15 * sin(uTime * 0.6 + aSeed);
    vAlpha = aAlpha * shimmer * uIntensity * nearFade;
    // Clamp to avoid pathological overdraw spikes when a core point is very
    // close to the camera (e.g. zoomed all the way in). A gentle size bump at
    // higher intensity helps the "full" setting read without doubling overdraw.
    float sizeBoost = 0.8 + 0.2 * uIntensity;
    gl_PointSize = min(aSize * uPixelRatio * (230.0 / depth) * sizeBoost, 48.0);
    gl_Position = projectionMatrix * mv;
  }
`;

const FRAG = /* glsl */ `
  varying vec3 vColor;
  varying float vAlpha;
  void main() {
    vec2 cc = gl_PointCoord - vec2(0.5);
    float d2 = dot(cc, cc);
    if (d2 > 0.25) discard;            // round point, radius 0.5
    float soft = smoothstep(0.25, 0.0, d2);
    gl_FragColor = vec4(vColor, vAlpha * soft);
  }
`;

export function GhostScaffold() {
  const pixelRatio = useThree((s) => s.gl.getPixelRatio());

  const geometry = useMemo(() => {
    const { positions, colors, sizes, alphas, seeds } = buildScaffold();
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions, 3));
    g.setAttribute("aColor", new BufferAttribute(colors, 3));
    g.setAttribute("aSize", new BufferAttribute(sizes, 1));
    g.setAttribute("aAlpha", new BufferAttribute(alphas, 1));
    g.setAttribute("aSeed", new BufferAttribute(seeds, 1));
    return g;
  }, []);

  const material = useMemo(
    () =>
      new ShaderMaterial({
        uniforms: {
          uTime: { value: 0 },
          uPixelRatio: { value: pixelRatio },
          uIntensity: { value: 1 },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
        transparent: true,
        depthWrite: false,
        blending: NormalBlending,
      }),
    [pixelRatio],
  );

  // User-controlled visibility. `off` hides via `visible={false}` so three skips
  // the draw call without unmounting the object — that keeps the one-time
  // geometry/material instances alive across toggles (a `return null` would let
  // R3F auto-dispose them, breaking the next on-toggle). The factor also drives a
  // brightness/size uniform. Subscribing here re-renders only on the (rare)
  // toggle — never per frame.
  const intensity = useHudStore((s) => s.scaffoldIntensity);
  const factor = INTENSITY_FACTOR[intensity];
  const visible = factor > 0;
  material.uniforms.uIntensity.value = factor;

  useFrame(({ clock }) => {
    if (!visible) return;
    material.uniforms.uTime.value = clock.getElapsedTime();
  });

  return (
    <points
      visible={visible}
      geometry={geometry}
      material={material}
      frustumCulled={false}
      raycast={NO_RAYCAST}
    />
  );
}
