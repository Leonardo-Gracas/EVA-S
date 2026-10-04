import React from 'react';
import { MapNode } from '../../types';
import { nodeEditorRadius, wrapText } from './mapEditorUtils';

export function NodeCircle({
  node, selected, onMouseDown, onClick,
}: {
  node: MapNode; selected: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClick: (e: React.MouseEvent) => void;
}) {
  const r = nodeEditorRadius(node);
  const fontSize = Math.max(9, Math.min(13, r * 0.34));
  const charsPerLine = Math.max(5, Math.floor(2 * r * 0.85 / (fontSize * 0.62)));
  const allLines = wrapText(node.name, charsPerLine);
  const lines = allLines.slice(0, 3);
  if (allLines.length > 3) lines[2] = lines[2].slice(0, lines[2].length - 1) + '\u2026';
  const lineHeight = fontSize * 1.3;
  const startDy = -((lines.length - 1) * lineHeight) / 2;

  return (
    <g transform={`translate(${node.x},${node.y})`}
      style={{ cursor: 'grab', userSelect: 'none' }}
      onMouseDown={onMouseDown}
      onClick={onClick}
    >
      {selected && (
        <circle r={r + 6} fill="none" stroke="#f59e0b" strokeWidth={2} strokeDasharray="6 3" opacity={0.8} />
      )}
      <circle r={r} fill="var(--bg-surface)" stroke={selected ? '#f59e0b' : 'var(--border)'} strokeWidth={selected ? 2.5 : 1.5} />
      <text textAnchor="middle" dominantBaseline="central" fontSize={fontSize} fontWeight={600} fill="var(--text-primary)"
        style={{ pointerEvents: 'none' }}>
        {lines.map((line, i) => (
          <tspan key={i} x={0} dy={i === 0 ? startDy : lineHeight}>{line}</tspan>
        ))}
      </text>
      <circle cx={r - 2} cy={-(r - 2)} r={11} fill="var(--accent)" />
      <text x={r - 2} y={-(r - 2)} textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fontWeight={700} fill="#fff" style={{ pointerEvents: 'none' }}>
        {node.occupancyLimit}
      </text>
    </g>
  );
}
