import { Router, Request, Response } from 'express';
import * as campaignService from '../services/campaignService';
import { GlobalPermissions, CreateSheetTypeDTO, UpdateSheetTypeDTO, parseResourceStat, parseProtectionStat, DEFAULT_DISPLACEMENT } from '../types';
import * as sheetTypeService from '../services/sheetTypeService';
import * as playerService from '../services/playerService';
import * as characterService from '../services/characterService';
import * as skillTemplateService from '../services/skillTemplateService';
import * as characterRequestService from '../services/characterRequestService';
import * as effectTemplateService from '../services/effectTemplateService';
import * as itemTemplateService from '../services/itemTemplateService';
import * as characterItemService from '../services/characterItemService';
import * as combatService from '../services/combatService'
import * as mapService from '../services/mapService';
import * as campaignExtras from '../services/campaignExtrasService';
import * as multiCampaignService from '../services/multiCampaignService';
import * as campaignImportService from '../services/campaignImportService';
import * as grimorioService from '../services/grimorioService';
import * as youtubeMusic from '../services/youtubeMusicService';
import { verifyAdminPassword } from '../services/adminService';
import { openGmSession, isGmSessionOpen } from '../services/gmSessionService';
import { createGmToken } from '../services/gmAuthService';
import { requireGmAuth } from '../middleware/gmAuth';
import { getHistory } from '../services/historyService';
import { getAccessInfo } from '../network';
import { getIO } from '../socket/socketManager';
import { authorizeCharacter, requireGmOrPlayer, isGm, sessionPlayer, denyPlayerAuth } from '../middleware/access';
import { createPlayerSession, deletePlayerSessions } from '../services/playerSessionService';
import { assertAvatar, assertTextLength, isSafeColor, escapeHtml, omit } from '../utils/sanitize';
import { PlayerActionKey } from '../types';

const router = Router();

// NOTE: o modelo abaixo foi endurecido — ver middleware/access.ts. Rotas de
// jogador agora exigem sessao de jogador (x-player-token), conferem o dono do
// personagem e aplicam as permissoes livre/solicitar/bloqueado no servidor.
// Texto historico:
// NOTE (permission model, documented not enforced by design):
// `playerPermissions`/`globalPermissions` (free/request/blocked) are only
// checked client-side (see PlayerView.tsx's getPermission()) to decide the
// UX flow — none of the mutation routes below re-check them against the
// calling player's identity. That part of the trust model is unchanged: this
// app assumes a trusted LAN group and uses those permissions to streamline
// play (skip GM approval for routine actions), not as a security boundary
// between players. What IS enforced now is the mestre/jogador boundary —
// every route below that only a GM should ever call requires `requireGmAuth`
// (a real server-validated session token, see gmAuthService), so a player
// (or anyone on the LAN) can no longer reach GM-only actions no matter what
// they set in localStorage or which URL they type.

function emitUpdate(event: string, data: any) {
  const io = getIO();
  if (io) io.emit(event, data);
}

function emitCampaignSwitch() {
  const campaign = campaignService.getCampaign();
  const players = playerService.getAllPlayers();
  const characters = characterService.getAllCharacters();
  emitUpdate('campaign:updated', campaign);
  players.forEach((p) => emitUpdate('player:updated', p));
  characters.forEach((c) => emitUpdate('character:updated', c));
  // Switching/creating a campaign swaps virtually every table (grimorios,
  // item/effect/skill templates, maps, requests, history, combat...) — the
  // granular emits above only cover campaign/players/characters, so every
  // connected client (not just the browser that triggered the switch) needs
  // a full state refetch to avoid showing data from the previous campaign.
  emitUpdate('campaign:switched', {});
}

// ======================== LIMITE DE TENTATIVAS DE SENHA ========================
// Sem isso dava pra testar senhas de jogador/campanha/admin sem parar.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 5 * 60 * 1000;

function attemptKey(req: Request, scope: string): string {
  // LAN: IP de quem chamou. Online: id da conexao P2P (posto pelo host, nunca pelo jogador).
  return `${scope}:${(req as any).ip ?? req.header('x-evas-peer') ?? 'local'}`;
}
function tooManyAttempts(req: Request, res: Response, scope: string): boolean {
  const entry = attempts.get(attemptKey(req, scope));
  if (entry && entry.resetAt > Date.now() && entry.count >= MAX_ATTEMPTS) {
    res.status(429).json({ error: 'Muitas tentativas. Espere alguns minutos.' });
    return true;
  }
  return false;
}
function recordFailure(req: Request, scope: string): void {
  const key = attemptKey(req, scope);
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

// ======================== MESTRE AUTH ========================

router.post('/admin/verify', (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'Senha obrigatoria' });
  if (tooManyAttempts(req, res, 'admin')) return;
  if (!verifyAdminPassword(String(password))) { recordFailure(req, 'admin'); return res.status(401).json({ error: 'Senha incorreta' }); }
  res.json({ success: true });
});

router.get('/session-status', (_req: Request, res: Response) => {
  res.json({ open: isGmSessionOpen() });
});

// Usado pelo GMGuard no boot do app pra confirmar que o token guardado no
// navegador ainda e uma sessao valida no servidor (e nao so um valor antigo
// sobrevivendo num localStorage que nunca expira).
router.get('/admin/session', requireGmAuth, (_req: Request, res: Response) => {
  res.json({ ok: true });
});

// Links de acesso do jogador (um por rede da maquina) pro painel do mestre montar
// QR e botao de copiar. Atras de requireGmAuth porque expoe a topologia de rede da
// maquina — o jogador nao precisa dela, ja chegou por um dos enderecos.
router.get('/network/access', requireGmAuth, (_req: Request, res: Response) => {
  res.json(getAccessInfo());
});


// ======================== CAMPANHA ========================

