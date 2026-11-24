import { describe, expect, it } from 'vitest';
import {
  BASE_SPIN_DEG_PER_SEC, BLOCK_COUNT, CAMERA_BASE, POSES, PHASE_STEP, SMOOTH_TIME, SPHERE_ANGLE, STAR_BOUNDS, STATE_PROGRESS,
  angularDistance, blockPlacement, brightness, cameraFocus, chooseSceneMode, expSmooth, frameloopFor, generateStars, isPhaseSlot,
  motionPolicy, phaseSlots, poseAt, routeToState, slotAngle, smoothDamp, spinSpeed,
} from '../rigMath';

describe('poses and progress', () => {
  it('matches the specified state numbers', () => {
    expect(POSES.A).toMatchObject({ scale: 3.0 });
    expect(POSES.A.pitchDeg).toBeGreaterThanOrEqual(55);
    expect(POSES.A.pitchDeg).toBeLessThanOrEqual(60);
    expect(POSES.A.y).toBeLessThan(0); // centre below the viewport
    expect(POSES.B).toMatchObject({ scale: 0.8, pitchDeg: 15, x: 0, y: 0 });
    expect(POSES.C).toMatchObject({ scale: 0.65, pitchDeg: 0 });
    expect(POSES.C.y).toBeGreaterThan(0); // upper middle
  });
  it('progress 0, 0.5 and 1 give exactly poses A, B and C', () => {
    expect(poseAt(STATE_PROGRESS.A)).toEqual(POSES.A);
    expect(poseAt(STATE_PROGRESS.B)).toEqual(POSES.B);
    expect(poseAt(STATE_PROGRESS.C)).toEqual(POSES.C);
  });
  it('clamps progress outside 0..1', () => {
    expect(poseAt(-5)).toEqual(POSES.A);
    expect(poseAt(9)).toEqual(POSES.C);
  });
  it('one progress value moves scale, pitch and position together and monotonically', () => {
    let prev = poseAt(0);
    for (let p = 0.02; p <= 1.0001; p += 0.02) {
      const cur = poseAt(p);
      expect(cur.scale).toBeLessThan(prev.scale);
      expect(cur.pitchDeg).toBeLessThanOrEqual(prev.pitchDeg);
      expect(cur.y).toBeGreaterThan(prev.y);
      prev = cur;
    }
  });
  it('scale is interpolated geometrically between A and B', () => {
    expect(poseAt(0.25).scale).toBeCloseTo(Math.sqrt(POSES.A.scale * POSES.B.scale), 10);
  });
});

describe('damped spring', () => {
  const simulate = (from: number, to: number, seconds: number, fps = 60) => {
    let s = { value: from, velocity: 0 };
    const trace: number[] = [];
    for (let i = 0; i < seconds * fps; i++) { s = smoothDamp(s.value, to, s.velocity, SMOOTH_TIME, 1 / fps); trace.push(s.value); }
    return { s, trace };
  };
  it('settles within 5 percent by 0.5 s and within 0.5 percent by 0.8 s', () => {
    expect(Math.abs(simulate(0, 1, 0.5).s.value - 1)).toBeLessThan(0.05);
    expect(Math.abs(simulate(0, 1, 0.8).s.value - 1)).toBeLessThan(0.005);
  });
  it('never overshoots and moves monotonically, in both directions', () => {
    for (const [a, b] of [[0, 1], [1, 0], [0.5, 1], [1, 0.5]] as const) {
      const { trace } = simulate(a, b, 2);
      const sign = Math.sign(b - a);
      trace.forEach((v, i) => {
        expect((v - b) * sign).toBeLessThanOrEqual(1e-9);
        if (i > 0) expect((v - (trace[i - 1] as number)) * sign).toBeGreaterThanOrEqual(-1e-9);
      });
    }
  });
  it('is stable for very large and zero time steps', () => {
    expect(smoothDamp(0, 1, 0, SMOOTH_TIME, 0)).toEqual({ value: 0, velocity: 0 });
    const big = smoothDamp(0, 1, 0, SMOOTH_TIME, 5);
    expect(big.value).toBeGreaterThan(0.99);
    expect(big.value).toBeLessThanOrEqual(1);
  });
  it('clamps at the target when it arrives with velocity, e.g. after reversing scroll mid-transition', () => {
    const fast = smoothDamp(0.99, 1, 25, SMOOTH_TIME, 1 / 60);
    expect(fast.value).toBe(1);
    expect(fast.velocity).toBe(0);
    const down = smoothDamp(0.01, 0, -25, SMOOTH_TIME, 1 / 60);
    expect(down.value).toBe(0);
  });
  it('reports a velocity that spin boost can use, and it returns to 0 at rest', () => {
    const mid = smoothDamp(0, 1, 0, SMOOTH_TIME, 0.1);
    expect(mid.velocity).toBeGreaterThan(0);
    expect(simulate(0, 1, 3).s.velocity).toBeCloseTo(0, 6);
  });
  it('expSmooth is 0 at dt 0 and approaches 1', () => {
    expect(expSmooth(0, 5)).toBe(0);
    expect(expSmooth(10, 5)).toBeGreaterThan(0.999);
    expect(expSmooth(-1, 5)).toBe(0);
  });
});

