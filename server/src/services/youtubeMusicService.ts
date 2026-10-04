import crypto from 'crypto';
import db from '../database/db';

// ─────────────────────────────────────────────────────────────────────────────
// Integracao com a conta YouTube / YouTube Music do mestre.
//
// O YouTube Music nao expoe API publica nem permite embutir music.youtube.com
// num iframe (X-Frame-Options). O que existe de oficial e:
//   1. OAuth do Google com escopo youtube.readonly -> lista as playlists da
//      conta (playlists criadas no YT Music sao as mesmas da conta YouTube);
//   2. YouTube IFrame Player -> toca os videos dessas playlists no navegador.
// E o que esta implementado aqui: o servidor guarda os tokens e faz de proxy
// para a Data API v3; quem toca de fato e o iframe no cliente.
//
// Os tokens ficam em tabela propria (fora do snapshot de campanha) porque sao
// da CONTA do mestre, nao da campanha — trocar de campanha nao deve
// desconectar a conta do YouTube.
// ─────────────────────────────────────────────────────────────────────────────

const ROW_ID = 'default';
const API = 'https://www.googleapis.com/youtube/v3';
const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const REVOKE_ENDPOINT = 'https://oauth2.googleapis.com/revoke';
const SCOPE = 'https://www.googleapis.com/auth/youtube.readonly';

// Teto de faixas trazidas por playlist (4 paginas de 50).
const MAX_ITEMS = 200;

export interface YouTubeAuthStatus {
  configured: boolean;
  connected: boolean;
  clientId: string;
  accountName: string;
  accountThumb: string;
}

export interface YouTubePlaylistRef {
  id: string;
  title: string;
  thumb: string;
  itemCount: number;
  special?: boolean;
}

export interface YouTubeTrack {
  videoId: string;
  title: string;
  channel: string;
  thumb: string;
}

/** Erro que o cliente deve tratar pedindo novo login (token morto/revogado). */
export class YouTubeAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'YouTubeAuthError';
  }
}

interface AuthRow {
  client_id: string;
  client_secret: string;
  access_token: string;
  refresh_token: string;
  expires_at: string;
  account_name: string;
  account_thumb: string;
}

function getRow(): AuthRow {
  const row = db.prepare('SELECT * FROM youtube_music_auth WHERE id = ?').get(ROW_ID) as AuthRow | undefined;
  if (row) return row;
  db.prepare('INSERT INTO youtube_music_auth (id, updated_at) VALUES (?, ?)').run(ROW_ID, new Date().toISOString());
  return db.prepare('SELECT * FROM youtube_music_auth WHERE id = ?').get(ROW_ID) as AuthRow;
}

function patchRow(fields: Partial<AuthRow>): void {
  getRow();
  const keys = Object.keys(fields);
  if (keys.length === 0) return;
  const set = keys.map((k) => `${k} = ?`).join(', ');
  db.prepare(`UPDATE youtube_music_auth SET ${set}, updated_at = ? WHERE id = ?`)
    .run(...keys.map((k) => (fields as any)[k]), new Date().toISOString(), ROW_ID);
}

/** Credenciais do app Google: variaveis de ambiente tem prioridade sobre o que foi salvo pela UI. */
function credentials(): { clientId: string; clientSecret: string } {
  const row = getRow();
  return {
    clientId: process.env.GOOGLE_CLIENT_ID || row.client_id,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || row.client_secret,
  };
}

export function getStatus(): YouTubeAuthStatus {
  const row = getRow();
  const { clientId, clientSecret } = credentials();
  return {
    configured: !!clientId && !!clientSecret,
    connected: !!row.refresh_token,
    clientId,
    accountName: row.account_name,
    accountThumb: row.account_thumb,
  };
}

export function setConfig(clientId: string, clientSecret: string): YouTubeAuthStatus {
  patchRow({ client_id: (clientId ?? '').trim(), client_secret: (clientSecret ?? '').trim() });
  return getStatus();
}

// ── OAuth ────────────────────────────────────────────────────────────────────

