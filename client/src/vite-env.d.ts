/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** "1" no build online (Netlify): servidor no navegador do mestre + P2P. */
  readonly VITE_ONLINE?: string;
  /** Opcional: JSON com RTCIceServer[] (TURN proprio) para redes que barram P2P. */
  readonly VITE_ICE_SERVERS?: string;
  /** Opcional: servidor PeerJS proprio (padrao: 0.peerjs.com). */
  readonly VITE_PEER_HOST?: string;
  readonly VITE_PEER_PORT?: string;
  readonly VITE_PEER_PATH?: string;
  readonly VITE_PEER_SECURE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
