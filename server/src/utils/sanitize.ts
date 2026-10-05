// Validacao de dados que vem de jogador e acabam renderizados na tela do mestre.

// Avatar: so imagem embutida (data URL de imagem) ou arquivo da pasta de
// uploads do proprio servidor. Antes aceitava qualquer string — inclusive
// "javascript:..." — e a ficha do mestre abria o avatar com window.open.
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|gif|webp)$/i;
export const MAX_AVATAR_LENGTH = 1_500_000;

export function isSafeImageUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > MAX_AVATAR_LENGTH) return false;
  return DATA_IMAGE.test(value) || UPLOAD_PATH.test(value);
}

const HEX_COLOR = /^#[0-9a-fA-F]{3,8}$/;
export function isSafeColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value);
}

/** Erro de validacao: as rotas convertem em 400. */
export function assertAvatar(value: unknown): void {
  if (value === undefined || value === null || value === '') return;
  if (!isSafeImageUrl(value)) throw new Error('Imagem de avatar invalida.');
}

export function assertTextLength(value: unknown, max: number, label: string): void {
  if (value === undefined || value === null) return;
  if (typeof value !== 'string') throw new Error(`${label} invalido.`);
  if (value.length > max) throw new Error(`${label} muito longo (maximo ${max} caracteres).`);
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Copia `obj` sem as chaves listadas. */
export function omit<T extends object>(obj: T, keys: string[]): T {
  const out: any = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}
