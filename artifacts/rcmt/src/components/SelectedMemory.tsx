/**
 * SelectedMemory — per-intersection CODE CONSOLE for a single picked cell.
 *
 * Click any live node (see SaccadeInstancedMesh's click-vs-drag handler) and it
 * becomes the sole entry in useSaccadeStore.selectedSlots; this card then
 * surfaces the slot's REAL state (index, tier + radial band, position, color,
 * scale, LWW timestamp, source phrase, occupied/empty) and exposes the lawful
 * operations on it:
 *   - occupied → READ (inline) + REINFORCE / PROMOTE / DEMOTE / EVICT
 *   - empty    → WRITE a new memory into this cell's tier band
 *   - either   → DIVE (work→drive surgical scale-dive to this cell)
 *   - JUMP to any slot index, so any intersection (occupied or empty) is
 *     reachable once one cell is picked.
 *
 * Every mutating op is routed ONLY through the canonical paths in
 * `../lib/slotOps` (which delegate to store actions + injectPhrase) — this
 * component never touches the frame buffer, geometry, or the wire packet
 * directly. Render-only chrome; pins no runtime invariant.
 *
 * Only renders when EXACTLY one slot is selected — a multi-slot lasso keeps the
 * existing cyan-highlight + /blast flow and shows nothing here. Esc or ✕ clears.
 *
 * DOM overlay (outside the Canvas) anchored top-centre under the Invariants
 * strip, in a column with otherwise-open space.
 */

import { useEffect, useState, useCallback } from "react";
import {
  useSaccadeStore,
  STRIDE,
  MAX_NODES,
  latticePosition,
  TIER_RGB,
} from "../store/useSaccadeStore";
import { useHudStore } from "../store/useHudStore";
import { COLOR, FONT, TIER_NAMES } from "./hud/tokens";
import { TIER_PLAIN, TIER_BAND } from "../lib/tierNarration";
import {
  reinforceSlotAt,
  promoteSlotAt,
  demoteSlotAt,
  evictSlotAt,
  writeIntoBand,
} from "../lib/slotOps";

function rgbCss(r: number, g: number, b: number): string {
  const c = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 2 }}>
      <span
        style={{
          color: COLOR.textMuted,
          minWidth: 58,
          fontSize: 9,
          letterSpacing: 0.6,
          textTransform: "uppercase",
        }}
      >
        {label}
      </span>
      <span style={{ color: COLOR.text, flex: 1, wordBreak: "break-word" }}>
        {children}
      </span>
    </div>
  );
}

