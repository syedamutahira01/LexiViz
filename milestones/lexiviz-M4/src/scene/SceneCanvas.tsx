/** The 3D layer. Loaded lazily: nothing in the app imports this file directly. It only draws; all numbers come from rigMath. */
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { PHASES } from '../data/phases';
import { useDocumentHidden } from './browserHooks';
import {
  BLOCK_COUNT, CAMERA_BASE, RING_RADIUS, SMOOTH_TIME, SPHERE_ANGLE, STATE_PROGRESS, angularDistance, blockPlacement, brightness,
  cameraFocus, expSmooth, frameloopFor, generateStars, isPhaseSlot, motionPolicy, phaseSlots, poseAt, slotAngle, smoothDamp, spinSpeed,
  type RigState,
} from './rigMath';
import { getSceneUi, setHovered, setSelected } from './sceneStore';

interface Props { target: RigState; interactive: boolean; reducedMotion: boolean }
const DEG = Math.PI / 180;
/** thickness along the tangent, length along the radius, width along the ring axis */
const BLOCK_DIMS = [0.16, 0.62, 0.5] as const;
const PHASE_DIMS = [0.46, 0.7, 0.6] as const;
const AMBER = new THREE.Color('#f5b94a');

/** Clicks on real page controls must not also select a 3D box that happens to sit behind them. */
const hitsPageControl = (ev: Event) => Boolean((ev.target as Element | null)?.closest?.('.panel, button, a, input, textarea, select, summary, nav, label'));

function labelTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#16161a'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#f2f2f4'; g.font = '700 84px system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 64, 70);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Rig({ target, interactive, reducedMotion }: Props) {
  const invalidate = useThree((s) => s.invalidate);
  const ringRef = useRef<THREE.Group>(null);
  const spinRef = useRef<THREE.Group>(null);
  const blocksRef = useRef<THREE.InstancedMesh>(null);
  const phaseRefs = useRef<(THREE.Group | null)[]>([]);
  const phaseMats = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const labelRefs = useRef<(THREE.Mesh | null)[]>([]);
  const sim = useRef({ p: STATE_PROGRESS[target], pv: 0, angle: 0, spinMul: 1, spinMulV: 0, look: new THREE.Vector3(), pos: new THREE.Vector3(CAMERA_BASE.x, CAMERA_BASE.y, CAMERA_BASE.z) });

  const blockSlots = useMemo(() => Array.from({ length: BLOCK_COUNT }, (_, i) => i).filter((i) => !isPhaseSlot(i)), []);
  const blockGeo = useMemo(() => new RoundedBoxGeometry(...BLOCK_DIMS, 3, 0.04), []);
  const phaseGeo = useMemo(() => new RoundedBoxGeometry(...PHASE_DIMS, 3, 0.05), []);
  const blockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.92, metalness: 0 }), []);
  const labels = useMemo(() => PHASES.map((_, i) => labelTexture(String(i + 1))), []);
  const slots = useMemo(() => phaseSlots(), []);
  useEffect(() => () => { blockGeo.dispose(); phaseGeo.dispose(); blockMat.dispose(); labels.forEach((t) => t.dispose()); }, [blockGeo, phaseGeo, blockMat, labels]);

  useLayoutEffect(() => {
    const mesh = blocksRef.current;
    if (!mesh) return;
    const o = new THREE.Object3D();
    blockSlots.forEach((slot, k) => {
      const b = blockPlacement(slot);
      o.position.set(b.x, b.y, 0);
      o.rotation.set(0, b.rollY, b.rotZ, 'ZYX');
      o.updateMatrix();
      mesh.setMatrixAt(k, o.matrix);
      mesh.setColorAt(k, new THREE.Color(0.1, 0.1, 0.1));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [blockSlots]);

  useEffect(() => { invalidate(); }, [target, reducedMotion, interactive, invalidate]);

  const tmp = useMemo(() => ({ c: new THREE.Color(), v: new THREE.Vector3(), want: new THREE.Vector3(), look: new THREE.Vector3() }), []);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);
    const policy = motionPolicy(reducedMotion);
    const s = sim.current;
    const ui = getSceneUi();
    const focusId = interactive ? ui.selected : null;

    // 1. one progress value drives scale, pitch and position
    const tp = STATE_PROGRESS[target];
    if (policy.snap) { s.p = tp; s.pv = 0; } else { const r = smoothDamp(s.p, tp, s.pv, SMOOTH_TIME, dt); s.p = r.value; s.pv = r.velocity; }
    const pose = poseAt(s.p);
    const ring = ringRef.current;
    if (ring) {
      ring.scale.setScalar(pose.scale);
      ring.rotation.set(-pose.pitchDeg * DEG, 0, 0);
      ring.position.set(pose.x, pose.y, 0);
    }

    // 2. clockwise spin; faster while progress is changing; paused while a phase is focused
    if (policy.snap) { s.spinMul = focusId ? 0 : 1; } else {
      const m = smoothDamp(s.spinMul, focusId ? 0 : 1, s.spinMulV, 0.25, dt); s.spinMul = m.value; s.spinMulV = m.velocity;
      s.angle -= spinSpeed(policy.spinDegPerSec, s.pv) * s.spinMul * DEG * dt;
    }
    if (spinRef.current) spinRef.current.rotation.z = s.angle;

    // 3. brightness follows the angular distance to the sphere
    const mesh = blocksRef.current;
    if (mesh) {
      blockSlots.forEach((slot, k) => {
        const b = brightness(angularDistance(slotAngle(slot) + s.angle, SPHERE_ANGLE));
        mesh.setColorAt(k, tmp.c.setScalar(b));
      });
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
    const k4 = policy.snap ? 1 : expSmooth(dt, 8);
    slots.forEach((slot, i) => {
      const b = brightness(angularDistance(slotAngle(slot) + s.angle, SPHERE_ANGLE));
      const mat = phaseMats.current[i];
      const isSel = ui.selected === PHASES[i]?.id;
      const isHov = ui.hovered === PHASES[i]?.id && interactive;
      if (mat) {
        mat.color.setScalar(0.38 + 0.62 * b);
        mat.emissive.copy(AMBER);
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, isSel ? 0.55 : isHov ? 0.25 : 0, k4);
      }
      const g = phaseRefs.current[i];
      if (g) g.scale.setScalar(THREE.MathUtils.lerp(g.scale.x, isSel ? 1.3 : 1, k4));
      const lab = labelRefs.current[i];
      if (lab) lab.rotation.z = -s.angle; // keep the numeral upright while the ring turns
    });

    // 4. camera focus on the selected phase box, back to the base view otherwise
    const cam = state.camera;
    if (focusId) {
      const idx = PHASES.findIndex((p) => p.id === focusId);
      const grp = phaseRefs.current[idx];
      if (grp) {
        grp.getWorldPosition(tmp.v);
        const f = cameraFocus(tmp.v);
        tmp.want.set(f.position.x, f.position.y, f.position.z);
        tmp.look.set(f.lookAt.x, f.lookAt.y, f.lookAt.z);
      }
    } else {
      tmp.want.set(CAMERA_BASE.x, CAMERA_BASE.y, CAMERA_BASE.z);
      tmp.look.set(0, 0, 0);
    }
    const kc = policy.snap ? 1 : expSmooth(dt, 4);
    s.pos.lerp(tmp.want, kc);
    s.look.lerp(tmp.look, kc);
    cam.position.copy(s.pos);
    cam.lookAt(s.look);
  });

  const sx = RING_RADIUS * Math.cos(SPHERE_ANGLE), sy = RING_RADIUS * Math.sin(SPHERE_ANGLE);
  return (
    <group ref={ringRef}>
      <group ref={spinRef}>
        <instancedMesh ref={blocksRef} args={[blockGeo, blockMat, blockSlots.length]} frustumCulled={false} />
        {slots.map((slot, i) => {
          const pl = blockPlacement(slot);
          const phase = PHASES[i];
          if (!phase) return null;
          return (
            <group key={phase.id} ref={(el) => { phaseRefs.current[i] = el; }} position={[pl.x, pl.y, 0]}
              onClick={(e) => { if (!interactive || hitsPageControl(e.nativeEvent)) return; e.stopPropagation(); setSelected(getSceneUi().selected === phase.id ? null : phase.id); }}
              onPointerOver={(e) => { if (!interactive || hitsPageControl(e.nativeEvent)) return; setHovered(phase.id); document.body.style.cursor = 'pointer'; }}
              onPointerOut={() => { setHovered(null); document.body.style.cursor = ''; }}>
              <mesh geometry={phaseGeo} rotation={[0, pl.rollY, pl.rotZ, 'ZYX']}>
                <meshStandardMaterial ref={(m) => { phaseMats.current[i] = m; }} color="#cfcfd4" roughness={0.85} emissive={AMBER} emissiveIntensity={0} />
              </mesh>
              <mesh ref={(el) => { labelRefs.current[i] = el; }} position={[0, 0, PHASE_DIMS[2] / 2 + 0.012]}>
                <planeGeometry args={[0.34, 0.34]} />
                <meshBasicMaterial map={labels[i] ?? null} toneMapped={false} />
              </mesh>
            </group>
          );
        })}
      </group>
      {/* the sphere is pinned at 2 o'clock; the ring turns underneath it */}
      <group position={[sx, sy, 0.45]}>
        <mesh><sphereGeometry args={[0.15, 32, 16]} /><meshBasicMaterial color="#ffffff" toneMapped={false} /></mesh>
        <mesh scale={2.6}><sphereGeometry args={[0.15, 24, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.16} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
        <mesh scale={5.2}><sphereGeometry args={[0.15, 24, 12]} /><meshBasicMaterial color="#ffffff" transparent opacity={0.05} depthWrite={false} blending={THREE.AdditiveBlending} toneMapped={false} /></mesh>
        <pointLight intensity={14} distance={9} decay={2} color="#ffffff" />
      </group>
    </group>
  );
}

