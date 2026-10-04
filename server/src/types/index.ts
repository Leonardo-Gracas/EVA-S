// ============================================================
// Tipos centrais do Sistema de Gerenciamento de RPG
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

/**
 * Parseia o `sheet_config` bruto vindo do banco, com fallback para DEFAULT_SHEET_CONFIG e merge de
 * chaves ausentes (campanhas salvas antes de um novo campo do SheetConfig existir). Usado tanto por
 * campaignService (rowToCampaign) quanto characterService (defaults de personagem novo) — os dois nao
 * podem importar um do outro (dependencia circular), entao a logica de parse mora aqui, no types puro.
 */
export function parseSheetConfig(raw: string | null | undefined): SheetConfig {
  if (!raw) return { ...DEFAULT_SHEET_CONFIG };
  try {
    const parsed = JSON.parse(raw);
    // Migracao: campanhas salvas antes de `attributes` existir tinham `attributeNames: string[]`.
    // Preserva os nomes customizados pelo mestre, atribuindo o nivel padrao pela mesma distribuicao
    // fixa que o app usava antigamente (1o excelente, proximos 3 bons, proximos 2 normais, resto ruim).
    if (!parsed.attributes && Array.isArray(parsed.attributeNames)) {
      parsed.attributes = parsed.attributeNames.map((name: string, i: number) => ({
        name,
        defaultRating: (i === 0 ? 'excellent' : i < 4 ? 'good' : i < 6 ? 'normal' : 'bad') as AttributeRating,
      }));
      delete parsed.attributeNames;
    }
    // Migracao: `ResourceDef.defaultValue` e novo — recursos customizados salvos antes dele nao tem o campo.
    if (Array.isArray(parsed.resources)) {
      parsed.resources = parsed.resources.map((r: any) => ({ defaultValue: 20, ...r }));
    }
    return { ...DEFAULT_SHEET_CONFIG, ...parsed };
  }
  catch { return { ...DEFAULT_SHEET_CONFIG }; }
}

export type SkillType = 'active' | 'passive';

export interface ResourceEffect {
  resource: 'health' | 'sanity' | 'exposure';
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

// -- Effects & Items ----------------------------------------------------------

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
export type PlayerActionKey = 'item_add' | 'item_update' | 'item_equip' | 'item_remove' | 'item_use' | 'skill_create' | 'skill_update' | 'skill_delete' | 'skill_use' | 'resource_change' | 'rest' | 'spell_cast' | 'character_update';
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
  // Usar a propria habilidade e descansar sao o laco basico de jogo — livres por
  // padrao, como conjurar. Editar/criar/apagar ficha e que passa pelo mestre.
  skill_use: 'free',
  resource_change: 'request',
  rest: 'free',
  spell_cast: 'free',
  character_update: 'request',
};

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

export interface SocketEvents {
  'campaign:updated': Campaign;
  'player:updated': Player;
  'player:removed': { id: string };
  'character:updated': Character;
  'character:removed': { id: string };
  'skill:updated': Skill;
  'skill:removed': { id: string; characterId: string };
  'players:online': Player[];
  'history:event': HistoryEvent;
  'player:join': { playerId: string };
  'player:leave': { playerId: string };
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

export interface CharacterRequest {
  id: string;
  characterId: string;
  playerId: string;
  playerName: string;
  type: string;
  description: string;
  payload: any;
  status: 'pending' | 'approved' | 'denied' | 'free';
  createdAt: string;
  updatedAt: string;
}

export interface CreateCharacterRequestDTO {
  characterId: string;
  playerId: string;
  playerName: string;
  type: string;
  description: string;
  payload: any;
}

export interface UpdateCampaignDTO {
  name?: string;
  description?: string;
}

// ── Combat ──────────────────────────────────────────────────────────────────

export interface CombatActiveEffect {
  uid: string;
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  applications: EffectApplication[];
  durationRounds: number;       // full queue rotations until expiry (0 = permanent)
  appliedAtGlobalTurn: number;  // globalTurn value when applied
  expireAtGlobalTurn: number;   // pre-computed: appliedAt + duration * queueSize
}

export interface MoveSnapshot {
  nodeId: string | null;
  remainingDisplacement: number;
  displacementProgress: DisplacementProgress | null;
}

export interface DisplacementProgress {
  pathId: string;
  /** Fraction of the effective cost already traversed (0.0–1.0). */
  fraction: number;
  direction: 'forward' | 'backward'; // source→target or target→source
}

export interface CombatParticipant {
  uid: string;           // unique within this combat session
  characterId: string;
  displayName: string;
  isBossMode: boolean;
  currentResources: ResourceMap;
  activeEffects: CombatActiveEffect[];
  // Map position
  currentNodeId: string | null;
  remainingDisplacement: number;      // reset to char.displacement on their turn
  displacementProgress: DisplacementProgress | null; // partial path traversal
  moveSnapshot: MoveSnapshot | null;  // for player undo
  movementBlocked?: boolean;           // GM can lock movement for this participant
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
  mapVisibility: 1 | 2 | 3 | 4;      // 1=fog,2=local,3=shared,4=open
  createdAt: string;
  updatedAt: string;
}

export interface CreateCombatSessionDTO {
  name?: string;
  mapId?: string | null;
}

export interface AddCombatParticipantDTO {
  characterId: string;
  displayName?: string;
  isBossMode?: boolean;
}

// ── Maps ─────────────────────────────────────────────────────────────────

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

export interface CreateMapDTO {
  name: string;
  nodes?: MapNode[];
  paths?: MapPath[];
}

export interface UpdateMapDTO {
  name?: string;
  nodes?: MapNode[];
  paths?: MapPath[];
}

// ── Campaign extras ────────────────────────────────────────────────────────

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

export interface CreateGrimorioDTO {
  name: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  effectName?: string;
}

export interface UpdateGrimorioDTO extends Partial<CreateGrimorioDTO> {}

export interface CreateGrimorioSpellDTO {
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

export interface UpdateGrimorioSpellDTO extends Partial<CreateGrimorioSpellDTO> {}

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
}

// ── Importar de outra campanha ──────────────────────────────────────────────

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

/**
 * O que fazer quando o destino ja tem um efeito/grimorio com o mesmo nome:
 * `reuse` religa o item importado ao que ja existe aqui (nada duplicado, mas os
 * numeros passam a ser os DAQUI); `duplicate` traz uma copia independente.
 */
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
