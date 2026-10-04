import React, { useRef, useEffect } from 'react';
import { Circle, GitMerge, Trash2, ZoomIn, ZoomOut } from 'lucide-react';
import { MapNode, MapPath, PathCharacteristic, PATH_CHAR_META } from '../../types';
import { NODE_R_MIN, NODE_R_MAX, nodeEditorRadius, Selection } from './mapEditorUtils';

const CHARACTERISTICS: PathCharacteristic[] = ['difficult','no_vision','jump','unstable','dangerous','blocked'];

export function PropertiesPanel({
  selected, nodes, paths, onUpdateNode, onUpdatePath, onDelete, autoFocusName, onFocusDone,
}: {
  selected: Selection | null; nodes: MapNode[]; paths: MapPath[];
  onUpdateNode: (id: string, patch: Partial<MapNode>) => void;
  onUpdatePath: (id: string, patch: Partial<MapPath>) => void;
  onDelete: (sel: Selection) => void;
  autoFocusName?: boolean;
  onFocusDone?: () => void;
}) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocusName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
      onFocusDone?.();
    }
  }, [autoFocusName, selected?.id]);

  if (!selected) {
    return (
      <div style={s.empty}>
        <Circle size={28} color="var(--text-muted)" style={{ opacity: 0.25 }} />
        <p style={{ color: 'var(--text-muted)', fontSize: 12, textAlign: 'center', margin: 0 }}>
          Clique em um nó ou caminho para editar.
        </p>
      </div>
    );
  }

  if (selected.type === 'node') {
    const node = nodes.find(n => n.id === selected.id);
    if (!node) return null;
    const r = nodeEditorRadius(node);
    return (
      <div style={s.panel}>
        <div style={s.header}><Circle size={13} color="var(--accent)" /> Nó</div>
        <label style={s.label}>Nome</label>
        <input ref={nameInputRef} style={s.input} value={node.name}
          onChange={e => onUpdateNode(node.id, { name: e.target.value })} />
        <label style={s.label}>Limite de ocupação</label>
        <input style={s.input} type="number" min={1} value={node.occupancyLimit}
          onChange={e => onUpdateNode(node.id, { occupancyLimit: Math.max(1, Number(e.target.value)) })} />
        <label style={s.label}>Tamanho do nó</label>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={s.stepBtn} onClick={() => onUpdateNode(node.id, { radius: Math.max(NODE_R_MIN, r - 4) })}><ZoomOut size={13} /></button>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', minWidth: 28, textAlign: 'center' }}>{r}</span>
          <button style={s.stepBtn} onClick={() => onUpdateNode(node.id, { radius: Math.min(NODE_R_MAX, r + 4) })}><ZoomIn size={13} /></button>
        </div>
        <label style={s.label}>Descrição</label>
        <textarea style={{ ...s.input, height: 64, resize: 'vertical', fontFamily: 'inherit' }}
          value={node.description ?? ''}
          onChange={e => onUpdateNode(node.id, { description: e.target.value })} />
        <button style={s.deleteBtn} onClick={() => onDelete(selected)}><Trash2 size={12} /> Remover nó</button>
      </div>
    );
  }

  if (selected.type === 'path') {
    const path = paths.find(p => p.id === selected.id);
    if (!path) return null;
    const srcNode = nodes.find(n => n.id === path.sourceId);
    const tgtNode = nodes.find(n => n.id === path.targetId);
    const toggleChar = (c: PathCharacteristic) => {
      const has = path.characteristics.includes(c);
      onUpdatePath(path.id, {
        characteristics: has ? path.characteristics.filter(x => x !== c) : [...path.characteristics, c],
      });
    };
    return (
      <div style={s.panel}>
        <div style={s.header}><GitMerge size={13} color="var(--accent)" /> Caminho</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 10 }}>
          {srcNode?.name ?? '?'} &#8596; {tgtNode?.name ?? '?'}
        </div>
        <label style={s.label}>Distância</label>
        <input style={s.input} type="number" min={1} value={path.distance}
          onChange={e => onUpdatePath(path.id, { distance: Math.max(1, Number(e.target.value)) })} />
        <label style={{ ...s.label, marginBottom: 6 }}>Características</label>
        {CHARACTERISTICS.map(c => {
          const meta = PATH_CHAR_META[c];
          const active = path.characteristics.includes(c);
          return (
            <label key={c} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', fontSize: 12, marginBottom: 4 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, flexShrink: 0, background: active ? meta.color : 'var(--bg-elevated)', border: `1px solid ${active ? meta.color : 'var(--border)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={() => toggleChar(c)}>
                {active && <span style={{ fontSize: 9, color: '#fff', fontWeight: 700 }}>&#10003;</span>}
              </div>
              <span style={{ color: active ? meta.color : 'var(--text-secondary)' }}>{meta.label}</span>
            </label>
          );
        })}
        <button style={{ ...s.deleteBtn, marginTop: 10 }} onClick={() => onDelete(selected)}><Trash2 size={12} /> Remover caminho</button>
      </div>
    );
  }
  return null;
}

const s: Record<string, any> = {
  panel:     { padding: 16, display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' as const },
  header:    { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 },
  label:     { fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: 0.5, marginTop: 4 },
  input:     { padding: '6px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, width: '100%', boxSizing: 'border-box' as const },
  stepBtn:   { display: 'flex', alignItems: 'center', justifyContent: 'center', width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-elevated)', cursor: 'pointer', color: 'var(--text-secondary)' },
  deleteBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 8, padding: '6px 12px', borderRadius: 6, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', cursor: 'pointer', fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap' },
  empty:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 20 },
};
