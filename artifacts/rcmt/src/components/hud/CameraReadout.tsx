/**
 * CAMERA — compact readout pinned bottom-right above the timeline. Lives
 * outside the Canvas; reads from the store HudBridge populates. Also hosts the
 * LATTICE control — show/dial the structural GhostScaffold (pure render chrome).
 */

import { useHudStore, type ScaffoldIntensity } from "../../store/useHudStore";
import { COLOR, FONT } from "./tokens";
import { HudCard } from "./HudCard";

const SCAFFOLD_SEGMENTS: { value: ScaffoldIntensity; label: string }[] = [
  { value: "off", label: "OFF" },
  { value: "subtle", label: "DIM" },
  { value: "full", label: "FULL" },
];

function ScaffoldControl() {
  const intensity = useHudStore((s) => s.scaffoldIntensity);
  const setIntensity = useHudStore((s) => s.setScaffoldIntensity);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 4,
        paddingTop: 5,
        borderTop: `1px dotted ${COLOR.border}`,
      }}
    >
      <span style={{ color: COLOR.textMuted, fontSize: 9, letterSpacing: 1 }}>
        LATTICE
      </span>
      <div
        style={{
          display: "flex",
          border: `1px solid ${COLOR.border}`,
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {SCAFFOLD_SEGMENTS.map(({ value, label }) => {
          const active = intensity === value;
          return (
            <button
              key={value}
              type="button"
              onClick={() => setIntensity(value)}
              aria-pressed={active}
              title="Show, dim, or hide the empty structural lattice"
              style={{
                border: "none",
                background: active ? COLOR.accent : "transparent",
                color: active ? COLOR.bgSolid : COLOR.textDim,
                cursor: "pointer",
                fontFamily: FONT,
                fontSize: 9,
                letterSpacing: 0.6,
                padding: "2px 8px",
                lineHeight: 1.2,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function CameraReadout() {
  const camera = useHudStore((s) => s.camera);
  const drawCalls = useHudStore((s) => s.drawCalls);
  const tris = useHudStore((s) => s.instancedCount);

  return (
    <HudCard
      id="camera-readout"
      title="CAMERA · RENDERER"
      plainTitle="View & Render"
      helpText="Where your camera sits in the 3D scene plus how hard the GPU is working (draw calls and triangles). One draw call for the whole lattice is the design goal — it stays cheap no matter how many memories are stored. LATTICE shows, dims, or hides the empty structural point cloud."
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
        {camera ? (
          <>
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
          </>
        ) : (
          <div style={{ color: COLOR.textMuted }}>awaiting camera…</div>
        )}
        <ScaffoldControl />
      </div>
    </HudCard>
  );
}
