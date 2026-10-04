import React, { ReactNode } from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export default function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div style={styles.header}>
      <div>
        <h1 style={styles.title}>{title}</h1>
        {subtitle && <p style={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div style={styles.actions}>{actions}</div>}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: '16px',
    marginBottom: '24px',
  },
  title: {
    fontSize: '22px',
    fontWeight: 700,
    color: 'var(--text-primary)',
    letterSpacing: '-0.4px',
  },
  subtitle: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    marginTop: '3px',
  },
  actions: {
    display: 'flex',
    gap: '8px',
    flexShrink: 0,
    flexWrap: 'wrap' as const,
  },
};