router.get('/campaign', (_req: Request, res: Response) => {
  try {
    res.json(campaignService.getCampaign());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/campaign', requireGmAuth, (req: Request, res: Response) => {
  try {
    const campaign = campaignService.updateCampaign(req.body);
    emitUpdate('campaign:updated', campaign);
    res.json(campaign);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/campaign/permissions', (_req: Request, res: Response) => {
  try {
    res.json(campaignService.getGlobalPermissions());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.put('/campaign/permissions', requireGmAuth, (req: Request, res: Response) => {
  try {
    const campaign = campaignService.setGlobalPermissions(req.body as GlobalPermissions);
    emitUpdate('campaign:updated', campaign);
    res.json(campaign.globalPermissions);
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

// ======================== TIPOS DE FICHA ========================

function emitSheetTypesUpdate() {
  emitUpdate('sheetTypes:updated', sheetTypeService.listSheetTypes());
  characterService.getAllCharacters().forEach((c) => emitUpdate('character:updated', c));
}

router.get('/campaign/sheet-types', (_req: Request, res: Response) => {
  try {
    res.json(sheetTypeService.listSheetTypes());
  } catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.post('/campaign/sheet-types', requireGmAuth, (req: Request, res: Response) => {
  try {
    const sheetType = sheetTypeService.createSheetType(req.body as CreateSheetTypeDTO);
    emitSheetTypesUpdate();
    res.status(201).json(sheetType);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/campaign/sheet-types/reorder', requireGmAuth, (req: Request, res: Response) => {
  try {
    const sheetTypes = sheetTypeService.reorderSheetTypes(req.body.orderedIds);
    emitUpdate('sheetTypes:updated', sheetTypes);
    res.json(sheetTypes);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/campaign/sheet-types/:id', requireGmAuth, (req: Request, res: Response) => {
  try {
    const sheetType = sheetTypeService.updateSheetType(req.params.id, req.body as UpdateSheetTypeDTO);
    emitSheetTypesUpdate();
    res.json(sheetType);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/campaign/sheet-types/:id', requireGmAuth, (req: Request, res: Response) => {
  try {
    const sheetTypes = sheetTypeService.deleteSheetType(req.params.id);
    emitSheetTypesUpdate();
    res.json(sheetTypes);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/campaign/sheet-types/:id/set-default', requireGmAuth, (req: Request, res: Response) => {
  try {
    const sheetTypes = sheetTypeService.setDefaultSheetType(req.params.id);
    emitUpdate('sheetTypes:updated', sheetTypes);
    res.json(sheetTypes);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/campaign/sheet-types/:id/duplicate', requireGmAuth, (req: Request, res: Response) => {
  try {
    const sheetType = sheetTypeService.duplicateSheetType(req.params.id);
    emitUpdate('sheetTypes:updated', sheetTypeService.listSheetTypes());
    res.status(201).json(sheetType);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get('/campaign/export', requireGmAuth, (_req: Request, res: Response) => {
  try {
    const data = campaignService.exportCampaign();
    res.setHeader('Content-Disposition', 'attachment; filename="campanha-export.json"');
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaign/import', requireGmAuth, (req: Request, res: Response) => {
  try {
    campaignService.importCampaign(req.body);
    emitCampaignSwitch();
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ======================== MÚLTIPLAS CAMPANHAS ========================

router.get('/campaigns', (_req: Request, res: Response) => {
  try {
    res.json(multiCampaignService.listSavedCampaigns());
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/campaigns', (req: Request, res: Response) => {
  try {
    const { adminPassword, ...dto } = req.body;
    if (tooManyAttempts(req, res, 'admin')) return;
    if (!verifyAdminPassword(String(adminPassword ?? ''))) { recordFailure(req, 'admin'); return res.status(401).json({ error: 'Senha admin incorreta' }); }
    const campaigns = multiCampaignService.createNewCampaign(dto);
    openGmSession();
    emitCampaignSwitch();
    res.json({ campaigns, gmToken: createGmToken() });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Autentica e abre a campanha selecionada (usado tanto na tela inicial do
// mestre quanto ao trocar de campanha pelo gerenciador). Aceita a senha da
// propria campanha ou a senha admin. E' aqui que uma sessao de mestre nasce:
// so a partir de uma senha correta um gmToken valido e emitido.
router.post('/campaigns/:id/switch', (req: Request, res: Response) => {
  try {
    const { password = '' } = req.body;
    if (tooManyAttempts(req, res, 'campaign')) return;
    let result;
    try {
      result = multiCampaignService.authenticateCampaign(req.params.id, String(password));
    } catch (err) {
      recordFailure(req, 'campaign');
      throw err;
    }
    openGmSession();
    emitCampaignSwitch();
    res.json({ ...result, gmToken: createGmToken() });
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.put('/campaigns/:id/password', requireGmAuth, (req: Request, res: Response) => {
  try {
    const updated = multiCampaignService.changeCampaignPassword(req.params.id, req.body);
    res.json(updated);
  } catch (err: any) {
    res.status(401).json({ error: err.message });
  }
});

router.delete('/campaigns/:id', requireGmAuth, (req: Request, res: Response) => {
  try {
    res.json(multiCampaignService.deleteSavedCampaign(req.params.id));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Importar PARTES de outra campanha salva pra dentro da campanha atual — nada e
// apagado aqui (ao contrario de /campaign/import e da troca de campanha).
router.get('/campaigns/:id/importable', requireGmAuth, (req: Request, res: Response) => {
  try {
    res.json(campaignImportService.getImportableCatalog(req.params.id));
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/campaigns/:id/import-into-current', requireGmAuth, (req: Request, res: Response) => {
  try {
    const result = campaignImportService.importFromCampaign(req.params.id, req.body);
    // Bibliotecas sao estado global do AppContext — sem esses emits o mestre so
    // veria o importado depois de um F5, e os outros clientes nunca.
    emitUpdate('effectTemplates:updated', effectTemplateService.getAllEffectTemplates());
    emitUpdate('itemTemplates:updated', itemTemplateService.getAllItemTemplates());
    emitUpdate('grimorios:updated', grimorioService.listGrimorios());
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ======================== GRIMÓRIO ========================

router.get('/grimorios', (_req, res) => {
  try { res.json(grimorioService.listGrimorios()); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

router.get('/grimorios/:id', (req, res) => {
  try { res.json(grimorioService.getGrimorio(req.params.id)); }
  catch (e: any) { res.status(404).json({ error: e.message }); }
});

router.post('/grimorios', requireGmAuth, (req, res) => {
  try {
    const grimorio = grimorioService.createGrimorio(req.body);
    emitUpdate('effectTemplates:updated', effectTemplateService.getAllEffectTemplates());
    emitUpdate('grimorios:updated', grimorioService.listGrimorios());
    res.json(grimorio);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/grimorios/:id', requireGmAuth, (req, res) => {
  try {
    const grimorio = grimorioService.updateGrimorio(req.params.id, req.body);
    emitUpdate('effectTemplates:updated', effectTemplateService.getAllEffectTemplates());
    emitUpdate('grimorios:updated', grimorioService.listGrimorios());
    res.json(grimorio);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/grimorios/:id', requireGmAuth, (req, res) => {
  try {
    grimorioService.deleteGrimorio(req.params.id);
    emitUpdate('effectTemplates:updated', effectTemplateService.getAllEffectTemplates());
    emitUpdate('grimorios:updated', grimorioService.listGrimorios());
    res.json({ success: true });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/grimorios/:id/spells', requireGmAuth, (req, res) => {
  try {
    const spell = grimorioService.createSpell(req.params.id, req.body);
    emitUpdate('grimorios:updated', grimorioService.listGrimorios());
    res.json(spell);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/grimorio-spells/:spellId', requireGmAuth, (req, res) => {
  try {
    const grimorio = grimorioService.updateSpell(req.params.spellId, req.body);
    emitUpdate('grimorios:updated', grimorioService.listGrimorios());
    res.json(grimorio);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.delete('/grimorio-spells/:spellId', requireGmAuth, (req, res) => {
  try {
    const grimorio = grimorioService.deleteSpell(req.params.spellId);
    emitUpdate('grimorios:updated', grimorioService.listGrimorios());
    res.json(grimorio);
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.post('/grimorio-spells/:spellId/cast', (req, res) => {
  try {
    const { characterId } = req.body;
    if (!characterId) return res.status(400).json({ error: 'characterId obrigatório' });
    if (!authorizeCharacter(req, res, String(characterId), ['spell_cast'])) return;
    const character = grimorioService.castSpell(req.params.spellId, characterId);
    emitUpdate('character:updated', character);
    res.json({ character, spellUses: grimorioService.getSpellUsesForCharacter(characterId) });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.get('/characters/:charId/grimorio-uses', (req, res) => {
  try { res.json(grimorioService.getSpellUsesForCharacter(req.params.charId)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

// ======================== JOGADORES ========================

router.get('/players/public', (_req: Request, res: Response) => {
  if (!isGmSessionOpen()) return res.status(423).json({ error: 'O mestre ainda nao selecionou a campanha', locked: true });
  res.json(playerService.getPublicPlayers());
});

router.post('/players/login', (req: Request, res: Response) => {
  if (!isGmSessionOpen()) return res.status(423).json({ error: 'O mestre ainda nao selecionou a campanha', locked: true });
  const { playerId, password = '' } = req.body;
  if (!playerId) return res.status(400).json({ error: 'playerId obrigatorio' });
  if (tooManyAttempts(req, res, 'player')) return;
  const player = playerService.validatePlayerLogin(String(playerId), String(password));
  if (!player) { recordFailure(req, 'player'); return res.status(401).json({ error: 'Senha incorreta' }); }
  res.json({ ...player, sessionToken: createPlayerSession(player.id) });
});

router.get('/players', (_req: Request, res: Response) => {
  res.json(playerService.getAllPlayers());
});

router.get('/players/:id', (req: Request, res: Response) => {
  const player = playerService.getPlayerById(req.params.id);
  if (!player) return res.status(404).json({ error: 'Jogador nao encontrado' });
  res.json(player);
});

router.post('/players', (req: Request, res: Response) => {
  if (!isGmSessionOpen()) return res.status(423).json({ error: 'O mestre ainda nao selecionou a campanha', locked: true });
  try {
    const gm = isGm(req);
    const body = req.body ?? {};
    const name = String(body.name ?? '').trim();
    if (!name) return res.status(400).json({ error: 'Nome obrigatorio' });
    assertTextLength(name, 60, 'Nome');
    assertTextLength(body.password, 200, 'Senha');
    // Auto-cadastro do jogador nunca escolhe o proprio papel nem o personagem.
    const dto = {
      ...body,
      name,
      color: isSafeColor(body.color) ? body.color : '#6366f1',
      permission: gm && body.permission === 'gm' ? 'gm' : 'player',
      characterId: gm ? body.characterId : null,
    };
    const player = playerService.createPlayer(dto);
    emitUpdate('player:updated', player);
    emitUpdate('players:online', playerService.getAllPlayers());
    res.status(201).json(gm ? player : { ...player, sessionToken: createPlayerSession(player.id) });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/players/:id', requireGmAuth, (req: Request, res: Response) => {
  try {
    if (req.body?.color !== undefined && !isSafeColor(req.body.color)) return res.status(400).json({ error: 'Cor invalida' });
    assertTextLength(req.body?.name, 60, 'Nome');
    const player = playerService.updatePlayer(req.params.id, req.body);
    if (!player) return res.status(404).json({ error: 'Jogador nao encontrado' });
    emitUpdate('player:updated', player);
    res.json(player);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/players/:id/characters', requireGmAuth, (req: Request, res: Response) => {
  try {
    const { characterIds } = req.body as { characterIds: string[] };
    characterService.setPlayerCharacters(req.params.id, characterIds ?? []);
    const chars = characterService.getAllCharacters();
    chars.filter((c) => c.playerId === req.params.id || characterIds.includes(c.id))
      .forEach((c) => emitUpdate('character:updated', c));
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/players/:id', requireGmAuth, (req: Request, res: Response) => {
  try {
    const deleted = playerService.deletePlayer(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Jogador nao encontrado' });
    deletePlayerSessions(req.params.id);
    emitUpdate('player:removed', { id: req.params.id });
    emitUpdate('players:online', playerService.getAllPlayers());
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ======================== PERSONAGENS ========================

router.get('/characters', (_req: Request, res: Response) => {
  res.json(characterService.getAllCharacters());
});

router.get('/characters/:id', (req: Request, res: Response) => {
  const character = characterService.getCharacterById(req.params.id);
  if (!character) return res.status(404).json({ error: 'Personagem nao encontrado' });
  res.json(character);
});

// Campos da ficha que so o mestre altera (dono, tipo, permissoes, deslocamento).
const GM_ONLY_CHARACTER_FIELDS = ['playerId', 'type', 'playerPermissions', 'displacement'];
// O que conta como "alterar recursos" (permissao resource_change); o resto e character_update.
const RESOURCE_FIELDS = ['currentResources', 'conditions', 'inspiration'];

function validateCharacterInput(body: any): void {
  assertAvatar(body?.avatar);
  assertTextLength(body?.name, 100, 'Nome');
  assertTextLength(body?.description, 20000, 'Descricao');
}

/** Quais campos do dto realmente mudam em relacao a ficha atual. */
function changedCharacterFields(current: any, dto: any): string[] {
  const norm = (v: any) => JSON.stringify(v ?? null);
  const stripIds = (list: any[]) => (Array.isArray(list) ? list.map(({ id, ...rest }: any) => rest) : list);
  return Object.keys(dto).filter((k) => {
    const next = dto[k];
    const cur = current[k];
    if (next && typeof next === 'object' && !Array.isArray(next) && cur && typeof cur === 'object' && !Array.isArray(cur)) {
      return Object.keys(next).some((sub) => norm(next[sub]) !== norm(cur[sub]));
    }
    if (k === 'attributes') return norm(stripIds(next)) !== norm(stripIds(cur));
    return norm(next) !== norm(cur);
  });
}

router.post('/characters', (req: Request, res: Response) => {
  try {
    validateCharacterInput(req.body);
    let dto = req.body;
    if (!isGm(req)) {
      const player = sessionPlayer(req);
      if (!player) return denyPlayerAuth(res);
      // Jogador so cria personagem jogador para si mesmo.
      dto = { ...omit(req.body ?? {}, GM_ONLY_CHARACTER_FIELDS), type: 'pc', playerId: player.id };
    }
    const character = characterService.createCharacter(dto);
    emitUpdate('character:updated', character);
    res.status(201).json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/characters/:id', (req: Request, res: Response) => {
  try {
    validateCharacterInput(req.body);
    let dto = req.body ?? {};
    if (!isGm(req)) {
      const owner = authorizeCharacter(req, res, req.params.id);
      if (!owner) return;
      dto = omit(dto, GM_ONLY_CHARACTER_FIELDS);
      const changed = changedCharacterFields(owner.character, dto);
      const actions: PlayerActionKey[] = [];
      if (changed.some((k) => RESOURCE_FIELDS.includes(k))) actions.push('resource_change');
      if (changed.some((k) => !RESOURCE_FIELDS.includes(k))) actions.push('character_update');
      if (!authorizeCharacter(req, res, req.params.id, actions)) return;
      dto = Object.fromEntries(changed.map((k) => [k, dto[k]]));
    }
    req.body = dto;
    const character = characterService.updateCharacter(req.params.id, dto);
    if (!character) return res.status(404).json({ error: 'Personagem nao encontrado' });
    emitUpdate('character:updated', character);
    if (req.body.currentResources) {
      const session = combatService.syncCharacterResources(req.params.id, req.body.currentResources);
      if (session) emitUpdate('combat:updated', session);
    }
    res.json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/characters/:id', requireGmAuth, (req: Request, res: Response) => {
  try {
    const deleted = characterService.deleteCharacter(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Personagem nao encontrado' });
    emitUpdate('character:removed', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ======================== HABILIDADES ========================

// Habilidade/item precisam ser do personagem da URL — senao dava pra mexer
// na habilidade de outro personagem passando o proprio charId.
function skillOf(charId: string, skillId: string) {
  const skill = characterService.getSkillById(skillId);
  return skill && skill.characterId === charId ? skill : null;
}
function itemOf(charId: string, itemId: string) {
  const item = characterItemService.getCharacterItemById(itemId);
  return item && item.characterId === charId ? item : null;
}

router.post('/characters/:charId/skills', (req: Request, res: Response) => {
  try {
    if (!authorizeCharacter(req, res, req.params.charId, ['skill_create'])) return;
    const skill = characterService.createSkill(req.params.charId, req.body);
    const character = characterService.getCharacterById(req.params.charId);
    if (character) emitUpdate('character:updated', character);
    res.status(201).json(skill);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/characters/:charId/skills/reorder', (req: Request, res: Response) => {
  try {
    if (!authorizeCharacter(req, res, req.params.charId, ['skill_update'])) return;
    const skills = characterService.reorderSkills(req.params.charId, req.body.orderedIds);
    const character = characterService.getCharacterById(req.params.charId);
    if (character) emitUpdate('character:updated', character);
    res.json(skills);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/characters/:charId/skills/:skillId', (req: Request, res: Response) => {
  try {
    if (!authorizeCharacter(req, res, req.params.charId, ['skill_update'])) return;
    if (!skillOf(req.params.charId, req.params.skillId)) return res.status(404).json({ error: 'Habilidade nao encontrada' });
    const skill = characterService.updateSkill(req.params.skillId, req.body);
    if (!skill) return res.status(404).json({ error: 'Habilidade nao encontrada' });
    const character = characterService.getCharacterById(req.params.charId);
    if (character) emitUpdate('character:updated', character);
    res.json(skill);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/characters/:charId/skills/:skillId', (req: Request, res: Response) => {
  try {
    if (!authorizeCharacter(req, res, req.params.charId, ['skill_delete'])) return;
    if (!skillOf(req.params.charId, req.params.skillId)) return res.status(404).json({ error: 'Habilidade nao encontrada' });
    const deleted = characterService.deleteSkill(req.params.skillId);
    if (!deleted) return res.status(404).json({ error: 'Habilidade nao encontrada' });
    const character = characterService.getCharacterById(req.params.charId);
    if (character) emitUpdate('character:updated', character);
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/characters/:charId/skills/:skillId/use', (req: Request, res: Response) => {
  try {
    if (!authorizeCharacter(req, res, req.params.charId, ['skill_use'])) return;
    if (!skillOf(req.params.charId, req.params.skillId)) return res.status(404).json({ error: 'Habilidade nao encontrada' });
    characterService.useSkill(req.params.skillId);
    const character = characterService.getCharacterById(req.params.charId);
    if (!character) return res.status(404).json({ error: 'Personagem nao encontrado' });
    emitUpdate('character:updated', character);
    res.json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// Engatilhar: aplica o custo/ganho de recursos da habilidade. E o caminho usado
// quando a permissao skill_use esta como "livre" — o mesmo efeito que a aprovacao
// de uma solicitacao skill_trigger produz.
router.post('/characters/:charId/skills/:skillId/trigger', (req: Request, res: Response) => {
  try {
    if (!authorizeCharacter(req, res, req.params.charId, ['skill_use'])) return;
    if (!skillOf(req.params.charId, req.params.skillId)) return res.status(404).json({ error: 'Habilidade nao encontrada' });
    const character = characterService.triggerSkill(req.params.charId, req.params.skillId);
    if (!character) return res.status(404).json({ error: 'Personagem nao encontrado' });
    emitUpdate('character:updated', character);
    res.json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/characters/:charId/rest', (req: Request, res: Response) => {
  try {
    if (!authorizeCharacter(req, res, req.params.charId, ['rest'])) return;
    characterService.restCharacter(req.params.charId);
    grimorioService.restCharacterSpells(req.params.charId);
    const character = characterService.getCharacterById(req.params.charId);
    if (!character) return res.status(404).json({ error: 'Personagem nao encontrado' });
    emitUpdate('character:updated', character);
    res.json(character);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ======================== HISTORICO ========================

router.get('/history', (req: Request, res: Response) => {
  const limit = parseInt(req.query.limit as string) || 50;
  res.json(getHistory(limit));
});


// ======================== BIBLIOTECA DE HABILIDADES ========================

router.get('/skill-templates', (_req: Request, res: Response) => {
  res.json(skillTemplateService.getAllTemplates());
});

router.get('/skill-templates/:id', (req: Request, res: Response) => {
  const tpl = skillTemplateService.getTemplateById(req.params.id);
  if (!tpl) return res.status(404).json({ error: 'Template nao encontrado' });
  res.json(tpl);
});

router.post('/skill-templates', requireGmAuth, (req: Request, res: Response) => {
  try {
    const tpl = skillTemplateService.createTemplate(req.body);
    emitUpdate('skill_template:updated', tpl);
    res.status(201).json(tpl);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/skill-templates/:id', requireGmAuth, (req: Request, res: Response) => {
  try {
    const tpl = skillTemplateService.updateTemplate(req.params.id, req.body);
    if (!tpl) return res.status(404).json({ error: 'Template nao encontrado' });
    emitUpdate('skill_template:updated', tpl);
    res.json(tpl);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/skill-templates/:id', requireGmAuth, (req: Request, res: Response) => {
  try {
    const deleted = skillTemplateService.deleteTemplate(req.params.id);
    if (!deleted) return res.status(404).json({ error: 'Template nao encontrado' });
    emitUpdate('skill_template:removed', { id: req.params.id });
    res.json({ success: true });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});


// ======================== SOLICITAÇÕES DE JOGADORES ========================

router.get('/requests', (_req: Request, res: Response) => {
  res.json(characterRequestService.getAllRequests());
});

/** Pedido do jogador: o personagem tem que ser dele e o autor vem da sessao, nao do corpo. */
function requestBody(req: Request, res: Response): any | null {
  const body = req.body ?? {};
  const owner = authorizeCharacter(req, res, String(body.characterId ?? ''));
  if (!owner) return null;
  try {
    assertTextLength(body.description, 2000, 'Descricao');
    if (JSON.stringify(body.payload ?? null).length > 2_000_000) throw new Error('Pedido grande demais.');
  } catch (e: any) { res.status(400).json({ error: e.message }); return null; }
  if (owner.gm) return body;
  return { ...body, playerId: owner.player!.id, playerName: owner.player!.name };
}

router.post('/requests', (req: Request, res: Response) => {
  try {
    const body = requestBody(req, res);
    if (!body) return;
    const request = characterRequestService.createRequest(body);
    const io = getIO();
    if (io) io.emit('request:new', request);
    res.status(201).json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/requests/free', (req: Request, res: Response) => {
  try {
    const body = requestBody(req, res);
    if (!body) return;
    const request = characterRequestService.createFreeRequest(body);
    const io = getIO();
    if (io) io.emit('request:new', request);
    res.status(201).json(request);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/requests/:id/review', requireGmAuth, (req: Request, res: Response) => {
  try {
    const { action } = req.body;
    if (action !== 'approved' && action !== 'denied') {
      return res.status(400).json({ error: 'action deve ser approved ou denied' });
    }
    const updated = characterRequestService.reviewRequest(req.params.id, action);
    if (!updated) return res.status(404).json({ error: 'Solicitacao nao encontrada ou ja resolvida' });
    const io = getIO();
    if (io) {
      io.emit('request:updated', updated);
      io.emit('request:reviewed', updated);
      if (action === 'approved') {
        const char = characterService.getCharacterById(updated.characterId);
        if (char) {
          io.emit('character:updated', char);
          if (updated.type === 'resource_change' || updated.type === 'spell_cast' || updated.type === 'skill_trigger') {
            const session = combatService.syncCharacterResources(updated.characterId, char.currentResources);
            if (session) io.emit('combat:updated', session);
          }
        }
      }
    }
    res.json(updated);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// ======================== EFFECT TEMPLATES ========================

router.get('/effect-templates', (_req, res) => res.json(effectTemplateService.getAllEffectTemplates()));

router.post('/effect-templates', requireGmAuth, (req, res) => {
  try { res.status(201).json(effectTemplateService.createEffectTemplate(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.put('/effect-templates/:id', requireGmAuth, (req, res) => {
  const updated = effectTemplateService.updateEffectTemplate(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Efeito nao encontrado' });

  // Propagate changes to item templates and character items that reference this effect
  const affectedCharIds = effectTemplateService.propagateEffectUpdate(req.params.id, updated);
  affectedCharIds.forEach(charId => {
    const char = characterService.getCharacterById(charId);
    if (char) emitUpdate('character:updated', char);
  });
  // Notify clients to refresh item templates (effects may have changed)
  emitUpdate('itemTemplates:updated', itemTemplateService.getAllItemTemplates());

  res.json(updated);
});

router.delete('/effect-templates/:id', requireGmAuth, (req, res) => {
  effectTemplateService.deleteEffectTemplate(req.params.id)
    ? res.json({ success: true })
    : res.status(404).json({ error: 'Faixa nao encontrada' });
});

// Goals
router.get('/goals', (_req, res) => res.json(campaignExtras.getAllGoals()));

router.post('/goals', requireGmAuth, (req, res) => {
  try { res.status(201).json(campaignExtras.createGoal(req.body)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/goals/:id', requireGmAuth, (req, res) => {
  const r = campaignExtras.updateGoal(req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'Meta nao encontrada' });
  res.json(r);
});

router.delete('/goals/:id', requireGmAuth, (req, res) => {
  campaignExtras.deleteGoal(req.params.id)
    ? res.json({ success: true })
    : res.status(404).json({ error: 'Meta nao encontrada' });
});


// ── Item Templates ────────────────────────────────────────────────────────────
router.get('/item-templates', (_req, res) => res.json(itemTemplateService.getAllItemTemplates()));

router.post('/item-templates', requireGmAuth, (req, res) => {
  try { res.status(201).json(itemTemplateService.createItemTemplate(req.body)); }
  catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.put('/item-templates/:id', requireGmAuth, (req, res) => {
  const updated = itemTemplateService.updateItemTemplate(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: 'Template nao encontrado' });

  // Propagate effect changes to character items created from this template
  const affectedCharIds = itemTemplateService.propagateItemTemplateEffects(req.params.id, updated.effects);
  affectedCharIds.forEach(charId => {
    const char = characterService.getCharacterById(charId);
    if (char) emitUpdate('character:updated', char);
  });

  res.json(updated);
});

router.delete('/item-templates/:id', requireGmAuth, (req, res) => {
  itemTemplateService.deleteItemTemplate(req.params.id)
    ? res.json({ success: true })
    : res.status(404).json({ error: 'Template nao encontrado' });
});

// ── Character Items ───────────────────────────────────────────────────────────
router.get('/characters/:charId/items', (req, res) => {
  res.json(characterItemService.getItemsForCharacter(req.params.charId));
});

router.post('/characters/:charId/items', (req, res) => {
  try {
    if (!authorizeCharacter(req, res, req.params.charId, ['item_add'])) return;
    const item = characterItemService.addItemToCharacter(req.params.charId, req.body);
    const char = characterService.getCharacterById(req.params.charId);
    if (char) emitUpdate('character:updated', char);
    res.status(201).json(item);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.put('/characters/:charId/items/:itemId', (req, res) => {
  try {
    const onlyEquip = Object.keys(req.body ?? {}).every((k) => k === 'equipped');
    if (!authorizeCharacter(req, res, req.params.charId, [onlyEquip ? 'item_equip' : 'item_update'])) return;
    if (!itemOf(req.params.charId, req.params.itemId)) return res.status(404).json({ error: 'Item nao encontrado' });
    const item = characterItemService.updateCharacterItem(req.params.itemId, req.body);
    if (!item) return res.status(404).json({ error: 'Item nao encontrado' });
    const char = characterService.getCharacterById(req.params.charId);
    if (char) emitUpdate('character:updated', char);
    res.json(item);
  } catch (err: any) { res.status(400).json({ error: err.message }); }
});

router.delete('/characters/:charId/items/:itemId', (req, res) => {
  if (!authorizeCharacter(req, res, req.params.charId, ['item_remove'])) return;
  if (!itemOf(req.params.charId, req.params.itemId)) return res.status(404).json({ error: 'Item nao encontrado' });
  const ok = characterItemService.removeItemFromCharacter(req.params.itemId);
  if (!ok) return res.status(404).json({ error: 'Item nao encontrado' });
  const char = characterService.getCharacterById(req.params.charId);
  if (char) emitUpdate('character:updated', char);
  res.json({ success: true });
});

router.post('/characters/:charId/items/:itemId/use', (req, res) => {
  try {
    const { charId, itemId } = req.params;
    if (!authorizeCharacter(req, res, charId, ['item_use'])) return;
    const qty = Math.max(1, Math.floor(Number(req.body?.quantity ?? 1)));

    const char = characterService.getCharacterById(charId);
    if (!char) return res.status(404).json({ error: 'Personagem nao encontrado' });

    const item = characterItemService.getCharacterItemById(itemId);
    if (!item || item.characterId !== charId) return res.status(404).json({ error: 'Item nao encontrado' });
    if (item.type !== 'consumable') return res.status(400).json({ error: 'Item nao e consumivel' });

    // Find active combat and participant
    const activeCombat = combatService.getActiveSession();
    const participant = activeCombat?.participants.find(p => p.characterId === charId) ?? null;

    // Accumulate immediate stat deltas (scaled by qty), keyed dynamically by recurso/protecao
    const dCurrent: Record<string, number> = {};
    const dMax: Record<string, number> = {};
    const dProt: Record<string, number> = {};
    let dMovement = 0;

    for (const effect of item.effects) {
      const hasDuration = effect.duration && effect.duration > 0;

      if (hasDuration && participant && activeCombat) {
        for (let i = 0; i < qty; i++) {
          combatService.addEffect(activeCombat.id, participant.uid, {
            name: effect.name,
            icon: effect.icon,
            color: effect.color,
            description: effect.description,
            durationRounds: effect.duration!,
            applications: effect.applications,
          });
        }
      } else {
        for (const app of effect.applications) {
          const d = (app.operation === 'add' ? app.value : -app.value) * qty;
          const res = parseResourceStat(app.stat);
          const prot = parseProtectionStat(app.stat);
          if (res) {
            const target = res.field === 'max' ? dMax : dCurrent;
            target[res.key] = (target[res.key] ?? 0) + d;
          } else if (prot) {
            dProt[prot.key] = (dProt[prot.key] ?? 0) + d;
          } else if (app.stat === 'movement') {
            dMovement += d;
          }
        }
      }
    }

    const hasChange = Object.keys(dCurrent).length > 0 || Object.keys(dMax).length > 0
      || Object.keys(dProt).length > 0 || dMovement !== 0;

    if (hasChange) {
      const newMax: Record<string, number> = { ...char.resources };
      for (const [k, d] of Object.entries(dMax)) newMax[k] = (newMax[k] ?? 0) + d;

      const newCurrent: Record<string, number> = { ...char.currentResources };
      for (const key of Object.keys(newMax)) {
        const d = dCurrent[key] ?? 0;
        newCurrent[key] = Math.min(Math.max(0, (newCurrent[key] ?? 0) + d), newMax[key]);
      }

      const newProtections: Record<string, number> = { ...char.protections };
      for (const [k, d] of Object.entries(dProt)) newProtections[k] = Math.max(0, (newProtections[k] ?? 0) + d);

      characterService.updateCharacter(charId, {
        resources: newMax,
        currentResources: newCurrent,
        protections: newProtections,
        ...(dMovement ? { displacement: Math.max(0, (char.displacement ?? DEFAULT_DISPLACEMENT) + dMovement) } : {}),
      });

      if (participant && activeCombat && Object.keys(dCurrent).length > 0) {
        const participantCurrent: Record<string, number> = { ...participant.currentResources };
        for (const [key, d] of Object.entries(dCurrent)) {
          participantCurrent[key] = Math.min(Math.max(0, (participantCurrent[key] ?? 0) + d), newMax[key] ?? Infinity);
        }
        combatService.updateParticipant(activeCombat.id, participant.uid, {
          currentResources: participantCurrent,
        });
      }
    }

    // Decrement/remove consumable
    const { item: remaining } = characterItemService.useConsumable(itemId, qty);

    // Emit updates
    const updatedChar = characterService.getCharacterById(charId);
    if (updatedChar) emitUpdate('character:updated', updatedChar);
    if (activeCombat && participant) {
      const updatedCombat = combatService.getSessionById(activeCombat.id);
      if (updatedCombat) emitUpdate('combat:updated', updatedCombat);
    }

    res.json({ success: true, item: remaining });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Combat ────────────────────────────────────────────────────────────────────
router.get('/combat/active', (_req, res) => {
  const session = combatService.getActiveSession();
  res.json(session ?? null);
});

router.get('/combat', (_req, res) => res.json(combatService.getAllSessions()));

router.post('/combat', requireGmAuth, (req, res) => {
  const session = combatService.createSession(req.body);
  characterService.resetCombatSkillsForAll();
  grimorioService.resetCombatSpellsForAll();
  emitUpdate('combat:updated', session);
  res.status(201).json(session);
});

router.post('/combat/:id/end', requireGmAuth, (req, res) => {
  const session = combatService.endSession(req.params.id);
  if (!session) return res.status(404).json({ error: 'Combate nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.post('/combat/:id/participants', requireGmAuth, (req, res) => {
  const session = combatService.addParticipant(req.params.id, req.body);
  if (!session) return res.status(404).json({ error: 'Combate nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.delete('/combat/:id/participants/:uid', requireGmAuth, (req, res) => {
  const session = combatService.removeParticipant(req.params.id, req.params.uid);
  if (!session) return res.status(404).json({ error: 'Combate ou participante nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.put('/combat/:id/participants/:uid', requireGmAuth, (req, res) => {
  const session = combatService.updateParticipant(req.params.id, req.params.uid, req.body);
  if (!session) return res.status(404).json({ error: 'Nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.post('/combat/:id/next-turn', requireGmAuth, (req, res) => {
  const session = combatService.nextTurn(req.params.id);
  if (!session) return res.status(404).json({ error: 'Combate nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.post('/combat/:id/participants/:uid/effects', requireGmAuth, (req, res) => {
  const session = combatService.addEffect(req.params.id, req.params.uid, req.body);
  if (!session) return res.status(404).json({ error: 'Nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.delete('/combat/:id/participants/:uid/effects/:effectUid', requireGmAuth, (req, res) => {
  const session = combatService.removeEffect(req.params.id, req.params.uid, req.params.effectUid);
  if (!session) return res.status(404).json({ error: 'Nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.put('/combat/:id/reorder', requireGmAuth, (req, res) => {
  const session = combatService.reorderParticipants(req.params.id, req.body.orderedUids);
  if (!session) return res.status(404).json({ error: 'Combate nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

// ── Combat map & movement ─────────────────────────────────────────────────────
router.put('/combat/:id/map', requireGmAuth, (req, res) => {
  const session = combatService.selectMap(req.params.id, req.body.mapId ?? null);
  if (!session) return res.status(404).json({ error: 'Combate nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.post('/combat/:id/assign-node', requireGmAuth, (req, res) => {
  const { participantUid, nodeId } = req.body;
  const session = combatService.assignNode(req.params.id, participantUid, nodeId ?? null);
  if (!session) return res.status(404).json({ error: 'Nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.put('/combat/:id/displacement-mode', requireGmAuth, (req, res) => {
  const session = combatService.setDisplacementMode(req.params.id, req.body.mode);
  if (!session) return res.status(404).json({ error: 'Combate nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.put('/combat/:id/participants/:uid/remaining-displacement', requireGmAuth, (req, res) => {
  const session = combatService.setRemainingDisplacement(req.params.id, req.params.uid, req.body.value);
  if (!session) return res.status(404).json({ error: 'Nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

/** Jogador so move o proprio participante (o mestre move qualquer um). */
function canMoveParticipant(req: Request, res: Response, combatId: string, participantUid: unknown): boolean {
  if (isGm(req)) return true;
  const player = sessionPlayer(req);
  if (!player) { denyPlayerAuth(res); return false; }
  const session = combatService.getSessionById(combatId);
  const participant = session?.participants.find((p) => p.uid === participantUid);
  const character = participant ? characterService.getCharacterById(participant.characterId) : null;
  if (!character || character.playerId !== player.id) {
    res.status(403).json({ error: 'Voce so pode mover o seu personagem.' });
    return false;
  }
  return true;
}

router.post('/combat/:id/undo-move', (req, res) => {
  if (!canMoveParticipant(req, res, req.params.id, req.body?.participantUid)) return;
  const session = combatService.undoMove(req.params.id, req.body.participantUid);
  if (!session) return res.status(400).json({ error: 'Sem movimento para desfazer' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.post('/combat/:id/move', (req, res) => {
  const { participantUid, pathId } = req.body;
  if (!canMoveParticipant(req, res, req.params.id, participantUid)) return;
  const result = combatService.moveParticipant(req.params.id, participantUid, pathId);
  if (!result) return res.status(404).json({ error: 'Combate nao encontrado' });
  if (result.result === 'error') return res.status(400).json({ error: result.message });
  emitUpdate('combat:updated', result.session);
  res.json({ result: result.result, session: result.session });
});

router.put('/combat/:id/map-visibility', requireGmAuth, (req, res) => {
  const level = Number(req.body.level) as 1 | 2 | 3 | 4;
  if (![1, 2, 3, 4].includes(level)) return res.status(400).json({ error: 'Nivel invalido' });
  const session = combatService.setMapVisibility(req.params.id, level);
  if (!session) return res.status(404).json({ error: 'Combate nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

router.put('/combat/:id/participants/:uid/movement-lock', requireGmAuth, (req, res) => {
  const session = combatService.setParticipantMovement(req.params.id, req.params.uid, !!req.body.blocked);
  if (!session) return res.status(404).json({ error: 'Nao encontrado' });
  emitUpdate('combat:updated', session);
  res.json(session);
});

// ── Maps ──────────────────────────────────────────────────────────────────────
router.get('/maps', (_req, res) => res.json(mapService.getAllMaps()));

router.post('/maps', requireGmAuth, (req, res) => {
  const map = mapService.createMap(req.body);
  res.status(201).json(map);
});

router.get('/maps/:id', (req, res) => {
  const map = mapService.getMapById(req.params.id);
  if (!map) return res.status(404).json({ error: 'Mapa nao encontrado' });
  res.json(map);
});

router.put('/maps/:id', requireGmAuth, (req, res) => {
  const map = mapService.updateMap(req.params.id, req.body);
  if (!map) return res.status(404).json({ error: 'Mapa nao encontrado' });
  emitUpdate('map:updated', map);
  res.json(map);
});

router.delete('/maps/:id', requireGmAuth, (req, res) => {
  mapService.deleteMap(req.params.id);
  res.json({ success: true });
});

// ── Campaign extras ───────────────────────────────────────────────────────────
router.get('/campaign-events', (_req, res) => res.json(campaignExtras.getAllEvents()));

router.post('/campaign-events', requireGmAuth, (req, res) => {
  try { res.status(201).json(campaignExtras.createEvent(req.body)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/campaign-events/:id', requireGmAuth, (req, res) => {
  const r = campaignExtras.updateEvent(req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'Evento nao encontrado' });
  res.json(r);
});

router.delete('/campaign-events/:id', requireGmAuth, (req, res) => {
  campaignExtras.deleteEvent(req.params.id)
    ? res.json({ success: true })
    : res.status(404).json({ error: 'Evento nao encontrado' });
});

router.get('/playlists', (_req, res) => res.json(campaignExtras.getAllPlaylists()));

router.post('/playlists', requireGmAuth, (req, res) => {
  try { res.status(201).json(campaignExtras.createPlaylist(req.body)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/playlists/:id', requireGmAuth, (req, res) => {
  const r = campaignExtras.updatePlaylist(req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'Playlist nao encontrada' });
  res.json(r);
});

router.delete('/playlists/:id', requireGmAuth, (req, res) => {
  campaignExtras.deletePlaylist(req.params.id)
    ? res.json({ success: true })
    : res.status(404).json({ error: 'Playlist nao encontrada' });
});

router.post('/playlists/:playlistId/tracks', requireGmAuth, (req, res) => {
  try { res.status(201).json(campaignExtras.addTrack(req.params.playlistId, req.body)); }
  catch (e: any) { res.status(400).json({ error: e.message }); }
});

router.put('/tracks/:id', requireGmAuth, (req, res) => {
  const r = campaignExtras.updateTrack(req.params.id, req.body);
  if (!r) return res.status(404).json({ error: 'Faixa nao encontrada' });
  res.json(r);
});

router.delete('/tracks/:id', requireGmAuth, (req, res) => {
  campaignExtras.deleteTrack(req.params.id)
    ? res.json({ success: true })
    : res.status(404).json({ error: 'Faixa nao encontrada' });
});

// ======================== YOUTUBE MUSIC (trilha sonora) ========================
//
// Tudo aqui e do mestre: sao as playlists da conta Google DELE. Jogador nao toca
// nessas rotas. A unica sem requireGmAuth e o /callback, que quem chama e o
// navegador voltando do consentimento do Google (sem headers nossos) — ela se
// protege pelo `state` de uso unico emitido em /auth-url.

/** Converte erros do servico em resposta HTTP, distinguindo "precisa relogar". */
function ytError(res: Response, e: any) {
  const status = e?.name === 'YouTubeAuthError' ? 401 : 400;
  res.status(status).json({ error: e?.message ?? 'Erro na integracao com o YouTube', reauth: status === 401 });
}

router.get('/music/youtube/status', requireGmAuth, (_req, res) => {
  res.json(youtubeMusic.getStatus());
});

router.put('/music/youtube/config', requireGmAuth, (req, res) => {
  try { res.json(youtubeMusic.setConfig(req.body?.clientId ?? '', req.body?.clientSecret ?? '')); }
  catch (e: any) { ytError(res, e); }
});

router.post('/music/youtube/auth-url', requireGmAuth, (req, res) => {
  try {
    const redirectUri = String(req.body?.redirectUri ?? '');
    // O Google so aceita redirect http fora de https quando e loopback; barrar
    // aqui devolve um erro claro em vez de um "redirect_uri_mismatch" opaco.
    if (!/^https:\/\//.test(redirectUri) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(redirectUri)) {
      return res.status(400).json({
        error: 'O login do Google so funciona a partir de http://localhost (ou HTTPS). Abra o painel do mestre por localhost para conectar a conta.',
      });
    }
    res.json({ url: youtubeMusic.buildAuthUrl(redirectUri) });
  } catch (e: any) { ytError(res, e); }
});

router.get('/music/youtube/callback', async (req, res) => {
  const finish = (ok: boolean, rawMessage: string) => {
    // A mensagem carrega texto vindo da URL (?error=) e de erro externo: escapar
    // evita XSS refletido na origem do app (onde fica o token do mestre).
    const message = escapeHtml(rawMessage);
    // Abre numa popup: avisa o opener e fecha sozinha.
    res.send(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>YouTube Music</title></head>
<body style="font-family:system-ui,sans-serif;background:#0f1117;color:#e2e8f0;padding:40px;text-align:center">
  <p style="font-size:15px">${message}</p>
  <p style="font-size:13px;color:#64748b">Pode fechar esta janela.</p>
  <script>
    try { window.opener && window.opener.postMessage({ source: 'yt-music-auth', ok: ${ok} }, '*'); } catch (e) {}
    setTimeout(function () { window.close(); }, ${ok ? 800 : 4000});
  </script>
</body></html>`);
  };

  const error = req.query.error as string | undefined;
  if (error) return finish(false, `Autorizacao cancelada (${error}).`);

  try {
    await youtubeMusic.handleCallback(String(req.query.code ?? ''), String(req.query.state ?? ''));
    finish(true, 'Conta conectada com sucesso.');
  } catch (e: any) {
    finish(false, `Falha ao conectar: ${e?.message ?? 'erro desconhecido'}`);
  }
});

router.post('/music/youtube/disconnect', requireGmAuth, async (_req, res) => {
  try { await youtubeMusic.disconnect(); res.json(youtubeMusic.getStatus()); }
  catch (e: any) { ytError(res, e); }
});

router.get('/music/youtube/playlists', requireGmAuth, async (_req, res) => {
  try { res.json(await youtubeMusic.listPlaylists()); }
  catch (e: any) { ytError(res, e); }
});

router.get('/music/youtube/playlists/:id/items', requireGmAuth, async (req, res) => {
  try { res.json(await youtubeMusic.listPlaylistItems(req.params.id)); }
  catch (e: any) { ytError(res, e); }
});

router.get('/music/youtube/playlists/:id/info', requireGmAuth, async (req, res) => {
  try { res.json(await youtubeMusic.getPlaylistInfo(req.params.id)); }
  catch (e: any) { ytError(res, e); }
});

router.get('/music/youtube/search', requireGmAuth, async (req, res) => {
  try {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.json([]);
    res.json(await youtubeMusic.searchTracks(q));
  } catch (e: any) { ytError(res, e); }
});

router.post('/music/youtube/videos', requireGmAuth, async (req, res) => {
  try { res.json(await youtubeMusic.getVideos(req.body?.ids ?? [])); }
  catch (e: any) { ytError(res, e); }
});

export default router;
