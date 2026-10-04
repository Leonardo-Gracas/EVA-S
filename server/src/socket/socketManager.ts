import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import * as playerService from '../services/playerService';

let io: SocketIOServer | null = null;

export function getIO(): SocketIOServer | null {
  return io;
}

export function initSocket(httpServer: HTTPServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`🔌 Cliente conectado: ${socket.id}`);

    // Jogador entra na sessão
    socket.on('player:join', ({ playerId }: { playerId: string }) => {
      const player = playerService.setPlayerOnline(playerId, socket.id);
      if (player) {
        console.log(`👤 Jogador "${player.name}" entrou (${socket.id})`);
        io!.emit('player:updated', player);
        io!.emit('players:online', playerService.getAllPlayers());
      }
    });

    // Jogador sai explicitamente
    socket.on('player:leave', () => {
      handleDisconnect(socket.id);
    });

    // Desconexão
    socket.on('disconnect', () => {
      console.log(`❌ Cliente desconectado: ${socket.id}`);
      handleDisconnect(socket.id);
    });
  });

  return io;
}

function handleDisconnect(socketId: string) {
  const player = playerService.setPlayerOffline(socketId);
  if (player && io) {
    console.log(`👤 Jogador "${player.name}" saiu`);
    io.emit('player:updated', { ...player, status: 'offline', socketId: null });
    io.emit('players:online', playerService.getAllPlayers());
  }
}
