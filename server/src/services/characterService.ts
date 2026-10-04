import db from '../database/db';
import {
  Character, Skill, CharacterItem, CreateCharacterDTO, UpdateCharacterDTO, CreateSkillDTO, UpdateSkillDTO,
  Attribute, ResourceMap, SheetConfig, ConditionMap, ConditionDef, PlayerPermissions, CharacterType,
  defaultConditionMap, DEFAULT_SHEET_CONFIG, DEFAULT_DISPLACEMENT, parseSheetConfig,
} from '../types';
import { resourceMaxStat } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logHistory } from './historyService';
import { getItemsForCharacter } from './characterItemService';
import { getEquippedBonus } from '../utils/equippedEffects';

// Exportado para reuso em campaignService.exportCampaign (evita uma segunda copia da mesma mapeadora).
export function rowToSkill(row: any): Skill {
  return {
    id: row.id,
    characterId: row.character_id,
    icon: row.icon,
    iconColor: row.icon_color,
    title: row.title,
    description: row.description,
    visibility: row.visibility,
    skillType: (row.skill_type ?? 'passive') as 'active' | 'passive',
    resourceEffect: (() => { if (!row.resource_effect) return []; const p = JSON.parse(row.resource_effect); return Array.isArray(p) ? p : [p]; })(),
    tags: row.tags ? JSON.parse(row.tags) : [],
    order: row.sort_order,
    usesLimit: row.uses_limit ?? null,
    usesLimitType: row.uses_limit_type ?? null,
    currentUses: row.current_uses ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// Reutilizados por campaignService (export/import) para nao duplicar a logica de parse de cada campo JSON.
export function parseResourceMap(raw: any): ResourceMap {
  if (!raw) return {};
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const out: ResourceMap = {};
    for (const [k, v] of Object.entries(p)) out[k] = Number(v) || 0;
    return out;
  } catch { return {}; }
}

export function parseConditionMap(raw: any): ConditionMap {
  if (!raw) return {};
  try {
    const p = typeof raw === 'string' ? JSON.parse(raw) : raw;
    const out: ConditionMap = {};
    for (const [k, v] of Object.entries(p)) out[k] = String(v);
    return out;
  } catch { return {}; }
}

// Le a config de um sheet type direto do banco (sem importar sheetTypeService, que importa
// este modulo pra reconciliar personagens quando uma config muda — evitaria dependencia circular).
function getSheetTypeConfigById(sheetTypeId: string): SheetConfig {
  const row = db.prepare('SELECT config FROM sheet_types WHERE id = ?').get(sheetTypeId) as any;
  return parseSheetConfig(row?.config);
}

function getDefaultSheetTypeId(): string {
  const row = db.prepare('SELECT id FROM sheet_types WHERE is_default = 1 LIMIT 1').get() as any;
  if (row) return row.id;
  const any = db.prepare('SELECT id FROM sheet_types LIMIT 1').get() as any;
  if (!any) throw new Error('Nenhum tipo de ficha configurado');
  return any.id;
}

// Exportado para reuso em campaignService.exportCampaign — mesma logica de linha->objeto,
// so que la skills/items ja vem pre-filtrados (evita reconsultar o banco por personagem).
export function rowToCharacter(row: any, skills: Skill[], items: CharacterItem[]): Character {
  const resources = row.resources
    ? parseResourceMap(row.resources)
    : { health: row.health, sanity: row.sanity, exposure: row.exposure };
  const currentResources = row.current_resources
    ? parseResourceMap(row.current_resources)
    : {
        health: row.current_health === -1 ? row.health : row.current_health,
        sanity: row.current_sanity === -1 ? row.sanity : row.current_sanity,
        exposure: row.current_exposure === -1 ? row.exposure : row.current_exposure,
      };
  return {
    id: row.id,
    name: row.name,
    type: (row.character_type ?? 'pc') as 'pc' | 'npc',
    playerId: row.player_id,
    avatar: row.avatar,
    avatarPosition: row.avatar_position ?? '50% 50%',
    description: row.description,
    sheetTypeId: row.sheet_type_id,
    resources,
    currentResources,
    protections: parseResourceMap(row.protections),
    conditions: parseConditionMap(row.conditions),
    inspiration: row.inspiration ?? 0,
    attributes: JSON.parse(row.attributes) as Attribute[],
    skills,
    items,
    displacement: row.displacement ?? DEFAULT_DISPLACEMENT,
    playerPermissions: row.player_permissions ? JSON.parse(row.player_permissions) : {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getSkillsForCharacter(characterId: string): Skill[] {
  const rows = db.prepare(
    'SELECT * FROM skills WHERE character_id = ? ORDER BY sort_order ASC'
  ).all(characterId) as any[];
  return rows.map(rowToSkill);
}

export function getAllCharacters(): Character[] {
  const rows = db.prepare('SELECT * FROM characters ORDER BY created_at ASC').all() as any[];
  return rows.map((row) => rowToCharacter(row, getSkillsForCharacter(row.id), getItemsForCharacter(row.id)));
}

export function getCharacterById(id: string): Character | null {
  const row = db.prepare('SELECT * FROM characters WHERE id = ?').get(id) as any;
  if (!row) return null;
  return rowToCharacter(row, getSkillsForCharacter(id), getItemsForCharacter(id));
}

export function validateResources(resources: ResourceMap): void {
  for (const [key, v] of Object.entries(resources)) {
    if (v < 0) console.warn(`[Aviso] Recurso "${key}" negativo: ${v}`);
  }
}

export function setPlayerCharacters(playerId: string, characterIds: string[]): void {
  // Unlink all current PCs of this player
  db.prepare("UPDATE characters SET player_id = NULL WHERE player_id = ? AND character_type = 'pc'").run(playerId);
  // Link the selected ones
  for (const cid of characterIds) {
    db.prepare("UPDATE characters SET player_id = ? WHERE id = ? AND character_type = 'pc'").run(playerId, cid);
  }
}

// Unica fonte da lista de colunas do INSERT em `characters` — reusada por createCharacter aqui,
// e por campaignService.importCampaign / multiCampaignService.createNewCampaign (copia entre
// campanhas), que antes mantinham 3 SQL INSERTs redundantes precisando ser atualizados juntos
// toda vez que um campo do personagem era adicionado/removido.
export interface CharacterInsertRow {
  id: string;
  name: string;
  type: CharacterType;
  playerId: string | null;
  avatar: string | null;
  avatarPosition?: string;
  description: string;
  sheetTypeId: string;
  resources: ResourceMap;
  currentResources: ResourceMap;
  protections: ResourceMap;
  conditions: ConditionMap;
  inspiration: number;
  playerPermissions?: PlayerPermissions;
  displacement?: number;
  attributes: Attribute[];
  createdAt: string;
  updatedAt: string;
}

const INSERT_CHARACTER_SQL =
  'INSERT INTO characters (id, name, character_type, player_id, avatar, avatar_position, description, health, sanity, exposure, current_health, current_sanity, current_exposure, resources, current_resources, protections, conditions, inspiration, player_permissions, displacement, sheet_type_id, attributes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, 0, -1, -1, -1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

export function insertCharacterRow(row: CharacterInsertRow): void {
  db.prepare(INSERT_CHARACTER_SQL).run(
    row.id, row.name, row.type, row.playerId, row.avatar, row.avatarPosition ?? '50% 50%', row.description,
    JSON.stringify(row.resources), JSON.stringify(row.currentResources), JSON.stringify(row.protections),
    JSON.stringify(row.conditions), row.inspiration, JSON.stringify(row.playerPermissions ?? {}),
    row.displacement ?? DEFAULT_DISPLACEMENT, row.sheetTypeId, JSON.stringify(row.attributes), row.createdAt, row.updatedAt,
  );
}

export function createCharacter(dto: CreateCharacterDTO): Character {
  // Enforce max 3 PCs per player
  if (dto.playerId && dto.type !== 'npc') {
    const row = db.prepare("SELECT COUNT(*) as cnt FROM characters WHERE player_id = ? AND character_type = 'pc'").get(dto.playerId) as any;
    if (row.cnt >= 3) throw new Error('Limite de 3 personagens por jogador atingido');
  }
  validateResources(dto.resources);

  const id = uuidv4();
  const now = new Date().toISOString();

  const attributesWithIds: Attribute[] = dto.attributes.map((a) => ({
    ...a,
    id: uuidv4(),
  }));

  const sheetTypeId = dto.sheetTypeId ?? getDefaultSheetTypeId();
  const conditions = dto.conditions ?? defaultConditionMap(getSheetTypeConfigById(sheetTypeId).conditions);
  insertCharacterRow({
    id, name: dto.name, type: dto.type ?? 'pc', playerId: dto.playerId ?? null, avatar: dto.avatar ?? null,
    description: dto.description ?? '', sheetTypeId, resources: dto.resources, currentResources: dto.resources,
    protections: dto.protections ?? {}, conditions, inspiration: dto.inspiration ?? 0,
    attributes: attributesWithIds, createdAt: now, updatedAt: now,
  });

  const character = getCharacterById(id)!;
  logHistory('character:created', `Personagem "${character.name}" criado`, { characterId: id });
  return character;
}

export function updateCharacter(id: string, dto: UpdateCharacterDTO): Character | null {
  const current = getCharacterById(id);
  if (!current) return null;

  const resources = dto.resources ?? current.resources;

  if (dto.resources) validateResources(resources);

  const now = new Date().toISOString();
  const attributesWithIds: Attribute[] = (dto.attributes
    ? dto.attributes.map((a) => ({ ...a, id: uuidv4() }))
    : current.attributes);

  // Quando o maximo de um recurso muda sem um valor atual explicito, mantem o valor atual (nao reseta ao max)
  const newCurrentResources: ResourceMap = dto.currentResources
    ? { ...current.currentResources, ...dto.currentResources }
    : current.currentResources;

  const newProtections: ResourceMap = dto.protections
    ? { ...current.protections, ...dto.protections }
    : current.protections;

  const newConditions: ConditionMap = dto.conditions
    ? { ...current.conditions, ...dto.conditions }
    : current.conditions;

  const newInspiration = dto.inspiration !== undefined ? dto.inspiration : current.inspiration;

  const newPermissions = dto.playerPermissions !== undefined
    ? dto.playerPermissions
    : (current.playerPermissions ?? {});

  const newSheetTypeId = dto.sheetTypeId ?? current.sheetTypeId;
  const sheetTypeChanged = dto.sheetTypeId !== undefined && dto.sheetTypeId !== current.sheetTypeId;

  db.prepare(
    'UPDATE characters SET name = ?, character_type = ?, player_id = ?, avatar = ?, avatar_position = ?, description = ?, sheet_type_id = ?, resources = ?, current_resources = ?, protections = ?, conditions = ?, inspiration = ?, attributes = ?, player_permissions = ?, displacement = ?, updated_at = ? WHERE id = ?'
  ).run(
    dto.name ?? current.name,
    dto.type ?? current.type,
    dto.playerId !== undefined ? dto.playerId : current.playerId,
    dto.avatar !== undefined ? dto.avatar : current.avatar,
    dto.avatarPosition ?? current.avatarPosition,
    dto.description ?? current.description,
    newSheetTypeId,
    JSON.stringify(resources),
    JSON.stringify(newCurrentResources),
    JSON.stringify(newProtections),
    JSON.stringify(newConditions),
    newInspiration,
    JSON.stringify(attributesWithIds),
    JSON.stringify(newPermissions),
    (dto as any).displacement ?? current.displacement ?? DEFAULT_DISPLACEMENT,
    now, id,
  );

  // Personagem trocou de tipo de ficha: reconcilia os mapas dinamicos contra a config do tipo novo
  // (chave que existe nos dois lados preserva o valor; chave nova zera; chave que so existia no tipo antigo some).
  if (sheetTypeChanged) {
    reconcileCharacterToSheetType(id, getSheetTypeConfigById(newSheetTypeId));
  }

  const updated = getCharacterById(id)!;
  logHistory('character:updated', `Personagem "${updated.name}" atualizado`, { characterId: id });
  return updated;
}

// Reconciliacao pura de um Record dinamico contra um novo conjunto de chaves — reusada tanto pela
// cascata de um tipo de ficha inteiro (reconcileCharactersOfType) quanto pela troca de tipo de um
// unico personagem (reconcileCharacterToSheetType).
export function reconcileResourceMap(map: ResourceMap, keys: Iterable<string>): ResourceMap {
  const out: ResourceMap = {};
  for (const k of keys) out[k] = map[k] ?? 0;
  return out;
}

// Chave nova ganha o primeiro estado da escala; chave removida some; estado invalido (removido/renomeado) volta ao primeiro.
export function reconcileConditionMap(map: ConditionMap, defs: ConditionDef[]): ConditionMap {
  const out: ConditionMap = {};
  for (const def of defs) {
    if (def.states.length === 0) continue;
    const current = map[def.key];
    out[def.key] = def.states.some((st) => st.id === current) ? current : def.states[0].id;
  }
  return out;
}

/** Reconcilia um unico personagem (ja gravado) contra a config do tipo de ficha que acabou de assumir. */
export function reconcileCharacterToSheetType(characterId: string, newConfig: SheetConfig): void {
  const row = db.prepare('SELECT resources, current_resources, protections, conditions FROM characters WHERE id = ?').get(characterId) as any;
  if (!row) return;
  const newResourceKeys = newConfig.resources.map((r) => r.key);
  const newProtectionKeys = newConfig.protections.map((p) => p.key);
  const resources = reconcileResourceMap(parseResourceMap(row.resources), newResourceKeys);
  const currentResources = reconcileResourceMap(parseResourceMap(row.current_resources), newResourceKeys);
  const protections = reconcileResourceMap(parseResourceMap(row.protections), newProtectionKeys);
  const conditions = reconcileConditionMap(parseConditionMap(row.conditions), newConfig.conditions);
  db.prepare('UPDATE characters SET resources = ?, current_resources = ?, protections = ?, conditions = ? WHERE id = ?')
    .run(JSON.stringify(resources), JSON.stringify(currentResources), JSON.stringify(protections), JSON.stringify(conditions), characterId);
}

/**
 * Aplica uma mudanca na config de UM tipo de ficha (add/remove de recurso ou protecao) em cascata
 * a todos os personagens desse tipo: chaves novas ganham valor 0, chaves removidas somem do Record.
 */
export function reconcileCharactersOfType(sheetTypeId: string, newConfig: SheetConfig, oldConfig: SheetConfig): void {
  const oldResourceKeys = new Set(oldConfig.resources.map((r) => r.key));
  const newResourceKeys = new Set(newConfig.resources.map((r) => r.key));
  const oldProtectionKeys = new Set(oldConfig.protections.map((p) => p.key));
  const newProtectionKeys = new Set(newConfig.protections.map((p) => p.key));

  const resourcesChanged = oldResourceKeys.size !== newResourceKeys.size
    || [...oldResourceKeys].some((k) => !newResourceKeys.has(k))
    || [...newResourceKeys].some((k) => !oldResourceKeys.has(k));
  const protectionsChanged = oldProtectionKeys.size !== newProtectionKeys.size
    || [...oldProtectionKeys].some((k) => !newProtectionKeys.has(k))
    || [...newProtectionKeys].some((k) => !oldProtectionKeys.has(k));
  // Compara profundamente: mudanca de estados (add/remove/renomear) dentro de uma condicao existente
  // tambem exige reconciliacao, mesmo que o conjunto de chaves de condicao nao tenha mudado.
  const conditionsChanged = JSON.stringify(oldConfig.conditions) !== JSON.stringify(newConfig.conditions);

  if (!resourcesChanged && !protectionsChanged && !conditionsChanged) return;

  const rows = db.prepare('SELECT id, resources, current_resources, protections, conditions FROM characters WHERE sheet_type_id = ?').all(sheetTypeId) as any[];
  const update = db.prepare('UPDATE characters SET resources = ?, current_resources = ?, protections = ?, conditions = ? WHERE id = ?');
  const tx = db.transaction(() => {
    for (const row of rows) {
      const resources = resourcesChanged ? reconcileResourceMap(parseResourceMap(row.resources), newResourceKeys) : parseResourceMap(row.resources);
      const currentResources = resourcesChanged ? reconcileResourceMap(parseResourceMap(row.current_resources), newResourceKeys) : parseResourceMap(row.current_resources);
      const protections = protectionsChanged ? reconcileResourceMap(parseResourceMap(row.protections), newProtectionKeys) : parseResourceMap(row.protections);
      const conditions = conditionsChanged ? reconcileConditionMap(parseConditionMap(row.conditions), newConfig.conditions) : parseConditionMap(row.conditions);
      update.run(JSON.stringify(resources), JSON.stringify(currentResources), JSON.stringify(protections), JSON.stringify(conditions), row.id);
    }
  });
  tx();
}

export function deleteCharacter(id: string): boolean {
  const character = getCharacterById(id);
  if (!character) return false;
  db.prepare('DELETE FROM characters WHERE id = ?').run(id);
  logHistory('character:deleted', `Personagem "${character.name}" removido`, { characterId: id });
  return true;
}

// === SKILLS ===

export function getSkillById(id: string): Skill | null {
  const row = db.prepare('SELECT * FROM skills WHERE id = ?').get(id) as any;
  return row ? rowToSkill(row) : null;
}

// Unica fonte da lista de colunas do INSERT em `skills` — reusada por createSkill aqui e por
// campaignService.importCampaign / multiCampaignService.createNewCampaign (copia entre campanhas).
// Antes esses dois tinham SQL INSERTs proprios que esqueciam uses_limit/uses_limit_type/current_uses,
// entao importar ou copiar uma campanha apagava o limite de usos configurado em cada habilidade.
export interface SkillInsertRow {
  id: string;
  characterId: string;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  visibility: Skill['visibility'];
  skillType: Skill['skillType'];
  resourceEffect: Skill['resourceEffect'];
  tags: string[];
  order: number;
  usesLimit: number | null;
  usesLimitType: Skill['usesLimitType'];
  currentUses: number | null;
  createdAt: string;
  updatedAt: string;
}

const INSERT_SKILL_SQL =
  'INSERT INTO skills (id, character_id, icon, icon_color, title, description, visibility, skill_type, resource_effect, tags, sort_order, uses_limit, uses_limit_type, current_uses, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

export function insertSkillRow(row: SkillInsertRow): void {
  db.prepare(INSERT_SKILL_SQL).run(
    row.id, row.characterId, row.icon, row.iconColor, row.title, row.description, row.visibility,
    row.skillType ?? 'passive',
    row.resourceEffect && row.resourceEffect.length ? JSON.stringify(row.resourceEffect) : null,
    JSON.stringify(row.tags ?? []),
    row.order, row.usesLimit, row.usesLimitType, row.currentUses, row.createdAt, row.updatedAt,
  );
}

export function createSkill(characterId: string, dto: CreateSkillDTO): Skill {
  const character = getCharacterById(characterId);
  if (!character) throw new Error('Personagem nao encontrado');

  const id = uuidv4();
  const now = new Date().toISOString();
  const maxOrder = (db.prepare(
    'SELECT MAX(sort_order) as max FROM skills WHERE character_id = ?'
  ).get(characterId) as any)?.max ?? -1;

  const usesLimit = dto.usesLimit ?? null;
  insertSkillRow({
    id, characterId, icon: dto.icon, iconColor: dto.iconColor, title: dto.title, description: dto.description,
    visibility: dto.visibility, skillType: dto.skillType ?? 'passive', resourceEffect: dto.resourceEffect ?? [],
    tags: dto.tags ?? [], order: maxOrder + 1, usesLimit, usesLimitType: dto.usesLimitType ?? null,
    currentUses: usesLimit, createdAt: now, updatedAt: now,
  });

  const skill = getSkillById(id)!;
  logHistory('skill:created', `Habilidade "${skill.title}" criada`, { characterId, skillId: id });
  return skill;
}

export function updateSkill(id: string, dto: UpdateSkillDTO): Skill | null {
  const current = getSkillById(id);
  if (!current) return null;
  const now = new Date().toISOString();

  const newUsesLimit = dto.usesLimit !== undefined ? dto.usesLimit : current.usesLimit;
  const newUsesLimitType = dto.usesLimitType !== undefined ? dto.usesLimitType : current.usesLimitType;
  const newCurrentUses = dto.currentUses !== undefined
    ? dto.currentUses
    : (dto.usesLimit !== undefined ? dto.usesLimit : current.currentUses);

  db.prepare(
    'UPDATE skills SET icon = ?, icon_color = ?, title = ?, description = ?, visibility = ?, skill_type = ?, resource_effect = ?, tags = ?, sort_order = ?, uses_limit = ?, uses_limit_type = ?, current_uses = ?, updated_at = ? WHERE id = ?'
  ).run(
    dto.icon ?? current.icon,
    dto.iconColor ?? current.iconColor,
    dto.title ?? current.title,
    dto.description ?? current.description,
    dto.visibility ?? current.visibility,
    dto.skillType ?? current.skillType,
    dto.resourceEffect !== undefined
      ? (dto.resourceEffect ? JSON.stringify(dto.resourceEffect) : null)
      : (current.resourceEffect ? JSON.stringify(current.resourceEffect) : null),
    JSON.stringify(dto.tags ?? current.tags ?? []),
    dto.order !== undefined ? dto.order : current.order,
    newUsesLimit, newUsesLimitType, newCurrentUses,
    now, id,
  );

  return getSkillById(id);
}

export function useSkill(skillId: string): Skill | null {
  const skill = getSkillById(skillId);
  if (!skill || skill.usesLimit === null || skill.currentUses === null || skill.currentUses <= 0) return skill;
  db.prepare('UPDATE skills SET current_uses = ?, updated_at = ? WHERE id = ?')
    .run(skill.currentUses - 1, new Date().toISOString(), skillId);
  return getSkillById(skillId);
}

/**
 * Aplica o custo/ganho de recursos de uma habilidade engatilhada, respeitando 0
 * e o maximo (base + bonus de itens equipados). Usado tanto pela rota direta
 * (permissao "livre") quanto pela aprovacao de uma solicitacao skill_trigger —
 * antes essa conta so existia dentro do fluxo de aprovacao.
 */
export function triggerSkill(characterId: string, skillId: string): Character | null {
  const skill = getSkillById(skillId);
  const char = getCharacterById(characterId);
  if (!char) return null;
  if (!skill?.resourceEffect?.length) return char;

  const cur = { ...char.currentResources };
  for (const eff of skill.resourceEffect) {
    const delta = eff.direction === 'cost' ? -(eff.amount ?? 0) : (eff.amount ?? 0);
    const max = (char.resources[eff.resource] ?? 0) + getEquippedBonus(char.items, resourceMaxStat(eff.resource));
    cur[eff.resource] = Math.min(max, Math.max(0, (cur[eff.resource] ?? 0) + delta));
  }
  updateCharacter(characterId, { currentResources: cur });
  return getCharacterById(characterId);
}

export function restCharacter(characterId: string): void {
  db.prepare(
    "UPDATE skills SET current_uses = uses_limit, updated_at = ? WHERE character_id = ? AND uses_limit_type = 'rest'"
  ).run(new Date().toISOString(), characterId);
  const char = getCharacterById(characterId);
  if (char) logHistory('character:rest', `${char.name} descansou`, { characterId });
}

export function resetCombatSkillsForAll(): void {
  db.prepare(
    "UPDATE skills SET current_uses = uses_limit, updated_at = ? WHERE uses_limit_type = 'combat'"
  ).run(new Date().toISOString());
}

export function deleteSkill(id: string): boolean {
  const skill = getSkillById(id);
  if (!skill) return false;
  db.prepare('DELETE FROM skills WHERE id = ?').run(id);
  logHistory('skill:deleted', `Habilidade "${skill.title}" removida`, { skillId: id });
  return true;
}

export function reorderSkills(characterId: string, orderedIds: string[]): Skill[] {
  const update = db.prepare('UPDATE skills SET sort_order = ?, updated_at = ? WHERE id = ? AND character_id = ?');
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    orderedIds.forEach((skillId, index) => {
      update.run(index, now, skillId, characterId);
    });
  });
  tx();
  return getSkillsForCharacter(characterId);
}
