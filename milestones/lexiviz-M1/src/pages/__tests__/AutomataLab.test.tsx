import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';

// React Flow needs real layout measurement that happy-dom lacks, so the graph is replaced by a stub that
// reports the real data it was given. The graph geometry is checked in a real browser instead.
vi.mock('../../components/Graph', () => ({
  Graph: (p: { states: { label: string }[]; edges: unknown[]; label: string; activeState?: number }) => (
    <div data-testid="graph" data-states={p.states.length} data-edges={p.edges.length} data-active={p.activeState ?? ''}>{p.label}</div>
  ),
}));

const renderLab = () => render(<MemoryRouter initialEntries={['/automata']}><App /></MemoryRouter>);
const type = (value: string) => fireEvent.change(screen.getByLabelText('Regular expression'), { target: { value } });
const generate = () => fireEvent.click(screen.getByText('Generate'));

describe('Automata Lab UI', () => {
  it('a valid regex shows a graph', () => {
    renderLab();
    expect(screen.getByTestId('graph')).toBeInTheDocument();
  });
  it('an invalid regex shows the error with its position and no graph', () => {
    renderLab();
    type('(a|b'); generate();
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Invalid regular expression: missing closing parenthesis');
    expect(alert).toHaveTextContent('At character 1');
    expect(screen.queryByTestId('graph')).toBeNull();
  });
  it('empty input shows a helpful message instead of crashing', () => {
    renderLab();
    type(''); generate();
    expect(screen.getByRole('status')).toHaveTextContent('Enter a regular expression');
  });
  it('regenerating replaces the graph', () => {
    renderLab();
    const before = Number(screen.getByTestId('graph').getAttribute('data-states'));
    type('a'); generate();
    const after = Number(screen.getByTestId('graph').getAttribute('data-states'));
    expect(before).toBeGreaterThan(after);
    expect(after).toBe(2); // 'a' builds two NFA states
  });
  it('example chips generate immediately', () => {
    renderLab();
    fireEvent.click(screen.getByRole('button', { name: 'a|b' }));
    expect(screen.getByTestId('graph').getAttribute('data-states')).toBe('6');
  });
  it('test-string runner gives ACCEPTED / REJECTED after stepping to the end', () => {
    renderLab();
    type('ab*'); generate();
    fireEvent.click(screen.getByRole('tab', { name: 'Test string' }));
    fireEvent.change(screen.getByLabelText('Test string'), { target: { value: 'abb' } });
    fireEvent.click(screen.getByText('Run'));
    for (let i = 0; i < 5; i++) fireEvent.click(screen.getByLabelText('Next step'));
    expect(screen.getByRole('status')).toHaveTextContent('ACCEPTED');
    fireEvent.change(screen.getByLabelText('Test string'), { target: { value: 'ba' } });
    fireEvent.click(screen.getByText('Run'));
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByLabelText('Next step'));
    expect(screen.getByRole('status')).toHaveTextContent('REJECTED');
  });
  it('warns about symbols outside the alphabet', () => {
    renderLab();
    fireEvent.click(screen.getByRole('tab', { name: 'Test string' }));
    fireEvent.change(screen.getByLabelText('Test string'), { target: { value: 'abz' } });
    fireEvent.click(screen.getByText('Run'));
    expect(screen.getByRole('alert')).toHaveTextContent("'z'");
  });
  it('stepping the NFA trace reveals the graph progressively', () => {
    renderLab();
    fireEvent.click(screen.getByLabelText('Reset'));
    expect(screen.getByTestId('graph').getAttribute('data-states')).toBe('0');
    fireEvent.click(screen.getByLabelText('Next step'));
    expect(screen.getByTestId('graph').getAttribute('data-states')).toBe('2');
  });
});
