import { io, Socket } from 'socket.io-client';
import { ONLINE } from '../online/config';
import { onlineSocket } from '../online/clientSocket';

/** O que as telas usam do socket — atendido pelo socket.io (LAN) ou pela sala P2P (online). */
export interface ClientSocket {
  connected: boolean;
  on(event: string, listener: (...args: any[]) => void): unknown;
  off(event?: string, listener?: (...args: any[]) => void): unknown;
  emit(event: string, ...args: any[]): unknown;
}

let socket: Socket | null = null;

export function getSocket(): ClientSocket {
  if (ONLINE) return onlineSocket;
  if (!socket) {
    socket = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    });
  }
  return socket as unknown as ClientSocket;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
