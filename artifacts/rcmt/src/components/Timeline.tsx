import { useRef, useCallback } from "react";
import { useSaccadeStore, TIER_CAPS } from "../store/useSaccadeStore";
import { COLOR, FONT } from "./hud/tokens";

export function Timeline() {
  const trackRef = useRef<HTMLDivElement>(null);

  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const totalFrames      = useSaccadeStore((s) => s.totalFrames);
  const setFrameIndex    = useSaccadeStore((s) => s.setFrameIndex);
  const isFileLoaded     = useSaccadeStore((s) => s.isFileLoaded);
  const tierCounts       = useSaccadeStore((s) => s.tierCounts);

  // Total live slots = sum of per-tier occupancy. Demo seed pre-fills the
  // Fact tier so this reads ~1334/8000 from boot, matching the legacy graph's
  // first-load count.
  const liveSlotCount = tierCounts.reduce((a, b) => a + b, 0);
  // Tier cap sanity-check (silences the unused-import warning and surfaces a
  // misconfiguration immediately if TIER_CAPS ever drifts from MAX_NODES).
  const _maxSlots = TIER_CAPS.reduce((a, b) => a + b, 0);

  // Unified timeline position (0–1). In live mode there's a single mutable
  // frame, so the scrubber pins to NOW. In binary mode it spans the file.
  const effectiveTotal = Math.max(1, totalFrames);
  const timelinePos    = effectiveTotal > 1 ? activeFrameIndex / (effectiveTotal - 1) : 1;

  const seek = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const targetFrame = Math.round(ratio * (effectiveTotal - 1));
      setFrameIndex(targetFrame);
    },
    [effectiveTotal, setFrameIndex],
  );

  function onMouseDown(e: React.MouseEvent) {
    seek(e.clientX);
    const onMove = (me: MouseEvent) => seek(me.clientX);
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }
  function onTouchStart(e: React.TouchEvent) {
    seek(e.touches[0].clientX);
    const onMove = (te: TouchEvent) => seek(te.touches[0].clientX);
    const onEnd = () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
    window.addEventListener("touchmove", onMove);
    window.addEventListener("touchend", onEnd);
  }

  const pct = Math.round(timelinePos * 100);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const { loadFile, initWorker, workerReady } = useSaccadeStore.getState();
    if (!workerReady) initWorker();
    loadFile(file);
  }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); }

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: COLOR.bg,
        borderTop: `1px solid ${COLOR.border}`,
        padding: "8px 18px 10px",
        fontFamily: FONT,
        fontSize: 10,
        color: COLOR.text,
        zIndex: 100,
        backdropFilter: "blur(3px)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          color: COLOR.textDim,
          fontSize: 9.5,
          letterSpacing: 0.8,
        }}
      >
        <span style={{ color: COLOR.text }}>SACCADE TIMELINE</span>
        <span>
          <span style={{ color: COLOR.textMuted }}>
            {liveSlotCount}/{_maxSlots} SLOTS · frame {activeFrameIndex + 1}/{effectiveTotal} ·{" "}
          </span>
          <span style={{ color: isFileLoaded ? COLOR.warn : COLOR.nominal }}>
            {isFileLoaded ? "BINARY" : "LIVE"}
          </span>
          <span style={{ color: COLOR.textMuted }}> · T+{pct}%</span>
        </span>
        <span style={{ color: COLOR.textMuted, fontSize: 9 }}>
          DROP .bin TO LOAD
        </span>
      </div>

      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{
          position: "relative",
          height: 14,
          cursor: "ew-resize",
          userSelect: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 1,
            transform: "translateY(-50%)",
            background: COLOR.border,
          }}
        />
        {Array.from({ length: Math.min(effectiveTotal, 100) }).map((_, i) => {
          const tickPct = effectiveTotal > 1 ? i / (Math.min(effectiveTotal, 100) - 1) : 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                top: "50%",
                left: `${tickPct * 100}%`,
                width: 1,
                height: 5,
                transform: "translate(-50%, -50%)",
                background: COLOR.borderStrong,
              }}
            />
          );
        })}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: `${timelinePos * 100}%`,
            height: 1,
            transform: "translateY(-50%)",
            background: isFileLoaded ? COLOR.warn : COLOR.accent,
          }}
        />
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${timelinePos * 100}%`,
            width: 10,
            height: 10,
            transform: "translate(-50%, -50%)",
            background: COLOR.bgSolid,
            border: `1px solid ${isFileLoaded ? COLOR.warn : COLOR.accent}`,
            cursor: "grab",
          }}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          color: COLOR.textMuted,
          fontSize: 8.5,
          letterSpacing: 1,
        }}
      >
        <span>GENESIS</span>
        <span>SCRUB</span>
        <span>NOW</span>
      </div>
    </div>
  );
}
