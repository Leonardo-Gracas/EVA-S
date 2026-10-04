import React from 'react';
import { CombatParticipant, Character, CombatActiveEffect, protectionStat, resourceMaxStat } from '../../types';
import { PopoverTarget } from './EffectPopover';
import { useApp } from '../../contexts/AppContext';
import { getEquippedApplications } from '../../utils/equippedEffects';

interface Props {
  participant: CombatParticipant;
  character: Character | undefined;
  isActive: boolean;
  effPopover: PopoverTarget | null;
  onEffectClick: (eff: CombatActiveEffect, rect: DOMRect) => void;
}

export function CombatQueueEntry({ participant: p, character: char, isActive, effPopover, onEffectClick }: Props) {
  const { getResourceDefs, getProtectionDefs } = useApp();

  const equippedApps = getEquippedApplications(char?.items);

  const prot = getProtectionDefs(char?.sheetTypeId).map((def) => ({
    ...def,
    total: (char?.protections?.[def.key] ?? 0) + equippedApps
      .filter(a => a.stat === protectionStat(def.key))
      .reduce((s, a) => s + (a.operation === 'add' ? a.value : -a.value), 0),
  }));

  const resources = getResourceDefs(char?.sheetTypeId).map((def) => ({
    key: def.key,
    label: def.label.slice(0, 2).toUpperCase(),
    color: def.color,
    max: (char?.resources[def.key] ?? 0) + equippedApps
      .filter(a => a.stat === resourceMaxStat(def.key))
      .reduce((s, a) => s + (a.operation === 'add' ? a.value : -a.value), 0),
    cur: p.currentResources[def.key] ?? 0,
  }));

  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', gap: 6,
      padding: '7px 8px', borderBottom: '1px solid var(--border)',
      background: isActive ? 'var(--accent-dim)' : 'transparent',
    }}>
      {/* Turn dot */}
      <div style={{ width: 5, height: 5, borderRadius: '50%', background: isActive ? 'var(--accent)' : 'var(--border)', flexShrink: 0, marginTop: 5 }} />

      {/* Avatar */}
      <div style={{ width: 28, height: 28, borderRadius: 5, background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 }}>
        {char?.avatar
          ? <img src={char.avatar} alt={p.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 5, objectPosition: char.avatarPosition ?? '50% 50%' }} />
          : <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)' }}>{p.displayName.charAt(0)}</span>}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Name */}
        <div style={{ fontSize: 11, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: 3 }}>
          {p.displayName}
        </div>

        {/* Resources */}
        {p.isBossMode ? (
          <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 1 }}>
            {resources.filter(r => r.max > 0).map(({ key, label, cur, max, color }) => {
              const damaged = max - cur;
              const hasHit = damaged > 0;
              return (
                <span key={key} style={{
                  fontSize: 9, fontWeight: 700, lineHeight: 1, padding: '2px 5px', borderRadius: 100,
                  color: hasHit ? color : 'var(--text-muted)',
                  background: hasHit ? `${color}18` : 'var(--bg-elevated)',
                  border: `1px solid ${hasHit ? `${color}55` : 'var(--border)'}`,
                }}>
                  {label} {hasHit ? `-${damaged}` : '—'}
                </span>
              );
            })}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 1 }}>
            {resources.map(({ key, max, cur, color }) => {
              if (max === 0) return null;
              return (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <div style={{ flex: 1, height: 3, background: 'var(--bg-surface)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${(cur / max) * 100}%`, background: color, borderRadius: 2 }} />
                  </div>
                  <span style={{ fontSize: 9, color: 'var(--text-muted)', minWidth: 28, textAlign: 'right' }}>{cur}/{max}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Protections */}
        <div style={{ display: 'flex', gap: 5, marginTop: 2 }}>
          {prot.map((p) => (
            <span key={p.key} style={{ fontSize: 8, color: p.color, display: 'flex', alignItems: 'center', gap: 1 }}>
              &#128737; {p.total}
            </span>
          ))}
        </div>

        {/* Effects */}
        {p.activeEffects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, marginTop: 3 }}>
            {p.activeEffects.map(eff => (
              <button
                key={eff.uid}
                onClick={e => {
                  e.stopPropagation();
                  const rect = e.currentTarget.getBoundingClientRect();
                  onEffectClick(eff, rect);
                }}
                style={{
                  fontSize: 8, padding: '2px 5px', borderRadius: '100px', cursor: 'pointer', lineHeight: 1.4,
                  border: `1px solid ${eff.color ?? 'var(--border)'}`,
                  color: eff.color ?? 'var(--text-muted)',
                  background: effPopover?.effect.uid === eff.uid ? `${eff.color ?? '#6366f1'}22` : 'var(--bg-elevated)',
                }}
              >
                {eff.name}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
