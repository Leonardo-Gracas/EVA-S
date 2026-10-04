import React from 'react';
import { CombatParticipant, Character, MapNode, MapPath } from '../../types';
import { participantColor } from './AvatarBubble';
import { nodeRadius } from './CombatNode';

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

const NODE_R_DEFAULT = 32;

function edgePoints(a: MapNode, b: MapNode, rAOverride?: number, rBOverride?: number) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const rA = rAOverride ?? nodeRadius(a);
  const rB = rBOverride ?? nodeRadius(b);
  return {
    x1: a.x + dx / len * rA, y1: a.y + dy / len * rA,
    x2: b.x - dx / len * rB, y2: b.y - dy / len * rB,
  };
}

export function CombatPath({
  path, nodeA, nodeB, isReachable, isExceedance,
  participants, characters,
  isAnonymousA, isAnonymousB, onClick,
}: {
  path: MapPath; nodeA: MapNode; nodeB: MapNode;
  isReachable: boolean; isExceedance: boolean;
  participants: CombatParticipant[];
  characters: Character[];
  isAnonymousA?: boolean;
  isAnonymousB?: boolean;
  onClick: (e: React.MouseEvent) => void;
}) {
  const { x1, y1, x2, y2 } = edgePoints(
    nodeA, nodeB,
    isAnonymousA ? NODE_R_DEFAULT : undefined,
    isAnonymousB ? NODE_R_DEFAULT : undefined,
  );
  const midX = (x1 + x2) / 2;
  const midY = (y1 + y2) / 2;
  const len = dist(x1, y1, x2, y2);
  const dx = (x2 - x1) / len || 0;
  const dy = (y2 - y1) / len || 0;

  const stroke = isExceedance ? '#ef4444' : isReachable ? '#fbbf24' : 'var(--border)';
  const displayCost = isExceedance ? path.distance * 2 : path.distance;

  const progressors = participants.filter(p => p.displacementProgress?.pathId === path.id);

  return (
    <g onClick={onClick} style={{ cursor: 'pointer' }}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="transparent" strokeWidth={18} />
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={stroke} strokeWidth={isReachable ? 2.5 : 1.5} />

      {progressors.map((p, i) => {
        const prog = p.displacementProgress!;
        const frac = Math.min(1, prog.fraction ?? ((prog as any).accumulated / path.distance));
        const isForward = prog.direction === 'forward';
        const sx = isForward ? x1 : x2;
        const sy = isForward ? y1 : y2;
        const ddx = isForward ? dx : -dx;
        const ddy = isForward ? dy : -dy;
        const ex = sx + ddx * frac * len;
        const ey = sy + ddy * frac * len;
        const idx = participants.indexOf(p);
        const color = participantColor(idx >= 0 ? idx : i);
        const char = characters.find(c => c.id === p.characterId);
        const initials = p.displayName.slice(0, 2).toUpperCase();
        const perpX = -ddy * (8 + i * 6);
        const perpY = ddx * (8 + i * 6);
        return (
          <g key={p.uid} style={{ pointerEvents: 'none' }}>
            <line x1={sx + perpX} y1={sy + perpY} x2={ex + perpX} y2={ey + perpY}
              stroke={color} strokeWidth={3} strokeLinecap="round" opacity={0.85} />
            <circle cx={ex + perpX} cy={ey + perpY} r={8} fill={color} stroke="var(--bg-base)" strokeWidth={1.5} />
            {char?.avatar ? (
              <>
                <defs>
                  <clipPath id={`clip-prog-${p.uid}`}>
                    <circle cx={ex + perpX} cy={ey + perpY} r={8} />
                  </clipPath>
                </defs>
                <image href={char.avatar}
                  x={ex + perpX - 8} y={ey + perpY - 8} width={16} height={16}
                  clipPath={`url(#clip-prog-${p.uid})`} preserveAspectRatio="xMidYMid slice" />
              </>
            ) : (
              <text x={ex + perpX} y={ey + perpY}
                textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={700} fill="white">
                {initials}
              </text>
            )}
            <rect x={ex + perpX - 18} y={ey + perpY + 10} width={36} height={13} rx={3}
              fill="var(--bg-base)" stroke={color} strokeWidth={1} />
            <text x={ex + perpX} y={ey + perpY + 17}
              textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={700} fill={color}>
              {(frac * path.distance).toFixed(1)}/{path.distance}m
            </text>
          </g>
        );
      })}

      <circle cx={midX} cy={midY} r={14} fill="var(--bg-elevated)" stroke={stroke} strokeWidth={1.5} />
      <text x={midX} y={midY} textAnchor="middle" dominantBaseline="middle"
        fontSize={9} fontWeight={700} fill={stroke} style={{ pointerEvents: 'none' }}>
        {displayCost}m
      </text>
    </g>
  );
}
