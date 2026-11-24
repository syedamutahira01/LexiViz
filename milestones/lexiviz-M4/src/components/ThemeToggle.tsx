import { Palette } from 'lucide-react';
import { themeStore, useTheme } from '../theme/themeStore';

export function ThemeToggle() {
  const theme = useTheme();
  return (
    <div className="scene-toggle" style={{ marginTop: 8 }}>
      <button
        type="button"
        onClick={() => themeStore.toggle()}
        aria-label={`Current theme: ${theme === 'ice-cream' ? 'Ice Cream (Beige)' : 'Chocolate Brown'}. Click to toggle.`}
        title="Toggle between Ice Cream and Chocolate Brown themes"
      >
        <Palette size={16} aria-hidden="true" />
        {theme === 'ice-cream' ? '🍦 Ice Cream' : '🍫 Chocolate'}
      </button>
    </div>
  );
}
