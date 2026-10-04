// Build online (Netlify): o servidor roda no navegador do mestre e os jogadores
// conectam por P2P. Build normal (LAN): tudo continua indo pro servidor Node.
export const ONLINE = import.meta.env.VITE_ONLINE === '1';

const PEER_PREFIX = 'evas-sala-';
export const peerIdFor = (code: string) => `${PEER_PREFIX}${code.toUpperCase()}`;

// Sem 0/O, 1/I/L: o codigo e ditado em voz alta na mesa.
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const CODE_LENGTH = 6;

export function newRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH);
}

export const isValidCode = (code: string) => new RegExp(`^[${ALPHABET}]{${CODE_LENGTH}}$`).test(code);

export function inviteLink(code: string): string {
  return `${window.location.origin}/sala/${code}`;
}

function iceServers(): RTCIceServer[] | undefined {
  const raw = import.meta.env.VITE_ICE_SERVERS;
  if (!raw) return undefined;
  try { return JSON.parse(raw); } catch { return undefined; }
}

/**
 * Opcoes do PeerJS. Por padrao usa o servidor publico gratuito (0.peerjs.com),
 * que so faz a "apresentacao" entre mestre e jogadores — os dados vao direto
 * de navegador pra navegador. Da pra apontar pra um servidor proprio via env.
 */
export function peerOptions(): Record<string, unknown> {
  const env = import.meta.env;
  const opts: Record<string, unknown> = { debug: 1 };
  if (env.VITE_PEER_HOST) {
    opts.host = env.VITE_PEER_HOST;
    if (env.VITE_PEER_PORT) opts.port = Number(env.VITE_PEER_PORT);
    if (env.VITE_PEER_PATH) opts.path = env.VITE_PEER_PATH;
    opts.secure = env.VITE_PEER_SECURE ? env.VITE_PEER_SECURE === '1' : window.location.protocol === 'https:';
  }
  const ice = iceServers();
  if (ice) opts.config = { iceServers: ice };
  return opts;
}
