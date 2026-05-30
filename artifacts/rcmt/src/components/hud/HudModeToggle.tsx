/**
 * HUD MODE TOGGLE — a small two-segment pill (AERO / GUIDED) pinned to the
 * top-right of the HUD layer, just left of the Ontology card.
 *
 * AEROSPACE is the dense EFIS default for power users; GUIDED layers plain-
 * English titles + `?` help popovers onto the exact same cards. The choice
 * persists via `useHudStore.setHudMode` (localStorage `rcmt:hud:mode:v1`).
 */

import { useHudStore, type HudMode } from "../../store/useHudStore";
import { COLOR, FONT } from "./tokens";

const SEGMENTS: { mode: HudMode; label: string }[] = [
  { mode: "aerospace", label: "AERO" },
  { mode: "guided", label: "GUIDED" },
];

export function HudModeToggle() {
  const hudMode = useHudStore((s) => s.hudMode);
  const setHudMode = useHudStore((s) => s.setHudMode);

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 326,
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        gap: 6,
        fontFamily: FONT,
      }}
    >
      <span style={{ color: COLOR.textMuted, fontSize: 8.5, letterSpacing: 1 }}>
        HUD
      </span>
      <div
        style={{
          display: "flex",
          border: `1px solid ${COLOR.border}`,
          borderRadius: 2,
          overflow: "hidden",
          background: COLOR.bg,
          backdropFilter: "blur(3px)",
        }}
      >
        {SEGMENTS.map(({ mode, label }) => {
          const active = hudMode === mode;
          return (
            <button
              key={mode}
              type="button"
              onClick={() => setHudMode(mode)}
              aria-pressed={active}
              style={{
                border: "none",
                background: active ? COLOR.accent : "transparent",
                color: active ? COLOR.bgSolid : COLOR.textDim,
                cursor: "pointer",
                fontFamily: "inherit",
                fontSize: 9,
                letterSpacing: 0.8,
                padding: "3px 9px",
                lineHeight: 1.2,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
