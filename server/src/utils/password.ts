import crypto from 'crypto';

// Senhas de jogador e de campanha. Antes era SHA-256 puro, sem sal: hashes
// iguais para senhas iguais e quebra rapida por dicionario de quem pegasse o
// banco (um backup .db, por exemplo). Agora: sal aleatorio + iteracoes.
// Formato: "s2$<sal hex>$<hash hex>". Hashes antigos (64 hex) continuam
// valendo e sao trocados pelo formato novo no proximo login do jogador.

const ITERATIONS = 20000;

export function legacySha256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

function stretch(password: string, salt: string): string {
  let h = crypto.createHash('sha256').update(`${salt}:${password}`).digest('hex');
  for (let i = 0; i < ITERATIONS; i++) {
    h = crypto.createHash('sha256').update(h + password).digest('hex');
  }
  return h;
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function hashPassword(password: string): string {
  if (!password) return '';
  const salt = crypto.randomBytes(16).toString('hex');
  return `s2$${salt}$${stretch(password, salt)}`;
}

export function isLegacyHash(hash: string): boolean {
  return /^[0-9a-f]{64}$/.test(hash);
}

export function verifyPassword(password: string, hash: string): boolean {
  // Hash vazio = campanha sem senha. NUNCA liberar por isso: antes essa funcao
  // retornava true, entao qualquer dispositivo que abrisse a raiz do site podia
  // clicar numa campanha sem senha, receber um gmToken valido do servidor e virar
  // mestre — e o token nao fica preso a campanha nenhuma, entao valia pra campanha
  // ativa tambem. Sem senha propria, so a senha admin abre a campanha.
  if (!hash || typeof password !== 'string') return false;
  if (hash.startsWith('s2$')) {
    const [, salt, expected] = hash.split('$');
    if (!salt || !expected) return false;
    return safeEqual(stretch(password, salt), expected);
  }
  if (isLegacyHash(hash)) return safeEqual(legacySha256(password), hash);
  return false;
}
