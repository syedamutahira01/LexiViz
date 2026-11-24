/** Pure layout helpers for graphs: longest-path layers from the start state (back edges ignored), left to right. No React here. */
export interface LayoutNode { id: number }
export interface LayoutEdge { from: number; to: number }
export interface Position { x: number; y: number }

export const COL_GAP = 150;
export const ROW_GAP = 95;

export function layoutLayers(nodes: LayoutNode[], edges: LayoutEdge[], start: number): Map<number, Position> {
  const ids = new Set(nodes.map((n) => n.id));
  const adj = new Map<number, number[]>();
  for (const e of edges) {
    if (!ids.has(e.from) || !ids.has(e.to)) continue;
    const list = adj.get(e.from);
    if (list) list.push(e.to); else adj.set(e.from, [e.to]);
  }
  // 1. find back edges with a DFS from the start; they are ignored for layering so loops do not push states left
  const state = new Map<number, 'open' | 'done'>();
  const back = new Set<string>();
  const dfsOrder: number[] = [];
  const dfs = (v: number) => {
    state.set(v, 'open');
    for (const w of adj.get(v) ?? []) {
      const st = state.get(w);
      if (st === 'open') back.add(`${v}>${w}`);
      else if (st === undefined) dfs(w);
    }
    state.set(v, 'done');
    dfsOrder.push(v);
  };
  if (ids.has(start)) dfs(start);
  // 2. longest path on the remaining DAG, in reverse post-order, so the accepting end lands in the last column
  const layer = new Map<number, number>();
  const order: number[] = [];
  const topo = [...dfsOrder].reverse();
  for (const v of topo) {
    if (!layer.has(v)) layer.set(v, 0);
    order.push(v);
    for (const w of adj.get(v) ?? []) {
      if (back.has(`${v}>${w}`)) continue;
      layer.set(w, Math.max(layer.get(w) ?? 0, (layer.get(v) as number) + 1));
    }
  }
  // states not reachable from start (e.g. fragments still being built) go in their own layers after the reachable ones
  let extra = (Math.max(-1, ...layer.values()) as number) + 1;
  for (const n of nodes) {
    if (!layer.has(n.id)) { layer.set(n.id, extra++); order.push(n.id); }
  }
  const rows = new Map<number, number>();
  const out = new Map<number, Position>();
  for (const id of order) {
    const l = layer.get(id) as number;
    const row = rows.get(l) ?? 0;
    rows.set(l, row + 1);
    out.set(id, { x: l * COL_GAP, y: row * ROW_GAP });
  }
  // centre every layer vertically around y = 0
  const heights = new Map<number, number>();
  for (const [l, count] of rows) heights.set(l, ((count - 1) * ROW_GAP) / 2);
  for (const id of order) {
    const p = out.get(id) as Position;
    p.y -= heights.get(layer.get(id) as number) as number;
  }
  return out;
}
