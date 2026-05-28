/**
 * COMMAND CONSOLE — bottom-left card. Manual phrase injection and slash
 * commands. The user's hands-on entry point into the lattice.
 *
 * Slash commands:
 *   /help                  — list commands
 *   /clear                 — clear console log (events untouched)
 *   /pause                 — pause the autonomous ticker
 *   /resume                — resume the autonomous ticker
 *   /rate <ms>             — set ticker period in ms (250..30000)
 *   /axioms                — re-seed the 7 axioms
 *   /invariants            — dump current invariant detail to the log
 *   /events                — dump the most recent 8 events to the log
 *   /why <slot>            — show provenance for a VRAM slot
 *   /lasso                 — toggle lasso mode
 *   /blast                 — purge currently-selected slots
 *
 * Any text not starting with "/" is injected via the same `injectPhrase`
 * path the autonomous ticker uses — single source of truth for VRAM writes.
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useStore } from "../store/useStore";
import { useSaccadeStore, TIER_CAPS, STRIDE } from "../store/useSaccadeStore";
import { useHudStore } from "../store/useHudStore";
import { injectPhrase } from "../lib/injectPhrase";
import { AXIOMS } from "../data/corpus";
import { cardShell, cardHeader, COLOR, FONT, TIER_NAMES } from "./hud/tokens";

const MAX_LOG = 14;

export function CommandConsole() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<string[]>([
    "RCMT PLATINUM MONOLITH v5.1 — ONLINE",
    "ghost scaffold rendered · ticker arming · axioms pending",
    "type a phrase, or /help for commands",
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const isLassoMode = useStore((s) => s.isLassoMode);
  const setLassoMode = useStore((s) => s.setLassoMode);
  const selectedSlots = useSaccadeStore((s) => s.selectedSlots);
  const blastSelectedSlots = useSaccadeStore((s) => s.blastSelectedSlots);
  const lassoEventTick = useSaccadeStore((s) => s.lassoEventTick);
  const lassoEventCount = useSaccadeStore((s) => s.lassoEventCount);

  useEffect(() => {
    if (lassoEventTick === 0) return;
    pushLog(`lasso captured ${lassoEventCount} slots`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lassoEventTick, lassoEventCount]);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [log]);

  function pushLog(line: string) {
    setLog((prev) => [...prev.slice(-(MAX_LOG - 1)), line]);
  }

  async function handleSubmit() {
    const text = input.trim();
    if (!text) return;
    setInput("");

    if (text.startsWith("/")) {
      handleSlash(text);
      return;
    }

    pushLog(`> ${text.length > 64 ? text.slice(0, 61) + "…" : text}`);
    try {
      const r = await injectPhrase(text, "console");
      if (r.kind === "rejected") {
        pushLog(`  rejected — tier full and no eviction candidate`);
      } else {
        const tier = TIER_NAMES[Math.max(0, Math.min(4, r.slot - 1))];
        pushLog(
          `  ${r.kind.padEnd(9)} ${tier.padEnd(8)} vram[${r.vramIndex}] · ${r.latencyMs.toFixed(0)}ms · conf ${r.confidence.toFixed(2)}`,
        );
      }
    } catch (err) {
      pushLog(`  ERROR: ${(err as Error).message}`);
    }
  }

  function handleSlash(text: string) {
    const [cmd, ...rest] = text.split(/\s+/);
    const arg = rest.join(" ");
    const hud = useHudStore.getState();
    switch (cmd) {
      case "/help":
        pushLog("commands: /pause /resume /rate <ms> /axioms /invariants /events /why <slot> /lasso /blast /clear /help");
        break;
      case "/clear":
        setLog(["console cleared"]);
        break;
      case "/pause":
        hud.setTickerRunning(false);
        hud.pushEvent({ type: "PAUSE", detail: "ticker paused by user" });
        pushLog("ticker paused");
        break;
      case "/resume":
        hud.setTickerRunning(true);
        hud.pushEvent({ type: "RESUME", detail: "ticker resumed by user" });
        pushLog("ticker resumed");
        break;
      case "/rate": {
        const n = parseInt(arg, 10);
        if (isNaN(n) || n < 250 || n > 30_000) {
          pushLog(`rate must be 250..30000 ms (got ${arg || "—"})`);
        } else {
          hud.setTickerPeriod(n);
          pushLog(`ticker period set to ${n}ms`);
        }
        break;
      }
      case "/axioms":
        pushLog(`re-seeding ${AXIOMS.length} axioms…`);
        void (async () => {
          for (const a of AXIOMS) {
            try { await injectPhrase(a, "axiom"); } catch { /* logged via event */ }
          }
          pushLog("axiom re-seed complete");
        })();
        break;
      case "/invariants": {
        const inv = hud.invariants;
        for (const [id, st] of Object.entries(inv)) {
          pushLog(`  ${st.ok ? "OK" : "FAIL"}  ${id.padEnd(16)} ${st.detail}`);
        }
        break;
      }
      case "/events": {
        const ev = hud.events.slice(-8);
        if (ev.length === 0) pushLog("event ring empty");
        ev.forEach((e) => pushLog(`  [${e.type}] ${e.phrase ?? ""} ${e.detail ?? ""}`.trim()));
        break;
      }
      case "/why": {
        const slot = parseInt(arg, 10);
        if (isNaN(slot)) { pushLog("/why <slot>"); break; }
        const s = useSaccadeStore.getState();
        const frame = s.mockFrames[s.activeFrameIndex];
        if (!frame || slot < 0 || slot >= 8000) { pushLog(`slot ${arg} out of range`); break; }
        const off = slot * STRIDE;
        const mass = frame[off + 6];
        const tier = s.slotTier[slot];
        const inj = s.injectedAt[slot];
        const reinf = s.reinforcementCount[slot];
        const age = inj > 0 ? ((performance.now() - inj) / 1000).toFixed(1) + "s" : "—";
        pushLog(`  vram[${slot}] tier=${TIER_NAMES[tier - 1] ?? "?"} mass=${mass.toFixed(2)} reinf=${reinf} age=${age}`);
        pushLog(`  pos=(${frame[off].toFixed(2)}, ${frame[off + 1].toFixed(2)}, ${frame[off + 2].toFixed(2)})`);
        break;
      }
      case "/lasso":
        setLassoMode(!isLassoMode);
        pushLog(`lasso ${!isLassoMode ? "armed" : "disarmed"}`);
        break;
      case "/blast":
        if (selectedSlots.size === 0) {
          pushLog("no selection — use /lasso first");
        } else {
          const n = blastSelectedSlots();
          pushLog(`blast purged ${n} slots`);
        }
        break;
      default:
        pushLog(`unknown command: ${cmd} (/help)`);
    }
  }

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") handleSubmit();
  }

  const ticker = useHudStore((s) => s.ticker);

  return (
    <div style={{ ...cardShell, bottom: 96, left: 290, width: 460 }}>
      <div style={cardHeader}>
        <span>COMMAND CONSOLE</span>
        <span style={{ color: COLOR.textMuted, fontSize: 9 }}>
          ticker {ticker.running ? "AUTO" : "PAUSE"}{ticker.busy ? " ·BUSY" : ""}
          {" · "}cap {TIER_CAPS.reduce((a, b) => a + b, 0)}
        </span>
      </div>
      <div
        ref={logRef}
        style={{
          padding: "6px 9px",
          height: 142,
          overflowY: "auto",
          fontFamily: FONT,
          fontSize: 10,
          lineHeight: 1.4,
        }}
      >
        {log.map((line, i) => (
          <div
            key={i}
            style={{
              color: line.includes("ERROR") || line.startsWith("  rejected")
                ? COLOR.fail
                : line.startsWith(">")
                  ? COLOR.accent
                  : line.startsWith("  ")
                    ? COLOR.textDim
                    : COLOR.text,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {line}
          </div>
        ))}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          borderTop: `1px solid ${COLOR.border}`,
          padding: "4px 9px",
          gap: 6,
        }}
      >
        <span style={{ color: COLOR.accent }}>›</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKey}
          placeholder="inject memory or /help"
          autoComplete="off"
          spellCheck={false}
          style={{
            flex: 1,
            background: "transparent",
            border: "none",
            outline: "none",
            color: COLOR.text,
            fontFamily: FONT,
            fontSize: 10.5,
            caretColor: COLOR.accent,
          }}
        />
        {isLassoMode && (
          <span style={{ color: COLOR.warn, fontSize: 9, letterSpacing: 1 }}>LASSO</span>
        )}
      </div>
    </div>
  );
}
