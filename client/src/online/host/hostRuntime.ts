// O mestre como servidor: abre o SQLite (sql.js) salvo no IndexedDB, carrega o
// MESMO codigo do servidor Node (routes/api.ts + services) via shims, e abre a
// sala no PeerJS para os jogadores conectarem.
import initSqlJs, { Database as SqlJsDatabase } from 'sql.js';
import sqlWasmUrl from 'sql.js/dist/sql-wasm.wasm?url';
import Peer, { DataConnection } from 'peerjs';
import { setSqlJsDatabase } from '../shims/better-sqlite3';
import { Server as FakeIOServer } from '../shims/socket.io';
import type { Router } from '../shims/express';
import { setApiHandler, ApiResult } from '../fetchShim';
import { setSocketConnected, setOutbound } from '../clientSocket';
import { loadDatabase, saveDatabase, requestPersistentStorage } from './storage';
import { peerIdFor, peerOptions } from '../config';
import { Emitter } from '../emitter';

export type HostStatus = 'opening' | 'online' | 'reconnecting' | 'error';

export interface HostState {
  status: HostStatus;
  message: string;
  peers: number;
  lastSavedAt: string | null;
  saveError: string | null;
}

export const hostEvents = new Emitter();
export const hostState: HostState = {
  status: 'opening', message: 'Abrindo a sala...', peers: 0, lastSavedAt: null, saveError: null,
};

function patch(p: Partial<HostState>) {
  Object.assign(hostState, p);
  hostEvents.emit('change', { ...hostState });
}

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
let db: SqlJsDatabase | null = null;
let router: Router | null = null;
let peer: Peer | null = null;
let started = false;

// ── Persistencia ──────────────────────────────────────────────────────────────

let saveTimer: ReturnType<typeof setTimeout> | null = null;
let dirty = false;

function schedulePersist() {
  dirty = true;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { void flush(); }, 400);
}

export async function flush(): Promise<void> {
  if (saveTimer) { clearTimeout(saveTimer); saveTimer = null; }
  if (!db || !dirty) return;
  dirty = false;
  try {
    const bytes = exportBytes();
    await saveDatabase(bytes);
    patch({ lastSavedAt: new Date().toISOString(), saveError: null });
  } catch (err: any) {
    dirty = true;
    patch({ saveError: err?.message ?? 'Falha ao salvar no navegador' });
  }
}

/** Snapshot binario do banco (o mesmo formato do rpg-manager.db do servidor). */
export function exportBytes(): Uint8Array {
  if (!db) throw new Error('Banco nao carregado');
  const bytes = db.export();
  // export() reabre o banco e zera os pragmas.
  db.exec('PRAGMA foreign_keys = ON');
  return bytes;
}

const UPLOAD_RE = /\/uploads\/([A-Za-z0-9._-]+\.(?:jpe?g|png|gif|webp))/gi;

async function sqlJs() {
  return SQL ?? await initSqlJs({ locateFile: () => sqlWasmUrl });
}

/** Colunas de texto de todas as tabelas (onde podem estar os caminhos /uploads/...). */
function textColumns(d: SqlJsDatabase): Array<[string, string]> {
  const out: Array<[string, string]> = [];
  const tables = d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0]?.values ?? [];
  for (const [t] of tables) {
    const cols = d.exec(`PRAGMA table_info("${t}")`)[0]?.values ?? [];
    for (const c of cols) {
      const type = String(c[2] ?? '').toUpperCase();
      if (type === '' || type.includes('TEXT') || type.includes('CHAR') || type.includes('CLOB')) out.push([String(t), String(c[1])]);
    }
  }
  return out;
}

/**
 * Valida um .db (backup do online ou o rpg-manager.db do servidor local) e
 * lista as imagens que ele referencia na pasta uploads do servidor local.
 */
export async function inspectDatabaseFile(bytes: Uint8Array): Promise<{ uploads: string[] }> {
  const sql = await sqlJs();
  let d: SqlJsDatabase | null = null;
  try {
    try { d = new sql.Database(bytes); } catch { throw new Error('Arquivo invalido ou corrompido.'); }
    let ok = false;
    try {
      const rows = d.exec("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('campaigns','saved_campaigns')");
      ok = !!rows[0] && rows[0].values.length > 0;
    } catch { ok = false; }
    if (!ok) throw new Error('Esse arquivo nao e um banco do EVA S.');
    const uploads = new Set<string>();
    for (const [t, c] of textColumns(d)) {
      const rows = d.exec(`SELECT "${c}" FROM "${t}" WHERE "${c}" LIKE '%/uploads/%'`)[0]?.values ?? [];
      for (const [v] of rows) for (const m of String(v).matchAll(UPLOAD_RE)) uploads.add(m[1]);
    }
    return { uploads: [...uploads] };
  } finally {
    d?.close();
  }
}

