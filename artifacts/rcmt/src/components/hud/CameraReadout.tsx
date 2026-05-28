/**
 * CAMERA — compact readout pinned bottom-right above the timeline. Lives
 * outside the Canvas; reads from the store HudBridge populates.
 */

import { useHudStore } from "../../store/useHudStore";
import { COLOR, FONT } from "./tokens";
import { HudCard } from "./HudCard";

export function CameraReadout() {
  const camera = useHudStore((s) => s.camera);
  const drawCalls = useHudStore((s) => s.drawCalls);
  const tris = useHudStore((s) => s.instancedCount);

  if (!camera) return null;

  return (
    <HudCard
      id="camera-readout"
      title="CAMERA · RENDERER"
      initial={{ bottom: 96, left: 14 }}
      width={268}
    >
      <div
        style={{
          padding: "6px 10px",
          fontFamily: FONT,
          fontSize: 9.5,
          letterSpacing: 0.4,
        }}
      >
        <div style={{ color: COLOR.text }}>
          pos&nbsp;
          <span style={{ color: COLOR.accent }}>{camera.px.toFixed(1)}</span>,
          &nbsp;
          <span style={{ color: COLOR.accent }}>{camera.py.toFixed(1)}</span>,
          &nbsp;
          <span style={{ color: COLOR.accent }}>{camera.pz.toFixed(1)}</span>
        </div>
        <div style={{ color: COLOR.text }}>
          dist&nbsp;
          <span style={{ color: COLOR.accent }}>{camera.distance.toFixed(1)}</span>
          <span style={{ color: COLOR.textMuted, marginLeft: 10 }}>
            fov {camera.fov.toFixed(0)}°
          </span>
        </div>
        <div style={{ color: COLOR.textDim, marginTop: 2 }}>
          draws {drawCalls} · tris {(tris / 1000).toFixed(1)}k
        </div>
      </div>
    </HudCard>
  );
}
