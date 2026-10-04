// Sala atual desta aba. sessionStorage: um F5 volta pra mesma sala (o mestre
// reabre com o mesmo codigo e os jogadores reconectam sozinhos), mas outra aba
// pode ser outra sala. O ultimo codigo do mestre fica no localStorage para o
// botao "Retomar sala" do lobby.
export type RoomRole = 'host' | 'player';
export interface RoomSession { role: RoomRole; code: string }

const KEY = 'evas_room';
const LAST_HOST = 'evas_last_host_code';
const LAST_JOIN = 'evas_last_join_code';

function safe<T>(fn: () => T, fallback: T): T {
  try { return fn(); } catch { return fallback; }
}

export function getRoom(): RoomSession | null {
  return safe(() => {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as RoomSession) : null;
  }, null);
}

export function setRoom(room: RoomSession): void {
  safe(() => {
    sessionStorage.setItem(KEY, JSON.stringify(room));
    localStorage.setItem(room.role === 'host' ? LAST_HOST : LAST_JOIN, room.code);
  }, undefined);
}

export function clearRoom(): void {
  safe(() => sessionStorage.removeItem(KEY), undefined);
}

export const lastHostCode = () => safe(() => localStorage.getItem(LAST_HOST), null);
export const lastJoinCode = () => safe(() => localStorage.getItem(LAST_JOIN), null);
