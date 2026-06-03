import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { InstancedMesh, PointLight, Vector2, Vector3 } from "three";
import { useHudStore } from "../store/useHudStore";
import {
  useSaccadeStore,
  MAX_NODES,
  NODE_DENSITY_BUBBLE,
  latticePosition,
} from "../store/useSaccadeStore";
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

// Distance the dive settles to once it reaches a cell — close enough to read a
// single memory, far enough that the node fills the frame without clipping.
const DIVE_TARGET_DISTANCE = 4;
const DIVE_MS = 900;
const _diveTo = new Vector3();
const _camDir = new Vector3();

/**
 * CameraDive — the work→drive surgical bridge. When the console requests a dive
 * (`useHudStore.diveRequest`), this eases the OrbitControls TARGET toward the
 * chosen cell and dollies the camera in to DIVE_TARGET_DISTANCE over DIVE_MS,
 * then releases control back to the user (who is now in drive mode). It only
 * ever moves the camera + its target — never a node, tier, or wire packet — and
 * the dolly heads straight at the target so the camera can't be stranded in
 * void or flung outside the sphere. Constant FOV throughout (no dolly-zoom).
 */
function CameraDive() {
  const controls = useThree((s) => s.controls) as
    | { target?: Vector3; update?: () => void; object?: { position: Vector3 } }
    | null;
  const camera = useThree((s) => s.camera);
  const epochRef = useRef(-1);
  const deadlineRef = useRef(0);
  useFrame(() => {
    const req = useHudStore.getState().diveRequest;
    if (!req) return;
    if (req.epoch !== epochRef.current) {
      epochRef.current = req.epoch;
      deadlineRef.current = performance.now() + DIVE_MS;
    }
    if (performance.now() > deadlineRef.current) return;
    if (!controls?.target) return;
    _diveTo.set(req.x, req.y, req.z);
    // Ease the orbit target onto the cell.
    controls.target.lerp(_diveTo, 0.1);
    // Dolly the camera toward the cell along its current view direction so the
    // approach reads as a smooth zoom-in, not a teleport. Clamp to the target
    // distance so we settle just outside the node rather than overshooting
    // through it.
    _camDir.copy(camera.position).sub(controls.target);
    const dist = _camDir.length();
    if (dist > DIVE_TARGET_DISTANCE) {
      const next = dist + (DIVE_TARGET_DISTANCE - dist) * 0.1;
      _camDir.setLength(Math.max(DIVE_TARGET_DISTANCE, next));
      camera.position.copy(controls.target).add(_camDir);
    }
    controls.update?.();
  });
  return null;
}

// Radial envelope of the populated lattice. The farthest cell sits at
// sqrt(MAX_NODES-1) * NODE_DENSITY_BUBBLE; we keep the orbit TARGET on a real
// cell region and the CAMERA itself just outside the rim so a drive can plunge
// to the dense Fact core or ride out to the farthest Dream cell, but can never
// fly off into the empty black beyond the sphere (the "never exit / never
// strand in void" constraint).
const LATTICE_RADIUS = Math.sqrt(MAX_NODES - 1) * NODE_DENSITY_BUBBLE;
const TARGET_ENVELOPE = LATTICE_RADIUS;
const CAM_ENVELOPE = LATTICE_RADIUS + 6;

/**
 * CameraContainment — DRIVE-only hard bound. OrbitControls' damping/pan/zoom can
 * otherwise carry the target and the camera arbitrarily far out. Each frame we
 * pull the orbit target back onto the lattice and ease the camera back inside
 * the rim envelope if it has drifted past it. This is the structural guarantee
 * behind "distortion-free dive that never exits the sphere or strands in void"
 * — it bounds position only; it never touches FOV, geometry, or node placement.
 * Work mode is deliberately exempt (its target is pinned to origin with pan
 * off, so it can pull back to frame the whole sphere for inspection without
 * ever stranding).
 */
function CameraContainment() {
  const controls = useThree((s) => s.controls) as
    | { target?: Vector3; update?: () => void }
    | null;
  const camera = useThree((s) => s.camera);
  useFrame(() => {
    if (!controls?.target) return;
    let touched = false;
    if (controls.target.length() > TARGET_ENVELOPE) {
      controls.target.setLength(TARGET_ENVELOPE);
      touched = true;
    }
    const len = camera.position.length();
    if (len > CAM_ENVELOPE) {
      // Ease in rather than snap so a work→drive switch (camera may start far
      // out) glides into the envelope over a few frames.
      const next = Math.max(CAM_ENVELOPE, len + (CAM_ENVELOPE - len) * 0.2);
      camera.position.setLength(next);
      touched = true;
    }
    if (touched) controls.update?.();
  });
  return null;
}

// Scratch singletons for the empty-cell picker (zero GC on click).
const _ndc = new Vector2();
const _pickPos = new Vector3();
// Pointer travel (CSS px) past which a click is treated as a drag, so orbiting
// the camera over empty space never selects a cell. Mirrors the live-mesh value.
const PICK_DRAG_PX = 5;