// O redirect_uri precisa ser identico na ida (consentimento) e na volta (troca
// do code), e o Google so aceita http em localhost — por isso ele vem da origem
// do navegador do mestre, em vez de ser fixo (a porta muda entre dev e prod).
const pendingStates = new Map<string, { redirectUri: string; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function pruneStates(): void {
  const now = Date.now();
  for (const [state, entry] of pendingStates) {
    if (now - entry.createdAt > STATE_TTL_MS) pendingStates.delete(state);
  }
}

export function buildAuthUrl(redirectUri: string): string {
  const { clientId } = credentials();
  if (!clientId) throw new Error('Client ID do Google nao configurado.');
  pruneStates();
  const state = crypto.randomBytes(16).toString('hex');
  pendingStates.set(state, { redirectUri, createdAt: Date.now() });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: SCOPE,
    // offline + consent: sem os dois o Google para de devolver refresh_token na
    // segunda autorizacao em diante, e a sessao morreria em 1 hora.
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
    state,
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

export async function handleCallback(code: string, state: string): Promise<void> {
  pruneStates();
  const entry = pendingStates.get(state);
  if (!entry) throw new Error('Sessao de autorizacao expirada ou invalida. Tente conectar de novo.');
  pendingStates.delete(state);

  const { clientId, clientSecret } = credentials();
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: entry.redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  const data: any = await res.json();
  if (!res.ok) throw new Error(data?.error_description || data?.error || 'Falha ao trocar o codigo por token.');

  patchRow({
    access_token: data.access_token ?? '',
    refresh_token: data.refresh_token ?? getRow().refresh_token,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  });

  await cacheAccountInfo();
}

export async function disconnect(): Promise<void> {
  const row = getRow();
  const token = row.refresh_token || row.access_token;
  if (token) {
    // Melhor esforco: se o Google recusar, o que importa e limpar deste lado.
    try {
      await fetch(REVOKE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      });
    } catch { /* offline ou token ja revogado */ }
  }
  patchRow({ access_token: '', refresh_token: '', expires_at: '', account_name: '', account_thumb: '' });
}

async function refreshAccessToken(): Promise<string> {
  const row = getRow();
  const { clientId, clientSecret } = credentials();
  if (!row.refresh_token) throw new YouTubeAuthError('Conta do YouTube nao conectada.');

  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: row.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: 'refresh_token',
    }),
  });
  const data: any = await res.json();
  if (!res.ok) {
    // invalid_grant = acesso revogado ou senha trocada: so reconectando.
    if (data?.error === 'invalid_grant') {
      patchRow({ access_token: '', refresh_token: '', expires_at: '', account_name: '', account_thumb: '' });
      throw new YouTubeAuthError('O acesso a conta do YouTube expirou. Conecte novamente.');
    }
    throw new Error(data?.error_description || data?.error || 'Falha ao renovar o token.');
  }

  patchRow({
    access_token: data.access_token,
    expires_at: new Date(Date.now() + (data.expires_in ?? 3600) * 1000).toISOString(),
  });
  return data.access_token;
}

async function getAccessToken(): Promise<string> {
  const row = getRow();
  if (!row.refresh_token && !row.access_token) throw new YouTubeAuthError('Conta do YouTube nao conectada.');
  const expiresAt = row.expires_at ? Date.parse(row.expires_at) : 0;
  // 60s de folga: evita usar um token que expira no meio da requisicao.
  if (row.access_token && expiresAt - Date.now() > 60_000) return row.access_token;
  return refreshAccessToken();
}

// ── Data API v3 ──────────────────────────────────────────────────────────────

