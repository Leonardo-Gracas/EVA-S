import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { Sliders, Shield, Users, Plus, Star, Copy, Trash2, Check, GripVertical, Download, QrCode, Settings as SettingsIcon } from 'lucide-react';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, horizontalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import { SheetType } from '../types';
import Button from '../components/common/Button';
import { ICON_MAP } from '../components/characters/SkillIconPicker';
import SheetTypeEditor from '../components/settings/SheetTypeEditor';
import PermissionsPanel from '../components/settings/PermissionsPanel';
import PlayersPanel from '../components/settings/PlayersPanel';
import CampaignImportPanel from '../components/campaigns/CampaignImportPanel';
import PlayerAccessPanel from '../components/settings/PlayerAccessPanel';

type Tab = 'fichas' | 'permissoes' | 'jogadores' | 'acesso' | 'importar';

// ── Sheet type chip (draggable) ────────────────────────────────────────────────

function SheetTypeChip({
  st, active, onSelect, onSetDefault, onDuplicate, onDelete, canDelete,
}: {
  st: SheetType;
  active: boolean;
  onSelect: () => void;
  onSetDefault: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: st.id });
  const style: React.CSSProperties = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const Icon = ICON_MAP[st.icon] ?? ICON_MAP['Scroll'];

  return (
    <div
      ref={setNodeRef}
      style={{
        ...style, ...cs.chip,
        ...(active ? { background: `${st.color}18`, borderColor: st.color } : {}),
      }}
    >
      <span {...attributes} {...listeners} style={cs.grip}><GripVertical size={12} color="var(--text-muted)" /></span>
      <button style={cs.chipMain} onClick={onSelect}>
        <Icon size={14} color={active ? st.color : 'var(--text-secondary)'} />
        <span style={{ color: active ? st.color : 'var(--text-primary)', fontWeight: active ? 700 : 500 }}>{st.name}</span>
      </button>
      <button style={cs.chipAction} onClick={onSetDefault} title={st.isDefault ? 'Tipo padrão' : 'Definir como padrão'}>
        <Star size={12} color={st.isDefault ? '#f59e0b' : 'var(--text-muted)'} fill={st.isDefault ? '#f59e0b' : 'none'} />
      </button>
      <button style={cs.chipAction} onClick={onDuplicate} title="Duplicar"><Copy size={12} color="var(--text-muted)" /></button>
      {canDelete && (
        <button style={cs.chipAction} onClick={onDelete} title="Remover"><Trash2 size={12} color="var(--text-muted)" /></button>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function Settings() {
  useTitle('Configurações');
  const navigate = useNavigate();
  const location = useLocation();
  const onboarding = Boolean((location.state as any)?.onboarding);
  const initialTab = ((location.state as any)?.tab as Tab) ?? 'fichas';
  const [tab, setTab] = useState<Tab>(initialTab);
  const { sheetTypes, dispatch } = useApp();
  const [selectedTypeId, setSelectedTypeId] = useState<string | null>(null);

  const selectedType = sheetTypes.find((t) => t.id === selectedTypeId) ?? sheetTypes[0];

  const sensors = useSensors(useSensor(PointerSensor), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  const handleCreate = async () => {
    const name = prompt('Nome do novo tipo de ficha:');
    if (!name || !name.trim()) return;
    try {
      const created = await api.sheetTypes.create({ name: name.trim() });
      dispatch({ type: 'SET_SHEET_TYPES', payload: [...sheetTypes, created] });
      setSelectedTypeId(created.id);
    } catch (err: any) { alert(err.message); }
  };

  const handleDuplicate = async (id: string) => {
    try {
      const created = await api.sheetTypes.duplicate(id);
      dispatch({ type: 'SET_SHEET_TYPES', payload: [...sheetTypes, created] });
      setSelectedTypeId(created.id);
    } catch (err: any) { alert(err.message); }
  };

  const handleDelete = async (id: string) => {
    const st = sheetTypes.find((t) => t.id === id);
    if (!st) return;
    if (!confirm(`Remover o tipo de ficha "${st.name}"? Personagens que o usam serão movidos para o tipo padrão, com Recursos/Proteções/Condições reconciliados.`)) return;
    try {
      const list = await api.sheetTypes.delete(id);
      dispatch({ type: 'SET_SHEET_TYPES', payload: list });
      if (selectedTypeId === id) setSelectedTypeId(null);
    } catch (err: any) { alert(err.message); }
  };

  const handleSetDefault = async (id: string) => {
    try {
      const list = await api.sheetTypes.setDefault(id);
      dispatch({ type: 'SET_SHEET_TYPES', payload: list });
    } catch (err: any) { alert(err.message); }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = sheetTypes.findIndex((t) => t.id === active.id);
    const newIndex = sheetTypes.findIndex((t) => t.id === over.id);
    const reordered = arrayMove(sheetTypes, oldIndex, newIndex);
    dispatch({ type: 'SET_SHEET_TYPES', payload: reordered });
    try {
      const list = await api.sheetTypes.reorder(reordered.map((t) => t.id));
      dispatch({ type: 'SET_SHEET_TYPES', payload: list });
    } catch (err: any) { alert(err.message); }
  };

  const handleSaved = (updated: SheetType) => {
    dispatch({ type: 'SET_SHEET_TYPES', payload: sheetTypes.map((t) => t.id === updated.id ? updated : t) });
  };

  const TABS: { id: Tab; label: string; icon: React.ComponentType<any> }[] = [
    { id: 'fichas', label: 'Fichas', icon: Sliders },
    { id: 'permissoes', label: 'Permissões', icon: Shield },
    { id: 'jogadores', label: 'Jogadores', icon: Users },
    { id: 'acesso', label: 'Acesso', icon: QrCode },
    { id: 'importar', label: 'Importar', icon: Download },
  ];

  return (
    <div style={s.page}>
      <div style={s.header}>
        <SettingsIcon size={20} color="var(--accent)" />
        <h1 style={s.title}>Configurações</h1>
        <div style={{ flex: 1 }} />
        {onboarding && tab === 'fichas' && (
          <Button variant="primary" size="sm" onClick={() => setTab('permissoes')}>
            Próximo: Permissões
          </Button>
        )}
        {onboarding && tab === 'permissoes' && (
          <Button variant="primary" size="sm" icon={<Check size={13} />} onClick={() => navigate('/')}>
            Concluir configuração
          </Button>
        )}
      </div>
      {onboarding && (
        <p style={s.pageSub}>Configure sua nova campanha antes de continuar.</p>
      )}

      <div style={s.tabRow}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            style={{ ...s.tabBtn, ...(tab === id ? s.tabBtnActive : {}) }}
            onClick={() => setTab(id)}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'fichas' && (
        <div style={s.tabContent}>
          <p style={s.pageSub}>
            Personalize os campos que compõem a ficha de cada tipo de personagem desta campanha.
            Crie mais de um tipo para sistemas ou estilos diferentes — cada personagem usa um.
          </p>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={sheetTypes.map((t) => t.id)} strategy={horizontalListSortingStrategy}>
              <div style={cs.chipRow}>
                {sheetTypes.map((st) => (
                  <SheetTypeChip
                    key={st.id}
                    st={st}
                    active={st.id === selectedType?.id}
                    onSelect={() => setSelectedTypeId(st.id)}
                    onSetDefault={() => handleSetDefault(st.id)}
                    onDuplicate={() => handleDuplicate(st.id)}
                    onDelete={() => handleDelete(st.id)}
                    canDelete={sheetTypes.length > 1}
                  />
                ))}
                <button style={cs.addChip} onClick={handleCreate}>
                  <Plus size={13} /> Novo tipo de ficha
                </button>
              </div>
            </SortableContext>
          </DndContext>

          {selectedType && <SheetTypeEditor key={selectedType.id} sheetType={selectedType} allSheetTypes={sheetTypes} onSaved={handleSaved} />}
        </div>
      )}

      {tab === 'permissoes' && (
        <div style={s.tabContent}>
          <PermissionsPanel />
        </div>
      )}

      {tab === 'jogadores' && (
        <div style={s.tabContent}>
          <PlayersPanel />
        </div>
      )}

      {tab === 'acesso' && (
        <div style={s.tabContent}>
          <PlayerAccessPanel />
        </div>
      )}

      {tab === 'importar' && (
        <div style={s.tabContent}>
          <CampaignImportPanel />
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, any> = {
  page: { padding: '28px 32px', maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', alignItems: 'center', gap: 10 },
  title: { fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
  pageSub: { fontSize: 13, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 },
  tabRow: { display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', paddingBottom: 2 },
  tabBtn: {
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
    background: 'none', border: 'none', borderBottom: '2px solid transparent',
    color: 'var(--text-secondary)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  tabBtnActive: { color: 'var(--accent)', borderBottomColor: 'var(--accent)' },
  tabContent: { display: 'flex', flexDirection: 'column', gap: 20 },
};

const cs: Record<string, any> = {
  chipRow: { display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  chip: {
    display: 'inline-flex', alignItems: 'center', gap: 2, padding: '4px 4px 4px 2px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  },
  grip: { cursor: 'grab', display: 'flex', alignItems: 'center', padding: '0 2px' },
  chipMain: {
    display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
    cursor: 'pointer', fontSize: 13, padding: '4px 6px',
  },
  chipAction: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center' },
  addChip: {
    display: 'inline-flex', alignItems: 'center', gap: 5, padding: '7px 12px',
    background: 'var(--bg-surface)', border: '1px dashed var(--border)', borderRadius: 'var(--radius)',
    cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)',
  },
};
