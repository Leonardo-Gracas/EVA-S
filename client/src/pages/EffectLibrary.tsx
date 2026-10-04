import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import { matchesSearch } from '../utils/normalizeSearch';
import { Plus, Edit2, Trash2, Sparkles, X } from 'lucide-react';
import NumericInput from '../components/common/NumericInput';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import {
  EffectTemplate, CreateEffectTemplateDTO, EffectApplication,
  EffectStat, EffectOperation, SheetType, allEffectStatsForCampaign, resourceMaxStat,
  getEffectStatLabelForCampaign, getEffectStatColorForCampaign,
} from '../types';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';
import { Input, Textarea } from '../components/common/Input';
import SkillIconPicker, { ICON_MAP } from '../components/characters/SkillIconPicker';

const defaultForm: CreateEffectTemplateDTO = {
  name: '', icon: 'Sparkles', iconColor: '#6366f1', description: '', applications: [],
};

function ApplicationRow({
  app, onChange, onRemove, sheetTypes,
}: {
  app: EffectApplication;
  onChange: (next: EffectApplication) => void;
  onRemove: () => void;
  sheetTypes: SheetType[];
}) {
  return (
    <div style={s.appRow}>
      <select
        value={app.stat}
        onChange={(e) => onChange({ ...app, stat: e.target.value as EffectStat })}
        style={s.appSelect}
      >
        {allEffectStatsForCampaign(sheetTypes).map(({ value, label }) => (
          <option key={value} value={value}>{label}</option>
        ))}
      </select>
      <select
        value={app.operation}
        onChange={(e) => onChange({ ...app, operation: e.target.value as EffectOperation })}
        style={{ ...s.appSelect, width: '90px' }}
      >
        <option value="add">+ Adicionar</option>
        <option value="subtract">- Subtrair</option>
      </select>
      <NumericInput
        value={app.value}
        onChange={(n) => onChange({ ...app, value: n })}
        min={0}
        width={84}
      />
      {app.stat === 'custom' && (
        <input
          placeholder="Nome personalizado"
          value={app.customName ?? ''}
          onChange={(e) => onChange({ ...app, customName: e.target.value })}
          style={{ ...s.appSelect, width: '140px' }}
        />
      )}
      <button style={s.appRemove} onClick={onRemove} title="Remover">
        <X size={12} />
      </button>
    </div>
  );
}

