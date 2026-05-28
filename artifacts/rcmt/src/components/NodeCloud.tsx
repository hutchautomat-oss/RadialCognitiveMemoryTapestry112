import { useRef, useMemo, useCallback, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  InstancedMesh,
  Object3D,
  Color,
  Vector3,
  Plane,
  Raycaster,
  Vector2,
  MeshStandardMaterial,
  SphereGeometry,
} from "three";
import { useStore, RCMTNode } from "../store/useStore";
import { NetworkManager } from "../network/NetworkManager";

const FACT_COLOR = new Color("#00ffff");   // Cyan — high certainty, center
const MID_COLOR  = new Color("#0044ff");   // Deep blue — middle
const DREAM_COLOR = new Color("#8800cc");  // Purple — low certainty, outer rim

function nodeColor(certainty: number): Color {
  if (certainty > 0.6) return FACT_COLOR.clone().lerp(MID_COLOR, (1 - certainty) / 0.4);
  return MID_COLOR.clone().lerp(DREAM_COLOR, (0.6 - certainty) / 0.6);
}

const dummy = new Object3D();
const _color = new Color();
const _dragPlane = new Plane(new Vector3(0, 1, 0), 0);
const _hit = new Vector3();

export function NodeCloud() {
  const meshRef = useRef<InstancedMesh>(null!);
  const nodes = useStore((s) => s.nodes);
  const updateNodePosition = useStore((s) => s.updateNodePosition);
  const isLassoMode = useStore((s) => s.isLassoMode);
  const setSelectedIndices = useStore((s) => s.setSelectedIndices);
  const applyRepulsion = useStore((s) => s.applyRepulsion);

  const { camera, gl, raycaster } = useThree();

  // Drag state
  const dragRef = useRef<{
    instanceId: number;
    nodeIndex: number;
  } | null>(null);

  // Lasso state
  const lassoRef = useRef<{
    points: [number, number][];
    canvas: HTMLCanvasElement | null;
    ctx: CanvasRenderingContext2D | null;
  }>({ points: [], canvas: null, ctx: null });

  // Build geometry + material once
  const [geo] = useMemo(() => {
    const g = new SphereGeometry(1, 6, 6);
    return [g];
  }, []);

  const mat = useMemo(
    () =>
      new MeshStandardMaterial({
        emissive: new Color("#00ffff"),
        emissiveIntensity: 0.8,
        roughness: 0.2,
        metalness: 0.1,
      }),
    [],
  );

  // Update all instance matrices + colors every frame
  useFrame(() => {
    const mesh = meshRef.current;
    if (!mesh) return;

    // If dragging, follow the mouse on an invisible Y=0 plane
    if (dragRef.current) {
      raycaster.ray.intersectPlane(_dragPlane, _hit);
      const { nodeIndex } = dragRef.current;
      const n = nodes.find((n) => n.index === nodeIndex);
      if (n) {
        const pos: [number, number, number] = [_hit.x, n.position[1], _hit.z];
        updateNodePosition(nodeIndex, pos);
        NetworkManager.broadcastNodeUpdate(nodeIndex, pos[0], pos[1], pos[2], n.certainty);
      }
    }

    nodes.forEach((node, i) => {
      if (i >= mesh.count) return;
      dummy.position.set(...node.position);
      const s = node.size;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      nodeColor(node.certainty).toArray(_color as unknown as number[]);
      mesh.setColorAt(i, nodeColor(node.certainty));
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  });

  // ── Drag ──────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: { instanceId?: number; stopPropagation: () => void }) => {
      if (isLassoMode) return;
      if (e.instanceId === undefined) return;
      e.stopPropagation();

      const instanceId = e.instanceId;
      const node = nodes[instanceId];
      if (!node) return;

      dragRef.current = { instanceId, nodeIndex: node.index };
      gl.domElement.style.cursor = "grabbing";
    },
    [isLassoMode, nodes, gl],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
    gl.domElement.style.cursor = "auto";
  }, [gl]);

  const onPointerMissed = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Lasso ─────────────────────────────────────────────
  useEffect(() => {
    const canvas = gl.domElement;
    if (!isLassoMode) return;

    // Create overlay canvas for lasso drawing
    const overlay = document.createElement("canvas");
    overlay.style.cssText = `
      position:fixed; inset:0; pointer-events:none;
      z-index:50; width:100vw; height:100vh;
    `;
    overlay.width = canvas.clientWidth;
    overlay.height = canvas.clientHeight;
    document.body.appendChild(overlay);
    const ctx = overlay.getContext("2d")!;
    lassoRef.current = { points: [], canvas: overlay, ctx };

    let drawing = false;

    function screenToNDC(x: number, y: number): [number, number] {
      return [
        (x / canvas.clientWidth) * 2 - 1,
        -(y / canvas.clientHeight) * 2 + 1,
      ];
    }

    function isPointInPolygon(px: number, py: number, poly: [number, number][]) {
      let inside = false;
      for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
          inside = !inside;
        }
      }
      return inside;
    }

    const onDown = (e: MouseEvent) => {
      drawing = true;
      lassoRef.current.points = [[e.clientX, e.clientY]];
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    };

    const onMove = (e: MouseEvent) => {
      if (!drawing) return;
      lassoRef.current.points.push([e.clientX, e.clientY]);
      const pts = lassoRef.current.points;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      pts.forEach(([x, y]) => ctx.lineTo(x, y));
      ctx.closePath();
      ctx.strokeStyle = "#ff8800cc";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.fillStyle = "#ff880018";
      ctx.fill();
    };

    const onUp = () => {
      if (!drawing) return;
      drawing = false;
      const pts = lassoRef.current.points;
      if (pts.length < 3) return;

      // Convert lasso points to NDC
      const ndcPoly = pts.map(([x, y]) => screenToNDC(x, y));

      // Project each node to NDC and check containment
      const selected = new Set<number>();
      const nodeStore = useStore.getState().nodes;
      const projVec = new Vector3();
      nodeStore.forEach((node) => {
        projVec.set(...node.position).project(camera);
        if (isPointInPolygon(projVec.x, projVec.y, ndcPoly)) {
          selected.add(node.index);
        }
      });

      setSelectedIndices(selected);

      if (selected.size > 0) {
        setTimeout(() => {
          applyRepulsion(Array.from(selected));
        }, 600);
      }

      ctx.clearRect(0, 0, overlay.width, overlay.height);
    };

    canvas.addEventListener("mousedown", onDown);
    canvas.addEventListener("mousemove", onMove);
    canvas.addEventListener("mouseup", onUp);

    return () => {
      canvas.removeEventListener("mousedown", onDown);
      canvas.removeEventListener("mousemove", onMove);
      canvas.removeEventListener("mouseup", onUp);
      overlay.remove();
    };
  }, [isLassoMode, gl, camera, setSelectedIndices, applyRepulsion]);

  if (nodes.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geo, mat, nodes.length]}
      onPointerDown={onPointerDown as never}
      onPointerUp={onPointerUp}
      onPointerMissed={onPointerMissed}
      frustumCulled={false}
    />
  );
}
