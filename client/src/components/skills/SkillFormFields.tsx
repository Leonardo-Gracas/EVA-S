import React from 'react';
import { Check, Zap, Shield } from 'lucide-react';
import {
  CreateSkillDTO, SkillUsesLimitType, SKILL_TAGS,
} from '../../types';
import SkillIconPicker from '../characters/SkillIconPicker';
import { Textarea, Select } from '../common/Input';
import { ResEffectsForm, defaultResEffects } from '../../utils/resourceEffects';
import { useApp } from '../../contexts/AppContext';

// Re-export so consumers can just import from here
export type { ResEffectsForm };
export { defaultResEffects };

interface SkillFormFieldsProps {
  form: Partial<Pick<CreateSkillDTO, 'icon' | 'iconColor' | 'title' | 'description' | 'skillType' | 'tags' | 'usesLimit' | 'usesLimitType' | 'visibility'>>;
  onChange: (patch: Partial<SkillFormFieldsProps['form']>) => void;
  resEffects: ResEffectsForm;
  onResEffectsChange: (patch: ResEffectsForm) => void;
  showVisibility?: boolean;    // false for SkillLibrary (template has no visibility)
  titlePlaceholder?: string;
  /** Tipo de ficha do personagem dono da skill — omitido nos editores de template (SkillLibrary/GrimorioLibrary), que usam o tipo padrao. */
  sheetTypeId?: string;
}

