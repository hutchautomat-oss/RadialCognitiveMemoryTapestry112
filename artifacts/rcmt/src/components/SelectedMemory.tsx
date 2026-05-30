/**
 * SelectedMemory — persistent readout for a single picked node.
 *
 * Click any live node (see SaccadeInstancedMesh's click-vs-drag handler) and
 * it becomes the sole entry in useSaccadeStore.selectedSlots; this card then
 * surfaces what was picked (tier + slot + source phrase) so "fly in, click a
 * memory, read it" is one motion. Only renders when EXACTLY one slot is
 * selected — a multi-slot lasso keeps the existing cyan-highlight + /blast
 * flow and shows nothing here. Esc or the ✕ clears the pick.
 *
 * DOM overlay (outside the Canvas) anchored top-centre under the Invariants
 * strip, in a column with otherwise-open space.
 */

import { useEffect } from "react";
import { useSaccadeStore } from "../store/useSaccadeStore";
import { COLOR, FONT, TIER_NAMES } from "./hud/tokens";
import { TIER_PLAIN, TIER_BAND } from "../lib/tierNarration";

export function SelectedMemory() {
  const selectedSlots = useSaccadeStore((s) => s.selectedSlots);
  const slotPhrase = useSaccadeStore((s) => s.slotPhrase);
  const slotTier = useSaccadeStore((s) => s.slotTier);
  const clearSelection = useSaccadeStore((s) => s.clearSelection);

  const single = selectedSlots.size === 1;

  useEffect(() => {
    if (!single) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [single, clearSelection]);

  if (!single) return null;
  const slot = selectedSlots.values().next().value as number;
  const tier = slotTier[slot];
  const tierName = TIER_NAMES[tier - 1] ?? "?";
  const tierColor = COLOR.tier[tier - 1] ?? COLOR.text;
  const phrase = slotPhrase[slot];

  return (
    <div
      style={{
        position: "fixed",
        top: 60,
        left: "50%",
        transform: "translateX(-50%)",
        maxWidth: 360,
        minWidth: 220,
        background: COLOR.bg,
        border: `1px solid ${COLOR.borderStrong}`,
        borderRadius: 2,
        padding: "7px 9px",
        fontFamily: FONT,
        fontSize: 10.5,
        color: COLOR.text,
        lineHeight: 1.4,
        userSelect: "none",
        zIndex: 150,
        backdropFilter: "blur(3px)",
        letterSpacing: 0.2,
        boxShadow: `0 0 0 1px ${COLOR.accentDim}33`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 9,
          color: COLOR.textDim,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 4,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: 1,
            background: tierColor,
          }}
        />
        <span style={{ color: tierColor }}>{tierName}</span>
        <span style={{ color: COLOR.textMuted }}>· picked vram[{slot}]</span>
        <button
          type="button"
          onClick={() => clearSelection()}
          title="Clear selection (Esc)"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: COLOR.textMuted,
            cursor: "pointer",
            fontFamily: FONT,
            fontSize: 11,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
        {phrase ?? (
          <span style={{ color: COLOR.textMuted, fontStyle: "italic" }}>
            no source phrase (seeded / peer node)
          </span>
        )}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 9,
          color: COLOR.textDim,
          letterSpacing: 0.2,
        }}
      >
        {TIER_PLAIN[tier - 1] ?? ""} · {TIER_BAND[tier - 1] ?? ""}
      </div>
    </div>
  );
}
