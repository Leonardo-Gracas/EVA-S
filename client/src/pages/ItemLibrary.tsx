import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import { matchesSearch } from '../utils/normalizeSearch';
import { Plus, Edit2, Trash2, Backpack, Sword, Shield, FlaskConical, Star, X, Sparkles, ChevronDown } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import {
  ItemTemplate, CreateItemTemplateDTO, ItemEffect, EffectApplication,
  EffectStat, EffectOperation, ItemType, SheetType,
  ITEM_TYPE_LABELS, ITEM_TYPE_COLORS,
  allEffectStatsForCampaign, getEffectStatLabelForCampaign, parseProtectionStat, parseResourceStat,
  EFFECT_STAT_MOVEMENT, EFFECT_STAT_CUSTOM,
} from '../types';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';
import { Textarea } from '../components/common/Input';
import SkillIconPicker, { ICON_MAP } from '../components/characters/SkillIconPicker';
import NumericInput from '../components/common/NumericInput';
import { ItemEffectPopover, ItemEffectTarget } from '../components/combat/EffectPopover';

const TYPE_ICONS: Record<ItemType, React.ComponentType<any>> = {
  weapon: Sword,
  vest: Shield,
  consumable: FlaskConical,
  special: Star,
};

// Itens sao globais a campanha — um mesmo item pode ser equipado por personagens de qualquer tipo de
// ficha, entao o picker de stat precisa oferecer os campos de TODOS os tipos configurados (nao so de
// um), senao efeitos criados pra um tipo de ficha diferente do "selecionado" na tela ficam invisiveis
// e nunca aplicam corretamente. Ver allEffectStatsForCampaign.
function equippableStats(sheetTypes: SheetType[]): { value: EffectStat; label: string }[] {
  return allEffectStatsForCampaign(sheetTypes).filter((o) => parseResourceStat(o.value)?.field !== 'current');
}
function consumableStats(sheetTypes: SheetType[]): { value: EffectStat; label: string }[] {
  return allEffectStatsForCampaign(sheetTypes).filter((o) => o.value !== EFFECT_STAT_MOVEMENT && !parseProtectionStat(o.value));
}

function statsForType(type: ItemType, sheetTypes: SheetType[]): { value: EffectStat; label: string }[] {
  if (type === 'weapon' || type === 'vest') return equippableStats(sheetTypes);
  if (type === 'consumable') return consumableStats(sheetTypes);
  return allEffectStatsForCampaign(sheetTypes);
}

// ── Damage string helpers ────────────────────────────────────────────────────
function parseDamageStr(s?: string): number[] {
  if (!s) return [];
  const m = s.match(/\{([^}]*)\}/);
  if (!m || !m[1].trim()) return [];
  return m[1].split(',').map(v => parseInt(v.trim())).filter(v => !isNaN(v));
}
function formatDamageArr(arr: number[]): string {
  const valid = arr.filter((_, i) => i < 7);
  return valid.length ? '{' + valid.join(', ') + '}' : '';
}

// ── Dice damage helpers ──────────────────────────────────────────────────────
// Parses expressions like "1d4", "2d4" or "1 + 2d3" into their min–max damage range.
function parseDiceRange(expr: string): { min: number; max: number } | null {
  const terms = expr.trim().match(/[+-]?\s*[^+-]+/g);
  if (!terms) return null;
  let min = 0, max = 0, found = false;
  for (const raw of terms) {
    const t = raw.trim();
    if (!t) continue;
    const sign = t.startsWith('-') ? -1 : 1;
    const body = t.replace(/^[+-]\s*/, '').trim();
    const diceMatch = body.match(/^(\d*)d(\d+)$/i);
    if (diceMatch) {
      const n = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
      const sides = parseInt(diceMatch[2], 10);
      if (!n || !sides) return null;
      const lo = n * 1, hi = n * sides;
      min += sign > 0 ? lo : -hi;
      max += sign > 0 ? hi : -lo;
      found = true;
      continue;
    }
    if (/^\d+$/.test(body)) {
      min += sign * parseInt(body, 10);
      max += sign * parseInt(body, 10);
      found = true;
      continue;
    }
    return null;
  }
  return found ? { min, max } : null;
}
function stripDiceRange(stored: string): string {
  return stored.replace(/\s*\([^)]*\)\s*$/, '').trim();
}
function formatDiceDamage(text: string): string {
  const base = text.trim();
  if (!base) return '';
  const range = parseDiceRange(base);
  return range ? `${base} (${range.min}-${range.max})` : base;
}

