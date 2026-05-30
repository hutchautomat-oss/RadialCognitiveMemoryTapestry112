/**
 * ONTOLOGY — top-right card. Per-tier occupancy bars + a global 8k fill gauge,
 * each ramping nominal → warn → fail as it approaches its cap so capacity
 * PRESSURE is readable at a glance (not a flat tier color). Below the gauge, a
 * bloat-contrast readout pins RCMT's constant footprint (8,000 slots / ~224 KB)
 * against what an unbounded vector store WOULD have grown to from the same
 * input stream — the visible proof of "fills but never gets fat".
 *
 * Rolling 10-s SPAWN(+) / EVICT(−) counts per tier come from the event ring;
 * DEMOTE + EVICT are summed into a global "shed" figure beside the gauge.
 */

import { useEffect, useState } from "react";
import { useHudStore } from "../../store/useHudStore";
import {
  useSaccadeStore,
  TIER_CAPS,
  TIER_LAMBDA,
  MAX_NODES,
  STRIDE,
} from "../../store/useSaccadeStore";
import { cardBody, COLOR, TIER_NAMES } from "./tokens";
import { HudCard } from "./HudCard";

const WINDOW_MS = 10_000;

/** RCMT's pinned wire footprint: every slot is STRIDE floats × 4 bytes. */
const RCMT_BYTES = MAX_NODES * STRIDE * 4; // 8000 × 7 × 4 = 224,000

/**
 * Per-memory cost a conventional vector store would pay: one ~1,536-dim
 * float32 embedding (frontier-model size) plus index overhead, NEVER recycled.
 * This is a computed contrast figure, not a live external store.
 */
const VECTOR_DIM = 1536;
const VECTOR_BYTES = VECTOR_DIM * 4; // 6,144 bytes / memory

function fmtBytes(b: number): string {
  if (b >= 1e9) return `${(b / 1e9).toFixed(2)} GB`;
  if (b >= 1e6) return `${(b / 1e6).toFixed(2)} MB`;
  if (b >= 1e3) return `${(b / 1e3).toFixed(1)} KB`;
  return `${b} B`;
}

/** Occupancy-pressure color ramp: green → amber (~80%) → red (near cap). */
function pressureColor(pct: number): string {
  if (pct >= 95) return COLOR.fail;
  if (pct >= 80) return COLOR.warn;
  return COLOR.nominal;
}

