/**
 * Pure math for the ring rig. No React and no three: everything here is unit tested.
 * One progress value p in [0, 1] drives scale, pitch and position together:
 *   p = 0 hero arch (A), p = 0.5 mid ring (B), p = 1 compact ring (C).
 */

export type RigState = 'A' | 'B' | 'C';
export interface RigPose { scale: number; pitchDeg: number; x: number; y: number }

export const RING_RADIUS = 2;
export const BLOCK_COUNT = 42; // about 40; 42 lets six phase boxes sit exactly every 7th slot
export const PHASE_STEP = 7;
export const BASE_SPIN_DEG_PER_SEC = 12; // clockwise, inside the 10 to 15 degree range
export const SMOOTH_TIME = 0.18; // critically damped: about 3% left at 0.5 s, about 0.1% at 0.8 s
/** The sphere sits at 2 o'clock: 60 degrees clockwise from 12 o'clock, i.e. 30 degrees from +x counter-clockwise. */
export const SPHERE_ANGLE = Math.PI / 6;

export const POSES: Record<RigState, RigPose> = {
  A: { scale: 3.0, pitchDeg: 58, x: -1.5, y: -4.6 }, // hero arch: huge, pitched back, centre below the viewport
  B: { scale: 0.8, pitchDeg: 15, x: 0, y: 0 }, // mid ring: centred
  C: { scale: 0.65, pitchDeg: 0, x: 0, y: 1.55 }, // compact ring: upper middle, face-on
};
export const STATE_PROGRESS: Record<RigState, number> = { A: 0, B: 0.5, C: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Piecewise interpolation between the three poses. Scale is interpolated geometrically so zooming feels even. */
export function poseAt(progress: number): RigPose {
  const p = clamp(progress, 0, 1);
  const [from, to, t] = p <= 0.5 ? [POSES.A, POSES.B, p / 0.5] : [POSES.B, POSES.C, (p - 0.5) / 0.5];
  return {
    scale: from.scale * Math.pow(to.scale / from.scale, t),
    pitchDeg: lerp(from.pitchDeg, to.pitchDeg, t),
    x: lerp(from.x, to.x, t),
    y: lerp(from.y, to.y, t),
  };
}

/** Critically damped spring (Unity-style SmoothDamp): reaches the target without overshoot. */
export function smoothDamp(current: number, target: number, velocity: number, smoothTime: number, dt: number): { value: number; velocity: number } {
  if (dt <= 0) return { value: current, velocity };
  const omega = 2 / Math.max(0.0001, smoothTime);
  const x = omega * dt;
  const decay = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = current - target;
  const temp = (velocity + omega * change) * dt;
  let newVelocity = (velocity - omega * temp) * decay;
  let value = target + (change + temp) * decay;
  if (target - current > 0 === value > target) { value = target; newVelocity = (value - target) / dt; } // never overshoot
  return { value, velocity: newVelocity };
}

/** Frame-rate independent exponential smoothing factor, for camera moves. */
export const expSmooth = (dt: number, rate: number) => 1 - Math.exp(-Math.max(0, dt) * rate);

/** The ring spins faster while the progress value is changing, then settles back to the base speed. */
export function spinSpeed(baseDegPerSec: number, progressVelocity: number, gain = 2, maxFactor = 3.5): number {
  return baseDegPerSec * Math.min(maxFactor, 1 + gain * Math.abs(progressVelocity));
}

/** Shortest angle between two angles, in [0, PI]. */
export function angularDistance(a: number, b: number): number {
  const twoPi = Math.PI * 2;
  const d = Math.abs((((a - b) % twoPi) + twoPi) % twoPi);
  return d > Math.PI ? twoPi - d : d;
}

/** 1 right under the sphere, falling off smoothly to `floor` (dark gray) far away. */
export function brightness(distance: number, sigma = 0.42, floor = 0.1): number {
  return floor + (1 - floor) * Math.exp(-Math.pow(distance / sigma, 2));
}

/** Slot angle with slot 0 at 12 o'clock, numbered clockwise, so phase 1 starts at the top. */
export const slotAngle = (i: number, count = BLOCK_COUNT) => Math.PI / 2 - (i / count) * Math.PI * 2;

export interface BlockPlacement { angle: number; x: number; y: number; rotZ: number; rollY: number }

/**
 * Placement of block i: on the circle, pitched along the tangent like a falling domino (about 30 degrees),
 * with a slow rolling wave (lean and roll vary smoothly around the ring, so the pattern is periodic).
 */
export function blockPlacement(i: number, count = BLOCK_COUNT, radius = RING_RADIUS): BlockPlacement {
  const angle = slotAngle(i, count);
  const lean = (30 + 5 * Math.sin(2 * angle)) * (Math.PI / 180);
  const roll = 4 * Math.sin(3 * angle + 1) * (Math.PI / 180);
  return { angle, x: radius * Math.cos(angle), y: radius * Math.sin(angle), rotZ: angle - Math.PI / 2 + lean, rollY: roll };
}

/** Slots 0, 7, 14, ... hold the six pipeline phase boxes. They run clockwise from the top: phase 1 is at the top. */
export const phaseSlots = (): number[] => Array.from({ length: BLOCK_COUNT / PHASE_STEP }, (_, k) => k * PHASE_STEP);
export const isPhaseSlot = (i: number) => i % PHASE_STEP === 0;


// ---- route and capability decisions -----------------------------------------------------------------------

/** Home hero = A, Home scrolled to the navigator = B, every other page (labs, about) = C. */
export function routeToState(pathname: string, scrolled: boolean): RigState {
  if (pathname === '/') return scrolled ? 'B' : 'A';
  return 'C';
}

export type SceneMode = { mode: 'webgl' } | { mode: 'static'; reason: 'no-webgl' | 'low-power' | 'user-off' | 'error' };
export function chooseSceneMode(o: { webglAvailable: boolean; userOff: boolean; saveData: boolean; failed?: boolean }): SceneMode {
  if (o.failed) return { mode: 'static', reason: 'error' };
  if (o.userOff) return { mode: 'static', reason: 'user-off' };
  if (o.saveData) return { mode: 'static', reason: 'low-power' };
  if (!o.webglAvailable) return { mode: 'static', reason: 'no-webgl' };
  return { mode: 'webgl' };
}

export const STATIC_REASON_TEXT: Record<Extract<SceneMode, { mode: 'static' }>['reason'], string> = {
  'no-webgl': '3D is not available on this device, so a static background is shown. Everything else works.',
  'low-power': 'Data saver is on, so the 3D background is off.',
  'user-off': '3D background is off.',
  error: 'The 3D scene could not start, so a static background is shown. Everything else works.',
};

/** Reduced motion: no spin, no easing (snap to the target pose), and render only when something changes. */
export function motionPolicy(reducedMotion: boolean) {
  return reducedMotion
    ? { animate: false, spinDegPerSec: 0, snap: true }
    : { animate: true, spinDegPerSec: BASE_SPIN_DEG_PER_SEC, snap: false };
}

/** Rendering is paused while the tab is hidden. With reduced motion, frames are drawn only on demand. */
export function frameloopFor(o: { hidden: boolean; reducedMotion: boolean }): 'never' | 'demand' | 'always' {
  if (o.hidden) return 'never';
  return o.reducedMotion ? 'demand' : 'always';
}

// ---- navigator camera focus ---------------------------------------------------------------------------------
export interface Vec3 { x: number; y: number; z: number }
export const CAMERA_BASE: Vec3 = { x: 0, y: 0, z: 8 };

/** Camera pose that "focuses" a phase box: moves part of the way toward it and dollies in. */
export function cameraFocus(box: Vec3, strength = 0.45, dolly = 1.7): { position: Vec3; lookAt: Vec3 } {
  return {
    position: { x: CAMERA_BASE.x + box.x * strength, y: CAMERA_BASE.y + box.y * strength, z: CAMERA_BASE.z - dolly },
    lookAt: { x: box.x * 0.8, y: box.y * 0.8, z: box.z * 0.8 },
  };
}

// ---- starfield ---------------------------------------------------------------------------------------------
/** Small seeded PRNG so the starfield is identical on every load (and testable). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const STAR_BOUNDS = { x: 70, y: 40, zMin: -90, zMax: -35 };
/** Sparse starfield behind the ring: flat array of x, y, z triples. */
export function generateStars(count = 260, seed = 7): Float32Array {
  const rand = mulberry32(seed);
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    out[i * 3] = (rand() * 2 - 1) * STAR_BOUNDS.x;
    out[i * 3 + 1] = (rand() * 2 - 1) * STAR_BOUNDS.y;
    out[i * 3 + 2] = lerp(STAR_BOUNDS.zMin, STAR_BOUNDS.zMax, rand());
  }
  return out;
}
