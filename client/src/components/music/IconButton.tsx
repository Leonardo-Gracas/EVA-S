import React from 'react';

// Botao-icone discreto do player. Vive em arquivo proprio porque tanto o
// MusicPlayer quanto o painel de playlists da campanha o usam.

export default function IconButton({ children, onClick, title, active, disabled }: {
  children: React.ReactNode;
  onClick?: () => void;
  title?: string;
  active?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      title={title}
      onClick={onClick}
      disabled={disabled}
      style={{
        background: 'none', border: 'none', padding: 4,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? 'default' : 'pointer',
      }}
    >
      {children}
    </button>
  );
}
