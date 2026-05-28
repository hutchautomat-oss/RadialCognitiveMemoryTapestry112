/**
 * HoverTooltip — DOM overlay that shows the source phrase for the slot
 * currently under the cursor. Reads `hoveredSlot` from useSaccadeStore;
 * SaccadeInstancedMesh's pointer handlers are the sole writer. Only slots
 * that have a recorded phrase (i.e. injected through injectPhrase, not
 * demo-seeded) ever produce a non-null hover state, so this overlay
 * naturally hides for vacant and demo slots without an explicit check.
 *
 * Lives OUTSIDE the Canvas so it can use ordinary DOM positioning instead
 * of paying for a per-frame R3F Html overlay. Anchored to the pointer with
 * a small offset; flips horizontally near the right edge of the viewport
 * so long phrases don't get clipped.
 */

import { useSaccadeStore } from "../store/useSaccadeStore";
import { COLOR, FONT, TIER_NAMES } from "./hud/tokens";

const TOOLTIP_OFFSET = 14;
const TOOLTIP_MAX_WIDTH = 320;

export function HoverTooltip() {
  const hovered = useSaccadeStore((s) => s.hoveredSlot);
  const slotPhrase = useSaccadeStore((s) => s.slotPhrase);
  const slotTier = useSaccadeStore((s) => s.slotTier);

  if (!hovered) return null;
  const phrase = slotPhrase[hovered.slot];
  if (!phrase) return null;

  const tier = slotTier[hovered.slot];
  const tierName = TIER_NAMES[tier - 1] ?? "?";
  const tierColor = COLOR.tier[tier - 1] ?? COLOR.text;

  // Flip to the left of the cursor if we're too close to the right edge.
  const flipLeft =
    typeof window !== "undefined" &&
    hovered.x + TOOLTIP_OFFSET + TOOLTIP_MAX_WIDTH > window.innerWidth - 8;

  return (
    <div
      style={{
        position: "fixed",
        left: flipLeft ? undefined : hovered.x + TOOLTIP_OFFSET,
        right: flipLeft ? window.innerWidth - hovered.x + TOOLTIP_OFFSET : undefined,
        top: hovered.y + TOOLTIP_OFFSET,
        maxWidth: TOOLTIP_MAX_WIDTH,
        background: COLOR.bg,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 2,
        padding: "6px 8px",
        fontFamily: FONT,
        fontSize: 10.5,
        color: COLOR.text,
        lineHeight: 1.4,
        pointerEvents: "none",
        userSelect: "none",
        zIndex: 200,
        backdropFilter: "blur(3px)",
        letterSpacing: 0.2,
        whiteSpace: "pre-wrap",
        wordBreak: "break-word",
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
          marginBottom: 3,
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
        <span style={{ color: COLOR.textMuted }}>· vram[{hovered.slot}]</span>
      </div>
      <div>{phrase}</div>
    </div>
  );
}
