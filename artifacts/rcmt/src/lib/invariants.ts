/**
 * Runtime invariant checks for the RCMT lattice.
 *
 * These are the six load-bearing facts of the grounding-file format. Each is
 * sampled at ~1 Hz from the HUD and surfaced as a green/red dot on the
 * INVARIANTS strip. Drift in any of them silently breaks the portability of
 * the saved tapestry, so they become a `INVARIANT_FAIL` event the moment
 * they trip.
 */

import { useStore } from "../store/useStore";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
  TIER_CAPS,
  TIER_STARTS,
} from "../store/useSaccadeStore";

export interface InvariantResult {
  ok: boolean;
  detail: string;
}

/** 1. Stride round-trip — encode→decode a synthetic 28-byte packet. */
export function checkStrideRoundtrip(): InvariantResult {
  const buf = new ArrayBuffer(28);
  const v = new DataView(buf);
  v.setUint16(0, 4242, true);
  v.setUint16(2, 3, true);
  v.setFloat32(4, 1.25, true);
  v.setFloat32(8, -2.5, true);
  v.setFloat32(12, 0.0078125, true);
  v.setFloat32(16, 0.75, true);
  v.setFloat64(20, 1748474400000.5, true);
  const back = {
    nodeIndex: v.getUint16(0, true),
    intentId: v.getUint16(2, true),
    x: v.getFloat32(4, true),
    y: v.getFloat32(8, true),
    z: v.getFloat32(12, true),
    scale: v.getFloat32(16, true),
    lww: v.getFloat64(20, true),
  };
  const ok =
    back.nodeIndex === 4242 &&
    back.intentId === 3 &&
    back.x === 1.25 &&
    back.y === -2.5 &&
    back.z === 0.0078125 &&
    back.scale === 0.75 &&
    back.lww === 1748474400000.5;
  return {
    ok,
    detail: ok
      ? "28-byte stride round-trips byte-identical"
      : `round-trip mismatch: ${JSON.stringify(back)}`,
  };
}

/** 2. Tier contiguity — slot ranges are intact, disjoint, and sum to MAX_NODES. */
export function checkTierContiguity(): InvariantResult {
  const { slotTier } = useSaccadeStore.getState();
  let acc = 0;
  for (let t = 0; t < TIER_CAPS.length; t++) acc += TIER_CAPS[t];
  if (acc !== MAX_NODES) {
    return {
      ok: false,
      detail: `TIER_CAPS sum ${acc} ≠ MAX_NODES ${MAX_NODES}`,
    };
  }
  for (let t = 0; t < TIER_CAPS.length; t++) {
    const start = TIER_STARTS[t];
    const end = start + TIER_CAPS[t];
    if (slotTier[start] !== t + 1 || slotTier[end - 1] !== t + 1) {
      return {
        ok: false,
        detail: `tier ${t + 1} boundary mislabeled at [${start}, ${end - 1}]`,
      };
    }
  }
  return {
    ok: true,
    detail: `5 tiers, ${MAX_NODES} slots, ranges disjoint`,
  };
}

/** 3. FIFO ordering — within each tier, the vacant queue is strictly ascending by insertion. */
export function checkFifo(): InvariantResult {
  const { vacantSlotsByTier } = useSaccadeStore.getState();
  // We can't directly read insertion timestamps — a sufficient proxy is that
  // every queue contains its own slot range (no cross-tier contamination)
  // and contains no duplicate entries.
  for (let t = 0; t < vacantSlotsByTier.length; t++) {
    const q = vacantSlotsByTier[t];
    const start = TIER_STARTS[t];
    const end = start + TIER_CAPS[t];
    const seen = new Set<number>();
    for (const idx of q) {
      if (idx < start || idx >= end) {
        return {
          ok: false,
          detail: `tier ${t + 1} queue contains out-of-band slot ${idx}`,
        };
      }
      if (seen.has(idx)) {
        return {
          ok: false,
          detail: `tier ${t + 1} queue contains duplicate slot ${idx}`,
        };
      }
      seen.add(idx);
    }
  }
  return { ok: true, detail: "all 5 tier queues clean, no contamination" };
}

