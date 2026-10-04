import React, { useState, useMemo } from 'react';
import { useTitle } from '../hooks/useTitle';
import { Plus, Trash2, Edit2, Search, BookOpen, Wand2, ChevronRight } from 'lucide-react';
import { api } from '../services/api';
import { Grimorio, GrimorioSpell } from '../types';
import { useApp } from '../contexts/AppContext';
import Modal from '../components/common/Modal';
import Button from '../components/common/Button';
import PageHeader from '../components/common/PageHeader';
import { ICON_MAP } from '../components/characters/SkillIconPicker';
import { SkillFormFields } from '../components/skills/SkillFormFields';
import { ResourceEffectBadges } from '../components/skills/ResourceEffectBadges';
import { ResEffectsForm, defaultResEffects, buildResourceEffect, applyResEffects } from '../utils/resourceEffects';
import { matchesSearch } from '../utils/normalizeSearch';
import SkillIconPicker from '../components/characters/SkillIconPicker';

// ── default form helpers ────────────────────────────────────────────────────

const defaultGrimForm = () => ({
  name: '',
  description: '',
  icon: 'BookOpen',
  iconColor: '#6366f1',
  effectName: '',
});

const defaultSpellForm = () => ({
  title: '',
  description: '',
  icon: 'Star',
  iconColor: '#6366f1',
  skillType: 'active' as const,
  tags: [] as string[],
  usesLimit: null as number | null,
  usesLimitType: null as 'combat' | 'rest' | null,
});

// ── GrimorioFormModal ────────────────────────────────────────────────────────

interface GrimorioFormProps {
  editing: Grimorio | null;
  onClose: () => void;
  onSaved: (g: Grimorio) => void;
}

