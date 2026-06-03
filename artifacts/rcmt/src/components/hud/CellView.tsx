import React from "react";
import { HudCard } from "./HudCard";
import { useHudStore } from "../../store/useHudStore";
import { useSaccadeStore, MAX_NODES, STRIDE, TIER_CAPS } from "../../store/useSaccadeStore";
import { FONT, COLOR, cardBody } from "./tokens";

export function CellView() {
  const slot = useHudStore((s) => s.cellViewSlot);
  const setCellViewSlot = useHudStore((s) => s.setCellViewSlot);
  const frame = useSaccadeStore((s) => s.mockFrames[s.activeFrameIndex]);
  const slotPhrase = useSaccadeStore((s) => s.slotPhrase);
  const slotTier = useSaccadeStore((s) => s.slotTier);
  const injectedAt = useSaccadeStore((s) => s.injectedAt);
  const mass = useSaccadeStore((s) => s.mass);
  const reinforcementCount = useSaccadeStore((s) => s.reinforcementCount);

  if (slot === null) return null;
  if (!frame || slot < 0 || slot >= MAX_NODES) {
    return (
      <HudCard id="cell-view" title="CELL VIEW" initial={{ top: 40, right: 14 }} width={520}>
        <div style={cardBody}>Invalid slot</div>
      </HudCard>
    );
  }

  const off = slot * STRIDE;
  const px = frame[off + 0];
  const py = frame[off + 1];
  const pz = frame[off + 2];
  const r = frame[off + 3];
  const g = frame[off + 4];
  const b = frame[off + 5];
  const size = frame[off + 6];
  const tier = slotTier[slot];
  const phrase = slotPhrase[slot] ?? "(no source text)";
  const inj = injectedAt[slot];
  const age = inj > 0 ? ((Date.now() - inj) / 1000).toFixed(1) + "s" : "—";

  return (
    <HudCard
      id="cell-view"
      title={`CELL ${slot}`}
      plainTitle={`Tier ${tier}`}
      initial={{ top: 40, right: 14 }}
      width={560}
      helpText="Detailed view of an intersection: code, provenance, and neighbors"
      headerExtra={
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <button
            onClick={() => setCellViewSlot(null)}
            style={{
              background: "transparent",
              border: `1px solid ${COLOR.border}`,
              color: COLOR.textDim,
              padding: "4px 8px",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      }
    >
      <div style={{ ...cardBody, display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <div style={{ color: COLOR.textDim, fontSize: 11, marginBottom: 8 }}>Source</div>
          <pre
            style={{
              fontFamily: FONT,
              fontSize: 11,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              background: "rgba(255,255,255,0.01)",
              padding: 10,
              borderRadius: 6,
              border: `1px solid ${COLOR.border}`,
              color: COLOR.text,
              maxHeight: 360,
              overflow: "auto",
            }}
          >
            {phrase}
          </pre>
        </div>
        <aside style={{ width: 220, minWidth: 220 }}>
          <div style={{ color: COLOR.textDim, fontSize: 11, marginBottom: 6 }}>Provenance</div>
          <div style={{ color: COLOR.text, marginBottom: 8 }}>
            <div>Slot: {slot}</div>
            <div>Tier: {tier}</div>
            <div>Age: {age}</div>
            <div>Mass: {mass[slot].toFixed(2)}</div>
            <div>Reinforcements: {reinforcementCount[slot]}</div>
            <div>
              Pos: ({px.toFixed(2)}, {py.toFixed(2)}, {pz.toFixed(2)})
            </div>
            <div style={{ marginTop: 8 }}>
              Color: <span style={{ color: `rgb(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)})` }}>●</span>
            </div>
          </div>
        </aside>
      </div>
    </HudCard>
  );
}

export default CellView;
