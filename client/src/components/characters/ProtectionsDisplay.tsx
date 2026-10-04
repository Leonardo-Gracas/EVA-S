import React from 'react';
import { Shield } from 'lucide-react';
import { Character, protectionStat } from '../../types';
import { useApp } from '../../contexts/AppContext';
import { ICON_MAP } from './SkillIconPicker';
import { getEquippedBonus } from '../../utils/equippedEffects';

export function ProtectionsDisplay({ character, compact = false }: { character: Character; compact?: boolean }) {
  const { getProtectionDefs } = useApp();
  const defs = getProtectionDefs(character.sheetTypeId);

  const getBonus = (key: string) => getEquippedBonus(character.items, protectionStat(key));

  if (compact) {
    // Horizontal row used in PlayerView
    return (
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {defs.map((def) => {
          const Icon = ICON_MAP[def.icon] ?? Shield;
          const bonus = getBonus(def.key);
          const total = (character.protections?.[def.key] ?? 0) + bonus;
          return (
            <div key={def.key} style={{ flex: 1, minWidth: 70, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 6px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
              <Icon size={13} color={def.color} />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500 }}>{def.label}</span>
              <span style={{ fontSize: '20px', fontWeight: 700, color: def.color, lineHeight: 1 }}>{total}</span>
              {bonus !== 0 && <span style={{ fontSize: '10px', color: bonus > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>({bonus > 0 ? '+' : ''}{bonus})</span>}
            </div>
          );
        })}
      </div>
    );
  }

  // Vertical list used in CharacterSheet
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      {defs.map((def) => {
        const Icon = ICON_MAP[def.icon] ?? Shield;
        const bonus = getBonus(def.key);
        const total = (character.protections?.[def.key] ?? 0) + bonus;
        return (
          <div key={def.key} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' }}>
            <Icon size={13} color={def.color} />
            <span style={{ flex: 1, fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{def.label}</span>
            <span style={{ fontSize: '16px', fontWeight: 700, color: def.color }}>{total}</span>
            {bonus !== 0 && (
              <span style={{ fontSize: '11px', color: bonus > 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>
                ({bonus > 0 ? '+' : ''}{bonus})
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}
