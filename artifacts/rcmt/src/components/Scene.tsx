import { useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { PointLight, Vector3 } from "three";
import { useSaccadeStore } from "../store/useSaccadeStore";
import { SaccadeInstancedMesh } from "./SaccadeInstancedMesh";
import { LassoSelection } from "./LassoSelection";
import { GhostScaffold } from "./GhostScaffold";
import { HudBridge } from "./HudBridge";
import { PromotionTraces } from "./PromotionTraces";
import { PeripheralFlashBridge } from "./PeripheralFlashBridge";

function DriftingLight() {
  const lightRef = useRef<PointLight>(null!);
  useFrame(({ clock }) => {
    if (!lightRef.current) return;
    const t = clock.getElapsedTime();
    lightRef.current.position.set(
      Math.sin(t * 0.3) * 25,
      Math.cos(t * 0.2) * 10 + 5,
      Math.cos(t * 0.25) * 25,
    );
    lightRef.current.intensity = 0.5 + Math.sin(t * 0.7) * 0.1;
  });
  return (
    <pointLight
      ref={lightRef}
      color="#4fd1c5"
      intensity={0.5}
      distance={90}
      decay={2}
    />
  );
}

// Module-level scratch vector — zero GC pressure inside useFrame.
const _focusVec = new Vector3();

/**
 * SearchFocus — eases the OrbitControls target toward the centroid of the
 * current semantic-search matches for a short window after each /find, then
 * releases control back to the user. It only moves the CAMERA TARGET, never a
 * node. The one-shot deadline (keyed on searchEpoch) prevents the camera from
 * being permanently pinned to the matches, which would block free orbiting.
 */
function SearchFocus() {
  const controls = useThree((s) => s.controls) as
    | { target?: Vector3; update?: () => void }
    | null;
  const epochRef = useRef(-1);
  const deadlineRef = useRef(0);
  useFrame(() => {
    const st = useSaccadeStore.getState();
    if (st.searchEpoch !== epochRef.current) {
      epochRef.current = st.searchEpoch;
      // ~900 ms of easing per new search; none on a clear (focus === null).
      deadlineRef.current = st.searchFocus ? performance.now() + 900 : 0;
    }
    if (performance.now() > deadlineRef.current) return;
    const focus = st.searchFocus;
    if (!focus || !controls?.target) return;
    controls.target.lerp(_focusVec.set(focus.x, focus.y, focus.z), 0.08);
    controls.update?.();
  });
  return null;
}

export function Scene() {
  return (
    <>
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={5}
        maxDistance={200}
      />

      <ambientLight intensity={0.06} color="#06090c" />
      <DriftingLight />
      <pointLight color="#5e3a8a" intensity={0.2} position={[0, -20, 0]} distance={80} decay={2} />
      <pointLight color="#3d7a5e" intensity={0.15} position={[30, 5, -30]} distance={60} decay={2} />

      {/* Ghost scaffold — all 8000 rest positions as a dim point cloud so
          capacity and foveation are visible before any phrase lands. */}
      <GhostScaffold />

      {/* The Tapestry — 1-draw-call instanced mesh for occupied slots. */}
      <SaccadeInstancedMesh />

      {/* Lasso overlay — runs BVH hit-test against the 8k lattice */}
      <LassoSelection />

      {/* Movement-vector traces drawn while a node migrates inward on promotion. */}
      <PromotionTraces />

      {/* Projects incoming peer (LWW) updates to viewport-edge flash markers. */}
      <PeripheralFlashBridge />

      {/* Origin marker */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.1, 8, 8]} />
        <meshBasicMaterial color="#4fd1c5" />
      </mesh>

      {/* Eases the camera target toward semantic-search matches (read-only). */}
      <SearchFocus />

      {/* HUD bridge — samples camera/FPS/invariants into useHudStore. */}
      <HudBridge />
    </>
  );
}
