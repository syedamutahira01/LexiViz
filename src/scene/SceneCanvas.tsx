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
import { useTheme } from '../theme/themeStore';

interface Props { target: RigState; interactive: boolean; reducedMotion: boolean }
const DEG = Math.PI / 180;
/** thickness along the tangent, length along the radius, width along the ring axis */
const BLOCK_DIMS = [0.16, 0.62, 0.5] as const;
const PHASE_DIMS = [0.46, 0.7, 0.6] as const;
const AMBER = new THREE.Color('#f5b94a');

/** Clicks on real page controls must not also select a 3D box that happens to sit behind them. */
const hitsPageControl = (ev: Event) => Boolean((ev.target as Element | null)?.closest?.('.panel, button, a, input, textarea, select, summary, nav, label'));

function labelTexture(text: string, isChoc: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = isChoc ? '#2d1e19' : '#fdf8f0';
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = isChoc ? '#f7eee9' : '#342319';
    g.font = '700 84px system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, 64, 70);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function Rig({ target, interactive, reducedMotion, isChoc }: Props & { isChoc: boolean }) {
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
  const blockMat = useMemo(() => new THREE.MeshStandardMaterial({ color: isChoc ? '#3d2b24' : '#ffffff', roughness: 0.92, metalness: 0 }), [isChoc]);
  const labels = useMemo(() => PHASES.map((_, i) => labelTexture(String(i + 1), isChoc)), [isChoc]);
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
      mesh.setColorAt(k, new THREE.Color(isChoc ? 0.22 : 0.88, isChoc ? 0.16 : 0.84, isChoc ? 0.13 : 0.78));
    });
    mesh.instanceMatrix.needsUpdate = true;
  }, [blockSlots, isChoc]);

  useEffect(() => { invalidate(); }, [target, reducedMotion, interactive, invalidate, isChoc]);

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
        if (isChoc) {
          tmp.c.setRGB(0.22 + 0.55 * b, 0.16 + 0.42 * b, 0.13 + 0.35 * b);
        } else {
          tmp.c.setRGB(0.72 + 0.28 * b, 0.66 + 0.32 * b, 0.58 + 0.38 * b);
        }
        mesh.setColorAt(k, tmp.c);
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
        if (isChoc) {
          mat.color.setRGB(0.35 + 0.55 * b, 0.26 + 0.45 * b, 0.22 + 0.4 * b);
        } else {
          mat.color.setRGB(0.75 + 0.24 * b, 0.7 + 0.26 * b, 0.64 + 0.3 * b);
        }
        mat.emissive.copy(AMBER);
        mat.emissiveIntensity = THREE.MathUtils.lerp(mat.emissiveIntensity, isSel ? 0.65 : isHov ? 0.3 : 0, k4);
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
                <meshStandardMaterial ref={(m) => { phaseMats.current[i] = m; }} color={isChoc ? '#6a4e42' : '#ebd8c5'} roughness={0.85} emissive={AMBER} emissiveIntensity={0} />
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
        <pointLight intensity={isChoc ? 14 : 16} distance={9} decay={2} color="#ffffff" />
      </group>
    </group>
  );
}

function Stars({ color }: { color: string }) {
  const positions = useMemo(() => generateStars(), []);
  return (
    <points frustumCulled={false}>
      <bufferGeometry><bufferAttribute attach="attributes-position" args={[positions, 3]} /></bufferGeometry>
      <pointsMaterial size={0.14} sizeAttenuation color={color} transparent opacity={0.65} depthWrite={false} />
    </points>
  );
}

function Floor({ primary, secondary }: { primary: string; secondary: string }) {
  const ref = useRef<THREE.GridHelper>(null);
  useEffect(() => {
    const m = ref.current?.material as THREE.Material | undefined;
    if (m) { m.transparent = true; m.opacity = 0.4; m.depthWrite = false; }
  }, []);
  return <gridHelper ref={ref} args={[120, 120, primary, secondary]} position={[0, -6, -10]} />;
}

export default function SceneCanvas({ target, interactive, reducedMotion }: Props) {
  const hidden = useDocumentHidden();
  const theme = useTheme();
  const isChoc = theme === 'chocolate';
  const bgColor = isChoc ? '#211613' : '#fbf5eb';
  const floorPrimary = isChoc ? '#483027' : '#d8c4ad';
  const floorSecondary = isChoc ? '#2e1c17' : '#ebdcc9';
  const starColor = isChoc ? '#cfb5a0' : '#b89c83';
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
        <color attach="background" args={[bgColor]} />
        <ambientLight intensity={isChoc ? 0.55 : 0.85} />
        <directionalLight position={[3, 5, 6]} intensity={isChoc ? 1.0 : 1.25} />
        <Stars color={starColor} />
        <Floor primary={floorPrimary} secondary={floorSecondary} />
        <Rig target={target} interactive={interactive} reducedMotion={reducedMotion} isChoc={isChoc} />
      </Canvas>
    </div>
  );
}