export function SkillFormFields({
  form, onChange, resEffects, onResEffectsChange, showVisibility = true, titlePlaceholder = 'Ex: Ataque Certeiro', sheetTypeId,
}: SkillFormFieldsProps) {
  const { getResourceDefs } = useApp();
  const resourceDefs = getResourceDefs(sheetTypeId);
  const label: React.CSSProperties = { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' };
  const typeBtn: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '6px', flex: 1, padding: '9px', justifyContent: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'all var(--transition)' };
  const typeBtnActive: React.CSSProperties = { background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' };
  const resAmount: React.CSSProperties = { width: '56px', padding: '6px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '14px', fontWeight: 600, textAlign: 'center' };
  const resToggle: React.CSSProperties = { width: '22px', height: '22px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-surface)', cursor: 'pointer', flexShrink: 0, transition: 'all var(--transition)' };
  const dirBtn: React.CSSProperties = { padding: '5px 10px', background: 'var(--bg-surface)', border: 'none', color: 'var(--text-secondary)', fontSize: '12px', fontWeight: 500, cursor: 'pointer', transition: 'all var(--transition)' };
  const tagToggle: React.CSSProperties = { padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 500, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all var(--transition)' };
  const tagToggleActive: React.CSSProperties = { background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' };

  return (
    <>
      <SkillIconPicker
        selectedIcon={form.icon ?? 'Star'}
        selectedColor={form.iconColor ?? '#6366f1'}
        onIconChange={(icon) => onChange({ icon })}
        onColorChange={(iconColor) => onChange({ iconColor })}
      />

      <div style={{ height: '1px', background: 'var(--border)' }} />

      {/* Type toggle */}
      <div>
        <label style={label}>Tipo</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['passive', 'active'] as const).map((v) => (
            <button key={v} type="button"
              style={{ ...typeBtn, ...(form.skillType === v ? typeBtnActive : {}) }}
              onClick={() => onChange({ skillType: v })}>
              {v === 'passive' ? <><Shield size={13} /> Passiva</> : <><Zap size={13} /> Ativa</>}
            </button>
          ))}
        </div>
      </div>

      {/* Resource effects */}
      {form.skillType === 'active' && (
        <div style={{ background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <label style={label}>Efeitos de Recurso</label>
          {resourceDefs.map((def) => {
            const res = def.key;
            const row = resEffects[res];
            if (!row) return null;
            const color = def.color;
            return (
              <div key={res} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button type="button"
                  style={{ ...resToggle, ...(row.enabled ? { borderColor: color, background: `${color}20`, color } : {}) }}
                  onClick={() => onResEffectsChange({ ...resEffects, [res]: { ...resEffects[res], enabled: !resEffects[res].enabled } })}>
                  {row.enabled ? <Check size={11} /> : <span style={{ width: 11, height: 11, display: 'inline-block' }} />}
                </button>
                <span style={{ width: '76px', fontSize: '13px', flexShrink: 0, color: row.enabled ? color : 'var(--text-muted)', fontWeight: row.enabled ? 600 : 400 }}>
                  {def.label}
                </span>
                <input type="number" min={1} value={row.amount} disabled={!row.enabled}
                  onChange={(e) => onResEffectsChange({ ...resEffects, [res]: { ...resEffects[res], amount: Math.max(1, Number(e.target.value)) } })}
                  style={{ ...resAmount, opacity: row.enabled ? 1 : 0.35 }} />
                <div style={{ display: 'flex', borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0 }}>
                  {(['cost', 'gain'] as const).map((d) => (
                    <button key={d} type="button" disabled={!row.enabled}
                      style={{
                        ...dirBtn,
                        ...(row.enabled && row.direction === d
                          ? d === 'cost'
                            ? { background: 'rgba(239,68,68,0.15)', color: '#ef4444', fontWeight: 600 }
                            : { background: 'rgba(34,197,94,0.15)', color: '#22c55e', fontWeight: 600 }
                          : {}),
                        opacity: row.enabled ? 1 : 0.35,
                      }}
                      onClick={() => onResEffectsChange({ ...resEffects, [res]: { ...resEffects[res], direction: d } })}>
                      {d === 'cost' ? 'Custo' : 'Ganho'}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Uses limit */}
      <div>
        <label style={label}>Limite de usos</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button type="button"
            style={{ ...typeBtn, ...(form.usesLimit !== null ? typeBtnActive : {}), fontSize: '12px' }}
            onClick={() => onChange(form.usesLimit === null ? { usesLimit: 1, usesLimitType: 'rest' } : { usesLimit: null, usesLimitType: null })}>
            {form.usesLimit !== null ? 'Limitado' : 'Sem limite'}
          </button>
          {form.usesLimit !== null && (
            <>
              <input type="number" min={1} value={form.usesLimit ?? 1}
                onChange={e => onChange({ usesLimit: Math.max(1, Number(e.target.value)) })}
                style={{ ...resAmount, width: 56 }} />
              <select value={form.usesLimitType ?? 'rest'}
                onChange={e => onChange({ usesLimitType: e.target.value as SkillUsesLimitType })}
                style={{ padding: '5px 8px', fontSize: '12px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-primary)', flex: 1 }}>
                <option value="rest">Por descanso</option>
                <option value="combat">Por combate</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <label style={label}>Título</label>
        <input
          style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '14px', boxSizing: 'border-box' as const }}
          value={form.title ?? ''}
          onChange={(e) => onChange({ title: e.target.value })}
          placeholder={titlePlaceholder}
        />
      </div>

      {/* Description */}
      <Textarea label="Descrição" value={form.description ?? ''} onChange={(e) => onChange({ description: e.target.value })} rows={2} placeholder="Descreva o efeito desta habilidade..." />

      {/* Tags */}
      <div>
        <label style={label}>Tags</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {SKILL_TAGS.map((tag) => {
            const active = form.tags?.includes(tag);
            return (
              <button key={tag} type="button"
                style={{ ...tagToggle, ...(active ? tagToggleActive : {}) }}
                onClick={() => onChange({ tags: active ? (form.tags ?? []).filter(t => t !== tag) : [...(form.tags ?? []), tag] })}>
                {tag}
              </button>
            );
          })}
        </div>
      </div>

      {/* Visibility — only for character skills, not templates */}
      {showVisibility && (
        <Select label="Visibilidade" value={(form as any).visibility ?? 'private'} onChange={(e) => onChange({ visibility: e.target.value as any })}
          options={[
            { value: 'private', label: '🔒 Privado — apenas dono e mestre' },
            { value: 'public', label: '👁 Público — todos os jogadores' },
          ]} />
      )}
    </>
  );
}
