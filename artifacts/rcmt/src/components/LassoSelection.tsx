/**
 * LassoSelection — overlay-canvas lasso UI wired to the BVH spatial index.
 *
 * Mounts inside the R3F <Canvas> tree (needs useThree for camera + gl).
 * When useStore.isLassoMode is on, attaches mouse handlers to gl.domElement,
 * draws a freeform polygon on a DOM overlay canvas, and on mouseup runs
 * executeLassoHitTest against the lazily-rebuilt proxy BVH. Hit slot indices
 * are written to useSaccadeStore.selectedSlots so SaccadeInstancedMesh can
 * highlight them and `/blast` can purge them.
 */

import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { useStore } from "../store/useStore";
import { useSaccadeStore } from "../store/useSaccadeStore";
import { executeLassoHitTest } from "../lib/bvhLasso";

export function LassoSelection() {
  const { camera, gl } = useThree();
  const isLassoMode = useStore((s) => s.isLassoMode);
  const pointsRef = useRef<[number, number][]>([]);
  const drawingRef = useRef(false);

  useEffect(() => {
    if (!isLassoMode) return;

    const dom = gl.domElement;
    const overlay = document.createElement("canvas");
    overlay.style.cssText =
      "position:fixed;inset:0;pointer-events:none;z-index:50;width:100vw;height:100vh;";
    overlay.width = dom.clientWidth;
    overlay.height = dom.clientHeight;
    document.body.appendChild(overlay);
    const ctx = overlay.getContext("2d")!;

    const resize = () => {
      overlay.width = dom.clientWidth;
      overlay.height = dom.clientHeight;
    };
    window.addEventListener("resize", resize);

    function screenToNDC(x: number, y: number): [number, number] {
      const rect = dom.getBoundingClientRect();
      return [
        ((x - rect.left) / rect.width) * 2 - 1,
        -((y - rect.top) / rect.height) * 2 + 1,
      ];
    }

    const onDown = (e: MouseEvent) => {
      drawingRef.current = true;
      pointsRef.current = [[e.clientX, e.clientY]];
      ctx.clearRect(0, 0, overlay.width, overlay.height);
    };

    const onMove = (e: MouseEvent) => {
      if (!drawingRef.current) return;
      pointsRef.current.push([e.clientX, e.clientY]);
      const pts = pointsRef.current;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.strokeStyle = "#ff8800cc";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.stroke();
      ctx.fillStyle = "#ff880018";
      ctx.fill();
    };

    const onUp = () => {
      if (!drawingRef.current) return;
      drawingRef.current = false;
      const pts = pointsRef.current;
      ctx.clearRect(0, 0, overlay.width, overlay.height);
      if (pts.length < 3) {
        pointsRef.current = [];
        return;
      }

      const ndcPoly: [number, number][] = pts.map(([x, y]) => screenToNDC(x, y));

      const bvh = useSaccadeStore.getState().getCollisionBVH();
      if (!bvh) {
        pointsRef.current = [];
        return;
      }
      const hits = executeLassoHitTest(bvh, camera, ndcPoly);
      useSaccadeStore.getState().setSelectedSlots(hits);

      console.log(`[Lasso] captured ${hits.size} slot(s)`);
      pointsRef.current = [];
    };

    dom.addEventListener("mousedown", onDown);
    dom.addEventListener("mousemove", onMove);
    dom.addEventListener("mouseup", onUp);
    dom.addEventListener("mouseleave", onUp);

    return () => {
      dom.removeEventListener("mousedown", onDown);
      dom.removeEventListener("mousemove", onMove);
      dom.removeEventListener("mouseup", onUp);
      dom.removeEventListener("mouseleave", onUp);
      window.removeEventListener("resize", resize);
      overlay.remove();
      drawingRef.current = false;
      pointsRef.current = [];
    };
  }, [isLassoMode, camera, gl]);

  return null;
}
