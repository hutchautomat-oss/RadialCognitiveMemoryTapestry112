/**
 * BVH-backed lasso & ray picking helpers for the 8k foveated lattice.
 *
 * The proxy geometry built in useSaccadeStore has exactly one triangle per
 * VRAM slot, so `triangleIndex === slotIndex` by construction (guaranteed by
 * `maxLeafTris: 1` at MeshBVH construction time).
 *
 * Lasso strategy:
 *   broad-phase (intersectsBounds): project the AABB's 8 corners to NDC,
 *     compute its NDC AABB, AABB-vs-AABB overlap with the lasso polygon's
 *     NDC AABB. Cheap and never under-includes.
 *   narrow-phase (intersectsTriangle): project the triangle centroid to NDC,
 *     run point-in-polygon. Hits go into a closure-scoped Set.
 */

import { Box3, Camera, Vector3 } from "three";
import type { MeshBVH } from "three-mesh-bvh";
import { NOT_INTERSECTED, INTERSECTED } from "three-mesh-bvh";

// Scratch vectors — module-level, zero GC.
const _corners: Vector3[] = Array.from({ length: 8 }, () => new Vector3());
const _centroid = new Vector3();

/** Polygon AABB in NDC. */
function polyBounds(poly: ReadonlyArray<[number, number]>): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of poly) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { minX, maxX, minY, maxY };
}

/** Ray-cast point-in-polygon (NDC, [-1,1] for both axes). */
function pointInPolygon(px: number, py: number, poly: ReadonlyArray<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i][0], yi = poly[i][1];
    const xj = poly[j][0], yj = poly[j][1];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Project an AABB's 8 corners to NDC; return overall NDC AABB. */
function projectBoxToNDCBounds(box: Box3, camera: Camera): {
  minX: number; maxX: number; minY: number; maxY: number;
} {
  _corners[0].set(box.min.x, box.min.y, box.min.z);
  _corners[1].set(box.max.x, box.min.y, box.min.z);
  _corners[2].set(box.min.x, box.max.y, box.min.z);
  _corners[3].set(box.max.x, box.max.y, box.min.z);
  _corners[4].set(box.min.x, box.min.y, box.max.z);
  _corners[5].set(box.max.x, box.min.y, box.max.z);
  _corners[6].set(box.min.x, box.max.y, box.max.z);
  _corners[7].set(box.max.x, box.max.y, box.max.z);

  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const c of _corners) {
    c.project(camera);
    if (c.x < minX) minX = c.x;
    if (c.x > maxX) maxX = c.x;
    if (c.y < minY) minY = c.y;
    if (c.y > maxY) maxY = c.y;
  }
  return { minX, maxX, minY, maxY };
}

/**
 * Execute a lasso hit-test against the proxy BVH.
 *
 * @param bvh      The MeshBVH built over the proxy geometry.
 * @param camera   Active 3D camera (positions + projection state).
 * @param polyNDC  Lasso polygon in normalized device coords ([-1,1]^2).
 * @returns        Set of slot indices whose proxy centroid is inside the polygon.
 */
export function executeLassoHitTest(
  bvh: MeshBVH,
  camera: Camera,
  polyNDC: ReadonlyArray<[number, number]>,
): Set<number> {
  const hits = new Set<number>();
  if (polyNDC.length < 3) return hits;

  const pb = polyBounds(polyNDC);

  bvh.shapecast({
    intersectsBounds: (box) => {
      const nb = projectBoxToNDCBounds(box, camera);
      // AABB-vs-AABB overlap in NDC.
      const overlap =
        !(nb.maxX < pb.minX || nb.minX > pb.maxX ||
          nb.maxY < pb.minY || nb.minY > pb.maxY);
      return overlap ? INTERSECTED : NOT_INTERSECTED;
    },
    intersectsTriangle: (triangle, triangleIndex) => {
      // Centroid of the proxy triangle == slot center by construction.
      _centroid.set(
        (triangle.a.x + triangle.b.x + triangle.c.x) / 3,
        (triangle.a.y + triangle.b.y + triangle.c.y) / 3,
        (triangle.a.z + triangle.b.z + triangle.c.z) / 3,
      );
      _centroid.project(camera);
      if (pointInPolygon(_centroid.x, _centroid.y, polyNDC)) {
        hits.add(triangleIndex);
      }
      return false; // never stop early — we want every hit
    },
  });

  return hits;
}