async function apiGet(path: string, params: Record<string, string>): Promise<any> {
  const token = await getAccessToken();
  const url = `${API}/${path}?${new URLSearchParams(params).toString()}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const data: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    const reason = data?.error?.errors?.[0]?.reason;
    if (res.status === 401) throw new YouTubeAuthError('Sessao do YouTube invalida. Conecte novamente.');
    if (reason === 'quotaExceeded') throw new Error('Cota diaria da API do YouTube esgotada. Tente novamente amanha.');
    throw new Error(data?.error?.message || `Erro ${res.status} na API do YouTube.`);
  }
  return data;
}

async function cacheAccountInfo(): Promise<void> {
  try {
    const data = await apiGet('channels', { part: 'snippet', mine: 'true' });
    const ch = data.items?.[0];
    patchRow({
      account_name: ch?.snippet?.title ?? 'Conta conectada',
      account_thumb: ch?.snippet?.thumbnails?.default?.url ?? '',
    });
  } catch {
    // Conta sem canal do YouTube ainda le playlists — nao bloqueia o login por isso.
    patchRow({ account_name: 'Conta conectada', account_thumb: '' });
  }
}

function bestThumb(thumbs: any): string {
  return thumbs?.medium?.url ?? thumbs?.high?.url ?? thumbs?.default?.url ?? '';
}

export async function listPlaylists(): Promise<YouTubePlaylistRef[]> {
  const out: YouTubePlaylistRef[] = [];
  let pageToken = '';
  do {
    const data = await apiGet('playlists', {
      part: 'snippet,contentDetails',
      mine: 'true',
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    for (const p of data.items ?? []) {
      out.push({
        id: p.id,
        title: p.snippet?.title ?? '(sem nome)',
        thumb: bestThumb(p.snippet?.thumbnails),
        itemCount: p.contentDetails?.itemCount ?? 0,
      });
    }
    pageToken = data.nextPageToken ?? '';
  } while (pageToken && out.length < 300);

  // "Musicas curtidas" (LM) e "Videos curtidos" (LL) sao playlists de sistema:
  // nao aparecem em playlists.list, mas playlistItems aceita os dois IDs. LM so
  // existe para quem usa o YT Music, dai a sondagem antes de oferecer.
  const specials: YouTubePlaylistRef[] = [];
  const systemLists: Array<[string, string]> = [['LM', 'Músicas curtidas (YT Music)'], ['LL', 'Vídeos curtidos']];
  for (const [id, title] of systemLists) {
    try {
      const probe = await apiGet('playlistItems', { part: 'id', playlistId: id, maxResults: '1' });
      if ((probe.pageInfo?.totalResults ?? 0) > 0) {
        specials.push({ id, title, thumb: '', itemCount: probe.pageInfo.totalResults, special: true });
      }
    } catch { /* playlist de sistema indisponivel nessa conta */ }
  }
  return [...specials, ...out];
}

const UNAVAILABLE = new Set(['Deleted video', 'Private video', 'Video indisponível']);

export async function listPlaylistItems(playlistId: string): Promise<YouTubeTrack[]> {
  const out: YouTubeTrack[] = [];
  let pageToken = '';
  do {
    const data = await apiGet('playlistItems', {
      part: 'snippet,contentDetails,status',
      playlistId,
      maxResults: '50',
      ...(pageToken ? { pageToken } : {}),
    });
    for (const it of data.items ?? []) {
      const videoId = it.contentDetails?.videoId ?? it.snippet?.resourceId?.videoId;
      const title = it.snippet?.title ?? '';
      // Faixa removida/privada nunca toca — deixar na fila so criaria um pulo seco.
      if (!videoId || UNAVAILABLE.has(title)) continue;
      if (it.status?.privacyStatus === 'private') continue;
      out.push({
        videoId,
        title,
        channel: it.snippet?.videoOwnerChannelTitle ?? it.snippet?.channelTitle ?? '',
        thumb: bestThumb(it.snippet?.thumbnails),
      });
    }
    pageToken = data.nextPageToken ?? '';
  } while (pageToken && out.length < MAX_ITEMS);
  return out;
}

/** Metadados de uma playlist publica qualquer, para o modo "colar URL". */
export async function getPlaylistInfo(playlistId: string): Promise<YouTubePlaylistRef> {
  const data = await apiGet('playlists', { part: 'snippet,contentDetails', id: playlistId });
  const p = data.items?.[0];
  if (!p) throw new Error('Playlist nao encontrada ou privada.');
  return {
    id: p.id,
    title: p.snippet?.title ?? '(sem nome)',
    thumb: bestThumb(p.snippet?.thumbnails),
    itemCount: p.contentDetails?.itemCount ?? 0,
  };
}

export async function searchTracks(query: string): Promise<YouTubeTrack[]> {
  const data = await apiGet('search', {
    part: 'snippet',
    q: query,
    type: 'video',
    // Categoria 10 = Music: mantem a busca perto do que o YT Music devolveria.
    videoCategoryId: '10',
    maxResults: '20',
  });
  return (data.items ?? [])
    .map((it: any) => ({
      videoId: it.id?.videoId,
      title: it.snippet?.title ?? '',
      channel: it.snippet?.channelTitle ?? '',
      thumb: bestThumb(it.snippet?.thumbnails),
    }))
    .filter((t: YouTubeTrack) => !!t.videoId);
}

/** Titulo/capa de faixas avulsas (playlists da campanha) a partir dos IDs de video. */
export async function getVideos(ids: string[]): Promise<YouTubeTrack[]> {
  if (ids.length === 0) return [];
  const data = await apiGet('videos', { part: 'snippet', id: ids.slice(0, 50).join(',') });
  return (data.items ?? []).map((v: any) => ({
    videoId: v.id,
    title: v.snippet?.title ?? '',
    channel: v.snippet?.channelTitle ?? '',
    thumb: bestThumb(v.snippet?.thumbnails),
  }));
}
