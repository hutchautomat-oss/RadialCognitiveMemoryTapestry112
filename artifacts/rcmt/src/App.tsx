import { Suspense, useEffect, Component, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { CommandConsole } from "./components/CommandConsole";
import { Timeline } from "./components/Timeline";
import { ThoughtTicker } from "./components/ThoughtTicker";
import { HoverTooltip } from "./components/HoverTooltip";
import {
  SyncCore,
  Ontology,
  EventStream,
  Invariants,
  CameraReadout,
  TelemetryBar,
} from "./components/hud";
import { NetworkManager } from "./network/NetworkManager";
import { OnnxWorker } from "./workers/OnnxWorkerManager";
import { pushHudEvent } from "./store/useHudStore";
import { COLOR, FONT } from "./components/hud/tokens";

// ── WebGL Error Boundary ─────────────────────────────────────
class WebGLErrorBoundary extends Component<
  { children: ReactNode },
  { error: string | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: Error) {
    return { error: err.message };
  }
  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            color: COLOR.text,
            fontFamily: FONT,
            fontSize: 13,
            gap: 12,
            background: COLOR.bgSolid,
          }}
        >
          <div style={{ color: COLOR.fail }}>WEBGL CONTEXT UNAVAILABLE</div>
          <div style={{ color: COLOR.textDim, fontSize: 11, maxWidth: 400, textAlign: "center" }}>
            {this.state.error}
          </div>
          <div style={{ color: COLOR.textMuted, fontSize: 10 }}>
            Ensure hardware acceleration is enabled in your browser settings.
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function LoadingOverlay() {
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: COLOR.bgSolid,
        color: COLOR.accent,
        fontFamily: FONT,
        fontSize: 12,
        letterSpacing: 1,
      }}
    >
      INITIALIZING RCMT LATTICE…
    </div>
  );
}

export default function App() {
  useEffect(() => {
    NetworkManager.connect();
    // Boot the ONNX classifier worker so injections actually run through the
    // 25 MB MiniLM model instead of silently falling back to the keyword
    // heuristic. Status transitions are surfaced by the SyncCore ENGINE pill
    // (single owner of onStatusChange — don't add another subscriber here or
    // the last writer wins). We poll currentStatus once on the next tick so
    // a transition to ERROR also lands in the event ring as a hard signal.
    OnnxWorker.initialize();
    const id = setInterval(() => {
      const s = OnnxWorker.currentStatus;
      if (s === "ERROR") {
        pushHudEvent({
          type: "ERROR",
          detail: "ONNX classifier failed to load — keyword fallback active",
        });
        clearInterval(id);
      } else if (s === "READY" || s === "CLASSIFY_COMPLETE") {
        pushHudEvent({ type: "INFO", detail: "ONNX classifier READY" });
        clearInterval(id);
      }
    }, 1000);
    return () => {
      clearInterval(id);
      NetworkManager.disconnect();
    };
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: COLOR.bgSolid,
        position: "relative",
        overflow: "hidden",
        fontFamily: FONT,
      }}
    >
      {/* 3D Canvas — outer DOM-level Suspense shows the loading overlay
          until the lazy 3D subtree resolves; the inner R3F Suspense uses
          a null fallback because its children render inside WebGL, not DOM. */}
      <Suspense fallback={<LoadingOverlay />}>
        <WebGLErrorBoundary>
          <Canvas
            gl={{ antialias: true, alpha: false }}
            camera={{ position: [0, 25, 95], fov: 60, near: 0.1, far: 500 }}
            style={{ position: "absolute", inset: 0 }}
            onCreated={({ gl }) => {
              gl.setClearColor(COLOR.bgSolid, 1);
            }}
          >
            <Suspense fallback={null}>
              <Scene />
            </Suspense>
          </Canvas>
        </WebGLErrorBoundary>
      </Suspense>

      {/* Aerospace telemetry HUD */}
      <Invariants />
      <SyncCore />
      <Ontology />
      <CameraReadout />
      <EventStream />
      <CommandConsole />
      <TelemetryBar />
      <Timeline />
      <HoverTooltip />

      {/* Invisible: drives autonomous thought loop. */}
      <ThoughtTicker />

      {/* Corner branding */}
      <div
        style={{
          position: "fixed",
          top: 14,
          left: "50%",
          transform: "translate(-50%, 56px)",
          fontFamily: FONT,
          fontSize: 9,
          color: COLOR.textMuted,
          letterSpacing: 1.5,
          pointerEvents: "none",
          userSelect: "none",
          textAlign: "center",
        }}
      >
        RCMT PLATINUM v5.1 · RADIAL COGNITIVE MEMORY TAPESTRY
      </div>
    </div>
  );
}
