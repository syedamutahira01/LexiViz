import { useMemo } from 'react';
import { BaseEdge, Background, Handle, Position, ReactFlow, MarkerType, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { layoutLayers } from '../visual/layout';

export interface GraphState { id: number; label: string; accepting: boolean }
export interface GraphEdge { from: number; to: number; symbol: string }
export interface GraphProps {
  states: GraphState[];
  edges: GraphEdge[];
  start: number;
  activeState?: number;
  activeEdge?: { from: number; to: number };
  newStates?: number[];
  rejected?: boolean;
  label: string;
}

type NodeData = { label: string; accepting: boolean; isStart: boolean; active: boolean; isNew: boolean; rejected: boolean };

function StateNode({ data }: NodeProps<Node<NodeData>>) {
  const cls = ['state', data.accepting ? 'accepting' : '', data.isStart ? 'is-start' : '', data.active ? (data.rejected ? 'rejected' : 'active') : '', data.isNew ? 'new' : ''].join(' ');
  return (
    <div className={cls}>
      <Handle type="target" position={Position.Left} className="hidden-handle" />
      <span>{data.label}</span>
      <Handle type="source" position={Position.Right} className="hidden-handle" />
    </div>
  );
}

type EdgeData = { label: string; dashed: boolean; active: boolean; loop: boolean };

function TransitionEdge({ id, sourceX, sourceY, targetX, targetY, data, markerEnd }: EdgeProps<Edge<EdgeData>>) {
  const d = data as EdgeData;
  let path: string; let lx: number; let ly: number;
  if (d.loop) {
    path = `M ${sourceX} ${sourceY} C ${sourceX + 25} ${sourceY - 70}, ${targetX - 25} ${targetY - 70}, ${targetX} ${targetY}`;
    lx = (sourceX + targetX) / 2; ly = sourceY - 52;
  } else {
    const dx = targetX - sourceX; const dy = targetY - sourceY;
    const far = Math.abs(dx) > 200 || dx < 0;
    const bend = far ? -(90 + 0.15 * Math.abs(dx)) : 0; // long forward edges bow up, back edges (dx < 0) bow down
    const len = Math.hypot(dx, dy) || 1;
    const cx = (sourceX + targetX) / 2 + (-dy / len) * bend; const cy = (sourceY + targetY) / 2 + (dx / len) * bend;
    path = bend === 0 ? `M ${sourceX} ${sourceY} L ${targetX} ${targetY}` : `M ${sourceX} ${sourceY} Q ${cx} ${cy} ${targetX} ${targetY}`;
    lx = bend === 0 ? (sourceX + targetX) / 2 : (sourceX + targetX) / 4 + cx / 2; ly = bend === 0 ? (sourceY + targetY) / 2 - 8 : (sourceY + targetY) / 4 + cy / 2;
  }
  return (
    <BaseEdge id={id} path={path} markerEnd={markerEnd} label={d.label} labelX={lx} labelY={ly}
      labelStyle={{ fill: d.active ? '#f5b94a' : '#d8d8d8', fontFamily: 'var(--mono)', fontSize: 13 }}
      labelBgStyle={{ fill: '#0b0b0d', fillOpacity: 0.85 }} labelBgPadding={[3, 2]}
      style={{ stroke: d.active ? '#f5b94a' : '#8a8a92', strokeWidth: d.active ? 2.5 : 1.4, strokeDasharray: d.dashed ? '5 4' : undefined }} />
  );
}

const nodeTypes = { state: StateNode };
const edgeTypes = { transition: TransitionEdge };

export function Graph({ states, edges, start, activeState, activeEdge, newStates = [], rejected = false, label }: GraphProps) {
  const { nodes, rfEdges } = useMemo(() => {
    const pos = layoutLayers(states, edges, start);
    const nodes: Node<NodeData>[] = states.map((s) => ({
      id: String(s.id), type: 'state', position: pos.get(s.id) ?? { x: 0, y: 0 }, draggable: false,
      data: { label: s.label, accepting: s.accepting, isStart: s.id === start, active: s.id === activeState, isNew: newStates.includes(s.id), rejected },
    }));
    // merge parallel edges (same from/to) into one labelled "a,b"
    const grouped = new Map<string, { from: number; to: number; symbols: string[] }>();
    for (const e of edges) {
      const k = `${e.from}>${e.to}`;
      const g = grouped.get(k);
      if (g) g.symbols.push(e.symbol); else grouped.set(k, { from: e.from, to: e.to, symbols: [e.symbol] });
    }
    const rfEdges: Edge<EdgeData>[] = [...grouped.values()].map((g) => ({
      id: `${g.from}>${g.to}`, source: String(g.from), target: String(g.to), type: 'transition',
      markerEnd: { type: MarkerType.ArrowClosed, color: '#8a8a92' },
      data: {
        label: g.symbols.join(','), dashed: g.symbols.every((x) => x === 'ε'), loop: g.from === g.to,
        active: activeEdge?.from === g.from && activeEdge?.to === g.to,
      },
    }));
    return { nodes, rfEdges };
  }, [states, edges, start, activeState, activeEdge, newStates, rejected]);

  return (
    <div className="graph" role="img" aria-label={label}>
      <ReactFlow key={`${states.length}-${start}`} nodes={nodes} edges={rfEdges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
        fitView fitViewOptions={{ padding: 0.25, maxZoom: 1.2 }} nodesDraggable={false} nodesConnectable={false}
        elementsSelectable={false} proOptions={{ hideAttribution: true }} colorMode="dark" minZoom={0.2}>
        <Background gap={28} color="#1b1b20" />
      </ReactFlow>
    </div>
  );
}
