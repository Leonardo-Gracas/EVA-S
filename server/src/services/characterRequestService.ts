import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import { CharacterRequest, CreateCharacterRequestDTO } from '../types';
import * as characterService from './characterService';
import * as characterItemService from './characterItemService';
import * as grimorioService from './grimorioService';
import { logHistory } from './historyService';
import { isSafeImageUrl } from '../utils/sanitize';

function rowToRequest(row: any): CharacterRequest {
  return {
    id: row.id,
    characterId: row.character_id,
    playerId: row.player_id,
    playerName: row.player_name,
    type: row.type,
    description: row.description,
    payload: JSON.parse(row.payload),
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllRequests(): CharacterRequest[] {
  const rows = db.prepare(
    'SELECT * FROM character_requests ORDER BY created_at DESC'
  ).all() as any[];
  return rows.map(rowToRequest);
}

export function getPendingRequests(): CharacterRequest[] {
  const rows = db.prepare(
    "SELECT * FROM character_requests WHERE status = 'pending' ORDER BY created_at ASC"
  ).all() as any[];
  return rows.map(rowToRequest);
}

export function getRequestById(id: string): CharacterRequest | null {
  const row = db.prepare('SELECT * FROM character_requests WHERE id = ?').get(id) as any;
  return row ? rowToRequest(row) : null;
}

export function createRequest(dto: CreateCharacterRequestDTO): CharacterRequest {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO character_requests
     (id, character_id, player_id, player_name, type, description, payload, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(id, dto.characterId, dto.playerId, dto.playerName, dto.type, dto.description, JSON.stringify(dto.payload), now, now);
  return getRequestById(id)!;
}

export function createFreeRequest(dto: CreateCharacterRequestDTO): CharacterRequest {
  // Records a 'free' action already executed — for audit trail only, not applied again
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO character_requests
     (id, character_id, player_id, player_name, type, description, payload, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'free', ?, ?)`
  ).run(id, dto.characterId, dto.playerId, dto.playerName, dto.type, dto.description, JSON.stringify(dto.payload), now, now);
  logHistory('request:free', `Ação livre de ${dto.playerName}: ${dto.description}`, { requestId: id });
  return getRequestById(id)!;
}

export function reviewRequest(id: string, action: 'approved' | 'denied'): CharacterRequest | null {
  const req = getRequestById(id);
  if (!req || req.status !== 'pending') return null;

  const now = new Date().toISOString();
  db.prepare("UPDATE character_requests SET status = ?, updated_at = ? WHERE id = ?")
    .run(action, now, id);

  if (action === 'approved') {
    try {
      applyRequest(req);
    } catch (err: any) {
      // Roll back status if apply fails
      db.prepare("UPDATE character_requests SET status = 'pending', updated_at = ? WHERE id = ?").run(now, id);
      throw err;
    }
  }

  logHistory(
    `request:${action}`,
    `Solicitacao de ${req.playerName} ${action === 'approved' ? 'aprovada' : 'negada'}: ${req.description}`,
    { requestId: id }
  );

  return getRequestById(id);
}

// Pedido aprovado so pode mexer no proprio personagem do pedido: o payload
// vem do jogador e o mestre ve so a descricao/diff, entao um skillId/itemId de
// OUTRO personagem passaria batido.
function assertOwnSkill(characterId: string, skillId: unknown): void {
  const skill = characterService.getSkillById(String(skillId ?? ''));
  if (!skill || skill.characterId !== characterId) throw new Error('Habilidade nao pertence ao personagem do pedido');
}
function assertOwnItem(characterId: string, itemId: unknown): void {
  const item = characterItemService.getCharacterItemById(String(itemId ?? ''));
  if (!item || item.characterId !== characterId) throw new Error('Item nao pertence ao personagem do pedido');
}
const GM_ONLY_FIELDS = ['playerId', 'type', 'playerPermissions', 'displacement'];

function applyRequest(req: CharacterRequest): void {
  const p = req.payload ?? {};
  if (['skill_update', 'skill_delete', 'skill_trigger', 'skill_charge'].includes(req.type)) assertOwnSkill(req.characterId, p.skillId);
  if (['item_update', 'item_equip', 'item_remove', 'item_use'].includes(req.type)) assertOwnItem(req.characterId, p.itemId);
  if (req.type === 'character_update' && p.character && typeof p.character === 'object') {
    for (const k of GM_ONLY_FIELDS) delete p.character[k];
    const avatar = p.character.avatar;
    if (avatar !== undefined && avatar !== null && avatar !== '' && !isSafeImageUrl(avatar)) {
      throw new Error('Imagem de avatar invalida');
    }
  }
  switch (req.type) {
    case 'resource_change': {
      characterService.updateCharacter(req.characterId, {
        currentResources: p.currentResources,
        ...(p.inspiration !== undefined ? { inspiration: p.inspiration } : {}),
        ...(p.conditions !== undefined ? { conditions: p.conditions } : {}),
      });
      break;
    }
    case 'skill_create': {
      characterService.createSkill(req.characterId, p.skill);
      break;
    }
    case 'skill_update': {
      characterService.updateSkill(p.skillId, p.skill);
      break;
    }
    case 'skill_delete': {
      characterService.deleteSkill(p.skillId);
      break;
    }
    case 'character_update': {
      characterService.updateCharacter(req.characterId, p.character);
      break;
    }
    case 'item_add': {
      characterItemService.addItemToCharacter(req.characterId, p.item);
      break;
    }
    case 'item_update': {
      characterItemService.updateCharacterItem(p.itemId, p.item);
      break;
    }
    case 'item_equip': {
      characterItemService.updateCharacterItem(p.itemId, { equipped: p.equipped });
      break;
    }
    case 'item_remove': {
      characterItemService.removeItemFromCharacter(p.itemId);
      break;
    }
    case 'item_use': {
      characterItemService.useConsumable(p.itemId, p.quantity ?? 1);
      break;
    }
    case 'spell_cast': {
      grimorioService.castSpell(p.spellId, req.characterId);
      break;
    }
    case 'skill_trigger': {
      characterService.triggerSkill(req.characterId, p.skillId);
      break;
    }
    case 'skill_charge': {
      characterService.useSkill(p.skillId);
      break;
    }
    case 'rest': {
      characterService.restCharacter(req.characterId);
      grimorioService.restCharacterSpells(req.characterId);
      break;
    }
  }
}
