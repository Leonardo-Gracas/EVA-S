import React, { useState } from 'react';
import { Circle, GitMerge, ChevronDown, ChevronUp, Edit2 } from 'lucide-react';
import { MapNode, MapPath, PATH_CHAR_META } from '../../types';
import Button from '../common/Button';

export function ListView({
  nodes, paths, onEnterEdit, onEnterEditNode,
}: {
  nodes: MapNode[]; paths: MapPath[];
  onEnterEdit: () => void;
  onEnterEditNode: (nodeId: string) => void;
}) {
  const [expandedNode, setExpandedNode] = useState<string | null>(null);
  const [expandedPath, setExpandedPath] = useState<string | null>(null);

  return (
    <div style={s.shell}>
      <div style={s.topRow}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)' }}>
          {nodes.length} nó{nodes.length !== 1 ? 's' : ''}  ·  {paths.length} caminho{paths.length !== 1 ? 's' : ''}
        </span>
        <Button variant="primary" size="sm" icon={<Edit2 size={13} />} onClick={onEnterEdit}>Editar mapa</Button>
      </div>
      <div style={s.list}>
        {nodes.length === 0 && (
          <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', padding: '30px 0' }}>
            Nenhum nó. Entre no modo de edição para criar.
          </p>
        )}
        {nodes.map(node => {
          const connPaths = paths.filter(p => p.sourceId === node.id || p.targetId === node.id);
          const expanded = expandedNode === node.id;
          return (
            <div key={node.id} style={s.nodeCard}>
              <div style={s.nodeHeader} onClick={() => setExpandedNode(expanded ? null : node.id)}>
                <Circle size={13} color="var(--accent)" />
                <span style={s.nodeName}>{node.name}</span>
                <span style={s.badge}>Ocup. {node.occupancyLimit}</span>
                <span style={s.pathCount}>{connPaths.length} caminho{connPaths.length !== 1 ? 's' : ''}</span>
                <button style={s.editBtn} title="Editar no canvas"
                  onClick={e => { e.stopPropagation(); onEnterEditNode(node.id); }}>
                  <Edit2 size={11} />
                </button>
                {expanded ? <ChevronUp size={13} color="var(--text-muted)" /> : <ChevronDown size={13} color="var(--text-muted)" />}
              </div>
              {expanded && (
                <div style={s.nodeExpanded}>
                  {node.description && <p style={s.desc}>{node.description}</p>}
                  {connPaths.length === 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sem conexões.</span>
                  )}
                  {connPaths.map(p => {
                    const otherId = p.sourceId === node.id ? p.targetId : p.sourceId;
                    const otherNode = nodes.find(n => n.id === otherId);
                    const pathExpanded = expandedPath === p.id;
                    return (
                      <div key={p.id} style={s.pathRow} onClick={() => setExpandedPath(pathExpanded ? null : p.id)}>
                        <GitMerge size={11} color="var(--text-muted)" />
                        <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)', fontWeight: 500 }}>{otherNode?.name ?? '?'}</span>
                        <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>dist. {p.distance}</span>
                        {p.characteristics.length > 0 && (
                          <div style={{ display: 'flex', gap: 3 }}>
                            {p.characteristics.map(c => (
                              <span key={c} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: PATH_CHAR_META[c].color, color: '#fff', fontWeight: 700 }}>
                                {PATH_CHAR_META[c].abbr}
                              </span>
                            ))}
                          </div>
                        )}
                        {pathExpanded ? <ChevronUp size={10} color="var(--text-muted)" /> : <ChevronDown size={10} color="var(--text-muted)" />}
                        {pathExpanded && (
                          <div style={s.pathDetail}>
                            {p.characteristics.length > 0
                              ? p.characteristics.map(c => (
                                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: PATH_CHAR_META[c].color, flexShrink: 0, display: 'inline-block' }} />
                                    <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{PATH_CHAR_META[c].label}</span>
                                  </div>
                                ))
                              : <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sem características especiais.</span>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s: Record<string, any> = {
  shell:        { flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column' },
  topRow:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid var(--border)' },
  list:         { flex: 1, overflowY: 'auto', padding: '8px 0' },
  nodeCard:     { borderBottom: '1px solid var(--border)' },
  nodeHeader:   { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', cursor: 'pointer', userSelect: 'none' as const },
  nodeName:     { flex: 1, fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  badge:        { fontSize: 10, padding: '2px 6px', borderRadius: '100px', background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border)', flexShrink: 0 },
  pathCount:    { fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 },
  editBtn:      { background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: 'var(--text-muted)', display: 'flex', borderRadius: 4, flexShrink: 0 },
  nodeExpanded: { padding: '8px 16px 12px 36px', background: 'var(--bg-base)', borderTop: '1px solid var(--border)' },
  desc:         { fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 0, marginBottom: 10 },
  pathRow:      { display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', borderRadius: 6, cursor: 'pointer', flexWrap: 'wrap' as const, marginBottom: 2 },
  pathDetail:   { width: '100%', marginTop: 6, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 },
};
