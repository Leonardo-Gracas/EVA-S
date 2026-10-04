import React from 'react';
import { MapNode } from '../../types';
import { nodeEditorRadius } from './mapEditorUtils';

const ARROW_DIRS = [
  { key: 'n', dx: 0,  dy: -1 },
  { key: 's', dx: 0,  dy:  1 },
  { key: 'e', dx: 1,  dy:  0 },
  { key: 'w', dx: -1, dy:  0 },
] as const;

export function ArrowHandles({
  node, onArrowMouseDown,
}: {
  node: MapNode;
  onArrowMouseDown: (e: React.MouseEvent, dir: string) => void;
}) {
  const r = nodeEditorRadius(node);
  const d = r + 22;
  const sz = 10;

  return (
    <>
      {ARROW_DIRS.map(({ key, dx, dy }) => {
        const ax = node.x + dx * d;
        const ay = node.y + dy * d;
        let pts: string;
        if (key === 'n') pts = `0,-${sz} -${sz*0.6},0 ${sz*0.6},0`;
        else if (key === 's') pts = `0,${sz} -${sz*0.6},0 ${sz*0.6},0`;
        else if (key === 'e') pts = `${sz},0 0,-${sz*0.6} 0,${sz*0.6}`;
        else pts = `-${sz},0 0,-${sz*0.6} 0,${sz*0.6}`;
        return (
          <g key={key} transform={`translate(${ax},${ay})`}
            style={{ cursor: 'crosshair' }}
            onMouseDown={e => { e.stopPropagation(); onArrowMouseDown(e, key); }}>
            <circle r={sz + 6} fill="transparent" />
            <polygon points={pts} fill="var(--accent)" opacity={0.85} />
          </g>
        );
      })}
    </>
  );
}
