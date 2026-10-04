import React, { useState, useEffect } from 'react';
import { X, Wand2, BookOpen, Clock, Zap } from 'lucide-react';
import { Grimorio, GrimorioSpell, ResourceEffect, ActionPermission } from '../../types';
import { ICON_MAP } from '../characters/SkillIconPicker';
import { api } from '../../services/api';
import { useApp } from '../../contexts/AppContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function costLabel(effects: ResourceEffect[], getResourceLabel: (key: string) => string): string {
  if (!effects.length) return 'Sem custo';
  return effects
    .map((fx) => {
      const dir = fx.direction === 'gain' ? '+' : '−';
      return `${dir}${fx.amount} ${getResourceLabel(fx.resource)}`;
    })
    .join(' · ');
}

// ── SpellDetail ───────────────────────────────────────────────────────────────

interface SpellDetailProps {
  spell: GrimorioSpell;
  characterId: string;
  permission: ActionPermission;
  currentUses: number | null;
  onCastSuccess: (updatedUses: Record<string, number>) => void;
  onCastRequest: (spell: GrimorioSpell) => void;
}

function SpellDetail({ spell, characterId, permission, currentUses, onCastSuccess, onCastRequest }: SpellDetailProps) {
  const { getResourceLabel } = useApp();
  const [casting, setCasting] = useState(false);
  const [castMsg, setCastMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const SpellIcon = ICON_MAP[spell.icon] ?? Wand2;
  const canCast = permission !== 'blocked';
  const needsRequest = permission === 'request';
  const usesLeft = spell.usesLimit !== null ? (currentUses ?? spell.usesLimit) : null;
  const isExhausted = usesLeft !== null && usesLeft <= 0;

  const handleCast = async () => {
    if (needsRequest) {
      onCastRequest(spell);
      return;
    }
    setCasting(true);
    setCastMsg(null);
    try {
      const result = await api.grimorios.castSpell(spell.id, characterId);
      const cost = costLabel(spell.resourceEffect, getResourceLabel);
      const remaining = spell.usesLimit !== null ? (result.spellUses[spell.id] ?? 0) : null;
      const usesMsg = remaining !== null ? ` (${remaining}/${spell.usesLimit} usos restantes)` : '';
      setCastMsg({ ok: true, text: `Conjurado! ${cost}${usesMsg}` });
      onCastSuccess(result.spellUses);
    } catch (e: any) {
      setCastMsg({ ok: false, text: e.message ?? 'Erro ao conjurar' });
    } finally {
      setCasting(false);
    }
  };

  return (
    <div style={s.detail}>
      <div style={s.detailHeader}>
        <div style={{ ...s.detailIconBox, background: `${spell.iconColor}20` }}>
          <SpellIcon size={22} color={spell.iconColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={s.spellTitle}>{spell.title}</h3>
          <div style={s.metaRow}>
            <span style={{ ...s.badge, background: spell.skillType === 'active' ? '#6366f120' : '#8b5cf620', color: spell.skillType === 'active' ? '#6366f1' : '#8b5cf6' }}>
              {spell.skillType === 'active' ? 'Ativo' : 'Passivo'}
            </span>
            {spell.usesLimit !== null && (
              <span style={{ ...s.badge, background: isExhausted ? '#ef444415' : 'var(--bg-base)', color: isExhausted ? '#ef4444' : 'var(--text-muted)', border: `1px solid ${isExhausted ? '#ef444440' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 3 }}>
                <Clock size={10} />
                {usesLeft}/{spell.usesLimit} · {spell.usesLimitType === 'combat' ? 'combate' : 'descanso'}
              </span>
            )}
          </div>
        </div>
      </div>

      {spell.description && <p style={s.desc}>{spell.description}</p>}

      {/* Cost */}
      <div style={s.costBox}>
        <p style={s.costLabel}>Custo</p>
        <div style={s.costEffects}>
          {spell.resourceEffect.length === 0 ? (
            <span style={s.noCost}>Sem custo de recursos</span>
          ) : (
            spell.resourceEffect.map((fx, i) => {
              const gain = fx.direction === 'gain';
              const color = gain ? '#22c55e' : '#ef4444';
              const res = getResourceLabel(fx.resource);
              return (
                <span key={i} style={{ ...s.fxBadge, color, background: `${color}15`, border: `1px solid ${color}40` }}>
                  {gain ? '+' : '−'}{fx.amount} {res}
                </span>
              );
            })
          )}
        </div>
      </div>

      {/* Tags */}
      {spell.tags.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {spell.tags.map((t, i) => (
            <span key={i} style={s.tag}>{t}</span>
          ))}
        </div>
      )}

      {/* Cast button */}
      {canCast && spell.skillType === 'active' && (
        <div style={{ marginTop: 16 }}>
          {castMsg && (
            <p style={{ fontSize: 12, color: castMsg.ok ? '#22c55e' : '#ef4444', marginBottom: 8 }}>{castMsg.text}</p>
          )}
          {isExhausted ? (
            <p style={s.exhaustedMsg}>
              Usos esgotados — recupera {spell.usesLimitType === 'combat' ? 'ao iniciar um combate' : 'ao descansar'}.
            </p>
          ) : (
            <button
              style={{ ...s.castBtn, opacity: casting ? 0.6 : 1 }}
              onClick={handleCast}
              disabled={casting}
            >
              <Zap size={14} />
              {casting ? 'Conjurando...' : needsRequest ? 'Solicitar conjuração' : 'Conjurar'}
            </button>
          )}
        </div>
      )}

      {permission === 'blocked' && (
        <p style={s.blockedMsg}>Conjuração bloqueada pelo Mestre.</p>
      )}
    </div>
  );
}

// ── GrimorioSpellModal ────────────────────────────────────────────────────────

interface Props {
  grimorio: Grimorio;
  characterId: string;
  permission: ActionPermission;
  onClose: () => void;
  onCastRequest?: (spell: GrimorioSpell) => void;
  onCastSuccess?: () => void;
}

export default function GrimorioSpellModal({
  grimorio, characterId, permission, onClose, onCastRequest, onCastSuccess,
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    grimorio.spells.length > 0 ? grimorio.spells[0].id : null,
  );
  const [spellUses, setSpellUses] = useState<Record<string, number>>({});

  useEffect(() => {
    api.grimorios.getCharacterUses(characterId).then(setSpellUses).catch(() => {});
  }, [characterId]);

  const GrimIcon = ICON_MAP[grimorio.icon] ?? BookOpen;
  const selectedSpell = grimorio.spells.find((sp) => sp.id === selectedId) ?? null;

  const handleRequest = (spell: GrimorioSpell) => {
    onCastRequest?.(spell);
    onClose();
  };

  return (
    <div style={s.overlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* Modal header */}
        <div style={s.modalHeader}>
          <div style={{ ...s.headerIcon, background: `${grimorio.iconColor}20` }}>
            <GrimIcon size={18} color={grimorio.iconColor} />
          </div>
          <h2 style={s.modalTitle}>{grimorio.name}</h2>
          <button style={s.closeBtn} onClick={onClose}><X size={16} /></button>
        </div>

        <div style={s.body}>
          {grimorio.spells.length === 0 ? (
            <div style={s.emptyState}>
              <Wand2 size={32} color="var(--text-muted)" />
              <p style={s.emptyText}>Este grimório ainda não tem feitiços.</p>
            </div>
          ) : (
            <>
              {/* Spell list */}
              <div style={s.spellList}>
                {grimorio.spells.map((sp) => {
                  const SpIcon = ICON_MAP[sp.icon] ?? Wand2;
                  const active = selectedId === sp.id;
                  return (
                    <button
                      key={sp.id}
                      style={{ ...s.spellItem, background: active ? `${sp.iconColor}15` : 'transparent', borderColor: active ? sp.iconColor : 'transparent' }}
                      onClick={() => setSelectedId(sp.id)}
                    >
                      <div style={{ ...s.spellItemIcon, background: `${sp.iconColor}20` }}>
                        <SpIcon size={14} color={sp.iconColor} />
                      </div>
                      <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                        <span style={{ fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'var(--text-primary)' : 'var(--text-secondary)', display: 'block' }}>
                          {sp.title}
                        </span>
                        {sp.usesLimit !== null && (() => {
                          const left = spellUses[sp.id] ?? sp.usesLimit;
                          const exhausted = left <= 0;
                          return (
                            <span style={{ fontSize: 10, color: exhausted ? '#ef4444' : 'var(--text-muted)' }}>
                              {left}/{sp.usesLimit}×
                            </span>
                          );
                        })()}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Spell detail */}
              <div style={s.detailArea}>
                {selectedSpell ? (
                  <SpellDetail
                    key={selectedSpell.id}
                    spell={selectedSpell}
                    characterId={characterId}
                    permission={permission}
                    currentUses={selectedSpell.usesLimit !== null ? (spellUses[selectedSpell.id] ?? selectedSpell.usesLimit) : null}
                    onCastSuccess={(updatedUses) => { setSpellUses(updatedUses); onCastSuccess?.(); }}
                    onCastRequest={handleRequest}
                  />
                ) : (
                  <div style={s.emptyState}>
                    <p style={s.emptyText}>Selecione um feitiço</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, any> = {
  overlay: {
    position: 'fixed', inset: 0, zIndex: 1000,
    background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 16,
  },
  modal: {
    width: '100%', maxWidth: 680,
    maxHeight: '85vh',
    background: 'var(--bg-card)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
  },
  modalHeader: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '14px 16px',
    borderBottom: '1px solid var(--border)',
    flexShrink: 0,
  },
  headerIcon: {
    width: 34, height: 34, borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', flex: 1 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', padding: 4 },

  body: {
    display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden',
  },

  // Spell list sidebar
  spellList: {
    width: 190, flexShrink: 0,
    borderRight: '1px solid var(--border)',
    overflowY: 'auto', padding: '8px 0',
    background: 'var(--bg-base)',
  },
  spellItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: '100%', padding: '8px 12px',
    border: 'none', borderLeft: '3px solid transparent',
    cursor: 'pointer', transition: 'all 150ms',
  },
  spellItemIcon: {
    width: 26, height: 26, borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Spell detail area
  detailArea: { flex: 1, overflowY: 'auto' },
  detail: { padding: '20px 20px' },
  detailHeader: { display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 },
  detailIconBox: {
    width: 44, height: 44, borderRadius: 'var(--radius)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  spellTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 },
  metaRow: { display: 'flex', flexWrap: 'wrap', gap: 4 },
  badge: { fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 100 },

  desc: { fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 },

  costBox: {
    padding: 12, background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius)', border: '1px solid var(--border)',
    marginTop: 4,
  },
  costLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 },
  costEffects: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  fxBadge: { fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 100 },
  noCost: { fontSize: 13, color: 'var(--text-muted)' },

  tag: {
    fontSize: 11, padding: '2px 7px', borderRadius: 100,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-muted)',
  },

  castBtn: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '9px 16px', borderRadius: 'var(--radius)',
    background: 'var(--accent)', color: '#fff',
    border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
    transition: 'all 150ms',
    width: '100%', justifyContent: 'center',
  },
  blockedMsg: { fontSize: 13, color: '#ef4444', marginTop: 12, fontStyle: 'italic' },
  exhaustedMsg: { fontSize: 13, color: '#f59e0b', marginTop: 12, fontStyle: 'italic', padding: '8px 12px', background: '#f59e0b10', borderRadius: 'var(--radius)', border: '1px solid #f59e0b30' },

  emptyState: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40 },
  emptyText: { fontSize: 14, color: 'var(--text-muted)' },
};
