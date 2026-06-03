/**
 * CommandDock — HUD layout B.
 *
 * A single fixed bottom bar (the "cockpit"). Nothing floats over the lattice
 * unless the coder summons it. Six panel slots surround a center console pill:
 *
 *   [ONTOLOGY] [SYNC] [EVENTS] | rcmt › ___  ⌘K | [INV] [CAM] [TELEM]
 *
 * Clicking a slot icon toggles the panel open above that icon. Only one panel
 * is open at a time (clicking a second one closes the first). The console pill
 * in the center is always accessible — tap it or press ⌘K to focus.
 *
 * Drive/Work mode toggle lives as a small pill on the far right of the dock.
 *
 * This component REPLACES the individual floating HUD cards. App.tsx mounts
 * only <CommandDock /> instead of the six separate cards + HudModeToggle.
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useHudStore, type HudEventType } from "../../store/useHudStore";
import { useSaccadeStore, TIER_CAPS, STRIDE, MAX_NODES, PROMOTION_ANIM_MS } from "../../store/useSaccadeStore";
import { injectPhrase, embedQuery } from "../../lib/injectPhrase";
import { downloadTapestry, loadTapestryFromFile, scheduleAutosave } from "../../lib/tapestryPersist";
import { AXIOMS } from "../../data/corpus";
import { NetworkManager } from "../../network/NetworkManager";
import { OnnxWorker } from "../../workers/OnnxWorkerManager";
import { COLOR, FONT, TIER_NAMES } from "./tokens";

// ── Types ──────────────────────────────────────────────────────────────────
type PanelId = "ontology" | "sync" | "events" | "invariants" | "camera" | "telemetry" | null;

// ── Constants ──────────────────────────────────────────────────────────────
const DOCK_H = 44;
const PANEL_W = 340;
const VALID_EVENT_TYPES: HudEventType[] = [
  "SPAWN", "REINFORCE", "PROMOTE", "EVICT", "LWW_REJECT", "LOW_CONF",
  "INVARIANT_FAIL", "AXIOM", "INFO", "PAUSE", "RESUME", "ERROR",
];
const MAX_LOG = 40;
const FIND_THRESHOLD = 0.3;
const FIND_TOPK = 8;

// ── Dock shell styles ───────────────────────────────────────────────────────
const dockStyle: React.CSSProperties = {
  position: "fixed",
  bottom: 0,
  left: 0,
  right: 0,
  height: DOCK_H,
  background: "rgba(8,10,12,0.95)",
  borderTop: `1px solid ${COLOR.border}`,
  display: "flex",
  alignItems: "center",
  fontFamily: FONT,
  zIndex: 200,
  backdropFilter: "blur(6px)",
  userSelect: "none",
};

const iconBtnStyle = (active: boolean): React.CSSProperties => ({
  width: 44,
  height: DOCK_H,
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 2,
  cursor: "pointer",
  background: active ? "rgba(79,209,197,0.08)" : "transparent",
  borderTop: active ? `2px solid ${COLOR.accent}` : "2px solid transparent",
  color: active ? COLOR.accent : COLOR.textDim,
  fontSize: 8,
  letterSpacing: 0.6,
  transition: "color 0.15s, background 0.15s",
  flexShrink: 0,
});

const panelStyle: React.CSSProperties = {
  position: "absolute",
  bottom: DOCK_H,
  background: "rgba(8,10,12,0.96)",
  border: `1px solid ${COLOR.border}`,
  borderRadius: "2px 2px 0 0",
  fontFamily: FONT,
  fontSize: 10.5,
  color: COLOR.text,
  backdropFilter: "blur(6px)",
  zIndex: 199,
  overflowY: "auto",
  maxHeight: "60vh",
};

// ── Icon glyphs (ASCII safe) ────────────────────────────────────────────────
const ICONS: Record<Exclude<PanelId, null>, string> = {
  ontology:   "◉",
  sync:       "⇄",
  events:     "≡",
  invariants: "✦",
  camera:     "⊙",
  telemetry:  "▲",
};

// ── Panel renderers ─────────────────────────────────────────────────────────

function OntologyPanel() {
  const { invariants, net, ticker } = useHudStore();
  const tierCounts = useSaccadeStore((s) => s.tierCounts);
  const total = tierCounts.reduce((a, b) => a + b, 0);
  return (
    <div style={{ ...panelStyle, left: 0, width: PANEL_W, padding: "10px 12px" }}>
      <div style={{ color: COLOR.textDim, fontSize: 9, letterSpacing: 0.8, marginBottom: 8 }}>ONTOLOGY · {total}/{MAX_NODES}</div>
      {TIER_NAMES.map((name, i) => {
        const cap = TIER_CAPS[i];
        const count = tierCounts[i] ?? 0;
        const pct = cap > 0 ? count / cap : 0;
        return (
          <div key={name} style={{ marginBottom: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
              <span style={{ color: COLOR.tier[i], fontSize: 9 }}>{name}</span>
              <span style={{ color: COLOR.textDim, fontSize: 9 }}>{count} / {cap}</span>
            </div>
            <div style={{ height: 3, background: COLOR.border, borderRadius: 1 }}>
              <div style={{ height: 3, width: `${pct * 100}%`, background: COLOR.tier[i], borderRadius: 1, transition: "width 0.4s" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SyncPanel() {
  const { net, ticker, invariants } = useHudStore();
  const onnxStatus = OnnxWorker.currentStatus;
  const row = (label: string, val: string, color?: string) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
      <span style={{ color: COLOR.textDim, fontSize: 9 }}>{label}</span>
      <span style={{ color: color ?? COLOR.text, fontSize: 9 }}>{val}</span>
    </div>
  );
  return (
    <div style={{ ...panelStyle, left: 44, width: PANEL_W, padding: "10px 12px" }}>
      <div style={{ color: COLOR.textDim, fontSize: 9, letterSpacing: 0.8, marginBottom: 8 }}>SYNC CORE</div>
      {row("LINK", net.connected ? "OPEN" : "CLOSED", net.connected ? COLOR.nominal : COLOR.fail)}
      {row("PEER", net.peerId >= 0 ? `#${net.peerId}` : "—")}
      {row("PKT IN", `${net.packetsIn} (${net.packetsInRate.toFixed(1)}/s)`)}
      {row("PKT OUT", `${net.packetsOut} (${net.packetsOutRate.toFixed(1)}/s)`)}
      {row("ENGINE", onnxStatus)}
      {row("TICKER", ticker.running ? (ticker.autoPaused ? "IDLE" : "AUTO") : "PAUSE", ticker.running ? COLOR.nominal : COLOR.warn)}
    </div>
  );
}

function EventsPanel() {
  const { events } = useHudStore();
  const recent = events.slice(-22);
  return (
    <div style={{ ...panelStyle, left: 88, width: PANEL_W + 40, padding: "10px 12px" }}>
      <div style={{ color: COLOR.textDim, fontSize: 9, letterSpacing: 0.8, marginBottom: 8 }}>EVENT STREAM · {events.length}/500</div>
      {recent.length === 0 && <div style={{ color: COLOR.textMuted, fontSize: 9 }}>no events yet</div>}
      {recent.map((ev, i) => (
        <div key={i} style={{ display: "flex", gap: 6, marginBottom: 2, fontSize: 9 }}>
          <span style={{ color: COLOR.accentDim, minWidth: 56 }}>{ev.type}</span>
          <span style={{ color: COLOR.textDim }}>{ev.phrase ? ev.phrase.slice(0, 28) : ""}</span>
          <span style={{ color: COLOR.textMuted, marginLeft: "auto" }}>{ev.detail?.slice(0, 22) ?? ""}</span>
        </div>
      ))}
    </div>
  );
}

function InvariantsPanel() {
  const { invariants } = useHudStore();
  return (
    <div style={{ ...panelStyle, right: 88, width: PANEL_W, padding: "10px 12px" }}>
      <div style={{ color: COLOR.textDim, fontSize: 9, letterSpacing: 0.8, marginBottom: 8 }}>INVARIANTS</div>
      {Object.entries(invariants).map(([id, st]) => (
        <div key={id} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: st.ok ? COLOR.nominal : COLOR.fail, flexShrink: 0 }} />
          <span style={{ color: COLOR.textDim, fontSize: 9, minWidth: 80 }}>{id}</span>
          <span style={{ color: st.ok ? COLOR.textDim : COLOR.fail, fontSize: 9 }}>{st.detail}</span>
        </div>
      ))}
    </div>
  );
}

function CameraPanel() {
  const { camera, fps } = useHudStore();
  const row = (label: string, val: string) => (
    <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
      <span style={{ color: COLOR.textDim, fontSize: 9 }}>{label}</span>
      <span style={{ color: COLOR.text, fontSize: 9 }}>{val}</span>
    </div>
  );
  return (
    <div style={{ ...panelStyle, right: 44, width: 220, padding: "10px 12px" }}>
      <div style={{ color: COLOR.textDim, fontSize: 9, letterSpacing: 0.8, marginBottom: 8 }}>CAMERA</div>
      {row("POS", `(${camera?.px?.toFixed(1) ?? "\u2014"}, ${camera?.py?.toFixed(1) ?? "\u2014"}, ${camera?.pz?.toFixed(1) ?? "\u2014"})`)}
      {row("DIST", `${camera?.distance?.toFixed(1) ?? "\u2014"}`)}
      {row("AZ", "\u2014")}
      {row("EL", "\u2014")}
      {row("FPS", `${fps?.toFixed(0) ?? "\u2014"}`)}
    </div>
  );
}

function TelemetryPanel() {
  const tierCounts = useSaccadeStore((s) => s.tierCounts);
  const total = tierCounts.reduce((a, b) => a + b, 0);
  const { net } = useHudStore();
  return (
    <div style={{ ...panelStyle, right: 0, width: 200, padding: "10px 12px" }}>
      <div style={{ color: COLOR.textDim, fontSize: 9, letterSpacing: 0.8, marginBottom: 8 }}>TELEMETRY</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ color: COLOR.textDim, fontSize: 9 }}>NODES</span>
        <span style={{ color: COLOR.text, fontSize: 9 }}>{total} / {MAX_NODES}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
        <span style={{ color: COLOR.textDim, fontSize: 9 }}>PKT RATE</span>
        <span style={{ color: COLOR.text, fontSize: 9 }}>{(net.packetsInRate + net.packetsOutRate).toFixed(1)}/s</span>
      </div>
    </div>
  );
}

// ── Console pill ────────────────────────────────────────────────────────────

function ConsolePill() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<string[]>(["rcmt ready · type a phrase or /help"]);
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const findSeqRef = useRef(0);
  const isLassoMode = useSaccadeStore((s) => s.isLassoMode);
  const setLassoMode = useSaccadeStore((s) => s.setLassoMode);
  const selectedSlots = useSaccadeStore((s) => s.selectedSlots);
  const blastSelectedSlots = useSaccadeStore((s) => s.blastSelectedSlots);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  // ⌘K / Ctrl+K global shortcut to focus
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  function pushLog(line: string) {
    setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), line]);
  }

  async function handleSubmit() {
    const text = input.trim();
    if (!text) return;
    setInput("");
    if (text.startsWith("/")) { handleSlash(text); return; }
    pushLog(`> ${text.length > 64 ? text.slice(0, 61) + "…" : text}`);
    try {
      const r = await injectPhrase(text, "console");
      if (r.kind === "rejected") {
        pushLog(" rejected — tier full");
      } else {
        pushLog(` ${r.kind.padEnd(9)} vram[${r.vramIndex}] · ${r.latencyMs.toFixed(0)}ms`);
      }
    } catch (err) {
      pushLog(` ERROR: ${(err as Error).message}`);
    }
  }

  function handleSlash(text: string) {
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ");
    const hud = useHudStore.getState();
    switch (cmd) {
      case "/help":
        pushLog("/help /clear /pause /resume /rate <ms> /save /load /find <text> /lasso /blast /why <slot> /axioms /axiom-seed /invariants /events /tour");
        break;
      case "/clear":
        findSeqRef.current++;
        useSaccadeStore.getState().clearSearch();
        setLog(["console cleared"]);
        break;
      case "/pause": hud.setTickerRunning(false); pushLog("ticker paused"); break;
      case "/resume": hud.setTickerRunning(true); pushLog("ticker resumed"); break;
      case "/rate": {
        const n = parseInt(arg, 10);
        if (isNaN(n) || n < 250 || n > 30000) { pushLog(`rate must be 250..30000 ms`); }
        else { hud.setTickerPeriod(n); pushLog(`ticker period ${n}ms`); }
        break;
      }
      case "/lasso": setLassoMode(!isLassoMode); pushLog(`lasso ${!isLassoMode ? "armed" : "disarmed"}`); break;
      case "/blast": {
        if (selectedSlots.size === 0) { pushLog("no selection — /lasso first"); }
        else { pushLog(`blast purged ${blastSelectedSlots()} slots`); }
        break;
      }
      case "/save":
        try { downloadTapestry(); pushLog("sovereign_save_key.bin triggered"); }
        catch (err) { pushLog(` ERROR: ${(err as Error).message}`); }
        break;
      case "/load": {
        const fi = document.createElement("input");
        fi.type = "file"; fi.accept = ".bin,application/octet-stream";
        fi.onchange = async () => {
          const file = fi.files?.[0]; if (!file) return;
          pushLog(`loading ${file.name}…`);
          const result = await loadTapestryFromFile(file);
          if (result.ok) { pushLog(` loaded ${result.slotCount} slots`); scheduleAutosave(); }
          else { pushLog(` ERROR: ${result.message}`); }
        };
        fi.click();
        break;
      }
      case "/find": {
        if (!arg.trim()) { findSeqRef.current++; useSaccadeStore.getState().clearSearch(); pushLog("search cleared"); break; }
        const token = ++findSeqRef.current;
        pushLog(`searching "${arg.slice(0, 40)}"…`);
        void (async () => {
          const emb = await embedQuery(arg);
          if (token !== findSeqRef.current) return;
          if (!emb) { pushLog(" model warming — retry"); return; }
          const ranked = useSaccadeStore.getState().rankBySimilarity(emb, FIND_TOPK, FIND_THRESHOLD);
          if (token !== findSeqRef.current) return;
          if (ranked.length === 0) { useSaccadeStore.getState().clearSearch(); pushLog(" no match"); return; }
          useSaccadeStore.getState().setSearchMatches(ranked);
          pushLog(` ${ranked.length} match${ranked.length > 1 ? "es" : ""}`);
        })();
        break;
      }
      case "/invariants": {
        const inv = hud.invariants;
        for (const [id, st] of Object.entries(inv)) pushLog(` ${st.ok ? "OK" : "FAIL"} ${id.padEnd(16)} ${st.detail}`);
        break;
      }
      case "/axioms": AXIOMS.forEach((a, i) => pushLog(` [${i}] ${a.slice(0, 60)}`)); break;
      case "/axiom-seed":
        pushLog(`seeding ${AXIOMS.length} axioms…`);
        void (async () => { for (const a of AXIOMS) try { await injectPhrase(a, "axiom"); } catch {} pushLog("axiom seed done"); })();
        break;
      case "/events": {
        const ev = hud.events.slice(-8);
        ev.forEach((e) => pushLog(` [${e.type}] ${e.phrase ?? ""} ${e.detail ?? ""}`.trim()));
        break;
      }
      case "/tour": hud.setOnboardingOpen(true); pushLog("opening tour…"); break;
      default: pushLog(`unknown: ${cmd} (/help)`);
    }
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
      {/* Log drawer above the pill */}
      {open && (
        <div style={{
          position: "absolute",
          bottom: DOCK_H,
          left: "50%",
          transform: "translateX(-50%)",
          width: 540,
          maxHeight: 220,
          overflowY: "auto",
          background: "rgba(8,10,12,0.96)",
          border: `1px solid ${COLOR.border}`,
          borderRadius: "2px 2px 0 0",
          padding: "8px 12px",
          fontFamily: FONT,
          fontSize: 10,
          color: COLOR.text,
          zIndex: 199,
        }} ref={logRef}>
          {log.map((line, i) => (
            <div key={i} style={{ color: line.includes("ERROR") ? COLOR.fail : line.startsWith(">") ? COLOR.accent : COLOR.textDim, whiteSpace: "pre-wrap" }}>
              {line}
            </div>
          ))}
        </div>
      )}
      {/* Pill */}
      <div
        onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50); }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: open ? "rgba(79,209,197,0.06)" : "rgba(255,255,255,0.03)",
          border: `1px solid ${open ? COLOR.accentDim : COLOR.border}`,
          borderRadius: 3,
          padding: "4px 12px",
          cursor: "text",
          minWidth: 280,
          height: 28,
        }}
      >
        <span style={{ color: COLOR.accent, fontSize: 11 }}>rcmt</span>
        <span style={{ color: COLOR.accentDim, fontSize: 11 }}>›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          onFocus={() => setOpen(true)}
          placeholder={open ? "" : "type a memory · ⌘K"}
          autoComplete="off"
          spellCheck={false}
          style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: COLOR.text, fontFamily: FONT, fontSize: 10.5, caretColor: COLOR.accent }}
        />
        {isLassoMode && <span style={{ color: COLOR.warn, fontSize: 8 }}>LASSO</span>}
      </div>
    </div>
  );
}

