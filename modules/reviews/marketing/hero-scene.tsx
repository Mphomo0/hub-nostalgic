"use client";
import { Float, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";

/**
 * Hero 3D scene: a floating phone where a review request slides in and the
 * five stars fill one by one, on a loop. Decorative only; all real content is
 * in the page HTML. No external models, textures or fonts are loaded.
 */

const LOOP = 6; // seconds per cycle
const GOLD = new THREE.Color("#f2b51d");
const EMPTY = new THREE.Color("#dde0d8");

function starShape() {
  const shape = new THREE.Shape();
  const outer = 0.5;
  const inner = 0.22;
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return shape;
}

function Stars() {
  const geometry = useMemo(() => new THREE.ExtrudeGeometry(starShape(), { depth: 0.08, bevelEnabled: true, bevelSize: 0.02, bevelThickness: 0.02, bevelSegments: 2 }), []);
  const refs = useRef<(THREE.Mesh | null)[]>([]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() % LOOP;
    refs.current.forEach((mesh, i) => {
      if (!mesh) return;
      // Stars fill from 2.2s, one every 0.35s, and pop slightly as they fill.
      const fillAt = 2.2 + i * 0.35;
      const p = THREE.MathUtils.clamp((t - fillAt) / 0.25, 0, 1);
      (mesh.material as THREE.MeshStandardMaterial).color.copy(EMPTY).lerp(GOLD, p);
      const pop = p > 0 && p < 1 ? 1 + Math.sin(p * Math.PI) * 0.35 : 1;
      mesh.scale.setScalar(0.27 * pop);
      mesh.rotation.y = (1 - p) * Math.PI * 0.5;
    });
  });

  return (
    <group position={[0, -0.15, 0.13]}>
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh key={i} ref={(m) => { refs.current[i] = m; }} geometry={geometry} position={[(i - 2) * 0.3, 0, 0]}>
          <meshStandardMaterial color={EMPTY} metalness={0.3} roughness={0.35} />
        </mesh>
      ))}
    </group>
  );
}

function MessageBubble() {
  const ref = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() % LOOP;
    // Slide + fade in at 0.4s, stay, slide out at the end of the loop.
    const inP = THREE.MathUtils.smoothstep(t, 0.4, 1.1);
    const outP = THREE.MathUtils.smoothstep(t, LOOP - 0.6, LOOP);
    const p = inP - outP;
    ref.current.position.y = 0.85 + (1 - p) * 0.35;
    ref.current.scale.setScalar(0.85 + p * 0.15);
    ref.current.children.forEach((c) => {
      const m = (c as THREE.Mesh).material as THREE.MeshStandardMaterial;
      m.opacity = p;
    });
  });
  return (
    <group ref={ref} position={[0, 0.85, 0.12]}>
      <RoundedBox args={[1.5, 0.62, 0.04]} radius={0.1} smoothness={4}>
        <meshStandardMaterial color="#ffffff" transparent />
      </RoundedBox>
      <mesh position={[-0.28, 0.12, 0.03]}>
        <planeGeometry args={[0.75, 0.08]} />
        <meshStandardMaterial color="#373a35" transparent />
      </mesh>
      <mesh position={[-0.13, -0.03, 0.03]}>
        <planeGeometry args={[1.05, 0.06]} />
        <meshStandardMaterial color="#b7bab2" transparent />
      </mesh>
      <mesh position={[-0.35, -0.17, 0.03]}>
        <planeGeometry args={[0.6, 0.1]} />
        <meshStandardMaterial color="#44e843" transparent />
      </mesh>
    </group>
  );
}

function GoogleButton() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    if (!ref.current) return;
    const t = clock.getElapsedTime() % LOOP;
    const p = THREE.MathUtils.smoothstep(t, 4.2, 4.7) - THREE.MathUtils.smoothstep(t, LOOP - 0.6, LOOP);
    ref.current.scale.set(p, p, 1);
  });
  return (
    <RoundedBox ref={ref} args={[1.3, 0.34, 0.05]} radius={0.08} smoothness={4} position={[0, -0.8, 0.12]}>
      <meshStandardMaterial color="#44e843" />
    </RoundedBox>
  );
}

function Phone() {
  const group = useRef<THREE.Group>(null);
  useFrame(({ pointer }) => {
    if (!group.current) return;
    // Gentle tilt toward the pointer.
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, -0.25 + pointer.x * 0.25, 0.05);
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, 0.05 - pointer.y * 0.15, 0.05);
  });
  return (
    <group ref={group} rotation={[0.05, -0.25, 0.04]}>
      <RoundedBox args={[2.1, 4.1, 0.18]} radius={0.28} smoothness={6}>
        <meshStandardMaterial color="#373a35" metalness={0.5} roughness={0.35} />
      </RoundedBox>
      <RoundedBox args={[1.9, 3.85, 0.02]} radius={0.2} smoothness={4} position={[0, 0, 0.09]}>
        <meshStandardMaterial color="#f6f7f3" roughness={0.9} />
      </RoundedBox>
      <MessageBubble />
      <Stars />
      <GoogleButton />
    </group>
  );
}

function ReadySignal({ onReady }: { onReady: () => void }) {
  const done = useRef(false);
  useFrame(() => {
    if (!done.current) {
      done.current = true;
      onReady();
    }
  });
  return null;
}

export default function HeroScene({ onReady }: { onReady: () => void }) {
  // Pause rendering when the hero is off-screen to save battery.
  const wrapper = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(true);
  useEffect(() => {
    const el = wrapper.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={wrapper} className="h-full w-full">
      <Canvas dpr={[1, 1.75]} camera={{ position: [0, 0, 6.2], fov: 40 }} gl={{ antialias: true, powerPreference: "low-power", alpha: true }} frameloop={inView ? "always" : "never"}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={1.6} />
        <directionalLight position={[-4, -2, 2]} intensity={0.4} color="#f2b51d" />
        <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
          <Phone />
        </Float>
        <ReadySignal onReady={onReady} />
      </Canvas>
    </div>
  );
}
