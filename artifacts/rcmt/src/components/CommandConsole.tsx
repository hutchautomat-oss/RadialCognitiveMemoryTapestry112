/**
 * COMMAND CONSOLE — bottom-left card. Manual phrase injection and slash
 * commands. The user's hands-on entry point into the lattice.
 *
 * Slash commands:
 *   /help                  — list commands (grouped, plain-English)
 *   /tour                  — re-open the guided onboarding overlay
 *   /clear                 — clear console log (events untouched)
 *   /pause                 — pause the autonomous ticker
 *   /resume                — resume the autonomous ticker
 *   /rate <ms>             — set ticker period in ms (250..30000)
 *   /axioms                — LIST the 7 boot axioms (read-only)
 *   /axiom-seed            — re-inject all axioms (Fact-tier forced)
 *   /invariants            — dump current invariant detail to the log
 *   /events [type]         — last 8 events, optionally filtered by event type
 *                            (SPAWN/EVICT/PROMOTE/AXIOM/LWW_REJECT/…)
 *   /why <slot>            — full provenance for a VRAM slot
 *                            (tier, mass, age, pos, peer, 3 nearest neighbors,
 *                            last broadcast packet age)
 *   /lasso                 — toggle lasso mode
 *   /blast                 — purge currently-selected slots
 *
 * Any text not starting with "/" is injected via the same `injectPhrase`
 * path the autonomous ticker uses — single source of truth for VRAM writes.
 */

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { useSaccadeStore, TIER_CAPS, STRIDE, MAX_NODES } from "../store/useSaccadeStore";
import { useHudStore, type HudEventType } from "../store/useHudStore";
import { injectPhrase } from "../lib/injectPhrase";
import { AXIOMS } from "../data/corpus";
import { NetworkManager } from "../network/NetworkManager";
import { COLOR, FONT, TIER_NAMES } from "./hud/tokens";
import { HudCard } from "./hud/HudCard";

const VALID_EVENT_TYPES: HudEventType[] = [
  "SPAWN", "REINFORCE", "PROMOTE", "EVICT", "LWW_REJECT", "LOW_CONF",
  "INVARIANT_FAIL", "AXIOM", "INFO", "PAUSE", "RESUME", "ERROR",
];

// Retain enough lines that the grouped `/help` output (~18 lines) is never
// truncated by the ring. The log pane is scrollable, so a deeper buffer just
// means the user can scroll back through a full help dump or a burst of
// injections rather than losing the earliest lines mid-command.
const MAX_LOG = 40;

