import React, { useState } from 'react';
import { Plus, Play, Trash2, Edit2, RefreshCw, Check, X, Loader, ListPlus } from 'lucide-react';
import { api } from '../../services/api';
import type { CampaignPlaylist, PlaylistMood } from '../../types';
import IconButton from './IconButton';
import { MoodIcon, moodColor, moodLabel, MOOD_OPTIONS } from './moods';
import { parseYouTubeLink, cleanTitle } from './youtubeUrl';

// ─────────────────────────────────────────────────────────────────────────────
// Aba "Campanha" do player: lista, toca E edita as playlists da campanha.
//
// A edicao morava em Campanha > Musicas, longe de onde a musica toca. Aqui ela
// fica ao lado do play, e o titulo da faixa vem da API do YouTube a partir do
// link colado — antes era um campo obrigatorio digitado a mao, que engolia o
// "salvar" em silencio quando ficava vazio.
// ─────────────────────────────────────────────────────────────────────────────

/** So faixas com link de video do YouTube tocam no player embutido. */
function playableCount(pl: CampaignPlaylist): number {
  return pl.tracks.filter((t) => parseYouTubeLink(t.url).videoId).length;
}

interface Props {
  playlists: CampaignPlaylist[];
  loading: boolean;
  /** Conta do YouTube conectada — sem ela nao da para resolver titulos. */
  connected: boolean;
  currentTrack: { videoId: string; title: string } | null;
  onReload: (silent?: boolean) => void | Promise<void>;
  onPlay: (pl: CampaignPlaylist) => void;
}

export default function CampaignPlaylists({ playlists, loading, connected, currentTrack, onReload, onPlay }: Props) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<{ name: string; mood: PlaylistMood }>({ name: '', mood: 'exploration' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resetForm = () => { setCreating(false); setForm({ name: '', mood: 'exploration' }); setError(null); };

  const startCreate = () => {
    setCreating(true);
    setOpenId(null);
    setForm({ name: '', mood: 'exploration' });
    setError(null);
  };

  const createPlaylist = async () => {
    const name = form.name.trim();
    if (!name) { setError('Dê um nome à playlist.'); return; }
    setBusy(true);
    setError(null);
    try {
      const pl = await api.playlists.create({ name, mood: form.mood });
      await onReload(true);
      resetForm();
      // Ja abre a nova: quem acabou de criar quer adicionar faixas.
      setOpenId(pl.id);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível criar a playlist.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div style={st.header}>
        <span style={st.headerLabel}>Playlists da campanha</span>
        <IconButton title="Nova playlist" onClick={startCreate}><Plus size={13} /></IconButton>
        <IconButton title="Recarregar" onClick={() => onReload()}><RefreshCw size={12} /></IconButton>
      </div>

      {error && <div style={st.error}>{error}</div>}

      {creating && (
        <div style={st.form}>
          <input
            autoFocus
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            onKeyDown={(e) => { if (e.key === 'Enter') createPlaylist(); if (e.key === 'Escape') resetForm(); }}
            placeholder="Nome da playlist"
            style={st.input}
          />
          <select
            value={form.mood}
            onChange={(e) => setForm((f) => ({ ...f, mood: e.target.value as PlaylistMood }))}
            style={{ ...st.input, flex: '0 0 96px' }}
          >
            {MOOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          <IconButton title="Criar" onClick={createPlaylist} disabled={busy}>
            {busy ? <Loader size={13} className="animate-spin" /> : <Check size={14} />}
          </IconButton>
          <IconButton title="Cancelar" onClick={resetForm}><X size={13} /></IconButton>
        </div>
      )}

      {loading && <p style={st.hint}>Carregando playlists...</p>}

      {!loading && playlists.length === 0 && !creating && (
        <p style={st.hint}>
          Nenhuma playlist ainda. Use <strong>+</strong> para criar a primeira e depois cole links
          do YouTube nas faixas.
        </p>
      )}

      {playlists.map((pl) => (
        <PlaylistItem
          key={pl.id}
          playlist={pl}
          open={openId === pl.id}
          connected={connected}
          currentTrack={currentTrack}
          onToggle={() => { setOpenId(openId === pl.id ? null : pl.id); setCreating(false); }}
          onPlay={() => onPlay(pl)}
          onReload={onReload}
        />
      ))}
    </>
  );
}

// ── uma playlist: linha + gaveta de edicao ──────────────────────────────────

function PlaylistItem({ playlist, open, connected, currentTrack, onToggle, onPlay, onReload }: {
  playlist: CampaignPlaylist;
  open: boolean;
  connected: boolean;
  currentTrack: { videoId: string; title: string } | null;
  onToggle: () => void;
  onPlay: () => void;
  onReload: (silent?: boolean) => void | Promise<void>;
}) {
  const [name, setName] = useState(playlist.name);
  const [mood, setMood] = useState<PlaylistMood>(playlist.mood);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const playable = playableCount(playlist);
  const total = playlist.tracks.length;
  const color = moodColor(playlist.mood);
  const dirty = name.trim() !== playlist.name || mood !== playlist.mood;

  const subtitle = total === 0
    ? 'sem faixas'
    : playable === total
      ? `${moodLabel(playlist.mood)} · ${total} faixa${total !== 1 ? 's' : ''}`
      : `${moodLabel(playlist.mood)} · ${playable} de ${total} tocáveis`;

  const saveMeta = async () => {
    const trimmed = name.trim();
    if (!trimmed) { setError('O nome não pode ficar vazio.'); return; }
    setBusy(true);
    setError(null);
    try {
      await api.playlists.update(playlist.id, { name: trimmed, mood });
      await onReload(true);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível salvar.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Remover a playlist "${playlist.name}" e suas faixas?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.playlists.delete(playlist.id);
      await onReload(true);
    } catch (e: any) {
      setError(e?.message ?? 'Não foi possível remover.');
      setBusy(false);
    }
  };

  return (
    <div style={{ ...st.item, borderLeftColor: color }}>
      <div style={st.itemRow}>
        <span style={{ ...st.moodBadge, color, background: `${color}22` }}>
          <MoodIcon mood={playlist.mood} size={12} />
        </span>
        <button
          style={st.itemMain}
          onClick={onPlay}
          disabled={playable === 0}
          title={playable > 0 ? `Tocar ${playlist.name}` : 'Nenhuma faixa com link do YouTube'}
        >
          <span style={st.itemTitle}>{playlist.name}</span>
          <span style={st.itemSub}>{subtitle}</span>
        </button>
        <IconButton title="Tocar" onClick={onPlay} disabled={playable === 0}><Play size={12} /></IconButton>
        <IconButton title={open ? 'Fechar edição' : 'Editar'} active={open} onClick={onToggle}>
          <Edit2 size={12} />
        </IconButton>
      </div>

      {open && (
        <div style={st.drawer}>
          {error && <div style={st.error}>{error}</div>}

          <div style={st.form}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && dirty) saveMeta(); }}
              placeholder="Nome"
              style={st.input}
            />
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value as PlaylistMood)}
              style={{ ...st.input, flex: '0 0 96px' }}
            >
              {MOOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <IconButton title="Salvar alterações" onClick={saveMeta} disabled={busy || !dirty} active={dirty}>
              {busy ? <Loader size={13} className="animate-spin" /> : <Check size={14} />}
            </IconButton>
            <IconButton title="Remover playlist" onClick={remove} disabled={busy}><Trash2 size={12} /></IconButton>
          </div>

          <TrackEditor
            playlist={playlist}
            connected={connected}
            currentTrack={currentTrack}
            onReload={onReload}
          />
        </div>
      )}
    </div>
  );
}