function Stars() {
  const positions = useMemo(() => generateStars(), []);
  return (
    <points frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.14} sizeAttenuation color="#9a9aa6" transparent opacity={0.75} depthWrite={false} />
    </points>
  );
}

function Floor() {
  const ref = useRef<THREE.GridHelper>(null);
  useEffect(() => {
    const m = ref.current?.material as THREE.Material | undefined;
    if (m) { m.transparent = true; m.opacity = 0.5; m.depthWrite = false; }
  }, []);
  return <gridHelper ref={ref} args={[120, 120, '#202026', '#15151a']} position={[0, -6, -10]} />;
}

export default function SceneCanvas({ target, interactive, reducedMotion }: Props) {
  const hidden = useDocumentHidden();
  const root = typeof document !== 'undefined' ? document.getElementById('root') ?? undefined : undefined;
  return (
    <div className="scene-layer" data-state={target} aria-hidden="true">
      <Canvas
        frameloop={frameloopFor({ hidden, reducedMotion })}
        dpr={[1, 1.5]}
        camera={{ position: [CAMERA_BASE.x, CAMERA_BASE.y, CAMERA_BASE.z], fov: 45, near: 0.1, far: 220 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
        eventSource={root}
        eventPrefix="client"
      >
        <color attach="background" args={['#050507']} />
        <ambientLight intensity={0.45} />
        <directionalLight position={[3, 5, 6]} intensity={1.0} />
        <Stars />
        <Floor />
        <Rig target={target} interactive={interactive} reducedMotion={reducedMotion} />
      </Canvas>
    </div>
  );
}
