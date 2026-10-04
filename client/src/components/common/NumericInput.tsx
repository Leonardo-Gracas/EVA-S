import React from 'react';

interface Props {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  width?: number | string;
  inputStyle?: React.CSSProperties;
  style?: React.CSSProperties;
}

export default function NumericInput({
  value, onChange, min = 0, max, step = 1, width = 80, inputStyle, style,
}: Props) {
  const canDec = min === undefined || value > min;
  const canInc = max === undefined || value < max;

  const dec = () => { if (canDec) onChange(Math.max(value - step, min ?? -Infinity)); };
  const inc = () => { if (canInc) onChange(max !== undefined ? Math.min(value + step, max) : value + step); };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9-]/g, '');
    if (raw === '' || raw === '-') return;
    const n = parseInt(raw, 10);
    if (isNaN(n)) return;
    let v = n;
    if (min !== undefined) v = Math.max(v, min);
    if (max !== undefined) v = Math.min(v, max);
    onChange(v);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'stretch', width, flexShrink: 0, ...style }}>
      <button
        type="button"
        onClick={dec}
        style={{
          width: 26, flexShrink: 0,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderRight: 'none', borderRadius: 'var(--radius-sm) 0 0 var(--radius-sm)',
          color: canDec ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: canDec ? 'pointer' : 'default',
          fontSize: 16, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none',
        }}
      >−</button>
      <input
        type="text"
        inputMode="numeric"
        value={value}
        onChange={handleChange}
        style={{
          flex: 1, minWidth: 0, textAlign: 'center',
          padding: '5px 2px',
          background: 'var(--bg-elevated)',
          border: '1px solid var(--border)',
          borderLeft: 'none', borderRight: 'none',
          color: 'var(--text-primary)', fontSize: 13, fontWeight: 600,
          outline: 'none',
          ...inputStyle,
        }}
      />
      <button
        type="button"
        onClick={inc}
        style={{
          width: 26, flexShrink: 0,
          background: 'var(--bg-surface)', border: '1px solid var(--border)',
          borderLeft: 'none', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0',
          color: canInc ? 'var(--text-primary)' : 'var(--text-muted)',
          cursor: canInc ? 'pointer' : 'default',
          fontSize: 16, fontWeight: 700,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          userSelect: 'none',
        }}
      >+</button>
    </div>
  );
}
