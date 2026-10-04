import crypto from 'crypto';

export function hashPassword(password: string): string {
  if (!password) return '';
  return crypto.createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  // Hash vazio = campanha sem senha. NUNCA liberar por isso: antes essa funcao
  // retornava true, entao qualquer dispositivo que abrisse a raiz do site podia
  // clicar numa campanha sem senha, receber um gmToken valido do servidor e virar
  // mestre — e o token nao fica preso a campanha nenhuma, entao valia pra campanha
  // ativa tambem. Sem senha propria, so a senha admin abre a campanha.
  if (!hash) return false;
  return hashPassword(password) === hash;
}
