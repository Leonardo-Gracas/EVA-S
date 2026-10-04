import { Request, Response, NextFunction } from 'express';
import { isValidGmToken } from '../services/gmAuthService';

// Protege rotas administrativas (gerenciar jogadores, campanha, bibliotecas, combate,
// mapas etc.) exigindo o token emitido no login do mestre. Rotas usadas por jogadores
// (fichas/skills/itens do proprio personagem, entrar na sessao) nao passam por aqui —
// continuam seguindo o modelo de permissao existente, checado so no cliente.
export function requireGmAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.header('x-gm-token');
  if (!isValidGmToken(token)) {
    return res.status(401).json({ error: 'Sessao de mestre invalida. Faca login novamente.' });
  }
  next();
}
