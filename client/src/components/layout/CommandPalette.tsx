import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft, Ghost, Sword, User, LucideIcon } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { matchesSearch } from '../../utils/normalizeSearch';
import { NAV_ITEMS, LIBRARY_SECTIONS } from './navConfig';
import { PaletteMode } from './ShellContext';

interface Entry {
  id: string;
  group: string;
  title: string;
  subtitle?: string;
  icon: LucideIcon;
  /** cor do ícone/avatar */
  tint?: string;
  avatar?: string | null;
  to: string;
  /** texto extra que também casa na busca */
  haystack: string;
}

export default function CommandPalette({ mode, onClose }: { mode: PaletteMode; onClose: () => void }) {
  const { characters, players, requests } = useApp();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const pending = requests.filter((r) => r.status === 'pending').length;

  const entries = useMemo<Entry[]>(() => {
    const pages: Entry[] = mode === 'characters' ? [] : [
      ...NAV_ITEMS.map((item) => ({
        id: `nav:${item.to}`,
        group: 'Ir para',
        title: item.label,
        subtitle: item.to === '/requests' && pending > 0 ? `${pending} pendente(s)` : undefined,
        icon: item.icon,
        to: item.to,
        haystack: `${item.label} ${item.keywords ?? ''}`,
      })),
      ...LIBRARY_SECTIONS.map((sec) => ({
        id: `lib:${sec.id}`,
        group: 'Biblioteca',
        title: sec.label,
        subtitle: 'Acervo',
        icon: sec.icon,
        to: sec.path,
        haystack: `${sec.label} biblioteca acervo ${sec.keywords}`,
      })),
    ];

    const sorted = [...characters].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

    const chars: Entry[] = sorted.map((c) => {
      const player = players.find((p) => p.id === c.playerId);
      return {
        id: `char:${c.id}`,
        group: c.type === 'npc' ? 'NPCs' : 'Personagens',
        title: c.name,
        subtitle: player ? `${player.name}${player.status === 'online' ? ' · online' : ''}` : c.type === 'npc' ? 'NPC' : 'Sem jogador',
        icon: c.type === 'npc' ? Ghost : Sword,
        tint: player?.color,
        avatar: c.avatar,
        to: `/characters/${c.id}`,
        haystack: `${c.name} ${player?.name ?? ''} ${c.type === 'npc' ? 'npc' : 'personagem pc'}`,
      };
    });

    const plys: Entry[] = mode === 'characters' ? [] : players.map((p) => {
      const linked = characters.find((c) => c.playerId === p.id && c.type === 'pc');
      return {
        id: `player:${p.id}`,
        group: 'Jogadores',
        title: p.name,
        subtitle: linked ? `Abrir ficha de ${linked.name}` : 'Sem personagem vinculado',
        icon: User,
        tint: p.color,
        to: linked ? `/characters/${linked.id}` : '/players',
        haystack: `${p.name} jogador player ${linked?.name ?? ''}`,
      };
    });

    return [...chars, ...plys, ...pages];
  }, [characters, players, mode, pending]);

  const results = useMemo(
    () => entries.filter((e) => matchesSearch(e.haystack, query)),
    [entries, query],
  );

  useEffect(() => { setCursor(0); }, [query, mode]);

  // Agrupa preservando a ordem de `results`, para que o índice do cursor
  // continue valendo em cima da lista achatada.
  const groups = useMemo(() => {
    const out: { label: string; items: Entry[] }[] = [];
    results.forEach((entry) => {
      const last = out[out.length - 1];
      if (last && last.label === entry.group) last.items.push(entry);
      else out.push({ label: entry.group, items: [entry] });
    });
    return out;
  }, [results]);

  const go = (entry: Entry | undefined) => {
    if (!entry) return;
    navigate(entry.to);
    onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor((c) => Math.min(c + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setCursor((c) => Math.max(c - 1, 0)); }
    if (e.key === 'Enter') { e.preventDefault(); go(results[cursor]); }
  };

  // Mantém a linha selecionada visível ao navegar com as setas.
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')
      ?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  let flatIndex = -1;

  return (
    <div className="gm-palette-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="gm-palette" onKeyDown={handleKey}>
        <div className="gm-palette-input-row">
          <Search size={17} color="var(--text-muted)" />
          <input
            ref={inputRef}
            className="gm-palette-input"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={mode === 'characters' ? 'Buscar personagem…' : 'Buscar personagem, jogador ou página…'}
          />
          <span className="gm-kbd">esc</span>
        </div>

        <div className="gm-palette-list" ref={listRef}>
          {results.length === 0 ? (
            <div className="gm-palette-empty">Nada encontrado para “{query}”.</div>
          ) : (
            groups.map((group) => (
              <div key={group.label}>
                <div className="gm-palette-group">{group.label}</div>
                {group.items.map((entry) => {
                  flatIndex += 1;
                  const index = flatIndex;
                  const Icon = entry.icon;
                  return (
                    <button
                      key={entry.id}
                      className="gm-palette-row"
                      data-active={index === cursor}
                      onMouseMove={() => setCursor(index)}
                      onClick={() => go(entry)}
                    >
                      {entry.avatar ? (
                        <img
                          src={entry.avatar}
                          alt=""
                          style={{ width: 26, height: 26, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                        />
                      ) : (
                        <span style={{
                          width: 26, height: 26, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: entry.tint ? `${entry.tint}22` : 'var(--bg-elevated)',
                        }}>
                          <Icon size={14} color={entry.tint ?? 'var(--text-secondary)'} />
                        </span>
                      )}
                      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', lineHeight: 1.35 }}>
                        <span className="gm-palette-row-title">{entry.title}</span>
                        {entry.subtitle && <span className="gm-palette-row-sub">{entry.subtitle}</span>}
                      </span>
                      {index === cursor && <CornerDownLeft size={13} color="var(--text-muted)" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        <div className="gm-palette-foot">
          <span><span className="gm-kbd">↑</span> <span className="gm-kbd">↓</span> navegar</span>
          <span><span className="gm-kbd">enter</span> abrir</span>
          <span style={{ marginLeft: 'auto' }}>
            <span className="gm-kbd">alt</span> + <span className="gm-kbd">↑</span>/<span className="gm-kbd">↓</span> troca de personagem
          </span>
        </div>
      </div>
    </div>
  );
}