/**
 * Substitui o banco salvo neste navegador (antes de abrir a sala). `images`
 * mapeia nome do arquivo em uploads -> data URL; cada /uploads/<nome> do banco
 * vira a imagem embutida, pra funcionar sem a pasta do servidor.
 */
export async function importDatabaseFile(bytes: Uint8Array, images: Map<string, string> = new Map()): Promise<void> {
  await inspectDatabaseFile(bytes);
  if (images.size === 0) { await saveDatabase(bytes); return; }
  const sql = await sqlJs();
  const d = new sql.Database(bytes);
  try {
    const cols = textColumns(d);
    for (const [name, dataUrl] of images) {
      for (const [t, c] of cols) {
        d.run(`UPDATE "${t}" SET "${c}" = REPLACE("${c}", ?, ?) WHERE "${c}" LIKE ?`, [`/uploads/${name}`, dataUrl, `%/uploads/${name}%`]);
      }
    }
    await saveDatabase(d.export());
  } finally {
    d.close();
  }
}

/** Le o banco salvo (para exportar backup pelo lobby, sem abrir a sala). */
export async function readStoredDatabase(): Promise<Uint8Array | null> {
  if (db) { await flush(); return exportBytes(); }
  return loadDatabase();
}

// ── Pedidos (do proprio mestre e dos jogadores) ───────────────────────────────

// Rotas que criam sessao de mestre ou mexem na conta do mestre: so quem esta no
// navegador-servidor pode chamar. Jogador nunca recebe gmToken.
const HOST_ONLY: Array<[string, RegExp]> = [
  ['POST', /^\/campaigns\/?$/],
  ['POST', /^\/campaigns\/[^/]+\/switch\/?$/],
  ['POST', /^\/admin\/verify\/?$/],
  ['*', /^\/music\//],
];

async function handleLocal(method: string, path: string, body: unknown, headers: Record<string, string>): Promise<ApiResult> {
  if (!router) return { status: 503, body: { error: 'Servidor ainda carregando' } };
  const r = await router.handle(method, path, body, headers);
  return { status: r.status, body: r.body };
}

async function handleRemote(method: string, path: string, body: unknown): Promise<ApiResult> {
  const p = path.split('?')[0];
  if (HOST_ONLY.some(([m, re]) => (m === '*' || m === method) && re.test(p))) {
    return { status: 403, body: { error: 'Apenas o mestre pode fazer isso.' } };
  }
  // Sem headers do jogador: nada de x-gm-token vindo de fora.
  return handleLocal(method, path, body, {});
}

// ── Sala P2P ──────────────────────────────────────────────────────────────────

const connections = new Set<DataConnection>();

function attachConnection(conn: DataConnection) {
  const io = FakeIOServer.current;
  const socketId = `${conn.peer}:${conn.connectionId}`;
  const send = (msg: unknown) => { if (conn.open) conn.send(msg); };

  conn.on('open', () => {
    connections.add(conn);
    patch({ peers: connections.size });
    io?.connectPeer(socketId, send);
  });

  conn.on('data', async (raw: unknown) => {
    const msg = raw as any;
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'req') {
      const res = await handleRemote(String(msg.method), String(msg.path), msg.body).catch((err: any) => ({
        status: 500, body: { error: err?.message ?? 'Erro interno' },
      }));
      send({ t: 'res', id: msg.id, status: res.status, body: res.body });
    } else if (msg.t === 'emit') {
      io?.sockets.get(socketId)?.receive(String(msg.event), msg.data);
    } else if (msg.t === 'ping') {
      send({ t: 'pong' });
    }
  });

  const drop = () => {
    if (!connections.delete(conn)) return;
    patch({ peers: connections.size });
    io?.disconnectPeer(socketId);
  };
  conn.on('close', drop);
  conn.on('error', drop);
}

let retryTimer: ReturnType<typeof setTimeout> | null = null;
let idRetries = 0;

