import { Box } from 'lucide-react';
import { STATIC_REASON_TEXT } from '../scene/rigMath';
import { setUserOff, useSceneMode, useUserOff } from '../scene/sceneSettings';

export function SceneToggle() {
  const mode = useSceneMode();
  const off = useUserOff();
  const note = mode.mode === 'static' && mode.reason !== 'user-off' ? STATIC_REASON_TEXT[mode.reason] : null;
  return (
    <div className="scene-toggle">
      <button aria-pressed={!off} onClick={() => setUserOff(!off)} title="Turn the 3D background on or off">
        <Box size={16} aria-hidden="true" /> 3D background: {off ? 'off' : 'on'}
      </button>
      {note && <p className="muted small">{note}</p>}
    </div>
  );
}
