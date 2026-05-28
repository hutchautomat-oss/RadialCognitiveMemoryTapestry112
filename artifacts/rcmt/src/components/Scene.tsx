import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { OrbitControls, Stars } from "@react-three/drei";
import { Color, PointLight } from "three";
import { NodeCloud } from "./NodeCloud";

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
    lightRef.current.intensity = 0.6 + Math.sin(t * 0.7) * 0.15;
  });
  return (
    <pointLight
      ref={lightRef}
      color={new Color("#00ffff")}
      intensity={0.6}
      distance={80}
      decay={2}
    />
  );
}

export function Scene() {
  return (
    <>
      {/* Camera */}
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.5}
        zoomSpeed={0.8}
        minDistance={5}
        maxDistance={120}
      />

      {/* Lighting */}
      <ambientLight intensity={0.05} color="#000818" />
      <DriftingLight />
      <pointLight color="#8800cc" intensity={0.3} position={[0, -20, 0]} distance={70} decay={2} />
      <pointLight color="#00ff41" intensity={0.2} position={[30, 5, -30]} distance={60} decay={2} />

      {/* Star field background */}
      <Stars
        radius={150}
        depth={60}
        count={3000}
        factor={2}
        saturation={0}
        fade
        speed={0.3}
      />

      {/* The Tapestry */}
      <NodeCloud />

      {/* Origin marker — faint axis cross */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial
          color="#00ffff"
          emissive="#00ffff"
          emissiveIntensity={2}
        />
      </mesh>
    </>
  );
}
