// No modo online nao existe pasta de uploads: a imagem e reduzida e vira um
// data URL salvo direto no banco. Assim ela viaja junto com a ficha para os
// jogadores e entra nos backups/exportacoes.
const MAX_SIDE = 512;
const QUALITY = 0.85;

export async function imageFileToDataUrl(file: File): Promise<string> {
  if (!/^image\/(png|jpe?g|gif|webp)$/i.test(file.type)) throw new Error('Tipo de imagem invalido');
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Nao foi possivel ler a imagem'));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponivel');
    ctx.drawImage(img, 0, 0, w, h);
    // PNG/GIF/WebP podem ter transparencia (tokens recortados): vao de WebP. Foto vai de JPEG.
    return /png|gif|webp/i.test(file.type)
      ? canvas.toDataURL('image/webp', QUALITY)
      : canvas.toDataURL('image/jpeg', QUALITY);
  } finally {
    URL.revokeObjectURL(url);
  }
}
