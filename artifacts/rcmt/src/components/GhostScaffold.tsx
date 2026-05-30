/**
 * GhostScaffold — renders all 8000 rest positions as a dim, single-draw
 * point cloud behind the live mesh.
 *
 * Purpose: make CAPACITY visible. The live InstancedMesh only shows occupied
 * slots; without the scaffold, the user has no way to feel how much of the
 * tapestry is still empty, and no way to see the foveated spiral shape until
 * many phrases have been injected.
 *
 * Geometry is built ONCE at mount from the same `latticePosition` formula
 * the store uses. No per-frame allocation; no useFrame work. Picking is
 * unaffected (Points geometry is not raycastable by default).
 */

import { useMemo } from "react";
import { BufferAttribute, BufferGeometry } from "three";
// GOLDEN_ANGLE + NODE_DENSITY_BUBBLE come from the canonical engine module
// (NODE_DENSITY_BUBBLE is re-exported from the calibration seam) so the
// scaffold can never drift from the lattice the store actually renders.
import {
  MAX_NODES,
  GOLDEN_ANGLE,
  NODE_DENSITY_BUBBLE,
} from "../store/useSaccadeStore";

function buildScaffoldPositions(): Float32Array {
  const arr = new Float32Array(MAX_NODES * 3);
  for (let i = 0; i < MAX_NODES; i++) {
    const phi = Math.acos(1 - (2 * (i + 0.5)) / MAX_NODES);
    const theta = i * GOLDEN_ANGLE;
    const sinPhi = Math.sin(phi);
    const radius = Math.sqrt(i) * NODE_DENSITY_BUBBLE;
    arr[i * 3 + 0] = sinPhi * Math.cos(theta) * radius;
    arr[i * 3 + 1] = sinPhi * Math.sin(theta) * radius;
    arr[i * 3 + 2] = Math.cos(phi) * radius;
  }
  return arr;
}

export function GhostScaffold() {
  const geometry = useMemo(() => {
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(buildScaffoldPositions(), 3));
    return g;
  }, []);

  return (
    <points geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        color="#1a2a30"
        size={0.18}
        sizeAttenuation
        transparent
        opacity={0.45}
        depthWrite={false}
      />
    </points>
  );
}
