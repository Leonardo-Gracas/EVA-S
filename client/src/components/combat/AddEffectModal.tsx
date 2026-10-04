import React, { useState, useMemo } from 'react';
import { CombatSession, EffectTemplate, getEffectStatLabel } from '../../types';
import { matchesSearch } from '../../utils/normalizeSearch';
import { api } from '../../services/api';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { ICON_MAP } from '../characters/SkillIconPicker';
import { useApp } from '../../contexts/AppContext';

const RESULT_LIMIT = 30;

export function AddEffectModal({ open, onClose, sessionId, participantUid, effectTemplates, globalTurn, queueSize, onDone, sheetTypeId }: {
  open: boolean; onClose: () => void;
  sessionId: string; participantUid: string;
  effectTemplates: EffectTemplate[];
  globalTurn: number; queueSize: number;
  onDone: (s: CombatSession) => void;
  sheetTypeId?: string;
}) {
  const { getSheetType } = useApp();
  const sheetConfig = getSheetType(sheetTypeId).config;
  const [selectedId, setSelectedId] = useState('');
  const [duration, setDuration] = useState(1);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');

  const selected = effectTemplates.find(e => e.id === selectedId);

  const filtered = useMemo(() => {
    const results = search.trim()
      ? effectTemplates.filter(e => matchesSearch(e.name, search) || matchesSearch(e.description ?? '', search))
      : effectTemplates;
    return [...results]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
      .slice(0, RESULT_LIMIT);
  }, [effectTemplates, search]);

  const handleAdd = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const updated = await api.combat.addEffect(sessionId, participantUid, {
        name: selected.name, icon: selected.icon, color: selected.iconColor,
        description: selected.description,
        durationRounds: duration, applications: selected.applications,
      });
      onDone(updated);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Aplicar Efeito" width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

        {/* Search */}
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar efeito pelo nome ou descrição..."
          style={s.searchInput}
          autoFocus
        />

        {/* Effect list */}
        <div style={s.list}>
          {filtered.length === 0 && (
            <div style={{ padding: '12px', fontSize: 12, color: 'var(--text-muted)', textAlign: 'center' }}>
              Nenhum efeito encontrado.
            </div>
          )}
          {filtered.map(e => {
            const Icon = ICON_MAP[e.icon ?? 'Zap'] ?? ICON_MAP['Zap'];
            const isSelected = e.id === selectedId;
            return (
              <button
                key={e.id}
                onClick={() => setSelectedId(isSelected ? '' : e.id)}
                style={{
                  ...s.item,
                  background: isSelected ? `${e.iconColor ?? 'var(--accent)'}12` : 'transparent',
                  borderLeft: isSelected ? `3px solid ${e.iconColor ?? 'var(--accent)'}` : '3px solid transparent',
                }}
              >
                <div style={{ ...s.iconBox, background: `${e.iconColor ?? 'var(--accent)'}22` }}>
                  <Icon size={14} color={e.iconColor ?? 'var(--accent)'} />
                </div>
                <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>{e.name}</div>
                  {isSelected && e.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, lineHeight: 1.5 }}>
                      {e.description}
                    </div>
                  )}
                  {isSelected && e.applications.length > 0 && (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 5 }}>
                      {e.applications.map((app, i) => {
                        const sign = app.operation === 'add' ? '+' : '-';
                        const label = app.stat === 'custom' ? (app.customName ?? 'Custom') : getEffectStatLabel(app.stat, sheetConfig);
                        return (
                          <span key={i} style={s.appChip}>
                            {sign}{app.value} {label}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
          {effectTemplates.length > RESULT_LIMIT && search.trim() === '' && (
            <div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic', borderTop: '1px solid var(--border)' }}>
              Mostrando {RESULT_LIMIT} de {effectTemplates.length}. Use a busca para encontrar outros.
            </div>
          )}
        </div>

        {/* Duration */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ ...s.label, marginBottom: 0 }}>Duração (rodadas)</label>
          <input
            type="number" min={0} value={duration}
            onChange={e => setDuration(Math.max(0, Number(e.target.value)))}
            style={s.durationInput}
          />
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>0 = permanente</span>
        </div>

        {selected && (
          <div style={{ fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 10px', borderRadius: 'var(--radius-sm)' }}>
            Expira em {duration > 0
              ? `${duration} volta${duration !== 1 ? 's' : ''} completa${duration !== 1 ? 's' : ''} (turno global ${globalTurn + duration * queueSize})`
              : 'nunca'}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button variant="secondary" size="sm" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="sm" loading={saving} onClick={handleAdd} disabled={!selected}>Aplicar</Button>
        </div>
      </div>
    </Modal>
  );
}

const s: Record<string, any> = {
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 5 },
  searchInput: {
    width: '100%', padding: '8px 10px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13,
    boxSizing: 'border-box',
  },
  list: {
    display: 'flex', flexDirection: 'column',
    maxHeight: 250, overflowY: 'auto', scrollbarWidth: 'thin',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    background: 'var(--bg-elevated)',
  },
  item: {
    display: 'flex', alignItems: 'flex-start', gap: 10,
    padding: '9px 12px', border: 'none', borderBottom: '1px solid var(--border)',
    cursor: 'pointer', width: '100%', transition: 'background 0.1s',
  },
  iconBox: {
    width: 32, height: 32, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    marginTop: 1,
  },
  appChip: {
    fontSize: 10, padding: '1px 6px', borderRadius: '100px',
    background: 'var(--bg-surface)', color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
  },
  durationInput: {
    width: 70, padding: '6px 8px', textAlign: 'center',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13,
  },
};