function DiceDamageEditor({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [text, setText] = React.useState(() => stripDiceRange(value ?? ''));
  const range = parseDiceRange(text);

  const update = (v: string) => {
    setText(v);
    onChange(formatDiceDamage(v));
  };

  return (
    <div>
      <input
        style={s.input}
        value={text}
        onChange={(e) => update(e.target.value)}
        placeholder="Ex: 1d4, 2d4, 1 + 2d3"
      />
      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '8px 0 0', fontFamily: 'monospace' }}>
        {!text.trim()
          ? 'Escreva a expressão de dados. A faixa mín.–máx. é calculada automaticamente.'
          : range
          ? `Formato: ${formatDiceDamage(text)}`
          : 'Expressão inválida — use algo como 1d4, 2d6, 1 + 2d3'}
      </p>
    </div>
  );
}

// ── Damage mode toggle ───────────────────────────────────────────────────────
function DamageInput({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [mode, setMode] = React.useState<'stages' | 'dice'>(() =>
    value && !value.trim().startsWith('{') ? 'dice' : 'stages'
  );

  const switchMode = (m: 'stages' | 'dice') => {
    if (m === mode) return;
    setMode(m);
    onChange('');
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>
        <button
          style={{ ...s.typeSelectorBtn, ...(mode === 'stages' ? s.typeTabActive : {}) }}
          onClick={() => switchMode('stages')}
        >Por estágio de proteção</button>
        <button
          style={{ ...s.typeSelectorBtn, ...(mode === 'dice' ? s.typeTabActive : {}) }}
          onClick={() => switchMode('dice')}
        >Dado (ex: 1d4)</button>
      </div>
      {mode === 'stages' ? (
        <div>
          <p style={{ ...s.hint, marginBottom: 8 }}>Cada valor = dano causado quando o alvo tem aquela proteção. Máx. 7 estágios.</p>
          <DamageEditor value={value} onChange={onChange} />
        </div>
      ) : (
        <DiceDamageEditor value={value} onChange={onChange} />
      )}
    </div>
  );
}

// ── Damage editor ────────────────────────────────────────────────────────────
function DamageEditor({ value, onChange }: { value?: string; onChange: (v: string) => void }) {
  const [vals, setVals] = React.useState<number[]>(() => {
    const p = parseDamageStr(value);
    return p.length ? p : [0];
  });

  const update = (newVals: number[]) => {
    setVals(newVals);
    onChange(formatDamageArr(newVals));
  };

  return (
    <div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '8px', alignItems: 'flex-end' }}>
        {vals.map((v, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>Prot. {i}</span>
            <NumericInput
              value={v}
              onChange={(n) => { const arr = [...vals]; arr[i] = n; update(arr); }}
              min={0}
              width={82}
              inputStyle={{ color: '#f59e0b', fontWeight: 700 }}
            />
          </div>
        ))}
        <div style={{ display: 'flex', gap: '4px', alignItems: 'flex-end' }}>
          {vals.length < 7 && (
            <button
              style={s.stageBtn}
              onClick={() => update([...vals, 0])}
              title="Adicionar estágio"
            >+ Estágio</button>
          )}
          {vals.length > 1 && (
            <button
              style={{ ...s.stageBtn, color: '#ef4444', borderColor: '#ef444450' }}
              onClick={() => update(vals.slice(0, -1))}
              title="Remover último estágio"
            >− Remover</button>
          )}
        </div>
      </div>
      {vals.length > 0 && (
        <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0, fontFamily: 'monospace' }}>
          Formato: {formatDamageArr(vals)}
        </p>
      )}
    </div>
  );
}

