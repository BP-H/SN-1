import { Canvas, useFrame } from '@react-three/fiber';
import { ContactShadows } from '@react-three/drei';
import { useRef } from 'react';
import * as THREE from 'three';

export default function ThreeCard({ variant = 'knot' as 'knot' | 'cube' | 'ico' }) {
  return (
    <div
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--line)',
        height: 280,
        background: '#0a0b10',
      }}
    >
      <div className="r3f-root">
        <Canvas camera={{ position: [0, 0, 3.2], fov: 50 }} dpr={[1, 1.5]} gl={{ antialias: false }}>
          <color attach="background" args={['#0a0b10']} />
          <ambientLight intensity={0.8} />
          <directionalLight position={[2, 3, 2]} intensity={0.8} />
          <Spinner variant={variant} />
          <ContactShadows position={[0, -1, 0]} opacity={0.25} scale={10} blur={1.6} far={2} />
        </Canvas>
      </div>
    </div>
  );
}

function Spinner({ variant }: { variant: 'knot' | 'cube' | 'ico' }) {
  const m = useRef<THREE.Mesh | null>(null);
  useFrame((_, d) => {
    if (!m.current) return;
    m.current.rotation.x += 0.25 * d;
    m.current.rotation.y += 0.35 * d;
  });
  return (
    <mesh ref={m}>
      {variant === 'knot' && <torusKnotGeometry args={[0.7, 0.2, 120, 16]} />}
      {variant === 'cube' && <boxGeometry args={[1.2, 1.2, 1.2]} />}
      {variant === 'ico' && <icosahedronGeometry args={[0.95, 0]} />}
      <meshStandardMaterial color="#b8a6ff" metalness={0.6} roughness={0.25} />
    </mesh>
  );
}
