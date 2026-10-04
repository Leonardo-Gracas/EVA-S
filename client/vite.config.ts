import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Acompanha o PORT do servidor (padrao 80), senao o proxy quebra ao trocar a porta
const API_TARGET = `http://localhost:${process.env.PORT || '80'}`;

// Modo online: o codigo do servidor (../server/src) roda no navegador do mestre.
// Os modulos do Node que ele importa sao trocados por shims (src/online/shims).
const shim = (name: string) => path.resolve(__dirname, `./src/online/shims/${name}.ts`);
const NODE_SHIMS = ['better-sqlite3', 'express', 'crypto', 'fs', 'path', 'os', 'http', 'uuid', 'socket.io', 'bonjour-service'];

export default defineConfig(({ mode }) => {
  // `--mode online` (scripts dev:online / build:online) liga o modo sala online.
  // Vai por process.env porque o Vite le as VITE_* de la ao montar import.meta.env.
  if (mode === 'online') process.env.VITE_ONLINE = '1';
  return {
    plugins: [react()],
    resolve: {
      alias: [
        { find: '@', replacement: path.resolve(__dirname, './src') },
        ...NODE_SHIMS.map((name) => ({
          find: new RegExp(`^${name.replace(/[.]/g, '\\.')}$`),
          replacement: shim(name),
        })),
      ],
    },
    server: {
      port: 5173,
      // Permite servir ../server/src no dev (modo online importa o codigo do servidor).
      fs: { allow: [path.resolve(__dirname, '..')] },
      host: true,  // escuta em 0.0.0.0 — permite acesso via IP local na rede
      // Qualquer host: com a lista antiga (so '.local') o Vite respondia "Blocked request"
      // a quem chegasse por um nome que nao fosse eva.local — DDNS, tunel (ngrok/cloudflare)
      // ou o nome que o roteador da a maquina. E um servidor de dev de uso local, entao o
      // risco de DNS rebinding aqui nao compensa travar o acesso dos jogadores.
      allowedHosts: true,
      // No modo online nao existe servidor Node: /api e atendido dentro do navegador.
      proxy: mode === 'online' ? undefined : {
        '/api': {
          target: API_TARGET,
          changeOrigin: true,
        },
        '/uploads': {
          target: API_TARGET,
          changeOrigin: true,
        },
        '/socket.io': {
          target: API_TARGET,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  };
});
