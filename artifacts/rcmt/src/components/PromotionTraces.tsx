/**
 * PromotionTraces — in-canvas LineSegments that draw a brief vector trail from
 * a node's origin slot to its destination whenever it migrates INWARD on
 * reinforcement (a promotion). The epistemic logic — "this got more grounded,
 * so it moved toward the core" — becomes visible instead of implied.
 *
 * Read-only consumer of the store's promotion-animation arrays (animStartTime /
 * animFromPos / animToPos). It NEVER writes the frame buffer or store state, so
 * it cannot affect the wire format, picking, or replay.
 *
 * Live-mode only: during a binary timeline scrub nothing migrates, so we stop
 * registering new traces and let any in-flight ones fade — consistent with the
 * decay-vs-replay gate.
 */

import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
} from "three";
import {
  useSaccadeStore,
  MAX_NODES,
  PROMOTION_ANIM_MS,
  TIER_RGB,
} from "../store/useSaccadeStore";

/** A trace lives a little longer than the migration animation so there's a
 *  short afterglow once the node settles into its new slot. */
const TRACE_MS = 1100;
const MAX_TRACES = 96;

interface Trace {
  fx: number;
  fy: number;
  fz: number;
  tx: number;
  ty: number;
  tz: number;
  start: number;
  tier: number;
}

/** Cubic ease-in-out — matches SaccadeInstancedMesh's promotion lerp so the
 *  trace head tracks the rendered node exactly. */
function easeInOut(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function PromotionTraces() {
  const tracesRef = useRef<Trace[]>([]);
  // Per-slot last-seen animation start, so we register each promotion once.
  const lastStartRef = useRef<Float64Array>(new Float64Array(MAX_NODES));

  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute(
      "position",
      new BufferAttribute(new Float32Array(MAX_TRACES * 6), 3),
    );
    g.setAttribute(
      "color",
      new BufferAttribute(new Float32Array(MAX_TRACES * 6), 3),
    );
    g.setDrawRange(0, 0);
    return g;
  }, []);

  const material = useMemo(
    () =>
      new LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      }),
    [],
  );

  useFrame(() => {
    const s = useSaccadeStore.getState();
    const live = !s.isFileLoaded && s.activeFrameIndex === 0;
    const now = performance.now();

    if (live) {
      const animStart = s.animStartTime;
      const from = s.animFromPos;
      const to = s.animToPos;
      const lastStart = lastStartRef.current;
      for (let i = 0; i < MAX_NODES; i++) {
        const st = animStart[i];
        if (st > 0) {
          if (st !== lastStart[i]) {
            lastStart[i] = st;
            tracesRef.current.push({
              fx: from[i * 3],
              fy: from[i * 3 + 1],
              fz: from[i * 3 + 2],
              tx: to[i * 3],
              ty: to[i * 3 + 1],
              tz: to[i * 3 + 2],
              start: st,
              tier: s.slotTier[i],
            });
          }
        } else if (lastStart[i] !== 0) {
          lastStart[i] = 0;
        }
      }
    }

    // Prune expired traces, keep newest if we somehow exceed the cap.
    let traces = tracesRef.current.filter((t) => now - t.start < TRACE_MS);
    if (traces.length > MAX_TRACES) traces = traces.slice(traces.length - MAX_TRACES);
    tracesRef.current = traces;

    const posAttr = geometry.attributes.position as BufferAttribute;
    const colAttr = geometry.attributes.color as BufferAttribute;
    const posArr = posAttr.array as Float32Array;
    const colArr = colAttr.array as Float32Array;

    const n = traces.length;
    for (let k = 0; k < n; k++) {
      const t = traces[k];
      const life = (now - t.start) / TRACE_MS; // 0 → 1
      const fade = Math.max(0, 1 - life); // brightness toward the dark bg
      // Head follows the migrating node along the same eased path it renders.
      const animT = Math.min(1, (now - t.start) / PROMOTION_ANIM_MS);
      const e = easeInOut(animT);
      const hx = t.fx + (t.tx - t.fx) * e;
      const hy = t.fy + (t.ty - t.fy) * e;
      const hz = t.fz + (t.tz - t.fz) * e;

      const base = k * 6;
      posArr[base + 0] = t.fx;
      posArr[base + 1] = t.fy;
      posArr[base + 2] = t.fz;
      posArr[base + 3] = hx;
      posArr[base + 4] = hy;
      posArr[base + 5] = hz;

      const idx = Math.max(0, Math.min(4, t.tier - 1));
      const [cr, cg, cb] = TIER_RGB[idx];
      // Dim tail at the origin, bright head at the node — reads as a comet
      // streaking toward the core.
      colArr[base + 0] = cr * fade * 0.22;
      colArr[base + 1] = cg * fade * 0.22;
      colArr[base + 2] = cb * fade * 0.22;
      colArr[base + 3] = cr * fade;
      colArr[base + 4] = cg * fade;
      colArr[base + 5] = cb * fade;
    }

    geometry.setDrawRange(0, n * 2);
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;
  });

  return (
    <lineSegments geometry={geometry} material={material} frustumCulled={false} />
  );
}
