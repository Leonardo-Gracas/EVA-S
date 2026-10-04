import { useCallback, useEffect, useRef, useState } from 'react';

// Wrapper em volta do YouTube IFrame Player API.
//
// O iframe e criado UMA vez e nunca desmonta enquanto o player existir: se ele
// fosse recriado a cada render (ou ao minimizar o widget), a musica pararia.
// Quem controla visibilidade e o componente de UI, mexendo so no container.

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;

function loadIframeApi(): Promise<void> {
  if (apiPromise) return apiPromise;
  apiPromise = new Promise<void>((resolve) => {
    if (window.YT?.Player) return resolve();
    // O callback global e o unico jeito de saber que a API carregou; preserva
    // qualquer handler ja registrado em vez de sobrescrever.
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      resolve();
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    document.head.appendChild(script);
  });
  return apiPromise;
}

// Codigos de erro da API que significam "esse video nao toca aqui".
const ERROR_MESSAGES: Record<number, string> = {
  2: 'Vídeo inválido.',
  5: 'Este vídeo não pode tocar no player embutido.',
  100: 'Vídeo removido ou privado.',
  101: 'O dono do vídeo não permite reprodução fora do YouTube.',
  150: 'O dono do vídeo não permite reprodução fora do YouTube.',
};

export interface UseYouTubePlayerOptions {
  onEnded?: () => void;
  /** Faixa que nao toca (bloqueada/removida) — a UI costuma pular para a proxima. */
  onUnplayable?: (message: string) => void;
}

export function useYouTubePlayer(options: UseYouTubePlayerOptions) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<any>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);

  // Volume/mudo chegam antes do player existir (restaurados do localStorage) —
  // ficam guardados aqui e sao aplicados no onReady.
  const pendingVolume = useRef<number | null>(null);
  const pendingMuted = useRef<boolean | null>(null);
  const pendingLoad = useRef<{ videoId: string; autoplay: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;

    loadIframeApi().then(() => {
      if (cancelled || !hostRef.current || playerRef.current) return;

      const mount = document.createElement('div');
      hostRef.current.appendChild(mount);

      playerRef.current = new window.YT.Player(mount, {
        width: '100%',
        height: '100%',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (cancelled) return;
            if (pendingVolume.current !== null) playerRef.current.setVolume(pendingVolume.current);
            if (pendingMuted.current) playerRef.current.mute();
            setReady(true);
            const load = pendingLoad.current;
            if (load) {
              pendingLoad.current = null;
              if (load.autoplay) playerRef.current.loadVideoById(load.videoId);
              else playerRef.current.cueVideoById(load.videoId);
            }
          },
          onStateChange: (e: any) => {
            const S = window.YT.PlayerState;
            setPlaying(e.data === S.PLAYING);
            setBuffering(e.data === S.BUFFERING);
            if (e.data === S.PLAYING) setDuration(playerRef.current?.getDuration?.() ?? 0);
            if (e.data === S.ENDED) optionsRef.current.onEnded?.();
          },
          onError: (e: any) => {
            optionsRef.current.onUnplayable?.(ERROR_MESSAGES[e?.data] ?? 'Não foi possível tocar esta faixa.');
          },
        },
      });
    });

    return () => {
      cancelled = true;
      try { playerRef.current?.destroy?.(); } catch { /* iframe ja removido */ }
      playerRef.current = null;
    };
  }, []);

  // Relogio da barra de progresso. 500ms e o suficiente para a barra parecer
  // continua sem martelar o iframe.
  useEffect(() => {
    if (!ready) return;
    const id = window.setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      setCurrent(p.getCurrentTime() ?? 0);
      const d = p.getDuration?.() ?? 0;
      if (d) setDuration(d);
    }, 500);
    return () => window.clearInterval(id);
  }, [ready]);

  const load = useCallback((videoId: string, autoplay: boolean) => {
    const p = playerRef.current;
    setCurrent(0);
    setDuration(0);
    if (!p?.loadVideoById) {
      pendingLoad.current = { videoId, autoplay };
      return;
    }
    if (autoplay) p.loadVideoById(videoId);
    else p.cueVideoById(videoId);
  }, []);

  const play = useCallback(() => playerRef.current?.playVideo?.(), []);
  const pause = useCallback(() => playerRef.current?.pauseVideo?.(), []);
  const stop = useCallback(() => {
    playerRef.current?.stopVideo?.();
    setCurrent(0);
    setDuration(0);
  }, []);

  const seek = useCallback((seconds: number) => {
    playerRef.current?.seekTo?.(seconds, true);
    setCurrent(seconds);
  }, []);

  const setVolume = useCallback((volume: number) => {
    pendingVolume.current = volume;
    playerRef.current?.setVolume?.(volume);
  }, []);

  const setMuted = useCallback((muted: boolean) => {
    pendingMuted.current = muted;
    if (muted) playerRef.current?.mute?.();
    else playerRef.current?.unMute?.();
  }, []);

  return { hostRef, ready, playing, buffering, current, duration, load, play, pause, stop, seek, setVolume, setMuted };
}