describe('spin', () => {
  it('base speed is clockwise-range 10 to 15 degrees per second', () => {
    expect(BASE_SPIN_DEG_PER_SEC).toBeGreaterThanOrEqual(10);
    expect(BASE_SPIN_DEG_PER_SEC).toBeLessThanOrEqual(15);
  });
  it('speeds up with progress velocity in either direction, and is capped', () => {
    expect(spinSpeed(12, 0)).toBe(12);
    expect(spinSpeed(12, 1)).toBeGreaterThan(12);
    expect(spinSpeed(12, -1)).toBe(spinSpeed(12, 1));
    expect(spinSpeed(12, 100)).toBe(12 * 3.5);
  });
});

describe('brightness falloff', () => {
  it('angularDistance takes the short way round', () => {
    expect(angularDistance(0.1, 2 * Math.PI - 0.1)).toBeCloseTo(0.2, 10);
    expect(angularDistance(0, Math.PI)).toBeCloseTo(Math.PI, 10);
    expect(angularDistance(1, 1 + 10 * Math.PI * 2)).toBeCloseTo(0, 6);
    expect(angularDistance(-3, 3)).toBeCloseTo(2 * Math.PI - 6, 10);
  });
  it('angularDistance is symmetric and always within [0, PI]', () => {
    expect(angularDistance(2 * Math.PI - 0.1, 0.1)).toBeCloseTo(0.2, 10);
    for (let a = -7; a <= 7; a += 0.37) for (let b = -7; b <= 7; b += 0.53) {
      const d = angularDistance(a, b);
      expect(d).toBeCloseTo(angularDistance(b, a), 9);
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(Math.PI + 1e-9);
    }
  });
  it('is 1 under the sphere, smooth and strictly decreasing, and never below the floor', () => {
    expect(brightness(0)).toBe(1);
    let prev = 1;
    for (let d = 0.05; d <= Math.PI; d += 0.05) {
      const b = brightness(d);
      if (prev > 0.1 + 1e-9) expect(b).toBeLessThan(prev); // strictly falling until it reaches the floor
      else expect(b).toBeLessThanOrEqual(prev);
      expect(b).toBeGreaterThanOrEqual(0.1);
      prev = b;
    }
    expect(brightness(Math.PI)).toBeCloseTo(0.1, 6);
    expect(brightness(0.1, 0.42, 0.3)).toBeGreaterThanOrEqual(0.3);
  });
  it('lights the blocks nearest the 2 o clock sphere, and the lit block moves as the ring spins clockwise', () => {
    const lit = (spin: number) => {
      const bs = Array.from({ length: BLOCK_COUNT }, (_, i) => brightness(angularDistance(blockPlacement(i).angle + spin, SPHERE_ANGLE)));
      return bs.indexOf(Math.max(...bs));
    };
    const at0 = lit(0);
    expect(angularDistance(blockPlacement(at0).angle, SPHERE_ANGLE)).toBeLessThan(Math.PI / BLOCK_COUNT + 1e-9);
    // spinning clockwise (negative angle) moves the lit spot to blocks with a larger base angle
    expect(lit(-0.5)).not.toBe(at0);
    expect(blockPlacement(lit(-0.5)).angle).toBeGreaterThan(blockPlacement(at0).angle);
  });
});

