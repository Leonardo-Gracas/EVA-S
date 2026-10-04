import React, { useMemo, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Ghost, Search } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useShell } from '../layout/ShellContext';
import { Character } from '../../types';

const byName = (a: Character, b: Character) =>
  a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });

/**
 * Trilho de troca de ficha, no topo da própria ficha. Antes era preciso voltar
 * para a lista de personagens a cada troca; aqui o pulo é um clique — ou
 * Alt+↑/↓, que percorre o elenco na mesma ordem exibida.
 */
export default function CharacterSwitcher({ currentId }: { currentId: string }) {
  const { characters, players } = useApp();
  const { openPalette } = useShell();
  const navigate = useNavigate();
  const railRef = useRef<HTMLDivElement>(null);

  // PCs primeiro (é neles que a mesa passa o tempo), NPCs depois.
  const ordered = useMemo(() => {
    const pcs = characters.filter((c) => c.type === 'pc').sort(byName);
    const npcs = characters.filter((c) => c.type === 'npc').sort(byName);
    return [...pcs, ...npcs];
  }, [characters]);

  const index = ordered.findIndex((c) => c.id === currentId);

  // Mantém a ficha aberta visível no trilho ao trocar pelo teclado.
  useEffect(() => {
    railRef.current?.querySelector<HTMLElement>('.gm-charnav-chip.active')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }, [currentId]);

  if (ordered.length <= 1) return null;

  const step = (delta: number) => {
    const next = (index + delta + ordered.length) % ordered.length;
    navigate(`/characters/${ordered[next].id}`);
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <button
        className="gm-icon-btn"
        onClick={() => step(-1)}
        title="Personagem anterior (Alt+↑)"
        style={{ border: '1px solid var(--border)', width: 28, height: 28 }}
      >
        <ChevronLeft size={15} />
      </button>

      <div className="gm-charnav" ref={railRef}>
        {ordered.map((c) => {
          const player = players.find((p) => p.id === c.playerId);
          const active = c.id === currentId;
          const tint = player?.color ?? 'var(--text-muted)';
          return (
            <button
              key={c.id}
              className={`gm-charnav-chip${active ? ' active' : ''}`}
              onClick={() => navigate(`/characters/${c.id}`)}
              title={player ? `${c.name} — ${player.name}` : c.name}
            >
              {c.avatar ? (
                <img
                  className="gm-charnav-face"
                  src={c.avatar}
                  alt=""
                  style={{ objectPosition: c.avatarPosition ?? '50% 50%' }}
                />
              ) : (
                <span
                  className="gm-charnav-face"
                  style={{ background: c.type === 'npc' ? 'var(--bg-overlay)' : tint }}
                >
                  {c.type === 'npc' ? <Ghost size={11} color="var(--text-secondary)" /> : c.name.charAt(0).toUpperCase()}
                </span>
              )}
              {c.name}
            </button>
          );
        })}
      </div>

      <button
        className="gm-icon-btn"
        onClick={() => step(1)}
        title="Próximo personagem (Alt+↓)"
        style={{ border: '1px solid var(--border)', width: 28, height: 28 }}
      >
        <ChevronRight size={15} />
      </button>

      <button
        className="gm-icon-btn"
        onClick={() => openPalette('characters')}
        title="Buscar personagem (Ctrl+K)"
        style={{ border: '1px solid var(--border)', width: 28, height: 28 }}
      >
        <Search size={14} />
      </button>
    </div>
  );
}
