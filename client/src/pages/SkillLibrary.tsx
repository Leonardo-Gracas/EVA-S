import React, { useState, useEffect } from 'react';
import { useTitle } from '../hooks/useTitle';
import { Plus, Search, Edit2, Trash2, BookOpen, Zap, Shield } from 'lucide-react';
import { api } from '../services/api';
import { SkillTemplate, CreateSkillTemplateDTO, SkillType } from '../types';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';
import { ICON_MAP } from '../components/characters/SkillIconPicker';
import { ResourceEffectBadges } from '../components/skills/ResourceEffectBadges';
import { SkillFormFields } from '../components/skills/SkillFormFields';
import { ResEffectsForm, defaultResEffects, buildResourceEffect, applyResEffects } from '../utils/resourceEffects';
import { matchesSearch } from '../utils/normalizeSearch';
import { useApp } from '../contexts/AppContext';


const defaultForm: CreateSkillTemplateDTO = {
  title: '', description: '', icon: 'Star', iconColor: '#6366f1',
  skillType: 'passive', resourceEffect: [], tags: [],
  usesLimit: null, usesLimitType: null,
};

export default function SkillLibrary({ embedded = false }: { embedded?: boolean }) {
  useTitle('Habilidades');

  const [templates, setTemplates] = useState<SkillTemplate[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | SkillType>('all');
  const [tagFilter, setTagFilter] = useState<string[]>([]);

  const { getResourceDefs, sheetTypes, defaultSheetType } = useApp();
  // Templates de habilidade sao globais a campanha — este seletor so decide de qual tipo de
  // ficha puxar os recursos disponiveis no picker de custo/ganho, quando ha mais de um tipo.
  const [pickerSheetTypeId, setPickerSheetTypeId] = useState(defaultSheetType.id);
  const resourceKeys = getResourceDefs(pickerSheetTypeId).map((r) => r.key);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SkillTemplate | null>(null);
  const [form, setForm] = useState<CreateSkillTemplateDTO>(defaultForm);
  const [resEffects, setResEffects] = useState<ResEffectsForm>(() => defaultResEffects(resourceKeys));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.skillTemplates.list().then((data) => { setTemplates(data); setLoading(false); });
  }, []);


  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setResEffects(defaultResEffects(resourceKeys));
    setModalOpen(true);
  };

  const openEdit = (tpl: SkillTemplate) => {
    setEditing(tpl);
    setForm({
      title: tpl.title, description: tpl.description,
      icon: tpl.icon, iconColor: tpl.iconColor,
      skillType: tpl.skillType,
      resourceEffect: tpl.resourceEffect,
      tags: [...tpl.tags],
      usesLimit: tpl.usesLimit ?? null,
      usesLimitType: tpl.usesLimitType ?? null,
    });
    setResEffects(applyResEffects(tpl.resourceEffect ?? [], resourceKeys));
    setModalOpen(true);
  };

  const parseDuplicate = (err: any): { id: string; title: string } | null => {
    try { const p = JSON.parse(err.message); if (p.code === 'DUPLICATE') return p; } catch {}
    return null;
  };

  const handleSave = async () => {
    if (!form.title?.trim()) return alert('Título obrigatório');
    setSaving(true);
    try {
      const dto: CreateSkillTemplateDTO = {
        ...form,
        resourceEffect: form.skillType === 'active' ? buildResourceEffect(resEffects) : [],
      };
      let saved: SkillTemplate;
      if (editing) {
        saved = await api.skillTemplates.update(editing.id, dto);
        setTemplates((prev) => prev.map((t) => t.id === saved.id ? saved : t));
      } else {
        try {
          saved = await api.skillTemplates.create(dto);
        } catch (err: any) {
          const dup = parseDuplicate(err);
          if (dup) {
            const replace = confirm(`Já existe uma habilidade chamada "${dup.title}" na biblioteca.\nDeseja substituí-la?`);
            if (!replace) { setSaving(false); return; }
            saved = await api.skillTemplates.update(dup.id, dto);
            setTemplates((prev) => prev.map((t) => t.id === saved.id ? saved : t));
            setModalOpen(false);
            setSaving(false);
            return;
          }
          throw err;
        }
        setTemplates((prev) => [...prev, saved].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' })));
      }
      setModalOpen(false);
    } catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (tpl: SkillTemplate) => {
    if (!confirm(`Remover template "${tpl.title}"?`)) return;
    await api.skillTemplates.delete(tpl.id);
    setTemplates((prev) => prev.filter((t) => t.id !== tpl.id));
  };

  const filtered = templates
    .filter((tpl) => {
      if (!matchesSearch(tpl.title, search)) return false;
      if (typeFilter !== 'all' && tpl.skillType !== typeFilter) return false;
      if (tagFilter.length > 0 && !tagFilter.some((tag) => tpl.tags.includes(tag))) return false;
      return true;
    })
    .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }));

  const toggleTagFilter = (tag: string) => {
    setTagFilter((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);
  };

  const usedTags = Array.from(new Set(templates.flatMap((t) => t.tags))).sort();

  const createButton = (
    <Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>
      Nova habilidade
    </Button>
  );

  return (
    <div style={embedded ? s.pageEmbedded : s.page}>
      {embedded ? (
        <div style={s.embeddedActions}>
          <span style={s.embeddedCount}>
            {templates.length} habilidade{templates.length !== 1 ? 's' : ''} salva{templates.length !== 1 ? 's' : ''}
          </span>
          {createButton}
        </div>
      ) : (
        <PageHeader
          title="Habilidades"
          subtitle={`${templates.length} habilidade${templates.length !== 1 ? 's' : ''} salva${templates.length !== 1 ? 's' : ''}`}
          actions={createButton}
        />
      )}

      {/* Search + type filter */}
      <div style={s.filterRow}>
        <div style={s.searchWrap}>
          <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }} />
          <input
            style={s.searchInput}
            placeholder="Buscar por título..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div style={s.typeToggle}>
          {(['all', 'passive', 'active'] as const).map((v) => (
            <button
              key={v}
              style={{ ...s.typeBtn, ...(typeFilter === v ? s.typeBtnActive : {}) }}
              onClick={() => setTypeFilter(v)}
            >
              {v === 'all' ? 'Todas' : v === 'passive' ? 'Passivas' : 'Ativas'}
            </button>
          ))}
        </div>
        {sheetTypes.length > 1 && (
          <select value={pickerSheetTypeId} onChange={(e) => setPickerSheetTypeId(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px' }} title="Recursos de qual tipo de ficha mostrar">
            {sheetTypes.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
        )}
      </div>

      {/* Tag filter chips */}
      {usedTags.length > 0 && (
        <div style={s.tagRow}>
          {usedTags.map((tag) => (
            <button
              key={tag}
              style={{
                ...s.tagChip,
                ...(tagFilter.includes(tag) ? s.tagChipActive : {}),
              }}
              onClick={() => toggleTagFilter(tag)}
            >
              {tag}
            </button>
          ))}
          {tagFilter.length > 0 && (
            <button style={s.clearTags} onClick={() => setTagFilter([])}>
              Limpar filtros
            </button>
          )}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={s.empty}><BookOpen size={32} color="var(--text-muted)" /><p>Carregando...</p></div>
      ) : filtered.length === 0 ? (
        <div style={s.empty}>
          <BookOpen size={32} color="var(--text-muted)" />
          <p>{templates.length === 0 ? 'Nenhuma habilidade salva ainda.' : 'Nenhuma habilidade encontrada.'}</p>
          {templates.length === 0 && (
            <Button variant="secondary" icon={<Plus size={13} />} onClick={openCreate}>
              Criar primeira habilidade
            </Button>
          )}
        </div>
      ) : (
        <div style={s.grid}>
          {filtered.map((tpl) => {
            const Icon = ICON_MAP[tpl.icon] ?? ICON_MAP['Star'];
            return (
              <div key={tpl.id} style={s.card}>
                <div style={s.cardMain}>
                  <div style={{ ...s.iconBox, background: `${tpl.iconColor}20` }}>
                    <Icon size={22} color={tpl.iconColor} />
                  </div>
                  <div style={s.cardBody}>
                    <div style={s.cardTop}>
                      <span style={s.cardTitle}>{tpl.title}</span>
                      <span style={{
                        ...s.typeBadge,
                        background: tpl.skillType === 'active' ? 'rgba(99,102,241,0.15)' : 'var(--bg-elevated)',
                        color: tpl.skillType === 'active' ? 'var(--accent)' : 'var(--text-muted)',
                      }}>
                        {tpl.skillType === 'active' ? <Zap size={10} /> : <Shield size={10} />}
                        {tpl.skillType === 'active' ? 'Ativa' : 'Passiva'}
                      </span>
                      <ResourceEffectBadges effects={tpl.resourceEffect ?? []} />
                    </div>
                    {tpl.tags.length > 0 && (
                      <div style={s.cardTags}>
                        {tpl.tags.map((tag) => (
                          <span key={tag} style={s.cardTag}>{tag}</span>
                        ))}
                      </div>
                    )}
                    {tpl.usesLimit !== null && (
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'block' }}>
                        {tpl.usesLimit} uso{tpl.usesLimit !== 1 ? 's' : ''}{tpl.usesLimitType === 'combat' ? ' por combate' : tpl.usesLimitType === 'rest' ? ' por descanso' : ''}
                      </span>
                    )}
                    {tpl.description && (
                      <p style={s.cardDesc}>{tpl.description}</p>
                    )}
                  </div>
                </div>
                <div style={s.cardActions}>
                  <button style={s.actionBtn} onClick={() => openEdit(tpl)}>
                    <Edit2 size={13} color="var(--text-secondary)" />
                  </button>
                  <button style={s.actionBtn} onClick={() => handleDelete(tpl)}>
                    <Trash2 size={13} color="var(--error)" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create / Edit modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Editar Habilidade' : 'Nova Habilidade'} width={560}>
        <div style={s.form}>
          <SkillFormFields
            form={form}
            onChange={(patch) => setForm(f => ({ ...f, ...patch }))}
            resEffects={resEffects}
            onResEffectsChange={setResEffects}
            sheetTypeId={pickerSheetTypeId}
            showVisibility={false}
          />

          <div style={s.formActions}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editing ? 'Salvar alterações' : 'Criar habilidade'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const s: Record<string, any> = {
  page: { padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1100px' },
  pageEmbedded: { padding: '18px 28px 28px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '1100px' },
  embeddedActions: { display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' },
  embeddedCount: { fontSize: '12.5px', color: 'var(--text-muted)', marginRight: 'auto' },
  filterRow: { display: 'flex', gap: '10px', alignItems: 'center' },
  searchWrap: { flex: 1, position: 'relative' },
  searchInput: {
    width: '100%', padding: '8px 12px 8px 32px',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px',
    boxSizing: 'border-box',
  },
  typeToggle: {
    display: 'flex', background: 'var(--bg-surface)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden',
  },
  typeBtn: {
    padding: '7px 14px', background: 'none', border: 'none',
    color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer',
    transition: 'all var(--transition)',
  },
  typeBtnActive: { background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 600 },
  tagRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'center' },
  tagChip: {
    padding: '4px 10px', borderRadius: '100px', fontSize: '11px', fontWeight: 500,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', cursor: 'pointer', transition: 'all var(--transition)',
  },
  tagChipActive: {
    background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)',
  },
  clearTags: {
    padding: '4px 10px', borderRadius: '100px', fontSize: '11px',
    background: 'none', border: '1px solid var(--border)', color: 'var(--text-muted)',
    cursor: 'pointer',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '12px', padding: '60px 0', color: 'var(--text-muted)', textAlign: 'center',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '12px' },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '14px 16px',
    display: 'flex', alignItems: 'flex-start', gap: '12px',
    transition: 'border-color var(--transition)',
  },
  cardMain: { display: 'flex', gap: '12px', flex: 1, minWidth: 0 },
  iconBox: {
    width: '44px', height: '44px', borderRadius: 'var(--radius)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  cardBody: { flex: 1, display: 'flex', flexDirection: 'column', gap: '6px', minWidth: 0 },
  cardTop: { display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' },
  cardTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', flex: '0 0 auto', maxWidth: '100%' },
  typeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    padding: '2px 7px', borderRadius: '100px', fontSize: '10px', fontWeight: 600,
  },
  cardTags: { display: 'flex', flexWrap: 'wrap', gap: '4px' },
  cardTag: {
    padding: '2px 7px', borderRadius: '100px', fontSize: '10px', fontWeight: 500,
    background: 'var(--bg-elevated)', color: 'var(--text-muted)',
    border: '1px solid var(--border)',
  },
  cardDesc: {
    fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5,
    overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical', whiteSpace: 'pre-wrap',
  },
  cardActions: { display: 'flex', flexDirection: 'column', gap: '4px', flexShrink: 0 },
  actionBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', padding: '4px', borderRadius: 'var(--radius-sm)',
  },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' },
};
