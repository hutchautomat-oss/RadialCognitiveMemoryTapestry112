/**
 * INVARIANTS — top-center horizontal strip of five dots. Each one is a
 * load-bearing fact of the grounding-file format. Green = nominal, red =
 * the format just broke. Hover to read the detail line.
 *
 * The whole point of the strip is to make format drift visible, not hidden:
 * a red dot means the wire/geometry contract just broke.
 */

import { useState } from "react";
import { useHudStore, type InvariantId } from "../../store/useHudStore";
import { cardShell, COLOR, FONT } from "./tokens";

const ORDER: { id: InvariantId; label: string }[] = [
  { id: "stride", label: "STRIDE" },
  { id: "tier_contiguity", label: "TIERS" },
  { id: "fifo", label: "FIFO" },
  { id: "bvh_proxy", label: "BVH" },
  { id: "foveation", label: "FOVEA" },
];

const HELP_TEXT =
  "Five always-on checks that the wire format and geometry haven't drifted: packet size, tier layout, recycling order, the picking index, and the foveal density gradient. All green means the 224 KB substrate is still byte-stable; any red dot means a contract just broke.";

export function Invariants() {
  const invariants = useHudStore((s) => s.invariants);
  const guided = useHudStore((s) => s.hudMode === "guided");
  const [helpOpen, setHelpOpen] = useState(false);
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
        {guided ? "INVARIANTS · FORMAT TRIPWIRES" : "INVARIANTS"}
      </span>
      {guided ? (
        <button
          type="button"
          onClick={() => setHelpOpen((v) => !v)}
          aria-label={helpOpen ? "Hide help" : "Show help"}
          aria-expanded={helpOpen}
          style={{
            background: helpOpen ? COLOR.accent : "transparent",
            border: `1px solid ${helpOpen ? COLOR.accent : COLOR.border}`,
            borderRadius: "50%",
            color: helpOpen ? COLOR.bgSolid : COLOR.textDim,
            cursor: "pointer",
            width: 13,
            height: 13,
            fontSize: 9,
            lineHeight: "11px",
            textAlign: "center",
            padding: 0,
            fontFamily: FONT,
            marginLeft: -8,
          }}
        >
          ?
        </button>
      ) : null}
      {guided && helpOpen ? (
        <div
          style={{
            ...cardShell,
            position: "absolute",
            top: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            width: 360,
            padding: "8px 11px",
            fontSize: 9.5,
            lineHeight: 1.55,
            color: COLOR.text,
            letterSpacing: 0.2,
          }}
        >
          {HELP_TEXT}
        </div>
      ) : null}
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
