/**
 * EPISTEMIC BALANCE — the "mirror for thought".
 *
 * A persistent readout of the tapestry's overall epistemic shape. It shows the
 * live tier MIX (share of total per tier — distinct from the Ontology card's
 * occupancy-vs-cap) and a tilting balance beam whose lean is the distribution's
 * center of mass along the Fact→Dream (core→rim) axis. Overfeed the speculative
 * tiers and the beam visibly sinks toward Dream; a Fact-heavy run sinks toward
 * the core. The creator reads their own thinking back from the shape.
 *
 * Read-only over `tierCounts` — no lattice writes, no wire impact.
 */

import { useMemo } from "react";
import { useSaccadeStore } from "../../store/useSaccadeStore";
import { TIER_CAPS } from "../../store/useSaccadeStore";
import { TIER_LABEL } from "../../lib/tierNarration";
import { cardBody, COLOR } from "./tokens";
import { HudCard } from "./HudCard";

// Cap-proportional baseline: a "naturally full" lattice isn't an even split —
// the caps themselves taper outward (more Fact slots than Dream), so the
// balanced center-of-mass is where the mix matches the caps, not 0.5.
const IDEAL_COM = (() => {
  const total = TIER_CAPS.reduce((a, b) => a + b, 0);
  const weighted = TIER_CAPS.reduce((a, c, i) => a + i * c, 0);
  return weighted / total / 4; // ≈ 0.42
})();

const DEAD_BAND = 0.1; // how far from ideal before we call it skewed

export function EpistemicBalance() {
  const tierCounts = useSaccadeStore((s) => s.tierCounts);

  const model = useMemo(() => {
    const total = tierCounts.reduce((a, b) => a + b, 0);
    const shares = tierCounts.map((c) => (total > 0 ? c / total : 0));
    const comRaw =
      total > 0
        ? tierCounts.reduce((a, c, i) => a + i * c, 0) / total / 4
        : IDEAL_COM;
    const dev = comRaw - IDEAL_COM;

    let label: string;
    let color: string;
    if (total < 5) {
      label = "WARMING UP";
      color = COLOR.textDim;
    } else if (dev > DEAD_BAND) {
      label = "SPECULATIVE-SKEWED";
      color = COLOR.warn;
    } else if (dev < -DEAD_BAND) {
      label = "OVER-GROUNDED";
      color = COLOR.accent;
    } else {
      label = "BALANCED";
      color = COLOR.nominal;
    }

    // Beam lean: positive deg = Dream side (right) sinks.
    const tiltDeg = Math.max(-22, Math.min(22, dev * 70));
    return { total, shares, comRaw, dev, label, color, tiltDeg };
  }, [tierCounts]);

  return (
    <HudCard
      id="epistemic-balance"
      title="EPISTEMIC BALANCE"
      plainTitle="Mirror For Thought"
      helpText="The live shape of your tapestry. The stacked bar is the tier MIX (share of all memories). The beam leans toward whichever end is heavier — toward the dense core if you store mostly Facts, toward the sparse rim if you overfeed speculative Dreams. A lopsided lean is the distribution reflecting your own thinking back at you."
      initial={{ top: 210, left: 14 }}
      width={250}
      headerExtra={
        <span style={{ color: model.color }}>{model.label}</span>
      }
    >
      <div style={cardBody}>
        {/* Tier MIX bar — share of total per tier. */}
        <div
          style={{
            display: "flex",
            width: "100%",
            height: 9,
            border: `1px solid ${COLOR.border}`,
            borderRadius: 1,
            overflow: "hidden",
            background: COLOR.bgSolid,
          }}
        >
          {model.shares.map((sh, i) => (
            <div
              key={i}
              title={`${TIER_LABEL[i]} ${(sh * 100).toFixed(0)}%`}
              style={{
                width: `${(sh * 100).toFixed(2)}%`,
                background: COLOR.tier[i],
                transition: "width 240ms ease",
              }}
            />
          ))}
        </div>

        {/* Balance beam. */}
        <div
          style={{
            position: "relative",
            height: 52,
            marginTop: 12,
            marginBottom: 2,
          }}
        >
          {/* The beam itself, leaning by center-of-mass. */}
          <div
            style={{
              position: "absolute",
              top: 18,
              left: "8%",
              width: "84%",
              height: 3,
              background: `linear-gradient(90deg, ${COLOR.tier[0]}, ${COLOR.tier[2]}, ${COLOR.tier[4]})`,
              transform: `rotate(${model.tiltDeg}deg)`,
              transformOrigin: "center center",
              transition: "transform 360ms cubic-bezier(.34,1.3,.64,1)",
              borderRadius: 2,
            }}
          />
          {/* Fulcrum triangle under the center. */}
          <div
            style={{
              position: "absolute",
              top: 21,
              left: "calc(50% - 6px)",
              width: 0,
              height: 0,
              borderLeft: "6px solid transparent",
              borderRight: "6px solid transparent",
              borderBottom: `11px solid ${COLOR.borderStrong}`,
            }}
          />
          {/* End labels. */}
          <span
            style={{
              position: "absolute",
              top: 38,
              left: "4%",
              fontSize: 8.5,
              color: COLOR.tier[0],
              letterSpacing: 0.5,
            }}
          >
            CORE · FACT
          </span>
          <span
            style={{
              position: "absolute",
              top: 38,
              right: "4%",
              fontSize: 8.5,
              color: COLOR.tier[4],
              letterSpacing: 0.5,
            }}
          >
            DREAM · RIM
          </span>
        </div>

        {/* Numeric readout. */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 4,
            fontSize: 9.5,
            color: COLOR.textDim,
          }}
        >
          <span>
            mass{" "}
            <span style={{ color: model.color }}>
              {model.comRaw.toFixed(2)}
            </span>
            <span style={{ color: COLOR.textMuted }}> / bal {IDEAL_COM.toFixed(2)}</span>
          </span>
          <span style={{ color: COLOR.textMuted }}>n={model.total}</span>
        </div>
      </div>
    </HudCard>
  );
}