function openPeer(code: string) {
  if (retryTimer) { clearTimeout(retryTimer); retryTimer = null; }
  peer?.destroy();
  const p = new Peer(peerIdFor(code), peerOptions());
  peer = p;

  p.on('open', () => {
    idRetries = 0;
    patch({ status: 'online', message: 'Sala aberta' });
  });
  p.on('connection', attachConnection);
  p.on('disconnected', () => {
    if (p.destroyed) return;
    patch({ status: 'reconnecting', message: 'Reconectando ao servidor de salas...' });
    setTimeout(() => { if (!p.destroyed) p.reconnect(); }, 1500);
  });
  p.on('error', (err: any) => {
    const type = err?.type as string | undefined;
    if (type === 'unavailable-id') {
      // Depois de um F5 o servidor de salas ainda segura o codigo por alguns
      // segundos. Se continuar ocupado, outra aba/aparelho ja abriu essa sala.
      idRetries += 1;
      if (idRetries > 12) {
        patch({ status: 'error', message: 'Esse codigo de sala ja esta aberto em outra aba ou aparelho.' });
        return;
      }
      patch({ status: 'reconnecting', message: 'Recuperando o codigo da sala...' });
      retryTimer = setTimeout(() => openPeer(code), 2500);
      return;
    }
    if (type === 'peer-unavailable') return; // nao se aplica ao host
    if (type === 'browser-incompatible') {
      patch({ status: 'error', message: 'Este navegador nao suporta WebRTC.' });
      return;
    }
    patch({ status: 'reconnecting', message: 'Sem conexao com o servidor de salas. Tentando de novo...' });
    retryTimer = setTimeout(() => openPeer(code), 4000);
  });
}

// ── Boot ──────────────────────────────────────────────────────────────────────

export async function startHost(code: string, gmToken: string | null): Promise<void> {
  if (started) return;
  started = true;

  // Alguns modulos do servidor leem process.env no carregamento (mdns, youtube).
  const g = globalThis as any;
  g.process ??= { env: {}, cwd: () => '/', platform: 'browser', on: () => undefined, exit: () => undefined, stdout: {} };

  SQL = await initSqlJs({ locateFile: () => sqlWasmUrl });
  const stored = await loadDatabase();
  db = stored ? new SQL.Database(stored) : new SQL.Database();
  setSqlJsDatabase(db, schedulePersist);

  // Import dinamico: o db.ts do servidor instancia o Database ao ser carregado,
  // entao o sql.js precisa estar pronto antes.
  const [{ runMigrations }, { initSocket }, apiModule, gmAuth] = await Promise.all([
    import('../../../../server/src/database/migrations'),
    import('../../../../server/src/socket/socketManager'),
    import('../../../../server/src/routes/api'),
    import('../../../../server/src/services/gmAuthService'),
  ]);
  db.exec('PRAGMA foreign_keys = ON');
  runMigrations();
  // Ninguem esta conectado logo apos abrir a sala; quem estava volta sozinho.
  db.exec("UPDATE players SET status = 'offline', socket_id = NULL WHERE status = 'online'");
  initSocket({} as any);
  gmAuth.registerGmToken(gmToken);
  router = apiModule.default as unknown as Router;
  if (!stored) dirty = true;
  await flush();

  setApiHandler(handleLocal);
  setOutbound(null);
  setSocketConnected(true);

  void requestPersistentStorage();
  window.addEventListener('pagehide', () => { void flush(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') void flush();
  });
  // Fechar a aba do mestre derruba a mesa inteira: pede confirmacao se ha jogadores.
  window.addEventListener('beforeunload', (e) => {
    void flush();
    if (connections.size > 0) { e.preventDefault(); e.returnValue = ''; }
  });

  installYouTubeCallbackBridge();
  openPeer(code);
}

export async function stopHost(): Promise<void> {
  await flush();
  for (const c of connections) c.close();
  peer?.destroy();
  peer = null;
}

// ── YouTube: o callback do OAuth abre numa popup que nao tem o servidor ───────
// A popup (ver main.tsx) repassa ?code&state pra ca; o servidor-no-navegador
// troca o code pelo token e a popup recebe a resposta pra avisar o player.
function installYouTubeCallbackBridge() {
  window.addEventListener('message', async (e: MessageEvent) => {
    if (e.origin !== window.location.origin) return;
    if (e.data?.source !== 'evas-yt-callback') return;
    const search = String(e.data.search ?? '');
    const r = await handleLocal('GET', `/music/youtube/callback${search}`, undefined, {});
    const ok = typeof r.body === 'string' && r.body.includes('ok: true');
    window.postMessage({ source: 'yt-music-auth', ok }, window.location.origin);
  });
}
