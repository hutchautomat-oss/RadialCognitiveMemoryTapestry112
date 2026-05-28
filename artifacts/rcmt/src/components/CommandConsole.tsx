import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useStore } from "../store/useStore";
import { useSaccadeStore, TIER_CAPS } from "../store/useSaccadeStore";
import { NetworkManager } from "../network/NetworkManager";
import { OnnxWorker, colorForSlot, type OnnxStatus } from "../workers/OnnxWorkerManager";

const MAX_LOG = 12;
const SLOT_LABELS = ["FACT", "SCENARIO", "METRIC", "THEORY", "DREAM"];
const SHORT_LABELS = ["Fact", "Scenario", "Metric", "Theory", "Dream"];

export function CommandConsole() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<string[]>([
    "> RCMT PLATINUM MONOLITH v5.0 — ONLINE",
    "> Sync core connected. Fibonacci lattice initialized.",
    "> Booting ONNX intent classifier (MiniLM-L6-v2)…",
    "> Type a memory, fact, or idea — press ENTER to inject.",
  ]);
  const [isConnected, setIsConnected] = useState(false);
  const [engineStatus, setEngineStatus] = useState<OnnxStatus>("IDLE");
  const [lastLatency, setLastLatency] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const inFlightRef = useRef(false);
  const addNode = useStore((s) => s.addNode);
  const isLassoMode = useStore((s) => s.isLassoMode);
  const setLassoMode = useStore((s) => s.setLassoMode);
  // VRAM-aware selection (lasso writes here via the BVH hit-test).
  const selectedSlots = useSaccadeStore((s) => s.selectedSlots);
  const blastSelectedSlots = useSaccadeStore((s) => s.blastSelectedSlots);
  // Pulses every time a lasso completes — drives the console log line below.
  const lassoEventTick = useSaccadeStore((s) => s.lassoEventTick);
  const lassoEventCount = useSaccadeStore((s) => s.lassoEventCount);
  // Live per-tier occupancy. Reflects the 8k VRAM buffer, not the retiring
  // legacy graph. tierCounts is 0-based (index 0 = Fact = slot 1).
  const tierCounts = useSaccadeStore((s) => s.tierCounts);
  const nodeCount = tierCounts.reduce((a, b) => a + b, 0);

  // Emit "> LASSO captured N slots" whenever a lasso completes. Tick-driven
  // so successive lassos with the same count still log each time.
  useEffect(() => {
    if (lassoEventTick === 0) return;
    setLog((prev) => [
      ...prev.slice(-(MAX_LOG - 1)),
      `> LASSO captured ${lassoEventCount} slots`,
    ]);
  }, [lassoEventTick, lassoEventCount]);

  useEffect(() => {
    const id = setInterval(() => {
      setIsConnected(NetworkManager.isConnected);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Boot ONNX worker once on mount; reflect status into the console log.
  useEffect(() => {
    OnnxWorker.onStatusChange = (p) => {
      setEngineStatus(p.status);
      if (p.status === "LOADING" && p.message) {
        setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), `> ⟳ ${p.message}`]);
      }
      if (p.status === "READY") {
        setLog((prev) => [
          ...prev.slice(-(MAX_LOG - 1)),
          `> ✓ Intent engine ONLINE — ${p.message ?? ""}`,
        ]);
      }
      if (p.status === "ERROR") {
        setLog((prev) => [
          ...prev.slice(-(MAX_LOG - 1)),
          `> ERROR: ONNX engine failed — ${p.error ?? "unknown"} (fallback heuristic active)`,
        ]);
      }
    };
    OnnxWorker.initialize();
    return () => {
      OnnxWorker.onStatusChange = null;
    };
  }, []);

  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [log]);

  function pushLog(line: string) {
    setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), line]);
  }

  function handleSubmit() {
    const text = input.trim();
    if (!text) return;

    if (text.startsWith("/lasso")) {
      setLassoMode(!isLassoMode);
      pushLog(`> LASSO MODE ${!isLassoMode ? "ARMED — draw on canvas" : "DISARMED"}`);
      setInput("");
      return;
    }

    if (text.startsWith("/blast")) {
      if (selectedSlots.size === 0) {
        pushLog("> ERROR: No slots selected. Use lasso first.");
      } else {
        const purged = blastSelectedSlots();
        pushLog(`> BLAST purged ${purged} slots — returned to FIFO`);
      }
      setInput("");
      return;
    }

    if (text.startsWith("/clear")) {
      setLog(["> Console cleared."]);
      setInput("");
      return;
    }

    if (text.startsWith("/help")) {
      pushLog("> Commands: /lasso  /blast  /clear  /help");
      pushLog("> Or type any text to inject a memory node.");
      setInput("");
      return;
    }

    // Legacy node graph (kept for backwards-compat with NodeCloud renderer)
    addNode(text);

    // Sync peers immediately on the legacy graph node
    const nodes = useStore.getState().nodes;
    const newNode = nodes[nodes.length - 1];
    if (newNode) {
      NetworkManager.broadcastNodeUpdate(
        newNode.index,
        newNode.position[0],
        newNode.position[1],
        newNode.position[2],
        newNode.certainty,
      );
    }

    // Clear input first for snappy UX, then fire async classification.
    const preview = text.slice(0, 48) + (text.length > 48 ? "…" : "");
    setInput("");

    if (inFlightRef.current) {
      pushLog(`> QUEUED: "${preview}" (engine busy)`);
      return;
    }
    inFlightRef.current = true;

    void (async () => {
      try {
        const { slot, latencyMs, embedding } = await OnnxWorker.classify(text);
        const color = colorForSlot(slot);
        const vramIdx = useSaccadeStore
          .getState()
          .injectLiveIntentVector({
            slot,
            textLength: text.length,
            colorRGB: color,
            embedding,
          });

        setLastLatency(latencyMs);
        const label = SLOT_LABELS[slot - 1] ?? "?";
        const tag = latencyMs > 0 ? `[${label} ${latencyMs.toFixed(0)}ms]` : `[${label} heuristic]`;
        if (vramIdx === null) {
          pushLog(`> ${tag} FULL — "${preview}" (tier ${slot} cap reached)`);
        } else {
          pushLog(`> ${tag} → slot ${slot} @ vram[${vramIdx}]: "${preview}"`);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        pushLog(`> ERROR: classify failed — ${msg}`);
      } finally {
        inFlightRef.current = false;
      }
    })();
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 16,
        left: 16,
        width: 360,
        background: "rgba(0,0,0,0.85)",
        border: "1px solid #00ffff40",
        borderRadius: 4,
        fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        fontSize: 11,
        zIndex: 100,
        backdropFilter: "blur(4px)",
        boxShadow: "0 0 24px #00ffff20, inset 0 0 12px #00000060",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "6px 10px",
          borderBottom: "1px solid #00ffff30",
          background: "rgba(0,255,255,0.04)",
        }}
      >
        <span style={{ color: "#00ffff", textShadow: "0 0 8px #00ffff" }}>
          ⬡ COMMAND CONSOLE
        </span>
        <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span
            style={{
              color:
                engineStatus === "READY" || engineStatus === "CLASSIFY_COMPLETE"
                  ? "#00ff41"
                  : engineStatus === "ERROR"
                    ? "#ff4444"
                    : "#ffaa00",
              fontSize: 10,
              textShadow: "0 0 4px currentColor",
            }}
            title={lastLatency !== null ? `last classify ${lastLatency.toFixed(0)}ms` : engineStatus}
          >
            ⌬{engineStatus === "READY" || engineStatus === "CLASSIFY_COMPLETE"
              ? lastLatency !== null
                ? ` ${lastLatency.toFixed(0)}ms`
                : " ONNX"
              : engineStatus === "LOADING"
                ? " DL"
                : engineStatus === "COMPILING"
                  ? " WARM"
                  : engineStatus === "ERROR"
                    ? " ERR"
                    : " ···"}
          </span>
          <span style={{ color: "#ffffff50", fontSize: 10 }}>
            {nodeCount}/{8000} NODES
          </span>
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: isConnected ? "#00ff41" : "#ff4444",
              boxShadow: isConnected
                ? "0 0 6px #00ff41"
                : "0 0 6px #ff4444",
            }}
          />
          <span style={{ color: isConnected ? "#00ff41" : "#ff4444", fontSize: 10 }}>
            {isConnected ? "SYNC" : "LOCAL"}
          </span>
        </span>
      </div>

      {/* Per-tier occupancy — Task #3 visibility for the foveated caches. */}
      <div
        style={{
          padding: "4px 10px",
          borderBottom: "1px solid #00ffff20",
          color: "#00ffff80",
          fontSize: 10,
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
        }}
      >
        <span style={{ color: "#00ffff", opacity: 0.6 }}>{">"} Slots —</span>
        {SHORT_LABELS.map((label, i) => (
          <span key={label} style={{ whiteSpace: "nowrap" }}>
            {label}: {tierCounts[i] ?? 0}/{TIER_CAPS[i]}
            {i < SHORT_LABELS.length - 1 ? " ·" : ""}
          </span>
        ))}
      </div>

      {/* Log */}
      <div
        ref={logRef}
        style={{
          padding: "6px 10px",
          height: 140,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 2,
        }}
      >
        {log.map((line, i) => (
          <div
            key={i}
            style={{
              color: line.startsWith("> ERROR") ? "#ff4444" : "#00ff41",
              textShadow: line.startsWith("> RCMT")
                ? "0 0 8px #00ff41"
                : undefined,
              opacity: 0.5 + 0.5 * (i / log.length),
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
            }}
          >
            {line}
          </div>
        ))}
        {/* blinking cursor */}
        <div style={{ color: "#00ff41", animation: "blink 1s step-end infinite" }}>
          ▮
        </div>
      </div>

      {/* Input */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderTop: "1px solid #00ffff30",
          padding: "4px 10px",
          gap: 6,
        }}
      >
        <span style={{ color: "#00ffff", textShadow: "0 0 6px #00ffff" }}>›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="inject memory… (/help for commands)"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: "#00ff41",
            fontFamily: "inherit",
            fontSize: 11,
            caretColor: "#00ff41",
          }}
        />
        {isLassoMode && (
          <span
            style={{
              color: "#ff8800",
              fontSize: 10,
              textShadow: "0 0 6px #ff8800",
              animation: "blink 0.6s step-end infinite",
            }}
          >
            LASSO
          </span>
        )}
      </div>

      <style>{`
        @keyframes blink { 50% { opacity: 0; } }
      `}</style>
    </div>
  );
}
