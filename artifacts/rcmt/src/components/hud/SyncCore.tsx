/**
 * SYNC CORE — top-left card. Connection state, peer id, packet rates,
 * ticker cadence, ONNX engine state. The "is the machine alive" panel.
 */

import { useEffect, useState } from "react";
import { useHudStore } from "../../store/useHudStore";
import { OnnxWorker, type OnnxStatus } from "../../workers/OnnxWorkerManager";
import { NetworkManager } from "../../network/NetworkManager";
import { cardBody, COLOR } from "./tokens";
import { HudCard } from "./HudCard";

export function SyncCore() {
  const net = useHudStore((s) => s.net);
  const setNet = useHudStore((s) => s.setNet);
  const ticker = useHudStore((s) => s.ticker);
  const fps = useHudStore((s) => s.fps);

  const [engine, setEngine] = useState<OnnxStatus>(OnnxWorker.currentStatus);
  const [packetsInPrev, setPacketsInPrev] = useState({ count: 0, at: performance.now() });
  const [packetsOutPrev, setPacketsOutPrev] = useState({ count: 0, at: performance.now() });

  useEffect(() => {
    OnnxWorker.onStatusChange = (p) => setEngine(p.status);
    return () => {
      OnnxWorker.onStatusChange = null;
    };
  }, []);

  // Sample connection every 1 s and compute packet rates.
  useEffect(() => {
    const id = setInterval(() => {
      const now = performance.now();
      const { packetsIn, packetsOut } = useHudStore.getState().net;
      const dtIn = (now - packetsInPrev.at) / 1000;
      const dtOut = (now - packetsOutPrev.at) / 1000;
      setNet({
        connected: NetworkManager.isConnected,
        peerId: NetworkManager.assignedPeerId,
        packetsInRate: dtIn > 0 ? (packetsIn - packetsInPrev.count) / dtIn : 0,
        packetsOutRate: dtOut > 0 ? (packetsOut - packetsOutPrev.count) / dtOut : 0,
      });
      setPacketsInPrev({ count: packetsIn, at: now });
      setPacketsOutPrev({ count: packetsOut, at: now });
    }, 1000);
    return () => clearInterval(id);
  }, [packetsInPrev, packetsOutPrev, setNet]);

  const engineColor =
    engine === "READY" || engine === "CLASSIFY_COMPLETE"
      ? COLOR.nominal
      : engine === "ERROR"
        ? COLOR.fail
        : COLOR.warn;

  // Re-render the HELLO age once a second so the "Xs ago" readout actually
  // moves. We don't need sub-second granularity for this dial.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const helloAge =
    net.lastHelloAt > 0
      ? formatAge(Date.now() - net.lastHelloAt)
      : net.connected ? "pending" : "—";
  const rejectStr =
    net.lastRejectAt > 0 && net.lastRejectSlot !== null
      ? `slot ${net.lastRejectSlot} · ${formatAge(Date.now() - net.lastRejectAt)} ago`
      : "none";

  return (
    <HudCard
      id="sync-core"
      title="SYNC CORE"
      initial={{ top: 14, left: 14 }}
      width={268}
      headerExtra={
        <span style={{ color: COLOR.textMuted }}>peer {net.peerId >= 0 ? net.peerId : "—"}</span>
      }
    >
      <div style={cardBody}>
        <Row label="LINK" value={
          <span>
            <Pill color={net.connected ? COLOR.nominal : COLOR.fail}>
              {net.connected ? "SYNC" : "LOCAL"}
            </Pill>
            <span style={{ color: COLOR.textDim, marginLeft: 8 }}>
              peers {net.peerCount > 0 ? net.peerCount : (net.connected ? "1+" : "0")}
            </span>
            <span style={{ color: COLOR.textMuted, marginLeft: 8 }}>
              HELLO {helloAge}
            </span>
          </span>
        } />
        <Row
          label="LWW REJ"
          value={
            <span style={{
              color: net.lastRejectAt > 0 ? COLOR.warn : COLOR.textDim,
            }}>
              {rejectStr}
              {net.lastRejectReason && (
                <span style={{ color: COLOR.textMuted, marginLeft: 6 }}>
                  ({net.lastRejectReason})
                </span>
              )}
            </span>
          }
        />
        <Row label="ENGINE" value={
          <Pill color={engineColor}>{engineLabel(engine)}</Pill>
        } />
        <Row
          label="PACKETS"
          value={
            <span style={{ color: COLOR.text }}>
              <span style={{ color: COLOR.textDim }}>↓</span>{" "}
              {net.packetsIn.toFixed(0)}
              <span style={{ color: COLOR.textMuted, marginLeft: 4 }}>
                ({net.packetsInRate.toFixed(1)}/s)
              </span>
              <span style={{ color: COLOR.textDim, marginLeft: 10 }}>↑</span>{" "}
              {net.packetsOut.toFixed(0)}
              <span style={{ color: COLOR.textMuted, marginLeft: 4 }}>
                ({net.packetsOutRate.toFixed(1)}/s)
              </span>
            </span>
          }
        />
        <Row
          label="TICKER"
          value={
            <span>
              <Pill color={ticker.running ? COLOR.nominal : COLOR.warn}>
                {ticker.running ? "AUTO" : "PAUSED"}
              </Pill>
              <span style={{ color: COLOR.textDim, marginLeft: 8 }}>
                {(ticker.periodMs / 1000).toFixed(1)}±{(ticker.jitterMs / 1000).toFixed(1)}s
              </span>
              <span style={{ color: COLOR.textMuted, marginLeft: 8 }}>
                Σ{ticker.totalFired}
              </span>
            </span>
          }
        />
        <Row
          label="FPS"
          value={
            <span style={{ color: fps >= 55 ? COLOR.nominal : fps >= 40 ? COLOR.warn : COLOR.fail }}>
              {fps.toFixed(0)}
            </span>
          }
        />
      </div>
    </HudCard>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "2px 0", borderBottom: `1px dotted ${COLOR.border}` }}>
      <span style={{ color: COLOR.textMuted, fontSize: 9, letterSpacing: 1 }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: "inline-block",
      padding: "1px 6px",
      border: `1px solid ${color}`,
      color,
      fontSize: 9.5,
      letterSpacing: 0.5,
    }}>{children}</span>
  );
}

function formatAge(ms: number): string {
  if (ms < 1000) return `${ms | 0}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(0)}s`;
  const m = s / 60;
  if (m < 60) return `${m.toFixed(1)}m`;
  return `${(m / 60).toFixed(1)}h`;
}

function engineLabel(s: OnnxStatus): string {
  switch (s) {
    case "IDLE": return "IDLE";
    case "LOADING": return "DL";
    case "COMPILING": return "WARM";
    case "READY": return "READY";
    case "CLASSIFY_COMPLETE": return "READY";
    case "ERROR": return "ERR";
  }
}
