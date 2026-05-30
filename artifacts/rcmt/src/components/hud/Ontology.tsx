/**
 * ONTOLOGY — top-right card. Per-tier occupancy bars with hard cap, decay
 * λ, and rolling 10-s SPAWN / EVICT counts pulled from the event ring.
 *
 * The bar is a 1-px hairline frame filled by occupancy/cap. Color is the
 * tier's canonical palette dimmed to 60% so it doesn't compete with the 3D
 * scene.
 */

import { useEffect, useState } from "react";
import { useHudStore } from "../../store/useHudStore";
import {
  useSaccadeStore,
  TIER_CAPS,
  TIER_LAMBDA,
} from "../../store/useSaccadeStore";
import { cardBody, COLOR, TIER_NAMES } from "./tokens";
import { HudCard } from "./HudCard";

const WINDOW_MS = 10_000;

export function Ontology() {
  const tierCounts = useSaccadeStore((s) => s.tierCounts);
  const events = useHudStore((s) => s.events);

  // Recompute per-tier rolling counts when events advance (cheap; O(events_in_window)).
  const [spawnByTier, setSpawnByTier] = useState<number[]>([0, 0, 0, 0, 0]);
  const [evictByTier, setEvictByTier] = useState<number[]>([0, 0, 0, 0, 0]);

  useEffect(() => {
    const now = Date.now();
    const cutoff = now - WINDOW_MS;
    const sp = [0, 0, 0, 0, 0];
    const ev = [0, 0, 0, 0, 0];
    for (let i = events.length - 1; i >= 0; i--) {
      const e = events[i];
      if (e.ts < cutoff) break;
      if (!e.tier) continue;
      const t = Math.max(0, Math.min(4, e.tier - 1));
      if (e.type === "SPAWN" || e.type === "AXIOM" || e.type === "PROMOTE") sp[t]++;
      if (e.type === "EVICT") ev[t]++;
    }
    setSpawnByTier(sp);
    setEvictByTier(ev);
  }, [events]);

  const totalOccupied = tierCounts.reduce((a, b) => a + b, 0);

  return (
    <HudCard
      id="ontology"
      title="ONTOLOGY"
      plainTitle="Memory by Tier"
      helpText="Each bar is one of the five memory tiers, from rock-solid Facts at the core to speculative Dreams at the rim, showing how full it is. The +/− numbers are how many memories were added or recycled in the last 10 seconds."
      initial={{ top: 14, right: 14 }}
      width={300}
      style={{ maxHeight: 220, overflow: "hidden" }}
      headerExtra={
        <span style={{ color: COLOR.textMuted }}>{totalOccupied}/8000</span>
      }
    >
      <div style={cardBody}>
        {TIER_NAMES.map((name, i) => {
          const occ = tierCounts[i] ?? 0;
          const cap = TIER_CAPS[i];
          const pct = (occ / cap) * 100;
          const color = COLOR.tier[i];
          return (
            <div key={name} style={{ marginBottom: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  <span style={{ width: 6, height: 6, background: color, display: "inline-block" }} />
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
                    background: color,
                    opacity: 0.7,
                  }}
                />
              </div>
            </div>
          );
        })}
        <div style={{ marginTop: 4, color: COLOR.textMuted, fontSize: 8.5, letterSpacing: 0.8 }}>
          Δ(10s) — spawn / evict, per tier
        </div>
      </div>
    </HudCard>
  );
}
