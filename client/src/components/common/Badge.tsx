import React from 'react';

interface BadgeProps {
  label: string;
  color?: string;
  bg?: string;
  size?: 'sm' | 'md';
  dot?: boolean;
}

export default function Badge({ label, color = 'var(--text-secondary)', bg = 'var(--bg-elevated)', size = 'md', dot }: BadgeProps) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '5px',
      padding: size === 'sm' ? '2px 7px' : '3px 9px',
      borderRadius: '100px',
      fontSize: size === 'sm' ? '11px' : '12px',
      fontWeight: 600,
      color,
      background: bg,
      whiteSpace: 'nowrap',
    }}>
      {dot && (
        <span style={{
          width: '6px',
          height: '6px',
          borderRadius: '50%',
          background: color,
          flexShrink: 0,
        }} />
      )}
      {label}
    </span>
  );
}
