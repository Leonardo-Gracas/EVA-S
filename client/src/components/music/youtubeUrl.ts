// Leitura das varias formas de URL que o YouTube / YouTube Music produzem.
// O mesmo link colado da barra do navegador pode vir como music.youtube.com,
// youtube.com, youtu.be, com ou sem `list=` — tudo isso desemboca aqui.

const VIDEO_ID = /^[a-zA-Z0-9_-]{11}$/;
// IDs de playlist: PL/OL/RD/UU/FL... alem das listas de sistema LL e LM.
const LIST_ID = /^(?:PL|OL|RD|UU|FL|TL|LP)[a-zA-Z0-9_-]{10,}$|^(?:LL|LM|WL)$/;

export interface ParsedYouTubeLink {
  videoId?: string;
  listId?: string;
}

export function parseYouTubeLink(raw: string): ParsedYouTubeLink {
  const input = (raw ?? '').trim();
  if (!input) return {};

  // Coloca IDs crus (sem URL) direto no campo certo.
  if (VIDEO_ID.test(input)) return { videoId: input };
  if (LIST_ID.test(input)) return { listId: input };

  let url: URL;
  try {
    url = new URL(input.startsWith('http') ? input : `https://${input}`);
  } catch {
    return {};
  }

  const host = url.hostname.replace(/^www\./, '');
  const isYouTube = host === 'youtu.be'
    || host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com';
  if (!isYouTube) return {};

  const out: ParsedYouTubeLink = {};

  const list = url.searchParams.get('list');
  if (list && LIST_ID.test(list)) out.listId = list;

  if (host === 'youtu.be') {
    const id = url.pathname.slice(1).split('/')[0];
    if (VIDEO_ID.test(id)) out.videoId = id;
  } else {
    const v = url.searchParams.get('v');
    if (v && VIDEO_ID.test(v)) out.videoId = v;
    // /embed/ID, /shorts/ID, /v/ID
    const m = url.pathname.match(/^\/(?:embed|shorts|v)\/([a-zA-Z0-9_-]{11})/);
    if (m) out.videoId = m[1];
  }

  return out;
}

/** Segundos -> "m:ss" (ou "h:mm:ss" em faixas longas, tipo mixes de 1h). */
export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

/** Tira o ruido tipico de titulos do YouTube ("(Official Video)", "[HD]"...). */
export function cleanTitle(title: string): string {
  return title
    .replace(/[([][^)\]]*(official|video|audio|lyric|hd|4k|mv|m\/v)[^)\]]*[)\]]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || title;
}
