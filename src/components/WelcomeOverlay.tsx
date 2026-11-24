import { useEffect, useRef } from 'react';
import { enter } from '../audio/controller';
import { useAudio } from '../audio/audioStore';

/** Browsers block sound until the user acts, so music and voice start from this click. */
export function WelcomeOverlay() {
  const { entered } = useAudio();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => { btn.current?.focus(); }, []);
  if (entered) return null;
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="panel welcome">
        <h2 id="welcome-title">Welcome to LexiViz</h2>
        <p>Calm background music and an AI-generated voice explain each step, with subtitles. Your browser needs one click before it may play sound.</p>
        <div className="row">
          <button ref={btn} type="button" className="primary" onClick={() => void enter({ sound: true })}>Enter with sound</button>
          <button type="button" onClick={() => void enter({ sound: false })}>Enter without sound</button>
        </div>
      </div>
    </div>
  );
}
