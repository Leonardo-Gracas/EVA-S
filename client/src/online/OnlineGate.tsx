import React, { useEffect, useState } from 'react';
import { Loader2, AlertTriangle } from 'lucide-react';
import EvaLogo from '../components/layout/EvaLogo';
import Button from '../components/common/Button';
import Lobby from './Lobby';
import RoomBadge from './RoomBadge';
import { RoomSession, getRoom, setRoom, clearRoom, lastJoinCode } from './session';
import { normalizeCode, isValidCode } from './config';
import { installFetchShim } from './fetchShim';
import { startHost, stopHost } from './host/hostRuntime';
import { startGuest, stopGuest, guestEvents, guestState, GuestState } from './guestRuntime';
import { getGmToken, clearPlayerSession } from '../services/api';


/** Le /sala/CODIGO (link de convite) ou a sala desta aba. */
function initialRoom(): { room: RoomSession | null; error?: string } {
  const m = /^\/sala\/([^/?#]+)/i.exec(window.location.pathname);
  if (m) {
    const code = normalizeCode(decodeURIComponent(m[1]));
    if (!isValidCode(code)) {
      window.history.replaceState(null, '', '/');
      return { room: null, error: 'Link de sala inválido.' };
    }
    return { room: enterAsPlayer(code) };
  }
  return { room: getRoom() };
}

function enterAsPlayer(code: string): RoomSession {
  // Login de jogador e por sala: o id salvo de outra mesa nao existe nesta.
  if (lastJoinCode() !== code) {
    try { clearPlayerSession(); } catch { /* ok */ }
  }
  const room: RoomSession = { role: 'player', code };
  setRoom(room);
  window.history.replaceState(null, '', '/player');
  return room;
}

function enterAsHost(code: string): RoomSession {
  const room: RoomSession = { role: 'host', code };
  setRoom(room);
  if (/^\/(player|sala)/.test(window.location.pathname)) window.history.replaceState(null, '', '/');
  return room;
}

export default function OnlineGate({ children }: { children: React.ReactNode }) {
  const [{ room, error }, setState] = useState(initialRoom);

  const leave = async () => {
    if (room?.role === 'host') await stopHost();
    else {
      stopGuest();
      try { clearPlayerSession(); } catch { /* ok */ }
    }
    clearRoom();
    // Recarrega do zero: os modulos do servidor/P2P ficam limpos.
    window.location.assign('/');
  };

  if (!room) {
    return (
      <Lobby
        initialError={error}
        onHost={(code) => setState({ room: enterAsHost(code) })}
        onJoin={(code) => setState({ room: enterAsPlayer(code) })}
      />
    );
  }

  return room.role === 'host'
    ? <HostBoot room={room} onLeave={leave}>{children}</HostBoot>
    : <GuestBoot room={room} onLeave={leave}>{children}</GuestBoot>;
}

function HostBoot({ room, onLeave, children }: { room: RoomSession; onLeave: () => void; children: React.ReactNode }) {
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [err, setErr] = useState('');

  useEffect(() => {
    if (/^\/(player|sala)/.test(window.location.pathname)) window.history.replaceState(null, '', '/');
    installFetchShim();
    startHost(room.code, getGmToken())
      .then(() => setPhase('ready'))
      .catch((e: any) => { console.error(e); setErr(e?.message ?? String(e)); setPhase('error'); });
  }, [room.code]);

  if (phase === 'loading') return <Splash text="Carregando suas campanhas..." />;
  if (phase === 'error') {
    return <Splash text="Não foi possível abrir a sala." detail={err} error onBack={onLeave} />;
  }
  return <>{children}<RoomBadge room={room} onLeave={onLeave} /></>;
}

function GuestBoot({ room, onLeave, children }: { room: RoomSession; onLeave: () => void; children: React.ReactNode }) {
  const [st, setSt] = useState<GuestState>({ ...guestState });

  useEffect(() => {
    if (!window.location.pathname.startsWith('/player')) window.history.replaceState(null, '', '/player');
    installFetchShim();
    const onChange = (next: GuestState) => setSt(next);
    guestEvents.on('change', onChange);
    startGuest(room.code);
    return () => { guestEvents.off('change', onChange); };
  }, [room.code]);

  if (!st.everConnected) {
    return (
      <Splash
        text={`Entrando na sala ${room.code}...`}
        detail={st.status === 'connecting' ? undefined : st.message}
        error={st.status === 'error'}
        onBack={onLeave}
        backLabel="Voltar"
      />
    );
  }
  return <>{children}<RoomBadge room={room} onLeave={onLeave} /></>;
}

function Splash({ text, detail, error, onBack, backLabel = 'Voltar ao início' }: {
  text: string; detail?: string; error?: boolean; onBack?: () => void; backLabel?: string;
}) {
  return (
    <div style={s.page}>
      <div style={s.box}>
        <EvaLogo size={36} withText />
        <div style={s.row}>
          {error
            ? <AlertTriangle size={16} color="var(--error)" />
            : <Loader2 size={16} color="var(--accent)" style={{ animation: 'evas-spin 1s linear infinite' }} />}
          <span>{text}</span>
        </div>
        {detail && <p style={s.detail}>{detail}</p>}
        {onBack && <Button size="sm" variant="ghost" onClick={onBack}>{backLabel}</Button>}
      </div>
      <style>{'@keyframes evas-spin { to { transform: rotate(360deg); } }'}</style>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { minHeight: '100vh', background: 'var(--bg-base)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, maxWidth: 360, textAlign: 'center' },
  row: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: 'var(--text-secondary)' },
  detail: { margin: 0, fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.55 },
};
