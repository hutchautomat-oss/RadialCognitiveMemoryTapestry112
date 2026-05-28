/**
 * INVARIANTS — top-center horizontal strip of six dots. Each one is a
 * load-bearing fact of the grounding-file format. Green = nominal, red =
 * the format just broke. Hover to read the detail line.
 *
 * Two of the six are expected to be informative red until other tasks land
 * (parity flips green when Task #4 retires the legacy graph). The whole
 * point of the strip is to make those drifts visible, not hidden.
 */

import { useHudStore, type InvariantId } from "../../store/useHudStore";
import { cardShell, COLOR, FONT } from "./tokens";

const ORDER: { id: InvariantId; label: string }[] = [
  { id: "stride", label: "STRIDE" },
  { id: "tier_contiguity", label: "TIERS" },
  { id: "fifo", label: "FIFO" },
  { id: "bvh_proxy", label: "BVH" },
  { id: "foveation", label: "FOVEA" },
  { id: "parity", label: "PARITY" },
];

export function Invariants() {
  const invariants = useHudStore((s) => s.invariants);
  const failing = ORDER.filter((o) => !invariants[o.id].ok).length;

  return (
    <div
      style={{
        ...cardShell,
        top: 14,
        left: "50%",
        transform: "translateX(-50%)",
        padding: "6px 12px",
        display: "flex",
        alignItems: "center",
        gap: 14,
      }}
    >
      <span style={{ color: COLOR.textMuted, fontSize: 9, letterSpacing: 1 }}>
        INVARIANTS
      </span>
      {ORDER.map(({ id, label }) => {
        const inv = invariants[id];
        const color = inv.ok ? COLOR.nominal : COLOR.fail;
        return (
          <span
            key={id}
            title={`${label}: ${inv.detail}`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              fontFamily: FONT,
              fontSize: 9.5,
              color: COLOR.text,
              cursor: "help",
            }}
          >
            <span
              style={{
                width: 7,
                height: 7,
                background: color,
                border: `1px solid ${color}`,
                boxShadow: inv.ok ? "none" : `0 0 4px ${color}`,
              }}
            />
            <span style={{ color: inv.ok ? COLOR.textDim : color }}>{label}</span>
          </span>
        );
      })}
      <span
        style={{
          marginLeft: 8,
          paddingLeft: 10,
          borderLeft: `1px solid ${COLOR.border}`,
          color: failing > 0 ? COLOR.fail : COLOR.nominal,
          fontSize: 9,
          letterSpacing: 1,
        }}
      >
        {failing > 0 ? `${failing} FAIL` : "ALL GREEN"}
      </span>
    </div>
  );
}
