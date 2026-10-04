import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Copy, Check, Smartphone, Share2 } from 'lucide-react';
import { inviteLink } from './config';

// Link de convite da sala: QR + copiar + compartilhar (no celular abre o menu
// nativo, dai vai direto pro WhatsApp/Discord).
export default function RoomInvite({ code, compact = false }: { code: string; compact?: boolean }) {
  const link = inviteLink(code);
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState<'link' | 'code' | null>(null);

  useEffect(() => {
    QRCode.toDataURL(link, { width: 480, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [link]);

  const copy = async (what: 'link' | 'code') => {
    try {
      await navigator.clipboard.writeText(what === 'link' ? link : code);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch { /* navegador bloqueou: o texto esta visivel pra copiar a mao */ }
  };

  const share = () => {
    navigator.share?.({ title: 'EVA S — mesa', text: `Entra na mesa! Código ${code}`, url: link }).catch(() => undefined);
  };

  const size = compact ? 150 : 190;

  return (
    <div style={{ ...s.wrap, flexDirection: compact ? 'column' : 'row', alignItems: compact ? 'center' : 'flex-start' }}>
      <div style={s.qrBox}>
        {qr ? <img src={qr} alt="QR do convite" style={{ ...s.qr, width: size, height: size }} />
          : <div style={{ ...s.qr, width: size, height: size }} />}
        <span style={s.hint}><Smartphone size={12} /> Aponte a câmera do celular</span>
      </div>

      <div style={s.col}>
        <label style={s.label}>Código da sala</label>
        <div style={s.row}>
          <code style={s.code}>{code}</code>
          <button style={s.iconBtn} onClick={() => copy('code')} title="Copiar código">
            {copied === 'code' ? <Check size={14} color="var(--success)" /> : <Copy size={14} color="var(--text-secondary)" />}
          </button>
        </div>

        <label style={s.label}>Link de convite</label>
        <div style={s.row}>
          <code style={s.url}>{link}</code>
          <button style={s.iconBtn} onClick={() => copy('link')} title="Copiar link">
            {copied === 'link' ? <Check size={14} color="var(--success)" /> : <Copy size={14} color="var(--text-secondary)" />}
          </button>
          {typeof navigator.share === 'function' && (
            <button style={s.iconBtn} onClick={share} title="Compartilhar"><Share2 size={14} color="var(--text-secondary)" /></button>
          )}
        </div>
        <p style={s.note}>
          Quem abrir o link entra como jogador. A mesa funciona enquanto esta aba estiver aberta — se você
          recarregar a página, os jogadores reconectam sozinhos.
        </p>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap: { display: 'flex', gap: 18, flexWrap: 'wrap' },
  qrBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 },
  qr: { borderRadius: 'var(--radius)', display: 'block', background: '#fff' },
  hint: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' },
  col: { flex: 1, minWidth: 220, display: 'flex', flexDirection: 'column', gap: 6, width: '100%' },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' },
  row: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  },
  code: { flex: 1, fontSize: 18, fontWeight: 700, letterSpacing: '0.25em', color: 'var(--text-primary)' },
  url: { flex: 1, fontSize: 12.5, color: 'var(--text-primary)', wordBreak: 'break-all' },
  iconBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex', alignItems: 'center', flexShrink: 0 },
  note: { margin: '4px 0 0', fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55 },
};
