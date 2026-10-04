import React from 'react';
import { CombatParticipant, Character, MapNode } from '../../types';
import { AvatarBubble, participantColor } from './AvatarBubble';
import { wrapText } from './mapEditorUtils';

const NODE_R_DEFAULT = 32;
export function nodeRadius(n: MapNode) { return n.radius ?? NODE_R_DEFAULT; }

export function CombatNode({
  node, participants, characters, currentUid, selectedUid,
  isReachable, isDimmed, isGM, isAnonymous,
  onNodeClick, onParticipantClick, labelFontSize: labelFontSizeProp,
  participantIndex,
}: {
  node: MapNode;
  participants: CombatParticipant[];
  characters: Character[];
  currentUid: string | undefined;
  selectedUid: string | undefined;
  isReachable: boolean;
  isDimmed: boolean;
  isGM: boolean;
  isAnonymous: boolean;
  onNodeClick: (e: React.MouseEvent, node: MapNode) => void;
  onParticipantClick: (e: React.MouseEvent, p: CombatParticipant) => void;
  labelFontSize?: number;
  participantIndex?: Map<string, number>;
}) {
  if (isAnonymous) {
    const aR = NODE_R_DEFAULT;
    return (
      <g opacity={0.45} style={{ cursor: 'default' }}>
        <circle cx={node.x} cy={node.y} r={aR}
          fill="var(--bg-elevated)" stroke="var(--border)" strokeWidth={1.5} strokeDasharray="4 3" />
        <text x={node.x} y={node.y - aR - 5}
          textAnchor="middle" fontSize={10} fill="var(--text-muted)"
          style={{ pointerEvents: 'none', userSelect: 'none' }}>?</text>
      </g>
    );
  }

  const r = nodeRadius(node);
  const occ = participants.length;
  const isOver = occ > node.occupancyLimit;

  const avatarSize = Math.min(12, (r * 0.5) / Math.max(1, Math.ceil(occ / 2)));
  const avatarPositions: { cx: number; cy: number }[] = [];
  if (occ === 1) {
    avatarPositions.push({ cx: node.x, cy: node.y });
  } else {
    const spread = Math.min(r * 0.55, avatarSize * 1.8 + 4);
    for (let i = 0; i < occ; i++) {
      const angle = (2 * Math.PI * i / occ) - Math.PI / 2;
      avatarPositions.push({ cx: node.x + spread * Math.cos(angle), cy: node.y + spread * Math.sin(angle) });
    }
  }

  const borderColor = isOver ? '#ef4444' : isReachable ? '#fbbf24' : 'var(--border)';
  const strokeWidth = isReachable ? 2.5 : 1.5;
  const fillOpacity = isDimmed ? 0.3 : 1;

  const labelFontSize = labelFontSizeProp ?? 11;
  const labelLineHeight = labelFontSize + 2;
  const charsPerLine = Math.max(8, Math.floor(2 * r * 0.9 / (labelFontSize * 0.6)));
  const allLabelLines = wrapText(node.name, charsPerLine);
  const labelLines = allLabelLines.slice(0, 3);
  if (allLabelLines.length > 3) labelLines[2] = labelLines[2].slice(0, labelLines[2].length - 1) + '…';
  const labelBaseY = node.y - r - 6;

  return (
    <g onClick={e => onNodeClick(e, node)} style={{ cursor: 'pointer' }} opacity={fillOpacity}>
      <circle cx={node.x} cy={node.y} r={r} fill="var(--bg-elevated)" stroke={borderColor} strokeWidth={strokeWidth} />
      {isOver && (
        <circle cx={node.x} cy={node.y} r={r + 4} fill="none" stroke="#ef4444" strokeWidth={1} opacity={0.4} />
      )}
      <text x={node.x} y={labelBaseY}
        textAnchor="middle" fontSize={labelFontSize} fontWeight={600} fill="var(--text-secondary)"
        style={{ pointerEvents: 'none', userSelect: 'none' }}>
        {labelLines.map((line, i) => (
          <tspan key={i} x={node.x} dy={i === 0 ? -(labelLines.length - 1) * labelLineHeight : labelLineHeight}>{line}</tspan>
        ))}
      </text>
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={node.x + r * 0.7} cy={node.y - r * 0.7} r={8}
          fill={isOver ? '#ef4444' : 'var(--bg-base)'} stroke="var(--border)" strokeWidth={1} />
        <text x={node.x + r * 0.7} y={node.y - r * 0.7}
          textAnchor="middle" dominantBaseline="middle" fontSize={7} fontWeight={700}
          fill={isOver ? '#fff' : 'var(--text-muted)'}>{occ}/{node.occupancyLimit}</text>
      </g>
      {participants.map((p, i) => {
        const char = characters.find(c => c.id === p.characterId);
        const pos = avatarPositions[i] ?? { cx: node.x, cy: node.y };
        return (
          <AvatarBubble
            key={p.uid} participant={p} character={char}
            color={participantColor(participantIndex?.get(p.uid) ?? i)} isCurrent={p.uid === currentUid}
            size={avatarSize} cx={pos.cx} cy={pos.cy}
            isSelected={p.uid === selectedUid}
            onClick={isGM ? e => { e.stopPropagation(); onParticipantClick(e, p); } : undefined}
          />
        );
      })}
    </g>
  );
}
