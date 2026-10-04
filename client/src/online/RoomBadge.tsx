import React, { useEffect, useState } from 'react';
import { Radio, X, LogOut, Download, Users } from 'lucide-react';
import Button from '../components/common/Button';
import RoomInvite from './RoomInvite';
import { RoomSession } from './session';
import { hostEvents, hostState, HostState } from './host/hostRuntime';
import { guestEvents, guestState, GuestState } from './guestRuntime';
import { downloadBackup } from './backup';

// Etiqueta flutuante da sala (canto inferior esquerdo): codigo, status e, ao
// clicar, convite/backup (mestre) ou sair (jogador).
export default function RoomBadge({ room, onLeave }: { room: RoomSession; onLeave: () => void }) {
  const isHost = room.role === 'host';
  const [host, setHost] = useState<HostState>({ ...hostState });
  const [guest, setGuest] = useState<GuestState>({ ...guestState });
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onHost = (st: HostState) => setHost(st);
    const onGuest = (st: GuestState) => setGuest(st);
    hostEvents.on('change', onHost);
    guestEvents.on('change', onGuest);
    return () => { hostEvents.off('change', onHost); guestEvents.off('change', onGuest); };
  }, []);

  const ok = isHost ? host.status === 'online' : guest.status === 'online';
  const bad = isHost ? host.status === 'error' : guest.status === 'error' || guest.status === 'host-offline';
  const color = ok ? 'var(--success)' : bad ? 'var(--error)' : 'var(--warning)';
  const label = isHost
    ? (ok ? `${host.peers} ${host.peers === 1 ? 'conexão' : 'conexões'}` : host.message)
    : (ok ? 'conectado' : guest.message);

  const leave = () => {
    const msg = isHost
      ? 'Fechar a sala? Os jogadores serão desconectados (os dados continuam salvos neste navegador).'
      : 'Sair da sala?';
    if (window.confirm(msg)) onLeave();
  };

  return (
    <>
      <button style={{ ...s.pill, ...(isHost ? s.center : {}) }} onClick={() => setOpen((v) => !v)} title="Sala online">
        <span style={{ ...s.dot, background: color }} />
        <Radio size={12} color="var(--text-secondary)" />
        <span style={s.code}>{room.code}</span>
        <span style={s.label}>{label}</span>
      </button>

      {open && (
        <div style={{ ...s.panel, ...(isHost ? s.center : {}) }}>
          <div style={s.head}>
            <span style={s.title}>{isHost ? 'Convidar jogadores' : 'Sala online'}</span>
            <button style={s.close} onClick={() => setOpen(false)}><X size={15} color="var(--text-muted)" /></button>
          </div>

          {isHost ? (
            <>
              <RoomInvite code={room.code} compact />
              <div style={s.status}>
                <Users size={13} /> {host.peers} {host.peers === 1 ? 'aparelho conectado' : 'aparelhos conectados'}
                {host.status !== 'online' && <span style={{ color }}> · {host.message}</span>}
              </div>
              <div style={s.status}>
                {host.saveError
                  ? <span style={{ color: 'var(--error)' }}>Falha ao salvar: {host.saveError}</span>
                  : host.lastSavedAt
                    ? <>Salvo neste navegador às {new Date(host.lastSavedAt).toLocaleTimeString('pt-BR')}</>
                    : <>Salvo neste navegador</>}
              </div>
              <div style={s.actions}>
                <Button size="sm" variant="secondary" icon={<Download size={13} />} onClick={() => { void downloadBackup(); }}>
                  Exportar backup
                </Button>
                <Button size="sm" variant="danger" icon={<LogOut size={13} />} onClick={leave}>Fechar sala</Button>
              </div>
            </>
          ) : (
            <>
              <div style={s.status}>Código <strong style={{ color: 'var(--text-primary)', letterSpacing: '0.15em' }}>{room.code}</strong> · {label}</div>
              <div style={s.actions}>
                <Button size="sm" variant="danger" icon={<LogOut size={13} />} onClick={leave}>Sair da sala</Button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}

const s: Record<string, React.CSSProperties> = {
  pill: {
    position: 'fixed', left: 12, bottom: 12, zIndex: 10000, display: 'inline-flex', alignItems: 'center', gap: 6,
    maxWidth: 'calc(100vw - 24px)', padding: '5px 10px', borderRadius: 999, cursor: 'pointer',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)',
    color: 'var(--text-secondary)', fontSize: 11.5,
  },
  // Mestre: centralizado embaixo, longe do rodape do menu e do player de musica.
  center: { left: '50%', transform: 'translateX(-50%)' },
  dot: { width: 7, height: 7, borderRadius: '50%', flexShrink: 0 },
  code: { fontWeight: 700, letterSpacing: '0.12em', color: 'var(--text-primary)' },
  label: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 200 },
  panel: {
    position: 'fixed', left: 12, bottom: 48, zIndex: 10000, width: 340, maxWidth: 'calc(100vw - 24px)',
    maxHeight: 'calc(100vh - 70px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
    padding: 14, background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', boxShadow: 'var(--shadow-lg)',
  },
  head: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  close: { background: 'none', border: 'none', cursor: 'pointer', padding: 2, display: 'flex' },
  status: { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: 'var(--text-muted)' },
  actions: { display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'space-between' },
};
