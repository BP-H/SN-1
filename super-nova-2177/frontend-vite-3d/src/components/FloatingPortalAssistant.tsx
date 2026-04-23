import { Canvas, useFrame } from '@react-three/fiber';
import { Float, ContactShadows } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

function Orb() {
  const m = useRef<THREE.Mesh | null>(null);
  useFrame((_, d) => {
    if (!m.current) return;
    m.current.rotation.x += 0.45 * d;
    m.current.rotation.y += 0.35 * d;
  });
  return (
    <mesh ref={m}>
      <icosahedronGeometry args={[0.9, 0]} />
      <meshStandardMaterial color="#b8a6ff" metalness={0.6} roughness={0.25} />
    </mesh>
  );
}

export default function FloatingPortalAssistant() {
  return (
    <div className="floating-assistant">
      <div className="r3f-root">
        <Canvas camera={{ position: [0, 0, 3.2], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: false }}>
          <color attach="background" args={['#0a0b10']} />
          <ambientLight intensity={0.9} />
          <directionalLight position={[2, 3, 2]} intensity={0.9} />
          <Float speed={1} rotationIntensity={0.35} floatIntensity={0.9}>
            <Orb />
          </Float>
          <ContactShadows position={[0, -1, 0]} opacity={0.25} scale={10} blur={1.6} far={2} />
        </Canvas>
      </div>
    </div>
  );
}