// ── faixas da playlist ──────────────────────────────────────────────────────

function TrackEditor({ playlist, connected, currentTrack, onReload }: {
  playlist: CampaignPlaylist;
  connected: boolean;
  currentTrack: { videoId: string; title: string } | null;
  onReload: (silent?: boolean) => void | Promise<void>;
}) {
  const [link, setLink] = useState('');
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);

  const addTrack = async (rawUrl: string, rawTitle: string) => {
    const url = rawUrl.trim();
    const { videoId, listId } = parseYouTubeLink(url);
    if (!videoId) {
      setMessage(listId
        ? 'Esse link é de uma playlist inteira. Aqui vai um vídeo por faixa — para tocar a playlist do YouTube, use a aba "Buscar".'
        : 'Cole o link de um vídeo do YouTube.');
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      let finalTitle = rawTitle.trim();
      // Titulo em branco: a Data API resolve pelo id. Sem conta conectada nao
      // ha como — ai o campo passa a ser obrigatorio, mas dizendo o porque.
      if (!finalTitle && connected) {
        const found = await api.youtube.videos([videoId]).catch(() => []);
        if (found[0]?.title) finalTitle = cleanTitle(found[0].title);
      }
      if (!finalTitle) {
        setMessage(connected
          ? 'Não consegui o título desse vídeo — escreva um.'
          : 'Escreva um título, ou conecte a conta na aba "Conta" para buscá-lo automaticamente.');
        return;
      }

      await api.playlists.addTrack(playlist.id, { title: finalTitle, url });
      setLink('');
      setTitle('');
      await onReload(true);
    } catch (e: any) {
      setMessage(e?.message ?? 'Não foi possível adicionar a faixa.');
    } finally {
      setBusy(false);
    }
  };

  const renameTrack = async () => {
    if (!renaming) return;
    const novo = renaming.title.trim();
    if (!novo) { setMessage('O título não pode ficar vazio.'); return; }
    setBusy(true);
    setMessage(null);
    try {
      await api.playlists.updateTrack(renaming.id, { title: novo });
      setRenaming(null);
      await onReload(true);
    } catch (e: any) {
      setMessage(e?.message ?? 'Não foi possível renomear a faixa.');
    } finally {
      setBusy(false);
    }
  };

  const removeTrack = async (id: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await api.playlists.deleteTrack(id);
      await onReload(true);
    } catch (e: any) {
      setMessage(e?.message ?? 'Não foi possível remover a faixa.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {playlist.tracks.length > 0 && (
        <div style={st.trackList}>
          {playlist.tracks.map((t) => {
            const ok = !!parseYouTubeLink(t.url).videoId;
            const editando = renaming?.id === t.id;
            return (
              <div key={t.id} style={st.trackRow}>
                <span
                  style={{ ...st.trackDot, background: ok ? 'var(--accent)' : 'var(--warning)' }}
                  title={ok ? undefined : 'Sem link de vídeo do YouTube — esta faixa não toca no player'}
                />
                {editando ? (
                  <>
                    <input
                      autoFocus
                      value={renaming.title}
                      onChange={(e) => setRenaming({ id: t.id, title: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') renameTrack();
                        if (e.key === 'Escape') setRenaming(null);
                      }}
                      style={st.input}
                    />
                    <IconButton title="Salvar título" onClick={renameTrack} disabled={busy}>
                      <Check size={12} />
                    </IconButton>
                    <IconButton title="Cancelar" onClick={() => setRenaming(null)}><X size={12} /></IconButton>
                  </>
                ) : (
                  <>
                    <button
                      style={st.trackTitle}
                      onClick={() => setRenaming({ id: t.id, title: t.title })}
                      title={`${t.title}\n${t.url}\n\nClique para renomear`}
                    >
                      {t.title}
                    </button>
                    <IconButton title="Remover faixa" onClick={() => removeTrack(t.id)} disabled={busy}>
                      <X size={12} />
                    </IconButton>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div style={st.form}>
        <input
          value={link}
          onChange={(e) => setLink(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTrack(link, title); }}
          placeholder="Link do vídeo no YouTube"
          style={{ ...st.input, flex: 2 }}
        />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTrack(link, title); }}
          placeholder={connected ? 'Título (automático)' : 'Título'}
          style={{ ...st.input, flex: 1 }}
        />
        <IconButton title="Adicionar faixa" onClick={() => addTrack(link, title)} disabled={busy || !link.trim()}>
          {busy ? <Loader size={13} className="animate-spin" /> : <Plus size={14} />}
        </IconButton>
      </div>

      {currentTrack && (
        <button
          style={st.textButton}
          disabled={busy}
          onClick={() => addTrack(
            `https://www.youtube.com/watch?v=${currentTrack.videoId}`,
            cleanTitle(currentTrack.title),
          )}
        >
          <ListPlus size={11} /> Adicionar a faixa que está tocando
        </button>
      )}

      {message && <div style={st.notice}>{message}</div>}
    </>
  );
}

// ── estilos ─────────────────────────────────────────────────────────────────

const st: Record<string, React.CSSProperties> = {
  header: { display: 'flex', alignItems: 'center', gap: 2, marginBottom: 6 },
  headerLabel: {
    flex: 1, fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
    letterSpacing: 0.5, color: 'var(--text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },

  item: {
    borderLeft: '2px solid transparent',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-base)',
    marginBottom: 4,
    overflow: 'hidden',
  },
  itemRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 4px 5px 7px' },
  moodBadge: {
    width: 22, height: 22, borderRadius: 'var(--radius-sm)', flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  itemMain: {
    display: 'flex', flexDirection: 'column', gap: 1,
    flex: 1, minWidth: 0, padding: 0,
    background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left',
  },
  itemTitle: {
    fontSize: 12, fontWeight: 600, color: 'var(--text-primary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
  },
  itemSub: {
    fontSize: 10, color: 'var(--text-muted)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%',
  },

  drawer: {
    display: 'flex', flexDirection: 'column', gap: 6,
    padding: '6px 7px 8px', borderTop: '1px solid var(--border)',
  },
  form: { display: 'flex', alignItems: 'center', gap: 4 },
  input: {
    flex: 1, minWidth: 0, padding: '5px 7px', fontSize: 11,
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', outline: 'none',
  },

  trackList: { display: 'flex', flexDirection: 'column' },
  trackRow: { display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' },
  trackDot: { width: 5, height: 5, borderRadius: '50%', flexShrink: 0 },
  trackTitle: {
    flex: 1, minWidth: 0, fontSize: 11, color: 'var(--text-secondary)',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'text',
  },

  textButton: {
    display: 'inline-flex', alignItems: 'center', gap: 4, alignSelf: 'flex-start',
    background: 'none', border: 'none', padding: 0,
    fontSize: 11, fontWeight: 600, color: 'var(--accent)', cursor: 'pointer',
  },

  hint: { fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, margin: 0 },
  notice: {
    padding: '5px 7px', fontSize: 10, lineHeight: 1.4,
    color: 'var(--warning)', background: 'rgba(245, 158, 11, 0.12)',
    borderRadius: 'var(--radius-sm)',
  },
  error: {
    marginBottom: 6, padding: '6px 8px', fontSize: 11,
    color: 'var(--error)', background: 'rgba(239, 68, 68, 0.12)',
    borderRadius: 'var(--radius-sm)',
  },
};
