/**
 * EVENT STREAM — bottom-right card. Renders the latest ~22 entries from the
 * HUD event ring in reverse-chronological order. Each row is a single
 * monospace line so the user can scan for INVARIANT_FAIL or EVICT churn.
 *
 * Colors are by event type, not by tier — the eye should snap to a red
 * INVARIANT_FAIL even in a sea of green SPAWNs.
 */

import { useMemo } from "react";
import { useHudStore, type HudEventType } from "../../store/useHudStore";
import { cardShell, cardHeader, cardBody, COLOR } from "./tokens";

const VISIBLE_ROWS = 22;

const TYPE_COLOR: Record<HudEventType, string> = {
  SPAWN: COLOR.text,
  REINFORCE: COLOR.accent,
  PROMOTE: "#b88dff",
  EVICT: COLOR.warn,
  LWW_REJECT: COLOR.warn,
  LOW_CONF: COLOR.warn,
  INVARIANT_FAIL: COLOR.fail,
  AXIOM: COLOR.nominal,
  INFO: COLOR.textDim,
  PAUSE: COLOR.textMuted,
  RESUME: COLOR.textMuted,
  ERROR: COLOR.fail,
};

export function EventStream() {
  const events = useHudStore((s) => s.events);

  const recent = useMemo(() => {
    return events.slice(-VISIBLE_ROWS).reverse();
  }, [events]);

  return (
    <div
      style={{
        ...cardShell,
        bottom: 96,
        right: 14,
        width: 380,
        // Cap below the Ontology card's footprint (top:14 + ~220px tall) plus
        // a 12px gutter so the two never collide in a short viewport — the
        // canvas iframe runs ~557px tall, which used to overlap by ~50px.
        maxHeight: "min(320px, calc(100vh - 96px - 246px))",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={cardHeader}>
        <span>EVENT STREAM</span>
        <span style={{ color: COLOR.textMuted }}>{events.length}/500</span>
      </div>
      <div style={{ ...cardBody, flex: 1, minHeight: 0, overflowY: "auto" }}>
        {recent.length === 0 ? (
          <div style={{ color: COLOR.textMuted, fontSize: 10 }}>
            awaiting first event…
          </div>
        ) : (
          recent.map((e) => {
            const t = new Date(e.ts);
            const hh = String(t.getHours()).padStart(2, "0");
            const mm = String(t.getMinutes()).padStart(2, "0");
            const ss = String(t.getSeconds()).padStart(2, "0");
            const ms = String(t.getMilliseconds()).padStart(3, "0");
            return (
              <div
                key={e.id}
                style={{
                  display: "flex",
                  gap: 6,
                  padding: "1px 0",
                  fontSize: 9.5,
                  lineHeight: 1.35,
                  borderBottom: `1px dotted ${COLOR.border}`,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                <span style={{ color: COLOR.textMuted, flexShrink: 0 }}>
                  {hh}:{mm}:{ss}.{ms}
                </span>
                <span style={{
                  color: TYPE_COLOR[e.type] ?? COLOR.text,
                  fontWeight: e.type === "INVARIANT_FAIL" ? "bold" : "normal",
                  flexShrink: 0,
                  width: 90,
                }}>
                  {e.type}
                </span>
                <span style={{ color: COLOR.text, overflow: "hidden", textOverflow: "ellipsis" }}>
                  {e.phrase ?? e.detail ?? ""}
                  {e.phrase && e.detail ? (
                    <span style={{ color: COLOR.textMuted }}> · {e.detail}</span>
                  ) : null}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
