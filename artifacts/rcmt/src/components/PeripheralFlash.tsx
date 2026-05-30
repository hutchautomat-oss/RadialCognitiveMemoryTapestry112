/**
 * PeripheralFlash — DOM overlay (OUTSIDE the Canvas) that renders the
 * short-lived edge markers produced by PeripheralFlashBridge when a remote peer
 * mutates a background node. Each marker is a small glowing bar on the viewport
 * frame, in the direction of the updated node, that fades out via a pure CSS
 * animation (no per-frame React work).
 *
 * Keyed by flash id, so React mounts a fresh element per flash and the fade
 * animation plays exactly once. The store prunes stale entries.
 */

import { useHudStore } from "../store/useHudStore";

const FADE_MS = 900;
const BAR_LONG = 70; // px along the edge
const BAR_SHORT = 3; // px thickness

export function PeripheralFlash() {
  const flashes = useHudStore((s) => s.peripheralFlashes);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 90,
        overflow: "hidden",
      }}
    >
      <style>
        {`@keyframes rcmtPeriphFade {
            0%   { opacity: 0.95; }
            100% { opacity: 0; }
          }`}
      </style>
      {flashes.map((f) => {
        const vertical = f.edge === "left" || f.edge === "right";
        const style: React.CSSProperties = {
          position: "absolute",
          background: f.color,
          boxShadow: `0 0 10px 1px ${f.color}`,
          borderRadius: 1,
          opacity: 0,
          animation: `rcmtPeriphFade ${FADE_MS}ms ease-out forwards`,
        };
        if (vertical) {
          style.width = BAR_SHORT;
          style.height = BAR_LONG;
          style.top = `calc(${(f.pos * 100).toFixed(2)}% - ${BAR_LONG / 2}px)`;
          if (f.edge === "left") style.left = 0;
          else style.right = 0;
        } else {
          style.height = BAR_SHORT;
          style.width = BAR_LONG;
          style.left = `calc(${(f.pos * 100).toFixed(2)}% - ${BAR_LONG / 2}px)`;
          if (f.edge === "top") style.top = 0;
          else style.bottom = 0;
        }
        return <div key={f.id} style={style} />;
      })}
    </div>
  );
}
