import { Suspense, useEffect, Component, ReactNode } from "react";
import { Canvas } from "@react-three/fiber";
import { Scene } from "./components/Scene";
import { CommandConsole } from "./components/CommandConsole";
import { Timeline } from "./components/Timeline";
import { NetworkManager } from "./network/NetworkManager";

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
            color: "#00ffff",
            fontFamily: "'Courier New', monospace",
            fontSize: 13,
            gap: 12,
            background: "#050505",
          }}
        >
          <div style={{ color: "#ff4444", textShadow: "0 0 8px #ff4444" }}>
            ⚠ WebGL context unavailable
          </div>
          <div style={{ color: "#00ffff80", fontSize: 11, maxWidth: 400, textAlign: "center" }}>
            {this.state.error}
          </div>
          <div style={{ color: "#00ff4180", fontSize: 10 }}>
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
        background: "#080808",
        color: "#00ffff",
        fontFamily: "'Courier New', monospace",
        fontSize: 14,
        textShadow: "0 0 12px #00ffff",
      }}
    >
      ⬡ INITIALIZING RCMT LATTICE…
    </div>
  );
}

export default function App() {
  useEffect(() => {
    NetworkManager.connect();
    return () => NetworkManager.disconnect();
  }, []);

  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        background: "#050505",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* 3D Canvas */}
      <WebGLErrorBoundary>
        <Canvas
          gl={{ antialias: true, alpha: false }}
          camera={{ position: [0, 25, 95], fov: 60, near: 0.1, far: 500 }}
          style={{ position: "absolute", inset: 0 }}
          onCreated={({ gl }) => {
            gl.setClearColor("#050505", 1);
          }}
        >
          <Suspense fallback={null}>
            <Scene />
          </Suspense>
        </Canvas>
      </WebGLErrorBoundary>

      {/* Loading fallback shown before Canvas mounts */}
      <Suspense fallback={<LoadingOverlay />} />

      {/* HUD overlays — always visible */}
      <CommandConsole />
      <Timeline />

      {/* Corner branding */}
      <div
        style={{
          position: "fixed",
          bottom: 60,
          right: 16,
          fontFamily: "'Courier New', monospace",
          fontSize: 10,
          color: "#00ffff25",
          lineHeight: 1.6,
          textAlign: "right",
          pointerEvents: "none",
          userSelect: "none",
        }}
      >
        <div style={{ color: "#00ffff60", fontSize: 12, textShadow: "0 0 8px #00ffff" }}>
          RCMT PLATINUM v5.0
        </div>
        <div>Radial Cognitive Memory Tapestry</div>
        <div>Unified Fibonacci Sphere · LWW Sync · BVH Raycast</div>
      </div>
    </div>
  );
}
