import React, { useState } from 'react';
import { Shield, ChevronRight, Bot, AlertTriangle, Eye, EyeOff, Trash2, Zap, Lock, Unlock, ArrowUp, ArrowDown, X } from 'lucide-react';
import { CombatParticipant, Character, EffectTemplate, protectionStat, resourceMaxStat } from '../../types';
import { MiniBar } from './MiniBar';
import { TurnsLeft } from './TurnsLeft';
import { ICON_MAP } from '../characters/SkillIconPicker';
import { EffectPopover, PopoverTarget } from './EffectPopover';
import { useApp } from '../../contexts/AppContext';
import { getEquippedApplications } from '../../utils/equippedEffects';

export interface ParticipantCardProps {
  participant: CombatParticipant;
  character: Character | undefined;
  isActive: boolean;
  isGM: boolean;
  globalTurn: number;
  queueSize: number;
  effectTemplates?: EffectTemplate[];
  onBossModeToggle: () => void;
  onEditResources: () => void;
  onRemove: () => void;
  onAddEffect: () => void;
  onRemoveEffect: (uid: string) => void;
  onMovementToggle?: () => void;
  reorderMode?: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

export function ParticipantCard({
  participant, character, isActive, isGM, globalTurn, queueSize, effectTemplates,
  onBossModeToggle, onEditResources, onRemove, onAddEffect, onRemoveEffect,
  onMovementToggle, reorderMode, onMoveUp, onMoveDown,
}: ParticipantCardProps) {
  const { getResourceDefs, getProtectionDefs } = useApp();
  const [popover, setPopover] = useState<PopoverTarget | null>(null);

  const equippedApps = getEquippedApplications(character?.items);

  const protDefs = getProtectionDefs(character?.sheetTypeId);
  const prot = protDefs.map((def) => ({
    ...def,
    total: (character?.protections?.[def.key] ?? 0) + equippedApps
      .filter(a => a.stat === protectionStat(def.key))
      .reduce((s, a) => s + (a.operation === 'add' ? a.value : -a.value), 0),
  }));

  const resources = getResourceDefs(character?.sheetTypeId).map((def) => {
    const max = (character?.resources[def.key] ?? 0) + equippedApps
      .filter(a => a.stat === resourceMaxStat(def.key))
      .reduce((s, a) => s + (a.operation === 'add' ? a.value : -a.value), 0);
    const cur = participant.currentResources[def.key] ?? 0;
    return { key: def.key, label: def.label.slice(0, 2).toUpperCase(), max, cur, damaged: max - cur, color: def.color };
  });

  return (
    <div style={{ ...s.card, ...(isActive ? s.cardActive : {}), borderLeft: `3px solid ${isActive ? 'var(--accent)' : 'transparent'}` }}>
      {/* Top row */}
      <div style={s.top}>
        {isActive && <ChevronRight size={14} color="var(--accent)" style={{ flexShrink: 0 }} />}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <div style={s.avatar}>
            {character?.avatar
              ? <img src={character.avatar} alt={participant.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 6 }} />
              : <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-muted)' }}>{participant.displayName.charAt(0)}</span>}
          </div>
          {character?.type === 'npc' && <span style={s.npcBadge}><Bot size={9} /> NPC</span>}
          {participant.isBossMode && <span style={s.bossBadge}><AlertTriangle size={9} /> Boss</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.nameRow}>
            <span style={s.name}>{participant.displayName}</span>
          </div>
          {participant.isBossMode && !isGM ? (
            <div style={{ display: 'flex', gap: 10, marginTop: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              {resources.filter(r => r.damaged > 0).map(r => (
                <span key={r.key} style={{ fontSize: 12, fontWeight: 700, color: r.color }}>
                  -{r.damaged} {r.label}
                </span>
              ))}
              {resources.every(r => r.damaged === 0) && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontStyle: 'italic' }}>Sem dano</span>
              )}
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
              {resources.map(r => (
                <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 16, fontSize: 9, fontWeight: 700, color: r.color }}>{r.label}</span>
                  <MiniBar current={r.cur} max={r.max} color={r.color} />
                  <span style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right', color: 'var(--text-primary)' }}>
                    {r.cur}/{r.max}
                  </span>
                </div>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 5 }}>
            {prot.map((p) => (
              <span key={p.key} style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, color: p.color }}>
                <Shield size={10} /> {p.total}
              </span>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flexShrink: 0 }}>
          {reorderMode ? (
            <>
              <button style={s.iconBtn} onClick={onMoveUp} title="Mover para cima"><ArrowUp size={13} /></button>
              <button style={s.iconBtn} onClick={onMoveDown} title="Mover para baixo"><ArrowDown size={13} /></button>
            </>
          ) : (
            <>
              <button style={s.iconBtn} onClick={onBossModeToggle} title={participant.isBossMode ? 'Modo normal' : 'Modo boss'}>
                {participant.isBossMode ? <Eye size={13} /> : <EyeOff size={13} />}
              </button>
              {onMovementToggle && (
                <button style={{ ...s.iconBtn, color: participant.movementBlocked ? '#ef4444' : 'var(--text-muted)' }}
                  onClick={onMovementToggle}
                  title={participant.movementBlocked ? 'Desbloquear movimento' : 'Bloquear movimento'}>
                  {participant.movementBlocked ? <Lock size={13} /> : <Unlock size={13} />}
                </button>
              )}
              <button style={{ ...s.iconBtn, color: 'var(--error)' }} onClick={onRemove} title="Remover">
                <Trash2 size={13} />
              </button>
            </>
          )}
        </div>
      </div>

