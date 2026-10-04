import React from 'react';
import { ResourceEffect } from '../../types';
import { useApp } from '../../contexts/AppContext';

export function ResourceEffectBadges({ effects }: { effects: ResourceEffect[] }) {
  const { getResourceLabel } = useApp();
  if (!effects || effects.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {effects.map((fx, i) => {
        const sign = fx.direction === 'gain' ? '+' : '−';
        const color = fx.direction === 'gain' ? '#22c55e' : '#ef4444';
        const label = getResourceLabel(fx.resource);
        return (
          <span key={i} style={{
            fontSize: '11px', fontWeight: 600, padding: '1px 6px',
            borderRadius: '100px', border: `1px solid ${color}40`,
            background: `${color}15`, color,
          }}>
            {sign}{fx.amount} {label}
          </span>
        );
      })}
    </div>
  );
}
