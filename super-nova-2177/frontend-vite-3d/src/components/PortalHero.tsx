import { Canvas, useFrame } from '@react-three/fiber';
import { Float, ContactShadows } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

function Knot() {
  const m = useRef<THREE.Mesh | null>(null);
  useFrame((_, d) => {
    if (!m.current) return;
    m.current.rotation.x += 0.25 * d;
    m.current.rotation.y += 0.2 * d;
  });
  return (
    <mesh ref={m}>
      <torusKnotGeometry args={[0.7, 0.22, 120, 16]} />
      <meshStandardMaterial color="#b8a6ff" metalness={0.6} roughness={0.25} />
    </mesh>
  );
}

export default function PortalHero() {
  return (
    <div className="card" style={{ overflow: 'hidden', borderRadius: 12, border: '1px solid var(--line)', height: 260, background: '#0a0b10' }}>
      <div className="r3f-root">
        <Canvas camera={{ position: [0, 0, 3.2], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: false }}>
          <color attach="background" args={['#0a0b10']} />
          <ambientLight intensity={0.85} />
          <directionalLight position={[2, 3, 2]} intensity={0.85} />
          <Float speed={1} rotationIntensity={0.35} floatIntensity={0.9}>
            <Knot />
          </Float>
          <ContactShadows position={[0, -1, 0]} opacity={0.22} scale={10} blur={1.6} far={2} />
        </Canvas>
      </div>
    </div>
  );
}