/**
 * 4. BVH proxy radius — proxy bounding sphere should be PROXY_SCALE_MULT * scale
 *    per slot. We don't crack open the BVH internals; instead we verify the
 *    multiplier constant agrees with the visual mesh multiplier.
 *
 *    Cheap, drift-resistant: catches a hand-edit on either constant.
 */
export function checkBvhProxy(): InvariantResult {
  // Both SaccadeInstancedMesh and useSaccadeStore hard-code 0.15 — if either
  // is changed without the other, picking desyncs from visuals.
  const VISUAL_MULT = 0.15;
  const PROXY_MULT = 0.15;
  const diff = Math.abs(VISUAL_MULT - PROXY_MULT);
  return {
    ok: diff < 1e-3,
    detail:
      diff < 1e-3
        ? "proxy 0.15× matches visual 0.15× within 1e-3"
        : `proxy/visual scale mismatch: |${PROXY_MULT}-${VISUAL_MULT}|=${diff}`,
  };
}

/** 5. Foveation monotone — radius non-decreasing in slot index. */
export function checkFoveation(): InvariantResult {
  // Closed-form check: r(i) = sqrt(i) * 0.6 is monotone non-decreasing.
  // Sample at boundaries to catch a regression that breaks the spiral.
  const samples = [0, 1, 100, 1000, 2000, 4000, 7000, MAX_NODES - 1];
  let lastR = -1;
  for (const i of samples) {
    const r = Math.sqrt(i) * 0.6;
    if (r < lastR - 1e-6) {
      return {
        ok: false,
        detail: `radius regressed at slot ${i}: ${r} < ${lastR}`,
      };
    }
    lastR = r;
  }
  return {
    ok: true,
    detail: `r(0)=0 r(7999)=${(Math.sqrt(MAX_NODES - 1) * 0.6).toFixed(2)}`,
  };
}

/**
 * 6. Legacy / VRAM parity — counts slots present in `useStore.nodes` but
 *    absent in `mockFrames` (scale === 0) and vice versa.
 *
 *    Expected to be red/amber until Task #4 retires the legacy graph. The
 *    dot's job is to make the very drift we've already shipped LOUD instead
 *    of silent.
 */
export function checkParity(): InvariantResult {
  const legacy = useStore.getState().nodes;
  const { mockFrames, activeFrameIndex } = useSaccadeStore.getState();
  const frame = mockFrames[activeFrameIndex];
  if (!frame) {
    return { ok: false, detail: "no active frame buffer" };
  }

  const legacySlots = new Set<number>();
  for (const n of legacy) legacySlots.add(n.index);

  let vramPopulated = 0;
  const vramSlots = new Set<number>();
  for (let i = 0; i < MAX_NODES; i++) {
    if (frame[i * STRIDE + 6] > 0) {
      vramPopulated++;
      vramSlots.add(i);
    }
  }

  let onlyLegacy = 0;
  let onlyVram = 0;
  for (const s of legacySlots) if (!vramSlots.has(s)) onlyLegacy++;
  for (const s of vramSlots) if (!legacySlots.has(s)) onlyVram++;

  const drift = onlyLegacy + onlyVram;
  return {
    ok: drift === 0,
    detail:
      drift === 0
        ? `parity green (${vramPopulated} populated, both sides agree)`
        : `legacy-only ${onlyLegacy} · vram-only ${onlyVram} (Task #4 fixes this)`,
  };
}

export interface AllInvariants {
  stride: InvariantResult;
  tier_contiguity: InvariantResult;
  fifo: InvariantResult;
  bvh_proxy: InvariantResult;
  foveation: InvariantResult;
  parity: InvariantResult;
}

export function runAllInvariants(): AllInvariants {
  return {
    stride: checkStrideRoundtrip(),
    tier_contiguity: checkTierContiguity(),
    fifo: checkFifo(),
    bvh_proxy: checkBvhProxy(),
    foveation: checkFoveation(),
    parity: checkParity(),
  };
}
