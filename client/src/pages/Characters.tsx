import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import { Plus, Sword, Trash2, Edit2, Ghost, ChevronRight, Search } from 'lucide-react';
import { matchesSearch } from '../utils/normalizeSearch';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import { Character, resourceMaxStat } from '../types';
import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';
import CharacterForm from '../components/characters/CharacterForm';
import Modal from '../components/common/Modal';
import { getEquippedBonus } from '../utils/equippedEffects';

type Tab = 'pc' | 'npc';

export default function Characters() {
  useTitle('Personagens');
  const { characters, players, dispatch, getResourceColor, getResourceLabel } = useApp();
  const [tab, setTab] = useState<Tab>('pc');
  const [search, setSearch] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const navigate = useNavigate();

  const sort = (arr: Character[]) => [...arr].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  const pcs  = sort(characters.filter((c) => c.type === 'pc'));
  const npcs = sort(characters.filter((c) => c.type === 'npc'));
  const list = (tab === 'pc' ? pcs : npcs).filter((c) => matchesSearch(c.name, search));

  const handleDelete = async (c: Character, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Remover "${c.name}"?`)) return;
    try {
      await api.characters.delete(c.id);
      dispatch({ type: 'REMOVE_CHARACTER', payload: c.id });
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreated = (character: Character) => {
    dispatch({ type: 'UPDATE_CHARACTER', payload: character });
    setCreateOpen(false);
  };

  const isNpc = tab === 'npc';

  return (
    <div style={styles.page}>
      <PageHeader
        title="Personagens"
        subtitle={`${pcs.length} jogador${pcs.length !== 1 ? 'es' : ''} · ${npcs.length} NPC${npcs.length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
            {isNpc ? 'Novo NPC' : 'Novo Personagem'}
          </Button>
        }
      />

      {/* Tabs */}
      <div style={styles.tabRow}>
        <button
          style={{ ...styles.tab, ...(tab === 'pc' ? styles.tabActive : {}) }}
          onClick={() => setTab('pc')}
        >
          <Sword size={14} />
          Personagens
          <span style={{ ...styles.badge, background: tab === 'pc' ? 'var(--accent)' : 'var(--bg-elevated)', color: tab === 'pc' ? 'white' : 'var(--text-muted)' }}>
            {pcs.length}
          </span>
        </button>
        <button
          style={{ ...styles.tab, ...(tab === 'npc' ? styles.tabActive : {}) }}
          onClick={() => setTab('npc')}
        >
          <Ghost size={14} />
          NPCs
          <span style={{ ...styles.badge, background: tab === 'npc' ? 'var(--accent)' : 'var(--bg-elevated)', color: tab === 'npc' ? 'white' : 'var(--text-muted)' }}>
            {npcs.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={isNpc ? 'Buscar NPC...' : 'Buscar personagem...'}
          style={{ width: '100%', padding: '8px 12px 8px 32px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' }}
        />
      </div>

      {list.length === 0 ? (
        <div style={styles.empty}>
          {isNpc ? <Ghost size={40} color="var(--text-muted)" /> : <Sword size={40} color="var(--text-muted)" />}
          <p>{search ? 'Nenhum resultado encontrado.' : isNpc ? 'Nenhum NPC cadastrado.' : 'Nenhum personagem cadastrado.'}</p>
          {!search && (
            <Button variant="primary" icon={<Plus size={14} />} onClick={() => setCreateOpen(true)}>
              {isNpc ? 'Criar primeiro NPC' : 'Criar primeiro personagem'}
            </Button>
          )}
        </div>
      ) : (
        <div style={styles.grid}>
          {list.map((char) => {
            const player = players.find((p) => p.id === char.playerId);
            return (
              <div
                key={char.id}
                style={styles.card}
                onClick={() => navigate(`/characters/${char.id}`)}
              >
                {/* Avatar */}
                <div style={styles.avatarArea}>
                  {char.avatar ? (
                    <img
                      src={char.avatar}
                      alt={char.name}
                      style={{ ...styles.avatarImg, objectPosition: char.avatarPosition ?? '50% 50%' }}
                    />
                  ) : (
                    <div style={styles.avatarFallback}>
                      {isNpc
                        ? <Ghost size={22} color="var(--accent)" />
                        : <Sword size={22} color="var(--accent)" />
                      }
                    </div>
                  )}
                  {isNpc && (
                    <div style={styles.npcBadge}>NPC</div>
                  )}
                </div>

                <div style={styles.cardContent}>
                  <div style={styles.cardTop}>
                    <h3 style={styles.charName}>{char.name}</h3>
                    <div style={styles.actions} onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost" size="sm"
                        icon={<Edit2 size={12} />}
                        onClick={(e) => { e.stopPropagation(); navigate(`/characters/${char.id}`); }}
                      />
                      <Button
                        variant="ghost" size="sm"
                        icon={<Trash2 size={12} />}
                        style={{ color: 'var(--error)' }}
                        onClick={(e) => handleDelete(char, e)}
                      />
                    </div>
                  </div>

                  {!isNpc && (
                    player ? (
                      <div style={styles.playerTag}>
                        <div style={{ ...styles.playerDot, background: player.color }} />
                        <span>{player.name}</span>
                      </div>
                    ) : (
                      <span style={styles.noPlayer}>Sem jogador</span>
                    )
                  )}

                  {/* Recursos */}
                  <div style={styles.resources}>
                    {Object.keys(char.resources).map((key) => {
                      const max = char.resources[key] + getEquippedBonus(char.items, resourceMaxStat(key));
                      const current = char.currentResources[key];
                      return (
                        <div key={key} style={styles.resource}>
                          <span style={{ ...styles.resourceDot, background: getResourceColor(key, char.sheetTypeId) }} />
                          <span style={styles.resourceLabel}>{getResourceLabel(key, char.sheetTypeId)}</span>
                          <span style={{ ...styles.resourceValue, color: getResourceColor(key, char.sheetTypeId) }}>
                            {current}<span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 400 }}>/{max}</span>
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <div style={styles.footer}>
                    <span style={styles.skillCount}>{char.skills.length} habilidade{char.skills.length !== 1 ? 's' : ''}</span>
                    <ChevronRight size={14} color="var(--text-muted)" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title={isNpc ? 'Novo NPC' : 'Novo Personagem'}
        width={600}
      >
        <CharacterForm
          defaultType={tab}
          onSave={handleCreated}
          onCancel={() => setCreateOpen(false)}
        />
      </Modal>
    </div>
  );
}

const styles: Record<string, any> = {
  page: { padding: '28px', display: 'flex', flexDirection: 'column', gap: '0', maxWidth: '1100px' },
  tabRow: {
    display: 'flex', gap: '4px', marginBottom: '20px',
    borderBottom: '1px solid var(--border)', paddingBottom: '0',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: '6px',
    padding: '8px 16px', background: 'none', border: 'none',
    color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500,
    cursor: 'pointer', borderBottom: '2px solid transparent',
    marginBottom: '-1px', transition: 'color 150ms',
  },
  tabActive: {
    color: 'var(--accent)', borderBottomColor: 'var(--accent)',
  },
  badge: {
    minWidth: '20px', height: '18px', borderRadius: '9px',
    fontSize: '11px', fontWeight: 600, padding: '0 6px',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '16px', color: 'var(--text-muted)', padding: '60px 0', textAlign: 'center',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '14px' },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
    cursor: 'pointer', transition: 'border-color var(--transition), transform var(--transition)',
    display: 'flex', flexDirection: 'column',
  },
  avatarArea: { height: '200px', background: 'var(--bg-elevated)', position: 'relative', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarFallback: {
    width: '100%', height: '100%', display: 'flex',
    alignItems: 'center', justifyContent: 'center', background: 'var(--accent-dim)',
  },
  npcBadge: {
    position: 'absolute', top: '8px', left: '8px',
    background: 'rgba(0,0,0,0.65)', color: 'var(--text-secondary)',
    fontSize: '10px', fontWeight: 700, padding: '2px 7px',
    borderRadius: '4px', letterSpacing: '0.05em',
    backdropFilter: 'blur(4px)',
  },
  cardContent: { padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 },
  cardTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  charName: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' },
  actions: { display: 'flex', gap: '2px' },
  playerTag: { display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--text-secondary)' },
  playerDot: { width: '8px', height: '8px', borderRadius: '50%' },
  noPlayer: { fontSize: '12px', color: 'var(--text-muted)' },
  resources: { display: 'flex', flexDirection: 'column', gap: '4px', padding: '8px 0', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' },
  resource: { display: 'flex', alignItems: 'center', gap: '6px' },
  resourceDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  resourceLabel: { flex: 1, fontSize: '12px', color: 'var(--text-muted)' },
  resourceValue: { fontSize: '13px', fontWeight: 600 },
  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  skillCount: { fontSize: '12px', color: 'var(--text-muted)' },
};
