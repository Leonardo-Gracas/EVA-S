import React from 'react';
import { MapNode, MapPath, PathCharacteristic, PATH_CHAR_META } from '../../types';
import { nodeEditorRadius } from './mapEditorUtils';

function pathStroke(chars: PathCharacteristic[], selected: boolean): string {
  if (selected) return '#f59e0b';
  if (chars.includes('blocked'))   return PATH_CHAR_META.blocked.color;
  if (chars.includes('dangerous')) return PATH_CHAR_META.dangerous.color;
  if (chars.includes('difficult')) return PATH_CHAR_META.difficult.color;
  return '#6b7280';
}

export function PathLine({
  path, nodeA, nodeB, selected, onClick,
}: {
  path: MapPath; nodeA: MapNode; nodeB: MapNode; selected: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const stroke = pathStroke(path.characteristics, selected);
  const rA = nodeEditorRadius(nodeA), rB = nodeEditorRadius(nodeB);
  const dx = nodeB.x - nodeA.x, dy = nodeB.y - nodeA.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const x1 = nodeA.x + (dx / len) * rA, y1 = nodeA.y + (dy / len) * rA;
  const x2 = nodeB.x - (dx / len) * rB, y2 = nodeB.y - (dy / len) * rB;
  const mid = { x: (x1 + x2) / 2, y: (y1 + y2) / 2 };
  const angle = Math.atan2(dy, dx) + Math.PI / 2;

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={selected ? 3 : 2} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={16} />
      <circle cx={mid.x} cy={mid.y} r={17} fill="var(--bg-elevated)" stroke={stroke} strokeWidth={1.5} />
      <text x={mid.x} y={mid.y} textAnchor="middle" dominantBaseline="middle"
        fontSize={11} fontWeight={700} fill={stroke} style={{ pointerEvents: 'none' }}>
        {path.distance}m
      </text>
      {path.characteristics.map((c, i) => {
        const meta = PATH_CHAR_META[c];
        const bx = mid.x + Math.cos(angle) * 24 + (i - (path.characteristics.length - 1) / 2) * 18;
        const by = mid.y + Math.sin(angle) * 24;
        return (
          <g key={c} style={{ pointerEvents: 'none' }}>
            <circle cx={bx} cy={by} r={9} fill={meta.color} opacity={0.9} />
            <text x={bx} y={by} textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={700} fill="#fff">
              {meta.abbr}
            </text>
          </g>
        );
      })}
    </g>
  );
}
