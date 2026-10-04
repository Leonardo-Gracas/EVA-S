import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Music2, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, Repeat1,
  Volume2, VolumeX, ChevronDown, ChevronUp, Search, ListMusic, LogIn, LogOut,
  Video, VideoOff, RefreshCw, Copy, ExternalLink, X, Settings2, Loader,
} from 'lucide-react';
import { api } from '../../services/api';
import Button from '../common/Button';
import { Input } from '../common/Input';
import type { CampaignPlaylist, YouTubeAuthStatus, YouTubePlaylistRef, YouTubeTrack } from '../../types';
import { useYouTubePlayer } from './useYouTubePlayer';
import IconButton from './IconButton';
import CampaignPlaylists from './CampaignPlaylists';
import { parseYouTubeLink, formatTime, cleanTitle } from './youtubeUrl';

// ─────────────────────────────────────────────────────────────────────────────
// Player flutuante da trilha sonora (canto inferior direito do painel do mestre).
//
// Toca pelo YouTube IFrame Player; as playlists vem de tres lugares:
//   • Campanha  — playlists por mood, criadas e editadas na propria aba;
//   • Conta     — playlists da conta YouTube/YT Music logada via OAuth;
//   • Buscar    — colar link ou pesquisar (busca exige conta conectada).
//
// O YouTube Music nao tem API publica nem player embutivel proprio; a conta
// logada e a mesma e as playlists criadas no YT Music aparecem na Data API,
// mas quem reproduz e o player do YouTube — por isso pode entrar anuncio, e
// faixas cujo dono bloqueou embed sao puladas automaticamente.
// ─────────────────────────────────────────────────────────────────────────────

type Tab = 'campaign' | 'account' | 'find';
type RepeatMode = 'off' | 'all' | 'one';

interface QueueTrack {
  videoId: string;
  title: string;
  channel: string;
  thumb: string;
}

interface LastSource {
  kind: 'campaign' | 'youtube';
  id: string;
  name: string;
}

const LS = {
  collapsed: 'gm.music.collapsed',
  volume: 'gm.music.volume',
  muted: 'gm.music.muted',
  shuffle: 'gm.music.shuffle',
  repeat: 'gm.music.repeat',
  source: 'gm.music.source',
  video: 'gm.music.video',
};

function readLS<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function writeLS(key: string, value: unknown): void {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage indisponivel */ }
}

/** Ordem de reproducao: sequencial ou embaralhada com `startAt` na frente. */
function buildOrder(length: number, shuffle: boolean, startAt: number): number[] {
  const indices = Array.from({ length }, (_, i) => i);
  if (!shuffle) return indices;
  const rest = indices.filter((i) => i !== startAt);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  return startAt >= 0 && startAt < length ? [startAt, ...rest] : rest;
}

function trackFromYouTube(t: YouTubeTrack): QueueTrack {
  return { videoId: t.videoId, title: t.title, channel: t.channel, thumb: t.thumb };
}

