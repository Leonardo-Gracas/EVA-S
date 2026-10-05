import { Request, Response } from 'express';
import { isValidGmToken } from '../services/gmAuthService';
import { getSessionPlayer } from '../services/playerSessionService';
import * as characterService from '../services/characterService';
import * as campaignService from '../services/campaignService';
import { Character, Player, PlayerActionKey, DEFAULT_GLOBAL_PERMISSIONS } from '../types';

// Controle de acesso das rotas que o JOGADOR usa. O mestre (token de mestre
// valido) passa sempre. O jogador precisa de sessao (x-player-token), so mexe
// em personagem que e dele, e so faz direto o que a permissao deixa "livre" —
// "solicitar" vira pedido ao mestre (POST /requests) e "bloqueado" nao passa.
// Antes essas regras existiam so na tela do jogador, entao bastava chamar a
// API direto para ignora-las.

export function isGm(req: Request): boolean {
  return isValidGmToken(req.header('x-gm-token'));
}

export function sessionPlayer(req: Request): Player | null {
  return getSessionPlayer(req.header('x-player-token'));
}

export function denyPlayerAuth(res: Response): void {
  res.status(401).json({ error: 'Sessao de jogador expirada. Entre de novo.', code: 'PLAYER_AUTH' });
}

function effectivePermission(char: Character, action: PlayerActionKey) {
  const global = campaignService.getGlobalPermissions();
  return char.playerPermissions?.[action] ?? global?.[action] ?? DEFAULT_GLOBAL_PERMISSIONS[action];
}

export interface CharacterAccess { character: Character; gm: boolean; player: Player | null }

/**
 * Libera o acesso ao personagem `charId` ou responde o erro e devolve null.
 * `actions`: permissoes que precisam estar "livres" para o jogador.
 */
export function authorizeCharacter(
  req: Request, res: Response, charId: string, actions: PlayerActionKey[] = [],
): CharacterAccess | null {
  const character = characterService.getCharacterById(charId);
  if (!character) { res.status(404).json({ error: 'Personagem nao encontrado' }); return null; }
  if (isGm(req)) return { character, gm: true, player: null };

  const player = sessionPlayer(req);
  if (!player) { denyPlayerAuth(res); return null; }
  if (character.playerId !== player.id) {
    res.status(403).json({ error: 'Esse personagem nao e seu.' });
    return null;
  }
  for (const action of actions) {
    if (effectivePermission(character, action) !== 'free') {
      res.status(403).json({ error: 'Essa acao precisa de aprovacao do mestre.' });
      return null;
    }
  }
  return { character, gm: false, player };
}

/** Mestre ou jogador logado (sem checar personagem). */
export function requireGmOrPlayer(req: Request, res: Response): { gm: boolean; player: Player | null } | null {
  if (isGm(req)) return { gm: true, player: null };
  const player = sessionPlayer(req);
  if (!player) { denyPlayerAuth(res); return null; }
  return { gm: false, player };
}