function GrimorioFormModal({ editing, onClose, onSaved }: GrimorioFormProps) {
  const [form, setForm] = useState(() =>
    editing
      ? {
          name: editing.name,
          description: editing.description,
          icon: editing.icon,
          iconColor: editing.iconColor,
          effectName: editing.catalizadorEffectName ?? '',
        }
      : defaultGrimForm(),
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const dto = { ...form, effectName: form.effectName.trim() || undefined };
      const result = editing
        ? await api.grimorios.update(editing.id, dto)
        : await api.grimorios.create(dto);
      onSaved(result);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? 'Editar Grimório' : 'Novo Grimório'} onClose={onClose}>
      <div style={s.formStack}>
        <div>
          <label style={s.label}>Nome do Grimório *</label>
          <input
            style={s.input}
            placeholder="Ex: Grimório Arcano"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            autoFocus
          />
        </div>
        <div>
          <label style={s.label}>Nome do efeito</label>
          <input
            style={s.input}
            placeholder={`Ex: Catalizador ${form.name || '...'}`}
            value={form.effectName}
            onChange={(e) => setForm((f) => ({ ...f, effectName: e.target.value }))}
          />
          <p style={s.hint}>
            Efeito concedido ao personagem para liberar acesso a este grimório. Deixe em branco para usar "Catalizador {form.name || '...'}".
          </p>
        </div>
        <div>
          <label style={s.label}>Descrição</label>
          <textarea
            style={{ ...s.input, height: 72, resize: 'vertical' }}
            placeholder="Descreva este grimório..."
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <SkillIconPicker
          selectedIcon={form.icon}
          selectedColor={form.iconColor}
          onIconChange={(icon) => setForm((f) => ({ ...f, icon }))}
          onColorChange={(iconColor) => setForm((f) => ({ ...f, iconColor }))}
          collapsible
        />
        <div style={s.formActions}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} disabled={!form.name.trim()}>
            {editing ? 'Salvar' : 'Criar Grimório'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── SpellFormModal ────────────────────────────────────────────────────────────

interface SpellFormProps {
  grimorioId: string;
  editing: GrimorioSpell | null;
  onClose: () => void;
  onSaved: (g: Grimorio) => void;
}

function SpellFormModal({ grimorioId, editing, onClose, onSaved }: SpellFormProps) {
  const { getResourceDefs, sheetTypes, defaultSheetType } = useApp();
  // Feiticos sao globais ao grimorio (nao pertencem a um personagem) — este seletor so decide
  // de qual tipo de ficha puxar os recursos de custo/ganho, quando ha mais de um tipo.
  const [pickerSheetTypeId, setPickerSheetTypeId] = useState(defaultSheetType.id);
  const resourceKeys = useMemo(() => getResourceDefs(pickerSheetTypeId).map((r) => r.key), [getResourceDefs, pickerSheetTypeId]);
  const [form, setForm] = useState(() =>
    editing
      ? {
          title: editing.title,
          description: editing.description,
          icon: editing.icon,
          iconColor: editing.iconColor,
          skillType: editing.skillType,
          tags: [...editing.tags],
          usesLimit: editing.usesLimit,
          usesLimitType: editing.usesLimitType,
        }
      : defaultSpellForm(),
  );
  const [resEffects, setResEffects] = useState<ResEffectsForm>(() =>
    editing ? applyResEffects(editing.resourceEffect, resourceKeys) : defaultResEffects(resourceKeys),
  );
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!form.title.trim()) return;
    const dto = { ...form, resourceEffect: buildResourceEffect(resEffects) };
    setSaving(true);
    try {
      const result = editing
        ? await api.grimorios.updateSpell(editing.id, dto)
        : await api.grimorios.createSpell(grimorioId, dto);
      onSaved(result);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open title={editing ? 'Editar Feitiço' : 'Novo Feitiço'} onClose={onClose}>
      <div style={s.formStack}>
        {sheetTypes.length > 1 && (
          <select value={pickerSheetTypeId} onChange={(e) => setPickerSheetTypeId(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: '13px', alignSelf: 'flex-start' }} title="Recursos de qual tipo de ficha mostrar">
            {sheetTypes.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
          </select>
        )}
        <SkillFormFields
          form={form}
          resEffects={resEffects}
          onChange={(patch) => setForm((f) => ({ ...f, ...patch }))}
          onResEffectsChange={setResEffects}
          sheetTypeId={pickerSheetTypeId}
        />
        <div style={s.formActions}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave} loading={saving} disabled={!form.title.trim()}>
            {editing ? 'Salvar' : 'Criar Feitiço'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ── SpellCard ─────────────────────────────────────────────────────────────────

interface SpellCardProps {
  spell: GrimorioSpell;
  onEdit: () => void;
  onDelete: () => void;
}

function SpellCard({ spell, onEdit, onDelete }: SpellCardProps) {
  const Icon = ICON_MAP[spell.icon] ?? Wand2;
  return (
    <div style={s.spellCard}>
      <div style={{ ...s.spellIconBox, background: `${spell.iconColor}20` }}>
        <Icon size={18} color={spell.iconColor} />
      </div>
      <div style={s.spellInfo}>
        <p style={s.spellTitle}>{spell.title}</p>
        {spell.description && <p style={s.spellDesc}>{spell.description}</p>}
        <div style={s.spellMeta}>
          <span style={{ ...s.typeBadge, background: spell.skillType === 'active' ? '#6366f120' : '#8b5cf620', color: spell.skillType === 'active' ? '#6366f1' : '#8b5cf6' }}>
            {spell.skillType === 'active' ? 'Ativo' : 'Passivo'}
          </span>
          {spell.usesLimit !== null && (
            <span style={s.usesBadge}>{spell.usesLimit}× / {spell.usesLimitType === 'combat' ? 'combate' : 'descanso'}</span>
          )}
          {spell.resourceEffect.length > 0 && (
            <ResourceEffectBadges effects={spell.resourceEffect} />
          )}
        </div>
      </div>
      <div style={s.spellActions}>
        <button style={s.iconBtn} onClick={onEdit} title="Editar"><Edit2 size={14} /></button>
        <button style={{ ...s.iconBtn, color: '#ef4444' }} onClick={onDelete} title="Excluir"><Trash2 size={14} /></button>
      </div>
    </div>
  );
}

// ── GrimorioDetail ────────────────────────────────────────────────────────────

interface GrimorioDetailProps {
  grimorio: Grimorio;
  onUpdate: (g: Grimorio) => void;
  onEdit: () => void;
  onDelete: () => void;
}

function GrimorioDetail({ grimorio, onUpdate, onEdit, onDelete }: GrimorioDetailProps) {
  const [spellSearch, setSpellSearch] = useState('');
  const [spellModal, setSpellModal] = useState(false);
  const [editingSpell, setEditingSpell] = useState<GrimorioSpell | null>(null);

  const GrimIcon = ICON_MAP[grimorio.icon] ?? BookOpen;

  const filteredSpells = useMemo(
    () => grimorio.spells.filter((sp) => matchesSearch(sp.title, spellSearch) || matchesSearch(sp.description, spellSearch)),
    [grimorio.spells, spellSearch],
  );

  const handleDeleteSpell = async (spellId: string) => {
    if (!confirm('Excluir este feitiço?')) return;
    const updated = await api.grimorios.deleteSpell(spellId);
    onUpdate(updated);
  };

  return (
    <div style={s.detailPanel}>
      {/* Header */}
      <div style={s.detailHeader}>
        <div style={{ ...s.detailIconBox, background: `${grimorio.iconColor}20` }}>
          <GrimIcon size={24} color={grimorio.iconColor} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={s.detailTitle}>{grimorio.name}</h2>
          {grimorio.description && <p style={s.detailDesc}>{grimorio.description}</p>}
          {grimorio.catalizadorEffectId && (
            <p style={s.catalizadorNote}>
              Efeito: <strong>{grimorio.catalizadorEffectName ?? `Catalizador ${grimorio.name}`}</strong>
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <button style={s.iconBtn} onClick={onEdit} title="Editar grimório"><Edit2 size={15} /></button>
          <button style={{ ...s.iconBtn, color: '#ef4444' }} onClick={onDelete} title="Excluir grimório"><Trash2 size={15} /></button>
        </div>
      </div>

      {/* Spell toolbar */}
      <div style={s.spellToolbar}>
        <div style={s.searchBox}>
          <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <input
            style={s.searchInput}
            placeholder="Buscar feitiços..."
            value={spellSearch}
            onChange={(e) => setSpellSearch(e.target.value)}
          />
        </div>
        <Button size="sm" onClick={() => { setEditingSpell(null); setSpellModal(true); }}>
          <Plus size={14} /> Feitiço
        </Button>
      </div>

      {/* Spell list */}
      <div style={s.spellList}>
        {filteredSpells.length === 0 ? (
          <div style={s.empty}>
            <Wand2 size={28} color="var(--text-muted)" />
            <p style={s.emptyText}>{spellSearch ? 'Nenhum feitiço encontrado' : 'Nenhum feitiço cadastrado'}</p>
            {!spellSearch && (
              <button style={s.emptyBtn} onClick={() => { setEditingSpell(null); setSpellModal(true); }}>
                Adicionar primeiro feitiço
              </button>
            )}
          </div>
        ) : (
          filteredSpells.map((sp) => (
            <SpellCard
              key={sp.id}
              spell={sp}
              onEdit={() => { setEditingSpell(sp); setSpellModal(true); }}
              onDelete={() => handleDeleteSpell(sp.id)}
            />
          ))
        )}
      </div>

      {spellModal && (
        <SpellFormModal
          grimorioId={grimorio.id}
          editing={editingSpell}
          onClose={() => setSpellModal(false)}
          onSaved={(updated) => { onUpdate(updated); setSpellModal(false); }}
        />
      )}
    </div>
  );
}

// ── GrimorioLibrary (main) ───────────────────────────────────────────────────

export default function GrimorioLibrary({ embedded = false }: { embedded?: boolean }) {
  useTitle('Grimório');
  const { grimorios, dispatch } = useApp();

  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string | null>(null);
  const [grimModal, setGrimModal] = useState(false);
  const [editingGrim, setEditingGrim] = useState<Grimorio | null>(null);

  const filtered = useMemo(
    () => grimorios
      .filter((g) => matchesSearch(g.name, search) || matchesSearch(g.description, search))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })),
    [grimorios, search],
  );

  const selectedGrimorio = grimorios.find((g) => g.id === selected) ?? null;

  const updateGrimorio = (updated: Grimorio) => {
    dispatch({ type: 'SET_GRIMORIOS', payload: grimorios.map((g) => g.id === updated.id ? updated : g) });
    setSelected(updated.id);
  };

  const handleGrimorioSaved = (g: Grimorio) => {
    const exists = grimorios.some((x) => x.id === g.id);
    dispatch({
      type: 'SET_GRIMORIOS',
      payload: exists ? grimorios.map((x) => x.id === g.id ? g : x) : [...grimorios, g],
    });
    setSelected(g.id);
    setGrimModal(false);
  };

  const handleDeleteGrimorio = async (id: string) => {
    if (!confirm('Excluir este grimório e todos os seus feitiços? O efeito Catalizador também será removido.')) return;
    await api.grimorios.delete(id);
    dispatch({ type: 'SET_GRIMORIOS', payload: grimorios.filter((g) => g.id !== id) });
    if (selected === id) setSelected(null);
  };

  const createButton = (
    <Button onClick={() => { setEditingGrim(null); setGrimModal(true); }}>
      <Plus size={16} /> Novo Grimório
    </Button>
  );

  return (
    <div style={embedded ? s.pageEmbedded : s.page}>
      {embedded ? (
        <div style={s.embeddedActions}>
          <span style={s.embeddedCount}>
            {grimorios.length} grimório{grimorios.length !== 1 ? 's' : ''} cadastrado{grimorios.length !== 1 ? 's' : ''}
          </span>
          {createButton}
        </div>
      ) : (
        <PageHeader
          title="Grimório"
          subtitle={`${grimorios.length} grimório${grimorios.length !== 1 ? 's' : ''} cadastrado${grimorios.length !== 1 ? 's' : ''}`}
          actions={createButton}
        />
      )}

      <div style={s.layout}>
        {/* Sidebar: grimório list */}
        <aside style={s.sidebar}>
          <div style={s.sidebarSearch}>
            <Search size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
            <input
              style={s.searchInput}
              placeholder="Buscar grimórios..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {filtered.length === 0 ? (
            <div style={s.sidebarEmpty}>
              <BookOpen size={24} color="var(--text-muted)" />
              <p style={s.emptyText}>{search ? 'Nenhum resultado' : 'Nenhum grimório'}</p>
            </div>
          ) : (
            <div style={s.grimList}>
              {filtered.map((g) => {
                const GrimIcon = ICON_MAP[g.icon] ?? BookOpen;
                const isActive = selected === g.id;
                return (
                  <button
                    key={g.id}
                    style={{ ...s.grimItem, background: isActive ? 'var(--bg-elevated)' : 'transparent', borderColor: isActive ? g.iconColor : 'transparent' }}
                    onClick={() => setSelected(g.id)}
                  >
                    <div style={{ ...s.grimIconSmall, background: `${g.iconColor}20` }}>
                      <GrimIcon size={16} color={g.iconColor} />
                    </div>
                    <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                      <p style={{ ...s.grimName, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>{g.name}</p>
                      <p style={s.grimCount}>{g.spells.length} feitiço{g.spells.length !== 1 ? 's' : ''}</p>
                    </div>
                    <ChevronRight size={14} color={isActive ? g.iconColor : 'var(--text-muted)'} />
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Main panel */}
        <main style={s.main}>
          {selectedGrimorio ? (
            <GrimorioDetail
              key={selectedGrimorio.id}
              grimorio={selectedGrimorio}
              onUpdate={updateGrimorio}
              onEdit={() => { setEditingGrim(selectedGrimorio); setGrimModal(true); }}
              onDelete={() => handleDeleteGrimorio(selectedGrimorio.id)}
            />
          ) : (
            <div style={s.noSelection}>
              <BookOpen size={40} color="var(--text-muted)" />
              <p style={s.noSelectionText}>Selecione um grimório para ver seus feitiços</p>
              <button style={s.emptyBtn} onClick={() => { setEditingGrim(null); setGrimModal(true); }}>
                Criar grimório
              </button>
            </div>
          )}
        </main>
      </div>

      {grimModal && (
        <GrimorioFormModal
          editing={editingGrim}
          onClose={() => setGrimModal(false)}
          onSaved={handleGrimorioSaved}
        />
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, any> = {
  page: { display: 'flex', flexDirection: 'column', gap: 0, height: '100%' },
  pageEmbedded: { display: 'flex', flexDirection: 'column', gap: 0, height: '100%', padding: '18px 28px 28px' },
  embeddedActions: { display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end' },
  embeddedCount: { fontSize: 12.5, color: 'var(--text-muted)', marginRight: 'auto' },
  layout: {
    display: 'flex', gap: 0, flex: 1, minHeight: 0,
    marginTop: 24,
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden',
    background: 'var(--bg-card)',
  },

  // Sidebar
  sidebar: {
    width: 260, flexShrink: 0,
    borderRight: '1px solid var(--border)',
    display: 'flex', flexDirection: 'column',
    background: 'var(--bg-base)',
  },
  sidebarSearch: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)',
  },
  grimList: { display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1 },
  grimItem: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '10px 12px', cursor: 'pointer',
    border: 'none', borderLeft: '3px solid transparent',
    transition: 'all 150ms', width: '100%',
  },
  grimIconSmall: {
    width: 32, height: 32, borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  grimName: { fontSize: 13, fontWeight: 600, marginBottom: 1 },
  grimCount: { fontSize: 11, color: 'var(--text-muted)' },
  sidebarEmpty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24 },

  // Detail panel
  main: { flex: 1, display: 'flex', overflow: 'auto' },
  detailPanel: { flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' },
  detailHeader: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: '20px 24px 16px',
    borderBottom: '1px solid var(--border)',
  },
  detailIconBox: {
    width: 48, height: 48, borderRadius: 'var(--radius)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  detailTitle: { fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 },
  detailDesc: { fontSize: 13, color: 'var(--text-secondary)' },
  catalizadorNote: { fontSize: 11, color: 'var(--text-muted)', marginTop: 4 },

  spellToolbar: {
    display: 'flex', alignItems: 'center', gap: 10,
    padding: '12px 24px',
    borderBottom: '1px solid var(--border)',
  },
  spellList: { flex: 1, overflowY: 'auto', padding: '12px 24px', display: 'flex', flexDirection: 'column', gap: 8 },

  // Spell card
  spellCard: {
    display: 'flex', alignItems: 'flex-start', gap: 12,
    padding: 12, borderRadius: 'var(--radius)',
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    transition: 'border-color 150ms',
  },
  spellIconBox: {
    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  spellInfo: { flex: 1, minWidth: 0 },
  spellTitle: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2 },
  spellDesc: { fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 },
  spellMeta: { display: 'flex', flexWrap: 'wrap', gap: 4, alignItems: 'center' },
  spellActions: { display: 'flex', gap: 4, flexShrink: 0 },

  typeBadge: {
    fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 100,
  },
  usesBadge: {
    fontSize: 11, color: 'var(--text-muted)',
    padding: '2px 7px', borderRadius: 100,
    background: 'var(--bg-base)', border: '1px solid var(--border)',
  },

  // Empty states
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 32 },
  noSelection: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 },
  noSelectionText: { fontSize: 14, color: 'var(--text-muted)' },
  emptyText: { fontSize: 13, color: 'var(--text-muted)' },
  emptyBtn: {
    fontSize: 13, fontWeight: 600, color: 'var(--accent)',
    background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline',
  },

  // Search shared
  searchBox: { display: 'flex', alignItems: 'center', gap: 8, flex: 1, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', fontSize: 13, color: 'var(--text-primary)' },

  // Icon button
  iconBtn: {
    width: 28, height: 28, borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    background: 'none', border: 'none', cursor: 'pointer',
    color: 'var(--text-muted)', transition: 'all 150ms',
  },

  // Form
  formStack: { display: 'flex', flexDirection: 'column', gap: 16 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 },
  input: {
    width: '100%', padding: '8px 10px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13,
  },
  hint: { fontSize: 11, color: 'var(--text-muted)', marginTop: 4 },
  formActions: { display: 'flex', gap: 8, justifyContent: 'flex-end', paddingTop: 4 },
};
