# RCMT Diagnostic Layer Specification v5.0
## Mathematical Foundation & Perceptual Grounding

**Date**: June 1, 2026  
**Status**: Architecture Definition (Pre-Implementation)  
**Scope**: Complete formalization of Hamiltonian mechanics, phase-space dynamics, perceptual UI, and shader integration before procedural elimination

---

## 1. Hamiltonian Energy Model (Epistemic Phase Space)

### 1.1 Canonical Coordinates and Manifold Structure

The RCMT system models AI grounding as a **5-dimensional semantic manifold** where each node occupies a canonical state $(q, p)$ in phase space:

- **Generalized Position** $q \in \mathbb{R}^5$: Semantic intent vector (compressed from ONNX embedding space via PCA or spherical harmonics)
  - $q_1, q_2, q_3$: Spatial coordinates in foveated lattice (Fibonacci sphere)
  - $q_4$: Tier certainty level (1=Fact, 5=Dream; continuous interpolation)
  - $q_5$: Reinforcement age (temporal coordinate, relevant to Health decay)

- **Generalized Momentum** $p \in \mathbb{R}^5$: Semantic velocity and epistemic tendency
  - $\dot{q}_i = \frac{\partial H}{\partial p_i}$ (Hamilton's equation of motion)
  - $\dot{p}_i = -\frac{\partial H}{\partial q_i}$ (Energy gradient drives motion)

### 1.2 Hamiltonian Energy Function

$$H(q, p, t) = K(p) + V(q, t)$$

#### Kinetic Energy (Semantic Momentum)
$$K(p) = \frac{1}{2} \sum_{i=1}^{5} m_i p_i^2$$

where $m_i$ are effective masses (inertia per coordinate):
- $m_1, m_2, m_3 = 1.0$ (spatial inertia: fovea cannot teleport)
- $m_4 = 0.5$ (tier transitions are energetically cheaper than spatial hops)
- $m_5 = 2.0$ (temporal inertia: reinforcement age resists rapid rewinding)

**Physical Interpretation**: The fovea has momentum — it cannot instantaneously jump to high-energy regions of semantic space. Dragging or reinforcing a node imparts momentum; the node's trajectory through tier space follows geodesics (minimum-energy paths).

#### Potential Energy (Epistemic Landscape)
$$V(q, t) = V_{\text{tier}}(q_4) + V_{\text{health}}(q_5, t) + V_{\text{foveation}}(q_1, q_2, q_3)$$

**Tier Potential** (Certainty Well):
$$V_{\text{tier}}(q_4) = \begin{cases}
-10 \cdot q_4^2 & \text{if } q_4 \leq 1 \text{ (Fact is energetic minimum)} \\
-10 + 5(q_4 - 1)^2 & \text{if } 1 < q_4 \leq 5 \text{ (Dream is metastable rim)}
\end{cases}$$

This creates an **attractive potential well** at tier 1 (Facts). Nodes naturally want to settle inward, but thermal noise (reinforcement strikes) and kinetic barriers keep the system ergodic across all tiers.

**Health Potential** (Exponential Cooling):
$$V_{\text{health}}(q_5, t) = -\alpha \exp\left(-\lambda_{\text{tier}} \cdot \frac{t - t_{\text{inject}}}{1000}\right)$$

where:
- $\alpha = 3.0$ (health depth; ~3 units of potential energy per fresh node)
- $\lambda_{\text{tier}} \in [0.5, 3.0]$ depending on tier (Facts decay slowly, Dreams decay fast)
- $t_{\text{inject}}$ is the injection or reinforcement timestamp
- Time is measured in milliseconds, normalized to seconds in the exponent

**Interpretation**: As a node ages without reinforcement, its potential energy shallows (health → 0). When $V_{\text{health}} < V_{\text{demote threshold}}$, the node rolls outward (demotes). When $V_{\text{health}} < V_{\text{death threshold}}$, the node evaporates.

**Foveation Potential** (Radial Density Shell):
$$V_{\text{foveation}}(q_1, q_2, q_3) = -\beta \left( 1 - \frac{r^2}{R_{\max}^2} \right)^2$$

where:
- $r = \sqrt{q_1^2 + q_2^2 + q_3^2}$ (Euclidean distance from foveal center)
- $R_{\max} = \sqrt{MAX\_NODES} \cdot NODE\_DENSITY\_BUBBLE \approx 89.4$ (rim radius in lattice units)
- $\beta = 2.0$ (foveation strength)

This creates a shallow, flat core (high density tolerance) and steep rim walls (sparse periphery). Nodes prefer to pack near the origin but can spread outward under momentum or evasion pressure.

### 1.3 Energy Conservation and Dissipation

The system is **non-conservative** (it dissipates energy):

$$\frac{dE}{dt} = -\gamma \cdot H(q, p)$$

where $\gamma \approx 0.001$ per frame (weak damping). This ensures:
- Fresh nodes (high $H$) cool gradually
- Old, unreinforced nodes approach $H \approx 0$ and vanish
- Reinforcement pulses inject negative potential, temporarily raising $H$ and destabilizing equilibrium

**Evaporation Threshold**: $H(q, p) < E_{\text{death}} = -0.5$ (absolute energy floor)
**Demotion Threshold**: $H(q, p) < E_{\text{demote}} = -1.5$ (outward drift begins)

### 1.4 Tier Transition Dynamics (No If/Else)

**Promotion** (inward drift):
- Reinforcement counter $\geq 3$ **and** $q_4 > 1$ **and** $E_{\text{promote}} < H < 0$ (critical region)
- Natural transition via energy gradient: $\dot{q}_4 = -\frac{\partial V}{\partial q_4} / m_4$
- Animation: Cubic Bézier interpolation of $q_1, q_2, q_3$ from old lattice position to new, 400ms duration

**Demotion** (outward drift):
- $H < E_{\text{demote}}$ **and** reinforcement counter $= 0$ **and** $q_4 < 5$
- Natural transition via negative potential gradient
- Animation: Same cubic Bézier, but destination is outer tier's lattice position

**Evaporation** (state annihilation):
- $H < E_{\text{death}}$
- Slot freed to tier FIFO, all state vectors zeroed
- No animation: instant fade (rendered as scale → 0 over 1 frame)

---

## 2. Perceptual UI & Typographical Specification

### 2.1 CIELAB Color Space Transformation

The foveal state vector's tier certainty $(q_4)$ maps to perceptual color via CIELAB:

$$L^* = 30 + 60 \cdot \frac{q_4 - 1}{4}$$

This ensures:
- Fact ($q_4 = 1$): $L^* = 30$ (deep, high-contrast, visually prominent)
- Scenario ($q_4 = 2$): $L^* = 45$ (darker, less certain)
- Metric ($q_4 = 3$): $L^* = 60$ (mid-luminance)
- Theory ($q_4 = 4$): $L^* = 75$ (brighter, more abstract)
- Dream ($q_4 = 5$): $L^* = 90$ (very light, washed out, speculative)

#### Hue Ramp (Opponent Color Opponency)

A continuous hue path from **Violet → Cyan → Amber**:

$$h^* = \begin{cases}
270 + 90 \cdot \frac{q_4 - 1}{2} & \text{if } q_4 \in [1, 3] \text{ (Violet to Cyan)} \\
0 + 60 \cdot \frac{q_4 - 3}{2} & \text{if } q_4 \in [3, 5] \text{ (Cyan to Amber)}
\end{cases}$$

This creates:
- **Violet** (270°, low certainty rim): Blue-magenta, signaling Dream-tier speculative content
- **Cyan** (180°, mid certainty): Green-blue transition, neutral epistemic zone
- **Amber** (60°, high certainty core): Yellow-orange, warm and grounded (Facts)

#### Saturation (Confidence Encoding)

$$C^* = 40 + 20 \cdot (q_4 - 1)$$

Saturation increases toward Facts (higher certainty = richer color), decreases toward Dreams (lower certainty = desaturated, pale).

#### Final CIELAB → sRGB Conversion

Use standard CIELAB inverse transformation (ITU matrix) to emit sRGB values for WebGL/WebGPU rendering:

```
[L*, a*, b*] → [R, G, B]
```

**Implementation**: Pre-compute a 256-entry LUT mapping $q_4 \in [1, 5]$ (quantized to 64 values per unit tier) to [R, G, B] on shader compilation. This is **zero-runtime cost** on GPU.

### 2.2 Dynamic Vignette (Peripheral Motion Fade)

A **velocity-responsive vignette** attenuates peripheral nodes during rapid camera motion to prevent vestibular discomfort:

$$\alpha_{\text{vignette}}(r, v_{\text{cam}}) = 1 - \tanh\left( v_{\text{cam}} \cdot \frac{r^2}{R_{\max}^2} \right)$$

where:
- $r = $ distance from foveal center (screen-space)
- $v_{\text{cam}} \in [0, 1]$ = normalized camera speed (clamped from $||\dot{\text{camera}}||$)
- Peripheral nodes (large $r$) fade to transparent ($\alpha \to 0$) when camera is moving fast

**Effect**: At rest or slow pan, full canvas visible. During fast saccade, periphery dims, reducing motion sickness and directing attention to the foveal core.

**Implementation**: TSL fragment shader computes vignette alpha multiplicatively:
```glsl
finalAlpha = nodeAlpha * vignette_alpha
```

### 2.3 Typography & Font Metrics

**Base Font**: Monospace, 11px–14px range (user-scalable via `font-size` CSS variable)

**Line Height**: 1.5em (44% extra spacing, optimal for readability)

**Letter Spacing**: +0.05em (avoid mono-blur at high density)

**Word Spacing**: +0.2em (critical for token parsing in CommandConsole)

#### Accessibility: `prefers-reduced-motion`

```css
@media (prefers-reduced-motion: reduce) {
  /* Diagnostic animations disabled */
  .diagnostic-frame-graph { animation: none; }
  .tier-transition-glow { transition: opacity 0.05s linear; }
  /* Vignette still applies (vestibular safety), but no parallax */
}
```

**Rationale**: Vestibular safety (vignette during camera motion) is a medical accommodation, not a motion preference. Animations and transitions are disabled, but core physics visual updates (node colors, scale) remain instant.

---

## 3. Five-Dimensional Diagnostic Readouts

The diagnostic layer instruments the Hamiltonian system with real-time readouts validating physics coherence.

### 3.1 Phase-Space Portrait (6-Panel Layout)

**Panel 1: Hamiltonian Energy Trajectory**
- X-axis: Time (ms, 10s window rolling buffer)
- Y-axis: $H(q, p, t)$ (joules equivalent)
- Line graph with three traces:
  - **Total Energy**: $H_{\text{total}}$
  - **Kinetic**: $K(p)$ (momentum magnitude)
  - **Potential**: $V(q, t)$ (epistemic well depth)
- Healthy system: total energy decays exponentially with occasional spikes on reinforcement

**Panel 2: Tier Distribution Pie**
- Live occupancy per tier: [Fact, Scenario, Metric, Theory, Dream]
- Healthy distribution: Dense core (Fact/Scenario), sparse periphery (Dream)
- Threshold alert: If Dream > 60% of capacity, system is over-speculating

**Panel 3: Health Decay Histogram**
- X-axis: Time since injection (0–30s)
- Y-axis: Slot count at each health bin
- Overlay: $\exp(-\lambda_t \cdot \Delta t)$ theoretical curve per tier
- Validates: Actual decay matches calibration constants

**Panel 4: Reinforcement Strike Distribution**
- X-axis: Strike count (0–5)
- Y-axis: Slot count
- Highlights: Slots at strike threshold (≥3) primed for promotion
- Validates: Cosine-similarity reinforcement is firing correctly

**Panel 5: Geodesic Path Projection** (2D top-down)
- Spatial scatter of active slots on $q_1, q_2$ plane
- Color: Tier (Violet → Cyan → Amber)
- Circle radius: Mass (node importance)
- Overlay: Foveation potential contours (concentric circles)
- Validates: Spatial distribution matches Fibonacci lattice + density bubble

**Panel 6: Frame-Time Determinism Gauge**
- X-axis: Last 60 frames
- Y-axis: Frame duration (ms, target 16.67ms @ 60Hz)
- Green band: [15.0, 18.0] (acceptable variance)
- Red band: >20ms (GC pause suspected)
- Validates: No React state thrashing, raw buffer mutations only

### 3.2 Readout Numerical Displays (Aerospace Console Style)

```
┌─────────────────────────────────────────┐
│ RCMT DIAGNOSTIC PANEL v5.0              │
├─────────────────────────────────────────┤
│                                         │
│  HAMILTONIAN STATE                      │
│  H(q,p)      │ -0.342 J  [COOL]        │
│  K(p)        │ +0.105 J  [KIN]         │
│  V(q)        │ -0.447 J  [POT]         │
│  dH/dt       │ -0.0004 J/ms [DAMPING]  │
│                                         │
│  TIER SATURATION                        │
│  Fact ████████░░ 68% [2044/3000]        │
│  Scenario ███░░░░░░ 19% [380/2000]      │
│  Metric ██░░░░░░░░ 13% [195/1500]       │
│  Theory ░░░░░░░░░░  4% [60/1500]        │
│  Dream ░░░░░░░░░░  2% [20/1000]         │
│                                         │
│  LATTICE HEALTH                         │
│  Oldest:     +23.4s [REINFORCED]        │
│  Median:     +8.7s  [ACTIVE]            │
│  Newest:     +0.04s [INJECTED]          │
│  Evaporation rate: 2.1 slots/sec        │
│                                         │
│  RENDERING PERFORMANCE                  │
│  Frame time: 14.3 ms [✓ 60Hz OK]        │
│  GPU vram:   224 KB / 224 KB [FULL]     │
│  Draw calls: 1 (InstancedMesh)          │
│  BVH rebuilt: 34 ms ago [IDLE]          │
│                                         │
└─────────────────────────────────────────┘
```

All values update at **24 Hz** (42ms cadence) to avoid jitter while staying responsive.

---

## 4. Three Shader Language (TSL) Integration Strategy

### 4.1 GPU-Side Physics Pipeline

Instead of computing tier transitions and color ramps on the CPU (procedural, blocking), delegate **all continuous transformations to the GPU via TSL**:

```
JavaScript Main Thread
    ↓
[Network ingest, CRVM sync, reinforcement counters]
    ↓
[Zustand state: raw energy values, tier indices, timestamps]
    ↓
GPU (via TSL Nodes)
    ↓
[CIELAB color LUT, vignette fade, animation lerp, instanced rendering]
    ↓
[Screen: 8K lattice rendered at 60Hz, zero CPU overhead]
```

### 4.2 TSL Node Graph Structure

**Input Nodes**:
- `UniformBuffer`: $(H, q_1, q_2, q_3, q_4, \lambda_t, t_{\text{inject}}, v_{\text{cam}})$ per slot (packed in buffer)
- `Time`: Global frame time (for animation playback)
- `TextureLoader`: CIELAB LUT (256×1 texture, precomputed at init)

**Compute Nodes**:
- `HealthDecay`: Compute $\exp(-\lambda_t \cdot \Delta t)$ via exponential node
- `ColorLookup`: Map $q_4$ → LUT index, sample CIELAB→RGB
- `VignetteFade`: Compute $\tanh(v_{\text{cam}} \cdot r^2)$, multiply final alpha
- `AnimationLerp`: Cubic Bézier interpolation of $(q_1, q_2, q_3)$ over $t \in [0, 400\text{ms}]$

**Output Nodes**:
- `InstancedPosition`: Animate vertex positions via `instanceMatrix`
- `InstancedColor`: Write per-instance RGB to InstancedMesh color buffer
- `InstancedOpacity`: Write per-instance alpha (health + vignette fade)

### 4.3 TSL-to-WGSL/GLSL Compilation

Three.js TSL automatically compiles the node graph to:
- **WGSL** (WebGPU): Native shader code, no translation layer
- **GLSL** (WebGL 2.0): Compatible fallback for older browsers

**Benefit**: Single node graph → dual shader targets. No hand-coded GLSL/WGSL divergence.

### 4.4 CIELAB LUT Precomputation (CPU-Once)

At shader init time, compute the 256-entry CIELAB color table **once**:

```javascript
const cielabLUT = new Uint8Array(256 * 3); // RGB, 8-bit per channel
for (let q4_quantized = 0; q4_quantized < 256; q4_quantized++) {
  const q4 = 1 + (q4_quantized / 256) * 4; // [1, 5]
  const [L, a, b] = computeCIELAB(q4);
  const [r, g, b_out] = cielabToSRGB(L, a, b);
  cielabLUT[q4_quantized * 3 + 0] = Math.round(r * 255);
  cielabLUT[q4_quantized * 3 + 1] = Math.round(g * 255);
  cielabLUT[q4_quantized * 3 + 2] = Math.round(b_out * 255);
}
const lutTexture = new THREE.DataTexture(cielabLUT, 256, 1, THREE.RGBFormat, THREE.UnsignedByteType);
```

Then, in the TSL shader:

```javascript
const tierCertainty = slot_q4; // [0, 1] normalized
const lutIndex = tierCertainty * 256;
const color = textureLoad(cielabLUT, lutIndex);
```

**Cost**: 768 bytes texture + 1 texture lookup per vertex = negligible.

---

## 5. Diagnostic Output Validation Protocol

### 5.1 Invariants to Monitor (Continuous)

| Invariant | Expression | Tolerance | Severity |
|-----------|-----------|-----------|----------|
| Energy monotone decay | $\frac{dH}{dt} < 0$ (except during reinforce pulse) | -0.001 to -0.0001 J/ms | ⚠️ Warn if reversed |
| Total slot occupancy | $\sum_t \text{tierCounts}[t] \leq \text{MAX\_NODES}$ | 0 | 🛑 Abort if violated |
| Tier FIFO consistency | $\text{vacantSlotsByTier}[t]$ contains no duplicates | 0 | 🛑 Abort if violated |
| Health decay curve | $H(t) \approx \exp(-\lambda_t \cdot t)$ | ±5% of model | ⚠️ Warn if > 10% drift |
| Foveation density | Facts > Scenarios > Metrics > Theories > Dreams | Gradual | ⚠️ Warn if inverted |
| Frame time stability | $\text{Frame time} \in [14, 18] \text{ ms}$ | ±10% | ⚠️ Warn if > 20ms spikes |

### 5.2 Diagnostic Console Commands (User-Triggered)

```
// Dump phase space for a single slot
> rcmt.diagnose.slot(1234)
{ q: [23.4, -12.1, 5.6, 3.2, 1203.4], p: [0.12, -0.05, 0.08, 0.01, 0.0], H: -0.342, tier: 3 }

// Verify all invariants
> rcmt.diagnose.validate()
✓ Energy monotone    ✓ Occupancy valid   ✓ FIFO consistent
⚠️ Health drift 7.2% > threshold

// Export 60-second performance trace
> rcmt.diagnose.exportTrace()
// Downloads JSON with [timestamp, H, K, V, frame_ms, tier_counts[], ...]

// Trigger an artificial reinforcement pulse and observe energy response
> rcmt.diagnose.pulseReinforce(slot, intensity)
// Injects energy, plots response curve, validates system's natural cooling
```

---

## 6. Implementation Roadmap

### Phase 1: Mathematical & Shader Foundation (This Sprint)
- [ ] Finalize Hamiltonian equations (this spec)
- [ ] Generate CIELAB LUT precomputation code
- [ ] Draft TSL node graph architecture
- [ ] Create diagnostic frame-time counter
- [ ] Validate energy decay math against calibration constants

### Phase 2: GPU-Side Physics (Next Sprint)
- [ ] Implement TSL nodes for color mapping, vignette, animation lerp
- [ ] Test TSL→WGSL/GLSL compilation
- [ ] Benchmark InstancedMesh vs. individual meshes
- [ ] Measure frame-time with full diagnostic panel active

### Phase 3: Procedural Elimination (Post-Diagnostic)
- [ ] Replace `promoteSlot()`/`demoteSlot()` with energy-gradient-based transitions
- [ ] Remove nested loops from `injectLiveIntentVector()` via functional map/filter/reduce
- [ ] Compress `decaySweep()` with lazy evaluation of health curves
- [ ] Validate equivalence against pre-refactored behavior via test suite

### Phase 4: Console & UI (Final Integration)
- [ ] Wire diagnostic readouts to real-time Hamiltonian values
- [ ] Implement aerospace-style panel (CSS Grid, monospace numeric displays)
- [ ] Add `prefers-reduced-motion` media query hooks
- [ ] Expose `rcmt.diagnose.*` command API

---

## 7. Semantic Guarantees

Once this specification is fully implemented:

✅ **Determinism**: Tier transitions occur **only** via energy thresholds, never via random if/else branches  
✅ **Equivariance**: Foveal trajectory respects Hamiltonian geometry; no ad-hoc heuristics  
✅ **Perceptual Coherence**: Color ramp and vignette encode epistemic certainty mathematically  
✅ **Accessibility**: `prefers-reduced-motion` respected; vestibular safety integrated  
✅ **GPU Efficiency**: Zero procedural CPU overhead; all continuous transformations on GPU  
✅ **Verifiable**: Diagnostic layer provides real-time proofs that physics is working as designed  

---

## Appendix A: Hamiltonian Parameter Reference

| Parameter | Symbol | Value | Unit | Domain |
|-----------|--------|-------|------|--------|
| Kinetic mass (spatial) | $m_{1,2,3}$ | 1.0 | unitless | $\mathbb{R}^+$ |
| Kinetic mass (tier) | $m_4$ | 0.5 | unitless | $\mathbb{R}^+$ |
| Kinetic mass (temporal) | $m_5$ | 2.0 | unitless | $\mathbb{R}^+$ |
| Tier well depth | 10.0 | units | $\mathbb{R}^+$ |
| Health depth | $\alpha$ | 3.0 | J | $\mathbb{R}^+$ |
| Decay constant (Fact) | $\lambda_1$ | 0.5 | 1/s | $\mathbb{R}^+$ |
| Decay constant (Dream) | $\lambda_5$ | 3.0 | 1/s | $\mathbb{R}^+$ |
| Damping rate | $\gamma$ | 0.001 | 1/ms | $\mathbb{R}^+$ |
| Evaporation threshold | $E_{\text{death}}$ | -0.5 | J | $\mathbb{R}$ |
| Demotion threshold | $E_{\text{demote}}$ | -1.5 | J | $\mathbb{R}$ |
| Promotion threshold | $E_{\text{promote}}$ | -2.0 | J | $\mathbb{R}$ |

---

## Appendix B: CIELAB Transformation Reference

```javascript
/**
 * q4 (tier certainty) → CIELAB → sRGB color
 * @param q4 ∈ [1, 5]
 * @returns [r, g, b] ∈ [0, 1]
 */
function tierToCIELAB(q4) {
  const L = 30 + 60 * ((q4 - 1) / 4);
  const h = q4 <= 3 
    ? 270 + 90 * ((q4 - 1) / 2)
    : 0 + 60 * ((q4 - 3) / 2);
  const C = 40 + 20 * (q4 - 1);
  const a = C * Math.cos(h * Math.PI / 180);
  const b = C * Math.sin(h * Math.PI / 180);
  return { L, a, b };
}

function cielabToSRGB(L, a, b) {
  // Standard CIELAB → XYZ → sRGB transform (ITU 1976)
  // ... (use standard library like `chroma.js` for precision)
  return [r, g, b_out];
}
```

---

End of Specification