export function CommandConsole() {
  const [input, setInput] = useState("");
  const [log, setLog] = useState<string[]>([
    "RCMT PLATINUM MONOLITH v5.1 — ONLINE",
    "ghost scaffold rendered · ticker arming · axioms pending",
    "type a phrase, or /help for commands",
  ]);
  const inputRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const isLassoMode = useSaccadeStore((s) => s.isLassoMode);
  const setLassoMode = useSaccadeStore((s) => s.setLassoMode);
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
        pushLog("LATTICE — inject & inspect memories");
        pushLog("  <phrase>      classify a phrase and store it as a memory");
        pushLog("  /axioms       list the 7 boot axioms (read-only)");
        pushLog("  /axiom-seed   re-inject all 7 axioms into the Fact tier");
        pushLog("  /why <slot>   full provenance for one VRAM slot");
        pushLog("  /lasso        toggle box-select to mark slots");
        pushLog("  /blast        purge the currently-selected slots");
        pushLog("TICKER — the autonomous thought loop");
        pushLog("  /pause        stop auto-injecting phrases");
        pushLog("  /resume       resume auto-injecting phrases");
        pushLog("  /rate <ms>    set ticker period (250..30000 ms)");
        pushLog("DIAGNOSTICS — read the substrate's state");
        pushLog("  /invariants   dump the 5 format tripwires + detail");
        pushLog("  /events [type] last 8 events, optionally filtered");
        pushLog("HELP — learn the HUD");
        pushLog("  /tour         re-open the guided walkthrough");
        pushLog("  /clear        clear this console log");
        pushLog("  /help         show this list");
        break;
      case "/tour":
        useHudStore.getState().setOnboardingOpen(true);
        pushLog("opening guided tour…");
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
        pushLog(`${AXIOMS.length} boot axioms (Fact-tier, foveated core):`);
        AXIOMS.forEach((a, i) => {
          const trimmed = a.length > 64 ? a.slice(0, 61) + "…" : a;
          pushLog(`  [${i}] ${trimmed}`);
        });
        pushLog(`  (use /axiom-seed to re-inject)`);
        break;
      case "/axiom-seed":
        pushLog(`re-seeding ${AXIOMS.length} axioms → forced Fact tier…`);
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
        let pool = hud.events;
        if (arg) {
          const wanted = arg.trim().toUpperCase();
          if (!VALID_EVENT_TYPES.includes(wanted as HudEventType)) {
            pushLog(`unknown event type: ${arg}`);
            pushLog(`  valid: ${VALID_EVENT_TYPES.join(" ")}`);
            break;
          }
          pool = pool.filter((e) => e.type === wanted);
        }
        const ev = pool.slice(-8);
        pushLog(
          arg
            ? `last ${ev.length} of ${pool.length} [${arg.toUpperCase()}] (ring ${hud.events.length}/500)`
            : `last ${ev.length} events (ring ${hud.events.length}/500)`,
        );
        if (ev.length === 0) pushLog("  (no matching events)");
        ev.forEach((e) =>
          pushLog(`  [${e.type}] ${e.phrase ?? ""} ${e.detail ?? ""}`.trim()),
        );
        break;
      }
      case "/why": {
        const slot = parseInt(arg, 10);
        if (isNaN(slot)) { pushLog("/why <slot>"); break; }
        const s = useSaccadeStore.getState();
        const frame = s.mockFrames[s.activeFrameIndex];
        if (!frame || slot < 0 || slot >= MAX_NODES) {
          pushLog(`slot ${arg} out of range [0..${MAX_NODES - 1}]`);
          break;
        }
        const off = slot * STRIDE;
        const px = frame[off], py = frame[off + 1], pz = frame[off + 2];
        const mass = frame[off + 6];
        const tier = s.slotTier[slot];
        const inj = s.injectedAt[slot];
        const reinf = s.reinforcementCount[slot];
        const ageMs = inj > 0 ? Date.now() - inj : 0;
        const age = inj > 0 ? (ageMs / 1000).toFixed(1) + "s" : "—";
        const peer = NetworkManager.assignedPeerId;
        const peerStr = peer >= 0 ? `peer ${peer}` : "local (no peer assigned)";
        const helloAge = hud.net.lastHelloAt > 0
          ? ((Date.now() - hud.net.lastHelloAt) / 1000).toFixed(1) + "s ago"
          : "never";
        // Find 3 nearest living neighbors by Euclidean distance.
        const neighbors: { idx: number; d: number; tier: number }[] = [];
        for (let i = 0; i < MAX_NODES; i++) {
          if (i === slot) continue;
          const m = frame[i * STRIDE + 6];
          if (m <= 1e-6) continue;
          const dx = frame[i * STRIDE] - px;
          const dy = frame[i * STRIDE + 1] - py;
          const dz = frame[i * STRIDE + 2] - pz;
          const d2 = dx * dx + dy * dy + dz * dz;
          if (neighbors.length < 3) {
            neighbors.push({ idx: i, d: Math.sqrt(d2), tier: s.slotTier[i] });
            neighbors.sort((a, b) => a.d - b.d);
          } else if (d2 < neighbors[2].d * neighbors[2].d) {
            neighbors[2] = { idx: i, d: Math.sqrt(d2), tier: s.slotTier[i] };
            neighbors.sort((a, b) => a.d - b.d);
          }
        }
        pushLog(
          `  vram[${slot}] tier=${TIER_NAMES[tier - 1] ?? "?"} mass=${mass.toFixed(2)} reinf=${reinf} age=${age}`,
        );
        pushLog(
          `  pos=(${px.toFixed(2)}, ${py.toFixed(2)}, ${pz.toFixed(2)})  r=${Math.sqrt(px * px + py * py + pz * pz).toFixed(2)}`,
        );
        pushLog(`  origin=${peerStr}  HELLO=${helloAge}`);
        if (mass <= 1e-6) {
          pushLog(`  (slot is FREE — pos shown is the foveated rest position)`);
        }
        if (neighbors.length === 0) {
          pushLog(`  neighbors: — (lattice has no other live slots)`);
        } else {
          pushLog(
            `  neighbors: ${neighbors
              .map((n) => `${n.idx}(${TIER_NAMES[n.tier - 1] ?? "?"}, d=${n.d.toFixed(2)})`)
              .join("  ")}`,
          );
        }
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
    <HudCard
      id="command-console"
      title="COMMAND CONSOLE"
      plainTitle="Type or Run a Command"
      helpText="Type any phrase to inject it as a new memory, or run a slash command like /help, /tour, or /pause. Everything you type is classified on-device and placed in the lattice by meaning, never sent to a server."
      initial={{ bottom: 96, left: 290 }}
      // Shrink to fit when the viewport narrows so the card never collides
      // with the EventStream's left edge (right:14 + width:380).
      width="min(460px, calc(100vw - 290px - 14px - 380px - 14px - 12px))"
      style={{ minWidth: 320 }}
      headerExtra={
        <span style={{ color: COLOR.textMuted, fontSize: 9 }}>
          ticker {ticker.running ? "AUTO" : "PAUSE"}{ticker.busy ? " ·BUSY" : ""}
          {" · "}cap {TIER_CAPS.reduce((a, b) => a + b, 0)}
        </span>
      }
    >
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
    </HudCard>
  );
}