describe('blocks', () => {
  it('about 40 blocks on a circle, pitched about 30 degrees along the tangent with a small periodic wave', () => {
    expect(BLOCK_COUNT).toBeGreaterThanOrEqual(40);
    expect(BLOCK_COUNT).toBeLessThanOrEqual(44);
    for (let i = 0; i < BLOCK_COUNT; i++) {
      const b = blockPlacement(i);
      expect(Math.hypot(b.x, b.y)).toBeCloseTo(2, 10);
      const leanDeg = ((b.rotZ - (b.angle - Math.PI / 2)) * 180) / Math.PI;
      expect(leanDeg).toBeGreaterThanOrEqual(25 - 1e-9);
      expect(leanDeg).toBeLessThanOrEqual(35 + 1e-9);
      expect(Math.abs(b.rollY)).toBeLessThanOrEqual((4 * Math.PI) / 180 + 1e-9);
    }
    // periodic: slot N behaves like slot 0
    const a = blockPlacement(0), b = blockPlacement(BLOCK_COUNT);
    expect(a.rotZ - b.rotZ).toBeCloseTo(2 * Math.PI, 9);
    expect(b.rollY).toBeCloseTo(a.rollY, 9);
  });
  it('six phase slots, evenly spaced, phase 1 at 12 o clock going clockwise, and phase 2 starts under the 2 o clock sphere', () => {
    expect(phaseSlots()).toEqual([0, 7, 14, 21, 28, 35]);
    expect(phaseSlots().every(isPhaseSlot)).toBe(true);
    expect(isPhaseSlot(1)).toBe(false);
    expect(PHASE_STEP * 6).toBe(BLOCK_COUNT);
    expect(slotAngle(0)).toBeCloseTo(Math.PI / 2, 10);
    expect(slotAngle(7)).toBeCloseTo(Math.PI / 2 - Math.PI / 3, 10);
    expect(slotAngle(7)).toBeCloseTo(SPHERE_ANGLE, 10);
  });
});

describe('route and capability decisions', () => {
  it('Home hero = A, Home scrolled = B, labs and other pages = C', () => {
    expect(routeToState('/', false)).toBe('A');
    expect(routeToState('/', true)).toBe('B');
    for (const p of ['/automata', '/lexer', '/parser', '/about']) {
      expect(routeToState(p, false)).toBe('C');
      expect(routeToState(p, true)).toBe('C');
    }
  });
  it('falls back to a static background with a reason, and nothing depends on 3D', () => {
    expect(chooseSceneMode({ webglAvailable: true, userOff: false, saveData: false })).toEqual({ mode: 'webgl' });
    expect(chooseSceneMode({ webglAvailable: false, userOff: false, saveData: false })).toEqual({ mode: 'static', reason: 'no-webgl' });
    expect(chooseSceneMode({ webglAvailable: true, userOff: true, saveData: false })).toEqual({ mode: 'static', reason: 'user-off' });
    expect(chooseSceneMode({ webglAvailable: true, userOff: false, saveData: true })).toEqual({ mode: 'static', reason: 'low-power' });
    expect(chooseSceneMode({ webglAvailable: true, userOff: false, saveData: false, failed: true })).toEqual({ mode: 'static', reason: 'error' });
  });
  it('reduced motion stops the spin, snaps instead of easing', () => {
    expect(motionPolicy(true)).toEqual({ animate: false, spinDegPerSec: 0, snap: true });
    expect(motionPolicy(false)).toEqual({ animate: true, spinDegPerSec: BASE_SPIN_DEG_PER_SEC, snap: false });
  });
  it('pauses rendering when the tab is hidden and renders on demand with reduced motion', () => {
    expect(frameloopFor({ hidden: true, reducedMotion: false })).toBe('never');
    expect(frameloopFor({ hidden: true, reducedMotion: true })).toBe('never');
    expect(frameloopFor({ hidden: false, reducedMotion: true })).toBe('demand');
    expect(frameloopFor({ hidden: false, reducedMotion: false })).toBe('always');
  });
});

describe('camera focus', () => {
  it('moves toward the box and dollies in', () => {
    const box = { x: 1.2, y: 0.8, z: 0.3 };
    const f = cameraFocus(box);
    expect(f.position.z).toBeLessThan(CAMERA_BASE.z);
    const dist = (a: typeof box, b: typeof box) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
    expect(dist(f.position, box)).toBeLessThan(dist(CAMERA_BASE, box));
    expect(f.lookAt.x).toBeGreaterThan(0);
    expect(cameraFocus({ x: 0, y: 0, z: 0 }).position.x).toBe(0);
  });
});

describe('starfield', () => {
  it('is deterministic, sparse and inside its bounds', () => {
    const a = generateStars(), b = generateStars();
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(a.length / 3).toBeLessThanOrEqual(300);
    for (let i = 0; i < a.length; i += 3) {
      expect(Math.abs(a[i] as number)).toBeLessThanOrEqual(STAR_BOUNDS.x);
      expect(Math.abs(a[i + 1] as number)).toBeLessThanOrEqual(STAR_BOUNDS.y);
      expect(a[i + 2]).toBeGreaterThanOrEqual(STAR_BOUNDS.zMin);
      expect(a[i + 2]).toBeLessThanOrEqual(STAR_BOUNDS.zMax);
    }
    expect(Array.from(generateStars(260, 8))).not.toEqual(Array.from(a));
  });
});
