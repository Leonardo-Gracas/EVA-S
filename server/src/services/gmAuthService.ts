import crypto from 'crypto';

// Tokens de sessao do mestre: emitidos so apos senha da campanha ou senha admin
// validada (ver /campaigns POST e /campaigns/:id/switch), guardados em memoria de
// proposito — um restart do processo invalida todas as sessoes de mestre, exigindo
// senha de novo. Isso substitui o antigo esquema onde o navegador guardava um
// simples "rpg_gm_auth=1" no localStorage e o servidor nunca conferia nada: bastava
// digitar esse valor no devtools (sem saber senha nenhuma) pra virar mestre.
const validTokens = new Set<string>();

export function createGmToken(): string {
  const token = crypto.randomBytes(32).toString('hex');
  validTokens.add(token);
  return token;
}

export function isValidGmToken(token: string | undefined | null): boolean {
  return !!token && validTokens.has(token);
}
