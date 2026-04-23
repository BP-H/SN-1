// src/three/ThirteenthFloorWorld.tsx
// Real 3D "Thirteenth Floor" world (Three.js + @react-three/fiber).
// - Wireframe terrain with animated "mountains"
// - Luminous portal door with glow
// - People as billboard sprites + links to portal
// - Orbit to explore. True perspective (no fake parallax)

import * as THREE from "three";
import React, { useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { logError } from "../lib/logger";

type Person = { id: string; name?: string; color?: string };

function Terrain() {
  const mesh = useRef<THREE.Mesh>(null!);

  // Geometry once; rotate so Y is "up".
  const { geometry, base } = useMemo(() => {
    const SIZE = 1200;
    const SEG = 200;
    const g = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    g.rotateX(-Math.PI / 2);
    const base = (g.attributes.position.array as Float32Array).slice(0);
    return { geometry: g, base };
  }, []);

  // Simple procedural "ridge" height function (fast & visually close to 13th Floor)
  const height = (x: number, z: number, t: number) =>
    Math.sin(x * 0.008 + t * 0.8) * 6 +
    Math.cos(z * 0.01 - t * 1.1) * 8 +
    Math.sin((x + z) * 0.006 + t * 0.65) * 4;

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    const pos = (mesh.current.geometry as THREE.PlaneGeometry).attributes
      .position as THREE.BufferAttribute;
    const arr = pos.array as Float32Array;

    for (let i = 0; i < pos.count; i++) {
      const ix = i * 3;
      const x = base[ix + 0];
      const z = base[ix + 2];
      arr[ix + 1] = height(x, z, t);
    }
    pos.needsUpdate = true;
  });

  return (
    <mesh ref={mesh} geometry={geometry} position={[0, -14, 0]}>
      <meshBasicMaterial color={0x2eff7a} wireframe transparent opacity={0.9} />
    </mesh>
  );
}

function Portal() {
  const frameMat = useMemo(
    () => new THREE.MeshBasicMaterial({ color: 0x2eff7a }),
    []
  );
  return (
    <group>
      {/* vertical side rails */}
      <mesh material={frameMat} position={[-12, 21, 0]}>
        <boxGeometry args={[2, 42, 2]} />
      </mesh>
      <mesh material={frameMat} position={[12, 21, 0]}>
        <boxGeometry args={[2, 42, 2]} />
      </mesh>
      {/* top lintel */}
      <mesh material={frameMat} position={[0, 42, 0]}>
        <boxGeometry args={[24, 2, 2]} />
      </mesh>
      {/* inner glowing door plane */}
      <mesh position={[0, 21, 0.5]}>
        <planeGeometry args={[22, 38]} />
        <meshBasicMaterial color={0xbfffff} transparent opacity={0.95} />
      </mesh>
      {/* portal glow */}
      <pointLight color={0x2eff7a} intensity={2.6} distance={260} decay={2} position={[0, 26, 20]} />
    </group>
  );
}

function makeLabelTexture(name: string, color = "#2eff7a") {
  if (typeof document === "undefined") {
    // During SSR, return an empty texture to avoid crashes
    return new THREE.Texture();
  }
  const canvas = document.createElement("canvas");
  const dpr =
    typeof window !== "undefined"
      ? Math.min(2, window.devicePixelRatio || 1)
      : 1;
  canvas.width = 256 * dpr;
  canvas.height = 128 * dpr;
  const g = canvas.getContext("2d");
  if (!g) {
    logError(new Error("2D context not available"));
    return new THREE.CanvasTexture(canvas);
  }
  g.scale(dpr, dpr);

  g.fillStyle = "rgba(10, 20, 10, 0.1)";
  g.fillRect(0, 0, 256, 128);

  const grad = g.createRadialGradient(64, 64, 5, 64, 64, 64);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(1, color);
  g.fillStyle = grad;
  g.beginPath();
  g.arc(64, 64, 42, 0, Math.PI * 2);
  g.fill();

  g.font =
    "700 22px ui-sans-serif, system-ui, Segoe UI, Roboto, Helvetica, Arial";
  g.fillStyle = "#eafff0";
  g.textAlign = "left";
  g.textBaseline = "middle";
  g.fillText(name, 120, 64);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  return tex;
}

function People({ people }: { people: Person[] }) {
  const group = useRef<THREE.Group>(null!);

  // Build once
  useMemo(() => {
    const g = group.current;
    g.clear();

    people.forEach((p, i) => {
      const tex = makeLabelTexture(p.name || p.id, p.color);
      const mat = new THREE.SpriteMaterial({
        map: tex,
        transparent: true,
        depthWrite: false,
        opacity: 0.95,
      });
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(24, 12, 1);

      const angle = (i / Math.max(1, people.length)) * Math.PI * 2;
      const radius = 120 + (i % 5) * 24;
      sprite.position.set(
        Math.cos(angle) * radius,
        16 + (i % 3) * 4,
        Math.sin(angle) * radius
      );
      sprite.userData.baseY = sprite.position.y;
      g.add(sprite);

      // Link back to portal
      const geo = new THREE.BufferGeometry().setFromPoints([
        sprite.position.clone(),
        new THREE.Vector3(0, 21, 0),
      ]);
      const line = new THREE.Line(
        geo,
        new THREE.LineBasicMaterial({
          color: 0x2eff7a,
          transparent: true,
          opacity: 0.35,
        })
      );
      g.add(line);
    });
  }, [people]);

  useFrame((state) => {
    const t = state.clock.getElapsedTime() * 1.2;
    group.current.children.forEach((obj, idx) => {
      if (obj instanceof THREE.Sprite) {
        const baseY = obj.userData.baseY || 16;
        obj.position.y = baseY + Math.sin(t + idx) * 1.5;
      }
    });
  });

  return <group ref={group} />;
}

function Scene({ people }: { people: Person[] }) {
  const { viewport } = useThree();
  return (
    <>
      <color attach="background" args={["#050709"]} />
      <fog attach="fog" args={[new THREE.Color(0x021e0c), 40, 800]} />
      <hemisphereLight args={[0x43ff99, 0x0a1a0a, 0.6]} />
      <gridHelper args={[1200, 40, 0x2eff7a, 0x196f3d]} position={[0, -14, 0]} />
      <Portal />
      <Terrain />
      <People people={people} />
      <OrbitControls
        target={[0, 24, 0]}
        enableDamping
        dampingFactor={0.06}
        maxPolarAngle={Math.PI * 0.49}
        minDistance={40}
        maxDistance={600}
      />
    </>
  );
}

export default function ThirteenthFloorWorld({
  people = [
    { id: "taha", name: "taha_gungor", color: "#6cff6c" },
    { id: "maya", name: "maya", color: "#a6ffcf" },
    { id: "uno", name: "uno", color: "#9effb8" },
    { id: "jin", name: "jin", color: "#86ffaa" },
  ],
}: {
  people?: Person[];
}) {
  return (
    <div className="r3f-root">
      <Canvas
        camera={{ fov: 55, near: 0.1, far: 2000, position: [-90, 58, 130] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Scene people={people} />
      </Canvas>
    </div>
  );
}
