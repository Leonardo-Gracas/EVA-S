import React from 'react';

interface Props {
  size?: number;
  /** show text beside the mark */
  withText?: boolean;
}

/** Marca EVA S — olho arcano com pupila em losango */
export default function EvaLogo({ size = 36, withText = true }: Props) {
  const s = size;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* ── Marca SVG ── */}
      <svg
        width={s}
        height={s}
        viewBox="0 0 36 36"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="EVA S"
      >
        <defs>
          <linearGradient id="evaGrad" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#6366f1" />
          </linearGradient>
          <linearGradient id="evaGradDark" x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#4f46e5" />
            <stop offset="100%" stopColor="#3730a3" />
          </linearGradient>
        </defs>

        {/* Hexágono de fundo */}
        <path
          d="M18 2 L32 10 L32 26 L18 34 L4 26 L4 10 Z"
          fill="url(#evaGradDark)"
          opacity="0.9"
        />

        {/* Brilho no topo */}
        <path
          d="M18 2 L32 10 L18 10 L4 10 Z"
          fill="white"
          opacity="0.06"
        />

        {/* Contorno do hexágono */}
        <path
          d="M18 2 L32 10 L32 26 L18 34 L4 26 L4 10 Z"
          stroke="url(#evaGrad)"
          strokeWidth="1"
          fill="none"
          opacity="0.6"
        />

        {/* Olho — linha curva superior */}
        <path
          d="M9 18 Q18 10 27 18"
          stroke="url(#evaGrad)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Olho — linha curva inferior */}
        <path
          d="M9 18 Q18 26 27 18"
          stroke="url(#evaGrad)"
          strokeWidth="1.5"
          fill="none"
          strokeLinecap="round"
        />

        {/* Pupila — losango */}
        <path
          d="M18 13 L22 18 L18 23 L14 18 Z"
          fill="url(#evaGrad)"
          opacity="0.95"
        />

        {/* Reflexo na pupila */}
        <circle cx="16.5" cy="16.5" r="1" fill="white" opacity="0.5" />
      </svg>

      {/* ── Logotipo texto ── */}
      {withText && (
        <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
          <span style={{
            fontWeight: 800,
            fontSize: '15px',
            letterSpacing: '0.12em',
            color: 'var(--text-primary)',
            fontFamily: 'inherit',
          }}>
            EVA
            <span style={{ color: 'var(--accent)', marginLeft: '3px' }}>S</span>
          </span>
          <span style={{
            fontSize: '9px',
            fontWeight: 500,
            letterSpacing: '0.18em',
            color: 'var(--text-muted)',
            marginTop: '1px',
          }}>
            CAMPAIGN MANAGER
          </span>
        </div>
      )}
    </div>
  );
}
