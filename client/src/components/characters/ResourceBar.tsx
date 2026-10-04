import React from 'react';

const styles: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '4px' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  label: { fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 },
  value: { fontSize: '14px', fontWeight: 700 },
  maxLabel: { fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 },
  track: { height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: '3px', transition: 'width 0.3s ease' },
};

export default function ResourceBar({ label, current, max, color }: {
  label: string; current: number; max: number; color: string;
}) {
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <span style={styles.label}>{label}</span>
        <span style={{ ...styles.value, color }}>
          {current}<span style={styles.maxLabel}>/{max}</span>
        </span>
      </div>
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${pct}%`, background: color }} />
      </div>
    </div>
  );
}
