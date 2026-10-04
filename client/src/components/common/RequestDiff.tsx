import React from 'react';
import { CharacterRequest } from '../../types';
import {
  ATTRIBUTE_RATING_LABELS, ATTRIBUTE_RATING_COLORS,
} from '../../types';
import { ICON_MAP } from '../characters/SkillIconPicker';
import { useApp } from '../../contexts/AppContext';

// ── Resource diff ────────────────────────────────────────────────────────────

export function ResourceDiff({ payload, sheetTypeId }: { payload: any; sheetTypeId?: string }) {
  const { getResourceLabel, getResourceColor, getConditionDefs } = useApp();
  const prev = payload?.previousResources;
  const next = payload?.currentResources;
  const max = payload?.maxResources;
  const inspirationChanged = payload?.inspiration !== undefined;

  const prevConditions = payload?.previousConditions;
  const nextConditions = payload?.conditions;
  const conditionDefs = getConditionDefs(sheetTypeId);
  const changedConditionKeys = (prevConditions && nextConditions)
    ? Object.keys(nextConditions).filter((k) => prevConditions[k] !== nextConditions[k])
    : [];

  const changedKeys = (prev && next) ? Object.keys(next).filter((k) => prev[k] !== next[k]) : [];
  if (changedKeys.length === 0 && !inspirationChanged && changedConditionKeys.length === 0) return null;

  return (
    <div style={s.diffRow}>
      {changedKeys.map((key) => {
        const pv = prev[key] as number;
        const nv = next[key] as number;
        const mv = max ? (max[key] as number) : undefined;
        const delta = nv - pv;
        const color = getResourceColor(key, sheetTypeId);
        return (
          <div key={key} style={s.diffChip}>
            <span style={{ ...s.diffLabel, color }}>{getResourceLabel(key, sheetTypeId)}</span>
            <span style={s.diffValue}>{mv !== undefined ? `${pv}/${mv}` : pv}</span>
            <span style={s.diffArrow}>→</span>
            <span style={{ ...s.diffValue, fontWeight: 700, color }}>{mv !== undefined ? `${nv}/${mv}` : nv}</span>
            <span style={{ ...s.diffDelta, color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
              ({delta >= 0 ? '+' : ''}{delta})
            </span>
          </div>
        );
      })}
      {inspirationChanged && (
        <div style={s.diffChip}>
          <span style={{ ...s.diffLabel, color: '#f59e0b' }}>Inspiração</span>
          <span style={{ ...s.diffValue, fontWeight: 700, color: '#f59e0b' }}>{payload.inspiration}</span>
        </div>
      )}
      {changedConditionKeys.map((key) => {
        const def = conditionDefs.find((c) => c.key === key);
        const label = def?.label ?? key;
        const color = def?.color ?? 'var(--text-secondary)';
        const prevLabel = def?.states.find((st) => st.id === prevConditions[key])?.label ?? prevConditions[key] ?? '—';
        const nextLabel = def?.states.find((st) => st.id === nextConditions[key])?.label ?? nextConditions[key];
        return (
          <div key={key} style={s.diffChip}>
            <span style={{ ...s.diffLabel, color }}>{label}</span>
            <span style={s.diffValue}>{prevLabel}</span>
            <span style={s.diffArrow}>→</span>
            <span style={{ ...s.diffValue, fontWeight: 700, color }}>{nextLabel}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Skill diff ───────────────────────────────────────────────────────────────

export function SkillDiff({ payload }: { payload: any }) {
  const prev = payload?.previousSkill;
  const next = payload?.skill;
  if (!prev || !next) return null;

  const diffs: { label: string; before: React.ReactNode; after: React.ReactNode }[] = [];

  if (prev.title !== next.title) {
    diffs.push({ label: 'Título', before: prev.title, after: next.title });
  }
  if (prev.description !== next.description) {
    const short = (v: string) => v?.length > 60 ? v.slice(0, 60) + '…' : (v || '—');
    diffs.push({ label: 'Descrição', before: short(prev.description), after: short(next.description) });
  }
  if (prev.skillType !== next.skillType) {
    diffs.push({
      label: 'Tipo',
      before: prev.skillType === 'active' ? 'Ativa' : 'Passiva',
      after: next.skillType === 'active' ? 'Ativa' : 'Passiva',
    });
  }
  const iconOrColorChanged = prev.icon !== next.icon || prev.iconColor !== next.iconColor;
  if (iconOrColorChanged) {
    const PrevIcon = ICON_MAP[prev.icon as string] ?? ICON_MAP['Star'];
    const NextIcon = ICON_MAP[next.icon as string] ?? ICON_MAP['Star'];
    diffs.push({
      label: 'Ícone',
      before: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, background: `${prev.iconColor}20` }}>
          <PrevIcon size={14} color={prev.iconColor} />
          {prev.icon !== next.icon && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{prev.icon}</span>}
        </span>
      ),
      after: (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px', borderRadius: 6, background: `${next.iconColor}20` }}>
          <NextIcon size={14} color={next.iconColor} />
          {prev.icon !== next.icon && <span style={{ fontSize: 11, color: 'var(--text-primary)' }}>{next.icon}</span>}
        </span>
      ),
    });
  }
  if (JSON.stringify(prev.tags) !== JSON.stringify(next.tags)) {
    const fmt = (t: string[]) => t?.length ? t.join(', ') : '—';
    diffs.push({ label: 'Tags', before: fmt(prev.tags), after: fmt(next.tags) });
  }

  if (diffs.length === 0) return null;

  return (
    <div style={s.skillDiffBox}>
      {diffs.map((d, i) => (
        <div key={i} style={s.skillDiffRow}>
          <span style={s.skillDiffField}>{d.label}</span>
          <span style={s.skillDiffBefore}>{d.before}</span>
          <span style={s.diffArrow}>→</span>
          <span style={s.skillDiffAfter}>{d.after}</span>
        </div>
      ))}
    </div>
  );
}

// ── Character diff ───────────────────────────────────────────────────────────

export function CharacterDiff({ payload, sheetTypeId }: { payload: any; sheetTypeId?: string }) {
  const { getResourceLabel, getResourceColor } = useApp();
  const prev = payload?.previousCharacter;
  const next = payload?.character;
  if (!prev || !next) return null;

  const diffs: { label: string; before: React.ReactNode; after: React.ReactNode }[] = [];

  if (prev.name !== next.name) {
    diffs.push({ label: 'Nome', before: prev.name, after: next.name });
  }
  if (prev.description !== next.description) {
    const short = (v: string) => v?.length > 70 ? v.slice(0, 70) + '…' : (v || '—');
    diffs.push({ label: 'Descrição', before: short(prev.description), after: short(next.description) });
  }
  if (prev.avatar !== next.avatar) {
    diffs.push({
      label: 'Imagem',
      before: prev.avatar
        ? <img src={prev.avatar} alt="anterior" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover', opacity: 0.5 }} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
      after: next.avatar
        ? <img src={next.avatar} alt="nova" style={{ width: 36, height: 36, borderRadius: 6, objectFit: 'cover' }} />
        : <span style={{ color: 'var(--text-muted)' }}>—</span>,
    });
  }

  const prevAttrs: Array<{ name: string; rating: string }> = prev.attributes ?? [];
  const nextAttrs: Array<{ name: string; rating: string }> = next.attributes ?? [];
  nextAttrs.forEach((na) => {
    const pa = prevAttrs.find((a) => a.name === na.name);
    if (pa && pa.rating !== na.rating) {
      diffs.push({
        label: na.name,
        before: <span style={{ color: ATTRIBUTE_RATING_COLORS[pa.rating as keyof typeof ATTRIBUTE_RATING_COLORS] }}>{ATTRIBUTE_RATING_LABELS[pa.rating as keyof typeof ATTRIBUTE_RATING_LABELS] ?? pa.rating}</span>,
        after: <span style={{ color: ATTRIBUTE_RATING_COLORS[na.rating as keyof typeof ATTRIBUTE_RATING_COLORS], fontWeight: 700 }}>{ATTRIBUTE_RATING_LABELS[na.rating as keyof typeof ATTRIBUTE_RATING_LABELS] ?? na.rating}</span>,
      });
    }
  });

  const pr = prev.resources ?? {};
  const nr = next.resources ?? {};
  Object.keys(nr).forEach((key) => {
    if (pr[key] !== undefined && pr[key] !== nr[key]) {
      const color = getResourceColor(key, sheetTypeId);
      diffs.push({
        label: getResourceLabel(key, sheetTypeId),
        before: <span style={{ color, opacity: 0.6 }}>{pr[key]} (máx)</span>,
        after: <span style={{ color, fontWeight: 700 }}>{nr[key]} (máx)</span>,
      });
    }
  });

  if (diffs.length === 0) return null;

  return (
    <div style={s.skillDiffBox}>
      {diffs.map((d, i) => (
        <div key={i} style={s.skillDiffRow}>
          <span style={s.skillDiffField}>{d.label}</span>
          <span style={s.skillDiffBefore}>{d.before}</span>
          <span style={s.diffArrow}>→</span>
          <span style={s.skillDiffAfter}>{d.after}</span>
        </div>
      ))}
    </div>
  );
}

// ── Skill create/delete detail ───────────────────────────────────────────────

export function SkillDetail({ payload, mode }: { payload: any; mode: 'create' | 'delete' }) {
  const { getResourceLabel } = useApp();
  const skill = payload?.skill ?? (mode === 'delete' ? payload : null);
  if (!skill) return null;

  const Icon = ICON_MAP[skill.icon as string] ?? ICON_MAP['Star'];
  const color = skill.iconColor ?? '#6366f1';
  const typeLabel = skill.skillType === 'active' ? 'Ativa' : 'Passiva';
  const tags: string[] = skill.tags ?? [];
  const effects: any[] = skill.resourceEffect ?? [];

  const rows: { label: string; value: React.ReactNode }[] = [];

  rows.push({
    label: 'Ícone',
    value: (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px', borderRadius: 6, background: `${color}20` }}>
        <Icon size={14} color={color} />
        <span style={{ fontSize: 11, color }}>{skill.icon}</span>
      </span>
    ),
  });

  rows.push({ label: 'Tipo', value: <span style={{ fontWeight: 600 }}>{typeLabel}</span> });

  if (skill.description) {
    const short = skill.description.length > 80 ? skill.description.slice(0, 80) + '…' : skill.description;
    rows.push({ label: 'Descrição', value: <span style={{ color: 'var(--text-primary)' }}>{short}</span> });
  }

  if (effects.length > 0) {
    const effectStr = effects.map((e: any) => {
      const label = getResourceLabel(e.resource);
      const dir = e.direction === 'cost' ? '−' : '+';
      return `${dir}${e.amount} ${label}`;
    }).join('  ');
    rows.push({ label: 'Efeitos', value: <span style={{ color: 'var(--text-secondary)' }}>{effectStr}</span> });
  }

  if (tags.length > 0) {
    rows.push({ label: 'Tags', value: <span style={{ color: 'var(--text-muted)' }}>{tags.join(', ')}</span> });
  }

  const boxStyle = mode === 'delete'
    ? { ...s.skillDiffBox, borderLeft: '3px solid #ef444480' }
    : { ...s.skillDiffBox, borderLeft: `3px solid ${color}80` };

  return (
    <div style={boxStyle}>
      {rows.map((r, i) => (
        <div key={i} style={s.skillDiffRow}>
          <span style={s.skillDiffField}>{r.label}</span>
          <span style={{ fontSize: 12, color: 'var(--text-primary)' }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}

// ── Spell cast detail ────────────────────────────────────────────────────────

export function SpellCastDiff({ payload }: { payload: any }) {
  const { getResourceLabel } = useApp();
  if (!payload?.spellTitle) return null;

  const effects: any[] = payload.resourceEffect ?? [];

  return (
    <div style={s.skillDiffBox}>
      <div style={s.skillDiffRow}>
        <span style={s.skillDiffField}>Feitiço</span>
        <span style={{ ...s.skillDiffAfter, color: '#a855f7' }}>{payload.spellTitle}</span>
      </div>
      {effects.length > 0 && (
        <div style={s.skillDiffRow}>
          <span style={s.skillDiffField}>Custo</span>
          <span style={s.skillDiffAfter}>
            {effects.map((fx) => `${fx.direction === 'gain' ? '+' : '−'}${fx.amount} ${getResourceLabel(fx.resource)}`).join('  ')}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Skill trigger detail ─────────────────────────────────────────────────────

export function SkillTriggerDiff({ payload }: { payload: any }) {
  const { getResourceLabel } = useApp();
  if (!payload?.skillTitle) return null;

  const effects: any[] = payload.resourceEffect ?? [];

  return (
    <div style={s.skillDiffBox}>
      <div style={s.skillDiffRow}>
        <span style={s.skillDiffField}>Habilidade</span>
        <span style={{ ...s.skillDiffAfter, color: '#6366f1' }}>{payload.skillTitle}</span>
      </div>
      {effects.length > 0 && (
        <div style={s.skillDiffRow}>
          <span style={s.skillDiffField}>Custo</span>
          <span style={s.skillDiffAfter}>
            {effects.map((fx) => `${fx.direction === 'gain' ? '+' : '−'}${fx.amount} ${getResourceLabel(fx.resource)}`).join('  ')}
          </span>
        </div>
      )}
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────────────────────


// ── Item diff ─────────────────────────────────────────────────────────────────

export function ItemDiff({ payload, type }: { payload: any; type: string }) {
  if (type === 'item_add') {
    const item = payload?.item;
    if (!item) return null;
    return (
      <div style={s.skillDiffBox}>
        <div style={s.skillDiffRow}>
          <span style={s.skillDiffField}>Nome</span>
          <span style={{ ...s.skillDiffAfter, color: '#22c55e' }}>{item.name}</span>
        </div>
        <div style={s.skillDiffRow}>
          <span style={s.skillDiffField}>Tipo</span>
          <span style={s.skillDiffAfter}>{item.type}</span>
        </div>
        {item.damage && (
          <div style={s.skillDiffRow}>
            <span style={s.skillDiffField}>Dano</span>
            <span style={s.skillDiffAfter}>{item.damage}</span>
          </div>
        )}
        {item.description && (
          <div style={s.skillDiffRow}>
            <span style={s.skillDiffField}>Descrição</span>
            <span style={{ ...s.skillDiffAfter, whiteSpace: 'pre-wrap' }}>{item.description}</span>
          </div>
        )}
      </div>
    );
  }
  if (type === 'item_equip') {
    return (
      <div style={s.skillDiffBox}>
        <span style={s.skillDiffAfter}>{payload?.equipped ? 'Equipar item' : 'Desequipar item'}</span>
      </div>
    );
  }
  if (type === 'item_remove') {
    return (
      <div style={s.skillDiffBox}>
        <span style={{ ...s.skillDiffAfter, color: '#ef4444' }}>Remover item do inventário</span>
      </div>
    );
  }
  if (type === 'item_use') {
    const qty = payload?.quantity ?? 1;
    return (
      <div style={s.skillDiffBox}>
        <div style={s.skillDiffRow}>
          <span style={s.skillDiffField}>Item</span>
          <span style={{ ...s.skillDiffAfter, color: '#22c55e' }}>{payload?.itemName ?? '—'}</span>
        </div>
        <div style={s.skillDiffRow}>
          <span style={s.skillDiffField}>Quantidade</span>
          <span style={s.skillDiffAfter}>×{qty}</span>
        </div>
      </div>
    );
  }
  if (type === 'item_update') {
    const item = payload?.item;
    if (!item) return null;
    return (
      <div style={s.skillDiffBox}>
        {item.name !== undefined && (
          <div style={s.skillDiffRow}>
            <span style={s.skillDiffField}>Nome</span>
            <span style={s.skillDiffAfter}>{item.name}</span>
          </div>
        )}
        {item.type !== undefined && (
          <div style={s.skillDiffRow}>
            <span style={s.skillDiffField}>Tipo</span>
            <span style={s.skillDiffAfter}>{item.type}</span>
          </div>
        )}
        {item.damage !== undefined && (
          <div style={s.skillDiffRow}>
            <span style={s.skillDiffField}>Dano</span>
            <span style={s.skillDiffAfter}>{item.damage ?? '—'}</span>
          </div>
        )}
      </div>
    );
  }
  return null;
}

export function RequestDiff({ req, sheetTypeId }: { req: CharacterRequest; sheetTypeId?: string }) {
  if (req.type === 'resource_change') return <ResourceDiff payload={req.payload} sheetTypeId={sheetTypeId} />;
  if (req.type === 'skill_update') return <SkillDiff payload={req.payload} />;
  if (req.type === 'skill_create') return <SkillDetail payload={req.payload} mode="create" />;
  if (req.type === 'skill_delete') return <SkillDetail payload={req.payload} mode="delete" />;
  if (req.type === 'character_update') return <CharacterDiff payload={req.payload} sheetTypeId={sheetTypeId} />;
  if (req.type === 'item_add' || req.type === 'item_update' || req.type === 'item_equip' || req.type === 'item_remove' || req.type === 'item_use') {
    return <ItemDiff payload={req.payload} type={req.type} />;
  }
  if (req.type === 'spell_cast') return <SpellCastDiff payload={req.payload} />;
  if (req.type === 'skill_trigger' || req.type === 'skill_charge') return <SkillTriggerDiff payload={req.payload} />;
  return null;
}

// ── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, any> = {
  diffRow: {
    display: 'flex', flexWrap: 'wrap', gap: '8px',
    padding: '8px 10px', background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius)', marginTop: '4px',
  },
  diffChip: { display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px' },
  diffLabel: { fontWeight: 600 },
  diffValue: { color: 'var(--text-primary)' },
  diffArrow: { color: 'var(--text-muted)', fontSize: '12px' },
  diffDelta: { fontWeight: 600 },
  skillDiffBox: {
    display: 'flex', flexDirection: 'column', gap: '5px',
    padding: '8px 10px', background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius)', marginTop: '4px',
  },
  skillDiffRow: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' },
  skillDiffField: { width: '72px', fontWeight: 600, color: 'var(--text-secondary)', flexShrink: 0 },
  skillDiffBefore: { color: 'var(--text-muted)', textDecoration: 'line-through' },
  skillDiffAfter: { color: 'var(--text-primary)', fontWeight: 500 },
};
