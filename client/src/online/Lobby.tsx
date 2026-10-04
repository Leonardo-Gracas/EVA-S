import React, { useEffect, useRef, useState } from 'react';
import { Crown, Users, ArrowRight, Download, Upload, Database, RefreshCw, AlertTriangle } from 'lucide-react';
import EvaLogo from '../components/layout/EvaLogo';
import Button from '../components/common/Button';
import { newRoomCode, normalizeCode, isValidCode, CODE_LENGTH } from './config';
import { lastHostCode, lastJoinCode } from './session';
import { loadMeta, StorageMeta } from './host/storage';
import { downloadBackup, pickFiles, readBackupFile, finishImport, PendingImport } from './backup';

interface Props {
  onHost: (code: string) => void;
  onJoin: (code: string) => void;
  initialError?: string;
}

export default function Lobby({ onHost, onJoin, initialError }: Props) {
  const previousHost = lastHostCode();
  const [code, setCode] = useState(() => lastJoinCode() ?? '');
  const [error, setError] = useState(initialError ?? '');
  const [meta, setMeta] = useState<StorageMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [pending, setPending] = useState<PendingImport | null>(null);
  const [progress, setProgress] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = 'EVA S — Mesa online';
    loadMeta().then(setMeta).catch(() => setMeta(null));
  }, []);

  const join = () => {
    const c = normalizeCode(code);
    if (!isValidCode(c)) {
      setError(`O código tem ${CODE_LENGTH} letras/números.`);
      inputRef.current?.focus();
      return;
    }
    onJoin(c);
  };

  const exportDb = async () => {
    setBusy(true);
    setError('');
    try {
      const ok = await downloadBackup();
      if (!ok) setError('Ainda não há dados salvos neste navegador.');
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao exportar.');
    } finally {
      setBusy(false);
    }
  };

  const importDb = async () => {
    setError('');
    setNotice('');
    const [file] = await pickFiles({ accept: '.db,.sqlite,.sqlite3' });
    if (!file) return;
    try {
      const p = await readBackupFile(file);
      if (p.uploads.length > 0) { setPending(p); return; }
      await confirmAndImport(p, []);
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao importar.');
    }
  };

  const confirmAndImport = async (p: PendingImport, images: File[]) => {
    const ok = window.confirm(
      `Importar "${p.name}"?\n\nIsso SUBSTITUI todas as campanhas salvas neste navegador. ` +
      'Se quiser guardar as atuais, cancele e exporte um backup antes.',
    );
    if (!ok) return;
    setBusy(true);
    try {
      const r = await finishImport(p, images, (d, t) => setProgress(`Convertendo imagens ${d}/${t}...`));
      setPending(null);
      setNotice(
        p.uploads.length === 0
          ? 'Backup importado. Abra a sala para usar.'
          : `Backup importado com ${r.embedded} de ${p.uploads.length} imagens.` +
            (r.missing > 0 ? ' As que faltaram ficam sem avatar (dá pra reenviar na ficha).' : ''),
      );
      setMeta(await loadMeta());
    } catch (e: any) {
      setError(e?.message ?? 'Falha ao importar.');
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  const pickUploadsFolder = async () => {
    if (!pending) return;
    const files = await pickFiles({ directory: true, multiple: true });
    if (files.length === 0) return;
    await confirmAndImport(pending, files);
  };

  const fmtDate = (iso: string) => new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
  const fmtSize = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoRow}><EvaLogo size={40} withText /></div>
        <div style={s.subtitle}>MESA ONLINE</div>

        <div style={s.body}>
          {error && (
            <div style={s.errorBox}><AlertTriangle size={14} color="var(--error)" /><span>{error}</span></div>
          )}
          {notice && <div style={s.noticeBox}>{notice}</div>}

          <section style={s.section}>
            <div style={s.sectionHead}><Users size={16} color="var(--accent)" /><span>Entrar numa sala</span></div>
            <div style={s.joinRow}>
              <input
                ref={inputRef}
                style={s.codeInput}
                value={code}
                placeholder="CÓDIGO"
                maxLength={CODE_LENGTH + 2}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                onChange={(e) => { setCode(normalizeCode(e.target.value)); setError(''); }}
                onKeyDown={(e) => { if (e.key === 'Enter') join(); }}
              />
              <Button variant="primary" onClick={join} icon={<ArrowRight size={15} />}>Entrar</Button>
            </div>
            <p style={s.hint}>Jogador: use o código ou o link que o mestre enviou.</p>
          </section>

          <div style={s.divider}><i style={s.line} /><span>ou</span><i style={s.line} /></div>

          <section style={s.section}>
            <div style={s.sectionHead}><Crown size={16} color="var(--warning)" /><span>Sou o mestre</span></div>
            {previousHost ? (
              <>
                <Button variant="primary" onClick={() => onHost(previousHost)} style={{ width: '100%' }}>
                  Abrir minha sala · {previousHost}
                </Button>
                <button style={s.linkBtn} onClick={() => onHost(newRoomCode())}>
                  <RefreshCw size={11} /> Abrir com um código novo (links antigos param de funcionar)
                </button>
              </>
            ) : (
              <Button variant="primary" onClick={() => onHost(newRoomCode())} style={{ width: '100%' }}>
                Criar sala
              </Button>
            )}

            <div style={s.dataBox}>
              <div style={s.dataHead}>
                <Database size={13} color="var(--text-muted)" />
                <span>
                  {meta
                    ? <>Campanhas salvas neste navegador · {fmtSize(meta.size)} · {fmtDate(meta.savedAt)}</>
                    : <>Nenhuma campanha salva neste navegador ainda.</>}
                </span>
              </div>
              <div style={s.dataBtns}>
                <Button size="sm" variant="secondary" onClick={exportDb} loading={busy} icon={<Download size={13} />}>
                  Exportar backup
                </Button>
                <Button size="sm" variant="ghost" onClick={importDb} icon={<Upload size={13} />}>
                  Importar backup
                </Button>
              </div>
              {pending && (
                <div style={s.noticeBox}>
                  <p style={{ margin: '0 0 8px' }}>
                    <strong>{pending.name}</strong> usa {pending.uploads.length} imagens da pasta de uploads do EVA S
                    local. Selecione a pasta <code>server/data/uploads</code> para trazer os avatares junto.
                  </p>
                  {progress && <p style={{ margin: '0 0 8px' }}>{progress}</p>}
                  <div style={s.dataBtns}>
                    <Button size="sm" variant="primary" onClick={pickUploadsFolder} loading={busy}>Selecionar pasta</Button>
                    <Button size="sm" variant="secondary" onClick={() => confirmAndImport(pending, [])} disabled={busy}>Importar sem imagens</Button>
                    <Button size="sm" variant="ghost" onClick={() => setPending(null)} disabled={busy}>Cancelar</Button>
                  </div>
                </div>
              )}
              <p style={s.hint}>
                Tudo fica guardado só neste navegador. Exporte um backup (.db) de vez em quando — ele também
                serve para levar as campanhas para outro computador. O <code>rpg-manager.db</code> do EVA S local
                pode ser importado aqui.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: {
    minHeight: '100vh', background: 'var(--bg-base)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', padding: 16,
  },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)',
    width: '100%', maxWidth: 440, overflow: 'hidden',
  },
  logoRow: { display: 'flex', justifyContent: 'center', padding: '28px 24px 8px' },
  subtitle: { textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', letterSpacing: '0.14em', paddingBottom: 20 },
  body: { padding: 20, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 16 },
  section: { display: 'flex', flexDirection: 'column', gap: 10 },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' },
  joinRow: { display: 'flex', gap: 8 },
  codeInput: {
    flex: 1, minWidth: 0, padding: '9px 12px', fontSize: 18, fontWeight: 700, letterSpacing: '0.3em',
    textAlign: 'center', fontFamily: 'monospace', textTransform: 'uppercase',
    background: 'var(--bg-elevated)', color: 'var(--text-primary)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius)', outline: 'none',
  },
  hint: { margin: 0, fontSize: 11.5, color: 'var(--text-muted)', lineHeight: 1.55 },
  divider: {
    display: 'flex', alignItems: 'center', gap: 10, fontSize: 11,
    color: 'var(--text-disabled)', textTransform: 'uppercase', letterSpacing: '0.1em',
  },
  line: { flex: 1, height: 1, background: 'var(--border)' },
  linkBtn: {
    alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none',
    color: 'var(--text-muted)', fontSize: 11.5, cursor: 'pointer', padding: 0,
  },
  dataBox: {
    display: 'flex', flexDirection: 'column', gap: 8, padding: '10px 12px', marginTop: 4,
    background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)',
  },
  dataHead: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'var(--text-secondary)' },
  dataBtns: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  errorBox: {
    display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', fontSize: 12.5,
    color: 'var(--text-secondary)', background: 'var(--bg-elevated)',
    border: '1px solid var(--error)', borderRadius: 'var(--radius)',
  },
  noticeBox: {
    padding: '10px 12px', fontSize: 12.5, color: 'var(--text-secondary)',
    background: 'var(--accent-dim)', borderRadius: 'var(--radius)',
  },
};
