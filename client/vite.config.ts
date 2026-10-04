import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

// Acompanha o PORT do servidor (padrao 80), senao o proxy quebra ao trocar a porta
const API_TARGET = `http://localhost:${process.env.PORT || '80'}`;

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 5173,
    host: true,  // escuta em 0.0.0.0 — permite acesso via IP local na rede
    // Qualquer host: com a lista antiga (so '.local') o Vite respondia "Blocked request"
    // a quem chegasse por um nome que nao fosse eva.local — DDNS, tunel (ngrok/cloudflare)
    // ou o nome que o roteador da a maquina. E um servidor de dev de uso local, entao o
    // risco de DNS rebinding aqui nao compensa travar o acesso dos jogadores.
    allowedHosts: true,
    proxy: {
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
});
