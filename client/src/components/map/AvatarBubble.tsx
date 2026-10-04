import React from 'react';
import { CombatParticipant, Character } from '../../types';

export const AVATAR_COLORS = [
  '#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#8b5cf6','#ef4444','#14b8a6',
];

export function participantColor(index: number) {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function AvatarBubble({
  participant, character, color, isCurrent, size, cx, cy, isSelected, onClick,
}: {
  participant: CombatParticipant;
  character?: Character;
  color: string;
  isCurrent: boolean;
  size: number;
  cx: number;
  cy: number;
  isSelected: boolean;
  onClick?: (e: React.MouseEvent) => void;
}) {
  const initials = participant.displayName.slice(0, 2).toUpperCase();
  return (
    <g onClick={onClick} style={{ cursor: onClick ? 'pointer' : 'default' }}>
      {isCurrent && (
        <circle cx={cx} cy={cy} r={size + 4} fill="none"
          stroke="#fbbf24" strokeWidth={2} strokeDasharray="4 2" opacity={0.9} />
      )}
      {isSelected && (
        <circle cx={cx} cy={cy} r={size + 6} fill="none" stroke="white" strokeWidth={2} opacity={0.8} />
      )}
      <circle cx={cx} cy={cy} r={size} fill={color} stroke="var(--bg-base)" strokeWidth={1.5} />
      {character?.avatar ? (
        <>
          <defs>
            <clipPath id={`clip-${participant.uid}`}>
              <circle cx={cx} cy={cy} r={size} />
            </clipPath>
          </defs>
          <image
            href={character.avatar} x={cx - size} y={cy - size}
            width={size * 2} height={size * 2}
            clipPath={`url(#clip-${participant.uid})`}
            preserveAspectRatio="xMidYMid slice"
          />
        </>
      ) : (
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
          fontSize={size * 0.75} fontWeight={700} fill="white"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>
          {initials}
        </text>
      )}
    </g>
  );
}
