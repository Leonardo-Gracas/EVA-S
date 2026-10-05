import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import {
  Eye, EyeOff, Wifi, WifiOff, LogOut, Plus, ChevronLeft, ChevronRight,
  Edit2, Trash2, Play, Check, Zap, Shield, BookmarkCheck, CheckCircle, XCircle, X,
  Sword, Moon,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { getSocket } from '../services/socket';
import CombatMap from './CombatMap';
import { api } from '../services/api';
import {
  Player, Character, Skill, CreateSkillDTO, CharacterRequest, CharacterItem,
  ATTRIBUTE_RATING_COLORS, ATTRIBUTE_RATING_LABELS,
  ITEM_TYPE_COLORS, getEffectStatLabel,
  ItemType, AddCharacterItemDTO, getPermission, CombatSession, GameMap,
  resourceMaxStat, PlayerActionKey, ActionPermission, PLAYER_ACTION_KEYS,
} from '../types';
import { ICON_MAP } from '../components/characters/SkillIconPicker';
import Modal from '../components/common/Modal';
import { EffectPopover, PopoverTarget, ItemEffectPopover, ItemEffectTarget } from '../components/combat/EffectPopover';
import { CombatQueueEntry } from '../components/combat/CombatQueueEntry';
import CharacterForm from '../components/characters/CharacterForm';
import { ProtectionsDisplay } from '../components/characters/ProtectionsDisplay';
import { ConditionsDisplay } from '../components/characters/ConditionsDisplay';
import { InventoryItemRow } from '../components/characters/InventoryItemRow';
import { ResourceEffectBadges } from '../components/skills/ResourceEffectBadges';
import { SkillFormFields } from '../components/skills/SkillFormFields';
import { ResEffectsForm, defaultResEffects, buildResourceEffect, applyResEffects } from '../utils/resourceEffects';
import EvaLogo from '../components/layout/EvaLogo';
import PlayerLogin from './PlayerLogin';
import ResourceEditModal from '../components/characters/ResourceEditModal';
import GrimorioSpellModal from '../components/grimorio/GrimorioSpellModal';
import ResourceBar from '../components/characters/ResourceBar';
import { getEquippedBonus } from '../utils/equippedEffects';
import { RequestDiff } from '../components/common/RequestDiff';


// ======================== SENT TOAST ========================
function SentBadge({ mode }: { mode: 'free' | 'request' }) {
  return (
    <div style={sent.badge}>
      <BookmarkCheck size={13} color="var(--success)" />
      <span>{mode === 'free' ? 'Ação aplicada' : 'Solicitação enviada ao Mestre'}</span>
    </div>
  );
}

// ======================== EQUIPPED VIEW ========================
function EquippedView({ items, sheetTypeId }: { items: CharacterItem[]; sheetTypeId?: string }) {
  const { itemTemplates, getSheetType } = useApp();
  const sheetConfig = getSheetType(sheetTypeId).config;
  const equipped = items.filter(i => i.equipped);
  if (equipped.length === 0) {
    return <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum item equipado.</p>;
  }
  const allEffects = equipped.flatMap(item =>
    item.effects.map(eff => ({ ...eff, itemName: item.name }))
  );
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        {equipped.map(item => {
          const tpl = item.templateId ? itemTemplates.find(t => t.id === item.templateId) : null;
          const typeColor = tpl?.iconColor ?? item.iconColor ?? ITEM_TYPE_COLORS[item.type];
          const defaultEquipIcon = item.type === 'weapon' ? Sword : Shield;
          const TypeIcon = (tpl?.icon ? ICON_MAP[tpl.icon] : item.icon ? ICON_MAP[item.icon] : null) ?? defaultEquipIcon;
          return (
            <div key={item.id} style={{ ...inv.equippedChip, borderColor: typeColor }}>
              <div style={{ ...inv.chipIcon, background: `${typeColor}20` }}>
                <TypeIcon size={13} color={typeColor} />
              </div>
              <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{item.name}</span>
              {item.type === 'weapon' && item.damage && (
                <span style={{ fontSize: '11px', color: '#f59e0b', marginLeft: 2 }}>⚔ {item.damage}</span>
              )}
            </div>
          );
        })}
      </div>
      {allEffects.length > 0 && (
        <div>
          <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>Efeitos ativos</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {allEffects.map((eff, i) => (
              <div key={i} style={{ ...inv.effRow, borderLeft: `3px solid ${eff.color ?? '#6366f1'}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: eff.applications.length > 0 ? 4 : 0 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: eff.color ?? '#6366f1' }}>{eff.name || eff.description}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>({eff.itemName})</span>
                </div>
                {eff.description && eff.name && (
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 4px' }}>{eff.description}</p>
                )}
                {eff.applications.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {eff.applications.map((app, ai) => {
                      const sign = app.operation === 'add' ? '+' : '−';
                      const statLabel = app.stat === 'custom' ? (app.customName ?? 'Personalizado') : getEffectStatLabel(app.stat, sheetConfig);
                      const appColor = app.operation === 'add' ? '#22c55e' : '#ef4444';
                      return (
                        <span key={ai} style={{ fontSize: '11px', fontWeight: 600, padding: '1px 7px', borderRadius: '100px', background: `${appColor}15`, color: appColor, border: `1px solid ${appColor}40` }}>
                          {sign}{app.value} {statLabel}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ======================== PLAYER SKILL CARD ========================
function PlayerSkillCard({ skill, onTrigger, onEdit, onDelete, onUseSkill, permUpdate, permDelete, permUse }: {
  skill: Skill;
  onTrigger: (s: Skill) => Promise<void>;
  onEdit: (s: Skill) => void;
  onDelete: (s: Skill) => void;
  onUseSkill: (s: Skill) => void;
  permUpdate: string;
  permDelete: string;
  permUse: string;
}) {
  const SkillIcon = ICON_MAP[skill.icon] ?? ICON_MAP['Star'];
  const [expanded, setExpanded] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const isActive = skill.skillType === 'active';
  const hasEffects = isActive && skill.resourceEffect && skill.resourceEffect.length > 0;
  const handleTrigger = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await onTrigger(skill);
    setTriggered(true);
    setTimeout(() => setTriggered(false), 1500);
  };
  return (
    <div style={{ ...sk2.card, ...(triggered ? sk2.cardTriggered : {}) }} onClick={() => setExpanded(v => !v)}>
      <div style={{ ...sk2.icon, background: `${skill.iconColor}20` }}>
        <SkillIcon size={18} color={skill.iconColor} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={sk2.top}>
          <span style={sk2.title}>{skill.title}</span>
          {isActive && <span style={sk2.activeBadge}><Zap size={9} /> Ativa</span>}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }} onClick={e => e.stopPropagation()}>
            {skill.visibility === 'public' ? <Eye size={12} color="var(--accent)" /> : <EyeOff size={12} color="var(--text-muted)" />}
          </div>
        </div>
        {hasEffects && (
          <div style={{ marginTop: '3px' }}>
            <ResourceEffectBadges effects={skill.resourceEffect ?? []} />
          </div>
        )}
        {skill.usesLimit !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px' }} onClick={e => e.stopPropagation()}>
            <span style={{ fontSize: '11px', color: skill.currentUses === 0 ? '#ef4444' : 'var(--text-muted)' }}>
              Usos: {skill.currentUses ?? skill.usesLimit}/{skill.usesLimit}
              {skill.usesLimitType === 'combat' ? ' (combate)' : skill.usesLimitType === 'rest' ? ' (descanso)' : ''}
            </span>
            {permUse !== 'blocked' && (
              <button
                style={{ fontSize: '11px', padding: '1px 7px', borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-secondary)', cursor: skill.currentUses === 0 ? 'not-allowed' : 'pointer', opacity: skill.currentUses === 0 ? 0.4 : 1 }}
                disabled={skill.currentUses === 0}
                onClick={() => onUseSkill(skill)}
                title={permUse === 'free' ? 'Gastar um uso' : 'Solicitar ao Mestre para gastar um uso'}
              >{permUse === 'free' ? '−1' : '−1 ?'}</button>
            )}
          </div>
        )}
        <p style={sk2.desc}>{skill.description}</p>
        {expanded && (
          <div style={sk2.expandedRow} onClick={e => e.stopPropagation()}>
            {isActive && permUse !== 'blocked' && (
              <button
                style={{ ...sk2.triggerBtn, ...(triggered ? sk2.triggerBtnDone : {}) }}
                onClick={handleTrigger}
                title={permUse === 'free' ? 'Aplica o custo/ganho de recursos' : 'Envia ao Mestre para aprovação'}
              >
                {triggered
                  ? <><Check size={12} /> {permUse === 'free' ? 'Aplicado' : 'Enviado'}</>
                  : <><Play size={11} fill="currentColor" /> {permUse === 'free' ? 'Engatilhar' : 'Solicitar uso'}</>}
              </button>
            )}
            <div style={{ flex: 1 }} />
            {permUpdate !== 'blocked' && (
              <button style={sk2.actionBtn} onClick={() => onEdit(skill)} title="Solicitar edição"><Edit2 size={12} color="var(--text-secondary)" /></button>
            )}
            {permDelete !== 'blocked' && (
              <button style={sk2.actionBtn} onClick={() => onDelete(skill)} title="Solicitar remoção"><Trash2 size={12} color="var(--error)" /></button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ======================== ITEM REQUEST MODAL ========================
type ItemFormState = {
  name: string;
  description: string;
  type: ItemType;
  damage: string;
  quantity: number;
};
const defaultItemForm = (): ItemFormState => ({ name: '', description: '', type: 'special', damage: '', quantity: 1 });

function ItemRequestModal({ open, onClose, editing, onSave }: {
  open: boolean;
  onClose: () => void;
  editing: CharacterItem | null;
  onSave: (form: ItemFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<ItemFormState>(() => editing
    ? { name: editing.name, description: editing.description, type: editing.type, damage: editing.damage ?? '', quantity: editing.quantity }
    : defaultItemForm()
  );
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    setForm(editing
      ? { name: editing.name, description: editing.description, type: editing.type, damage: editing.damage ?? '', quantity: editing.quantity }
      : defaultItemForm()
    );
  }, [editing, open]);

  const handleSubmit = async () => {
    if (!form.name.trim()) return alert('Nome obrigatório');
    setSaving(true);
    try { await onSave(form); onClose(); }
    catch (err: any) { alert(err.message); }
    finally { setSaving(false); }
  };

  const label: Record<string, React.CSSProperties> = {
    display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '5px',
  } as any;
  const input: React.CSSProperties = {
    width: '100%', padding: '8px 10px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)',
    color: 'var(--text-primary)', fontSize: '13px', boxSizing: 'border-box',
  };
  const TYPE_OPTIONS: { value: ItemType; label: string }[] = [
    { value: 'weapon', label: 'Arma' },
    { value: 'vest', label: 'Veste' },
    { value: 'consumable', label: 'Consumível' },
    { value: 'special', label: 'Especial' },
  ];

  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Solicitar edição de item' : 'Solicitar novo item'} width={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div>
          <label style={label}>Nome</label>
          <input style={input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nome do item" />
        </div>
        <div>
          <label style={label}>Tipo</label>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {TYPE_OPTIONS.map(opt => {
              const active = form.type === opt.value;
              const color = ITEM_TYPE_COLORS[opt.value];
              return (
                <button key={opt.value} type="button"
                  style={{ padding: '6px 12px', borderRadius: 'var(--radius)', border: `1px solid ${active ? color : 'var(--border)'}`, background: active ? `${color}18` : 'var(--bg-elevated)', color: active ? color : 'var(--text-secondary)', fontSize: '12px', fontWeight: active ? 600 : 400, cursor: 'pointer' }}
                  onClick={() => setForm(f => ({ ...f, type: opt.value }))}>
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>
        {form.type === 'weapon' && (
          <div>
            <label style={label}>Dano</label>
            <input style={input} value={form.damage} onChange={e => setForm(f => ({ ...f, damage: e.target.value }))} placeholder="ex: 2d6+3" />
          </div>
        )}
        <div>
          <label style={label}>Descrição</label>
          <textarea style={{ ...input, resize: 'vertical' } as any} value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} placeholder="Descrição do item..." />
        </div>
        <div>
          <label style={label}>Quantidade</label>
          <input type="number" min={1} style={{ ...input, width: 80 }} value={form.quantity}
            onChange={e => setForm(f => ({ ...f, quantity: Math.max(1, Number(e.target.value)) }))} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '4px' }}>
          <button style={sk.btnSecondary} onClick={onClose}>Cancelar</button>
          <button style={{ ...sk.btnPrimary, opacity: saving ? 0.7 : 1 }} onClick={handleSubmit} disabled={saving}>
            {saving ? 'Enviando...' : 'Enviar solicitação'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ======================== PLAYER VIEW ========================

export default function PlayerView() {
  useTitle('Visao do Jogador');

  const [player, setPlayer] = useState<Player | null>(() => {
    const saved = localStorage.getItem('rpg_player_session');
    if (!saved) return null;
    try { return JSON.parse(saved) as Player; } catch { return null; }
  });
  const [connected, setConnected] = useState(false);
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editCharOpen, setEditCharOpen] = useState(false);
  const [editResOpen, setEditResOpen] = useState(false);
  const [skillModalOpen, setSkillModalOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<Skill | null>(null);
  const [skillForm, setSkillForm] = useState<CreateSkillDTO>({ icon: 'Star', iconColor: '#6366f1', title: '', description: '', visibility: 'private', skillType: 'passive', resourceEffect: [], tags: [], usesLimit: null, usesLimitType: null });
  const { getResourceDefs: getResourceDefsEarly } = useApp();
  const resourceKeys = getResourceDefsEarly().map((r) => r.key);
  const [resEffects, setResEffects] = useState<ResEffectsForm>(() => defaultResEffects(resourceKeys));
  const [savingSkill, setSavingSkill] = useState(false);
  const [sentMsg, setSentMsg] = useState<'free' | 'request' | null>(null);
  const [tab, setTab] = useState<'skills' | 'inventory' | 'equipped'>('skills');
  const [reviewNotifs, setReviewNotifs] = useState<CharacterRequest[]>([]);

  // Item request state
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [useConfirm, setUseConfirm] = useState<{ item: CharacterItem; qty: number } | null>(null);
  const [combatRailOpen, setCombatRailOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth > 780);
  const [effPopover, setEffPopover] = useState<PopoverTarget | null>(null);
  const [itemEffectTarget, setItemEffectTarget] = useState<ItemEffectTarget | null>(null);
  const [mapOverlayOpen, setMapOverlayOpen] = useState(false);
  const [mapQueueOpen, setMapQueueOpen] = useState(false);
  const [gameMap, setGameMap] = useState<GameMap | null>(null);
  const [editingItem, setEditingItem] = useState<CharacterItem | null>(null);

  const {
    characters, dispatch, activeCombat, campaign, effectTemplates, itemTemplates, grimorios,
    getResourceDefs, getProtectionDefs, getConditionDefs, getResourceLabel, getResourceColor,
  } = useApp();
  const globalPerms = campaign?.globalPermissions;
  const [grimModalId, setGrimModalId] = React.useState<string | null>(null);

  const myCharacters = player ? characters.filter(c => c.playerId === player.id && c.type === 'pc') : [];

  // Load map when combat mapId changes
  React.useEffect(() => {
    if (!activeCombat?.mapId) { setGameMap(null); return; }
    api.maps.list().then(list => setGameMap(list.find(m => m.id === activeCombat.mapId) ?? null));
  }, [activeCombat?.mapId]);

  // Sync map in real-time when GM edits it
  React.useEffect(() => {
    const socket = getSocket();
    const handler = (updatedMap: GameMap) => {
      setGameMap(prev => prev?.id === updatedMap.id ? updatedMap : prev);
    };
    socket.on('map:updated', handler);
    return () => { socket.off('map:updated', handler); };
  }, []);

  // Prevent background scroll when map overlay is open (mobile fix)
  React.useEffect(() => {
    if (mapOverlayOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mapOverlayOpen]);
  const rawCharIndex = myCharacters.findIndex(c => c.id === selectedCharId);
  const charIndex = rawCharIndex >= 0 ? rawCharIndex : 0;
  const character = myCharacters[charIndex] ?? null;
  const resourceDefs = getResourceDefs(character?.sheetTypeId);
  const protectionDefs = getProtectionDefs(character?.sheetTypeId);
  const conditionDefs = getConditionDefs(character?.sheetTypeId);

  // Permissão efetiva de cada ação, resolvida uma vez (override do personagem →
  // padrão da campanha → default embutido). Handlers e render leem daqui.
  const perms = React.useMemo(
    () => Object.fromEntries(
      PLAYER_ACTION_KEYS.map((k) => [k, getPermission(character?.playerPermissions, k, globalPerms)]),
    ) as Record<PlayerActionKey, ActionPermission>,
    [character?.playerPermissions, globalPerms],
  );
  const myParticipantUid = activeCombat?.participants.find(p => p.characterId === character?.id)?.uid ?? undefined;
  const isMyTurn = !!myParticipantUid && myParticipantUid === activeCombat?.participants[activeCombat.currentIndex]?.uid;

  // Socket setup
  React.useEffect(() => {
    if (!player) return;
    const socket = getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onCharUpdated = (char: Character) => { dispatch({ type: 'UPDATE_CHARACTER', payload: char }); };
    const onCharRemoved = ({ id }: { id: string }) => { dispatch({ type: 'REMOVE_CHARACTER', payload: id }); };
    const onRequestReviewed = (req: CharacterRequest) => {
      if (req.playerId === player.id) setReviewNotifs(prev => [...prev, req]);
    };
    // Marca o jogador como online no painel do mestre (e de novo a cada reconexao).
    const join = () => socket.emit('player:join', { playerId: player.id });
    socket.on('connect', onConnect);
    socket.on('connect', join);
    socket.on('disconnect', onDisconnect);
    setConnected(socket.connected);
    if (socket.connected) join();
    socket.on('character:updated', onCharUpdated);
    socket.on('character:removed', onCharRemoved);
    socket.on('request:reviewed', onRequestReviewed);
    return () => {
      socket.off('connect', onConnect);
      socket.off('connect', join);
      socket.off('disconnect', onDisconnect);
      socket.off('character:updated', onCharUpdated);
      socket.off('character:removed', onCharRemoved);
      socket.off('request:reviewed', onRequestReviewed);
    };
  }, [player]);

  const handleLogin = (p: Player) => {
    localStorage.setItem('rpg_player_session', JSON.stringify(p));
    setPlayer(p);
  };
  const handleLogout = () => {
    localStorage.removeItem('rpg_player_session');
    setPlayer(null);
  };

  // Ações livres não passam pelo mestre — dizer "solicitação enviada" nelas era
  // simplesmente falso, e é o que fazia o jogador achar que tudo precisa de aval.
  const showSent = (mode: 'free' | 'request' = 'request') => {
    setSentMsg(mode);
    setTimeout(() => setSentMsg(null), 2500);
  };

  const dismissReview = (id: string) => setReviewNotifs(prev => prev.filter(n => n.id !== id));

  const recordFree = async (type: string, description: string, payload: any) => {
    if (!character || !player) return;
    try {
      const req = await api.requests.recordFree({ characterId: character.id, playerId: player.id, playerName: player.name, type: type as any, description, payload });
      dispatch({ type: 'ADD_REQUEST', payload: req });
    } catch { /* non-critical audit trail */ }
  };

  const sendRequest = async (type: string, description: string, payload: any) => {
    if (!character || !player) return;
    await api.requests.create({ characterId: character.id, playerId: player.id, playerName: player.name, type, description, payload } as any);
    showSent();
  };

  const handleTriggerSkill = async (skill: Skill) => {
    if (!character || !player) return;
    const perm = perms.skill_use;
    // "Bloqueado" nunca vira solicitação: a UI já esconde o botão, e esta guarda
    // fecha o caminho caso o estado da tela esteja defasado.
    if (perm === 'blocked') return;
    const description = `${character.name} engatilhou ${skill.title}`;
    const payload = { skillId: skill.id, skillTitle: skill.title, resourceEffect: skill.resourceEffect };
    if (perm === 'free') {
      const updated = await api.skills.trigger(character.id, skill.id);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      recordFree('skill_trigger', description, payload);
      showSent('free');
    } else {
      await sendRequest('skill_trigger', description, payload);
    }
  };

  const handleUseSkill = async (skill: Skill) => {
    if (!character) return;
    const perm = perms.skill_use;
    if (perm === 'blocked') return;
    const description = `${character.name} gastou um uso de ${skill.title}`;
    const payload = { skillId: skill.id, skillTitle: skill.title };
    try {
      if (perm === 'free') {
        const updated = await api.skills.use(character.id, skill.id);
        dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
        recordFree('skill_charge', description, payload);
      } else {
        await sendRequest('skill_charge', description, payload);
      }
    } catch (err: any) { alert(err.message); }
  };

  const handleRest = async () => {
    if (!character) return;
    const perm = perms.rest;
    if (perm === 'blocked') return;
    const description = `${character.name} descansou`;
    try {
      if (perm === 'free') {
        const updated = await api.characters.rest(character.id);
        dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
        recordFree('rest', description, {});
      } else {
        await sendRequest('rest', `${character.name} solicitou descanso`, {});
      }
    } catch (err: any) { alert(err.message); }
  };

  const handleSaveResourcesRequest = async (cur: Record<string, number>) => {
    if (!character) return;
    const payload = {
      previousResources: character.currentResources,
      currentResources: cur,
      maxResources: Object.fromEntries(
        Object.keys(character.resources).map((k) => [k, character.resources[k] + getEquippedBonus(character.items, resourceMaxStat(k))])
      ),
    };
    const perm = perms.resource_change;
    if (perm === 'blocked') return;
    if (perm === 'free') {
      const updated = await api.characters.update(character.id, { currentResources: cur });
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      recordFree('resource_change', `${character.name} alterou recursos`, payload);
      showSent('free');
    } else {
      const description = `${character.name} solicitou alteração de recursos`;
      await sendRequest('resource_change', description, payload);
    }
    setEditResOpen(false);
  };

  const handleConditionChange = async (key: string, stateId: string) => {
    if (!character) return;
    const def = conditionDefs.find((c) => c.key === key);
    const stateLabel = def?.states.find((st) => st.id === stateId)?.label ?? stateId;
    const description = `${character.name} alterou ${def?.label ?? key} para "${stateLabel}"`;
    const payload = {
      previousConditions: character.conditions,
      conditions: { ...character.conditions, [key]: stateId },
    };
    const perm = perms.resource_change;
    if (perm === 'blocked') return;
    if (perm === 'free') {
      const updated = await api.characters.update(character.id, { conditions: { [key]: stateId } });
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      recordFree('resource_change', description, payload);
      showSent('free');
    } else {
      await sendRequest('resource_change', description, payload);
    }
  };

  const handleEditCharRequest = async (dto: any) => {
    if (!character) return;
    const perm = perms.character_update;
    if (perm === 'blocked') return;
    const payload = { character: dto, previousCharacter: character };
    if (perm === 'free') {
      const updated = await api.characters.update(character.id, dto);
      dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
      recordFree('character_update', `${character.name} editou a própria ficha`, payload);
      showSent('free');
    } else {
      await sendRequest('character_update', `${character.name} solicitou edição de personagem`, payload);
    }
    setEditCharOpen(false);
  };

  // ---- Skill handlers ----
  const openCreateSkill = () => {
    setEditingSkill(null);
    setSkillForm({ icon: 'Star', iconColor: '#6366f1', title: '', description: '', visibility: 'private', skillType: 'passive', resourceEffect: [], tags: [], usesLimit: null, usesLimitType: null });
    setResEffects(defaultResEffects(resourceDefs.map((r) => r.key)));
    setSkillModalOpen(true);
  };
  const openEditSkill = (skill: Skill) => {
    setEditingSkill(skill);
    setSkillForm({ icon: skill.icon, iconColor: skill.iconColor, title: skill.title, description: skill.description, visibility: skill.visibility, skillType: skill.skillType, resourceEffect: skill.resourceEffect, tags: skill.tags ?? [], usesLimit: skill.usesLimit ?? null, usesLimitType: skill.usesLimitType ?? null });
    setResEffects(applyResEffects(skill.resourceEffect ?? [], resourceDefs.map((r) => r.key)));
    setSkillModalOpen(true);
  };

  const handleSaveSkillRequest = async () => {
    if (!skillForm.title.trim()) return alert('Título obrigatório');
    if (!character || !player) return;
    setSavingSkill(true);
    const computedRE = buildResourceEffect(resEffects);
    const finalForm = { ...skillForm, resourceEffect: computedRE };
    try {
      if (editingSkill) {
        const perm = perms.skill_update;
        if (perm === 'blocked') return;
        const description = `${character.name} editou a habilidade ${editingSkill.title}`;
        const payload = { skillId: editingSkill.id, previousSkill: editingSkill, skill: finalForm };
        if (perm === 'free') {
          await api.skills.update(character.id, editingSkill.id, finalForm);
          recordFree('skill_update', description, payload);
        } else {
          await sendRequest('skill_update', description, payload);
        }
      } else {
        const perm = perms.skill_create;
        if (perm === 'blocked') return;
        const description = `${character.name} adicionou a habilidade ${finalForm.title}`;
        const payload = { skill: finalForm };
        if (perm === 'free') {
          await api.skills.create(character.id, finalForm);
          recordFree('skill_create', description, payload);
        } else {
          await sendRequest('skill_create', description, payload);
        }
      }
      setSkillModalOpen(false);
    } catch (err: any) { alert(err.message); }
    finally { setSavingSkill(false); }
  };

  const handleDeleteSkillRequest = async (skill: Skill) => {
    if (!character) return;
    const perm = perms.skill_delete;
    if (perm === 'blocked') return;
    const payload = {
      skillId: skill.id,
      skill: { icon: skill.icon, iconColor: skill.iconColor, title: skill.title, description: skill.description, skillType: skill.skillType, resourceEffect: skill.resourceEffect, tags: skill.tags },
    };
    // Confirma nos dois caminhos: apagar direto (permissão livre) é justamente o
    // caso em que não há mestre revisando antes.
    const ask = perm === 'free' ? `Remover "${skill.title}"?` : `Solicitar remoção de "${skill.title}"?`;
    if (!confirm(ask)) return;
    if (perm === 'free') {
      await api.skills.delete(character.id, skill.id);
      recordFree('skill_delete', `${character.name} removeu a habilidade ${skill.title}`, payload);
    } else {
      await sendRequest('skill_delete', `${character.name} removeu a habilidade ${skill.title}`, payload);
    }
  };

  // ---- Item request handlers ----
  const openAddItem = () => { setEditingItem(null); setItemModalOpen(true); };
  const openEditItem = (item: CharacterItem) => { setEditingItem(item); setItemModalOpen(true); };

  const handleItemSave = async (form: ItemFormState) => {
    if (!character) return;
    if (editingItem) {
      const perm = perms.item_update;
      if (perm === 'blocked') return;
      const dto = { name: form.name, description: form.description, type: form.type, damage: form.damage || undefined, quantity: form.quantity };
      if (perm === 'free') {
        await api.characterItems.update(character.id, editingItem.id, dto);
        const desc = `${character.name} editou "${editingItem.name}"`;
        recordFree('item_update', desc, { itemId: editingItem.id, item: dto });
        showSent('free');
      } else {
        const description = `${character.name} solicitou edição de "${editingItem.name}"`;
        await sendRequest('item_update', description, { itemId: editingItem.id, item: dto });
      }
    } else {
      const perm = perms.item_add;
      if (perm === 'blocked') return;
      const dto = { name: form.name, description: form.description, type: form.type, damage: form.damage || undefined, quantity: form.quantity, effects: [] };
      if (perm === 'free') {
        await api.characterItems.add(character.id, dto);
        const desc = `${character.name} adicionou "${form.name}"`;
        recordFree('item_add', desc, { item: dto });
        showSent('free');
      } else {
        const description = `${character.name} solicitou adição de "${form.name}"`;
        await sendRequest('item_add', description, { item: dto });
      }
    }
  };

  const handleEquipToggle = async (item: CharacterItem) => {
    if (!character) return;
    const perm = perms.item_equip;
    if (perm === 'blocked') return;
    const newEquipped = !item.equipped;
    if (perm === 'free') {
      await api.characterItems.update(character.id, item.id, { equipped: newEquipped });
      const action = newEquipped ? 'equipou' : 'desequipou';
      recordFree('item_equip', `${character.name} ${action} "${item.name}"`, { itemId: item.id, equipped: newEquipped });
    } else {
      const action = newEquipped ? 'equipar' : 'desequipar';
      await sendRequest('item_equip', `${character.name} solicitou ${action} "${item.name}"`, { itemId: item.id, equipped: newEquipped });
    }
  };

  const handleRemoveItemRequest = async (item: CharacterItem) => {
    if (!character) return;
    const perm = perms.item_remove;
    if (perm === 'blocked') return;
    // A pergunta vem depois da permissão: bloqueado não deve nem abrir o diálogo.
    const ask = perm === 'free' ? `Remover "${item.name}"?` : `Solicitar remoção de "${item.name}"?`;
    if (!confirm(ask)) return;
    if (perm === 'free') {
      await api.characterItems.remove(character.id, item.id);
      recordFree('item_remove', `${character.name} removeu "${item.name}"`, { itemId: item.id });
    } else {
      await sendRequest('item_remove', `${character.name} solicitou remoção de "${item.name}"`, { itemId: item.id });
    }
  };

  const handleUseConsumable = (item: CharacterItem) => {
    setUseConfirm({ item, qty: 1 });
  };

  const confirmUseConsumable = async () => {
    if (!character || !useConfirm) return;
    const { item, qty } = useConfirm;
    setUseConfirm(null);
    const perm = perms.item_use;
    if (perm === 'blocked') return;
    if (perm === 'free') {
      const result = await api.characterItems.use(character.id, item.id, qty);
      const desc = result.item === null
        ? `${character.name} consumiu "${item.name}" ×${qty} (esgotado)`
        : `${character.name} usou "${item.name}" ×${qty}`;
      recordFree('item_use', desc, { itemId: item.id, quantity: qty, itemName: item.name });
      showSent('free');
    } else {
      await sendRequest(
        'item_use',
        `${character.name} solicitou usar "${item.name}" ×${qty}`,
        { itemId: item.id, quantity: qty, itemName: item.name },
      );
    }
  };

  const handleCharCreated = (char: Character) => {
    dispatch({ type: 'UPDATE_CHARACTER', payload: char });
    setSelectedCharId(char.id);
    setCreateOpen(false);
  };

  const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 780px)').matches;

  if (!player) return <PlayerLogin onLogin={handleLogin} />;

  return (
    <div className="pv-shell">
      {/* Header */}
      <div style={styles.header}>
        <div style={styles.headerLeft}>
          <EvaLogo size={28} withText={false} />
          <span style={styles.badge}>Visao do Jogador</span>
        </div>
        <div style={styles.headerRight}>
          <div style={styles.statusRow}>
            {connected
              ? <><Wifi size={13} color="var(--success)" /><span style={{ color: 'var(--success)', fontSize: '12px' }}>Conectado</span></>
              : <><WifiOff size={13} color="var(--text-muted)" /><span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>Sem conexao</span></>}
          </div>
          <div style={{ ...styles.playerChip, borderColor: player.color }}>
            <div style={{ ...styles.chipDot, background: player.color }} />
            <span style={{ ...styles.chipName, color: player.color }}>{player.name}</span>
            <button style={styles.logoutBtn} onClick={handleLogout} title="Sair"><LogOut size={13} color="var(--text-muted)" /></button>
          </div>
        </div>
      </div>

      {/* Sent notification */}
      {sentMsg && (
        <div style={sent.wrapper}><SentBadge mode={sentMsg} /></div>
      )}

      {/* Review notifications */}
      {reviewNotifs.length > 0 && (
        <div style={notif.stack}>
          {reviewNotifs.map((n) => {
            const approved = n.status === 'approved';
            const color = approved ? '#22c55e' : '#ef4444';
            const Icon = approved ? CheckCircle : XCircle;
            return (
              <div key={n.id} style={{ ...notif.card, borderColor: color }}>
                <div style={notif.cardHeader}>
                  <Icon size={15} color={color} />
                  <span style={{ ...notif.title, color }}>{approved ? 'Solicitação aprovada' : 'Solicitação negada'}</span>
                  <button style={notif.closeBtn} onClick={() => dismissReview(n.id)}><X size={12} color="var(--text-muted)" /></button>
                </div>
                <p style={notif.desc}>{n.description}</p>
                <RequestDiff req={n} sheetTypeId={character?.sheetTypeId} />
              </div>
            );
          })}
        </div>
      )}

      {/* Character switcher */}
      {myCharacters.length > 1 && (
        <div style={styles.charBar}>
          <button style={styles.arrowBtn} onClick={() => setSelectedCharId(myCharacters[Math.max(0, charIndex - 1)].id)} disabled={charIndex === 0}><ChevronLeft size={16} /></button>
          <div style={styles.charTabs}>
            {myCharacters.map((c) => (
              <button key={c.id} style={{ ...styles.charTab, ...(c.id === character?.id ? styles.charTabActive : {}) }} onClick={() => setSelectedCharId(c.id)}>
                {c.avatar
                  ? <img src={c.avatar} alt={c.name} style={{ ...styles.tabAvatar, objectPosition: c.avatarPosition }} />
                  : <div style={{ ...styles.tabAvatarFallback, background: `${player.color}30` }}><span style={{ color: player.color, fontWeight: 700, fontSize: '11px' }}>{c.name.charAt(0)}</span></div>}
                <span style={styles.tabName}>{c.name}</span>
              </button>
            ))}
          </div>
          <button style={styles.arrowBtn} onClick={() => setSelectedCharId(myCharacters[Math.min(myCharacters.length - 1, charIndex + 1)].id)} disabled={charIndex === myCharacters.length - 1}><ChevronRight size={16} /></button>
        </div>
      )}

      {/* No character */}
      {myCharacters.length === 0 && (
        <div style={styles.empty}>
          <div style={{ ...styles.emptyAvatar, background: `${player.color}20`, border: `2px solid ${player.color}` }}>
            <span style={{ color: player.color, fontSize: '28px', fontWeight: 700 }}>{player.name.charAt(0).toUpperCase()}</span>
          </div>
          <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '16px' }}>Ola, {player.name}!</p>
          <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum personagem ainda. Crie o seu ou aguarde o Mestre.</p>
          <button style={styles.createBtn} onClick={() => setCreateOpen(true)}><Plus size={15} /> Criar meu personagem</button>
        </div>
      )}

      {/* Character sheet — two-column layout */}
      {character && (
        <div className="pv-body">
          {/* LEFT COLUMN */}
          <div className="pv-left">
            {/* Hero */}
            <div style={styles.hero}>
              <div style={styles.heroAvatarWrap}>
                {character.avatar
                  ? <img src={character.avatar} alt={character.name} style={{ ...styles.heroImg, objectPosition: character.avatarPosition ?? '50% 50%' }} />
                  : <div style={{ ...styles.heroFallback, background: `${player.color}20` }}><span style={{ color: player.color, fontSize: '28px', fontWeight: 700 }}>{character.name.charAt(0)}</span></div>}
              </div>
              <div style={styles.heroInfo}>
                <h1 style={styles.heroName}>{character.name}</h1>
                <div style={styles.heroPlayer}>
                  <span style={{ ...styles.playerDot, background: player.color }} />
                  <span style={{ color: player.color, fontWeight: 600, fontSize: '13px' }}>{player.name}</span>
                </div>
                {character.description && <p style={styles.heroDesc}>{character.description}</p>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flexShrink: 0 }}>
                {perms.character_update !== 'blocked' && (
                  <button
                    style={styles.addCharBtn}
                    onClick={() => setEditCharOpen(true)}
                    title={perms.character_update === 'free' ? 'Editar ficha' : 'Solicitar edição'}
                  >
                    <Edit2 size={13} /><span style={{ fontSize: '12px' }}>Editar</span>
                  </button>
                )}
                {myCharacters.length < 3 && (
                  <button style={styles.addCharBtn} onClick={() => setCreateOpen(true)} title="Criar novo"><Plus size={13} /><span style={{ fontSize: '12px' }}>Novo</span></button>
                )}
              </div>
            </div>

            {/* Recursos */}
            {resourceDefs.length > 0 && (
              <div style={styles.card}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <h3 style={{ ...styles.cardTitle, margin: 0 }}>Recursos</h3>
                  {perms.resource_change !== 'blocked' && (
                    <button style={styles.addSkillBtn} onClick={() => setEditResOpen(true)} title="Solicitar alteração"><Edit2 size={13} color="var(--text-secondary)" /></button>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
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
                <ProtectionsDisplay character={character} compact />
              </div>
            )}

            {/* Condições */}
            {conditionDefs.length > 0 && (
              <div style={styles.card}>
                <h3 style={{ ...styles.cardTitle, marginBottom: '12px' }}>Condições</h3>
                <ConditionsDisplay
                  character={character}
                  defs={conditionDefs}
                  onChange={perms.resource_change !== 'blocked' ? handleConditionChange : undefined}
                />
              </div>
            )}

            {/* Atributos */}
            {character.attributes.length > 0 && (
              <div style={styles.card}>
                <h3 style={styles.cardTitle}>Atributos</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {character.attributes.map((attr) => (
                    <div key={attr.id} style={styles.attrRow}>
                      <span style={{ ...styles.attrDot, background: ATTRIBUTE_RATING_COLORS[attr.rating] }} />
                      <span style={styles.attrName}>{attr.name}</span>
                      <span style={{ color: ATTRIBUTE_RATING_COLORS[attr.rating], fontSize: '12px', fontWeight: 600 }}>{ATTRIBUTE_RATING_LABELS[attr.rating]}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Inspirações — sempre por ultimo */}
            <div style={styles.card}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500 }}>Inspirações</span>
                  <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>{character.inspiration}</div>
                </div>
                {perms.resource_change !== 'blocked' && character.inspiration > 0 && (
                  <button
                    style={styles.addSkillBtn}
                    title="Gastar 1 inspiração"
                    onClick={async () => {
                      const description = `${character.name} gastou 1 inspiração`;
                      const perm = perms.resource_change;
                      if (perm === 'blocked') return;
                      const payload = { currentResources: character.currentResources, inspiration: character.inspiration - 1 };
                      if (perm === 'free') {
                        const updated = await api.characters.update(character.id, { inspiration: character.inspiration - 1 });
                        dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
                        recordFree('resource_change', description, payload);
                      } else {
                        await sendRequest('resource_change', description, payload);
                      }
                    }}
                  >
                    Gastar 1
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — Sidebar with tabs */}
          <div className="pv-right">
            <div className="pv-tab-bar">
              {([
                { key: 'skills', label: 'Habilidades', count: character.skills.length },
                { key: 'inventory', label: 'Inventário', count: (character.items ?? []).length },
                { key: 'equipped', label: 'Equipados', count: (character.items ?? []).filter(i => i.equipped).length },
              ] as const).map(({ key, label, count }) => (
                <button key={key} className={`pv-tab-btn${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
                  {label}
                  {count > 0 && <span className="pv-tab-count">{count}</span>}
                </button>
              ))}
            </div>

            <div className="pv-tab-content">
              {/* Skills tab */}
              {tab === 'skills' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    {perms.rest !== 'blocked' ? (
                      <button
                        style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer' }}
                        onClick={handleRest}
                        title={perms.rest === 'free'
                          ? 'Descansar — restaura usos por descanso'
                          : 'Solicitar descanso ao Mestre'}
                      >
                        <Moon size={13} /> {perms.rest === 'free' ? 'Descansar' : 'Solicitar descanso'}
                      </button>
                    ) : <span />}
                    {perms.skill_create !== 'blocked' && (
                      <button style={styles.addSkillBtn} onClick={openCreateSkill} title="Solicitar nova habilidade"><Plus size={13} /></button>
                    )}
                  </div>
                  {character.skills.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhuma habilidade.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {character.skills.map((skill) => (
                        <PlayerSkillCard
                          key={skill.id}
                          skill={skill}
                          onTrigger={handleTriggerSkill}
                          onEdit={openEditSkill}
                          onDelete={handleDeleteSkillRequest}
                          onUseSkill={handleUseSkill}
                          permUpdate={perms.skill_update}
                          permDelete={perms.skill_delete}
                          permUse={perms.skill_use}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Inventory tab */}
              {tab === 'inventory' && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{(character.items ?? []).length} item(s)</span>
                    {perms.item_add !== 'blocked' && (
                      <button style={styles.addSkillBtn} onClick={openAddItem} title="Solicitar novo item"><Plus size={13} /></button>
                    )}
                  </div>
                  {(character.items ?? []).length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Nenhum item no inventário.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {(character.items ?? []).map((item) => (
                        <InventoryItemRow
                          key={item.id}
                          item={item}
                          template={item.templateId ? itemTemplates.find(t => t.id === item.templateId) : null}
                          mode="player"
                          effectTemplates={effectTemplates}
                          onEdit={openEditItem}
                          onEquipToggle={handleEquipToggle}
                          onRemove={handleRemoveItemRequest}
                          onUse={handleUseConsumable}
                          onEffectClick={(eff, rect) => setItemEffectTarget(prev => prev?.effect === eff ? null : { effect: eff, rect })}
                          onCatalizadorClick={(grimorioId) => setGrimModalId(grimorioId)}
                          permEquip={perms.item_equip}
                          permUpdate={perms.item_update}
                          permRemove={perms.item_remove}
                          permUse={perms.item_use}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Equipped tab */}
              {tab === 'equipped' && (
                <EquippedView items={character.items ?? []} sheetTypeId={character.sheetTypeId} />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Use consumable confirm modal */}
      {useConfirm && (
        <Modal open={true} onClose={() => setUseConfirm(null)} title={`Usar "${useConfirm.item.name}"`}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>
              {useConfirm.item.description || 'Confirme o uso deste consumível.'}
            </p>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>
                Quantidade a consumir (disponível: {useConfirm.item.quantity})
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  onClick={() => setUseConfirm(prev => prev ? { ...prev, qty: Math.max(1, prev.qty - 1) } : null)}
                  disabled={useConfirm.qty <= 1}
                  style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 16, cursor: useConfirm.qty <= 1 ? 'not-allowed' : 'pointer', opacity: useConfirm.qty <= 1 ? 0.4 : 1 }}
                >−</button>
                <input
                  type="number"
                  min={0}
                  max={useConfirm.item.quantity}
                  value={useConfirm.qty}
                  onChange={e => setUseConfirm(prev => prev ? { ...prev, qty: Math.min(prev.item.quantity, Math.max(0, Number(e.target.value))) } : null)}
                  style={{ width: 60, padding: '6px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 14, textAlign: 'center' }}
                />
                <button
                  onClick={() => setUseConfirm(prev => prev ? { ...prev, qty: Math.min(prev.item.quantity, prev.qty + 1) } : null)}
                  disabled={useConfirm.qty >= useConfirm.item.quantity}
                  style={{ width: 30, height: 30, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', fontSize: 16, cursor: useConfirm.qty >= useConfirm.item.quantity ? 'not-allowed' : 'pointer', opacity: useConfirm.qty >= useConfirm.item.quantity ? 0.4 : 1 }}
                >+</button>
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button style={sk.btnSecondary} onClick={() => setUseConfirm(null)}>Cancelar</button>
              <button style={{ ...sk.btnPrimary, opacity: useConfirm.qty < 1 ? 0.5 : 1 }} disabled={useConfirm.qty < 1} onClick={confirmUseConsumable}>
                {perms.item_use === 'free' ? 'Usar' : 'Solicitar ao Mestre'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Modals */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Criar personagem">
        <CharacterForm defaultType="pc" lockedPlayerId={player.id} onSave={handleCharCreated} onCancel={() => setCreateOpen(false)} />
      </Modal>

      {character && (
        <ResourceEditModal open={editResOpen} onClose={() => setEditResOpen(false)} character={character} onSave={handleSaveResourcesRequest} confirmLabel={perms.resource_change === 'free' ? 'Salvar' : 'Enviar solicitação'} />
      )}

      <Modal open={editCharOpen} onClose={() => setEditCharOpen(false)} title={perms.character_update === 'free' ? 'Editar personagem' : 'Solicitar edição de personagem'}>
        {character && (
          <CharacterForm character={character} lockedPlayerId={player.id} onSave={() => {}} onRequestDTO={handleEditCharRequest} onCancel={() => setEditCharOpen(false)} />
        )}
      </Modal>

      {/* Skill modal */}
      <Modal open={skillModalOpen} onClose={() => setSkillModalOpen(false)} title={editingSkill ? 'Solicitar edição de habilidade' : 'Solicitar nova habilidade'} width={520}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <SkillFormFields
            form={skillForm}
            onChange={(patch) => setSkillForm(f => ({ ...f, ...patch }))}
            resEffects={resEffects}
            onResEffectsChange={setResEffects}
            sheetTypeId={character?.sheetTypeId}
            showVisibility={true}
            titlePlaceholder="Nome da habilidade"
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            <button style={sk.btnSecondary} onClick={() => setSkillModalOpen(false)}>Cancelar</button>
            <button style={{ ...sk.btnPrimary, opacity: savingSkill ? 0.7 : 1 }} onClick={handleSaveSkillRequest} disabled={savingSkill}>
              {savingSkill ? 'Enviando...' : editingSkill ? 'Solicitar edição' : 'Solicitar criação'}
            </button>
          </div>
        </div>
      </Modal>


      {/* ── Map view (full-screen) — queue as floating side panel ── */}
      {mapOverlayOpen && activeCombat && gameMap && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 900, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Nav bar — sits above the map, no overlap */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '8px 10px',
            background: 'var(--bg-surface)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0, zIndex: 10,
          }}>
            <button
              onClick={() => setMapOverlayOpen(false)}
              style={{
                fontSize: 12, fontWeight: 700, padding: '6px 10px',
                background: 'var(--bg-elevated)', border: '1px solid var(--border)',
                borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer',
              }}>← Ficha</button>
            <button
              onClick={() => setMapQueueOpen(v => !v)}
              style={{
                fontSize: 12, fontWeight: 700, padding: '6px 10px',
                background: isMyTurn ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                border: isMyTurn ? '1px solid var(--accent)' : '1px solid var(--border)',
                borderRadius: 8, color: isMyTurn ? 'var(--accent)' : 'var(--text-secondary)',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              }}>
              {isMyTurn ? '🎯 Seu turno' : '⚔ Fila'}
              <span style={{ fontSize: 14, lineHeight: 1 }}>{mapQueueOpen ? '›' : '‹'}</span>
            </button>
          </div>

          {/* Map + floating queue panel */}
          <div style={{ flex: 1, overflow: 'hidden', position: 'relative', display: 'flex' }}>
            <CombatMap
              combat={activeCombat}
              gameMap={gameMap}
              characters={characters}
              isGM={false}
              myParticipantUid={myParticipantUid}
              mapVisibility={activeCombat.mapVisibility ?? 4}
              labelFontSize={typeof window !== 'undefined' && window.innerWidth < 768 ? 15 : 11}
              onAssignNode={async () => {}}
              onMove={async (participantUid, pathId) => {
                const result = await api.combat.move(activeCombat.id, participantUid, pathId);
                dispatch({ type: 'SET_COMBAT', payload: result.session });
              }}
              onUndoMove={async (participantUid) => {
                const s = await api.combat.undoMove(activeCombat.id, participantUid);
                dispatch({ type: 'SET_COMBAT', payload: s });
              }}
            />

            {/* Floating queue panel — slides in from the right */}
            {mapQueueOpen && (
              <div style={{
                position: 'absolute', top: 0, right: 0, bottom: 0, zIndex: 9,
                width: 220,
                background: 'var(--bg-surface)',
                borderLeft: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column',
                boxShadow: '-4px 0 24px rgba(0,0,0,0.45)',
                overflow: 'hidden',
              }}>
                {/* Panel header */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 10px 8px', background: 'var(--accent-dim)',
                  borderBottom: '1px solid var(--border)', flexShrink: 0,
                }}>
                <span style={{ fontSize: 13 }}>⚔</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{activeCombat.name}</div>
                  <div style={{ fontSize: 9, color: 'var(--text-muted)' }}>Turno {activeCombat.globalTurn}</div>
                </div>
                <button onClick={() => setMapQueueOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 4 }}>✕</button>
              </div>
              {isMyTurn && (
                <div style={{ padding: '5px 10px', background: 'var(--accent-dim)', borderBottom: '1px solid var(--border)', textAlign: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)' }}>🎯 Seu turno!</span>
                </div>
              )}
              {/* Participant list */}
              <div style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'thin' }}>
                {activeCombat.participants.map((p, idx) => (
                  <CombatQueueEntry
                    key={p.uid}
                    participant={p}
                    character={characters.find(c => c.id === p.characterId)}
                    isActive={idx === activeCombat.currentIndex}
                    effPopover={effPopover}
                    onEffectClick={(eff, rect) => setEffPopover(prev => prev?.effect.uid === eff.uid ? null : { effect: eff, rect })}
                  />
                ))}
              </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Combat Observer — fixed lateral panel ── */}
      {activeCombat && activeCombat.status === 'active' && (
        <>
        {/* Backdrop — mobile only, dims background */}
        {isMobile && combatRailOpen && (
          <div onClick={() => setCombatRailOpen(false)} style={combatObs.backdrop} />
        )}
        <div style={combatObs.rail}>
          {/* Toggle tab — visible on all screen sizes */}
          <button
            style={combatObs.toggleTab}
            onClick={() => setCombatRailOpen(v => !v)}
            aria-label={combatRailOpen ? 'Fechar fila' : 'Ver fila de combate'}
          >
            <span style={{ fontSize: 13 }}>⚔</span>
            <span style={combatObs.toggleArrow}>{combatRailOpen ? '›' : '‹'}</span>
          </button>

          {/* Panel body */}
          {combatRailOpen && (
          <div style={{ ...combatObs.panelBody, width: isMobile ? '85vw' : 190 }}>
          {/* Header */}
          <div style={combatObs.railHeader}>
            <span style={combatObs.swordIcon}>⚔</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={combatObs.railTitle}>{activeCombat.name}</div>
              <div style={combatObs.railSub}>Turno {activeCombat.globalTurn}</div>
              {gameMap && (
                <button onClick={() => setMapOverlayOpen(v => !v)} style={{
                  marginTop: 4, fontSize: 10, fontWeight: 700, padding: '2px 6px',
                  background: mapOverlayOpen ? 'var(--bg-elevated)' : 'var(--accent-dim)',
                  border: mapOverlayOpen ? '1px solid var(--border)' : '1px solid var(--accent)',
                  borderRadius: 4, color: mapOverlayOpen ? 'var(--text-secondary)' : 'var(--accent)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {mapOverlayOpen ? '← Ver ficha' : `Ver mapa${isMyTurn ? ' (seu turno!)' : ''}`}
                </button>
              )}
            </div>
            <button style={combatObs.closeBtn} onClick={() => setCombatRailOpen(false)}>✕</button>
          </div>

          {/* Queue */}
          <div style={combatObs.list}>
            {activeCombat.participants.map((p, idx) => (
              <CombatQueueEntry
                key={p.uid}
                participant={p}
                character={characters.find(c => c.id === p.characterId)}
                isActive={idx === activeCombat.currentIndex}
                effPopover={effPopover}
                onEffectClick={(eff, rect) => setEffPopover(prev => prev?.effect.uid === eff.uid ? null : { effect: eff, rect })}
              />
            ))}
          </div>
          </div>)}{/* end panelBody */}
        </div>
        </>
      )}

      {/* Effect popover */}
      <EffectPopover target={effPopover} globalTurn={activeCombat?.globalTurn ?? 0} onClose={() => setEffPopover(null)} effectTemplates={effectTemplates} sheetTypeId={character?.sheetTypeId} />
      <ItemEffectPopover target={itemEffectTarget} onClose={() => setItemEffectTarget(null)} sheetTypeId={character?.sheetTypeId} />

      {grimModalId && character && (() => {
        const grim = grimorios.find((g) => g.id === grimModalId);
        if (!grim) return null;
        const perm = perms.spell_cast;
        return (
          <GrimorioSpellModal
            grimorio={grim}
            characterId={character.id}
            permission={perm}
            onClose={() => setGrimModalId(null)}
            onCastSuccess={() => setGrimModalId(null)}
            onCastRequest={(spell) => {
              sendRequest(
                'spell_cast',
                `${character.name} solicitou conjurar "${spell.title}" do Grimório ${grim.name}`,
                { spellId: spell.id, grimorioId: grim.id, spellTitle: spell.title, resourceEffect: spell.resourceEffect },
              );
              setGrimModalId(null);
            }}
          />
        );
      })()}

      {/* Item request modal */}
      <ItemRequestModal open={itemModalOpen} onClose={() => setItemModalOpen(false)} editing={editingItem} onSave={handleItemSave} />
    </div>
  );
}

// ======================== STYLES ========================


const inv: Record<string, any> = {
  equippedChip: { display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', border: '1px solid' },
  chipIcon: { width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  effRow: { padding: '8px 10px', background: 'var(--bg-elevated)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0' },
};

const sk2: Record<string, any> = {
  card: { display: 'flex', gap: '10px', padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', cursor: 'pointer', border: '1px solid transparent', transition: 'border-color var(--transition)' },
  cardTriggered: { boxShadow: '0 0 0 2px var(--accent-dim)' },
  icon: { width: '34px', height: '34px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  top: { display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' },
  title: { flex: 1, fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  activeBadge: { display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '100px', background: 'var(--accent-dim)', color: 'var(--accent)' },
  desc: { fontSize: '12px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '4px 0 0', whiteSpace: 'pre-wrap' },
  expandedRow: { display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid var(--border)' },
  triggerBtn: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: 'var(--radius)', background: 'var(--accent-dim)', border: '1px solid var(--accent)', color: 'var(--accent)', fontSize: '11px', fontWeight: 600, cursor: 'pointer' },
  triggerBtnDone: { background: 'rgba(34,197,94,0.15)', borderColor: '#22c55e', color: '#22c55e' },
  actionBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '3px' },
};

const sent: Record<string, any> = {
  wrapper: { position: 'fixed', bottom: '24px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999 },
  badge: { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', borderRadius: 'var(--radius-lg)', background: 'var(--bg-surface)', border: '1px solid var(--success)', color: 'var(--success)', fontSize: '13px', fontWeight: 600, boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
};

const sk: Record<string, any> = {
  btnPrimary: { padding: '8px 18px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: '13px', fontWeight: 600, cursor: 'pointer' },
  btnSecondary: { padding: '8px 18px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', fontSize: '13px', cursor: 'pointer' },
};

const styles: Record<string, any> = {
  header: { padding: '12px 20px', background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  headerLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '12px' },
  badge: { padding: '2px 8px', borderRadius: '100px', fontSize: '11px', background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 600 },
  statusRow: { display: 'flex', alignItems: 'center', gap: '5px' },
  playerChip: { display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 10px', borderRadius: '100px', border: '1px solid', background: 'var(--bg-elevated)' },
  chipDot: { width: '7px', height: '7px', borderRadius: '50%' },
  chipName: { fontSize: '13px', fontWeight: 600 },
  logoutBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '0 0 0 4px', opacity: 0.6 },
  charBar: { background: 'var(--bg-surface)', borderBottom: '1px solid var(--border)', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: '8px' },
  arrowBtn: { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '4px' },
  charTabs: { display: 'flex', gap: '6px', flex: 1, overflowX: 'auto' },
  charTab: { display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', whiteSpace: 'nowrap' },
  charTabActive: { border: '1px solid var(--accent)', background: 'var(--accent-dim)' },
  tabAvatar: { width: '22px', height: '22px', borderRadius: '4px', objectFit: 'cover' },
  tabAvatarFallback: { width: '22px', height: '22px', borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tabName: { fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' },
  empty: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '14px', padding: '60px', textAlign: 'center' },
  emptyAvatar: { width: '72px', height: '72px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  createBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '7px', padding: '10px 20px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '8px', whiteSpace: 'nowrap' },
  hero: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px', display: 'flex', gap: '16px', alignItems: 'flex-start' },
  heroAvatarWrap: { flexShrink: 0 },
  heroImg: { width: '72px', height: '72px', borderRadius: 'var(--radius)', objectFit: 'cover' },
  heroFallback: { width: '72px', height: '72px', borderRadius: 'var(--radius)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  heroInfo: { flex: 1 },
  heroName: { fontSize: '22px', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' },
  heroPlayer: { display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' },
  playerDot: { width: '8px', height: '8px', borderRadius: '50%' },
  heroDesc: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap' },
  addCharBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap' },
  addSkillBtn: { width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px' },
  cardTitle: { fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 14px' },
  attrRow: { display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', borderBottom: '1px solid var(--border)' },
  attrDot: { width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0 },
  attrName: { flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 },
};


const notif: Record<string, any> = {
  stack: { position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '320px' },
  card: { background: 'var(--bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: '7px' },
  title: { flex: 1, fontSize: '13px', fontWeight: 700 },
  closeBtn: { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px' },
  desc: { fontSize: '12px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 },
};

const combatObs: Record<string, any> = {
  backdrop: {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)', zIndex: 399,
  },
  rail: {
    position: 'fixed', top: '50%', right: 0, transform: 'translateY(-50%)',
    maxHeight: '85vh', display: 'flex', flexDirection: 'row', alignItems: 'center',
    zIndex: 400,
  },
  toggleTab: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
    width: 30, padding: '16px 0',
    background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
    cursor: 'pointer', color: '#fff', flexShrink: 0,
    boxShadow: '-3px 0 14px rgba(0,0,0,0.35)',
  },
  toggleArrow: { fontSize: 18, lineHeight: 1, fontWeight: 700 },
  closeBtn: {
    background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
    fontSize: 14, padding: '0 4px', lineHeight: 1, flexShrink: 0,
  },
  panelBody: {
    width: 190,
    background: 'var(--bg-surface)', border: '1px solid var(--accent)',
    borderRight: 'none', borderRadius: 'var(--radius-lg) 0 0 var(--radius-lg)',
    display: 'flex', flexDirection: 'column', overflow: 'hidden',
    boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
    maxHeight: '85vh',
  },
  railHeader: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '8px 10px', background: 'var(--accent-dim)',
    borderBottom: '1px solid var(--border)', flexShrink: 0,
  },
  swordIcon: { fontSize: 13, flexShrink: 0 },
  railTitle: { fontSize: 11, fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  railSub: { fontSize: 9, color: 'var(--text-muted)' },
  list: { overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: 0, padding: '4px 0', scrollbarWidth: 'thin' },
  entry: {
    display: 'flex', alignItems: 'center', gap: 6,
    padding: '7px 8px', cursor: 'default', transition: 'background 0.15s',
    borderBottom: '1px solid var(--border)',
  },
  entryActive: { background: 'var(--accent-dim)' },
  dot: { width: 5, height: 5, borderRadius: '50%', flexShrink: 0 },
  entryAvatar: {
    width: 28, height: 28, borderRadius: 5,
    background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
};
