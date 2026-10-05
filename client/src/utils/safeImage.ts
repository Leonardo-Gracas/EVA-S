// Abre a imagem do avatar numa aba nova sem nunca navegar para algo que nao
// seja imagem. Avatar vem de jogador: um "javascript:..." aberto com
// window.open rodaria com a origem do app (onde fica o token do mestre).
const DATA_IMAGE = /^data:image\/(png|jpe?g|gif|webp);base64,[A-Za-z0-9+/]+=*$/;
const UPLOAD_PATH = /^\/uploads\/[A-Za-z0-9._-]+\.(png|jpe?g|gif|webp)$/i;

export function isSafeImageSrc(src: string | null | undefined): src is string {
  return !!src && (DATA_IMAGE.test(src) || UPLOAD_PATH.test(src));
}

export function openImageSafely(src: string): void {
  if (!isSafeImageSrc(src)) return;
  if (UPLOAD_PATH.test(src)) {
    window.open(src, '_blank', 'noopener');
    return;
  }
  // Data URL: Chrome bloqueia abrir direto; vira Blob de imagem (servido como imagem).
  const [head, b64] = src.split(',');
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? 'image/png';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  window.open(url, '_blank', 'noopener');
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
