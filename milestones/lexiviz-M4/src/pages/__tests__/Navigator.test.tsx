import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';
import { resetSceneUi } from '../../scene/sceneStore';
import { _resetWebglCacheForTests } from '../../scene/sceneSettings';

afterEach(() => { resetSceneUi(); _resetWebglCacheForTests(); localStorage.clear(); });
const home = () => render(<MemoryRouter initialEntries={['/']}><App /></MemoryRouter>);
const panel = () => screen.getByRole('complementary', { name: 'Phase details' });

describe('Compiler Pipeline Navigator (plain list, no 3D needed)', () => {
  it('lists the six phases as buttons in compiler order', () => {
    home();
    const list = screen.getByRole('list', { name: 'Compiler phases' });
    const names = within(list).getAllByRole('button').map((b) => b.textContent);
    expect(names).toHaveLength(6);
    expect(names[0]).toContain('Lexical Analysis');
    expect(names[5]).toContain('Code Generation');
  });
  it('shows what, why, input, output and how for the selected phase, and a lab link for implemented phases', () => {
    home();
    fireEvent.click(screen.getByRole('button', { name: /Lexical Analysis/ }));
    const p = panel();
    for (const label of ['What it does', 'Why it exists', 'Input', 'Output', 'How it works']) expect(within(p).getByText(label)).toBeInTheDocument();
    expect(within(p).getByRole('link', { name: 'Open the Lexer Lab' })).toHaveAttribute('href', '/lexer');
    fireEvent.click(screen.getByRole('button', { name: /Syntax Analysis/ }));
    expect(within(panel()).getByRole('link', { name: 'Open the Parser Lab' })).toHaveAttribute('href', '/parser');
  });
  it('labels the other phases theory only, with no lab link', () => {
    home();
    fireEvent.click(screen.getByRole('button', { name: /Optimization/ }));
    expect(within(panel()).getByText(/Theory only/)).toBeInTheDocument();
    expect(within(panel()).queryByRole('link')).toBeNull();
  });
  it('marks the selected phase with aria-pressed, toggles off on a second click, and closes with Escape', () => {
    home();
    const btn = screen.getByRole('button', { name: /Semantic Analysis/ });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(btn);
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(btn);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(btn).toHaveAttribute('aria-pressed', 'false');
    expect(within(panel()).getByText(/Select a phase/)).toBeInTheDocument();
  });
  it('forgets the selection when leaving Home', () => {
    const { unmount } = home();
    fireEvent.click(screen.getByRole('button', { name: /Code Generation/ }));
    unmount();
    home();
    expect(within(panel()).getByText(/Select a phase/)).toBeInTheDocument();
  });
});

describe('3D fallback and toggle (this test environment has no WebGL)', () => {
  it('shows a static backdrop and says why, while the rest of the app works', () => {
    home();
    expect(document.querySelector('.backdrop-static')).not.toBeNull();
    expect(document.querySelector('.scene-layer')).toBeNull();
    expect(screen.getByText(/3D is not available on this device/)).toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Compiler phases' })).toBeInTheDocument();
  });
  it('the 3D toggle flips, persists, and reports its state', () => {
    home();
    const toggle = screen.getByRole('button', { name: /3D background/ });
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    expect(toggle).toHaveTextContent('off');
    expect(localStorage.getItem('lexiviz.scene3d')).toBe('off');
  });
  it('the ring state follows the route: A on Home, C in a lab', () => {
    const { unmount } = home();
    expect(document.querySelector('.backdrop-static')).toHaveAttribute('data-state', 'A');
    unmount();
    render(<MemoryRouter initialEntries={['/lexer']}><App /></MemoryRouter>);
    expect(document.querySelector('.backdrop-static')).toHaveAttribute('data-state', 'C');
  });
});
