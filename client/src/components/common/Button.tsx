import React, { ButtonHTMLAttributes } from 'react';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
}

export default function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon,
  children,
  disabled,
  style,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <button
      disabled={isDisabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6px',
        borderRadius: 'var(--radius)',
        fontWeight: 500,
        cursor: isDisabled ? 'not-allowed' : 'pointer',
        opacity: isDisabled ? 0.5 : 1,
        transition: 'all var(--transition)',
        whiteSpace: 'nowrap',
        ...sizeStyles[size],
        ...variantStyles[variant],
        ...style,
      }}
      {...rest}
    >
      {loading ? <span className="animate-spin" style={spinnerStyle}>⟳</span> : icon}
      {children}
    </button>
  );
}

const sizeStyles: Record<Size, React.CSSProperties> = {
  sm: { padding: '5px 10px', fontSize: '12px' },
  md: { padding: '8px 14px', fontSize: '13px' },
  lg: { padding: '10px 18px', fontSize: '14px' },
};

const variantStyles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: 'var(--accent)',
    color: '#fff',
  },
  secondary: {
    background: 'var(--bg-elevated)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)',
  },
  danger: {
    background: 'rgba(239,68,68,0.15)',
    color: 'var(--error)',
    border: '1px solid rgba(239,68,68,0.3)',
  },
};

const spinnerStyle: React.CSSProperties = {
  display: 'inline-block',
  animation: 'spin 1s linear infinite',
};
