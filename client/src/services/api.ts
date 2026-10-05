import type {
  Campaign, Player, Character, Skill, SkillTemplate, HistoryEvent, GlobalPermissions,
  CreatePlayerDTO, UpdatePlayerDTO,
  CreateCharacterDTO, UpdateCharacterDTO,
  CreateSkillDTO, UpdateSkillDTO,
  CreateSkillTemplateDTO, UpdateSkillTemplateDTO,
  CharacterRequest, CreateCharacterRequestDTO,
  EffectTemplate, CreateEffectTemplateDTO, UpdateEffectTemplateDTO,
  ItemTemplate, CreateItemTemplateDTO, UpdateItemTemplateDTO,
  CharacterItem, AddCharacterItemDTO, UpdateCharacterItemDTO,
  CombatSession,
  GameMap, MapNode, MapPath,
  CampaignEvent, CampaignPlaylist, PlaylistTrack, CampaignGoal,
  SavedCampaignSummary, CreateNewCampaignDTO, ChangeCampaignPasswordDTO, CampaignAuthResult,
  ImportableCatalog, ImportFromCampaignDTO, ImportFromCampaignResult,
  Grimorio, GrimorioSpell,
  SheetType, CreateSheetTypeDTO, UpdateSheetTypeDTO,
  YouTubeAuthStatus, YouTubePlaylistRef, YouTubeTrack,
  AccessInfo,
} from '../types';

const BASE = '/api';

// Sessao de mestre: token emitido pelo servidor so apos senha da campanha ou
// senha admin validada (ver /campaigns e /campaigns/:id/switch). Substitui o
// antigo "rpg_gm_auth=1" no localStorage, que o servidor nunca conferia — daí
// bastava um navegador ja ter sido usado como mestre uma vez (ou alguem digitar
// esse valor no devtools) pra ganhar acesso de mestre sem senha nenhuma.
const GM_TOKEN_KEY = 'rpg_gm_token';

export function getGmToken(): string | null {
  return localStorage.getItem(GM_TOKEN_KEY);
}

function setGmToken(token: string): void {
  localStorage.setItem(GM_TOKEN_KEY, token);
}

export function clearGmToken(): void {
  localStorage.removeItem(GM_TOKEN_KEY);
}

// Sessao do jogador: token emitido pelo servidor no login/cadastro do jogador.
// As rotas de jogador conferem que o personagem e do dono do token.
export const PLAYER_TOKEN_KEY = 'rpg_player_token';
export const PLAYER_SESSION_KEY = 'rpg_player_session';

export function getPlayerToken(): string | null {
  try { return localStorage.getItem(PLAYER_TOKEN_KEY); } catch { return null; }
}

/** Guarda o jogador logado (sem o token dentro do objeto) e o token separado. */
export function savePlayerSession(player: { sessionToken?: string } & Record<string, unknown>): void {
  const { sessionToken, ...rest } = player;
  localStorage.setItem(PLAYER_SESSION_KEY, JSON.stringify(rest));
  if (sessionToken) localStorage.setItem(PLAYER_TOKEN_KEY, sessionToken);
}

export function clearPlayerSession(): void {
  localStorage.removeItem(PLAYER_SESSION_KEY);
  localStorage.removeItem(PLAYER_TOKEN_KEY);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getGmToken();
  const playerToken = getPlayerToken();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-gm-token': token } : {}),
      ...(playerToken ? { 'x-player-token': playerToken } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Erro desconhecido' }));
    // Sessao de jogador invalida (servidor reiniciou o banco, jogador removido...):
    // volta pra tela de login do jogador em vez de falhar calado.
    if (res.status === 401 && err.code === 'PLAYER_AUTH' && window.location.pathname.startsWith('/player')) {
      clearPlayerSession();
      window.location.reload();
    }
    const error = new Error(err.error ?? `HTTP ${res.status}`);
    // Alguns fluxos (YouTube) precisam distinguir "erro" de "precisa relogar"
    // para trocar a UI em vez de so mostrar a mensagem.
    (error as any).status = res.status;
    (error as any).reauth = !!err.reauth;
    throw error;
  }

  return res.json();
}

