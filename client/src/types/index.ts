// ============================================================
// Tipos do cliente — espelham os tipos do servidor
// ============================================================

export type AttributeRating = 'excellent' | 'good' | 'normal' | 'bad';
export type SkillVisibility = 'private' | 'public';
export type PlayerPermission = 'player' | 'gm';
export type PlayerStatus = 'online' | 'offline';
export type CharacterType = 'pc' | 'npc';

// Chave estável (nunca muda) -> valor. A chave é gerada uma vez a partir do
// label no momento da criação e persiste mesmo que o label seja renomeado.
export type ResourceMap = Record<string, number>;

/** @deprecated usar ResourceMap */
export type Resource = ResourceMap;
/** @deprecated usar ResourceMap */
export type Protections = ResourceMap;
/** @deprecated usar ResourceMap */
export type CurrentResource = ResourceMap;

export interface Attribute {
  id: string;
  name: string;
  rating: AttributeRating;
}

export interface ResourceDef {
  key: string;
  label: string;
  color: string;
  icon: string;
  /** Valor maximo padrao sugerido ao criar um personagem novo. */
  defaultValue: number;
}

export interface ProtectionDef {
  key: string;
  label: string;
  color: string;
  icon: string;
}

export interface AttributeDef {
  name: string;
  /** Nivel padrao sugerido ao criar um personagem novo. */
  defaultRating: AttributeRating;
}

export interface ConditionState {
  id: string;
  label: string;
}

export interface ConditionDef {
  key: string;
  label: string;
  color: string;
  icon: string;
  /** Escala de estados nomeados, do melhor ao pior (ex: Bem, Mal, Pessimo, Morto). */
  states: ConditionState[];
}

/** Chave da condicao -> id do estado atual do personagem naquela condicao. */
export type ConditionMap = Record<string, string>;

export interface SheetConfig {
  attributes: AttributeDef[];
  resources: ResourceDef[];
  protections: ProtectionDef[];
  conditions: ConditionDef[];
}

