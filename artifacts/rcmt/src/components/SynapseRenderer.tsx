import { useRef, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BufferAttribute,
  BufferGeometry,
  LineBasicMaterial,
  LineSegments,
  Box3,
  Vector3,
} from "three";
import { MeshBVH, NOT_INTERSECTED, INTERSECTED } from "three-mesh-bvh";
import {
  useSaccadeStore,
  MAX_NODES,
  STRIDE,
} from "../store/useSaccadeStore";
import { useHudStore } from "../store/useHudStore";

// Configuration
const MAX_NEIGHBORS = 3;
const MAX_EDGES = MAX_NODES * MAX_NEIGHBORS; // directed edges

export function SynapseRenderer() {
  const geomRef = useRef<BufferGeometry | null>(null);
  const lineRef = useRef<LineSegments | null>(null);
  const positions = useRef(new Float32Array(MAX_EDGES * 2 * 3));
  const colors = useRef(new Float32Array(MAX_EDGES * 2 * 3));

  const frameRef = useRef(0);
  const lastBvhSampleRef = useRef(0);
  const bvhTimingRef = useRef({ total: 0, count: 0 });
  const { camera, scene } = useThree();

  const getCollisionBVH = useSaccadeStore((s) => s.getCollisionBVH);
  const mockFrames = useSaccadeStore((s) => s.mockFrames);
  const activeFrameIndex = useSaccadeStore((s) => s.activeFrameIndex);
  const setBvhMs = useHudStore((s) => s.setBvhMs);

  // Reusable scratch objects to avoid allocations
  const _queryBox = useRef(new Box3());
  const _centroid = useRef(new Vector3());

  useEffect(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(positions.current, 3));
    g.setAttribute("color", new BufferAttribute(colors.current, 3));
    g.setDrawRange(0, 0);
    geomRef.current = g;
  }, []);

  useFrame(() => {
    const geom = geomRef.current;
    if (!geom) return;
    const bvh = getCollisionBVH();
    const frame = mockFrames[activeFrameIndex];
    if (!bvh || !frame) {
      geom.setDrawRange(0, 0);
      return;
    }

    const start = performance.now();
    // We'll gather up to MAX_NEIGHBORS neighbors per occupied node using a
    // BVH box query around the node. This avoids O(N^2) scans.
    let edgeCount = 0;

    // local refs
    const posArr = positions.current;
    const colArr = colors.current;
    const qBox = _queryBox.current;
    const centroid = _centroid.current;

    // per-frame shapecast candidate collector closure
    for (let i = 0; i < MAX_NODES; i++) {
      const off = i * STRIDE;
      const scale = frame[off + 6];
      if (scale <= 0) continue; // vacant

      const sx = frame[off + 0];
      const sy = frame[off + 1];
      const sz = frame[off + 2];

      // search radius: small constant multiple of typical visual spacing
      const r = 6.0; // calibrated radius (tunable)
      qBox.min.set(sx - r, sy - r, sz - r);
      qBox.max.set(sx + r, sy + r, sz + r);

      const candidates: number[] = [];

      // shapecast the BVH to collect triangleIndices (== slot indices)
      bvh.shapecast({
        intersectsBounds: (box: Box3) => {
          // AABB overlap
          const overlap = !(box.max.x < qBox.min.x || box.min.x > qBox.max.x || box.max.y < qBox.min.y || box.min.y > qBox.max.y || box.max.z < qBox.min.z || box.min.z > qBox.max.z);
          return overlap ? INTERSECTED : NOT_INTERSECTED;
        },
        intersectsTriangle: (_tri, triIndex: number) => {
          if (triIndex === i) return false; // skip self
          candidates.push(triIndex);
          return false;
        },
      });

      if (candidates.length === 0) continue;

      // compute k nearest from candidates
      candidates.sort((a, b) => {
        const ao = a * STRIDE;
        const bo = b * STRIDE;
        const dxA = frame[ao] - sx;
        const dyA = frame[ao + 1] - sy;
        const dzA = frame[ao + 2] - sz;
        const da = dxA * dxA + dyA * dyA + dzA * dzA;
        const dxB = frame[bo] - sx;
        const dyB = frame[bo + 1] - sy;
        const dzB = frame[bo + 2] - sz;
        const db = dxB * dxB + dyB * dyB + dzB * dzB;
        return da - db;
      });

      const neighbors = candidates.slice(0, MAX_NEIGHBORS);

      for (const nb of neighbors) {
        if (edgeCount >= MAX_EDGES) break;
        const noff = nb * STRIDE;

        // vertex A
        const vi = edgeCount * 6;
        posArr[vi + 0] = sx;
        posArr[vi + 1] = sy;
        posArr[vi + 2] = sz;
        const ar = frame[off + 3];
        const ag = frame[off + 4];
        const ab = frame[off + 5];
        colArr[vi + 0] = ar;
        colArr[vi + 1] = ag;
        colArr[vi + 2] = ab;

        // vertex B
        posArr[vi + 3] = frame[noff + 0];
        posArr[vi + 4] = frame[noff + 1];
        posArr[vi + 5] = frame[noff + 2];
        const br = frame[noff + 3];
        const bg = frame[noff + 4];
        const bb = frame[noff + 5];
        colArr[vi + 3] = br;
        colArr[vi + 4] = bg;
        colArr[vi + 5] = bb;

        edgeCount++;
      }
    }

    const vertexCount = edgeCount * 2;
    geom.setDrawRange(0, vertexCount);
    const posAttr = geom.getAttribute("position") as BufferAttribute;
    const colAttr = geom.getAttribute("color") as BufferAttribute;
    posAttr.needsUpdate = true;
    colAttr.needsUpdate = true;

    const elapsed = performance.now() - start;
    bvhTimingRef.current.total += elapsed;
    bvhTimingRef.current.count += 1;
    const now = performance.now();
    if (now - lastBvhSampleRef.current >= 250) {
      const avg = bvhTimingRef.current.count
        ? bvhTimingRef.current.total / bvhTimingRef.current.count
        : 0;
      setBvhMs(avg);
      bvhTimingRef.current.total = 0;
      bvhTimingRef.current.count = 0;
      lastBvhSampleRef.current = now;
    }

    // LineSegments and material are created once in the mount effect; here
    // we only update geometry attributes.
    frameRef.current++;
  });

  // Create LineSegments once and attach to R3F scene to avoid React per-vertex
  // reconciliation and keep a single draw call. We create the material and
  // add the lines on mount, then only update attributes in the frame loop.
  useEffect(() => {
    if (!geomRef.current) return;
    const mat = new LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92, depthTest: true });
    const lines = new LineSegments(geomRef.current, mat);
    lineRef.current = lines;
    scene.add(lines);
    return () => {
      scene.remove(lines);
      lines.geometry.dispose();
      mat.dispose();
    };
  }, [scene]);

  return null;
}

export default SynapseRenderer;