// Campanha
export const api = {
  campaign: {
    get: () => request<Campaign>('GET', '/campaign'),
    update: (data: Partial<Campaign>) => request<Campaign>('PUT', '/campaign', data),
    getPermissions: () => request<GlobalPermissions>('GET', '/campaign/permissions'),
    setPermissions: (perms: GlobalPermissions) => request<GlobalPermissions>('PUT', '/campaign/permissions', perms),
    export: () => request<object>('GET', '/campaign/export'),
    import: (data: object) => request<{ success: boolean }>('POST', '/campaign/import', data),
  },

  sheetTypes: {
    list: () => request<SheetType[]>('GET', '/campaign/sheet-types'),
    create: (dto: CreateSheetTypeDTO) => request<SheetType>('POST', '/campaign/sheet-types', dto),
    update: (id: string, dto: UpdateSheetTypeDTO) => request<SheetType>('PUT', `/campaign/sheet-types/${id}`, dto),
    delete: (id: string) => request<SheetType[]>('DELETE', `/campaign/sheet-types/${id}`),
    reorder: (orderedIds: string[]) => request<SheetType[]>('PUT', '/campaign/sheet-types/reorder', { orderedIds }),
    setDefault: (id: string) => request<SheetType[]>('PUT', `/campaign/sheet-types/${id}/set-default`),
    duplicate: (id: string) => request<SheetType>('POST', `/campaign/sheet-types/${id}/duplicate`),
  },

  players: {
    list: () => request<Player[]>('GET', '/players'),
    get: (id: string) => request<Player>('GET', `/players/${id}`),
    create: (data: CreatePlayerDTO) => request<Player>('POST', '/players', data),
    update: (id: string, data: UpdatePlayerDTO) => request<Player>('PUT', `/players/${id}`, data),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/players/${id}`),
    setCharacters: (id: string, characterIds: string[]) =>
      request<{ success: boolean }>('PUT', `/players/${id}/characters`, { characterIds }),
  },

  characters: {
    list: () => request<Character[]>('GET', '/characters'),
    get: (id: string) => request<Character>('GET', `/characters/${id}`),
    create: (data: CreateCharacterDTO) => request<Character>('POST', '/characters', data),
    update: (id: string, data: UpdateCharacterDTO) => request<Character>('PUT', `/characters/${id}`, data),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/characters/${id}`),
    rest: (id: string) => request<Character>('POST', `/characters/${id}/rest`),
  },

  skills: {
    create: (charId: string, data: CreateSkillDTO) =>
      request<Skill>('POST', `/characters/${charId}/skills`, data),
    update: (charId: string, skillId: string, data: UpdateSkillDTO) =>
      request<Skill>('PUT', `/characters/${charId}/skills/${skillId}`, data),
    delete: (charId: string, skillId: string) =>
      request<{ success: boolean }>('DELETE', `/characters/${charId}/skills/${skillId}`),
    reorder: (charId: string, orderedIds: string[]) =>
      request<Skill[]>('PUT', `/characters/${charId}/skills/reorder`, { orderedIds }),
    use: (charId: string, skillId: string) =>
      request<Character>('POST', `/characters/${charId}/skills/${skillId}/use`),
    /** Aplica o custo/ganho de recursos da habilidade (permissão skill_use "livre"). */
    trigger: (charId: string, skillId: string) =>
      request<Character>('POST', `/characters/${charId}/skills/${skillId}/trigger`),
  },

  history: {
    list: (limit?: number) => request<HistoryEvent[]>('GET', `/history${limit ? `?limit=${limit}` : ''}`),
  },

  skillTemplates: {
    list: () => request<SkillTemplate[]>('GET', '/skill-templates'),
    create: (data: CreateSkillTemplateDTO) => request<SkillTemplate>('POST', '/skill-templates', data),
    update: (id: string, data: UpdateSkillTemplateDTO) => request<SkillTemplate>('PUT', `/skill-templates/${id}`, data),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/skill-templates/${id}`),
  },

  requests: {
    list: () => request<CharacterRequest[]>('GET', '/requests'),
    create: (data: CreateCharacterRequestDTO) => request<CharacterRequest>('POST', '/requests', data),
    review: (id: string, action: 'approved' | 'denied') =>
      request<CharacterRequest>('PUT', `/requests/${id}/review`, { action }),
    recordFree: (data: CreateCharacterRequestDTO) =>
      request<CharacterRequest>('POST', '/requests/free', data),
  },

  effectTemplates: {
    list: () => request<EffectTemplate[]>('GET', '/effect-templates'),
    create: (data: CreateEffectTemplateDTO) => request<EffectTemplate>('POST', '/effect-templates', data),
    update: (id: string, data: UpdateEffectTemplateDTO) => request<EffectTemplate>('PUT', `/effect-templates/${id}`, data),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/effect-templates/${id}`),
  },

  itemTemplates: {
    list: () => request<ItemTemplate[]>('GET', '/item-templates'),
    create: (data: CreateItemTemplateDTO) => request<ItemTemplate>('POST', '/item-templates', data),
    update: (id: string, data: UpdateItemTemplateDTO) => request<ItemTemplate>('PUT', `/item-templates/${id}`, data),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/item-templates/${id}`),
  },

  characterItems: {
    list: (charId: string) => request<CharacterItem[]>('GET', `/characters/${charId}/items`),
    add: (charId: string, data: AddCharacterItemDTO) => request<CharacterItem>('POST', `/characters/${charId}/items`, data),
    update: (charId: string, itemId: string, data: UpdateCharacterItemDTO) =>
      request<CharacterItem>('PUT', `/characters/${charId}/items/${itemId}`, data),
    remove: (charId: string, itemId: string) =>
      request<{ success: boolean }>('DELETE', `/characters/${charId}/items/${itemId}`),
    use: (charId: string, itemId: string, quantity: number = 1) =>
      request<{ success: boolean; item: CharacterItem | null }>('POST', `/characters/${charId}/items/${itemId}/use`, { quantity }),
  },

  maps: {
    list: () => request<GameMap[]>('GET', '/maps'),
    create: (data: { name: string }) => request<GameMap>('POST', '/maps', data),
    update: (id: string, data: { name?: string; nodes?: MapNode[]; paths?: MapPath[] }) =>
      request<GameMap>('PUT', `/maps/${id}`, data),
    delete: (id: string) => request<void>('DELETE', `/maps/${id}`),
  },
  combat: {
    getActive: () => request<CombatSession | null>('GET', '/combat/active'),
    getAll: () => request<CombatSession[]>('GET', '/combat'),
    create: (data: { name?: string; mapId?: string | null }) => request<CombatSession>('POST', '/combat', data),
    end: (id: string) => request<CombatSession>('POST', `/combat/${id}/end`, {}),
    addParticipant: (id: string, data: { characterId: string; displayName?: string; isBossMode?: boolean }) =>
      request<CombatSession>('POST', `/combat/${id}/participants`, data),
    removeParticipant: (id: string, uid: string) =>
      request<CombatSession>('DELETE', `/combat/${id}/participants/${uid}`),
    updateParticipant: (id: string, uid: string, data: Partial<{ isBossMode: boolean; currentResources: Record<string, number> }>) =>
      request<CombatSession>('PUT', `/combat/${id}/participants/${uid}`, data),
    nextTurn: (id: string) => request<CombatSession>('POST', `/combat/${id}/next-turn`, {}),
    addEffect: (id: string, uid: string, data: { name: string; icon?: string; color?: string; description?: string; durationRounds: number; applications: any[] }) =>
      request<CombatSession>('POST', `/combat/${id}/participants/${uid}/effects`, data),
    removeEffect: (id: string, uid: string, effectUid: string) =>
      request<CombatSession>('DELETE', `/combat/${id}/participants/${uid}/effects/${effectUid}`),
    reorder: (id: string, orderedUids: string[]) =>
      request<CombatSession>('PUT', `/combat/${id}/reorder`, { orderedUids }),
    selectMap: (id: string, mapId: string | null) =>
      request<CombatSession>('PUT', `/combat/${id}/map`, { mapId }),
    assignNode: (id: string, participantUid: string, nodeId: string | null) =>
      request<CombatSession>('POST', `/combat/${id}/assign-node`, { participantUid, nodeId }),
    setDisplacementMode: (id: string, mode: 'rule' | 'open') =>
      request<CombatSession>('PUT', `/combat/${id}/displacement-mode`, { mode }),
    setRemainingDisplacement: (id: string, uid: string, value: number) =>
      request<CombatSession>('PUT', `/combat/${id}/participants/${uid}/remaining-displacement`, { value }),
    undoMove: (id: string, participantUid: string) =>
      request<CombatSession>('POST', `/combat/${id}/undo-move`, { participantUid }),
    move: (id: string, participantUid: string, pathId: string) =>
      request<{ result: 'moved' | 'progress'; session: CombatSession }>('POST', `/combat/${id}/move`, { participantUid, pathId }),
    setMapVisibility: (id: string, level: 1 | 2 | 3 | 4) =>
      request<CombatSession>('PUT', `/combat/${id}/map-visibility`, { level }),
    setMovementLock: (id: string, uid: string, blocked: boolean) =>
      request<CombatSession>('PUT', `/combat/${id}/participants/${uid}/movement-lock`, { blocked }),
  },

  campaignEvents: {
    list: () => request<CampaignEvent[]>('GET', '/campaign-events'),
    create: (data: { title: string; description?: string; eventDate?: string | null; sessionNumber?: number | null; tags?: string[]; happened?: boolean }) =>
      request<CampaignEvent>('POST', '/campaign-events', data),
    update: (id: string, data: Partial<{ title: string; description: string; eventDate: string | null; sessionNumber: number | null; tags: string[]; happened: boolean; sortOrder: number }>) =>
      request<CampaignEvent>('PUT', `/campaign-events/${id}`, data),
    delete: (id: string) => request<void>('DELETE', `/campaign-events/${id}`),
  },

  playlists: {
    list: () => request<CampaignPlaylist[]>('GET', '/playlists'),
    create: (data: { name: string; mood?: string }) => request<CampaignPlaylist>('POST', '/playlists', data),
    update: (id: string, data: { name?: string; mood?: string }) => request<CampaignPlaylist>('PUT', `/playlists/${id}`, data),
    delete: (id: string) => request<void>('DELETE', `/playlists/${id}`),
    addTrack: (playlistId: string, data: { title: string; url: string }) => request<PlaylistTrack>('POST', `/playlists/${playlistId}/tracks`, data),
    updateTrack: (id: string, data: { title?: string; url?: string }) => request<PlaylistTrack>('PUT', `/tracks/${id}`, data),
    deleteTrack: (id: string) => request<void>('DELETE', `/tracks/${id}`),
  },

  // Conta YouTube / YouTube Music do mestre — usada pelo player flutuante.
  youtube: {
    status: () => request<YouTubeAuthStatus>('GET', '/music/youtube/status'),
    setConfig: (clientId: string, clientSecret: string) =>
      request<YouTubeAuthStatus>('PUT', '/music/youtube/config', { clientId, clientSecret }),
    authUrl: (redirectUri: string) =>
      request<{ url: string }>('POST', '/music/youtube/auth-url', { redirectUri }),
    disconnect: () => request<YouTubeAuthStatus>('POST', '/music/youtube/disconnect'),
    playlists: () => request<YouTubePlaylistRef[]>('GET', '/music/youtube/playlists'),
    items: (playlistId: string) =>
      request<YouTubeTrack[]>('GET', `/music/youtube/playlists/${encodeURIComponent(playlistId)}/items`),
    playlistInfo: (playlistId: string) =>
      request<YouTubePlaylistRef>('GET', `/music/youtube/playlists/${encodeURIComponent(playlistId)}/info`),
    search: (q: string) => request<YouTubeTrack[]>('GET', `/music/youtube/search?q=${encodeURIComponent(q)}`),
    videos: (ids: string[]) => request<YouTubeTrack[]>('POST', '/music/youtube/videos', { ids }),
  },

  goals: {
    list: () => request<CampaignGoal[]>('GET', '/goals'),
    create: (data: { title: string; description?: string; priority?: string; characterId?: string | null }) =>
      request<CampaignGoal>('POST', '/goals', data),
    update: (id: string, data: Partial<{ title: string; description: string; status: string; priority: string; characterId: string | null; sortOrder: number }>) =>
      request<CampaignGoal>('PUT', `/goals/${id}`, data),
    delete: (id: string) => request<void>('DELETE', `/goals/${id}`),
  },

  campaigns: {
    list: () => request<SavedCampaignSummary[]>('GET', '/campaigns'),
    createNew: async (dto: CreateNewCampaignDTO & { adminPassword: string }) => {
      const result = await request<{ campaigns: SavedCampaignSummary[]; gmToken: string }>('POST', '/campaigns', dto);
      setGmToken(result.gmToken);
      return result.campaigns;
    },
    switch: async (id: string, password: string) => {
      const result = await request<CampaignAuthResult>('POST', `/campaigns/${id}/switch`, { password });
      setGmToken(result.gmToken);
      return result;
    },
    changePassword: (id: string, dto: ChangeCampaignPasswordDTO) =>
      request<SavedCampaignSummary>('PUT', `/campaigns/${id}/password`, dto),
    delete: (id: string) => request<SavedCampaignSummary[]>('DELETE', `/campaigns/${id}`),
    /** O que da pra trazer de uma campanha salva, ja anotado com conflitos e avisos. */
    importable: (id: string) => request<ImportableCatalog>('GET', `/campaigns/${id}/importable`),
    /** Traz o selecionado pra campanha atual sem apagar nada do que ja esta aqui. */
    importInto: (id: string, dto: ImportFromCampaignDTO) =>
      request<ImportFromCampaignResult>('POST', `/campaigns/${id}/import-into-current`, dto),
  },

  admin: {
    verify: (password: string) => request<{ success: boolean }>('POST', '/admin/verify', { password }),
    checkSession: () => request<{ ok: boolean }>('GET', '/admin/session'),
  },

  session: {
    status: () => request<{ open: boolean }>('GET', '/session-status'),
  },

  network: {
    access: () => request<AccessInfo>('GET', '/network/access'),
  },

  grimorios: {
    list: () => request<Grimorio[]>('GET', '/grimorios'),
    get: (id: string) => request<Grimorio>('GET', `/grimorios/${id}`),
    create: (dto: { name: string; description?: string; icon?: string; iconColor?: string; effectName?: string }) =>
      request<Grimorio>('POST', '/grimorios', dto),
    update: (id: string, dto: Partial<{ name: string; description: string; icon: string; iconColor: string; effectName: string }>) =>
      request<Grimorio>('PUT', `/grimorios/${id}`, dto),
    delete: (id: string) => request<{ success: boolean }>('DELETE', `/grimorios/${id}`),
    createSpell: (grimorioId: string, dto: object) => request<Grimorio>('POST', `/grimorios/${grimorioId}/spells`, dto),
    updateSpell: (spellId: string, dto: object) => request<Grimorio>('PUT', `/grimorio-spells/${spellId}`, dto),
    deleteSpell: (spellId: string) => request<Grimorio>('DELETE', `/grimorio-spells/${spellId}`),
    castSpell: (spellId: string, characterId: string) =>
      request<{ character: Character; spellUses: Record<string, number> }>('POST', `/grimorio-spells/${spellId}/cast`, { characterId }),
    getCharacterUses: (characterId: string) =>
      request<Record<string, number>>('GET', `/characters/${characterId}/grimorio-uses`),
  },

};
