import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Edit2, Plus, Trash2, GripVertical,
  Eye, EyeOff, SlidersHorizontal, ExternalLink, Pencil,
  Zap, Shield, Library, Check, BookmarkPlus, Play,
  Backpack, Sword, FlaskConical, Star, Package, Moon,
} from 'lucide-react';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import { openImageSafely } from '../utils/safeImage';
import {
  Character, Skill, CreateSkillDTO, SkillTemplate,
  ATTRIBUTE_RATING_COLORS, ATTRIBUTE_RATING_LABELS,
  CharacterItem, ItemTemplate, ITEM_TYPE_LABELS, ITEM_TYPE_COLORS,
  PlayerPermissions, PlayerActionKey, ActionPermission, GlobalPermissions, ACTION_LABELS, DEFAULT_GLOBAL_PERMISSIONS, PLAYER_ACTION_KEYS,
  resourceMaxStat,
} from '../types';
import { ItemEffectPopover, ItemEffectTarget } from '../components/combat/EffectPopover';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import CharacterForm from '../components/characters/CharacterForm';
import CharacterSwitcher from '../components/characters/CharacterSwitcher';
import { ICON_MAP } from '../components/characters/SkillIconPicker';
import ResourceEditModal from '../components/characters/ResourceEditModal';
import ResourceBar from '../components/characters/ResourceBar';
import { ProtectionsDisplay } from '../components/characters/ProtectionsDisplay';
import { ConditionsDisplay } from '../components/characters/ConditionsDisplay';
import { InventoryItemRow } from '../components/characters/InventoryItemRow';
import { ResourceEffectBadges } from '../components/skills/ResourceEffectBadges';
import { SkillFormFields } from '../components/skills/SkillFormFields';
import { ResEffectsForm, defaultResEffects, buildResourceEffect, applyResEffects } from '../utils/resourceEffects';
import { getEquippedBonus } from '../utils/equippedEffects';
import { matchesSearch } from '../utils/normalizeSearch';
import GrimorioSpellModal from '../components/grimorio/GrimorioSpellModal';

// ======================== SKILL CARD ========================

