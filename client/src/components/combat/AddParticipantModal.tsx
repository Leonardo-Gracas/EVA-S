import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { matchesSearch } from '../../utils/normalizeSearch';
import { Character, CombatParticipant, CombatSession } from '../../types';
import { api } from '../../services/api';
import Modal from '../common/Modal';

export function AddParticipantModal({ open, onClose, sessionId, characters, participants, onDone }: {
  open: boolean; onClose: () => void; sessionId: string;
  characters: Character[]; participants: CombatParticipant[];
  onDone: (s: CombatSession) => void;
}) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'pc' | 'npc'>('all');
  const [adding, setAdding] = useState<string | null>(null);

  const filtered = characters
    .filter(c => (typeFilter === 'all' || c.type === typeFilter) && matchesSearch(c.name, search))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  const handleAdd = async (char: Character) => {
    setAdding(char.id);
    try {
      const updated = await api.combat.addParticipant(sessionId, { characterId: char.id });
      onDone(updated);
    } finally { setAdding(null); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Adicionar à Fila" width={440}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input placeholder="Buscar personagem..." value={search} onChange={e => setSearch(e.target.value)} style={s.search} autoFocus />
        <div style={{ display: 'flex', gap: 6 }}>
          {(['all', 'pc', 'npc'] as const).map(t => (
            <button key={t} style={{ ...s.filterBtn, ...(typeFilter === t ? s.filterBtnActive : {}) }} onClick={() => setTypeFilter(t)}>
              {t === 'all' ? 'Todos' : t === 'pc' ? 'Jogadores' : 'NPCs'}
            </button>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 320, overflowY: 'auto' }}>
          {filtered.length === 0 && (
            <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '20px 0' }}>Nenhum personagem encontrado.</p>
          )}
          {filtered.map(char => {
            const inQueue = participants.some(p => p.characterId === char.id);
            return (
              <div key={char.id} style={s.charRow}>
                <div style={s.charAvatar}>
                  {char.avatar
                    ? <img src={char.avatar} alt={char.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
                    : <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{char.name.charAt(0)}</span>}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{char.name}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{char.type === 'pc' ? 'Jogador' : 'NPC'}{inQueue && ' · Na fila'}</div>
                </div>
                <button style={{ ...s.addBtn, opacity: adding === char.id ? 0.6 : 1 }} onClick={() => handleAdd(char)} disabled={adding === char.id}>
                  {adding === char.id ? '...' : <><Plus size={12} /> Adicionar</>}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

const s: Record<string, any> = {
  search:        { width: '100%', padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, boxSizing: 'border-box' },
  filterBtn:     { padding: '5px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)' },
  filterBtnActive:{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 },
  charRow:       { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
  charAvatar:    { width: 36, height: 36, borderRadius: 6, background: 'var(--bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  addBtn:        { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 10px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, fontWeight: 600, color: 'var(--accent)', whiteSpace: 'nowrap', flexShrink: 0 },
};
