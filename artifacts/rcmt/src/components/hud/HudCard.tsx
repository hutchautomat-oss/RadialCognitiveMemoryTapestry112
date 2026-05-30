/**
 * HudCard — shared shell for every aerospace telemetry card.
 *
 * Responsibilities:
 *   1. Draggable by its header (mouse down anywhere on the header bar that
 *      isn't the collapse chevron).
 *   2. Collapsible to just the header strip via a `▾`/`▸` chevron.
 *   3. Persists `{x, y, collapsed}` per `id` to `localStorage` so refresh /
 *      HMR don't reset the user's layout. Storage key is `rcmt:hud:<id>:v1`.
 *   4. Falls back to the caller's `initial` position spec until the user
 *      first drags the card — so the default layout is still anchored by
 *      `top/bottom/left/right`, not pinned absolutely.
 *   5. Brings the active drag target to the top of the z-stack so a tall
 *      card pulled over a short one renders above it cleanly.
 *
 * Cards that are NOT real "cards" (`Invariants` strip, `TelemetryBar`,
 * `Timeline`) intentionally do NOT use this wrapper — they're fixed
 * pinned strips and dragging them would be hostile UX.
 */

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type CSSProperties,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { cardShell, cardHeader, COLOR } from "./tokens";
import { useHudStore } from "../../store/useHudStore";

type Anchor = {
  top?: number;
  bottom?: number;
  left?: number | string;
  right?: number;
};

type Persisted = {
  x: number | null; // null = never dragged, use anchor
  y: number | null;
  collapsed: boolean;
};

function storageKey(id: string) {
  return `rcmt:hud:${id}:v1`;
}

function loadPersisted(id: string): Persisted {
  if (typeof window === "undefined") return { x: null, y: null, collapsed: false };
  try {
    const raw = window.localStorage.getItem(storageKey(id));
    if (!raw) return { x: null, y: null, collapsed: false };
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      x: typeof parsed.x === "number" ? parsed.x : null,
      y: typeof parsed.y === "number" ? parsed.y : null,
      collapsed: Boolean(parsed.collapsed),
    };
  } catch {
    return { x: null, y: null, collapsed: false };
  }
}

function savePersisted(id: string, value: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(id), JSON.stringify(value));
  } catch {
    // Quota / private-mode failures are non-fatal — drag still works in-session.
  }
}

let zCounter = 100;

export interface HudCardProps {
  id: string;
  title: string;
  /** Right-side header content (peer id, counter, etc.). */
  headerExtra?: ReactNode;
  /** Initial pinned anchor — applies until the user first drags the card. */
  initial: Anchor;
  /** Width spec (number = px, string = any CSS length / `min()` / `calc()`). */
  width: number | string;
  /** Extra style overrides applied to the shell (e.g. minWidth, maxHeight). */
  style?: CSSProperties;
  /**
   * Plain-English subtitle shown only in GUIDED mode, rendered as
   * `"{title} · {plainTitle}"`. Aerospace mode ignores it.
   */
  plainTitle?: string;
  /**
   * ~2 sentences of help shown in a `?` popover in GUIDED mode. The button
   * only appears when this is set and the HUD is in guided mode.
   */
  helpText?: string;
  /** Body content — hidden when the card is collapsed. */
  children: ReactNode;
}

