import React, { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Wifi, Copy, Check, AlertTriangle, RefreshCw, Smartphone } from 'lucide-react';
import { api } from '../../services/api';
import { AccessInfo, AccessLink } from '../../types';
import { ONLINE } from '../../online/config';
import { getRoom } from '../../online/session';
import RoomInvite from '../../online/RoomInvite';

// Por que este painel existe: o link que o mestre passava era o nome mDNS
// (eva.local). Hotspot de celular, Wi-Fi de convidado e rede publica nao repassam
// mDNS, entao nesses casos o nome nao resolve e a pagina nao abre pro jogador —
// sem nenhuma mensagem que explique. Aqui o mestre ve o endereco IP de cada rede
// da maquina, em QR pra ninguem digitar errado, e o mDNS aparece so como opcao.

export default function PlayerAccessPanel() {
  return ONLINE ? <OnlineAccessPanel /> : <LanAccessPanel />;
}

// Modo online: nao ha rede local — o jogador entra pelo link/codigo da sala.
function OnlineAccessPanel() {
  const room = getRoom();
  if (!room) return <p style={s.muted}>Nenhuma sala aberta.</p>;
  return (
    <div style={s.wrap}>
      <div style={s.intro}>
        <Wifi size={16} color="var(--accent)" />
        <p style={s.introText}>
          Mande o link (ou o código) para os jogadores. Funciona de qualquer rede — Wi-Fi, 4G, outra cidade.
        </p>
      </div>
      <RoomInvite code={room.code} />
    </div>
  );
}

function LanAccessPanel() {
  const [info, setInfo] = useState<AccessInfo | null>(null);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<string>('');
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);

  const load = () => {
    setError('');
    api.network.access()
      .then((data) => {
        setInfo(data);
        setSelected((cur) => (data.links.some((l) => l.url === cur) ? cur : data.links[0]?.url ?? ''));
      })
      .catch((e: any) => setError(e.message ?? 'Nao foi possivel ler as redes da maquina'));
  };

  useEffect(load, []);

  useEffect(() => {
    if (!selected) { setQr(''); return; }
    // Fundo branco fixo (e nao as cores do tema): camera de celular erra a leitura
    // quando o contraste do QR cai, e o painel do mestre roda em tema escuro.
    QRCode.toDataURL(selected, { width: 480, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } })
      .then(setQr)
      .catch(() => setQr(''));
  }, [selected]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(selected);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError('O navegador bloqueou a copia — selecione o endereco acima e copie a mao.');
    }
  };

  const ipLinks = info?.links.filter((l) => !l.mdns) ?? [];
  const mdnsLink = info?.links.find((l) => l.mdns);

  return (
    <div style={s.wrap}>
      <div style={s.intro}>
        <Wifi size={16} color="var(--accent)" />
        <p style={s.introText}>
          Os jogadores precisam estar <strong>na mesma rede que esta maquina</strong> (mesmo Wi-Fi,
          mesmo hotspot). Passe o link abaixo ou deixe que eles leiam o QR.
        </p>
      </div>

      {error && (
        <div style={s.errorBox}><AlertTriangle size={14} color="var(--error)" /> <span>{error}</span></div>
      )}

      {!info ? (
        <p style={s.muted}>Carregando redes...</p>
      ) : ipLinks.length === 0 ? (
        <div style={s.errorBox}>
          <AlertTriangle size={14} color="var(--error)" />
          <span>Esta maquina nao esta conectada a nenhuma rede. Conecte ao Wi-Fi ou ao hotspot e recarregue.</span>
        </div>
      ) : (
        <>
          <div style={s.main}>
            <div style={s.qrBox}>
              {qr ? <img src={qr} alt={`QR para ${selected}`} style={s.qrImg} /> : <div style={s.qrPlaceholder} />}
              <span style={s.qrHint}><Smartphone size={12} /> Aponte a camera do celular</span>
            </div>

            <div style={s.linkCol}>
              <label style={s.label}>Link do jogador</label>
              <div style={s.urlRow}>
                <code style={s.url}>{selected}</code>
                <button style={s.copyBtn} onClick={copy} title="Copiar link">
                  {copied ? <Check size={14} color="var(--success)" /> : <Copy size={14} color="var(--text-secondary)" />}
                </button>
              </div>

              {info.devMode && (
                <p style={s.warnText}>
                  Modo de desenvolvimento: o link aponta pro Vite (porta 5173). Em producao,
                  rode <code>npm run build</code> e <code>npm start</code> para servir tudo na porta {info.port}.
                </p>
              )}

              <label style={{ ...s.label, marginTop: 6 }}>Rede a usar</label>
              <div style={s.optionList}>
                {ipLinks.map((l) => (
                  <LinkOption key={l.url} link={l} active={l.url === selected} onSelect={() => setSelected(l.url)} />
                ))}
                {mdnsLink && (
                  <LinkOption link={mdnsLink} active={mdnsLink.url === selected} onSelect={() => setSelected(mdnsLink.url)} />
                )}
              </div>

              <button style={s.refresh} onClick={load}>
                <RefreshCw size={12} /> Reconectou o Wi-Fi? Atualizar lista
              </button>
            </div>
          </div>

          <details style={s.help}>
            <summary style={s.helpSummary}>O jogador diz que a pagina nao abre</summary>
            <ol style={s.helpList}>
              <li>
                <strong>Confira a rede.</strong> Celular e maquina precisam estar no mesmo Wi-Fi/hotspot.
                Dados moveis ligados no celular costumam ter prioridade sobre o Wi-Fi — peca pra desligar os dados.
              </li>
              <li>
                <strong>Firewall do Windows.</strong> Ao entrar num hotspot, o Windows marca a rede como
                "Publica" e bloqueia conexao de fora. Libere uma vez: na pasta do projeto, rode{' '}
                <code>npm run firewall</code> e aceite o pedido de administrador.
              </li>
              <li>
                <strong>Troque de endereco.</strong> Se a maquina tem mais de uma rede, teste os outros
                itens da lista acima — cada um e uma placa/rede diferente.
              </li>
              <li>
                <strong>Evite o link <code>.local</code></strong> em hotspot de celular e Wi-Fi de convidado:
                essas redes nao repassam a descoberta de nomes, so o endereco numerico funciona.
              </li>
              <li>
                <strong>Isolamento de clientes.</strong> Alguns roteadores e hotspots impedem que aparelhos
                conversem entre si. Se nada funciona, desligue "isolamento de clientes"/"AP isolation" no
                roteador ou use outro ponto de acesso.
              </li>
            </ol>
          </details>
        </>
      )}
    </div>
  );
}

