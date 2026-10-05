import crypto from 'crypto';
import db from '../database/db';
import { Player } from '../types';
import { getPlayerById } from './playerService';

// Sessao de JOGADOR: antes o "login" do jogador era so o objeto do jogador
// guardado no localStorage, e o servidor nao sabia quem estava pedindo nada —
// qualquer um na rede (ou na sala online) podia editar ou apagar a ficha de
// qualquer personagem passando o id dele. Agora o login emite um token e as
// rotas de jogador conferem que o personagem e do dono do token.
//
// Fica no banco (e nao em memoria) para sobreviver a restart do servidor e ao
// F5 do mestre no modo online, sem derrubar os jogadores.

const TOKEN_RE = /^[0-9a-f]{64}$/;

export function createPlayerSession(playerId: string): string {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO player_sessions (token, player_id, created_at) VALUES (?, ?, ?)')
    .run(token, playerId, new Date().toISOString());
  return token;
}

export function getSessionPlayer(token: string | undefined | null): Player | null {
  if (!token || !TOKEN_RE.test(token)) return null;
  const row = db.prepare('SELECT player_id FROM player_sessions WHERE token = ?').get(token) as any;
  if (!row) return null;
  return getPlayerById(row.player_id);
}

export function deletePlayerSessions(playerId: string): void {
  db.prepare('DELETE FROM player_sessions WHERE player_id = ?').run(playerId);
}
