import { useRef, useCallback } from "react";
import { useStore } from "../store/useStore";
import { useSaccadeStore } from "../store/useSaccadeStore";

export function Timeline() {
  const trackRef = useRef<HTMLDivElement>(null);

  // Saccade store (frame-based scrubbing)
  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const totalFrames      = useSaccadeStore((s) => s.totalFrames);
  const setFrameIndex    = useSaccadeStore((s) => s.setFrameIndex);
  const isFileLoaded     = useSaccadeStore((s) => s.isFileLoaded);

  // Live store (fallback when no binary file)
  const snapshots        = useStore((s) => s.snapshots);
  const nodes            = useStore((s) => s.nodes);

  // Unified timeline position (0–1)
  const effectiveTotal = isFileLoaded ? totalFrames : Math.max(1, snapshots.length);
  const effectiveIndex = activeFrameIndex;
  const timelinePos    = effectiveTotal > 1 ? effectiveIndex / (effectiveTotal - 1) : 1;

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

  // Drop-zone for .bin file loading
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
          <span style={{ color: "#ffffff40" }}>
            {nodes.length} NODES  •  frame {effectiveIndex + 1}/{effectiveTotal}  •{" "}
          </span>
          <span style={{ color: isFileLoaded ? "#ff8800" : "#00ff41" }}>
            {isFileLoaded ? "BINARY FILE" : "LIVE"}
          </span>
          <span style={{ color: "#ffffff40" }}>  T+{pct}%</span>
        </span>
        <span style={{ color: "#00ffff50", fontSize: 9 }}>
          DROP .bin TO LOAD ⟫
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

        {/* Snapshot ticks */}
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
                height: 6,
                transform: "translate(-50%, -50%)",
                background: "#00ffff25",
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
            border: `2px solid ${isFileLoaded ? "#ff8800" : "#00ffff"}`,
            borderRadius: "50%",
            boxShadow: isFileLoaded
              ? "0 0 10px #ff8800, 0 0 20px #ff880060"
              : "0 0 10px #00ffff, 0 0 20px #00ffff60",
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
        <span style={{ color: "#00ffff30" }}>◀ SCRUB ▶</span>
        <span>NOW</span>
      </div>
    </div>
  );
}