function SortableSkill({ skill, onEdit, onDelete, onSaveToLibrary, onTrigger, onUseSkill }: {
  skill: Skill;
  onEdit: (s: Skill) => void;
  onDelete: (s: Skill) => void;
  onSaveToLibrary: (s: Skill) => void;
  onTrigger: (s: Skill) => void;
  onUseSkill: (s: Skill) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: skill.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 };
  const Icon = ICON_MAP[skill.icon] ?? ICON_MAP['Star'];
  const [saved, setSaved] = React.useState(false);
  const [triggered, setTriggered] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);

  const handleSaveToLibrary = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSaveToLibrary(skill);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleTrigger = (e: React.MouseEvent) => {
    e.stopPropagation();
    onTrigger(skill);
    setTriggered(true);
    setTimeout(() => setTriggered(false), 1500);
  };

  const isActive = skill.skillType === 'active';
  const hasEffects = isActive && skill.resourceEffect && skill.resourceEffect.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={{ ...skillStyles.card, ...(triggered ? skillStyles.cardTriggered : {}), ...style }}
      onClick={() => setExpanded(v => !v)}
    >
      <div style={{ ...skillStyles.iconBox, background: `${skill.iconColor}20` }}>
        <Icon size={20} color={skill.iconColor} />
      </div>
      <div style={skillStyles.body}>
        <div style={skillStyles.top}>
          <span style={skillStyles.title}>{skill.title}</span>
          {isActive && (
            <span style={skillStyles.activeBadge}>
              <Zap size={9} /> Ativa
            </span>
          )}
          <div style={skillStyles.actions}>
            {skill.visibility === 'private'
              ? <EyeOff size={13} color="var(--text-muted)" />
              : <Eye size={13} color="var(--accent)" />
            }
            <button style={skillStyles.grip} onClick={e => e.stopPropagation()} {...attributes} {...listeners}>
              <GripVertical size={14} color="var(--text-muted)" />
            </button>
            <button style={skillStyles.btn} onClick={(e) => { e.stopPropagation(); onEdit(skill); }}>
              <Edit2 size={13} color="var(--text-secondary)" />
            </button>
            <button
              style={{ ...skillStyles.btn, ...(saved ? skillStyles.btnSaved : {}) }}
              onClick={handleSaveToLibrary}
              title="Salvar na biblioteca"
            >
              {saved
                ? <Check size={13} color="var(--success)" />
                : <BookmarkPlus size={13} color="var(--text-secondary)" />
              }
            </button>
            <button style={skillStyles.btn} onClick={(e) => { e.stopPropagation(); onDelete(skill); }}>
              <Trash2 size={13} color="var(--error)" />
            </button>
          </div>
        </div>
        {hasEffects && <ResourceEffectBadges effects={skill.resourceEffect ?? []} />}
        {skill.usesLimit !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: '11px', color: skill.currentUses === 0 ? 'var(--error)' : 'var(--text-muted)' }}>
              Usos: {skill.currentUses ?? skill.usesLimit}/{skill.usesLimit}
              {skill.usesLimitType === 'combat' ? ' (combate)' : skill.usesLimitType === 'rest' ? ' (descanso)' : ''}
            </span>
            <button
              style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-secondary)', cursor: skill.currentUses === 0 ? 'not-allowed' : 'pointer', opacity: skill.currentUses === 0 ? 0.4 : 1 }}
              disabled={skill.currentUses === 0}
              onClick={() => onUseSkill(skill)}
              title="Gastar um uso"
            >−1</button>
          </div>
        )}
        <p style={skillStyles.desc}>{skill.description}</p>
        {expanded && isActive && (
          <div style={skillStyles.triggerRow}>
            <button
              style={{ ...skillStyles.triggerBtn, ...(triggered ? skillStyles.triggerBtnDone : {}) }}
              onClick={handleTrigger}
              title="Engatilhar habilidade"
            >
              {triggered
                ? <><Check size={13} /> Aplicado</>
                : <><Play size={12} fill="currentColor" /> Engatilhar</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}


// ======================== IMAGE POSITION PANEL ========================

function ImagePositionPanel({ position, onChange }: {
  position: string; onChange: (pos: string) => void;
}) {
  const [x, y] = position.replace(/%/g, '').split(' ').map(Number);
  const update = (nx: number, ny: number) => onChange(`${nx}% ${ny}%`);

  return (
    <div style={imgPanel.wrapper}>
      <div style={imgPanel.row}>
        <span style={imgPanel.label}>Horizontal</span>
        <input
          type="range" min={0} max={100} value={x}
          onChange={(e) => update(Number(e.target.value), y)}
          style={imgPanel.slider}
        />
        <span style={imgPanel.val}>{x}%</span>
      </div>
      <div style={imgPanel.row}>
        <span style={imgPanel.label}>Vertical</span>
        <input
          type="range" min={0} max={100} value={y}
          onChange={(e) => update(x, Number(e.target.value))}
          style={imgPanel.slider}
        />
        <span style={imgPanel.val}>{y}%</span>
      </div>
    </div>
  );
}

// ======================== MAIN ========================

const defaultSkillForm: CreateSkillDTO = {
  icon: 'Star', iconColor: '#6366f1', title: '', description: '', visibility: 'private',
  skillType: 'passive', resourceEffect: [], tags: [], usesLimit: null, usesLimitType: null,
};


// ======================== PERMISSIONS CARD ========================
// Fonte única em types (PERMISSION_GROUPS): esta lista era mantida à mão e ficou
// para trás — "Usar consumível" e "Conjurar feitiço" nunca apareceram aqui.
const PERM_ACTIONS: PlayerActionKey[] = PLAYER_ACTION_KEYS;

const PERM_OPTIONS: { value: ActionPermission; label: string; color: string }[] = [
  { value: 'free',    label: 'Livre',     color: '#22c55e' },
  { value: 'request', label: 'Solicitar', color: '#6366f1' },
  { value: 'blocked', label: 'Bloqueado', color: '#ef4444' },
];

function PlayerPermissionsCard({ character, globalPerms, onSave }: {
  character: Character;
  globalPerms: GlobalPermissions;
  onSave: (perms: PlayerPermissions) => Promise<void>;
}) {
  const [perms, setPerms] = React.useState<PlayerPermissions>(character.playerPermissions ?? {});
  const [saving, setSaving] = React.useState(false);
  const [dirty, setDirty] = React.useState(false);

  React.useEffect(() => {
    setPerms(character.playerPermissions ?? {});
    setDirty(false);
  }, [character.id]);

  const setPerm = (action: PlayerActionKey, value: ActionPermission | 'default') => {
    setPerms(p => {
      const next = { ...p };
      if (value === 'default') delete next[action];
      else next[action] = value as ActionPermission;
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(perms); setDirty(false); }
    catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={permStyles.card}>
      <div style={permStyles.header}>
        <span style={permStyles.title}>Permissões do Jogador</span>
        {dirty && (
          <button
            style={{ ...permStyles.saveBtn, opacity: saving ? 0.6 : 1 }}
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
        )}
      </div>
      <div style={permStyles.grid}>
        {PERM_ACTIONS.map((action) => {
          const current = perms[action];
          return (
            <div key={action} style={permStyles.row}>
              <span style={permStyles.actionLabel}>{ACTION_LABELS[action]}</span>
              <div style={permStyles.btnGroup}>
                {/* Padrão option */}
                {(() => {
                  const isDefault = perms[action] === undefined;
                  const effOpt = PERM_OPTIONS.find(o => o.value === globalPerms[action]);
                  return (
                    <button
                      style={{
                        ...permStyles.optBtn,
                        ...(isDefault ? { background: 'var(--bg-base)', borderColor: 'var(--text-muted)', color: 'var(--text-muted)', fontWeight: 700 } : {}),
                      }}
                      onClick={() => setPerm(action, 'default')}
                    >
                      Padrão{isDefault && effOpt ? ` (${effOpt.label})` : ''}
                    </button>
                  );
                })()}
                {PERM_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    style={{
                      ...permStyles.optBtn,
                      ...(current === opt.value ? {
                        background: `${opt.color}20`,
                        borderColor: opt.color,
                        color: opt.color,
                        fontWeight: 700,
                      } : {}),
                    }}
                    onClick={() => setPerm(action, opt.value)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const permStyles: Record<string, React.CSSProperties> = {
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '16px 18px',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: '14px',
  },
  title: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  saveBtn: {
    padding: '5px 14px', background: 'var(--accent)', border: 'none',
    borderRadius: 'var(--radius)', color: 'white', fontSize: '12px',
    fontWeight: 600, cursor: 'pointer',
  },
  grid: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '6px 10px', background: 'var(--bg-elevated)',
    borderRadius: 'var(--radius-sm)',
  },
  actionLabel: { flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 },
  btnGroup: { display: 'flex', gap: '4px' },
  optBtn: {
    padding: '4px 10px', fontSize: '11px', fontWeight: 500,
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer',
    color: 'var(--text-secondary)', transition: 'all 0.15s',
  },
};

function LibItemRow({ tpl, TypeIcon, typeColor, onAdd, sheetTypeId }: {
  tpl: ItemTemplate;
  TypeIcon: React.ComponentType<any>;
  typeColor: string;
  onAdd: (qty: number) => void;
  sheetTypeId?: string;
}) {
  const [qty, setQty] = useState(1);
  const [effectTarget, setEffectTarget] = useState<ItemEffectTarget | null>(null);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', ...styles.libCard as any }}>
      <div style={{ ...styles.libIcon, background: `${typeColor}20`, flexShrink: 0 }}>
        <TypeIcon size={16} color={typeColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{tpl.name}</span>
          <span style={{ fontSize: '10px', color: typeColor, background: `${typeColor}15`, padding: '1px 6px', borderRadius: '100px' }}>
            {ITEM_TYPE_LABELS[tpl.type]}
          </span>
        </div>
        {tpl.description && <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{tpl.description}</span>}
        {tpl.type === 'weapon' && tpl.damage && (
          <span style={{ fontSize: '11px', color: '#f59e0b', display: 'block', marginTop: 2 }}>⚔ {tpl.damage}</span>
        )}
        {tpl.effects && tpl.effects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }} onClick={e => e.stopPropagation()}>
            {tpl.effects.map((eff, i) => {
              const color = eff.color ?? 'var(--accent)';
              return (
                <button
                  key={i}
                  style={{ ...invStyles.effectBadge, background: `${color}18`, color, border: `1px solid ${color}44` }}
                  onClick={(e) => {
                    e.stopPropagation();
                    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                    setEffectTarget(prev => prev?.effect === eff ? null : { effect: eff, rect });
                  }}
                >
                  {eff.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
      {tpl.type === 'consumable' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }} onClick={e => e.stopPropagation()}>
          <button style={invStyles.qtyBtn} onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
          <span style={{ ...invStyles.qtyNum, minWidth: 20, textAlign: 'center' }}>{qty}</span>
          <button style={invStyles.qtyBtn} onClick={() => setQty(q => q + 1)}>+</button>
        </div>
      )}
      <button
        style={{ ...invStyles.actionBtn, flexShrink: 0 }}
        onClick={() => onAdd(qty)}
      >
        Adicionar
      </button>
      <ItemEffectPopover target={effectTarget} onClose={() => setEffectTarget(null)} sheetTypeId={sheetTypeId} />
    </div>
  );
}

export default function CharacterSheet() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    characters, players, dispatch, campaign, effectTemplates, grimorios,
    getResourceDefs, getProtectionDefs, getConditionDefs, getResourceLabel, getResourceColor,
  } = useApp();
  const character = characters.find((c) => c.id === id);
  const resourceDefs = getResourceDefs(character?.sheetTypeId);
  const protectionDefs = getProtectionDefs(character?.sheetTypeId);
  const conditionDefs = getConditionDefs(character?.sheetTypeId);
  const resourceKeys = resourceDefs.map((r) => r.key);

  const { itemTemplates } = useApp();
  const [editCharOpen, setEditCharOpen] = useState(false);
  const [grimModalId, setGrimModalId] = useState<string | null>(null);
  const [resourceModalOpen, setResourceModalOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemEffectTarget, setItemEffectTarget] = useState<ItemEffectTarget | null>(null);
  const [itemSearch, setItemSearch] = useState('');
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [skillForm, setSkillForm] = useState<CreateSkillDTO>(defaultSkillForm);
  const [savingSkill, setSavingSkill] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [libraryTemplates, setLibraryTemplates] = useState<SkillTemplate[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [resEffects, setResEffects] = useState<ResEffectsForm>(() => defaultResEffects(resourceKeys));

  // Posição da imagem (editável inline)
  const [showImgControls, setShowImgControls] = useState(false);
  const [localPosition, setLocalPosition] = useState<string | null>(null);
  const [savingPos, setSavingPos] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor));
  const player = players.find((p) => p.id === character?.playerId);

  useTitle(character?.name ?? 'Personagem');

  if (!character) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
        Personagem não encontrado.
        <br />
        <Button variant="ghost" onClick={() => navigate('/characters')} style={{ marginTop: '16px' }}>
          Voltar
        </Button>
      </div>
    );
  }

  const avatarPosition = localPosition ?? character.avatarPosition ?? '50% 50%';

  const saveResources = async (cr: Record<string, number>) => {
    const updated = await api.characters.update(character.id, { currentResources: cr });
    dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
  };

  const handleConditionChange = async (key: string, stateId: string) => {
    const updated = await api.characters.update(character.id, { conditions: { [key]: stateId } });
    dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
  };


  const saveAvatarPosition = async () => {
    if (!localPosition) return;
    setSavingPos(true);
    try {
      const updated = await api.characters.update(character.id, { avatarPosition: localPosition });
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      setLocalPosition(null);
      setShowImgControls(false);
    } finally {
      setSavingPos(false);
    }
  };

  const parseDuplicate = (err: any): { id: string; title: string } | null => {
    try { const p = JSON.parse(err.message); if (p.code === 'DUPLICATE') return p; } catch {}
    return null;
  };

  const handleSaveSkillToLibrary = async (skill: Skill) => {
    const dto = {
      title: skill.title,
      description: skill.description,
      icon: skill.icon,
      iconColor: skill.iconColor,
      skillType: skill.skillType ?? 'passive',
      resourceEffect: skill.resourceEffect ?? [],
      tags: [...(skill.tags ?? [])],
      usesLimit: skill.usesLimit ?? null,
      usesLimitType: skill.usesLimitType ?? null,
    };
    try {
      await api.skillTemplates.create(dto);
    } catch (err: any) {
      const dup = parseDuplicate(err);
      if (dup) {
        const replace = confirm(`Já existe uma habilidade chamada "${dup.title}" na biblioteca.\nDeseja substituí-la?`);
        if (replace) await api.skillTemplates.update(dup.id, dto);
        return;
      }
      alert(err.message);
    }
  };

  // Mesma rota que o jogador usa com permissão livre e que a aprovação de uma
  // solicitação skill_trigger executa — a conta de custo/ganho mora só no servidor.
  const handleTriggerSkill = async (skill: Skill) => {
    if ((skill.resourceEffect ?? []).length === 0) return;
    try {
      const updated = await api.skills.trigger(character.id, skill.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch (err: any) { alert(err.message); }
  };

  const openFromLibrary = (tpl: SkillTemplate) => {
    setEditingSkill(null);
    setSkillForm({
      icon: tpl.icon, iconColor: tpl.iconColor,
      title: tpl.title, description: tpl.description,
      visibility: 'private',
      skillType: tpl.skillType,
      resourceEffect: tpl.resourceEffect,
      tags: [...tpl.tags],
      usesLimit: tpl.usesLimit ?? null,
      usesLimitType: tpl.usesLimitType ?? null,
    });
    setResEffects(applyResEffects(tpl.resourceEffect ?? [], resourceKeys));
    setLibraryOpen(false);
    setSkillModalOpen(true);
  };

  const loadLibrary = async () => {
    setLibraryLoading(true);
    try {
      const data = await api.skillTemplates.list();
      setLibraryTemplates(data);
    } finally { setLibraryLoading(false); }
  };

  const openCreateSkill = () => {
    setEditingSkill(null);
    setSkillForm(defaultSkillForm);
    setResEffects(defaultResEffects(resourceKeys));
    setSkillModalOpen(true);
  };

  const openEditSkill = (skill: Skill) => {
    setEditingSkill(skill);
    setSkillForm({
      icon: skill.icon, iconColor: skill.iconColor, title: skill.title,
      description: skill.description, visibility: skill.visibility,
      skillType: skill.skillType ?? 'passive',
      resourceEffect: skill.resourceEffect ?? [],
      tags: [...(skill.tags ?? [])],
      usesLimit: skill.usesLimit ?? null,
      usesLimitType: skill.usesLimitType ?? null,
    });
    setResEffects(applyResEffects(skill.resourceEffect ?? [], resourceKeys));
    setSkillModalOpen(true);
  };

  const handleSaveSkill = async () => {
    if (!skillForm.title.trim()) return alert('Título obrigatório');
    setSavingSkill(true);
    const finalForm: CreateSkillDTO = {
      ...skillForm,
      resourceEffect: skillForm.skillType === 'active' ? buildResourceEffect(resEffects) : [],
    };
    try {
      if (editingSkill) await api.skills.update(character.id, editingSkill.id, finalForm);
      else await api.skills.create(character.id, finalForm);
      const updated = await api.characters.get(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      setSkillModalOpen(false);
    } catch (err: any) { alert(err.message); }
    finally { setSavingSkill(false); }
  };

  const handleDeleteSkill = async (skill: Skill) => {
    if (!confirm(`Remover habilidade "${skill.title}"?`)) return;
    try {
      await api.skills.delete(character.id, skill.id);
      const updated = await api.characters.get(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch (err: any) { alert(err.message); }
  };

  const handleDragEnd = async (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const newOrder = arrayMove(character.skills, character.skills.findIndex(s => s.id === active.id), character.skills.findIndex(s => s.id === over.id));
    try {
      await api.skills.reorder(character.id, newOrder.map(s => s.id));
      const updated = await api.characters.get(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch {}
  };

  const handleAddItemFromTemplate = async (tpl: ItemTemplate, qty: number = 1) => {
    try {
      await api.characterItems.add(character.id, {
        templateId: tpl.id,
        name: tpl.name,
        description: tpl.description,
        type: tpl.type,
        icon: tpl.icon,
        iconColor: tpl.iconColor,
        damage: tpl.damage,
        effects: tpl.effects,
        quantity: qty,
      });
      const updated = await api.characters.get(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      setAddItemOpen(false);
    } catch (err: any) { alert(err.message); }
  };

  const handleChangeQty = async (item: CharacterItem, delta: number) => {
    const newQty = Math.max(0, item.quantity + delta);
    try {
      if (newQty === 0) {
        await api.characterItems.remove(character.id, item.id);
      } else {
        await api.characterItems.update(character.id, item.id, { quantity: newQty });
      }
      const updated = await api.characters.get(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch (err: any) { alert(err.message); }
  };

  const handleEquipToggle = async (item: CharacterItem) => {
    try {
      await api.characterItems.update(character.id, item.id, { equipped: !item.equipped });
      const updated = await api.characters.get(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch (err: any) { alert(err.message); }
  };

  const handleUseItem = async (item: CharacterItem) => {
    try {
      await api.characterItems.use(character.id, item.id);
      const updated = await api.characters.get(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch (err: any) { alert(err.message); }
  };

  const handleRemoveItem = async (item: CharacterItem) => {
    if (!confirm(`Remover "${item.name}" do inventário?`)) return;
    try {
      await api.characterItems.remove(character.id, item.id);
      const updated = await api.characters.get(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch (err: any) { alert(err.message); }
  };

  const handleRest = async () => {
    try {
      const updated = await api.characters.rest(character.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch (err: any) { alert(err.message); }
  };

  const handleUseSkill = async (skill: Skill) => {
    try {
      const updated = await api.skills.use(character.id, skill.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
    } catch (err: any) { alert(err.message); }
  };

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topBar}>
        <button style={styles.back} onClick={() => navigate('/characters')}>
          <ArrowLeft size={16} /><span>Personagens</span>
        </button>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" size="sm" icon={<Moon size={13} />} onClick={handleRest}>
            Descansar
          </Button>
          <Button variant="secondary" size="sm" icon={<Edit2 size={13} />} onClick={() => setEditCharOpen(true)}>
            Editar ficha
          </Button>
        </div>
      </div>

      {/* Troca de ficha sem passar pela lista */}
      <CharacterSwitcher currentId={character.id} />

      <div style={styles.layout}>
        {/* Coluna esquerda */}
        <div style={styles.leftCol}>

          {/* Avatar */}
          <div style={styles.avatarCard}>
            {character.avatar ? (
              <>
                <div style={styles.avatarWrap}>
                  <img
                    src={character.avatar}
                    alt={character.name}
                    style={{ ...styles.avatarImg, objectPosition: avatarPosition }}
                  />
                  {/* Botões de controle sobre a imagem */}
                  <div style={styles.avatarOverlay}>
                    <button
                      style={styles.imgBtn}
                      title="Centralizar imagem"
                      onClick={() => { setShowImgControls(v => !v); setLocalPosition(character.avatarPosition ?? '50% 50%'); }}
                    >
                      <SlidersHorizontal size={14} />
                    </button>
                    <button
                      style={styles.imgBtn}
                      title="Ver imagem completa"
                      onClick={() => openImageSafely(character.avatar!)}
                    >
                      <ExternalLink size={14} />
                    </button>
                  </div>
                </div>

                {/* Painel de posição */}
                {showImgControls && (
                  <div style={styles.imgControlPanel}>
                    <ImagePositionPanel
                      position={avatarPosition}
                      onChange={setLocalPosition}
                    />
                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '6px' }}>
                      <Button
                        variant="secondary" size="sm"
                        onClick={() => { setShowImgControls(false); setLocalPosition(null); }}
                      >Cancelar</Button>
                      <Button variant="primary" size="sm" loading={savingPos} onClick={saveAvatarPosition}>
                        Salvar posição
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div style={styles.avatarFallback}>
                <span style={styles.avatarInitial}>{character.name.charAt(0)}</span>
              </div>
            )}

            {/* Nome e jogador sobre o card */}
            <div style={styles.heroInfo}>
              <h1 style={styles.heroName}>{character.name}</h1>
              {player && (
                <div style={styles.heroPlayer}>
                  <span style={{ ...styles.playerDot, background: player.color }} />
                  <span style={{ color: player.color, fontWeight: 500, fontSize: '13px' }}>{player.name}</span>
                </div>
              )}
              {character.description && (
                <p style={styles.heroDesc}>{character.description}</p>
              )}
            </div>
          </div>

          {/* Recursos */}
          {resourceDefs.length > 0 && (
            <div style={styles.card}>
              <div style={styles.cardTitleRow}>
                <h3 style={styles.cardTitle}>Recursos</h3>
                <Button
                  variant="secondary" size="sm"
                  icon={<Pencil size={12} />}
                  onClick={() => setResourceModalOpen(true)}
                >
                  Editar
                </Button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {resourceDefs.map((def) => (
                  <ResourceBar
                    key={def.key}
                    label={def.label}
                    current={character.currentResources[def.key] ?? 0}
                    max={(character.resources[def.key] ?? 0) + getEquippedBonus(character.items, resourceMaxStat(def.key))}
                    color={def.color}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Proteções */}
          {protectionDefs.length > 0 && (
            <div style={styles.card}>
              <h3 style={{ ...styles.cardTitle, marginBottom: '12px' }}>Proteções</h3>
              <ProtectionsDisplay character={character} />
            </div>
          )}

          {/* Condições */}
          {conditionDefs.length > 0 && (
            <div style={styles.card}>
              <h3 style={{ ...styles.cardTitle, marginBottom: '12px' }}>Condições</h3>
              <ConditionsDisplay character={character} defs={conditionDefs} onChange={handleConditionChange} />
            </div>
          )}

          {/* Atributos */}
          {character.attributes.length > 0 && (
            <div style={styles.card}>
              <h3 style={{ ...styles.cardTitle, marginBottom: '12px' }}>Atributos</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {character.attributes.map((attr) => (
                  <div key={attr.id} style={styles.attrChip}>
                    <span style={{ ...styles.attrDot, background: ATTRIBUTE_RATING_COLORS[attr.rating] }} />
                    <span style={styles.attrName}>{attr.name}</span>
                    <span style={{ ...styles.attrRating, color: ATTRIBUTE_RATING_COLORS[attr.rating] }}>
                      {ATTRIBUTE_RATING_LABELS[attr.rating]}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Inspirações — sempre por ultimo */}
          <div style={styles.card}>
            <div style={styles.cardTitleRow}>
              <h3 style={styles.cardTitle}>Inspirações</h3>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <Button variant="secondary" size="sm" onClick={async () => {
                const updated = await api.characters.update(character.id, { inspiration: Math.max(0, character.inspiration - 1) });
                dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
              }}>−</Button>
              <span style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', minWidth: '32px', textAlign: 'center' }}>
                {character.inspiration}
              </span>
              <Button variant="secondary" size="sm" onClick={async () => {
                const updated = await api.characters.update(character.id, { inspiration: character.inspiration + 1 });
                dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
              }}>+</Button>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>pontos concedidos pelo mestre</span>
            </div>
          </div>
        </div>

        {/* Coluna direita — Habilidades */}
        <div style={styles.rightCol}>
          <div style={styles.skillsHeader}>
            <h3 style={styles.cardTitle}>Habilidades</h3>
            <div style={{ display: 'flex', gap: '6px' }}>
              <Button variant="secondary" size="sm" icon={<Library size={13} />}
                onClick={() => { setLibrarySearch(''); loadLibrary(); setLibraryOpen(true); }}>
                Habilidades
              </Button>
              <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={openCreateSkill}>
                Nova
              </Button>
            </div>
          </div>

          {character.skills.length === 0 ? (
            <div style={styles.empty}>
              <p>Nenhuma habilidade cadastrada.</p>
              <Button variant="secondary" size="sm" icon={<Plus size={13} />} onClick={openCreateSkill}>
                Adicionar primeira habilidade
              </Button>
            </div>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={character.skills.map(s => s.id)} strategy={verticalListSortingStrategy}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {character.skills.map(skill => (
                    <SortableSkill key={skill.id} skill={skill} onEdit={openEditSkill} onDelete={handleDeleteSkill} onSaveToLibrary={handleSaveSkillToLibrary} onTrigger={handleTriggerSkill} onUseSkill={handleUseSkill} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          )}
        {/* Inventário */}
        <div style={styles.skillsHeader}>
          <h3 style={styles.cardTitle}>Inventário</h3>
          <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => { setItemSearch(''); setAddItemOpen(true); }}>
            Adicionar item
          </Button>
        </div>

        {(character.items ?? []).length === 0 ? (
          <div style={styles.empty}>
            <p>Nenhum item no inventário.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {(character.items ?? []).map((item) => (
              <InventoryItemRow
                key={item.id}
                item={item}
                template={item.templateId ? itemTemplates.find(t => t.id === item.templateId) : null}
                mode="gm"
                effectTemplates={effectTemplates}
                onEquipToggle={handleEquipToggle}
                onRemove={handleRemoveItem}
                onUse={handleUseItem}
                onChangeQty={handleChangeQty}
                onEffectClick={(eff, rect) => setItemEffectTarget(prev => prev?.effect === eff ? null : { effect: eff, rect })}
                onCatalizadorClick={(grimorioId) => setGrimModalId(grimorioId)}
              />
            ))}
          </div>
        )}
        </div>
      </div>

      {/* Permissões do Jogador */}
      {character.playerId && (
        <PlayerPermissionsCard character={character} globalPerms={campaign?.globalPermissions ?? DEFAULT_GLOBAL_PERMISSIONS} onSave={async (perms) => {
          const updated = await api.characters.update(character.id, { playerPermissions: perms } as any);
          dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
        }} />
      )}

            {/* Modal editar ficha */}
      <Modal open={editCharOpen} onClose={() => setEditCharOpen(false)} title="Editar Personagem" width={600}>
        <CharacterForm
          character={character}
          onSave={(updated) => { dispatch({ type: 'UPDATE_CHARACTER', payload: updated }); setEditCharOpen(false); }}
          onCancel={() => setEditCharOpen(false)}
        />
      </Modal>

      {/* Modal de recursos */}
      <ResourceEditModal
        open={resourceModalOpen}
        onClose={() => setResourceModalOpen(false)}
        character={character}
        onSave={saveResources}
      />

      {/* Modal habilidade */}
      <Modal open={skillModalOpen} onClose={() => setSkillModalOpen(false)} title={editingSkill ? 'Editar Habilidade' : 'Nova Habilidade'} width={560}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <SkillFormFields
            form={skillForm}
            onChange={(patch) => setSkillForm(f => ({ ...f, ...patch }))}
            resEffects={resEffects}
            onResEffectsChange={setResEffects}
            sheetTypeId={character?.sheetTypeId}
            showVisibility={true}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <Button variant="secondary" onClick={() => setSkillModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={savingSkill} onClick={handleSaveSkill}>
              {editingSkill ? 'Salvar' : 'Criar habilidade'}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Add item modal */}
      <Modal open={addItemOpen} onClose={() => setAddItemOpen(false)} title="Adicionar Item" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            style={styles.textInput}
            placeholder="Buscar item..."
            value={itemSearch}
            onChange={(e) => setItemSearch(e.target.value)}
            autoFocus
          />
          {itemTemplates.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              Nenhum item na biblioteca. Crie itens em Biblioteca de Itens.
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
              {itemTemplates
                .filter((t) => matchesSearch(t.name, itemSearch))
                .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' }))
                .map((tpl) => {
                  const defaultIcon = tpl.type === 'weapon' ? Sword : tpl.type === 'vest' ? Shield : tpl.type === 'consumable' ? FlaskConical : Star;
                  const TypeIcon = (tpl.icon ? ICON_MAP[tpl.icon] : null) ?? defaultIcon;
                  const typeColor = tpl.iconColor ?? ITEM_TYPE_COLORS[tpl.type];
                  return (
                    <LibItemRow
                      key={tpl.id}
                      tpl={tpl}
                      TypeIcon={TypeIcon}
                      typeColor={typeColor}
                      onAdd={(qty) => handleAddItemFromTemplate(tpl, qty)}
                      sheetTypeId={character?.sheetTypeId}
                    />
                  );
                })}
              {itemTemplates.filter((t) => matchesSearch(t.name, itemSearch)).length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Nenhum item encontrado.</p>
              )}
            </div>
          )}
        </div>
      </Modal>

      <ItemEffectPopover target={itemEffectTarget} onClose={() => setItemEffectTarget(null)} sheetTypeId={character?.sheetTypeId} />

      {/* Library picker modal */}
      <Modal open={libraryOpen} onClose={() => setLibraryOpen(false)} title="Importar de Habilidades" width={500}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <input
              style={{ ...styles.textInput, paddingLeft: '32px' }}
              placeholder="Buscar habilidade..."
              value={librarySearch}
              onChange={(e) => setLibrarySearch(e.target.value)}
              autoFocus
            />
          </div>
          {libraryLoading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Carregando...</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '360px', overflowY: 'auto' }}>
              {libraryTemplates
                .filter(t => matchesSearch(t.title, librarySearch))
                .sort((a, b) => a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' }))
                .map((tpl) => {
                  const Icon = ICON_MAP[tpl.icon] ?? ICON_MAP['Star'];
                  return (
                    <button key={tpl.id} style={styles.libCard} onClick={() => openFromLibrary(tpl)}>
                      <div style={{ ...styles.libIcon, background: `${tpl.iconColor}20` }}>
                        <Icon size={16} color={tpl.iconColor} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{tpl.title}</span>
                          <span style={{ fontSize: '10px', color: tpl.skillType === 'active' ? 'var(--accent)' : 'var(--text-muted)' }}>
                            {tpl.skillType === 'active' ? '⚡ Ativa' : '🛡 Passiva'}
                          </span>
                        </div>
                        {tpl.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
                            {tpl.tags.slice(0, 3).map(tag => (
                              <span key={tag} style={{ fontSize: '9px', padding: '1px 5px', borderRadius: '100px', background: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{tag}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })
              }
              {libraryTemplates.filter(t => matchesSearch(t.title, librarySearch)).length === 0 && (
                <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
                  {libraryTemplates.length === 0 ? 'Nenhuma habilidade salva. Adicione habilidades na secao Habilidades.' : 'Nenhuma habilidade encontrada.'}
                </p>
              )}
            </div>
          )}
        </div>
      </Modal>
      {grimModalId && (() => {
        const grim = grimorios.find((g) => g.id === grimModalId);
        if (!grim || !character) return null;
        return (
          <GrimorioSpellModal
            grimorio={grim}
            characterId={character.id}
            permission="free"
            onClose={() => setGrimModalId(null)}
            onCastSuccess={() => { /* GM cast — no dispatch needed; socket update handles it */ }}
          />
        );
      })()}
    </div>
  );
}

const styles: Record<string, any> = {
  page: { padding: '24px 28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '1100px' },
  topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  back: {
    display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)',
    cursor: 'pointer', fontSize: '13px', fontWeight: 500, background: 'none', border: 'none', padding: '4px',
  },
  layout: { display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', alignItems: 'start' },
  leftCol: { display: 'flex', flexDirection: 'column', gap: '14px' },
  rightCol: { display: 'flex', flexDirection: 'column', gap: '12px' },

  avatarCard: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
  },
  avatarWrap: { position: 'relative', height: '180px', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  avatarOverlay: {
    position: 'absolute', top: '8px', right: '8px',
    display: 'flex', gap: '5px',
  },
  imgBtn: {
    width: '28px', height: '28px', borderRadius: 'var(--radius-sm)',
    background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.15)',
    color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(4px)',
  },
  imgControlPanel: {
    padding: '12px', borderTop: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  avatarFallback: {
    height: '120px', background: 'var(--accent-dim)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  avatarInitial: { fontSize: '48px', fontWeight: 700, color: 'var(--accent)' },
  heroInfo: { padding: '14px 16px' },
  heroName: { fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' },
  heroPlayer: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' },
  playerDot: { width: '8px', height: '8px', borderRadius: '50%' },
  heroDesc: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' },

  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px' },
  cardTitleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' },
  cardTitle: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 },
  attrChip: {
    display: 'flex', alignItems: 'center', gap: '8px',
    padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)',
  },
  attrDot: { width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0 },
  attrName: { flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 },
  attrRating: { fontSize: '11px', fontWeight: 600 },
  skillsHeader: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: '14px 18px',
  },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px',
    padding: '40px', color: 'var(--text-muted)', textAlign: 'center',
    background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)',
  },
  textInput: {
    width: '100%', padding: '9px 12px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    color: 'var(--text-primary)', fontSize: '14px',
  },
  libCard: {
    display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 12px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', cursor: 'pointer', width: '100%', textAlign: 'left',
    transition: 'border-color var(--transition)',
  },
  libIcon: {
    width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
};


const skillStyles: Record<string, any> = {
  card: {
    display: 'flex', gap: '12px', padding: '12px 14px',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', transition: 'border-color var(--transition)',
    cursor: 'pointer',
  },
  iconBox: {
    width: '40px', height: '40px', borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  body: { flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' },
  top: { display: 'flex', alignItems: 'center', gap: '8px' },
  title: { flex: 1, fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' },
  actions: { display: 'flex', gap: '4px', alignItems: 'center' },
  desc: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.5, whiteSpace: 'pre-wrap' },
  grip: { cursor: 'grab', display: 'flex', alignItems: 'center', background: 'none', border: 'none' },
  btn: { cursor: 'pointer', background: 'none', border: 'none', display: 'flex', alignItems: 'center', padding: '2px' },
  btnSaved: { opacity: 0.8 },
  triggerRow: { display: 'flex', justifyContent: 'flex-end', marginTop: '8px' },
  triggerBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '5px',
    padding: '5px 12px', borderRadius: 'var(--radius)',
    background: 'var(--accent-dim)', border: '1px solid var(--accent)',
    color: 'var(--accent)', fontSize: '12px', fontWeight: 600,
    cursor: 'pointer', transition: 'all var(--transition)',
  },
  triggerBtnDone: {
    background: 'rgba(34,197,94,0.15)', borderColor: '#22c55e', color: '#22c55e',
  },
  cardTriggered: { boxShadow: '0 0 0 2px var(--accent-dim)' },
  activeBadge: {
    display: 'inline-flex', alignItems: 'center', gap: '3px',
    fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '100px',
    background: 'var(--accent-dim)', color: 'var(--accent)', flexShrink: 0,
  },
};

const invStyles: Record<string, any> = {
  actionBtn: {
    padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 600,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    color: 'var(--text-secondary)', cursor: 'pointer',
  },
  effectBadge: {
    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: '100px',
    cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit',
  },
  qtyBtn: {
    width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer',
    fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 0, fontFamily: 'inherit',
  },
  qtyNum: { fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', minWidth: 18, textAlign: 'center' },
};

const imgPanel: Record<string, any> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '8px' },
  row: { display: 'flex', alignItems: 'center', gap: '8px' },
  label: { fontSize: '11px', color: 'var(--text-muted)', width: '60px', flexShrink: 0 },
  slider: { flex: 1, accentColor: 'var(--accent)', cursor: 'pointer' },
  val: { fontSize: '11px', color: 'var(--text-secondary)', width: '32px', textAlign: 'right' },
};
