import type { StepEvent } from '../algorithms';

export interface TreeNode { id: number; type: string; value?: string; children: TreeNode[] }

/** Builds the (partial) AST forest from the first `upto` parse-trace steps, so the tree can grow node by node. */
export function forestFromTrace(steps: StepEvent[], upto: number): TreeNode[] {
  const nodes = new Map<number, TreeNode>();
  const childIds = new Set<number>();
  for (const s of steps.slice(0, upto)) {
    if (s.kind !== 'node') continue;
    const p = s.payload as { id: number; type: string; value?: string; children?: number[] };
    const children = (p.children ?? []).map((c) => nodes.get(c) as TreeNode);
    for (const c of p.children ?? []) childIds.add(c);
    nodes.set(p.id, { id: p.id, type: p.type, value: p.value, children });
  }
  return [...nodes.values()].filter((n) => !childIds.has(n.id));
}
