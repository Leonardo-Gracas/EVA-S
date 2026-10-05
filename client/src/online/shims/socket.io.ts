// Shim do socket.io (servidor) para o modo online. O socketManager.ts do
// servidor roda sem mudancas: `io.emit` entrega o evento para a tela do proprio
// mestre (clientBus) e para cada jogador conectado por P2P.
import { Emitter } from '../emitter';
import { clientBus } from '../clientSocket';

export type PeerSend = (msg: unknown) => void;

export class Socket {
  private events = new Emitter();
  constructor(public readonly id: string, private send: PeerSend) {}

  on(event: string, fn: (...args: any[]) => void): this { this.events.on(event, fn); return this; }
  off(event?: string, fn?: (...args: any[]) => void): this { this.events.off(event, fn); return this; }
  emit(event: string, data?: unknown): boolean {
    this.send({ t: 'evt', event, data });
    return true;
  }
  /** Evento vindo do jogador (ou 'disconnect' gerado pelo host). */
  receive(event: string, data?: unknown): void { this.events.emit(event, data); }
}

export class Server {
  static current: Server | null = null;
  readonly sockets = new Map<string, Socket>();
  private events = new Emitter();

  constructor(_http?: unknown, _opts?: unknown) {
    Server.current = this;
  }

  on(event: string, fn: (socket: Socket) => void): this {
    this.events.on(event, fn);
    return this;
  }

  emit(event: string, data?: unknown): boolean {
    clientBus.emit(event, data);
    for (const s of this.sockets.values()) {
      try { s.emit(event, data); } catch (err) { console.warn('[EVA S] falha ao enviar evento', err); }
    }
    return true;
  }

  connectPeer(id: string, send: PeerSend): Socket {
    this.disconnectPeer(id);
    const socket = new Socket(id, send);
    this.sockets.set(id, socket);
    this.events.emit('connection', socket);
    return socket;
  }

  disconnectPeer(id: string): void {
    const socket = this.sockets.get(id);
    if (!socket) return;
    this.sockets.delete(id);
    socket.receive('disconnect');
  }
}