function OpButton({
  label,
  onClick,
  disabled,
  title,
  danger,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        flex: "1 1 auto",
        border: `1px solid ${disabled ? COLOR.border : COLOR.borderStrong}`,
        background: "transparent",
        color: disabled
          ? COLOR.textMuted
          : danger
            ? "#d98a8a"
            : COLOR.accent,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
        fontFamily: FONT,
        fontSize: 9,
        letterSpacing: 0.6,
        padding: "3px 6px",
        borderRadius: 2,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}

export function SelectedMemory() {
  const selectedSlots = useSaccadeStore((s) => s.selectedSlots);
  const slotPhrase = useSaccadeStore((s) => s.slotPhrase);
  const slotTier = useSaccadeStore((s) => s.slotTier);
  const mockFrames = useSaccadeStore((s) => s.mockFrames);
  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const injectedAt = useSaccadeStore((s) => s.injectedAt);
  const reinforcementCount = useSaccadeStore((s) => s.reinforcementCount);
  const setSelectedSlots = useSaccadeStore((s) => s.setSelectedSlots);
  const clearSelection = useSaccadeStore((s) => s.clearSelection);
  const requestDive = useHudStore((s) => s.requestDive);

  const single = selectedSlots.size === 1;
  const slot = single
    ? (selectedSlots.values().next().value as number)
    : -1;

  // Local refresh tick: in-place frame/state mutations (reinforce, decay) don't
  // change store references, so bump this to re-read fresh values. Also keeps
  // the LWW "age" readout ticking while the card is open.
  const [, setTick] = useState(0);
  const [jumpText, setJumpText] = useState("");
  const [writeText, setWriteText] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!single) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearSelection();
    };
    window.addEventListener("keydown", onKey);
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearInterval(id);
    };
  }, [single, clearSelection]);

  // Reset the per-slot input drafts whenever the picked slot changes.
  useEffect(() => {
    setWriteText("");
    setJumpText("");
  }, [slot]);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const doJump = useCallback(() => {
    const n = parseInt(jumpText, 10);
    if (Number.isFinite(n) && n >= 0 && n < MAX_NODES) {
      setSelectedSlots(new Set([n]));
    }
  }, [jumpText, setSelectedSlots]);

  if (!single) return null;

  const tier = slotTier[slot];
  const tierName = TIER_NAMES[tier - 1] ?? "?";
  const tierColor = COLOR.tier[tier - 1] ?? COLOR.text;
  const phrase = slotPhrase[slot];
  const frame = mockFrames[activeFrameIndex] ?? null;
  const off = slot * STRIDE;
  const scale = frame ? frame[off + 6] : 0;
  const occupied = scale > 0;

  // Position: live for occupied cells, deterministic rest position for empty.
  const [px, py, pz] = occupied && frame
    ? [frame[off + 0], frame[off + 1], frame[off + 2]]
    : latticePosition(slot, tier);

  // Color: live frame color for occupied cells, canonical tier color for empty.
  const [cr, cg, cb] = occupied && frame
    ? [frame[off + 3], frame[off + 4], frame[off + 5]]
    : (TIER_RGB[tier - 1] ?? [0.5, 0.5, 0.5]);

  // LWW timestamp: the slot's last meaningful write. injectedAt is a
  // performance.now() stamp; reconstruct an approximate wall-clock + live age.
  let lwwLabel = "—";
  if (occupied && injectedAt[slot] > 0) {
    const ageMs = performance.now() - injectedAt[slot];
    const wall = Date.now() - ageMs;
    lwwLabel = `${new Date(wall).toLocaleTimeString()} · ${(ageMs / 1000).toFixed(1)}s ago`;
  }

  const onReinforce = () => {
    const dest = reinforceSlotAt(slot);
    if (dest === null) return;
    // A reinforce can cross the strike threshold and promote the memory to a
    // NEW slot index; follow it so the console stays on the same memory.
    if (dest !== slot) setSelectedSlots(new Set([dest]));
    else refresh();
  };
  const onPromote = () => {
    const dest = promoteSlotAt(slot);
    if (dest !== null) setSelectedSlots(new Set([dest]));
  };
  const onDemote = () => {
    const dest = demoteSlotAt(slot);
    if (dest !== null) setSelectedSlots(new Set([dest]));
  };
  const onEvict = () => {
    if (evictSlotAt(slot)) clearSelection();
  };
  const onDive = () => requestDive({ x: px, y: py, z: pz });

  const onWrite = () => {
    const text = writeText.trim();
    if (!text || busy) return;
    setBusy(true);
    writeIntoBand(text, tier)
      .then((res) => {
        setWriteText("");
        if (res.vramIndex !== null) setSelectedSlots(new Set([res.vramIndex]));
      })
      .finally(() => setBusy(false));
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 60,
        left: "50%",
        transform: "translateX(-50%)",
        width: 320,
        background: COLOR.bg,
        border: `1px solid ${COLOR.borderStrong}`,
        borderRadius: 2,
        padding: "8px 10px",
        fontFamily: FONT,
        fontSize: 10.5,
        color: COLOR.text,
        lineHeight: 1.4,
        userSelect: "none",
        zIndex: 150,
        backdropFilter: "blur(3px)",
        letterSpacing: 0.2,
        boxShadow: `0 0 0 1px ${COLOR.accentDim}33`,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          fontSize: 9,
          color: COLOR.textDim,
          letterSpacing: 0.8,
          textTransform: "uppercase",
          marginBottom: 5,
        }}
      >
        <span
          aria-hidden
          style={{
            display: "inline-block",
            width: 6,
            height: 6,
            borderRadius: 1,
            background: tierColor,
          }}
        />
        <span style={{ color: tierColor }}>{tierName}</span>
        <span style={{ color: COLOR.textMuted }}>· vram[{slot}]</span>
        <span
          style={{
            color: occupied ? COLOR.accent : COLOR.textMuted,
            marginLeft: 2,
          }}
        >
          {occupied ? "OCCUPIED" : "EMPTY"}
        </span>
        <button
          type="button"
          onClick={() => clearSelection()}
          title="Clear selection (Esc)"
          style={{
            marginLeft: "auto",
            background: "transparent",
            border: "none",
            color: COLOR.textMuted,
            cursor: "pointer",
            fontFamily: FONT,
            fontSize: 11,
            lineHeight: 1,
            padding: 0,
          }}
        >
          ✕
        </button>
      </div>

      {/* READ — source phrase */}
      <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", marginBottom: 4 }}>
        {phrase ?? (
          <span style={{ color: COLOR.textMuted, fontStyle: "italic" }}>
            {occupied
              ? "no source phrase (seeded / peer node)"
              : "empty intersection — no memory here yet"}
          </span>
        )}
      </div>

      {/* STATE */}
      <div
        style={{
          paddingTop: 5,
          borderTop: `1px dotted ${COLOR.border}`,
          fontSize: 9.5,
        }}
      >
        <Row label="tier">
          {tierName} — {TIER_PLAIN[tier - 1] ?? ""}
        </Row>
        <Row label="band">{TIER_BAND[tier - 1] ?? ""}</Row>
        <Row label="pos">
          {px.toFixed(2)}, {py.toFixed(2)}, {pz.toFixed(2)}
        </Row>
        <Row label="color">
          <span
            aria-hidden
            style={{
              display: "inline-block",
              width: 9,
              height: 9,
              borderRadius: 1,
              verticalAlign: "middle",
              marginRight: 5,
              background: rgbCss(cr, cg, cb),
              border: `1px solid ${COLOR.border}`,
            }}
          />
          {rgbCss(cr, cg, cb)}
        </Row>
        <Row label="scale">{scale.toFixed(3)}</Row>
        {occupied && (
          <Row label="strikes">{reinforcementCount[slot]}</Row>
        )}
        <Row label="lww">{lwwLabel}</Row>
      </div>

      {/* OPS */}
      <div
        style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: `1px dotted ${COLOR.border}`,
        }}
      >
        {occupied ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            <OpButton
              label="REINFORCE"
              onClick={onReinforce}
              title="Re-affirm this memory (seen again): strengthens it, can promote a Theory/Dream inward"
            />
            <OpButton
              label="PROMOTE"
              onClick={onPromote}
              disabled={tier <= 1}
              title="Migrate one shell inward toward grounding"
            />
            <OpButton
              label="DEMOTE"
              onClick={onDemote}
              disabled={tier >= 5}
              title="Drift one shell outward toward the Dream rim"
            />
            <OpButton
              label="EVICT"
              onClick={onEvict}
              danger
              title="Fade this memory and return its slot to the pool"
            />
            <OpButton
              label="DIVE"
              onClick={onDive}
              title="Surgical scale-dive to this cell (switches to DRIVE)"
            />
          </div>
        ) : (
          <>
            <div
              style={{
                fontSize: 9,
                color: COLOR.textMuted,
                letterSpacing: 0.6,
                textTransform: "uppercase",
                marginBottom: 3,
              }}
            >
              write into {tierName} band
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <input
                value={writeText}
                onChange={(e) => setWriteText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onWrite();
                  e.stopPropagation();
                }}
                placeholder="memory phrase…"
                disabled={busy}
                style={{
                  flex: 1,
                  background: COLOR.bgSolid,
                  border: `1px solid ${COLOR.border}`,
                  borderRadius: 2,
                  color: COLOR.text,
                  fontFamily: FONT,
                  fontSize: 10,
                  padding: "3px 5px",
                  outline: "none",
                }}
              />
              <OpButton
                label={busy ? "…" : "WRITE"}
                onClick={onWrite}
                disabled={busy || writeText.trim().length === 0}
                title="Classify + inject this phrase into this tier band"
              />
            </div>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <OpButton
                label="DIVE"
                onClick={onDive}
                title="Surgical scale-dive to this cell (switches to DRIVE)"
              />
            </div>
          </>
        )}
      </div>

      {/* JUMP — reach any intersection by index */}
      <div
        style={{
          marginTop: 6,
          paddingTop: 6,
          borderTop: `1px dotted ${COLOR.border}`,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}
      >
        <span
          style={{
            fontSize: 9,
            color: COLOR.textMuted,
            letterSpacing: 0.6,
            textTransform: "uppercase",
          }}
        >
          jump
        </span>
        <input
          value={jumpText}
          onChange={(e) => setJumpText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") doJump();
            e.stopPropagation();
          }}
          placeholder={`0–${MAX_NODES - 1}`}
          inputMode="numeric"
          style={{
            width: 70,
            background: COLOR.bgSolid,
            border: `1px solid ${COLOR.border}`,
            borderRadius: 2,
            color: COLOR.text,
            fontFamily: FONT,
            fontSize: 10,
            padding: "3px 5px",
            outline: "none",
          }}
        />
        <OpButton
          label="GO"
          onClick={doJump}
          disabled={jumpText.trim().length === 0}
          title="Inspect another slot index (occupied or empty)"
        />
      </div>
    </div>
  );
}
