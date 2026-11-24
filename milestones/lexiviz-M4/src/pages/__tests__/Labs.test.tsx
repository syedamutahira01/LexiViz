import { describe, expect, it } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../../App';

const renderAt = (path: string) => render(<MemoryRouter initialEntries={[path]}><App /></MemoryRouter>);
const typeSource = (value: string) => fireEvent.change(screen.getByLabelText('Source code'), { target: { value } });
const clickAll = (label: string, n: number) => { for (let i = 0; i < n; i++) fireEvent.click(screen.getByLabelText(label)); };
const rows = (name: string) => within(screen.getByRole('table', { name })).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));

describe('Lexer Lab', () => {
  it('shows the full token table and symbol table for the default example', () => {
    renderAt('/lexer');
    expect(rows('Tokens').map((r) => r[1])).toEqual(['KEYWORD', 'IDENTIFIER', 'ASSIGNMENT', 'INTEGER', 'SEMICOLON']);
    expect(rows('Symbol table')).toEqual([['total', 'IDENTIFIER', 'int', '25', '1']]);
  });
  it('fills the tables one token at a time when stepping from the start', () => {
    renderAt('/lexer');
    fireEvent.click(screen.getByLabelText('Reset'));
    expect(screen.getByText('No tokens yet.')).toBeInTheDocument();
    clickAll('Next step', 2);
    expect(rows('Tokens')).toHaveLength(2);
    expect(rows('Tokens')[1]).toEqual(['2', 'IDENTIFIER', 'total', '1', '5']);
    expect(rows('Symbol table')[0]?.[3]).toBe('—'); // value not seen yet: the symbol table only knows the tokens scanned so far
  });
  it('explains tie-breaking for the first lexeme', () => {
    renderAt('/lexer');
    fireEvent.click(screen.getByLabelText('Reset'));
    fireEvent.click(screen.getByLabelText('Next step'));
    expect(screen.getByText(/Equal length, so the rule listed first wins: KEYWORD/)).toBeInTheDocument();
  });
  it('reports an unexpected character with its position and keeps going', () => {
    renderAt('/lexer');
    typeSource('int a = 5 @ 6;'); fireEvent.click(screen.getByText('Scan'));
    expect(screen.getByRole('alert', { name: 'Lexical errors' })).toHaveTextContent("Unexpected character '@' at line 1, column 11");
    expect(rows('Tokens').map((r) => r[2])).toEqual(['int', 'a', '=', '5', '6', ';']);
  });
  it('empty source shows a helpful message', () => {
    renderAt('/lexer');
    typeSource(''); fireEvent.click(screen.getByText('Scan'));
    expect(screen.getByRole('status')).toHaveTextContent('Nothing to scan');
  });
});

describe('Parser Lab', () => {
  it('shows a parse tree for a valid program', () => {
    renderAt('/parser');
    const tree = screen.getByLabelText('Parse tree');
    expect(within(tree).getByText('Assignment')).toBeInTheDocument();
    expect(within(tree).getByText("OPERATOR '+'")).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Valid program');
  });
  it('the tree grows with each step', () => {
    renderAt('/parser');
    fireEvent.click(screen.getByLabelText('Reset'));
    expect(screen.queryByLabelText('Parse tree')).toBeNull();
    clickAll('Next step', 3);
    const tree = screen.getByLabelText('Parse tree');
    expect(within(tree).getAllByText(/^(Program|Statement|Assignment)$/)).toHaveLength(3);
    expect(within(tree).queryByText('Expr')).toBeNull();
  });
  it('a syntax error shows the message, the line and a caret at the column', () => {
    renderAt('/parser');
    typeSource('x = 10 + ;'); fireEvent.click(screen.getByText('Parse'));
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent("Syntax error: expected a number, a variable or '(' but found ';'");
    expect(alert).toHaveTextContent('Line 1, column 10');
    expect(screen.queryByText('Valid program')).toBeNull();
  });
  it('a missing semicolon at the end of input points past the last character', () => {
    renderAt('/parser');
    typeSource('x = 1'); fireEvent.click(screen.getByText('Parse'));
    expect(screen.getByRole('alert')).toHaveTextContent("expected ';' but found end of input");
    expect(screen.getByRole('alert')).toHaveTextContent('Line 1, column 6');
  });
  it('lexical errors stop parsing with a clear message', () => {
    renderAt('/parser');
    typeSource('x = 1 # 2;'); fireEvent.click(screen.getByText('Parse'));
    expect(screen.getByRole('alert')).toHaveTextContent('The lexer found 1 invalid character');
    expect(screen.queryByLabelText('Parse tree')).toBeNull();
  });
  it('an empty program is valid', () => {
    renderAt('/parser');
    typeSource(''); fireEvent.click(screen.getByText('Parse'));
    expect(screen.getByRole('status')).toHaveTextContent('Valid program');
  });
});
