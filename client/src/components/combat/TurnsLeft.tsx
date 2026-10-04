import React from 'react';

export function TurnsLeft({ effect, globalTurn, queueSize }: {
  effect: { durationRounds: number; expireAtGlobalTurn: number };
  globalTurn: number;
  queueSize: number;
}) {
  if (effect.durationRounds === 0) return <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>&#8734;</span>;
  const rotationsLeft = Math.ceil((effect.expireAtGlobalTurn - globalTurn) / Math.max(1, queueSize));
  if (rotationsLeft <= 0) {
    return <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 700 }} title="Expira neste turno">&#8617;</span>;
  }
  return (
    <span style={{ fontSize: 10, color: rotationsLeft === 1 ? '#f59e0b' : 'var(--text-muted)', fontWeight: 600 }}>
      {rotationsLeft}v
    </span>
  );
}