// ── Mode toggle pill ────────────────────────────────────────────────────────
function ModePill() {
  const cameraMode = useHudStore((s) => s.cameraMode);
  const setCameraMode = useHudStore((s) => s.setCameraMode);
  const drive = cameraMode === "drive";
  return (
    <div
      onClick={() => setCameraMode(drive ? "work" : "drive")}
      title={drive ? "Switch to WORK mode (select/inspect)" : "Switch to DRIVE mode (dive into lattice)"}
      style={{
        display: "flex", alignItems: "center", gap: 5, padding: "4px 10px",
        marginRight: 8, cursor: "pointer",
        background: drive ? "rgba(79,209,197,0.1)" : "rgba(255,255,255,0.03)",
        border: `1px solid ${drive ? COLOR.accentDim : COLOR.border}`,
        borderRadius: 3, height: 26,
      }}
    >
      <span style={{ fontSize: 10, color: drive ? COLOR.accent : COLOR.textDim, fontFamily: FONT }}>
        {drive ? "⬡ DRIVE" : "⊞ WORK"}
      </span>
    </div>
  );
}

// ── Main CommandDock ────────────────────────────────────────────────────────
export function CommandDock() {
  const [activePanel, setActivePanel] = useState<PanelId>(null);

  function toggle(id: Exclude<PanelId, null>) {
    setActivePanel((prev) => (prev === id ? null : id));
  }

  const leftPanels: Array<{ id: Exclude<PanelId, null>; label: string }> = [
    { id: "ontology", label: "ONT" },
    { id: "sync", label: "SYNC" },
    { id: "events", label: "EVT" },
  ];
  const rightPanels: Array<{ id: Exclude<PanelId, null>; label: string }> = [
    { id: "invariants", label: "INV" },
    { id: "camera", label: "CAM" },
    { id: "telemetry", label: "TELEM" },
  ];

  return (
    <>
      {/* Active panel floating above dock */}
      {activePanel === "ontology"   && <OntologyPanel />}
      {activePanel === "sync"       && <SyncPanel />}
      {activePanel === "events"     && <EventsPanel />}
      {activePanel === "invariants" && <InvariantsPanel />}
      {activePanel === "camera"     && <CameraPanel />}
      {activePanel === "telemetry"  && <TelemetryPanel />}

      {/* The dock bar */}
      <div style={dockStyle}>
        {/* Left icon cluster */}
        {leftPanels.map(({ id, label }) => (
          <div key={id} style={iconBtnStyle(activePanel === id)} onClick={() => toggle(id)} title={id.toUpperCase()}>
            <span style={{ fontSize: 14 }}>{ICONS[id]}</span>
            <span style={{ fontSize: 7.5, letterSpacing: 0.5 }}>{label}</span>
          </div>
        ))}

        {/* Center console pill */}
        <ConsolePill />

        {/* Right icon cluster */}
        {rightPanels.map(({ id, label }) => (
          <div key={id} style={iconBtnStyle(activePanel === id)} onClick={() => toggle(id)} title={id.toUpperCase()}>
            <span style={{ fontSize: 14 }}>{ICONS[id]}</span>
            <span style={{ fontSize: 7.5, letterSpacing: 0.5 }}>{label}</span>
          </div>
        ))}

        {/* Drive/Work mode toggle */}
        <ModePill />
      </div>
    </>
  );
}
