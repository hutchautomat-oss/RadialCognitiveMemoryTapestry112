import { Suspense, useEffect, useState, Component, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { Timeline } from "./components/Timeline";
import { ThoughtTicker } from "./components/ThoughtTicker";
import { HoverTooltip } from "./components/HoverTooltip";
import { SelectedMemory } from "./components/SelectedMemory";
import { PeripheralFlash } from "./components/PeripheralFlash";
import { HudOnboarding } from "./components/HudOnboarding";
import { CommandDock } from "./components/hud";
import { NetworkManager } from "./network/NetworkManager";
import { bootLoadFromLocalStorage, scheduleAutosave, flushAutosave } from "./lib/tapestryPersist";
import { OnnxWorker } from "./workers/OnnxWorkerManager";
import { pushHudEvent, useHudStore } from "./store/useHudStore";
import { COLOR, FONT } from "./components/hud/tokens";

// ââ WebGL Error Boundary âââââââââââââââââââââââââââââââââââââ
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
      INITIALIZING RCMT LATTICEâ¦
    </div>
  );
}

export default function App() {
  // Idle-aware energy savings: when the browser tab is hidden, auto-pause the
  // ThoughtTicker (so it stops firing ONNX classifications nobody can see) and
  // switch the R3F render loop to "demand" so the Canvas stops repainting every
  // frame. Returning to the tab restores "always" rendering and clears the
  // auto-pause â without touching the user's manual `/pause` choice.
  const [tabHidden, setTabHidden] = useState(
    () => typeof document !== "undefined" && document.hidden,
  );

  useEffect(() => {
    // Sync the initial state in case the app mounts in a background tab â done
    // silently (no event) so we only log genuine visibility transitions.
    useHudStore.getState().setTickerAutoPaused(document.hidden);

    function onVisibility() {
      const hidden = document.hidden;
      setTabHidden(hidden);
      useHudStore.getState().setTickerAutoPaused(hidden);
      pushHudEvent({
        type: hidden ? "PAUSE" : "RESUME",
        detail: hidden
          ? "tab hidden â auto-paused render + ticker (energy save)"
          : "tab visible â auto-resumed live rendering",
      });
    }

    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // ── Persistence: boot-load from localStorage ───────────────────────
  // Attempt to restore the tapestry from a previous session. Runs once
  // after mount, before the ONNX/network effects (React fires useEffects
  // in declaration order). Boot-load is local-only so no network is needed.
  // scheduleAutosave() is exported from tapestryPersist and triggers a
  // debounced 30s write to localStorage on every lattice mutation; we
  // kick the first save here so a fresh session starts counting.
  useEffect(() => {
    const result = bootLoadFromLocalStorage();
    if (result) {
      pushHudEvent({
        type: result.ok ? "INFO" : "ERROR",
        detail: result.ok
          ? `session restored — ${result.slotCount} slots loaded from sovereign_save_key`
          : `boot-load failed: ${result.message}`,
      });
    }
    scheduleAutosave();

    function onBeforeUnload() {
      flushAutosave();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  useEffect(() => {
    NetworkManager.connect();
    // Boot the ONNX classifier worker so injections actually run through the
    // 25 MB MiniLM model instead of silently falling back to the keyword
    // heuristic. Status transitions are surfaced by the SyncCore ENGINE pill
    // (single owner of onStatusChange â don't add another subscriber here or
    // the last writer wins). We poll currentStatus once on the next tick so
    // a transition to ERROR also lands in the event ring as a hard signal.
    OnnxWorker.initialize();
    const id = setInterval(() => {
      const s = OnnxWorker.currentStatus;
      if (s === "ERROR") {
        pushHudEvent({
          type: "ERROR",
          detail: "ONNX classifier failed to load â keyword fallback active",
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
      {/* 3D Canvas â outer DOM-level Suspense shows the loading overlay
          until the lazy 3D subtree resolves; the inner R3F Suspense uses
          a null fallback because its children render inside WebGL, not DOM. */}
      <Suspense fallback={<LoadingOverlay />}>
        <WebGLErrorBoundary>
          <Canvas
            frameloop={tabHidden ? "demand" : "always"}
            gl={{ antialias: true, alpha: false }}
            camera={{ position: [0, 25, 95], fov: 70, near: 0.5, far: 500 }}
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

      {/* Cockpit HUD — Command Dock B layout */}
      <CommandDock />
      <Timeline />
      <HoverTooltip />
      <SelectedMemory />
      <PeripheralFlash />

      {/* First-run / on-demand guided walkthrough (mounted last so it overlays). */}
      <HudOnboarding />

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
        RCMT PLATINUM v5.1 Â· RADIAL COGNITIVE MEMORY TAPESTRY
      </div>
    </div>
  );
}
