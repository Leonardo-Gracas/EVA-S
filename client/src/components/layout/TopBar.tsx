import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Search, Bell, Swords, Command, PanelLeftOpen } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { useShell } from './ShellContext';
import { Character, resourceMaxStat } from '../../types';
import { getEquippedBonus } from '../../utils/equippedEffects';

/** Quantos rostos cabem na barra antes de virar "+N". */
const MAX_FACES = 8;

/** Fração 0..1 do primeiro recurso da ficha — o "quanto ainda aguenta" do PJ. */
function vitalityRatio(char: Character): { ratio: number; color: string } | null {
  const key = Object.keys(char.resources)[0];
  if (!key) return null;
  const max = (char.resources[key] ?? 0) + getEquippedBonus(char.items, resourceMaxStat(key));
  if (max <= 0) return null;
  const ratio = Math.max(0, Math.min(1, (char.currentResources[key] ?? 0) / max));
  const color = ratio > 0.5 ? 'var(--success)' : ratio > 0.25 ? 'var(--warning)' : 'var(--error)';
  return { ratio, color };
}

function PartyFace({ char, active, onClick }: { char: Character; active: boolean; onClick: () => void }) {
  const { players } = useApp();
  const player = players.find((p) => p.id === char.playerId);
  const vitality = vitalityRatio(char);
  const tint = player?.color ?? 'var(--accent)';

  return (
    <button
      className={`gm-party-btn${active ? ' active' : ''}`}
      onClick={onClick}
      title={player ? `${char.name} — ${player.name}` : char.name}
    >
      {char.avatar ? (
        <img
          className="gm-party-avatar"
          src={char.avatar}
          alt={char.name}
          style={{ objectPosition: char.avatarPosition ?? '50% 50%' }}
        />
      ) : (
        <div className="gm-party-fallback" style={{ background: tint }}>
          {char.name.charAt(0).toUpperCase()}
        </div>
      )}

      {player && (
        <span
          className="gm-party-status"
          style={{ background: player.status === 'online' ? 'var(--success)' : 'var(--text-disabled)' }}
        />
      )}

      {vitality && (
        <span className="gm-party-hp">
          <i style={{ width: `${vitality.ratio * 100}%`, background: vitality.color }} />
        </span>
      )}
    </button>
  );
}

export default function TopBar() {
  const { characters, requests, activeCombat, campaign, loading } = useApp();
  const { collapsed, toggleCollapsed, openPalette } = useShell();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const pending = requests.filter((r) => r.status === 'pending').length;
  const party = characters
    .filter((c) => c.type === 'pc')
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  const visible = party.slice(0, MAX_FACES);
  const overflow = party.length - visible.length;
  const currentId = pathname.startsWith('/characters/') ? pathname.split('/')[2] : null;

  const turnName = activeCombat?.participants[activeCombat.currentIndex]?.displayName;

  return (
    <header className="gm-top">
      {collapsed && (
        <button className="gm-icon-btn" onClick={toggleCollapsed} title="Expandir menu (Ctrl+B)">
          <PanelLeftOpen size={16} />
        </button>
      )}

      <button className="gm-search-btn" onClick={() => openPalette('all')}>
        <Search size={14} />
        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          Buscar personagem, jogador, página…
        </span>
        <span className="gm-kbd" style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
          <Command size={9} />K
        </span>
      </button>

      <div className="gm-divider" />

      {/* Troca rápida de personagem — sempre visível, em qualquer página */}
      <div className="gm-party">
        {party.length === 0 ? (
          <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
            {loading ? '' : 'Nenhum personagem'}
          </span>
        ) : (
          <>
            {visible.map((char) => (
              <PartyFace
                key={char.id}
                char={char}
                active={char.id === currentId}
                onClick={() => navigate(`/characters/${char.id}`)}
              />
            ))}
            {overflow > 0 && (
              <button className="gm-party-more" onClick={() => openPalette('characters')} title="Ver todos">
                +{overflow}
              </button>
            )}
          </>
        )}
      </div>

      <div style={{ flex: 1, minWidth: 8 }} />

      {activeCombat && (
        <button className="gm-combat-pill" onClick={() => navigate('/combat')} title="Ir para o combate ativo">
          <span className="gm-combat-dot" />
          <Swords size={13} />
          <span>
            Rodada {activeCombat.globalTurn}
            {turnName ? ` · ${turnName}` : ''}
          </span>
        </button>
      )}

      <button
        className={`gm-icon-btn${pathname === '/requests' ? ' active' : ''}`}
        onClick={() => navigate('/requests')}
        title={pending > 0 ? `${pending} solicitação(ões) pendente(s)` : 'Solicitações'}
      >
        <Bell size={16} />
        {pending > 0 && <span className="gm-icon-btn-badge">{pending}</span>}
      </button>

      <div className="gm-divider" />

      <span
        style={{
          fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)',
          maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}
        title={campaign?.name ?? ''}
      >
        {campaign?.name ?? '…'}
      </span>
    </header>
  );
}