export function HudCard({
  id,
  title,
  headerExtra,
  initial,
  width,
  style,
  plainTitle,
  helpText,
  children,
}: HudCardProps) {
  const hudMode = useHudStore((s) => s.hudMode);
  const guided = hudMode === "guided";
  const [helpOpen, setHelpOpen] = useState(false);
  const [persisted, setPersisted] = useState<Persisted>(() => loadPersisted(id));
  const [zIndex, setZIndex] = useState<number>(() => ++zCounter);
  const dragState = useRef<{
    startPointerX: number;
    startPointerY: number;
    startCardX: number;
    startCardY: number;
  } | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);

  // Persist on every change.
  useEffect(() => {
    savePersisted(id, persisted);
  }, [id, persisted]);

  const onHeaderPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Ignore the chevron and any explicit no-drag region.
      const target = e.target as HTMLElement;
      if (target.closest("[data-hud-no-drag='true']")) return;
      // Only left-mouse / primary pointer drags.
      if (e.button !== 0 && e.pointerType === "mouse") return;

      const shell = shellRef.current;
      if (!shell) return;
      const rect = shell.getBoundingClientRect();

      dragState.current = {
        startPointerX: e.clientX,
        startPointerY: e.clientY,
        startCardX: rect.left,
        startCardY: rect.top,
      };
      setZIndex(++zCounter);
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      e.preventDefault();
    },
    [],
  );

  const onHeaderPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const drag = dragState.current;
      if (!drag) return;
      const dx = e.clientX - drag.startPointerX;
      const dy = e.clientY - drag.startPointerY;
      // Clamp to viewport so a card can't be dragged offscreen entirely.
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const shellW = shellRef.current?.offsetWidth ?? 200;
      const shellH = shellRef.current?.offsetHeight ?? 40;
      const nextX = Math.max(0, Math.min(vw - shellW, drag.startCardX + dx));
      const nextY = Math.max(0, Math.min(vh - shellH, drag.startCardY + dy));
      setPersisted((p) => ({ ...p, x: nextX, y: nextY }));
    },
    [],
  );

  const onHeaderPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      dragState.current = null;
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        // releasePointerCapture throws if we never captured — ignore.
      }
    },
    [],
  );

  const toggleCollapsed = useCallback(() => {
    setPersisted((p) => ({ ...p, collapsed: !p.collapsed }));
  }, []);

  // Build the position style. If the user has dragged the card, use absolute
  // x/y; otherwise honor the original anchor spec.
  const positionStyle: CSSProperties =
    persisted.x !== null && persisted.y !== null
      ? { top: persisted.y, left: persisted.x, right: "auto", bottom: "auto" }
      : {
          top: initial.top,
          bottom: initial.bottom,
          left: initial.left,
          right: initial.right,
        };

  return (
    <div
      ref={shellRef}
      style={{
        ...cardShell,
        ...positionStyle,
        width,
        zIndex,
        ...style,
      }}
    >
      <div
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
        style={{
          ...cardHeader,
          cursor: dragState.current ? "grabbing" : "grab",
          // Hint the OS that this is a drag handle so text selection doesn't fight us.
          touchAction: "none",
          userSelect: "none",
        }}
      >
        <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <button
            type="button"
            data-hud-no-drag="true"
            onClick={toggleCollapsed}
            aria-label={persisted.collapsed ? "Expand card" : "Collapse card"}
            style={{
              background: "transparent",
              border: "none",
              color: COLOR.textDim,
              cursor: "pointer",
              padding: 0,
              font: "inherit",
              width: 12,
              textAlign: "center",
              lineHeight: 1,
            }}
          >
            {persisted.collapsed ? "▸" : "▾"}
          </button>
          <span>{guided && plainTitle ? `${title} · ${plainTitle}` : title}</span>
          {guided && helpText ? (
            <button
              type="button"
              data-hud-no-drag="true"
              onClick={() => setHelpOpen((v) => !v)}
              aria-label={helpOpen ? "Hide help" : "Show help"}
              aria-expanded={helpOpen}
              style={{
                background: helpOpen ? COLOR.accent : "transparent",
                border: `1px solid ${helpOpen ? COLOR.accent : COLOR.border}`,
                borderRadius: "50%",
                color: helpOpen ? COLOR.bgSolid : COLOR.textDim,
                cursor: "pointer",
                width: 13,
                height: 13,
                fontSize: 9,
                lineHeight: "11px",
                textAlign: "center",
                padding: 0,
                fontFamily: "inherit",
              }}
            >
              ?
            </button>
          ) : null}
        </span>
        {headerExtra ? (
          <span data-hud-no-drag="true">{headerExtra}</span>
        ) : null}
      </div>
      {guided && helpText && helpOpen ? (
        <div
          data-hud-no-drag="true"
          style={{
            padding: "7px 10px",
            borderBottom: `1px solid ${COLOR.border}`,
            background: COLOR.bgSolid,
            color: COLOR.text,
            fontSize: 9.5,
            lineHeight: 1.55,
            letterSpacing: 0.2,
            textTransform: "none",
          }}
        >
          {helpText}
        </div>
      ) : null}
      {!persisted.collapsed && children}
    </div>
  );
}