// ── Effect editor ────────────────────────────────────────────────────────────
const defaultEffect = (): ItemEffect => ({
  name: '', icon: 'Sparkles', color: '#6366f1', description: '', applications: [],
});

function EffectEditor({
  effect, index, onChange, onRemove, effectTemplates, itemType, sheetTypes,
}: {
  effect: ItemEffect;
  index: number;
  onChange: (e: ItemEffect) => void;
  onRemove: () => void;
  effectTemplates: any[];
  itemType: ItemType;
  sheetTypes: SheetType[];
}) {
  const isLinked = !!effect.templateId;
  const [showPicker, setShowPicker] = useState(!isLinked);
  const [search, setSearch] = useState('');

  const defaultStat = statsForType(itemType, sheetTypes)[0]?.value ?? EFFECT_STAT_CUSTOM;
  const addApplication = () => onChange({ ...effect, applications: [...effect.applications, { stat: defaultStat, operation: 'add' as EffectOperation, value: 1 }] });
  const updateApp = (i: number, app: EffectApplication) => { const apps = [...effect.applications]; apps[i] = app; onChange({ ...effect, applications: apps }); };
  const removeApp = (i: number) => onChange({ ...effect, applications: effect.applications.filter((_, idx) => idx !== i) });

  const selectTemplate = (t: any) => {
    onChange({ ...effect, templateId: t.id, name: t.name, icon: t.icon, color: t.iconColor, description: t.description, applications: [...t.applications] });
    setShowPicker(false);
    setSearch('');
  };

  const filtered = effectTemplates
    .filter((t) => matchesSearch(t.name, search))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));
  const EffIcon = ICON_MAP[effect.icon ?? 'Sparkles'] ?? ICON_MAP['Sparkles'];
  const color = effect.color ?? '#6366f1';

  return (
    <div style={s.effectBlock}>
      {/* Header */}
      <div style={s.effectHeader}>
        <div style={{ ...s.effIconBox, background: `${color}20` }}>
          <EffIcon size={14} color={color} />
        </div>
        <span style={s.effName}>{effect.name || `Efeito ${index + 1}`}</span>
        {isLinked ? (
          <button style={s.addSmallBtn} onClick={() => { setShowPicker((v) => !v); setSearch(''); }}>
            {showPicker ? 'Fechar' : 'Trocar'}
          </button>
        ) : (
          <button style={s.effToggle} onClick={() => { setShowPicker((v) => !v); setSearch(''); }}>
            <ChevronDown size={13} style={{ transform: showPicker ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </button>
        )}
        <button style={{ ...s.iconBtn, color: 'var(--error)' }} onClick={onRemove}><X size={13} /></button>
      </div>

      {/* Painel de seleção da biblioteca */}
      {showPicker && (
        <div style={s.effBody}>
          <input
            style={s.input}
            placeholder="Buscar efeito na biblioteca..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '220px', overflowY: 'auto' }}>
            {filtered.map((t) => {
              const TIcon = ICON_MAP[t.icon ?? 'Sparkles'] ?? ICON_MAP['Sparkles'];
              const tc = t.iconColor ?? '#6366f1';
              return (
                <button key={t.id} style={s.effPickerCard} onClick={() => selectTemplate(t)}>
                  <div style={{ ...s.effIconBox, background: `${tc}20`, flexShrink: 0 }}>
                    <TIcon size={14} color={tc} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                    <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>{t.name}</div>
                    {t.applications.length > 0 && (
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: 1 }}>
                        {t.applications.map((a: EffectApplication, ai: number) => (
                          <span key={ai}>{ai > 0 ? ' · ' : ''}{a.operation === 'add' ? '+' : '−'}{a.value} {getEffectStatLabelForCampaign(a.stat, sheetTypes)}</span>
                        ))}
                      </div>
                    )}
                    {t.description && (
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0', whiteSpace: 'pre-wrap', lineHeight: 1.4 }}>{t.description}</p>
                    )}
                  </div>
                </button>
              );
            })}
            {filtered.length === 0 && <p style={{ ...s.hint, padding: '6px 0' }}>Nenhum efeito encontrado.</p>}
          </div>
          {!isLinked && (
            <button style={{ ...s.addSmallBtn, alignSelf: 'flex-start' }} onClick={() => setShowPicker(false)}>
              Criar do zero (sem referência)
            </button>
          )}
        </div>
      )}

      {/* Efeito vinculado — exibição somente-leitura + duração */}
      {!showPicker && isLinked && (
        <div style={s.effBody}>
          {effect.applications.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
              {effect.applications.map((a, ai) => (
                <span key={ai} style={{ fontSize: '11px', background: `${color}18`, color, border: `1px solid ${color}44`, borderRadius: 100, padding: '1px 7px' }}>
                  {a.operation === 'add' ? '+' : '−'}{a.value} {getEffectStatLabelForCampaign(a.stat, sheetTypes)}
                </span>
              ))}
            </div>
          )}
          {effect.description && (
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{effect.description}</p>
          )}
          {itemType === 'consumable' && (
            <div>
              <label style={s.label}>
                Duração (turnos){' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— 0 = efeito instantâneo</span>
              </label>
              <NumericInput value={effect.duration ?? 0} onChange={(n) => onChange({ ...effect, duration: n || undefined })} min={0} width={120} />
              {(effect.duration ?? 0) > 0 && (
                <p style={{ fontSize: '11px', color: '#f59e0b', margin: '4px 0 0' }}>
                  Efeito temporário — ativo por {effect.duration} turno{effect.duration !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Editor livre — sem referência de template */}
      {!showPicker && !isLinked && (
        <div style={s.effBody}>
          <div>
            <label style={s.label}>Nome</label>
            <input value={effect.name} onChange={(e) => onChange({ ...effect, name: e.target.value })} style={s.input} placeholder="Nome do efeito" />
          </div>
          <div>
            <label style={s.label}>Descrição</label>
            <textarea value={effect.description} onChange={(e) => onChange({ ...effect, description: e.target.value })} style={{ ...s.input, resize: 'vertical', minHeight: 56 }} rows={2} />
          </div>
          <div>
            <label style={s.label}>Ícone e Cor</label>
            <SkillIconPicker collapsible selectedIcon={effect.icon ?? 'Sparkles'} selectedColor={effect.color ?? '#6366f1'} onIconChange={(icon) => onChange({ ...effect, icon })} onColorChange={(c) => onChange({ ...effect, color: c })} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <label style={{ ...s.label, marginBottom: 0 }}>Aplicações numéricas</label>
              <button style={s.addSmallBtn} onClick={addApplication}><Plus size={11} /> Adicionar</button>
            </div>
            {effect.applications.map((app, ai) => (
              <div key={ai} style={{ ...s.appRow, marginBottom: 4 }}>
                <select value={app.stat} onChange={(e) => updateApp(ai, { ...app, stat: e.target.value as EffectStat })} style={{ ...s.select, flex: 1 }}>
                  {statsForType(itemType, sheetTypes).map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
                <select value={app.operation} onChange={(e) => updateApp(ai, { ...app, operation: e.target.value as EffectOperation })} style={{ ...s.select, width: '95px' }}>
                  <option value="add">+ Adicionar</option>
                  <option value="subtract">− Subtrair</option>
                </select>
                <NumericInput value={app.value} onChange={(n) => updateApp(ai, { ...app, value: n })} min={0} width={84} />
                {app.stat === 'custom' && (
                  <input value={app.customName ?? ''} onChange={(e) => updateApp(ai, { ...app, customName: e.target.value })} style={{ ...s.input, width: '120px' }} placeholder="Nome" />
                )}
                <button style={s.iconBtn} onClick={() => removeApp(ai)}><X size={11} /></button>
              </div>
            ))}
            {effect.applications.length === 0 && <p style={s.hint}>Sem aplicações numéricas — apenas descritivo.</p>}
          </div>
          {itemType === 'consumable' && (
            <div>
              <label style={s.label}>
                Duração (turnos){' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>— 0 = efeito instantâneo</span>
              </label>
              <NumericInput value={effect.duration ?? 0} onChange={(n) => onChange({ ...effect, duration: n || undefined })} min={0} width={120} />
              {(effect.duration ?? 0) > 0 && (
                <p style={{ fontSize: '11px', color: '#f59e0b', margin: '4px 0 0' }}>
                  Efeito temporário — ativo por {effect.duration} turno{effect.duration !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Item card (grid) ──────────────────────────────────────────────────────────
function ItemCard({ item, onEdit, onDelete, sheetTypes }: { item: ItemTemplate; onEdit: () => void; onDelete: () => void; sheetTypes: SheetType[] }) {
  const [effTarget, setEffTarget] = useState<ItemEffectTarget | null>(null);
  const customIcon = item.icon ? ICON_MAP[item.icon] : null;
  const TypeIcon = customIcon ?? TYPE_ICONS[item.type];
  const iconColor = item.iconColor ?? ITEM_TYPE_COLORS[item.type];
  const typeColor = ITEM_TYPE_COLORS[item.type];

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <div style={{ ...s.typeIconBox, background: `${iconColor}20` }}>
          <TypeIcon size={16} color={iconColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={s.cardName}>{item.name}</div>
          <span style={{ ...s.typeBadge, color: typeColor, border: `1px solid ${typeColor}40`, background: `${typeColor}15` }}>
            {ITEM_TYPE_LABELS[item.type]}
          </span>
        </div>
        <div style={s.cardActions}>
          <button style={s.iconBtn} onClick={onEdit}><Edit2 size={13} /></button>
          <button style={{ ...s.iconBtn, color: 'var(--error)' }} onClick={onDelete}><Trash2 size={13} /></button>
        </div>
      </div>
      {item.description && (
        <p style={{ ...s.cardDesc, whiteSpace: 'pre-wrap' }}>{item.description}</p>
      )}
      {item.type === 'weapon' && item.damage && (
        <div style={s.damageBadge}>⚔ Dano: <code style={s.damageCode}>{item.damage}</code></div>
      )}
      {item.effects.length > 0 && (
        <div style={s.effectsList}>
          {item.effects.map((eff, i) => {
            const EffIcon = ICON_MAP[eff.icon ?? 'Sparkles'] ?? ICON_MAP['Sparkles'];
            const color = eff.color ?? '#6366f1';
            const isActive = effTarget?.effect === eff;
            return (
              <button
                key={i}
                onClick={(e) => {
                  e.stopPropagation();
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setEffTarget(isActive ? null : { effect: eff, rect });
                }}
                style={{
                  ...s.effTag,
                  borderColor: isActive ? color : `${color}40`,
                  background: isActive ? `${color}18` : 'var(--bg-elevated)',
                  cursor: 'pointer',
                }}
              >
                <EffIcon size={11} color={color} />
                <span style={{ color }}>{eff.name || eff.description}</span>
              </button>
            );
          })}
        </div>
      )}
      <ItemEffectPopover target={effTarget} onClose={() => setEffTarget(null)} sheetTypes={sheetTypes} />
    </div>
  );
}

// ── Default form ─────────────────────────────────────────────────────────────
const defaultForm = (): CreateItemTemplateDTO & { icon: string; iconColor: string } => ({
  name: '', description: '', type: 'special', damage: '', effects: [], icon: 'Star', iconColor: '#6366f1',
});

// ── Main page ─────────────────────────────────────────────────────────────────
export default function ItemLibrary({ embedded = false }: { embedded?: boolean }) {
  useTitle('Itens');
  const { itemTemplates, effectTemplates, dispatch, sheetTypes } = useApp();
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<ItemType | 'all'>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<ItemTemplate | null>(null);
  const [form, setForm] = useState<CreateItemTemplateDTO & { icon: string; iconColor: string }>(defaultForm());
  const [saving, setSaving] = useState(false);

  const filtered = itemTemplates
    .filter((item) => {
      const matchSearch = matchesSearch(item.name, search) || matchesSearch(item.description, search);
      const matchType = typeFilter === 'all' || item.type === typeFilter;
      return matchSearch && matchType;
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  const openCreate = () => { setEditing(null); setForm(defaultForm()); setModalOpen(true); };
  const openEdit = (item: ItemTemplate) => {
    setEditing(item);
    setForm({
      name: item.name, description: item.description, type: item.type,
      damage: item.damage ?? '',
      effects: item.effects.map((e) => ({ ...e, applications: [...e.applications] })),
      icon: item.icon ?? 'Star',
      iconColor: item.iconColor ?? '#6366f1',
    });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const addEffect = () => setForm((f) => ({ ...f, effects: [...(f.effects ?? []), defaultEffect()] }));
  const updateEffect = (i: number, e: ItemEffect) => setForm((f) => { const effs = [...(f.effects ?? [])]; effs[i] = e; return { ...f, effects: effs }; });
  const removeEffect = (i: number) => setForm((f) => ({ ...f, effects: (f.effects ?? []).filter((_, idx) => idx !== i) }));

  const handleSave = async () => {
    if (!form.name?.trim()) return alert('Nome obrigatório');

    // Duplicate check for item name
    const duplicate = itemTemplates.find(
      (t) => t.name.toLowerCase() === (form.name ?? '').toLowerCase().trim() && t.id !== editing?.id
    );
    if (duplicate) {
      if (!confirm(`Item "${form.name}" já existe na biblioteca. Substituir?`)) return;
    }

    setSaving(true);
    try {
      const payload: CreateItemTemplateDTO & { icon: string; iconColor: string } = {
        ...form,
        effects: form.effects ?? [],
        damage: form.type === 'weapon' ? (form.damage || undefined) : undefined,
      };

      let savedItem: ItemTemplate;
      if (duplicate) {
        savedItem = await api.itemTemplates.update(duplicate.id, payload);
        dispatch({ type: 'SET_ITEM_TEMPLATES', payload: itemTemplates.map((t) => t.id === duplicate.id ? savedItem : t) });
      } else if (editing) {
        savedItem = await api.itemTemplates.update(editing.id, payload);
        dispatch({ type: 'SET_ITEM_TEMPLATES', payload: itemTemplates.map((t) => t.id === editing.id ? savedItem : t) });
      } else {
        savedItem = await api.itemTemplates.create(payload);
        dispatch({ type: 'SET_ITEM_TEMPLATES', payload: [...itemTemplates, savedItem] });
      }

      // Auto-sync new effects to the effect library
      {
        let updatedEffTmpls = [...effectTemplates];
        const effsToSync = (form.effects ?? []).filter((e) => e.name.trim() && !e.templateId);
        for (const eff of effsToSync) {
          const existing = updatedEffTmpls.find((t) => t.name.toLowerCase() === eff.name.toLowerCase());
          if (existing) {
            if (confirm(`Efeito "${eff.name}" já existe na biblioteca. Substituir?`)) {
              const updated = await api.effectTemplates.update(existing.id, {
                name: eff.name, icon: eff.icon ?? 'Sparkles', iconColor: eff.color ?? '#6366f1',
                description: eff.description, applications: eff.applications,
              });
              updatedEffTmpls = updatedEffTmpls.map((t) => t.id === existing.id ? updated : t);
            }
          } else {
            const created = await api.effectTemplates.create({
              name: eff.name, icon: eff.icon ?? 'Sparkles', iconColor: eff.color ?? '#6366f1',
              description: eff.description, applications: eff.applications,
            });
            updatedEffTmpls = [...updatedEffTmpls, created];
          }
        }
        if (updatedEffTmpls !== effectTemplates) {
          dispatch({ type: 'SET_EFFECT_TEMPLATES', payload: updatedEffTmpls });
        }
      }

      closeModal();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (item: ItemTemplate) => {
    if (!confirm(`Remover item "${item.name}"?`)) return;
    await api.itemTemplates.delete(item.id);
    dispatch({ type: 'SET_ITEM_TEMPLATES', payload: itemTemplates.filter((t) => t.id !== item.id) });
  };

  const types: Array<{ value: ItemType | 'all'; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'weapon', label: 'Armas' },
    { value: 'vest', label: 'Vestes' },
    { value: 'consumable', label: 'Consumíveis' },
    { value: 'special', label: 'Especiais' },
  ];

  const createButton = (
    <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>Novo Item</Button>
  );

  return (
    <div style={embedded ? s.pageEmbedded : s.page}>
      {embedded ? (
        <div style={s.embeddedActions}>
          <span style={s.embeddedCount}>
            {itemTemplates.length} item{itemTemplates.length !== 1 ? 'ns' : ''}
          </span>
          {createButton}
        </div>
      ) : (
        <PageHeader
          title="Biblioteca de Itens"
          subtitle={`${itemTemplates.length} item${itemTemplates.length !== 1 ? 'ns' : ''}`}
          actions={createButton}
        />
      )}

      <div style={s.toolbar}>
        <input placeholder="Buscar item..." value={search} onChange={(e) => setSearch(e.target.value)} style={s.search} />
        <div style={s.typeTabs}>
          {types.map(({ value, label }) => (
            <button
              key={value}
              style={{ ...s.typeTab, ...(typeFilter === value ? s.typeTabActive : {}) }}
              onClick={() => setTypeFilter(value)}
            >{label}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>
          <Backpack size={36} color="var(--text-muted)" />
          <p>{search || typeFilter !== 'all' ? 'Nenhum resultado.' : 'Nenhum item criado ainda.'}</p>
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map((item) => (
            <ItemCard
              key={item.id}
              item={item}
              onEdit={() => openEdit(item)}
              onDelete={() => handleDelete(item)}
              sheetTypes={sheetTypes}
            />
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar Item' : 'Novo Item'} width={640}>
        <div style={s.form}>
          {/* Nome + Tipo */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={s.label}>Nome</label>
              <input
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                style={s.input}
                placeholder="Nome do item"
              />
            </div>
            <div>
              <label style={s.label}>Tipo</label>
              <div style={s.typeSelector}>
                {(['weapon', 'vest', 'consumable', 'special'] as ItemType[]).map((t) => {
                  const TIcon = TYPE_ICONS[t];
                  const tc = ITEM_TYPE_COLORS[t];
                  const active = form.type === t;
                  return (
                    <button
                      key={t}
                      style={{ ...s.typeSelectorBtn, ...(active ? { background: `${tc}20`, color: tc, borderColor: tc } : {}) }}
                      onClick={() => setForm((f) => ({ ...f, type: t }))}
                    >
                      <TIcon size={14} /> {ITEM_TYPE_LABELS[t]}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label style={s.label}>Descrição</label>
            <textarea
              value={form.description ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              style={{ ...s.input, resize: 'vertical', minHeight: 64 }}
              rows={3}
              placeholder="Descrição do item"
            />
          </div>

          {/* Ícone e cor */}
          <div>
            <label style={s.label}>Ícone e Cor</label>
            <SkillIconPicker
              collapsible
              selectedIcon={form.icon ?? 'Star'}
              selectedColor={form.iconColor ?? '#6366f1'}
              onIconChange={(icon) => setForm((f) => ({ ...f, icon }))}
              onColorChange={(iconColor) => setForm((f) => ({ ...f, iconColor }))}
            />
          </div>

          {/* Dano (somente armas) */}
          {form.type === 'weapon' && (
            <div>
              <label style={s.label}>Dano</label>
              <DamageInput
                value={form.damage ?? ''}
                onChange={(v) => setForm((f) => ({ ...f, damage: v }))}
              />
            </div>
          )}

          {/* Efeitos (não disponíveis para especiais) */}
          <div>
            <div style={s.effSectionHeader}>
              <label style={s.label}>Efeitos</label>
              <button style={s.addSmallBtn} onClick={addEffect}><Plus size={12} /> Adicionar efeito</button>
            </div>
            {(form.effects ?? []).length === 0 && (
              <p style={s.hint}>Sem efeitos configurados.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {(form.effects ?? []).map((eff, i) => (
                <EffectEditor
                  key={i} effect={eff} index={i}
                  onChange={(e) => updateEffect(i, e)}
                  onRemove={() => removeEffect(i)}
                  effectTemplates={effectTemplates}
                  itemType={form.type ?? 'special'}
                  sheetTypes={sheetTypes}
                />
              ))}
            </div>
          </div>

          <div style={s.actions}>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editing ? 'Salvar alterações' : 'Criar item'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const s: Record<string, any> = {
  page: { padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px' },
  pageEmbedded: { padding: '18px 28px 28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '960px' },
  embeddedActions: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' },
  embeddedCount: { fontSize: '12.5px', color: 'var(--text-muted)', marginRight: 'auto' },
  toolbar: { display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' },
  search: { flex: 1, minWidth: '200px', padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px' },
  typeTabs: { display: 'flex', gap: '4px' },
  typeTab: { padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer' },
  typeTabActive: { background: 'var(--accent-dim)', color: 'var(--accent)', borderColor: 'var(--accent)' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 0', color: 'var(--text-muted)', textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  typeIconBox: { width: 36, height: 36, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardName: { fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: 3 },
  typeBadge: { fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '100px' },
  cardActions: { display: 'flex', gap: '4px', flexShrink: 0 },
  cardDesc: { fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: '1.5' },
  damageBadge: { fontSize: '12px', color: 'var(--text-secondary)' },
  damageCode: { background: 'var(--bg-elevated)', padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace', fontSize: '12px' },
  effectsList: { display: 'flex', flexWrap: 'wrap', gap: '5px' },
  effTag: { display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', padding: '3px 8px', borderRadius: '100px', border: '1px solid', background: 'var(--bg-elevated)', cursor: 'pointer', transition: 'all 0.15s' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' },
  hint: { fontSize: '11px', color: 'var(--text-muted)', margin: 0 },
  typeSelector: { display: 'flex', gap: '4px', flexWrap: 'wrap' },
  typeSelectorBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', cursor: 'pointer', whiteSpace: 'nowrap' },
  select: { padding: '6px 8px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px' },
  input: { width: '100%', padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' },
  effSectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  addSmallBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' },
  effectBlock: { background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden' },
  effectHeader: { display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', cursor: 'default' },
  effIconBox: { width: 26, height: 26, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  effName: { flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  effToggle: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', padding: '2px' },
  effBody: { padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--border)' },
  effPickerCard: { display: 'flex', alignItems: 'flex-start', gap: '8px', padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left', width: '100%' },
  appRow: { display: 'flex', alignItems: 'center', gap: '5px' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' },
  stageBtn: { padding: '5px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' },
};