/**
 * EmptyCellPicker — lets a pointer pick ANY intersection, occupied OR empty, so
 * the per-cell console can open on a vacant lattice slot (to write a memory into
 * its band) — not just on live nodes. Live nodes are still picked by
 * SaccadeInstancedMesh (exact instanceId); this only handles the case where a
 * clean click misses every live node, finding the nearest rest position to the
 * pick ray. Read-only w.r.t. geometry: it reads deterministic lattice positions
 * and only sets selection. Does nothing during a lasso or a camera drag.
 */
function EmptyCellPicker() {
  const { camera, gl, raycaster, scene } = useThree();
  const downRef = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const el = gl.domElement;
    const onDown = (e: PointerEvent) => {
      downRef.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      const d = downRef.current;
      downRef.current = null;
      if (!d) return;
      // Drag (orbit/pan) — not a pick.
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) > PICK_DRAG_PX) return;
      const st = useSaccadeStore.getState();
      if (st.isLassoMode) return;
      const rect = el.getBoundingClientRect();
      _ndc.set(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1,
      );
      raycaster.setFromCamera(_ndc, camera);
      // If a live node is under the cursor, defer to SaccadeInstancedMesh's
      // exact instanceId pick (it owns occupied-cell selection).
      const mesh = scene.getObjectByProperty("isInstancedMesh", true) as
        | InstancedMesh
        | undefined;
      if (mesh) {
        const hits = raycaster.intersectObject(mesh, false);
        if (hits.length > 0) return;
      }
      // Nearest rest position to the pick ray, gated by a depth-scaled tolerance
      // (so distant rim cells stay clickable), front-most wins among candidates.
      const ray = raycaster.ray;
      let best = -1;
      let bestCamDist = Infinity;
      for (let i = 0; i < MAX_NODES; i++) {
        const [px, py, pz] = latticePosition(i, st.slotTier[i]);
        _pickPos.set(px, py, pz);
        const perp = ray.distanceToPoint(_pickPos);
        const camDist = _pickPos.distanceTo(camera.position);
        const tol = 0.06 * camDist + 0.4;
        if (perp <= tol && camDist < bestCamDist) {
          best = i;
          bestCamDist = camDist;
        }
      }
      if (best >= 0) st.setSelectedSlots(new Set([best]));
    };
    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointerup", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointerup", onUp);
    };
  }, [camera, gl, raycaster, scene]);
  return null;
}

export function Scene() {
  const cameraMode = useHudStore((s) => s.cameraMode);
  return (
    <>
      {cameraMode === "drive" ? (
        // DRIVE — distortion-free scale dive. Still OrbitControls (constant FOV,
        // so there is NO dolly-zoom warping), but tuned as a piloting rig:
        // faster damped zoom + keyboard pan/dolly to push the target out to any
        // cell, including the farthest rim. Crucially `zoomToCursor` is OFF, so
        // the dolly always heads at the orbit target (which lives in/near the
        // sphere) — you can plunge into the dense Fact core or ride a panned
        // target out to a rim cell, but you can never be stranded in empty void
        // or flung outside the lattice. minDistance lets you reach the core;
        // maxDistance keeps the whole sphere framed at the macro end.
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.5}
          zoomSpeed={1.1}
          panSpeed={0.8}
          enablePan
          keyPanSpeed={18}
          listenToKeyEvents={
            typeof window !== "undefined" ? window : undefined
          }
          minDistance={3}
          maxDistance={CAM_ENVELOPE}
        />
      ) : (
        // WORK — the cursor is a pure pointer (hover / select / open console).
        // `zoomToCursor` is OFF by design: cursor-targeted dolly is structurally
        // removed so aiming at a node and scrolling can't slide the camera onto
        // it. Zoom is centred on the orbit target instead. enablePan is off so a
        // stray drag can't translate the view while you are picking cells; the
        // bounded min/max distance means you can inspect the core up close yet
        // never orbit your way outside the sphere.
        <OrbitControls
          makeDefault
          enableDamping
          dampingFactor={0.06}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          enablePan
          panSpeed={0.6}
          minDistance={10}
          maxDistance={180}
        />
      )}

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

      {/* Work→drive surgical dive bridge (camera-only, console-requested). */}
      <CameraDive />

      {/* DRIVE-only: hard-bound the camera + target inside the lattice envelope
          so a dive can never exit the sphere or strand in empty void. */}
      {cameraMode === "drive" && <CameraContainment />}

      {/* Lets the pointer select ANY intersection (occupied OR empty) so the
          per-cell console can open on a vacant slot, not just a live node. */}
      <EmptyCellPicker />

      {/* HUD bridge — samples camera/FPS/invariants into useHudStore. */}
      <HudBridge />
    </>
  );
}