      {participant.activeEffects.length > 0 && (
        <div style={s.effects}>
          {participant.activeEffects.map(eff => {
            const Icon = ICON_MAP[eff.icon ?? 'Zap'] ?? ICON_MAP['Zap'];
            const isOpen = popover?.effect.uid === eff.uid;
            return (
              <div
                key={eff.uid}
                style={{ ...s.effChip, borderColor: eff.color ?? 'var(--border)', cursor: 'pointer', background: isOpen ? `${eff.color ?? 'var(--accent)'}18` : 'var(--bg-elevated)' }}
                onClick={e => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  setPopover(isOpen ? null : { effect: eff, rect });
                }}
              >
                <Icon size={10} color={eff.color ?? 'var(--text-secondary)'} />
                <span style={{ fontSize: 10, color: 'var(--text-primary)', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{eff.name}</span>
                <TurnsLeft effect={eff} globalTurn={globalTurn} queueSize={queueSize} />
                <button style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }} onClick={e => { e.stopPropagation(); onRemoveEffect(eff.uid); }}>
                  <X size={9} />
                </button>
              </div>
            );
          })}
        </div>
      )}
      <EffectPopover target={popover} globalTurn={globalTurn} onClose={() => setPopover(null)} effectTemplates={effectTemplates} sheetTypeId={character?.sheetTypeId} />

      {!reorderMode && (
        <div style={s.ctrlRow}>
          <button style={s.smBtn} onClick={onEditResources}><span style={{ fontSize: 12 }}>&#9889;</span> Editar recursos</button>
          <button style={s.smBtn} onClick={onAddEffect}><Zap size={12} /> Efeito</button>
        </div>
      )}
    </div>
  );
}

const s: Record<string, any> = {
  card:      { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, transition: 'border-color 0.2s, box-shadow 0.2s' },
  cardActive:{ background: 'var(--bg-elevated)', boxShadow: '0 0 0 1px var(--accent)20' },
  top:       { display: 'flex', alignItems: 'flex-start', gap: 10 },
  avatar:    { width: 44, height: 44, borderRadius: 8, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  nameRow:   { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 },
  name:      { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  npcBadge:  { display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: '100px', background: 'rgba(99,102,241,0.15)', color: 'var(--accent)' },
  bossBadge: { display: 'inline-flex', alignItems: 'center', gap: 2, fontSize: 9, fontWeight: 600, padding: '1px 5px', borderRadius: '100px', background: 'rgba(239,68,68,0.15)', color: '#ef4444' },
  iconBtn:   { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 3, display: 'flex', borderRadius: 4 },
  effects:   { display: 'flex', flexWrap: 'wrap', gap: 4 },
  effChip:   { display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: '100px', border: '1px solid', background: 'var(--bg-elevated)', fontSize: 10 },
  ctrlRow:   { display: 'flex', gap: 8, paddingTop: 6, borderTop: '1px solid var(--border)' },
  smBtn:     { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 4, padding: '5px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', whiteSpace: 'nowrap' },
};
