import { Component, Suspense, lazy, useEffect, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { usePrefersReducedMotion, useScrolledPast } from './browserHooks';
import { routeToState, type RigState } from './rigMath';
import { markSceneFailed, useSceneMode } from './sceneSettings';
import { setSelected } from './sceneStore';

// The 3D code (three, react-three-fiber) is a separate chunk, downloaded only when the scene is actually used.
const SceneCanvas = lazy(() => import('./SceneCanvas'));

export function StaticBackdrop({ state }: { state: RigState }) {
  return <div className="backdrop-static" data-state={state} aria-hidden="true" />;
}

class SceneBoundary extends Component<{ children: ReactNode; fallback: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { markSceneFailed(); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

export function SceneLayer() {
  const { pathname } = useLocation();
  const mode = useSceneMode();
  const reduced = usePrefersReducedMotion();
  const scrolled = useScrolledPast(pathname === '/');
  const target = routeToState(pathname, scrolled);
  useEffect(() => { if (pathname !== '/') setSelected(null); }, [pathname]);

  const fallback = <StaticBackdrop state={target} />;
  if (mode.mode === 'static') return fallback;
  return (
    <SceneBoundary fallback={fallback}>
      <Suspense fallback={fallback}>
        <SceneCanvas target={target} interactive={pathname === '/' && scrolled} reducedMotion={reduced} />
      </Suspense>
    </SceneBoundary>
  );
}
