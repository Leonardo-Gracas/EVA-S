import { Emitter } from './emitter';

// "Socket" do lado do cliente no modo online. No mestre, quem alimenta e o
// proprio servidor rodando no navegador (shims/socket.io). No jogador, e a
// conexao P2P com o mestre (guest.ts). As telas usam como se fosse socket.io.
export const clientBus = new Emitter();

let outbound: ((event: string, data: unknown) => void) | null = null;

export const onlineSocket = {
  connected: false,
  on(event: string, fn: (...args: any[]) => void) { clientBus.on(event, fn); return onlineSocket; },
  off(event?: string, fn?: (...args: any[]) => void) { clientBus.off(event, fn); return onlineSocket; },
  emit(event: string, data?: unknown) { outbound?.(event, data); return onlineSocket; },
};

export function setOutbound(fn: ((event: string, data: unknown) => void) | null): void {
  outbound = fn;
}

export function setSocketConnected(value: boolean): void {
  if (onlineSocket.connected === value) return;
  onlineSocket.connected = value;
  clientBus.emit(value ? 'connect' : 'disconnect');
}