function LinkOption({ link, active, onSelect }: { link: AccessLink; active: boolean; onSelect: () => void }) {
  return (
    <button
      style={{ ...s.option, ...(active ? s.optionActive : {}) }}
      onClick={onSelect}
    >
      <span style={s.radio}>{active && <span style={s.radioDot} />}</span>
      <span style={s.optionBody}>
        <code style={s.optionUrl}>{link.url}</code>
        <span style={s.optionLabel}>
          {link.label}
          {link.recommended && <span style={s.tag}>recomendado</span>}
        </span>
      </span>
    </button>
  );
}

const s: Record<string, any> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  intro: { display: 'flex', gap: 9, alignItems: 'flex-start' },
  introText: { margin: 0, fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6 },
  muted: { fontSize: 13, color: 'var(--text-muted)', margin: 0 },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 12.5,
    color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
    border: '1px solid var(--error)', borderRadius: 'var(--radius)',
  },
  main: { display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'flex-start' },
  qrBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7 },
  qrImg: { width: 190, height: 190, borderRadius: 'var(--radius)', display: 'block', background: '#fff' },
  qrPlaceholder: { width: 190, height: 190, borderRadius: 'var(--radius)', background: 'var(--bg-elevated)' },
  qrHint: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text-muted)' },
  linkCol: { flex: 1, minWidth: 260, display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' },
  urlRow: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px',
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  },
  url: { flex: 1, fontSize: 13.5, color: 'var(--text-primary)', wordBreak: 'break-all' },
  copyBtn: {
    background: 'none', border: 'none', cursor: 'pointer', padding: 4,
    display: 'flex', alignItems: 'center', flexShrink: 0,
  },
  warnText: { margin: 0, fontSize: 11.5, color: 'var(--warning)', lineHeight: 1.6 },
  optionList: { display: 'flex', flexDirection: 'column', gap: 5 },
  option: {
    display: 'flex', alignItems: 'flex-start', gap: 9, width: '100%', textAlign: 'left',
    padding: '8px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', cursor: 'pointer',
  },
  optionActive: { borderColor: 'var(--accent)', background: 'var(--accent-dim)' },
  radio: {
    width: 13, height: 13, borderRadius: '50%', border: '1px solid var(--text-muted)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2,
  },
  radioDot: { width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)' },
  optionBody: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  optionUrl: { fontSize: 12.5, color: 'var(--text-primary)', wordBreak: 'break-all' },
  optionLabel: { fontSize: 11, color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 6 },
  tag: {
    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase',
    color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 5px', borderRadius: 4,
  },
  refresh: {
    alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 2,
    background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', padding: 0,
  },
  help: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius)', padding: '10px 14px',
  },
  helpSummary: { fontSize: 12.5, fontWeight: 600, color: 'var(--text-secondary)', cursor: 'pointer' },
  helpList: {
    margin: '10px 0 2px', paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8,
    fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.65,
  },
};
