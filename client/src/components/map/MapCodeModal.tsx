import React, { useMemo, useState, useEffect } from 'react';
import { Sparkles, Copy, Check, AlertTriangle, XCircle, FileCode, Trash2 } from 'lucide-react';
import { MapNode, MapPath, PATH_CHAR_META } from '../../types';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { parseMapDsl, MAP_DSL_PROMPT, MAP_DSL_EXAMPLE, ParsedMap } from './mapDsl';
import { nodeEditorRadius } from './mapEditorUtils';

export interface MapCodeImport {
  name: string;
  nodes: MapNode[];
  paths: MapPath[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  /** Nome do mapa aberto no editor; habilita a opção "substituir". */
  currentMapName?: string | null;
  /** Código pré-carregado (usado ao exportar o mapa atual). */
  initialCode?: string;
  onImport: (data: MapCodeImport, mode: 'new' | 'replace') => void | Promise<void>;
}

export function MapCodeModal({ open, onClose, currentMapName, initialCode, onImport }: Props) {
  const [code, setCode] = useState('');
  const [copied, setCopied] = useState<'prompt' | 'code' | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) { setCode(initialCode ?? ''); setCopied(null); }
  }, [open, initialCode]);

  const parsed = useMemo<ParsedMap | null>(() => {
    if (!code.trim()) return null;
    return parseMapDsl(code);
  }, [code]);

  const canImport = !!parsed && parsed.errors.length === 0 && parsed.nodes.length > 0;

  async function copy(what: 'prompt' | 'code', text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(c => (c === what ? null : c)), 1800);
    } catch {
      alert('Não foi possível copiar. Selecione o texto manualmente.');
    }
  }

  async function run(mode: 'new' | 'replace') {
    if (!parsed || !canImport) return;
    setBusy(true);
    try {
      await onImport({ name: parsed.name, nodes: parsed.nodes, paths: parsed.paths }, mode);
      onClose();
    } finally { setBusy(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Mapa por código" width={860}>
      <div style={s.wrap}>
        <p style={s.intro}>
          Cole o código gerado pela IA (formato <strong>MAPDSL</strong>) e o mapa é montado com os nós
          posicionados automaticamente. Use o botão abaixo para copiar o prompt com a especificação
          completa e colar em qualquer IA.
        </p>

        <div style={s.actionsRow}>
          <Button
            variant="secondary" size="sm"
            icon={copied === 'prompt' ? <Check size={13} /> : <Sparkles size={13} />}
            onClick={() => copy('prompt', MAP_DSL_PROMPT)}
          >
            {copied === 'prompt' ? 'Prompt copiado!' : 'Copiar prompt para IA'}
          </Button>
          <Button variant="ghost" size="sm" icon={<FileCode size={13} />} onClick={() => setCode(MAP_DSL_EXAMPLE)}>
            Carregar exemplo
          </Button>
          {code && (
            <>
              <Button
                variant="ghost" size="sm"
                icon={copied === 'code' ? <Check size={13} /> : <Copy size={13} />}
                onClick={() => copy('code', code)}
              >
                {copied === 'code' ? 'Copiado!' : 'Copiar código'}
              </Button>
              <Button variant="ghost" size="sm" icon={<Trash2 size={13} />} onClick={() => setCode('')}>
                Limpar
              </Button>
            </>
          )}
        </div>

        <div style={s.split}>
          <textarea
            style={s.textarea}
            value={code}
            spellCheck={false}
            placeholder={'MAP Nome do Mapa\nGRID 200\n\nN | entrada | Entrada | 4 | 0,1 |  | Portas de bronze.\nN | salao   | Salão   | 8 | 0,0 |  | Colunas quebradas.\n\nP | entrada | salao | 3 | dificil | Escadaria'}
            onChange={e => setCode(e.target.value)}
          />
          <div style={s.previewCol}>
            <div style={s.previewLabel}>Prévia</div>
            <MapPreview parsed={parsed} />
            {parsed && (
              <div style={s.stats}>
                <strong style={{ color: 'var(--text-primary)' }}>{parsed.name}</strong>
                <span>{parsed.nodes.length} nó{parsed.nodes.length !== 1 ? 's' : ''} · {parsed.paths.length} caminho{parsed.paths.length !== 1 ? 's' : ''}</span>
                <span style={{ color: 'var(--text-muted)' }}>layout: {parsed.layout} · grid: {parsed.grid}</span>
              </div>
            )}
          </div>
        </div>

        {parsed && (parsed.errors.length > 0 || parsed.warnings.length > 0) && (
          <div style={s.issues}>
            {parsed.errors.map((e, i) => (
              <div key={`e${i}`} style={{ ...s.issue, color: 'var(--error)' }}>
                <XCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{e.line > 0 && <b>Linha {e.line}: </b>}{e.message}</span>
              </div>
            ))}
            {parsed.warnings.map((w, i) => (
              <div key={`w${i}`} style={{ ...s.issue, color: '#f59e0b' }}>
                <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
                <span>{w.line > 0 && <b>Linha {w.line}: </b>}{w.message}</span>
              </div>
            ))}
          </div>
        )}

        <div style={s.footer}>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <div style={{ flex: 1 }} />
          {currentMapName && (
            <Button variant="secondary" disabled={!canImport} loading={busy} onClick={() => run('replace')}>
              Substituir "{currentMapName}"
            </Button>
          )}
          <Button variant="primary" disabled={!canImport} loading={busy} onClick={() => run('new')}>
            Criar mapa
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Prévia em miniatura ──────────────────────────────────────────────────────

function MapPreview({ parsed }: { parsed: ParsedMap | null }) {
  if (!parsed || parsed.nodes.length === 0) {
    return <div style={s.previewEmpty}>A prévia aparece aqui conforme você cola o código.</div>;
  }
  const pad = 60;
  const xs = parsed.nodes.map(n => n.x);
  const ys = parsed.nodes.map(n => n.y);
  const maxR = Math.max(...parsed.nodes.map(nodeEditorRadius));
  const minX = Math.min(...xs) - maxR - pad;
  const minY = Math.min(...ys) - maxR - pad;
  const w = Math.max(Math.max(...xs) + maxR + pad - minX, 1);
  const h = Math.max(Math.max(...ys) + maxR + pad - minY, 1);
  const scale = Math.max(w, h) / 300; // espessuras constantes em tela

  return (
    <svg style={s.preview} viewBox={`${minX} ${minY} ${w} ${h}`} preserveAspectRatio="xMidYMid meet">
      {parsed.paths.map(p => {
        const a = parsed.nodes.find(n => n.id === p.sourceId);
        const b = parsed.nodes.find(n => n.id === p.targetId);
        if (!a || !b) return null;
        const color = p.characteristics.length > 0 ? PATH_CHAR_META[p.characteristics[0]].color : 'var(--border)';
        return (
          <line key={p.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
            stroke={color} strokeWidth={2.5 * scale}
            strokeDasharray={p.characteristics.includes('blocked') ? `${8 * scale} ${6 * scale}` : undefined} />
        );
      })}
      {parsed.nodes.map(n => (
        <g key={n.id}>
          <circle cx={n.x} cy={n.y} r={nodeEditorRadius(n)} fill="var(--bg-surface)" stroke="var(--accent)" strokeWidth={1.8 * scale} />
          <text x={n.x} y={n.y} textAnchor="middle" dominantBaseline="central"
            fontSize={13 * scale} fontWeight={600} fill="var(--text-primary)">
            {n.name.length > 12 ? n.name.slice(0, 11) + '…' : n.name}
          </text>
        </g>
      ))}
    </svg>
  );
}

const s: Record<string, React.CSSProperties> = {
  wrap:         { display: 'flex', flexDirection: 'column', gap: 12 },
  intro:        { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 },
  actionsRow:   { display: 'flex', gap: 8, flexWrap: 'wrap' },
  split:        { display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' },
  textarea:     { flex: '1 1 380px', minHeight: 300, padding: 12, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', fontSize: 12, lineHeight: 1.6, resize: 'vertical', whiteSpace: 'pre', overflowWrap: 'normal', overflowX: 'auto' },
  previewCol:   { flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 260 },
  previewLabel: { fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  preview:      { flex: 1, minHeight: 240, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'block' },
  previewEmpty: { flex: 1, minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 20, background: 'var(--bg-base)', border: '1px dashed var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)', fontSize: 12 },
  stats:        { display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: 'var(--text-secondary)' },
  issues:       { maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 5, padding: 10, background: 'var(--bg-base)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)' },
  issue:        { display: 'flex', gap: 6, alignItems: 'flex-start', fontSize: 11, lineHeight: 1.5 },
  footer:       { display: 'flex', gap: 8, alignItems: 'center', paddingTop: 4 },
};

export default MapCodeModal;
