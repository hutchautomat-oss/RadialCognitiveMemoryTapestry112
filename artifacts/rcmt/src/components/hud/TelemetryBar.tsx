/**
 * TELEMETRY BAR — full-width strip directly above the SACCADE TIMELINE.
 *
 * The "engineering bottom row" — a single horizontal readout consolidating
 * the live render & runtime numbers that don't fit naturally into the
 * other cards: FPS, draw calls, instanced count, active frame index,
 * ticker rate, build SHA. Designed so a glance at the bottom of the screen
 * tells you whether the render loop, the lattice, and the autonomous
 * thought ticker are still healthy.
 */

import { useHudStore } from "../../store/useHudStore";
import { useSaccadeStore } from "../../store/useSaccadeStore";
import { COLOR, FONT } from "./tokens";

// Build SHA — Vite inlines `import.meta.env.VITE_BUILD_SHA` at build time
// (set by the deploy workflow); falls back to "dev" during `pnpm dev`.
const BUILD_SHA =
  (import.meta.env.VITE_BUILD_SHA as string | undefined)?.slice(0, 7) ?? "dev";

export function TelemetryBar() {
  const fps = useHudStore((s) => s.fps);
  const drawCalls = useHudStore((s) => s.drawCalls);
  const instancedCount = useHudStore((s) => s.instancedCount);
  const ticker = useHudStore((s) => s.ticker);
  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const frameCount = useSaccadeStore((s) => s.mockFrames.length);

  const fpsColor =
    fps >= 55 ? COLOR.nominal : fps >= 40 ? COLOR.warn : COLOR.fail;

  return (
    <div
      style={{
        position: "fixed",
        left: 14,
        right: 14,
        bottom: 78,
        height: 22,
        display: "flex",
        alignItems: "center",
        gap: 18,
        padding: "0 10px",
        background: COLOR.bg,
        border: `1px solid ${COLOR.border}`,
        color: COLOR.text,
        fontFamily: FONT,
        fontSize: 10,
        letterSpacing: 0.4,
        pointerEvents: "none",
        userSelect: "none",
      }}
    >
      <Cell label="FPS" value={fps.toFixed(0)} color={fpsColor} />
      <Cell label="DRAW" value={drawCalls.toString()} />
      <Cell label="INST" value={instancedCount.toLocaleString()} />
      <Cell
        label="FRAME"
        value={`${activeFrameIndex}/${Math.max(0, frameCount - 1)}`}
      />
      <Cell
        label="TICK"
        value={
          ticker.running
            ? `${(ticker.periodMs / 1000).toFixed(1)}±${(ticker.jitterMs / 1000).toFixed(1)}s`
            : "PAUSED"
        }
        color={ticker.running ? COLOR.text : COLOR.warn}
      />
      <Cell label="Σ FIRED" value={ticker.totalFired.toString()} />
      <div style={{ flex: 1 }} />
      <Cell label="BUILD" value={BUILD_SHA} color={COLOR.accent} />
    </div>
  );
}

function Cell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <span style={{ display: "inline-flex", gap: 6, alignItems: "baseline" }}>
      <span style={{ color: COLOR.textMuted, fontSize: 9 }}>{label}</span>
      <span style={{ color: color ?? COLOR.text }}>{value}</span>
    </span>
  );
}
