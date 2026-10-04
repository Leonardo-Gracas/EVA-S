import db from '../database/db';
import { Player, CreatePlayerDTO, UpdatePlayerDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logHistory } from './historyService';
import { hashPassword } from '../utils/password';

function rowToPlayer(row: any): Player {
  return {
    id: row.id,
    name: row.name,
    characterId: row.character_id,
    color: row.color,
    permission: row.permission,
    status: row.status,
    socketId: row.socket_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllPlayers(): Player[] {
  const rows = db.prepare('SELECT * FROM players ORDER BY created_at ASC').all() as any[];
  return rows.map(rowToPlayer);
}

export function getPublicPlayers(): Array<{ id: string; name: string; color: string; hasPassword: boolean }> {
  const rows = db.prepare('SELECT id, name, color, password_hash FROM players ORDER BY created_at ASC').all() as any[];
  return rows.map((r: any) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    hasPassword: !!r.password_hash,
  }));
}

export function validatePlayerLogin(playerId: string, password: string): Player | null {
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(playerId) as any;
  if (!row) return null;
  const stored = row.password_hash ?? '';
  if (stored === '' && password === '') return rowToPlayer(row);
  if (stored === '' && password !== '') return rowToPlayer(row);
  if (hashPassword(password) !== stored) return null;
  return rowToPlayer(row);
}

export function getPlayerById(id: string): Player | null {
  const row = db.prepare('SELECT * FROM players WHERE id = ?').get(id) as any;
  return row ? rowToPlayer(row) : null;
}

export function getPlayerBySocketId(socketId: string): Player | null {
  const row = db.prepare('SELECT * FROM players WHERE socket_id = ?').get(socketId) as any;
  return row ? rowToPlayer(row) : null;
}

export function createPlayer(dto: CreatePlayerDTO): Player {
  const id = uuidv4();
  const now = new Date().toISOString();
  const pwHash = hashPassword((dto as any).password ?? '');

  db.prepare(
    'INSERT INTO players (id, name, character_id, color, permission, status, socket_id, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)'
  ).run(id, dto.name, dto.characterId ?? null, dto.color, dto.permission, 'offline', pwHash, now, now);

  const player = getPlayerById(id)!;
  logHistory('player:created', `Jogador "${player.name}" criado`, { playerId: id });
  return player;
}

export function updatePlayer(id: string, dto: UpdatePlayerDTO): Player | null {
  const current = getPlayerById(id);
  if (!current) return null;

  const now = new Date().toISOString();

  db.prepare(
    'UPDATE players SET name = ?, character_id = ?, color = ?, permission = ?, updated_at = ? WHERE id = ?'
  ).run(
    dto.name ?? current.name,
    dto.characterId !== undefined ? dto.characterId : current.characterId,
    dto.color ?? current.color,
    dto.permission ?? current.permission,
    now,
    id
  );

  const updated = getPlayerById(id)!;
  logHistory('player:updated', `Jogador "${updated.name}" atualizado`, { playerId: id });
  return updated;
}

export function deletePlayer(id: string): boolean {
  const player = getPlayerById(id);
  if (!player) return false;

  db.prepare('DELETE FROM players WHERE id = ?').run(id);
  logHistory('player:deleted', `Jogador "${player.name}" removido`, { playerId: id });
  return true;
}

export function setPlayerOnline(playerId: string, socketId: string): Player | null {
  const now = new Date().toISOString();
  db.prepare(
    "UPDATE players SET status = 'online', socket_id = ?, updated_at = ? WHERE id = ?"
  ).run(socketId, now, playerId);
  return getPlayerById(playerId);
}

export function setPlayerOffline(socketId: string): Player | null {
  const now = new Date().toISOString();
  const player = getPlayerBySocketId(socketId);
  if (!player) return null;
  db.prepare(
    "UPDATE players SET status = 'offline', socket_id = NULL, updated_at = ? WHERE socket_id = ?"
  ).run(now, socketId);
  return getPlayerById(player.id);
}