export default function EffectLibrary({ embedded = false }: { embedded?: boolean }) {
  useTitle('Efeitos');
  const { effectTemplates, dispatch, sheetTypes } = useApp();
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<EffectTemplate | null>(null);
  const [form, setForm] = useState<CreateEffectTemplateDTO>(defaultForm);
  const [saving, setSaving] = useState(false);

  const filtered = effectTemplates
    .filter((e) => matchesSearch(e.name, search) || matchesSearch(e.description, search))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }));

  const openCreate = () => {
    setEditing(null); setForm(defaultForm); setModalOpen(true);
  };
  const openEdit = (e: EffectTemplate) => {
    setEditing(e);
    setForm({ name: e.name, icon: e.icon, iconColor: e.iconColor, description: e.description, applications: [...e.applications] });
    setModalOpen(true);
  };
  const closeModal = () => { setModalOpen(false); setEditing(null); };

  const addApplication = () => {
    const firstResource = sheetTypes.flatMap((st) => st.config.resources)[0];
    setForm((f) => ({
      ...f,
      applications: [...(f.applications ?? []), { stat: firstResource ? resourceMaxStat(firstResource.key) : 'custom', operation: 'add', value: 1 }],
    }));
  };
  const updateApplication = (i: number, next: EffectApplication) => {
    setForm((f) => {
      const apps = [...(f.applications ?? [])];
      apps[i] = next;
      return { ...f, applications: apps };
    });
  };
  const removeApplication = (i: number) => {
    setForm((f) => ({ ...f, applications: (f.applications ?? []).filter((_, idx) => idx !== i) }));
  };

  const handleSave = async () => {
    if (!form.name?.trim()) return alert('Nome obrigatorio');
    setSaving(true);
    try {
      if (editing) {
        const updated = await api.effectTemplates.update(editing.id, form);
        dispatch({ type: 'SET_EFFECT_TEMPLATES', payload: effectTemplates.map((e) => e.id === editing.id ? updated : e) });
      } else {
        const created = await api.effectTemplates.create(form);
        dispatch({ type: 'SET_EFFECT_TEMPLATES', payload: [...effectTemplates, created] });
      }
      closeModal();
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (e: EffectTemplate) => {
    if (!confirm(`Remover efeito "${e.name}"?`)) return;
    await api.effectTemplates.delete(e.id);
    dispatch({ type: 'SET_EFFECT_TEMPLATES', payload: effectTemplates.filter((t) => t.id !== e.id) });
  };

  const createButton = (
    <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={openCreate}>Novo Efeito</Button>
  );

  return (
    <div style={embedded ? s.pageEmbedded : s.page}>
      {embedded ? (
        <div style={s.embeddedActions}>
          <span style={s.embeddedCount}>
            {effectTemplates.length} efeito{effectTemplates.length !== 1 ? 's' : ''}
          </span>
          {createButton}
        </div>
      ) : (
        <PageHeader
          title="Biblioteca de Efeitos"
          subtitle={`${effectTemplates.length} efeito${effectTemplates.length !== 1 ? 's' : ''}`}
          actions={createButton}
        />
      )}

      <div style={s.toolbar}>
        <input placeholder="Buscar efeito..." value={search} onChange={(e) => setSearch(e.target.value)} style={s.search} />
      </div>

      {filtered.length === 0 ? (
        <div style={s.empty}>
          <Sparkles size={36} color="var(--text-muted)" />
          <p>{search ? 'Nenhum resultado.' : 'Nenhum efeito criado ainda.'}</p>
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map((effect) => {
            const Icon = ICON_MAP[effect.icon] ?? ICON_MAP['Sparkles'];
            const color = effect.iconColor;
            return (
              <div key={effect.id} style={s.card}>
                <div style={s.cardHeader}>
                  <div style={{ ...s.iconBox, background: `${color}20` }}>
                    <Icon size={18} color={color} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={s.cardName}>{effect.name}</div>
                    {effect.description && (
                      <div style={{ ...s.cardDesc, whiteSpace: 'pre-wrap' }}>{effect.description}</div>
                    )}
                  </div>
                  <div style={s.cardActions}>
                    <button style={s.iconBtn} onClick={() => openEdit(effect)} title="Editar"><Edit2 size={13} /></button>
                    <button style={{ ...s.iconBtn, color: 'var(--error)' }} onClick={() => handleDelete(effect)} title="Remover"><Trash2 size={13} /></button>
                  </div>
                </div>
                {effect.applications.length > 0 && (
                  <div style={s.appList}>
                    {effect.applications.map((app, i) => {
                      const sign = app.operation === 'add' ? '+' : '-';
                      const statColor = getEffectStatColorForCampaign(app.stat, sheetTypes);
                      const label = app.stat === 'custom' ? (app.customName || 'Personalizado') : getEffectStatLabelForCampaign(app.stat, sheetTypes);
                      return (
                        <span key={i} style={{ ...s.appBadge, color: statColor, border: `1px solid ${statColor}40`, background: `${statColor}15` }}>
                          {sign}{app.value} {label}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={modalOpen} onClose={closeModal} title={editing ? 'Editar Efeito' : 'Novo Efeito'} width={560}>
        <div style={s.form}>
          <Input label="Nome" value={form.name ?? ''} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
          <Textarea label="Descricao" value={form.description ?? ''} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />

          <div>
            <label style={s.label}>Icone e Cor</label>
            <SkillIconPicker
              selectedIcon={form.icon ?? 'Sparkles'}
              selectedColor={form.iconColor ?? '#6366f1'}
              onIconChange={(icon) => setForm((f) => ({ ...f, icon }))}
              onColorChange={(iconColor) => setForm((f) => ({ ...f, iconColor }))}
            />
          </div>

          <div>
            <div style={s.appsHeader}>
              <label style={s.label}>Aplicacoes na ficha</label>
              <button style={s.addAppBtn} onClick={addApplication}><Plus size={12} /> Adicionar</button>
            </div>
            {(form.applications ?? []).length === 0 && (
              <p style={s.hint}>Efeito puramente descritivo - sem modificacoes numericas.</p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {(form.applications ?? []).map((app, i) => (
                <ApplicationRow
                  key={i} app={app}
                  onChange={(next) => updateApplication(i, next)}
                  onRemove={() => removeApplication(i)}
                  sheetTypes={sheetTypes}
                />
              ))}
            </div>
          </div>

          <div style={s.actions}>
            <Button variant="secondary" onClick={closeModal}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editing ? 'Salvar alteracoes' : 'Criar efeito'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const s: Record<string, any> = {
  page: { padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' },
  pageEmbedded: { padding: '18px 28px 28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' },
  embeddedActions: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' },
  embeddedCount: { fontSize: '12.5px', color: 'var(--text-muted)', marginRight: 'auto' },
  toolbar: { display: 'flex', gap: '10px' },
  search: {
    flex: 1, padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px',
  },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 0', color: 'var(--text-muted)', textAlign: 'center' },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '14px 16px',
    display: 'flex', flexDirection: 'column', gap: '10px',
  },
  cardHeader: { display: 'flex', alignItems: 'flex-start', gap: '10px' },
  iconBox: { width: 36, height: 36, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  cardName: { fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' },
  cardDesc: { fontSize: '12px', color: 'var(--text-muted)', marginTop: 2, lineHeight: '1.5' },
  cardActions: { display: 'flex', gap: '4px', flexShrink: 0 },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' },
  appList: { display: 'flex', flexWrap: 'wrap', gap: '6px' },
  appBadge: { fontSize: '11px', fontWeight: 600, padding: '2px 8px', borderRadius: '100px' },
  form: { display: 'flex', flexDirection: 'column', gap: '14px' },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' },
  hint: { fontSize: '12px', color: 'var(--text-muted)', margin: 0 },
  appsHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' },
  addAppBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)',
  },
  appRow: { display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' },
  appSelect: { flex: 1, padding: '5px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: '12px' },
  appRemove: { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px', display: 'flex', alignItems: 'center' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' },
};