export default function MusicPlayer() {
  const [collapsed, setCollapsed] = useState(() => readLS(LS.collapsed, true));
  const [tab, setTab] = useState<Tab>('campaign');
  const [showVideo, setShowVideo] = useState(() => readLS(LS.video, false));

  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [order, setOrder] = useState<number[]>([]);
  const [pos, setPos] = useState(0);
  const [sourceName, setSourceName] = useState('');
  const [playToken, setPlayToken] = useState(0);

  const [shuffle, setShuffle] = useState(() => readLS(LS.shuffle, false));
  const [repeat, setRepeat] = useState<RepeatMode>(() => readLS<RepeatMode>(LS.repeat, 'all'));
  const [volume, setVolumeState] = useState(() => readLS(LS.volume, 70));
  const [muted, setMutedState] = useState(() => readLS(LS.muted, false));

  const [notice, setNotice] = useState<string | null>(null);

  const autoplayRef = useRef(false);
  // Se todas as faixas da fila estiverem bloqueadas, pular uma a uma viraria
  // loop infinito — este contador corta depois de algumas falhas seguidas.
  const errorStreak = useRef(0);

  const currentIndex = order[pos];
  const currentTrack = currentIndex === undefined ? null : queue[currentIndex] ?? null;

  // ── player ────────────────────────────────────────────────────────────────

  const handleEnded = useCallback(() => {
    autoplayRef.current = true;
    setPos((prev) => {
      if (repeat === 'one') { setPlayToken((t) => t + 1); return prev; }
      const next = prev + 1;
      if (next < order.length) return next;
      if (repeat === 'all' && order.length > 0) return 0;
      autoplayRef.current = false;
      return prev;
    });
  }, [repeat, order.length]);

  const handleUnplayable = useCallback((message: string) => {
    setNotice(message);
    errorStreak.current += 1;
    if (errorStreak.current > Math.min(order.length || 1, 5)) {
      setNotice('Várias faixas seguidas não puderam tocar. Reprodução interrompida.');
      return;
    }
    if (order.length > 1) handleEnded();
  }, [order.length, handleEnded]);

  const player = useYouTubePlayer({ onEnded: handleEnded, onUnplayable: handleUnplayable });
  const { load, play, pause, stop, seek, setVolume, setMuted } = player;

  // Carrega a faixa atual sempre que ela muda (ou quando o mesmo item e
  // reescolhido — dai o playToken).
  useEffect(() => {
    if (!currentTrack) return;
    load(currentTrack.videoId, autoplayRef.current);
    autoplayRef.current = true;
  }, [currentTrack?.videoId, playToken, load]);

  useEffect(() => { setVolume(volume); writeLS(LS.volume, volume); }, [volume, setVolume]);
  useEffect(() => { setMuted(muted); writeLS(LS.muted, muted); }, [muted, setMuted]);
  useEffect(() => { writeLS(LS.shuffle, shuffle); }, [shuffle]);
  useEffect(() => { writeLS(LS.repeat, repeat); }, [repeat]);
  useEffect(() => { writeLS(LS.collapsed, collapsed); }, [collapsed]);
  useEffect(() => { writeLS(LS.video, showVideo); }, [showVideo]);

  // Tocou de verdade => a sequencia de faixas bloqueadas foi quebrada.
  useEffect(() => { if (player.playing) { errorStreak.current = 0; setNotice(null); } }, [player.playing]);

  // ── controles ─────────────────────────────────────────────────────────────

  const startQueue = useCallback((tracks: QueueTrack[], name: string, startAt = 0) => {
    if (tracks.length === 0) { setNotice('Nenhuma faixa do YouTube nesta playlist.'); return; }
    errorStreak.current = 0;
    autoplayRef.current = true;
    setQueue(tracks);
    setSourceName(name);
    setOrder(buildOrder(tracks.length, shuffle, startAt));
    setPos(0);
    setPlayToken((t) => t + 1);
  }, [shuffle]);

  const cueQueue = useCallback((tracks: QueueTrack[], name: string) => {
    // Restauracao ao abrir o painel: deixa pronto, mas nao sai tocando sozinho.
    if (tracks.length === 0) return;
    autoplayRef.current = false;
    setQueue(tracks);
    setSourceName(name);
    setOrder(buildOrder(tracks.length, false, 0));
    setPos(0);
  }, []);

  const togglePlay = () => {
    if (!currentTrack) return;
    if (player.playing) pause(); else play();
  };

  const goNext = () => {
    if (order.length === 0) return;
    autoplayRef.current = true;
    setPos((p) => (p + 1) % order.length);
  };

  const goPrev = () => {
    if (order.length === 0) return;
    // Convencao de player: nos primeiros segundos volta a faixa; depois, reinicia.
    if (player.current > 3) { seek(0); return; }
    autoplayRef.current = true;
    setPos((p) => (p - 1 + order.length) % order.length);
  };

  const toggleShuffle = () => {
    setShuffle((prev) => {
      const next = !prev;
      // Reembaralha mantendo a faixa atual na posicao 0 — assim ela nao reinicia.
      if (currentIndex !== undefined) {
        setOrder(buildOrder(queue.length, next, currentIndex));
        setPos(0);
      }
      return next;
    });
  };

  const cycleRepeat = () => setRepeat((r) => (r === 'off' ? 'all' : r === 'all' ? 'one' : 'off'));

  const clearQueue = () => {
    stop();
    setQueue([]);
    setOrder([]);
    setPos(0);
    setSourceName('');
    writeLS(LS.source, null);
  };

  // ── fontes: playlists da campanha ─────────────────────────────────────────

  const [campaignPlaylists, setCampaignPlaylists] = useState<CampaignPlaylist[]>([]);
  const [loadingCampaign, setLoadingCampaign] = useState(false);

  // `silent` evita trocar a lista pelo "Carregando..." depois de cada edicao —
  // a gaveta aberta sumiria da tela a cada faixa adicionada.
  const loadCampaignPlaylists = useCallback(async (silent = false) => {
    if (!silent) setLoadingCampaign(true);
    try { setCampaignPlaylists(await api.playlists.list()); }
    catch { /* servidor fora do ar — a aba mostra a lista vazia */ }
    finally { if (!silent) setLoadingCampaign(false); }
  }, []);

  /** Converte as faixas salvas na campanha (URL + titulo) em fila tocavel. */
  const campaignQueue = useCallback((playlist: CampaignPlaylist): QueueTrack[] => (
    playlist.tracks
      .map((t) => {
        const { videoId } = parseYouTubeLink(t.url);
        return videoId ? { videoId, title: t.title, channel: '', thumb: '' } : null;
      })
      .filter((t): t is QueueTrack => t !== null)
  ), []);

  // ── fontes: conta do YouTube ──────────────────────────────────────────────

  const [ytStatus, setYtStatus] = useState<YouTubeAuthStatus | null>(null);
  const [ytPlaylists, setYtPlaylists] = useState<YouTubePlaylistRef[]>([]);
  const [ytLoading, setYtLoading] = useState(false);
  const [ytError, setYtError] = useState<string | null>(null);
  const [showConfig, setShowConfig] = useState(false);
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');

  const redirectUri = `${window.location.origin}/api/music/youtube/callback`;

  const refreshStatus = useCallback(async () => {
    try {
      const status = await api.youtube.status();
      setYtStatus(status);
      setClientId(status.clientId);
      return status;
    } catch {
      setYtStatus(null);
      return null;
    }
  }, []);

  const loadYtPlaylists = useCallback(async () => {
    setYtLoading(true);
    setYtError(null);
    try { setYtPlaylists(await api.youtube.playlists()); }
    catch (e: any) {
      setYtError(e?.message ?? 'Falha ao listar playlists.');
      if (e?.reauth) refreshStatus();
    } finally { setYtLoading(false); }
  }, [refreshStatus]);

  const playYtPlaylist = useCallback(async (pl: YouTubePlaylistRef) => {
    setYtLoading(true);
    setYtError(null);
    try {
      const items = await api.youtube.items(pl.id);
      startQueue(items.map(trackFromYouTube), pl.title);
      writeLS(LS.source, { kind: 'youtube', id: pl.id, name: pl.title } satisfies LastSource);
    } catch (e: any) {
      setYtError(e?.message ?? 'Falha ao carregar a playlist.');
      if (e?.reauth) refreshStatus();
    } finally { setYtLoading(false); }
  }, [startQueue, refreshStatus]);

  const connect = async () => {
    setYtError(null);
    try {
      const { url } = await api.youtube.authUrl(redirectUri);
      const popup = window.open(url, 'yt-music-auth', 'width=520,height=700');
      if (!popup) setYtError('O navegador bloqueou a janela de login. Libere pop-ups para este site.');
    } catch (e: any) {
      setYtError(e?.message ?? 'Falha ao iniciar o login.');
    }
  };

  const disconnect = async () => {
    try {
      setYtStatus(await api.youtube.disconnect());
      setYtPlaylists([]);
    } catch (e: any) { setYtError(e?.message ?? 'Falha ao desconectar.'); }
  };

  const saveConfig = async () => {
    setYtError(null);
    try {
      const status = await api.youtube.setConfig(clientId, clientSecret);
      setYtStatus(status);
      setClientSecret('');
      setShowConfig(false);
    } catch (e: any) { setYtError(e?.message ?? 'Falha ao salvar as credenciais.'); }
  };

  // A popup do callback avisa o opener quando o consentimento termina.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.source !== 'yt-music-auth') return;
      if (e.data.ok) {
        refreshStatus().then((status) => { if (status?.connected) loadYtPlaylists(); });
      } else {
        setYtError('Login cancelado ou recusado pelo Google.');
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [refreshStatus, loadYtPlaylists]);

  // ── fonte: link colado / busca ────────────────────────────────────────────

  const [findText, setFindText] = useState('');
  const [findResults, setFindResults] = useState<YouTubeTrack[]>([]);
  const [findLoading, setFindLoading] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);

  const submitFind = async () => {
    const text = findText.trim();
    if (!text) return;
    setFindError(null);
    setFindLoading(true);
    try {
      const link = parseYouTubeLink(text);

      if (link.listId) {
        // Playlist so vira fila navegavel com a conta conectada (a Data API e
        // quem lista as faixas).
        if (!ytStatus?.connected) {
          setFindError('Para tocar uma playlist inteira, conecte sua conta na aba "Conta".');
          return;
        }
        const [info, items] = await Promise.all([
          api.youtube.playlistInfo(link.listId).catch(() => null),
          api.youtube.items(link.listId),
        ]);
        startQueue(items.map(trackFromYouTube), info?.title ?? 'Playlist do YouTube');
        setFindResults([]);
        return;
      }

      if (link.videoId) {
        // Video avulso toca sem login nenhum — o iframe nao precisa da API.
        startQueue([{ videoId: link.videoId, title: text, channel: '', thumb: '' }], 'Link avulso');
        setFindResults([]);
        return;
      }

      if (!ytStatus?.connected) {
        setFindError('Cole um link do YouTube ou conecte sua conta para pesquisar.');
        return;
      }
      setFindResults(await api.youtube.search(text));
    } catch (e: any) {
      setFindError(e?.message ?? 'Não foi possível carregar.');
      if (e?.reauth) refreshStatus();
    } finally {
      setFindLoading(false);
    }
  };

  // ── carga inicial ─────────────────────────────────────────────────────────

  // A ultima playlist volta assim que o widget monta, mesmo minimizado: e ela
  // que da conteudo aos controles da barra compacta. Sem autoplay.
  const restored = useRef(false);
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    const last = readLS<LastSource | null>(LS.source, null);
    if (!last) return;
    if (last.kind === 'youtube') {
      api.youtube.items(last.id)
        .then((items) => cueQueue(items.map(trackFromYouTube), last.name))
        .catch(() => { /* conta desconectada ou playlist removida */ });
    } else {
      api.playlists.list()
        .then((lists) => {
          const pl = lists.find((p) => p.id === last.id);
          if (pl) cueQueue(campaignQueue(pl), pl.name);
        })
        .catch(() => { /* playlist removida */ });
    }
  }, [cueQueue, campaignQueue]);

  // Ja as listas de fonte so sao buscadas quando o painel abre pela primeira
  // vez — minimizado ninguem as ve.
  const initialized = useRef(false);
  useEffect(() => {
    if (collapsed || initialized.current) return;
    initialized.current = true;

    loadCampaignPlaylists();
    refreshStatus().then((status) => {
      if (status?.connected) loadYtPlaylists();
    });
  }, [collapsed, loadCampaignPlaylists, refreshStatus, loadYtPlaylists]);

  // ── render ────────────────────────────────────────────────────────────────

  // O iframe NUNCA sai da arvore nem troca de pai: minimizar o widget so o
  // esconde (videoHidden), senao a musica pararia junto.
  const playerHost = (
    <div style={showVideo && !collapsed ? st.videoBox : st.videoHidden}>
      <div ref={player.hostRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );

  const progressMax = player.duration || 0;
  const progressPct = progressMax > 0 ? Math.min(100, (player.current / progressMax) * 100) : 0;

  // Um unico container, que so troca de estilo ao minimizar. O host do iframe
  // precisa ficar SEMPRE na mesma posicao da arvore: se mudasse de pai, o React
  // remontaria o no, o iframe do YouTube seria recriado e a musica pararia.
  // Por isso o cabecalho ocupa um slot proprio (some sem sair do lugar) e os
  // dois corpos sao Fragments irmaos com key.
  return (
    <div style={st.wrapper}>
      <div style={collapsed ? st.miniBar : st.card}>
        {!collapsed && (
          <div style={st.header}>
            <Music2 size={14} color="var(--accent)" />
            <span style={st.headerTitle}>Trilha sonora</span>
            <div style={{ flex: 1 }} />
            <IconButton title={showVideo ? 'Ocultar vídeo' : 'Mostrar vídeo'} onClick={() => setShowVideo((v) => !v)}>
              {showVideo ? <Video size={13} /> : <VideoOff size={13} />}
            </IconButton>
            <IconButton title="Minimizar" onClick={() => setCollapsed(true)}>
              <ChevronDown size={14} />
            </IconButton>
          </div>
        )}

        {playerHost}

        {collapsed ? (
          <React.Fragment key="mini">
            <button
              style={st.miniIdentity}
              onClick={() => setCollapsed(false)}
              title={currentTrack ? `${cleanTitle(currentTrack.title)} — abrir player` : 'Abrir trilha sonora'}
            >
              {currentTrack?.thumb
                ? <img src={currentTrack.thumb} alt="" style={st.miniThumb} />
                : (
                  <div style={{ ...st.miniThumb, ...st.thumbEmpty, color: 'var(--accent)' }}>
                    {player.playing ? <EqualizerBars small /> : <Music2 size={15} />}
                  </div>
                )}
              <span style={st.miniText}>
                <span style={st.miniTitle}>
                  {currentTrack ? cleanTitle(currentTrack.title) : 'Trilha sonora'}
                </span>
                <span style={st.miniSub}>
                  {currentTrack ? (currentTrack.channel || sourceName || 'tocando') : 'nada tocando'}
                </span>
              </span>
            </button>

            <div style={st.miniControls}>
              <IconButton title="Anterior" onClick={goPrev} disabled={order.length === 0}>
                <SkipBack size={15} />
              </IconButton>
              <button
                style={{ ...st.miniPlay, opacity: currentTrack ? 1 : 0.4, cursor: currentTrack ? 'pointer' : 'default' }}
                onClick={togglePlay}
                disabled={!currentTrack}
                title={player.playing ? 'Pausar' : 'Tocar'}
              >
                {player.buffering
                  ? <Loader size={14} className="animate-spin" />
                  : player.playing ? <Pause size={14} /> : <Play size={14} style={{ marginLeft: 1 }} />}
              </button>
              <IconButton title="Próxima" onClick={goNext} disabled={order.length === 0}>
                <SkipForward size={15} />
              </IconButton>
              <IconButton
                title={muted ? 'Reativar som' : 'Mudo'}
                active={muted || volume === 0}
                onClick={() => setMutedState((m) => !m)}
              >
                {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
              </IconButton>
              <IconButton title="Abrir player" onClick={() => setCollapsed(false)}>
                <ChevronUp size={15} />
              </IconButton>
            </div>

            {/* progresso como fio fino na base — nao ocupa altura */}
            <div style={st.miniProgress}>
              <div style={{ ...st.miniProgressFill, width: `${progressPct}%` }} />
            </div>
          </React.Fragment>
        ) : (
          <React.Fragment key="full">
            {/* faixa atual */}
            <div style={st.nowPlaying}>
              {currentTrack?.thumb
                ? <img src={currentTrack.thumb} alt="" style={st.thumb} />
                : <div style={{ ...st.thumb, ...st.thumbEmpty }}><Music2 size={18} color="var(--text-muted)" /></div>}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={st.trackTitle} title={currentTrack?.title}>
                  {currentTrack ? cleanTitle(currentTrack.title) : 'Nada tocando'}
                </div>
                <div style={st.trackSub}>
                  {currentTrack
                    ? `${currentTrack.channel || sourceName}${order.length > 1 ? ` · ${pos + 1}/${order.length}` : ''}`
                    : 'Escolha uma playlist abaixo'}
                </div>
              </div>
              {queue.length > 0 && (
                <IconButton title="Limpar fila" onClick={clearQueue}><X size={13} /></IconButton>
              )}
            </div>

            {/* progresso */}
            <div style={st.progressRow}>
              <span style={st.time}>{formatTime(player.current)}</span>
              <input
                type="range"
                className="music-range"
                min={0}
                max={progressMax || 1}
                step={1}
                value={Math.min(player.current, progressMax || 1)}
                onChange={(e) => seek(Number(e.target.value))}
                disabled={!currentTrack || !progressMax}
                style={{ flex: 1 }}
              />
              <span style={st.time}>{formatTime(progressMax)}</span>
            </div>

            {/* controles */}
            <div style={st.controls}>
              <IconButton title={shuffle ? 'Aleatório: ligado' : 'Aleatório: desligado'} active={shuffle} onClick={toggleShuffle}>
                <Shuffle size={15} />
              </IconButton>
              <IconButton title="Anterior" onClick={goPrev} disabled={order.length === 0}><SkipBack size={17} /></IconButton>
              <button style={st.playButton} onClick={togglePlay} disabled={!currentTrack} title={player.playing ? 'Pausar' : 'Tocar'}>
                {player.buffering
                  ? <Loader size={18} className="animate-spin" />
                  : player.playing ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
              </button>
              <IconButton title="Próxima" onClick={goNext} disabled={order.length === 0}><SkipForward size={17} /></IconButton>
              <IconButton
                title={repeat === 'off' ? 'Repetir: desligado' : repeat === 'all' ? 'Repetir: playlist' : 'Repetir: faixa'}
                active={repeat !== 'off'}
                onClick={cycleRepeat}
              >
                {repeat === 'one' ? <Repeat1 size={15} /> : <Repeat size={15} />}
              </IconButton>
              <div style={st.volumeBox}>
                <IconButton title={muted ? 'Reativar som' : 'Mudo'} onClick={() => setMutedState((m) => !m)}>
                  {muted || volume === 0 ? <VolumeX size={14} /> : <Volume2 size={14} />}
                </IconButton>
                <input
                  type="range"
                  className="music-range"
                  min={0}
                  max={100}
                  value={muted ? 0 : volume}
                  onChange={(e) => { setMutedState(false); setVolumeState(Number(e.target.value)); }}
                  style={{ width: 72 }}
                />
              </div>
            </div>

            {notice && <div style={st.notice}>{notice}</div>}

            {/* abas de fonte */}
            <div style={st.tabs}>
              <TabButton active={tab === 'campaign'} onClick={() => setTab('campaign')} icon={<ListMusic size={12} />}>Campanha</TabButton>
              <TabButton active={tab === 'account'} onClick={() => setTab('account')} icon={<Music2 size={12} />}>Conta</TabButton>
              <TabButton active={tab === 'find'} onClick={() => setTab('find')} icon={<Search size={12} />}>Buscar</TabButton>
            </div>

            <div style={st.panel}>
              {tab === 'campaign' && (
                <CampaignPlaylists
                  playlists={campaignPlaylists}
                  loading={loadingCampaign}
                  connected={!!ytStatus?.connected}
                  currentTrack={currentTrack}
                  onReload={loadCampaignPlaylists}
                  onPlay={(pl) => {
                    startQueue(campaignQueue(pl), pl.name);
                    writeLS(LS.source, { kind: 'campaign', id: pl.id, name: pl.name } satisfies LastSource);
                  }}
                />
              )}

              {tab === 'account' && (
                <AccountPanel
                  status={ytStatus}
                  playlists={ytPlaylists}
                  loading={ytLoading}
                  error={ytError}
                  showConfig={showConfig}
                  clientId={clientId}
                  clientSecret={clientSecret}
                  redirectUri={redirectUri}
                  onClientId={setClientId}
                  onClientSecret={setClientSecret}
                  onToggleConfig={() => setShowConfig((v) => !v)}
                  onSaveConfig={saveConfig}
                  onConnect={connect}
                  onDisconnect={disconnect}
                  onRefresh={loadYtPlaylists}
                  onPlay={playYtPlaylist}
                />
              )}

              {tab === 'find' && (
                <FindPanel
                  text={findText}
                  onText={setFindText}
                  onSubmit={submitFind}
                  loading={findLoading}
                  error={findError}
                  results={findResults}
                  connected={!!ytStatus?.connected}
                  onPlayResult={(track, index, all) => startQueue(all.map(trackFromYouTube), 'Resultados da busca', index)}
                />
              )}
            </div>

            {/* fila */}
            {queue.length > 1 && (
              <div style={st.queueBox}>
                <div style={st.queueLabel}>{sourceName} · {queue.length} faixas</div>
                <div style={st.queueList}>
                  {order.map((qIndex, listPos) => {
                    const track = queue[qIndex];
                    if (!track) return null;
                    const isCurrent = listPos === pos;
                    return (
                      <button
                        key={`${track.videoId}-${listPos}`}
                        style={{ ...st.queueItem, ...(isCurrent ? st.queueItemActive : {}) }}
                        onClick={() => { autoplayRef.current = true; setPos(listPos); setPlayToken((t) => t + 1); }}
                        title={track.title}
                      >
                        <span style={st.queueIndex}>{isCurrent && player.playing ? <EqualizerBars small /> : listPos + 1}</span>
                        <span style={st.queueTitle}>{cleanTitle(track.title)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </React.Fragment>
        )}
      </div>
    </div>
  );
}

// ── subcomponentes ──────────────────────────────────────────────────────────

function TabButton({ children, icon, active, onClick }: {
  children: React.ReactNode; icon: React.ReactNode; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{ ...st.tab, ...(active ? st.tabActive : {}) }}>
      {icon}{children}
    </button>
  );
}

/** Barrinhas animadas — sinal visual de "tocando" no botão minimizado e na fila. */
function EqualizerBars({ small }: { small?: boolean }) {
  const height = small ? 9 : 14;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height }}>
      {[0, 1, 2].map((i) => (
        <span key={i} className="music-eq-bar" style={{ animationDelay: `${i * 0.15}s`, width: small ? 2 : 3, height }} />
      ))}
    </span>
  );
}

function PlaylistRow({ title, subtitle, thumb, onClick, disabled }: {
  title: string; subtitle: string; thumb?: string; onClick: () => void; disabled?: boolean;
}) {
  return (
    <button style={{ ...st.row, opacity: disabled ? 0.5 : 1 }} onClick={onClick} disabled={disabled} title={title}>
      {thumb
        ? <img src={thumb} alt="" style={st.rowThumb} />
        : <div style={{ ...st.rowThumb, ...st.thumbEmpty }}><ListMusic size={13} color="var(--text-muted)" /></div>}
      <span style={{ minWidth: 0, flex: 1, textAlign: 'left' }}>
        <span style={st.rowTitle}>{title}</span>
        <span style={st.rowSub}>{subtitle}</span>
      </span>
      <Play size={12} color="var(--accent)" style={{ flexShrink: 0 }} />
    </button>
  );
}

function AccountPanel(props: {
  status: YouTubeAuthStatus | null;
  playlists: YouTubePlaylistRef[];
  loading: boolean;
  error: string | null;
  showConfig: boolean;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  onClientId: (v: string) => void;
  onClientSecret: (v: string) => void;
  onToggleConfig: () => void;
  onSaveConfig: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
  onRefresh: () => void;
  onPlay: (pl: YouTubePlaylistRef) => void;
}) {
  const { status, playlists, loading, error } = props;
  const needsSetup = !status?.configured || props.showConfig;

  return (
    <>
      {error && <div style={st.error}>{error}</div>}

      {needsSetup && (
        <div style={st.setup}>
          <p style={st.hint}>
            O YouTube Music não tem API pública: o acesso à sua conta é feito pelo login do Google
            com permissão de leitura do YouTube (as playlists criadas no YT Music são as mesmas).
            Crie um <strong>OAuth Client ID</strong> (tipo <em>Aplicativo da Web</em>) no Google Cloud,
            com a <strong>YouTube Data API v3</strong> ativada.
          </p>
          <div style={st.redirectBox}>
            <span style={st.redirectLabel}>URI de redirecionamento autorizado</span>
            <div style={st.redirectRow}>
              <code style={st.redirectValue}>{props.redirectUri}</code>
              <IconButton title="Copiar" onClick={() => navigator.clipboard?.writeText(props.redirectUri)}>
                <Copy size={12} />
              </IconButton>
            </div>
          </div>
          <a href="https://console.cloud.google.com/apis/credentials" target="_blank" rel="noopener noreferrer" style={st.link}>
            Abrir Google Cloud Console <ExternalLink size={11} />
          </a>
          <Input label="Client ID" value={props.clientId} onChange={(e) => props.onClientId(e.target.value)} placeholder="....apps.googleusercontent.com" />
          <Input label="Client Secret" type="password" value={props.clientSecret} onChange={(e) => props.onClientSecret(e.target.value)} placeholder={status?.configured ? '•••••••• (mantém o atual se vazio)' : ''} />
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
            {status?.configured && <Button variant="ghost" size="sm" onClick={props.onToggleConfig}>Cancelar</Button>}
            <Button variant="primary" size="sm" onClick={props.onSaveConfig} disabled={!props.clientId.trim()}>Salvar</Button>
          </div>
        </div>
      )}

      {!needsSetup && !status?.connected && (
        <div style={st.setup}>
          <p style={st.hint}>Entre com a conta Google que você usa no YouTube Music para ver suas playlists aqui.</p>
          <Button variant="primary" size="sm" icon={<LogIn size={13} />} onClick={props.onConnect}>Entrar com Google</Button>
          <button style={st.textButton} onClick={props.onToggleConfig}>
            <Settings2 size={11} /> Alterar credenciais do app
          </button>
        </div>
      )}

      {!needsSetup && status?.connected && (
        <>
          <div style={st.panelHeader}>
            <span style={st.panelLabel}>
              {status.accountThumb && <img src={status.accountThumb} alt="" style={st.avatar} />}
              {status.accountName || 'Conta conectada'}
            </span>
            <IconButton title="Recarregar" onClick={props.onRefresh}><RefreshCw size={12} /></IconButton>
            <IconButton title="Sair da conta" onClick={props.onDisconnect}><LogOut size={12} /></IconButton>
          </div>
          {loading && <p style={st.hint}>Carregando...</p>}
          {!loading && playlists.length === 0 && <p style={st.hint}>Nenhuma playlist encontrada nesta conta.</p>}
          {playlists.map((pl) => (
            <PlaylistRow
              key={pl.id}
              title={pl.title}
              subtitle={`${pl.itemCount} faixa${pl.itemCount !== 1 ? 's' : ''}`}
              thumb={pl.thumb}
              onClick={() => props.onPlay(pl)}
            />
          ))}
        </>
      )}
    </>
  );
}

function FindPanel({ text, onText, onSubmit, loading, error, results, connected, onPlayResult }: {
  text: string;
  onText: (v: string) => void;
  onSubmit: () => void;
  loading: boolean;
  error: string | null;
  results: YouTubeTrack[];
  connected: boolean;
  onPlayResult: (track: YouTubeTrack, index: number, all: YouTubeTrack[]) => void;
}) {
  return (
    <>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
        <input
          value={text}
          onChange={(e) => onText(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
          placeholder={connected ? 'Link do YouTube ou busca...' : 'Cole um link do YouTube...'}
          style={st.findInput}
        />
        <Button variant="primary" size="sm" icon={<Search size={12} />} onClick={onSubmit} loading={loading} />
      </div>
      {error && <div style={st.error}>{error}</div>}
      {!error && results.length === 0 && (
        <p style={st.hint}>
          Aceita link de vídeo, de playlist e (com a conta conectada) busca por nome.
        </p>
      )}
      {results.map((track, index) => (
        <PlaylistRow
          key={track.videoId}
          title={cleanTitle(track.title)}
          subtitle={track.channel}
          thumb={track.thumb}
          onClick={() => onPlayResult(track, index, results)}
        />
      ))}
    </>
  );
}

// ── estilos ──────────────────────────────────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  wrapper: { pointerEvents: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 },

  // -- minimizado --
  miniBar: {
    position: 'relative',
    display: 'flex', alignItems: 'center', gap: 4,
    width: 320, maxWidth: 'calc(100vw - 40px)',
    padding: '6px 6px 8px 8px',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden', animation: 'slideIn 0.15s ease',
  },
  miniIdentity: {
    display: 'flex', alignItems: 'center', gap: 8,
    // minWidth 0 e o que deixa o titulo truncar em vez de empurrar os botoes.
    flex: 1, minWidth: 0, padding: 0,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  miniThumb: { width: 30, height: 30, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 },
  miniText: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
  miniTitle: {
    fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  miniSub: {
    fontSize: 10, color: 'var(--text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  miniControls: { display: 'flex', alignItems: 'center', flexShrink: 0 },
  miniPlay: {
    width: 28, height: 28, borderRadius: '50%', margin: '0 2px', flexShrink: 0,
    background: 'var(--accent)', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  miniProgress: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    height: 2, background: 'var(--bg-hover)',
  },
  miniProgressFill: { height: '100%', background: 'var(--accent)', transition: 'width 0.25s linear' },

  // -- aberto --
  // Coluna flex + teto de altura: preso ao rodape, o card cresceria para cima e
  // sairia da tela; assim o painel de fontes e a fila e que encolhem/rolam.
  card: {
    display: 'flex', flexDirection: 'column',
    width: 400, maxWidth: 'calc(100vw - 40px)',
    maxHeight: 'min(calc(100vh - 100px), 820px)',
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden', animation: 'slideIn 0.15s ease',
  },

  header: {
    display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
    padding: '9px 10px 9px 12px', borderBottom: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
  },
  headerTitle: { fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.2 },

  videoBox: { width: '100%', aspectRatio: '16 / 9', background: '#000', flexShrink: 0 },
  // Fora de vista, mas ainda no DOM: e o iframe que segura o audio.
  videoHidden: {
    position: 'absolute', width: 1, height: 1, opacity: 0,
    pointerEvents: 'none', overflow: 'hidden', left: -9999, top: -9999,
  },

  nowPlaying: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px 6px', flexShrink: 0 },
  thumb: { width: 42, height: 42, borderRadius: 'var(--radius-sm)', objectFit: 'cover', flexShrink: 0 },
  thumbEmpty: { background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  trackTitle: {
    fontSize: 13, fontWeight: 600, color: 'var(--text-primary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  trackSub: {
    fontSize: 11, color: 'var(--text-muted)', marginTop: 2,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },

  progressRow: { display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', flexShrink: 0 },
  time: { fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 30, textAlign: 'center' },

  controls: { display: 'flex', alignItems: 'center', gap: 2, padding: '6px 10px 10px', flexShrink: 0 },
  playButton: {
    width: 34, height: 34, borderRadius: '50%', margin: '0 4px',
    background: 'var(--accent)', border: 'none', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  volumeBox: { display: 'flex', alignItems: 'center', gap: 2, marginLeft: 'auto' },

  notice: {
    margin: '0 12px 8px', padding: '6px 8px', fontSize: 11, flexShrink: 0,
    color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 'var(--radius-sm)',
  },
  error: {
    marginBottom: 8, padding: '6px 8px', fontSize: 11,
    color: 'var(--error)', background: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 'var(--radius-sm)',
  },

  tabs: {
    display: 'flex', gap: 4, flexShrink: 0,
    padding: '8px 10px 0', borderTop: '1px solid var(--border)',
  },
  tab: {
    display: 'flex', alignItems: 'center', gap: 4, flex: 1, justifyContent: 'center',
    padding: '5px 6px', fontSize: 11, fontWeight: 600,
    background: 'none', border: '1px solid transparent', borderRadius: 'var(--radius-sm)',
    color: 'var(--text-muted)', cursor: 'pointer',
  },
  tabActive: { background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' },

  panel: { padding: '8px 10px', flex: '1 1 auto', minHeight: 90, maxHeight: 340, overflowY: 'auto' },
  panelHeader: { display: 'flex', alignItems: 'center', gap: 4, marginBottom: 4 },
  panelLabel: {
    flex: 1, display: 'flex', alignItems: 'center', gap: 6,
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 0.5, color: 'var(--text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  avatar: { width: 16, height: 16, borderRadius: '50%' },

  row: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '6px 6px', marginBottom: 2,
    background: 'none', border: 'none', borderRadius: 'var(--radius-sm)',
    cursor: 'pointer', textAlign: 'left',
  },
  rowThumb: { width: 30, height: 30, borderRadius: 4, objectFit: 'cover', flexShrink: 0 },
  rowTitle: {
    display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  rowSub: {
    display: 'block', fontSize: 10, color: 'var(--text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },

  setup: { display: 'flex', flexDirection: 'column', gap: 8 },
  hint: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 },
  redirectBox: {
    display: 'flex', flexDirection: 'column', gap: 4,
    background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)', padding: '6px 8px',
  },
  redirectLabel: {
    fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
    color: 'var(--text-muted)',
  },
  redirectRow: { display: 'flex', alignItems: 'center', gap: 6 },
  redirectValue: {
    flex: 1, minWidth: 0, fontSize: 10, color: 'var(--text-secondary)',
    wordBreak: 'break-all', fontFamily: 'monospace',
  },
  link: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    fontSize: 11, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none',
  },
  textButton: {
    display: 'inline-flex', alignItems: 'center', gap: 4,
    background: 'none', border: 'none', padding: 0,
    fontSize: 11, color: 'var(--text-muted)', cursor: 'pointer',
  },

  findInput: {
    flex: 1, padding: '6px 8px', fontSize: 12,
    background: 'var(--bg-base)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
  },

  queueBox: {
    display: 'flex', flexDirection: 'column', minHeight: 0, flex: '0 1 auto',
    borderTop: '1px solid var(--border)', padding: '8px 10px',
  },
  queueLabel: {
    fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
    color: 'var(--text-muted)', marginBottom: 4,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  queueList: { flex: '1 1 auto', minHeight: 44, maxHeight: 240, overflowY: 'auto' },
  queueItem: {
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '4px 6px', background: 'none', border: 'none',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer', textAlign: 'left',
  },
  queueItemActive: { background: 'var(--accent-dim)' },
  queueIndex: {
    width: 16, flexShrink: 0, fontSize: 10, color: 'var(--text-muted)',
    fontVariantNumeric: 'tabular-nums', display: 'flex', justifyContent: 'center',
  },
  queueTitle: {
    flex: 1, minWidth: 0, fontSize: 12, color: 'var(--text-secondary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
};
