import React from 'react';
import { Activity } from 'lucide-react';
import { Character, ConditionDef } from '../../types';
import { ICON_MAP } from './SkillIconPicker';

interface Props {
  character: Character;
  defs: ConditionDef[];
  /** Se fornecido, os estados ficam clicaveis e disparam a troca. Omitido = somente leitura. */
  onChange?: (key: string, stateId: string) => void;
}

export function ConditionsDisplay({ character, defs, onChange }: Props) {
  if (defs.length === 0) return null;

  return (
    <div style={s.wrapper}>
      {defs.map((def) => {
        const Icon = ICON_MAP[def.icon] ?? Activity;
        const currentId = character.conditions?.[def.key];
        return (
          <div key={def.key} style={s.row}>
            <div style={s.label}>
              <Icon size={13} color={def.color} />
              <span style={s.labelText}>{def.label}</span>
            </div>
            <div style={s.states}>
              {def.states.length === 0 && (
                <span style={s.emptyHint}>Sem estados configurados</span>
              )}
              {def.states.map((state) => {
                const active = state.id === currentId;
                const clickable = !!onChange;
                return (
                  <button
                    key={state.id}
                    type="button"
                    disabled={!clickable}
                    onClick={() => onChange?.(def.key, state.id)}
                    style={{
                      ...s.stateBtn,
                      border: `1px solid ${active ? def.color : 'var(--border)'}`,
                      background: active ? `${def.color}20` : 'var(--bg-elevated)',
                      color: active ? def.color : 'var(--text-secondary)',
                      cursor: clickable ? 'pointer' : 'default',
                    }}
                  >
                    {state.label}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: 10 },
  row: { display: 'flex', flexDirection: 'column', gap: 5 },
  label: { display: 'flex', alignItems: 'center', gap: 6 },
  labelText: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' },
  states: { display: 'flex', gap: 5, flexWrap: 'wrap' },
  stateBtn: {
    padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: 11, fontWeight: 600,
    transition: 'all 0.15s',
  },
  emptyHint: { fontSize: 11, color: 'var(--text-muted)' },
};
