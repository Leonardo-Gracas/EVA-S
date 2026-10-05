// Jogador: conecta no navegador do mestre por P2P (PeerJS). Pedidos da API
// viram mensagens {t:'req'}; eventos do "socket" chegam como {t:'evt'}.
import Peer, { DataConnection } from 'peerjs';
import { setApiHandler, ApiResult } from './fetchShim';
import { clientBus, setOutbound, setSocketConnected } from './clientSocket';
import { peerIdFor, peerOptions } from './config';
import { Emitter } from './emitter';

export type GuestStatus = 'connecting' | 'online' | 'host-offline' | 'reconnecting' | 'error';

export interface GuestState { status: GuestStatus; message: string; everConnected: boolean }

export const guestEvents = new Emitter();
export const guestState: GuestState = { status: 'connecting', message: 'Conectando ao mestre...', everConnected: false };

function patch(p: Partial<GuestState>) {
  Object.assign(guestState, p);
  guestEvents.emit('change', { ...guestState });
}

const REQUEST_TIMEOUT = 20000;

let peer: Peer | null = null;
let conn: DataConnection | null = null;
let hostCode = '';
let seq = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let pingTimer: ReturnType<typeof setInterval> | null = null;
let stopped = false;
const pending = new Map<number, { resolve: (r: ApiResult) => void; timer: ReturnType<typeof setTimeout> }>();

function failPending(message: string) {
  for (const [id, p] of pending) {
    clearTimeout(p.timer);
    p.resolve({ status: 503, body: { error: message } });
    pending.delete(id);
  }
}

function request(method: string, path: string, body: unknown, token?: string): Promise<ApiResult> {
  if (!conn || !conn.open) return Promise.resolve({ status: 503, body: { error: 'Sem conexao com o mestre.' } });
  const id = ++seq;
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      resolve({ status: 504, body: { error: 'O mestre demorou para responder.' } });
    }, REQUEST_TIMEOUT);
    pending.set(id, { resolve, timer });
    conn!.send({ t: 'req', id, method, path, body, token });
  });
}

function scheduleReconnect(delay = 2500) {
  if (stopped || reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (stopped || !peer || peer.destroyed) return;
  if (peer.disconnected) { peer.reconnect(); return; }
  conn?.close();
  const c = peer.connect(peerIdFor(hostCode), { reliable: true });
  conn = c;

  c.on('open', () => {
    if (conn !== c) return;
    const wasConnected = guestState.everConnected;
    patch({ status: 'online', message: 'Conectado', everConnected: true });
    setSocketConnected(true);
    // Reconexao: o que mudou enquanto estava fora nao chegou por evento.
    if (wasConnected) clientBus.emit('campaign:switched', {});
  });

  c.on('data', (raw: unknown) => {
    const msg = raw as any;
    if (!msg || typeof msg !== 'object') return;
    if (msg.t === 'res') {
      const p = pending.get(msg.id);
      if (!p) return;
      clearTimeout(p.timer);
      pending.delete(msg.id);
      p.resolve({ status: msg.status, body: msg.body });
    } else if (msg.t === 'evt') {
      clientBus.emit(String(msg.event), msg.data);
    }
  });

  const lost = () => {
    if (conn !== c) return;
    conn = null;
    setSocketConnected(false);
    failPending('Conexao com o mestre caiu.');
    if (!stopped) {
      patch({ status: 'reconnecting', message: 'Conexao perdida. Reconectando...' });
      scheduleReconnect();
    }
  };
  c.on('close', lost);
  c.on('error', lost);
}

export function startGuest(code: string): void {
  if (peer && !peer.destroyed && hostCode === code) return; // StrictMode monta duas vezes
  stopped = false;
  hostCode = code;
  setApiHandler((method, path, body, headers) => request(method, path, body, headers['x-player-token']));
  setOutbound((event, data) => { if (conn?.open) conn.send({ t: 'emit', event, data }); });

  peer = new Peer(peerOptions());
  peer.on('open', () => connect());
  peer.on('disconnected', () => {
    if (!stopped) setTimeout(() => { if (peer && !peer.destroyed && peer.disconnected) peer.reconnect(); }, 1500);
  });
  peer.on('error', (err: any) => {
    const type = err?.type as string | undefined;
    if (type === 'peer-unavailable') {
      // Sala fechada ou mestre recarregando a pagina.
      patch({
        status: 'host-offline',
        message: guestState.everConnected
          ? 'O mestre saiu da sala. Aguardando ele voltar...'
          : 'Sala nao encontrada. Confira o codigo ou peca para o mestre abrir a sala.',
      });
      scheduleReconnect(3000);
      return;
    }
    if (type === 'browser-incompatible') {
      patch({ status: 'error', message: 'Este navegador nao suporta WebRTC.' });
      return;
    }
    patch({ status: 'reconnecting', message: 'Problema de rede. Tentando de novo...' });
    scheduleReconnect(4000);
  });

  // Mantem o canal vivo em redes moveis que derrubam conexoes ociosas.
  pingTimer = setInterval(() => { if (conn?.open) conn.send({ t: 'ping' }); }, 20000);
}

export function stopGuest(): void {
  stopped = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (pingTimer) clearInterval(pingTimer);
  failPending('Voce saiu da sala.');
  conn?.close();
  peer?.destroy();
  conn = null;
  peer = null;
  setApiHandler(null);
  setOutbound(null);
  setSocketConnected(false);
}