/** Um "tipo de ficha" nomeado — a campanha pode ter varios, cada personagem usa um. */
export interface SheetType {
  id: string;
  name: string;
  icon: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  config: SheetConfig;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_SHEET_CONFIG: SheetConfig = {
  attributes: [
    { name: 'Forca', defaultRating: 'excellent' },
    { name: 'Destreza', defaultRating: 'good' },
    { name: 'Acerto', defaultRating: 'good' },
    { name: 'Percepcao', defaultRating: 'good' },
    { name: 'Sabedoria', defaultRating: 'normal' },
    { name: 'Fe', defaultRating: 'normal' },
    { name: 'Espirito', defaultRating: 'bad' },
  ],
  resources: [
    { key: 'health', label: 'Saude', color: '#ef4444', icon: 'Heart', defaultValue: 20 },
    { key: 'sanity', label: 'Sanidade', color: '#3b82f6', icon: 'Brain', defaultValue: 20 },
    { key: 'exposure', label: 'Exposicao', color: '#a855f7', icon: 'Zap', defaultValue: 20 },
  ],
  protections: [
    { key: 'physical', label: 'Fisica', color: '#ef4444', icon: 'Shield' },
    { key: 'mental', label: 'Mental', color: '#3b82f6', icon: 'Shield' },
    { key: 'ethereal', label: 'Eterea', color: '#a855f7', icon: 'Shield' },
  ],
  conditions: [],
};

/** Estado inicial (primeiro de cada escala) para um personagem novo, a partir da config atual. */
export function defaultConditionMap(conditions: ConditionDef[]): ConditionMap {
  const out: ConditionMap = {};
  for (const c of conditions) {
    if (c.states.length > 0) out[c.key] = c.states[0].id;
  }
  return out;
}

/** Deslocamento (m/turno) de um personagem novo, usado em todo fallback `?? DEFAULT_DISPLACEMENT`. */
export const DEFAULT_DISPLACEMENT = 6;

export type SkillType = 'active' | 'passive';

export interface ResourceEffect {
  resource: string;
  amount: number;
  direction: 'cost' | 'gain';
}

export type SkillUsesLimitType = 'combat' | 'rest';

export interface Skill {
  id: string;
  characterId: string;
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  visibility: SkillVisibility;
  skillType: SkillType;
  resourceEffect: ResourceEffect[];
  tags: string[];
  order: number;
  usesLimit: number | null;
  usesLimitType: SkillUsesLimitType | null;
  currentUses: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface SkillTemplate {
  id: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  skillType: SkillType;
  resourceEffect: ResourceEffect[];
  tags: string[];
  usesLimit: number | null;
  usesLimitType: SkillUsesLimitType | null;
  createdAt: string;
  updatedAt: string;
}

// Chaves dinâmicas: `resource:<key>:max`, `resource:<key>:current`, `protection:<key>`,
// mais os sentinels fixos abaixo. Ver getEffectStatLabel() para resolução de label.
export type EffectStat = string;
export const EFFECT_STAT_MOVEMENT = 'movement';
export const EFFECT_STAT_CUSTOM = 'custom';
export const resourceMaxStat = (key: string) => `resource:${key}:max`;
export const resourceCurrentStat = (key: string) => `resource:${key}:current`;
export const protectionStat = (key: string) => `protection:${key}`;
export function parseResourceStat(stat: string): { key: string; field: 'max' | 'current' } | null {
  const m = /^resource:(.+):(max|current)$/.exec(stat);
  return m ? { key: m[1], field: m[2] as 'max' | 'current' } : null;
}
export function parseProtectionStat(stat: string): { key: string } | null {
  const m = /^protection:(.+)$/.exec(stat);
  return m ? { key: m[1] } : null;
}

/** Todas as chaves de stat disponíveis para efeitos, na config atual. */
export function allEffectStats(config: SheetConfig): { value: EffectStat; label: string }[] {
  return [
    ...config.resources.flatMap((r) => [
      { value: resourceMaxStat(r.key), label: `${r.label} max` },
      { value: resourceCurrentStat(r.key), label: `${r.label} atual` },
    ]),
    ...config.protections.map((p) => ({ value: protectionStat(p.key), label: `Prot. ${p.label}` })),
    { value: EFFECT_STAT_MOVEMENT, label: 'Deslocamento' },
    { value: EFFECT_STAT_CUSTOM, label: 'Personalizado' },
  ];
}

/** Resolve o label de exibição de um stat de efeito na config atual (cai para o stat cru se a chave foi removida). */
export function getEffectStatLabel(stat: EffectStat, config: SheetConfig): string {
  const res = parseResourceStat(stat);
  if (res) {
    const def = config.resources.find((r) => r.key === res.key);
    return def ? `${def.label} ${res.field === 'max' ? 'max' : 'atual'}` : stat;
  }
  const prot = parseProtectionStat(stat);
  if (prot) {
    const def = config.protections.find((p) => p.key === prot.key);
    return def ? `Prot. ${def.label}` : stat;
  }
  if (stat === EFFECT_STAT_MOVEMENT) return 'Deslocamento';
  if (stat === EFFECT_STAT_CUSTOM) return 'Personalizado';
  return stat;
}

/** Resolve a cor de exibição de um stat de efeito na config atual. */
export function getEffectStatColor(stat: EffectStat, config: SheetConfig): string {
  const res = parseResourceStat(stat);
  if (res) return config.resources.find((r) => r.key === res.key)?.color ?? 'var(--text-secondary)';
  const prot = parseProtectionStat(stat);
  if (prot) return config.protections.find((p) => p.key === prot.key)?.color ?? 'var(--text-secondary)';
  if (stat === EFFECT_STAT_MOVEMENT) return '#22c55e';
  if (stat === EFFECT_STAT_CUSTOM) return '#6b7280';
  return 'var(--text-secondary)';
}

/**
 * Como allEffectStats, mas agrega Recursos/Protecoes de TODOS os tipos de ficha da campanha, nao so
 * de um. Necessario porque Itens/Efeitos sao entidades globais a campanha (nao pertencem a um tipo de
 * ficha especifico) e um personagem pode equipar/receber qualquer item independente do seu sheetTypeId —
 * um efeito criado olhando so pra config de UM tipo nunca aparece (nem aplica corretamente) em
 * personagens de outro tipo. Quando ha mais de um tipo configurado, prefixa o label com o nome do tipo
 * pra desambiguar campos com nomes iguais em fichas diferentes.
 */
export function allEffectStatsForCampaign(sheetTypes: SheetType[]): { value: EffectStat; label: string }[] {
  const multi = sheetTypes.length > 1;
  const seen = new Set<string>();
  const out: { value: EffectStat; label: string }[] = [];
  const push = (value: string, label: string) => {
    if (seen.has(value)) return;
    seen.add(value);
    out.push({ value, label });
  };
  for (const st of sheetTypes) {
    for (const r of st.config.resources) {
      push(resourceMaxStat(r.key), multi ? `${st.name} — ${r.label} max` : `${r.label} max`);
      push(resourceCurrentStat(r.key), multi ? `${st.name} — ${r.label} atual` : `${r.label} atual`);
    }
    for (const p of st.config.protections) {
      push(protectionStat(p.key), multi ? `${st.name} — Prot. ${p.label}` : `Prot. ${p.label}`);
    }
  }
  push(EFFECT_STAT_MOVEMENT, 'Deslocamento');
  push(EFFECT_STAT_CUSTOM, 'Personalizado');
  return out;
}

/** Resolve o label de um stat de efeito procurando em todos os tipos de ficha da campanha (ver [[allEffectStatsForCampaign]]). */
export function getEffectStatLabelForCampaign(stat: EffectStat, sheetTypes: SheetType[]): string {
  const multi = sheetTypes.length > 1;
  const res = parseResourceStat(stat);
  const prot = res ? null : parseProtectionStat(stat);
  if (res || prot) {
    for (const st of sheetTypes) {
      if (res) {
        const def = st.config.resources.find((r) => r.key === res.key);
        if (def) return multi ? `${st.name} — ${def.label} ${res.field === 'max' ? 'max' : 'atual'}` : `${def.label} ${res.field === 'max' ? 'max' : 'atual'}`;
      } else if (prot) {
        const def = st.config.protections.find((p) => p.key === prot.key);
        if (def) return multi ? `${st.name} — Prot. ${def.label}` : `Prot. ${def.label}`;
      }
    }
    return stat;
  }
  if (stat === EFFECT_STAT_MOVEMENT) return 'Deslocamento';
  if (stat === EFFECT_STAT_CUSTOM) return 'Personalizado';
  return stat;
}

/** Resolve a cor de um stat de efeito procurando em todos os tipos de ficha da campanha (ver [[allEffectStatsForCampaign]]). */
export function getEffectStatColorForCampaign(stat: EffectStat, sheetTypes: SheetType[]): string {
  const res = parseResourceStat(stat);
  const prot = res ? null : parseProtectionStat(stat);
  if (res || prot) {
    for (const st of sheetTypes) {
      if (res) {
        const def = st.config.resources.find((r) => r.key === res.key);
        if (def) return def.color;
      } else if (prot) {
        const def = st.config.protections.find((p) => p.key === prot.key);
        if (def) return def.color;
      }
    }
    return 'var(--text-secondary)';
  }
  if (stat === EFFECT_STAT_MOVEMENT) return '#22c55e';
  if (stat === EFFECT_STAT_CUSTOM) return '#6b7280';
  return 'var(--text-secondary)';
}

export type EffectOperation = 'add' | 'subtract';

export interface EffectApplication {
  stat: EffectStat;
  operation: EffectOperation;
  value: number;
  customName?: string;
}

export interface ItemEffect {
  templateId?: string;
  name: string;
  icon?: string;
  color?: string;
  description: string;
  applications: EffectApplication[];
  duration?: number;
}

export type ItemType = 'weapon' | 'vest' | 'consumable' | 'special';

export interface EffectTemplate {
  id: string;
  name: string;
  icon: string;
  iconColor: string;
  description: string;
  applications: EffectApplication[];
  grimorioId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ItemTemplate {
  id: string;
  name: string;
  description: string;
  type: ItemType;
  icon?: string;
  iconColor?: string;
  damage?: string;
  effects: ItemEffect[];
  createdAt: string;
  updatedAt: string;
}

export interface CharacterItem {
  id: string;
  characterId: string;
  templateId?: string;
  name: string;
  description: string;
  type: ItemType;
  icon?: string;
  iconColor?: string;
  damage?: string;
  effects: ItemEffect[];
  equipped: boolean;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

export type ActionPermission = 'free' | 'request' | 'blocked';
export type PlayerActionKey =
  | 'item_add' | 'item_update' | 'item_equip' | 'item_remove' | 'item_use'
  | 'skill_create' | 'skill_update' | 'skill_delete' | 'skill_use'
  | 'resource_change' | 'rest' | 'spell_cast' | 'character_update';
export type PlayerPermissions = Partial<Record<PlayerActionKey, ActionPermission>>;
export type GlobalPermissions = Record<PlayerActionKey, ActionPermission>;

export const DEFAULT_GLOBAL_PERMISSIONS: GlobalPermissions = {
  item_add: 'request',
  item_update: 'request',
  item_equip: 'free',
  item_remove: 'request',
  item_use: 'request',
  skill_create: 'request',
  skill_update: 'request',
  skill_delete: 'request',
  // Usar a própria habilidade e descansar são o laço básico de jogo — livres por
  // padrão, como conjurar. Editar/criar/apagar a ficha é que passa pelo mestre.
  skill_use: 'free',
  resource_change: 'request',
  rest: 'free',
  spell_cast: 'free',
  character_update: 'request',
};

/**
 * Ordem canônica das ações nos painéis de permissão. Fonte única: antes a ficha
 * do mestre e a tela de Configurações mantinham listas próprias, e a da ficha
 * ficou para trás — "Usar consumível" e "Conjurar feitiço" não apareciam lá.
 */
export const PERMISSION_GROUPS: { label: string; actions: PlayerActionKey[] }[] = [
  { label: 'Em jogo',     actions: ['skill_use', 'spell_cast', 'item_use', 'item_equip', 'resource_change', 'rest'] },
  { label: 'Inventário',  actions: ['item_add', 'item_update', 'item_remove'] },
  { label: 'Habilidades', actions: ['skill_create', 'skill_update', 'skill_delete'] },
  { label: 'Ficha',       actions: ['character_update'] },
];

export const PLAYER_ACTION_KEYS: PlayerActionKey[] = PERMISSION_GROUPS.flatMap((g) => g.actions);

export function getPermission(
  playerPerms: PlayerPermissions | undefined,
  action: PlayerActionKey,
  globalPerms: GlobalPermissions | undefined,
): ActionPermission {
  return playerPerms?.[action] ?? globalPerms?.[action] ?? DEFAULT_GLOBAL_PERMISSIONS[action];
}

export interface Character {
  id: string;
  name: string;
  type: CharacterType;
  playerId: string | null;
  avatar: string | null;
  avatarPosition: string;
  description: string;
  sheetTypeId: string;
  resources: ResourceMap;
  currentResources: ResourceMap;
  protections: ResourceMap;
  conditions: ConditionMap;
  inspiration: number;
  attributes: Attribute[];
  skills: Skill[];
  items: CharacterItem[];
  displacement: number;
  playerPermissions?: PlayerPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface Player {
  id: string;
  name: string;
  characterId: string | null;
  color: string;
  permission: PlayerPermission;
  status: PlayerStatus;
  socketId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Campaign {
  id: string;
  name: string;
  description: string;
  globalPermissions: GlobalPermissions;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEvent {
  id: string;
  type: string;
  description: string;
  metadata: string;
  createdAt: string;
}

export type CharacterRequestStatus = 'pending' | 'approved' | 'denied' | 'free';

export interface CharacterRequest {
  id: string;
  characterId: string;
  playerId: string;
  playerName: string;
  type: string;
  description: string;
  payload: any;
  status: CharacterRequestStatus;
  createdAt: string;
  updatedAt: string;
}

export interface CombatActiveEffect {
  uid: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  applications: EffectApplication[];
  durationRounds: number;
  appliedAtGlobalTurn: number;
  expireAtGlobalTurn: number;
}

export interface DisplacementProgress {
  pathId: string;
  fraction: number;
  direction: 'forward' | 'backward';
}

export interface MoveSnapshot {
  nodeId: string | null;
  remainingDisplacement: number;
  displacementProgress: DisplacementProgress | null;
}

export interface CombatParticipant {
  uid: string;
  characterId: string;
  displayName: string;
  isBossMode: boolean;
  currentResources: ResourceMap;
  activeEffects: CombatActiveEffect[];
  currentNodeId: string | null;
  remainingDisplacement: number;
  displacementProgress: DisplacementProgress | null;
  moveSnapshot: MoveSnapshot | null;
  movementBlocked?: boolean;
}

export type CombatStatus = 'active' | 'ended';

export interface CombatSession {
  id: string;
  name: string;
  status: CombatStatus;
  participants: CombatParticipant[];
  currentIndex: number;
  globalTurn: number;
  mapId: string | null;
  displacementMode: 'rule' | 'open';
  mapVisibility: 1 | 2 | 3 | 4;
  createdAt: string;
  updatedAt: string;
}

export type PathCharacteristic =
  | 'difficult' | 'no_vision' | 'jump' | 'unstable' | 'dangerous' | 'blocked';

export interface MapNode {
  id: string;
  name: string;
  occupancyLimit: number;
  description?: string;
  x: number;
  y: number;
  radius?: number;
}

export interface MapPath {
  id: string;
  sourceId: string;
  targetId: string;
  distance: number;
  characteristics: PathCharacteristic[];
  label?: string;
}

export interface GameMap {
  id: string;
  name: string;
  nodes: MapNode[];
  paths: MapPath[];
  createdAt: string;
  updatedAt: string;
}

export interface ExportData {
  version: string;
  exportedAt: string;
  campaign: Campaign;
  players: Player[];
  characters: Character[];
  itemTemplates?: ItemTemplate[];
  effectTemplates?: EffectTemplate[];
  skillTemplates?: SkillTemplate[];
  maps?: GameMap[];
  grimorios?: Grimorio[];
  campaignEvents?: CampaignEvent[];
  campaignPlaylists?: CampaignPlaylist[];
  campaignGoals?: CampaignGoal[];
  combatSessions?: CombatSession[];
  sheetTypes?: SheetType[];
}

// ── Grimório ──────────────────────────────────────────────────────────────────

export interface GrimorioSpell {
  id: string;
  grimorioId: string;
  title: string;
  description: string;
  icon: string;
  iconColor: string;
  skillType: SkillType;
  resourceEffect: ResourceEffect[];
  tags: string[];
  usesLimit: number | null;
  usesLimitType: SkillUsesLimitType | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Grimorio {
  id: string;
  name: string;
  description: string;
  icon: string;
  iconColor: string;
  catalizadorEffectId: string | null;
  catalizadorEffectName: string | null;
  spells: GrimorioSpell[];
  createdAt: string;
  updatedAt: string;
}

// ── Multi-campaign ─────────────────────────────────────────────────────────

export interface SavedCampaignSummary {
  id: string;
  name: string;
  description: string;
  isCurrent: boolean;
  hasPassword: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignOptions {
  effectTemplates: boolean;
  itemTemplates: boolean;
  skillTemplates: boolean;
  npcs: boolean;
  characters: boolean;
  maps: boolean;
  grimorios: boolean;
  events: boolean;
  playlists: boolean;
  goals: boolean;
}

export interface CreateNewCampaignDTO {
  name: string;
  description?: string;
  password: string;
  saveCurrent: boolean;
  copy: CreateCampaignOptions;
}

export interface ChangeCampaignPasswordDTO {
  currentPassword?: string;
  adminPassword?: string;
  newPassword: string;
}

export interface CampaignAuthResult {
  campaigns: SavedCampaignSummary[];
  isAdminOverride: boolean;
  gmToken: string;
}

export interface CreatePlayerDTO {
  name: string;
  characterId?: string | null;
  color: string;
  permission: PlayerPermission;
}
export interface UpdatePlayerDTO extends Partial<CreatePlayerDTO> {}

export interface CreateCharacterDTO {
  name: string;
  type?: CharacterType;
  playerId?: string | null;
  avatar?: string | null;
  description?: string;
  sheetTypeId?: string;
  resources: ResourceMap;
  attributes: Omit<Attribute, 'id'>[];
  protections?: ResourceMap;
  conditions?: ConditionMap;
  inspiration?: number;
}
export interface UpdateCharacterDTO extends Partial<CreateCharacterDTO> {
  currentResources?: ResourceMap;
  protections?: ResourceMap;
  conditions?: ConditionMap;
  inspiration?: number;
  avatarPosition?: string;
  playerPermissions?: PlayerPermissions;
}

export interface CreateSheetTypeDTO {
  name: string;
  icon?: string;
  color?: string;
  config?: Partial<SheetConfig>;
}

export interface UpdateSheetTypeDTO {
  name?: string;
  icon?: string;
  color?: string;
  config?: Partial<SheetConfig>;
}

export interface CreateSkillDTO {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
  visibility: SkillVisibility;
  skillType?: SkillType;
  resourceEffect?: ResourceEffect[];
  tags?: string[];
  usesLimit?: number | null;
  usesLimitType?: SkillUsesLimitType | null;
}
export interface UpdateSkillDTO extends Partial<CreateSkillDTO> {
  order?: number;
  currentUses?: number | null;
}

export interface CreateSkillTemplateDTO {
  title: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  skillType?: SkillType;
  resourceEffect?: ResourceEffect[];
  tags?: string[];
  usesLimit?: number | null;
  usesLimitType?: SkillUsesLimitType | null;
}
export interface UpdateSkillTemplateDTO extends Partial<CreateSkillTemplateDTO> {}

export interface CreateEffectTemplateDTO {
  name: string;
  icon?: string;
  iconColor?: string;
  description?: string;
  applications?: EffectApplication[];
}
export interface UpdateEffectTemplateDTO extends Partial<CreateEffectTemplateDTO> {}

export interface CreateItemTemplateDTO {
  name: string;
  description?: string;
  type: ItemType;
  icon?: string;
  iconColor?: string;
  damage?: string;
  effects?: ItemEffect[];
}
export interface UpdateItemTemplateDTO extends Partial<CreateItemTemplateDTO> {}

export interface AddCharacterItemDTO {
  templateId?: string;
  name: string;
  description?: string;
  type: ItemType;
  icon?: string;
  iconColor?: string;
  damage?: string;
  effects?: ItemEffect[];
  quantity?: number;
}
export interface UpdateCharacterItemDTO extends Partial<AddCharacterItemDTO> {
  equipped?: boolean;
}

export interface CreateCharacterRequestDTO {
  characterId: string;
  playerId: string;
  playerName: string;
  type: string;
  description: string;
  payload: any;
}

/** @deprecated usar useApp().getResourceColor(key) — mantido como fallback para a config padrão */
export const RESOURCE_COLORS: Record<string, string> = Object.fromEntries(
  DEFAULT_SHEET_CONFIG.resources.map((r) => [r.key, r.color])
);

/** @deprecated usar useApp().getResourceLabel(key) — mantido como fallback para a config padrão */
export const RESOURCE_LABELS: Record<string, string> = Object.fromEntries(
  DEFAULT_SHEET_CONFIG.resources.map((r) => [r.key, r.label])
);

/** @deprecated usar useApp().sheetConfig.attributes */
export const ATTRIBUTE_NAMES: string[] = DEFAULT_SHEET_CONFIG.attributes.map((a) => a.name);

export const ATTRIBUTE_RATING_LABELS: Record<AttributeRating, string> = {
  excellent: 'Excelente',
  good: 'Bom',
  normal: 'Normal',
  bad: 'Ruim',
};

export const ATTRIBUTE_RATING_COLORS: Record<AttributeRating, string> = {
  excellent: '#22c55e',
  good: '#3b82f6',
  normal: '#f59e0b',
  bad: '#ef4444',
};

export const SKILL_TAGS: string[] = [
  'Combate', 'Social', 'Conhecimento', 'Furtividade', 'Investigacao',
  'Sobrevivencia', 'Ocultismo', 'Medicina', 'Tecnico', 'Arte',
];

export const ITEM_TYPE_LABELS: Record<ItemType, string> = {
  weapon: 'Arma',
  vest: 'Veste',
  consumable: 'Consumivel',
  special: 'Especial',
};

export const ITEM_TYPE_COLORS: Record<ItemType, string> = {
  weapon: '#ef4444',
  vest: '#3b82f6',
  consumable: '#22c55e',
  special: '#a855f7',
};

export const ACTION_LABELS: Record<PlayerActionKey, string> = {
  item_add: 'Adicionar item',
  item_update: 'Editar item',
  item_equip: 'Equipar item',
  item_remove: 'Remover item',
  item_use: 'Usar consumível',
  skill_create: 'Criar habilidade',
  skill_update: 'Editar habilidade',
  skill_delete: 'Excluir habilidade',
  skill_use: 'Usar habilidade',
  resource_change: 'Alterar recursos',
  rest: 'Descansar',
  spell_cast: 'Conjurar feitiço',
  character_update: 'Editar a própria ficha',
};

/** Explica o que cada ação realmente faz — sem isso o mestre precisa adivinhar. */
export const ACTION_HINTS: Record<PlayerActionKey, string> = {
  item_add: 'Criar um item novo no próprio inventário',
  item_update: 'Alterar nome, descrição ou quantidade de um item',
  item_equip: 'Equipar e desequipar armas e vestes',
  item_remove: 'Descartar um item do inventário',
  item_use: 'Consumir um item (gasta quantidade)',
  skill_create: 'Adicionar uma habilidade à própria ficha',
  skill_update: 'Editar uma habilidade existente',
  skill_delete: 'Remover uma habilidade da ficha',
  skill_use: 'Engatilhar a habilidade e gastar seus usos',
  resource_change: 'Editar recursos, condições e gastar inspiração',
  rest: 'Restaurar usos por descanso (habilidades e feitiços)',
  spell_cast: 'Conjurar feitiços do grimório',
  character_update: 'Alterar nome, avatar, atributos e recursos máximos',
};

/** @deprecated usar getEffectStatLabel(stat, sheetConfig) — mantido como fallback para a config padrão */
export const EFFECT_STAT_LABELS: Record<string, string> = Object.fromEntries(
  allEffectStats(DEFAULT_SHEET_CONFIG).map((s) => [s.value, s.label])
);

export const PATH_CHAR_META: Record<PathCharacteristic, { label: string; abbr: string; color: string }> = {
  difficult:  { label: 'Terreno dificil',  abbr: 'DF', color: '#f59e0b' },
  no_vision:  { label: 'Sem visao',        abbr: 'NV', color: '#6b7280' },
  jump:       { label: 'Salto',            abbr: 'SL', color: '#3b82f6' },
  unstable:   { label: 'Instavel',         abbr: 'IN', color: '#f97316' },
  dangerous:  { label: 'Perigoso',         abbr: 'PR', color: '#ef4444' },
  blocked:    { label: 'Bloqueado',        abbr: 'BL', color: '#374151' },
};

export type EventMood = 'combat' | 'politics' | 'drama' | 'exploration' | 'mystery' | 'social' | 'other';
export type GoalPriority = 'high' | 'medium' | 'low';
export type GoalStatus = 'pending' | 'done';
export type PlaylistMood = 'combat' | 'exploration' | 'drama' | 'tension' | 'ambient' | 'celebration' | 'other';

export interface CampaignEvent {
  id: string;
  title: string;
  description: string;
  eventDate: string | null;
  sessionNumber: number | null;
  tags: string[];
  happened: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface PlaylistTrack {
  id: string;
  playlistId: string;
  title: string;
  url: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignPlaylist {
  id: string;
  name: string;
  mood: PlaylistMood;
  tracks: PlaylistTrack[];
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CampaignGoal {
  id: string;
  title: string;
  description: string;
  status: GoalStatus;
  priority: GoalPriority;
  characterId: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCampaignEventDTO {
  title: string;
  description?: string;
  eventDate?: string | null;
  sessionNumber?: number | null;
  tags?: string[];
  happened?: boolean;
}
export interface UpdateCampaignEventDTO extends Partial<CreateCampaignEventDTO> {
  sortOrder?: number;
}

export interface CreatePlaylistDTO {
  name: string;
  mood?: PlaylistMood;
}
export interface UpdatePlaylistDTO extends Partial<CreatePlaylistDTO> {}

export interface CreateTrackDTO {
  title: string;
  url: string;
}
export interface UpdateTrackDTO extends Partial<CreateTrackDTO> {}

export interface CreateGoalDTO {
  title: string;
  description?: string;
  priority?: GoalPriority;
  characterId?: string | null;
}
export interface UpdateGoalDTO extends Partial<CreateGoalDTO> {
  status?: GoalStatus;
  sortOrder?: number;
}

// ── YouTube Music (player da trilha sonora) ──────────────────────────────────

export interface YouTubeAuthStatus {
  configured: boolean;
  connected: boolean;
  clientId: string;
  accountName: string;
  accountThumb: string;
}

export interface YouTubePlaylistRef {
  id: string;
  title: string;
  thumb: string;
  itemCount: number;
  special?: boolean;
}

export interface YouTubeTrack {
  videoId: string;
  title: string;
  channel: string;
  thumb: string;
}

// ── Importar de outra campanha ──────────────────────────────────────────────
// Espelha server/src/types/index.ts.

export type ImportKind =
  | 'effectTemplates' | 'itemTemplates' | 'skillTemplates'
  | 'grimorios' | 'maps' | 'playlists';

/** Uma entrada selecionavel no painel de importacao. */
export interface ImportableEntry {
  id: string;
  name: string;
  /** Linha secundaria pronta pra UI (tipo do item, nº de feiticos, nº de faixas...). */
  detail: string;
  icon?: string;
  iconColor?: string;
  /** Ja existe algo com esse nome na campanha atual. */
  alreadyExists: boolean;
  /** O que vem junto por dependencia (efeitos de um item, grimorio de um catalizador). */
  brings: string[];
  /** Recursos/protecoes que a campanha atual nao tem — o efeito chegaria inerte. */
  warnings: string[];
}

export interface ImportableCatalog {
  campaignId: string;
  campaignName: string;
  effectTemplates: ImportableEntry[];
  itemTemplates: ImportableEntry[];
  skillTemplates: ImportableEntry[];
  grimorios: ImportableEntry[];
  maps: ImportableEntry[];
  playlists: ImportableEntry[];
}

export type ImportConflictStrategy = 'reuse' | 'duplicate';

export interface ImportFromCampaignDTO {
  effectTemplateIds: string[];
  itemTemplateIds: string[];
  skillTemplateIds: string[];
  grimorioIds: string[];
  mapIds: string[];
  playlistIds: string[];
  conflictStrategy: ImportConflictStrategy;
}

export interface ImportFromCampaignResult {
  imported: Record<ImportKind, number>;
  reused: { effectTemplates: number; grimorios: number };
  warnings: string[];
}

// ── Acesso dos jogadores (links de rede) ──────────────────────────────────────

export interface AccessLink {
  url: string;
  label: string;
  /** O link que o mestre deve passar por padrao. */
  recommended: boolean;
  /** Depende de mDNS — falha em hotspot de celular e Wi-Fi publico. */
  mdns: boolean;
}

export interface AccessInfo {
  port: number;
  devMode: boolean;
  links: AccessLink[];
}
