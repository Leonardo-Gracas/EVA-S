import React, { InputHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Input({ label, error, hint, style, ...rest }: InputProps) {
  return (
    <div style={styles.wrapper}>
      {label && <label style={styles.label}>{label}</label>}
      <input style={{ ...styles.input, ...(error ? styles.inputError : {}), ...style }} {...rest} />
      {hint && !error && <span style={styles.hint}>{hint}</span>}
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export function Textarea({ label, error, hint, style, ...rest }: TextareaProps) {
  return (
    <div style={styles.wrapper}>
      {label && <label style={styles.label}>{label}</label>}
      <textarea
        style={{ ...styles.input, minHeight: '80px', resize: 'vertical', ...(error ? styles.inputError : {}), ...style }}
        {...rest}
      />
      {hint && !error && <span style={styles.hint}>{hint}</span>}
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, style, ...rest }: SelectProps) {
  return (
    <div style={styles.wrapper}>
      {label && <label style={styles.label}>{label}</label>}
      <select style={{ ...styles.input, ...(error ? styles.inputError : {}), ...style }} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value} style={{ background: 'var(--bg-elevated)' }}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span style={styles.error}>{error}</span>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    letterSpacing: '0.3px',
  },
  input: {
    padding: '9px 12px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    transition: 'border-color var(--transition)',
    width: '100%',
  },
  inputError: {
    borderColor: 'var(--error)',
  },
  hint: {
    fontSize: '11px',
    color: 'var(--text-muted)',
  },
  error: {
    fontSize: '11px',
    color: 'var(--error)',
  },
};
