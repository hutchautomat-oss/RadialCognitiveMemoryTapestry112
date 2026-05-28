import { useRef, useCallback } from "react";
import { useStore } from "../store/useStore";

export function Timeline() {
  const timelinePos = useStore((s) => s.timelinePos);
  const setTimelinePos = useStore((s) => s.setTimelinePos);
  const snapshots = useStore((s) => s.snapshots);
  const nodes = useStore((s) => s.nodes);
  const trackRef = useRef<HTMLDivElement>(null);

  const seek = useCallback(
    (clientX: number) => {
      if (!trackRef.current) return;
      const rect = trackRef.current.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      setTimelinePos(ratio);
    },
    [setTimelinePos],
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

  // Format timestamp for display
  const earliest = snapshots[0]?.timestamp;
  const latest = snapshots[snapshots.length - 1]?.timestamp;
  const currentTs = earliest
    ? earliest + (latest - earliest) * timelinePos
    : Date.now();

  function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  }

  const pct = Math.round(timelinePos * 100);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        background: "rgba(0,0,0,0.88)",
        borderTop: "1px solid #00ffff30",
        padding: "8px 20px 10px",
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        fontSize: 11,
        zIndex: 100,
        backdropFilter: "blur(4px)",
        boxShadow: "0 -4px 24px #00ffff10",
      }}
    >
      {/* Labels row */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
          color: "#00ffff80",
        }}
      >
        <span style={{ color: "#00ffff", textShadow: "0 0 6px #00ffff" }}>
          ⟪ SACCADE TIMELINE PLAYBACK
        </span>
        <span>
          <span style={{ color: "#ffffff40" }}>{nodes.length} NODES  •  </span>
          <span style={{ color: "#00ff41" }}>T+{pct}%</span>
          <span style={{ color: "#ffffff40" }}>  {snapshots.length} snapshots</span>
        </span>
        <span style={{ color: "#00ffff80" }}>
          {formatTime(currentTs)} ⟫
        </span>
      </div>

      {/* Track */}
      <div
        ref={trackRef}
        onMouseDown={onMouseDown}
        onTouchStart={onTouchStart}
        style={{
          position: "relative",
          height: 16,
          cursor: "ew-resize",
          userSelect: "none",
        }}
      >
        {/* Rail */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: 2,
            transform: "translateY(-50%)",
            background: "#00ffff18",
            borderRadius: 1,
          }}
        />

        {/* Snapshot tick marks */}
        {snapshots.map((snap, i) => {
          const tickPct =
            snapshots.length > 1 ? i / (snapshots.length - 1) : 0;
          return (
            <div
              key={snap.timestamp}
              style={{
                position: "absolute",
                top: "50%",
                left: `${tickPct * 100}%`,
                width: 1,
                height: 8,
                transform: "translate(-50%, -50%)",
                background: "#00ffff30",
              }}
            />
          );
        })}

        {/* Fill */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            width: `${timelinePos * 100}%`,
            height: 2,
            transform: "translateY(-50%)",
            background: "linear-gradient(90deg, #00ffff80, #00ffff)",
            borderRadius: 1,
            boxShadow: "0 0 6px #00ffff",
          }}
        />

        {/* Thumb */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: `${timelinePos * 100}%`,
            width: 14,
            height: 14,
            transform: "translate(-50%, -50%)",
            background: "#000",
            border: "2px solid #00ffff",
            borderRadius: "50%",
            boxShadow: "0 0 10px #00ffff, 0 0 20px #00ffff60",
            cursor: "grab",
          }}
        />
      </div>

      {/* Sub-labels */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 4,
          color: "#ffffff25",
          fontSize: 9,
        }}
      >
        <span>GENESIS</span>
        <span style={{ color: "#00ffff40" }}>◀ SCRUB ▶</span>
        <span>NOW</span>
      </div>
    </div>
  );
}
