import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { X, Bell } from 'lucide-react';
import Sidebar from './Sidebar';
import TopBar from './TopBar';
import CommandPalette from './CommandPalette';
import MusicPlayer from '../music/MusicPlayer';
import { ShellContext, PaletteMode } from './ShellContext';
import { useApp } from '../../contexts/AppContext';

const COLLAPSED_KEY = 'gm.sidebar.collapsed';

function RequestToasts() {
  const { toasts, dismissToast } = useApp();
  const navigate = useNavigate();
  if (toasts.length === 0) return null;

  return (
    <div style={ts.container}>
      {toasts.map((t) => (
        <div key={t.id} style={ts.toast}>
          <Bell size={14} color="var(--accent)" style={{ flexShrink: 0, marginTop: 2 }} />
          <div style={ts.body}>
            <span style={ts.player}>{t.playerName}</span>
            <span style={ts.desc}>{t.description}</span>
          </div>
          <button style={ts.close} onClick={() => dismissToast(t.id)} title="Fechar">
            <X size={12} />
          </button>
          <button style={ts.link} onClick={() => { navigate('/requests'); dismissToast(t.id); }}>
            Ver
          </button>
        </div>
      ))}
    </div>
  );
}

/** true quando o foco está num campo de texto — atalhos de tecla única devem se calar. */
function isTyping(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable;
}

export default function Layout() {
  const { characters } = useApp();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(COLLAPSED_KEY) === '1'; } catch { return false; }
  });
  const [palette, setPalette] = useState<PaletteMode | null>(null);

  const toggleCollapsed = useCallback(() => {
    setCollapsed((prev) => {
      try { localStorage.setItem(COLLAPSED_KEY, prev ? '0' : '1'); } catch { /* storage indisponivel */ }
      return !prev;
    });
  }, []);

  const openPalette = useCallback((mode: PaletteMode = 'all') => setPalette(mode), []);
  const closePalette = useCallback(() => setPalette(null), []);

  // Ordem canônica do elenco — a mesma da barra de rostos, para que
  // "próximo/anterior" case com o que está na tela.
  const party = useMemo(
    () => characters
      .filter((c) => c.type === 'pc')
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [characters],
  );

  const stepCharacter = useCallback((delta: number) => {
    if (party.length === 0) return;
    const currentId = pathname.startsWith('/characters/') ? pathname.split('/')[2] : null;
    const index = party.findIndex((c) => c.id === currentId);
    // Fora de uma ficha, Alt+↓ entra no primeiro e Alt+↑ no último.
    const next = index === -1
      ? (delta > 0 ? 0 : party.length - 1)
      : (index + delta + party.length) % party.length;
    navigate(`/characters/${party[next].id}`);
  }, [party, pathname, navigate]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;

      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => (p ? null : 'all'));
        return;
      }
      if (mod && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleCollapsed();
        return;
      }
      // Trocar de ficha no meio de uma edição descartaria o que está sendo
      // digitado — por isso os atalhos de navegação se calam em campos de texto.
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp') && !isTyping(e.target)) {
        e.preventDefault();
        stepCharacter(e.key === 'ArrowDown' ? 1 : -1);
        return;
      }
      // Colchetes como alternativa em teclados que os têm à mão.
      if (!mod && !e.altKey && !isTyping(e.target) && (e.key === '[' || e.key === ']')) {
        e.preventDefault();
        stepCharacter(e.key === ']' ? 1 : -1);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [toggleCollapsed, stepCharacter]);

  const shell = useMemo(
    () => ({ collapsed, toggleCollapsed, paletteOpen: palette !== null, openPalette, closePalette }),
    [collapsed, toggleCollapsed, palette, openPalette, closePalette],
  );

  return (
    <ShellContext.Provider value={shell}>
      <div className="gm-shell" data-collapsed={collapsed}>
        <Sidebar />
        <TopBar />
        <main className="gm-main">
          <Outlet />
        </main>
      </div>
      {palette && <CommandPalette mode={palette} onClose={closePalette} />}
      {/* Canto inferior direito: toasts empilham acima do player da trilha
          sonora, que fica sempre montado para não cortar a música ao navegar. */}
      <div className="gm-corner-stack">
        <RequestToasts />
        <MusicPlayer />
      </div>
    </ShellContext.Provider>
  );
}

const ts: Record<string, any> = {
  // Posicionamento agora vem de .gm-corner-stack (compartilhado com o player).
  container: {
    display: 'flex', flexDirection: 'column', gap: '8px',
    maxWidth: '340px',
  },
  toast: {
    display: 'flex', alignItems: 'flex-start', gap: '10px',
    background: 'var(--bg-surface)', border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-lg)', padding: '12px 14px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    animation: 'slideIn 0.2s ease',
  },
  body: { flex: 1, display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 },
  player: { fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' },
  desc: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.4 },
  close: {
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', padding: '0', display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  link: {
    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
    borderRadius: 'var(--radius-sm)', padding: '3px 8px',
    color: 'var(--accent)', fontSize: '11px', fontWeight: 600,
    cursor: 'pointer', flexShrink: 0,
  },
};
