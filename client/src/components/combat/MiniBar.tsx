import React from 'react';

export function MiniBar({ current, max, color }: { current: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((current / max) * 100)) : 0;
  return (
    <div style={{ height: 5, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden', flex: 1 }}>
      <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 3, transition: 'width 0.3s' }} />
    </div>
  );
}