export function Ontology() {
  const tierCounts = useSaccadeStore((s) => s.tierCounts);
  const events = useHudStore((s) => s.events);
  const totalInjected = useHudStore((s) => s.totalInjected);

  // Recompute per-tier rolling counts when events advance (cheap; O(events_in_window)).
  const [spawnByTier, setSpawnByTier] = useState<number[]>([0, 0, 0, 0, 0]);
  const [evictByTier, setEvictByTier] = useState<number[]>([0, 0, 0, 0, 0]);
  const [shed10s, setShed10s] = useState(0);

  useEffect(() => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const sp = [0, 0, 0, 0, 0];
    const ev = [0, 0, 0, 0, 0];
    let shed = 0;
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.ts < cutoff) break;
      // Shed = anything leaving or drifting outward under pressure.
      if (e.type === "EVICT" || e.type === "DEMOTE") shed++;
      if (!e.tier) continue;
      const t = Math.max(0, Math.min(4, e.tier - 1));
      if (e.type === "SPAWN" || e.type === "AXIOM" || e.type === "PROMOTE") sp[t]++;
      if (e.type === "EVICT") ev[t]++;
    }
    setSpawnByTier(sp);
    setEvictByTier(ev);
    setShed10s(shed);
  }, [events]);

  const totalOccupied = tierCounts.reduce((a, b) => a + b, 0);
  const globalPct = (totalOccupied / MAX_NODES) * 100;
  const globalColor = pressureColor(globalPct);

  // Bloat contrast: RCMT is pinned; the vector-store equivalent balloons with
  // every injection ever made, recycled or not.
  const vectorBytes = totalInjected * VECTOR_BYTES;
  const bloatRatio = vectorBytes > 0 ? vectorBytes / RCMT_BYTES : 0;

  return (
    <HudCard
      id="ontology"
      title="ONTOLOGY"
      plainTitle="Memory by Tier"
      helpText="Each bar is one of the five memory tiers, from rock-solid Facts at the core to speculative Dreams at the rim. The bar turns amber then red as that tier nears its hard cap. The gauge below shows total fill; the BLOAT line shows how much a normal vector database would have ballooned to from the same input — RCMT stays pinned."
      initial={{ top: 14, right: 14 }}
      width={300}
      style={{ maxHeight: 320, overflow: "hidden" }}
      headerExtra={
        <span style={{ color: globalColor }}>{totalOccupied}/8000</span>
      }
    >
      <div style={cardBody}>
        {TIER_NAMES.map((name, i) => {
          const occ = tierCounts[i] ?? 0;
          const cap = TIER_CAPS[i];
          const pct = (occ / cap) * 100;
          const dot = COLOR.tier[i];
          const barColor = pressureColor(pct);
          return (
            <div key={name} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, background: dot, display: "inline-block" }} />
                  <span style={{ color: COLOR.text, fontSize: 10 }}>{name}</span>
                  <span style={{ color: COLOR.textMuted, fontSize: 9 }}>
                    λ {TIER_LAMBDA[i].toFixed(3)}
                  </span>
                </span>
                <span style={{ color: COLOR.textDim, fontSize: 9.5 }}>
                  {occ}/{cap}
                  <span style={{ color: COLOR.nominal, marginLeft: 6 }}>+{spawnByTier[i]}</span>
                  <span style={{ color: COLOR.fail, marginLeft: 4 }}>-{evictByTier[i]}</span>
                </span>
              </div>
              <div style={{ position: "relative", height: 4, border: `1px solid ${COLOR.border}`, background: "rgba(0,0,0,0.4)" }}>
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: `${Math.min(100, pct)}%`,
                    background: barColor,
                    opacity: 0.85,
                  }}
                />
              </div>
            </div>
          );
        })}

        {/* ── Global 8k capacity gauge ──────────────────────────── */}
        <div style={{ marginTop: 8, marginBottom: 2, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ color: COLOR.textDim, fontSize: 9.5, letterSpacing: 0.6 }}>CAPACITY</span>
          <span style={{ fontSize: 9.5 }}>
            <span style={{ color: globalColor }}>{globalPct.toFixed(1)}%</span>
            <span style={{ color: COLOR.warn, marginLeft: 8 }}>⌀ shed {shed10s}/10s</span>
          </span>
        </div>
        <div style={{ position: "relative", height: 6, border: `1px solid ${COLOR.borderStrong}`, background: "rgba(0,0,0,0.5)" }}>
          <div
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              bottom: 0,
              width: `${Math.min(100, globalPct)}%`,
              background: globalColor,
              opacity: 0.9,
            }}
          />
        </div>

        {/* ── Bloat contrast: pinned vs ballooning ──────────────── */}
        <div style={{ marginTop: 8, borderTop: `1px solid ${COLOR.border}`, paddingTop: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5 }}>
            <span style={{ color: COLOR.textDim }}>RCMT</span>
            <span style={{ color: COLOR.nominal }}>{fmtBytes(RCMT_BYTES)} · pinned</span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, marginTop: 2 }}>
            <span style={{ color: COLOR.textDim }}>vector-DB eqv.</span>
            <span style={{ color: COLOR.fail }}>
              {fmtBytes(vectorBytes)}
              {bloatRatio >= 1 && (
                <span style={{ color: COLOR.warn, marginLeft: 6 }}>{bloatRatio.toFixed(0)}×</span>
              )}
            </span>
          </div>
          <div style={{ marginTop: 3, color: COLOR.textMuted, fontSize: 8.5, letterSpacing: 0.5 }}>
            {totalInjected.toLocaleString()} injections × {VECTOR_DIM}-dim — never recycled
          </div>
        </div>
      </div>
    </HudCard>
  );
}
