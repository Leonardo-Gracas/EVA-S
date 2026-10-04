import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useTitle } from '../hooks/useTitle';
import {
  Eye, Map, Plus, Trash2, MousePointer, GitMerge, Circle, Save,
  List, Edit2, Sparkles, FileCode,
} from 'lucide-react';
import { api } from '../services/api';
import { GameMap, MapNode, MapPath, PATH_CHAR_META } from '../types';
import PageHeader from '../components/common/PageHeader';
import Button from '../components/common/Button';
import { GridPattern } from '../components/map/GridPattern';
import { ArrowHandles } from '../components/map/ArrowHandles';
import { NodeCircle } from '../components/map/NodeCircle';
import { PathLine } from '../components/map/PathLine';
import { PropertiesPanel } from '../components/map/PropertiesPanel';
import { ListView } from '../components/map/ListView';
import { MapsListScreen } from '../components/map/MapsListScreen';
import { MapCodeModal, MapCodeImport } from '../components/map/MapCodeModal';
import { serializeMapDsl } from '../components/map/mapDsl';
import { Selection, uuidv4, nodeEditorRadius } from '../components/map/mapEditorUtils';

// ─── Local types / helpers ────────────────────────────────────────────────────

type ViewMode = 'maps-list' | 'view' | 'canvas' | 'display';

interface ViewBox { x: number; y: number; w: number; h: number }

interface DragState {
  kind: 'node' | 'pan' | 'arrow';
  nodeId?: string;
  startClientX: number; startClientY: number;
  startNodeX?: number; startNodeY?: number;
  startViewX?: number; startViewY?: number;
  arrowSvgX?: number; arrowSvgY?: number;
}

function clientToSvg(e: { clientX: number; clientY: number }, svgEl: SVGSVGElement, vb: ViewBox) {
  const rect = svgEl.getBoundingClientRect();
  return {
    x: vb.x + (e.clientX - rect.left) * (vb.w / rect.width),
    y: vb.y + (e.clientY - rect.top) * (vb.h / rect.height),
  };
}

function findNodeAt(x: number, y: number, nodes: MapNode[]): MapNode | undefined {
  return nodes.find(n => Math.hypot(n.x - x, n.y - y) <= nodeEditorRadius(n));
}

/** Viewbox que enquadra todos os nós com uma folga confortável. */
function fitViewBox(nodes: MapNode[]): ViewBox {
  if (nodes.length === 0) return { x: -300, y: -200, w: 1100, h: 750 };
  const pad = Math.max(...nodes.map(nodeEditorRadius)) + 120;
  const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
  const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad;
  const w = Math.max(Math.max(...xs) + pad - minX, 600);
  const h = Math.max(Math.max(...ys) + pad - minY, 420);
  // Mantém a proporção larga do canvas para o mapa não ficar esticado.
  const targetRatio = 1100 / 750;
  const ratio = w / h;
  const fw = ratio < targetRatio ? h * targetRatio : w;
  const fh = ratio < targetRatio ? h : w / targetRatio;
  return { x: minX - (fw - w) / 2, y: minY - (fh - h) / 2, w: fw, h: fh };
}

// ─── Display Canvas (read-only, view mode) ────────────────────────────────────

function DisplayCanvas({ nodes, paths }: { nodes: MapNode[]; paths: MapPath[] }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [hoveredPathId, setHoveredPathId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<{ x: number; y: number } | null>(null);

  const initialView = useMemo<ViewBox>(() => {
    if (nodes.length === 0) return { x: -300, y: -200, w: 1100, h: 750 };
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    return {
      x: Math.min(...xs) - 120, y: Math.min(...ys) - 120,
      w: Math.max(Math.max(...xs) - Math.min(...xs) + 240, 400),
      h: Math.max(Math.max(...ys) - Math.min(...ys) + 240, 300),
    };
  }, [nodes.length]);

  const [view, setView] = useState<ViewBox>(initialView);
  const dragRef = useRef<{ startCX: number; startCY: number; startVX: number; startVY: number } | null>(null);

  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    dragRef.current = { startCX: e.clientX, startCY: e.clientY, startVX: view.x, startVY: view.y };
  }
  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!drag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setView(v => ({ ...v, x: drag.startVX - (e.clientX - drag.startCX) * (v.w / rect.width), y: drag.startVY - (e.clientY - drag.startCY) * (v.h / rect.height) }));
  }
  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = view.x + (e.clientX - rect.left) * (view.w / rect.width);
    const my = view.y + (e.clientY - rect.top) * (view.h / rect.height);
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    setView(v => ({ x: mx - (mx - v.x) * factor, y: my - (my - v.y) * factor, w: v.w * factor, h: v.h * factor }));
  }

  const vbStr = `${view.x} ${view.y} ${view.w} ${view.h}`;
  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const hoveredPath  = paths.find(p => p.id === hoveredPathId);

  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', position: 'relative' }}>
      <svg ref={svgRef} style={{ flex: 1, background: 'var(--bg-base)', cursor: 'grab', display: 'block' }}
        viewBox={vbStr}
        onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
        onMouseUp={() => { dragRef.current = null; }}
        onMouseLeave={() => { dragRef.current = null; setHoveredPathId(null); setTooltip(null); }}
        onClick={() => setSelectedNodeId(null)} onWheel={handleWheel}>
        <GridPattern />
        <rect x={view.x - 9999} y={view.y - 9999} width={view.w + 19998} height={view.h + 19998} fill="url(#rpg-grid)" />
        {paths.map(path => {
          const a = nodes.find(n => n.id === path.sourceId);
          const b = nodes.find(n => n.id === path.targetId);
          if (!a || !b) return null;
          return (
            <g key={path.id}
              onMouseEnter={e => { setHoveredPathId(path.id); setTooltip({ x: e.clientX, y: e.clientY }); }}
              onMouseMove={e => setTooltip({ x: e.clientX, y: e.clientY })}
              onMouseLeave={() => { setHoveredPathId(null); setTooltip(null); }}>
              <PathLine path={path} nodeA={a} nodeB={b} selected={hoveredPathId === path.id} onClick={() => {}} />
            </g>
          );
        })}
        {nodes.map(node => (
          <NodeCircle key={node.id} node={node} selected={selectedNodeId === node.id}
            onMouseDown={() => {}}
            onClick={e => { e.stopPropagation(); setSelectedNodeId(node.id === selectedNodeId ? null : node.id); }} />
        ))}
      </svg>

      {/* Selected node detail panel */}
      {selectedNode && (
        <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 260, background: 'var(--bg-elevated)', borderLeft: '1px solid var(--border)', padding: 20, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button onClick={() => setSelectedNodeId(null)} style={{ alignSelf: 'flex-end', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, lineHeight: 1, padding: 0 }}>&#10005;</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Circle size={14} color="var(--accent)" />
            <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{selectedNode.name}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Ocupação: <strong style={{ color: 'var(--text-secondary)' }}>{selectedNode.occupancyLimit}</strong></div>
          {selectedNode.description
            ? <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>{selectedNode.description}</p>
            : <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>Sem descrição.</p>}
          {(() => {
            const conn = paths.filter(p => p.sourceId === selectedNode.id || p.targetId === selectedNode.id);
            if (conn.length === 0) return null;
            return (
              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Caminhos</div>
                {conn.map(p => {
                  const otherId = p.sourceId === selectedNode.id ? p.targetId : p.sourceId;
                  const other = nodes.find(n => n.id === otherId);
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                      <GitMerge size={11} color="var(--text-muted)" />
                      <span style={{ flex: 1, fontSize: 12, color: 'var(--text-primary)' }}>{other?.name ?? '?'}</span>
                      <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>{p.distance}m</span>
                      {p.characteristics.map(c => (
                        <span key={c} style={{ fontSize: 8, padding: '1px 4px', borderRadius: 3, background: PATH_CHAR_META[c].color, color: '#fff', fontWeight: 700 }}>{PATH_CHAR_META[c].abbr}</span>
                      ))}
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}

      {/* Path hover tooltip */}
      {hoveredPath && tooltip && (
        <div style={{ position: 'fixed', left: tooltip.x + 12, top: tooltip.y + 12, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 12px', pointerEvents: 'none', zIndex: 9999, minWidth: 120, boxShadow: '0 4px 16px rgba(0,0,0,0.3)' }}>
          {(() => {
            const a = nodes.find(n => n.id === hoveredPath.sourceId);
            const b = nodes.find(n => n.id === hoveredPath.targetId);
            return (
              <>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{a?.name ?? '?'} &#8596; {b?.name ?? '?'}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: hoveredPath.characteristics.length > 0 ? 8 : 0 }}>{hoveredPath.distance}m</div>
                {hoveredPath.characteristics.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {hoveredPath.characteristics.map(c => (
                      <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: PATH_CHAR_META[c].color, flexShrink: 0, display: 'inline-block' }} />
                        <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{PATH_CHAR_META[c].label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ─── Main Editor ──────────────────────────────────────────────────────────────

export default function MapEditor() {
  useTitle('Mapas');

  const [maps, setMaps] = useState<GameMap[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [paths, setPaths] = useState<MapPath[]>([]);
  const [mapName, setMapName] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('maps-list');
  const [selected, setSelected] = useState<Selection | null>(null);
  const [autoFocusName, setAutoFocusName] = useState(false);
  const [codeModal, setCodeModal] = useState<{ open: boolean; initial: string }>({ open: false, initial: '' });
  const clipboardRef = useRef<{ name: string; radius?: number } | null>(null);
  const [view, setView] = useState<ViewBox>({ x: -300, y: -200, w: 1100, h: 750 });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef<ViewBox>({ x: -300, y: -200, w: 1100, h: 750 });

  useEffect(() => { api.maps.list().then(setMaps); }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
        setSelected(sel => {
          if (!sel) return sel;
          if (sel.type === 'node') {
            setNodes(ns => ns.filter(n => n.id !== sel.id));
            setPaths(ps => ps.filter(p => p.sourceId !== sel.id && p.targetId !== sel.id));
          } else {
            setPaths(ps => ps.filter(p => p.id !== sel.id));
          }
          setIsDirty(true);
          return null;
        });
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && !inInput) {
        setSelected(sel => {
          if (sel?.type === 'node') {
            setNodes(ns => {
              const node = ns.find(n => n.id === sel.id);
              if (node) clipboardRef.current = { name: node.name, radius: node.radius };
              return ns;
            });
          }
          return sel;
        });
      }
      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && !inInput) {
        const clip = clipboardRef.current;
        if (!clip) return;
        const v = viewRef.current;
        const newNode: MapNode = {
          id: uuidv4(), name: clip.name, occupancyLimit: 4,
          x: v.x + v.w / 2 + 30, y: v.y + v.h / 2 + 30, radius: clip.radius,
        };
        setNodes(ns => [...ns, newNode]);
        setSelected({ type: 'node', id: newNode.id });
        setAutoFocusName(true);
        setIsDirty(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function loadMap(m: GameMap, mode: ViewMode = 'view') {
    setActiveId(m.id); setNodes(m.nodes); setPaths(m.paths);
    setMapName(m.name); setIsDirty(false); setSelected(null); setViewMode(mode);
  }
  function markDirty() { setIsDirty(true); }

  async function handleSave() {
    if (!activeId) return;
    setSaving(true);
    try {
      const updated = await api.maps.update(activeId, { name: mapName, nodes, paths });
      setMaps(ms => ms.map(m => m.id === activeId ? updated : m));
      setIsDirty(false);
    } finally { setSaving(false); }
  }

  async function handleNewMap() {
    const m = await api.maps.create({ name: 'Novo Mapa' });
    setMaps(ms => [...ms, m]);
    loadMap(m, 'canvas');
  }

  async function handleDeleteMap(id?: string) {
    const targetId = id ?? activeId;
    if (!targetId || !confirm('Excluir este mapa?')) return;
    try {
      await api.maps.delete(targetId);
      setMaps(ms => ms.filter(m => m.id !== targetId));
      if (activeId === targetId) { setActiveId(null); setNodes([]); setPaths([]); setMapName(''); setIsDirty(false); }
      setViewMode('maps-list');
    } catch { alert('Erro ao excluir o mapa. Tente novamente.'); }
  }

  /** Aplica um mapa vindo de código MAPDSL: cria um novo ou reescreve o aberto. */
  async function handleCodeImport(data: MapCodeImport, mode: 'new' | 'replace') {
    if (mode === 'replace') {
      if (!activeId) return;
      setNodes(data.nodes); setPaths(data.paths); setMapName(data.name);
      setSelected(null); setView(fitViewBox(data.nodes)); setViewMode('canvas'); markDirty();
      return;
    }
    const created = await api.maps.create({ name: data.name });
    const saved = await api.maps.update(created.id, { name: data.name, nodes: data.nodes, paths: data.paths });
    setMaps(ms => [...ms, saved]);
    loadMap(saved, 'canvas');
    setView(fitViewBox(saved.nodes));
  }

  function openCodeModal(withCurrentMap: boolean) {
    setCodeModal({
      open: true,
      initial: withCurrentMap && activeId ? serializeMapDsl({ name: mapName, nodes, paths }) : '',
    });
  }

  function toSvg(e: { clientX: number; clientY: number }) {
    if (!svgRef.current) return { x: 0, y: 0 };
    return clientToSvg(e, svgRef.current, view);
  }

  function handleAddNode() {
    const n: MapNode = { id: uuidv4(), name: `Nó ${nodes.length + 1}`, occupancyLimit: 4, x: view.x + view.w / 2, y: view.y + view.h / 2 };
    setNodes(ns => [...ns, n]);
    setSelected({ type: 'node', id: n.id });
    setAutoFocusName(true);
    markDirty();
  }

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if ((e.target as Element) === svgRef.current || (e.target as Element).tagName === 'rect') {
      dragRef.current = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startViewX: view.x, startViewY: view.y };
    }
  }

  function handleNodeMouseDown(e: React.MouseEvent, node: MapNode) {
    e.stopPropagation();
    dragRef.current = { kind: 'node', nodeId: node.id, startClientX: e.clientX, startClientY: e.clientY, startNodeX: node.x, startNodeY: node.y };
  }

  function handleArrowMouseDown(e: React.MouseEvent, node: MapNode) {
    e.stopPropagation();
    const svgPos = toSvg(e);
    dragRef.current = { kind: 'arrow', nodeId: node.id, startClientX: e.clientX, startClientY: e.clientY, arrowSvgX: svgPos.x, arrowSvgY: svgPos.y };
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (drag.kind === 'pan') {
      const dx = (e.clientX - drag.startClientX) * (view.w / rect.width);
      const dy = (e.clientY - drag.startClientY) * (view.h / rect.height);
      setView(v => ({ ...v, x: (drag.startViewX ?? v.x) - dx, y: (drag.startViewY ?? v.y) - dy }));
    } else if (drag.kind === 'node' && drag.nodeId) {
      const dx = (e.clientX - drag.startClientX) * (view.w / rect.width);
      const dy = (e.clientY - drag.startClientY) * (view.h / rect.height);
      setNodes(ns => ns.map(n => n.id === drag.nodeId ? { ...n, x: (drag.startNodeX ?? n.x) + dx, y: (drag.startNodeY ?? n.y) + dy } : n));
      markDirty();
    } else if (drag.kind === 'arrow') {
      const svgPos = clientToSvg(e, svgRef.current, view);
      drag.arrowSvgX = svgPos.x;
      drag.arrowSvgY = svgPos.y;
      setNodes(ns => [...ns]);
    }
  }, [view]);

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === 'arrow' && drag.nodeId) {
      const svgPos = toSvg(e);
      const target = findNodeAt(svgPos.x, svgPos.y, nodes);
      if (target && target.id !== drag.nodeId) {
        const newPath: MapPath = { id: uuidv4(), sourceId: drag.nodeId, targetId: target.id, distance: 1, characteristics: [] };
        setPaths(ps => [...ps, newPath]);
        setSelected({ type: 'path', id: newPath.id });
        markDirty();
      }
    }
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const { x: mx, y: my } = toSvg(e);
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    setView(v => ({ x: mx - (mx - v.x) * factor, y: my - (my - v.y) * factor, w: v.w * factor, h: v.h * factor }));
  }

  function updateNode(id: string, patch: Partial<MapNode>) {
    setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n));
    markDirty();
  }
  function updatePath(id: string, patch: Partial<MapPath>) {
    setPaths(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
    markDirty();
  }
  function deleteSelected(sel: Selection) {
    if (sel.type === 'node') { setNodes(ns => ns.filter(n => n.id !== sel.id)); setPaths(ps => ps.filter(p => p.sourceId !== sel.id && p.targetId !== sel.id)); }
    else { setPaths(ps => ps.filter(p => p.id !== sel.id)); }
    setSelected(null); markDirty();
  }

  const arrowDrag = dragRef.current?.kind === 'arrow' ? dragRef.current : null;
  const arrowSrcNode = arrowDrag?.nodeId ? nodes.find(n => n.id === arrowDrag.nodeId) : null;
  const selectedNode = selected?.type === 'node' ? nodes.find(n => n.id === selected.id) : null;
  viewRef.current = view;
  const viewBoxStr = `${view.x} ${view.y} ${view.w} ${view.h}`;

  return (
    <div style={pg.shell}>
      <div style={pg.topbar}>
        <PageHeader title="Mapas" subtitle={viewMode !== 'maps-list' && mapName ? mapName : undefined} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto' }}>
          {activeId && (viewMode === 'canvas' || viewMode === 'view') && (
            <input style={pg.nameInput} value={mapName} onChange={e => { setMapName(e.target.value); markDirty(); }} />
          )}
          <Button variant="ghost" size="sm" icon={<Sparkles size={13} />} onClick={() => openCodeModal(false)}>
            Gerar por código
          </Button>
          <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={handleNewMap}>Novo</Button>
          {activeId && viewMode !== 'maps-list' && (
            <>
              <Button variant="primary" size="sm" icon={<Save size={13} />} loading={saving} onClick={handleSave} disabled={!isDirty}>
                {isDirty ? 'Salvar*' : 'Salvo'}
              </Button>
              <button style={pg.deleteMapBtn} onClick={() => handleDeleteMap()} title="Excluir mapa"><Trash2 size={13} /></button>
            </>
          )}
        </div>
      </div>

      <div style={pg.toolbar}>
        {viewMode !== 'maps-list' && <button style={pg.toolBtn} onClick={() => setViewMode('maps-list')}>&#8592; Mapas</button>}
        {(viewMode === 'canvas' || viewMode === 'view' || viewMode === 'display') && activeId && (
          <>
            <button style={{ ...pg.toolBtn, ...(viewMode === 'display' ? pg.toolBtnActive : {}) }} onClick={() => setViewMode('display')}><Eye size={14} /> Exibição</button>
            <button style={{ ...pg.toolBtn, ...(viewMode === 'view'    ? pg.toolBtnActive : {}) }} onClick={() => setViewMode('view')}><List size={14} /> Listagem</button>
            <button style={{ ...pg.toolBtn, ...(viewMode === 'canvas'  ? pg.toolBtnActive : {}) }} onClick={() => setViewMode('canvas')}><MousePointer size={14} /> Canvas</button>
          </>
        )}
        {viewMode === 'canvas' && activeId && (
          <>
            <div style={pg.divider} />
            <button style={pg.toolBtn} onClick={handleAddNode}><Plus size={14} /> Adicionar nó</button>
            <button style={pg.toolBtn} onClick={() => openCodeModal(true)} title="Ver/editar este mapa como código MAPDSL">
              <FileCode size={14} /> Código
            </button>
            <button style={pg.toolBtn} onClick={() => setView(fitViewBox(nodes))} title="Enquadrar todos os nós">
              <Map size={14} /> Enquadrar
            </button>
            {selected && (
              <button style={{ ...pg.toolBtn, color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => deleteSelected(selected)}>
                <Trash2 size={14} /> Remover
              </button>
            )}
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Scroll=zoom · Arrastar fundo=mover · Seta=caminho · Del=remover · Ctrl+C/V=copiar</span>
          </>
        )}
      </div>

      {viewMode === 'maps-list' ? (
        <MapsListScreen maps={maps} onOpen={m => loadMap(m, 'view')} onEdit={m => loadMap(m, 'canvas')} onDelete={m => handleDeleteMap(m.id)} onNew={handleNewMap} />
      ) : viewMode === 'view' ? (
        <ListView nodes={nodes} paths={paths} onEnterEdit={() => setViewMode('canvas')} onEnterEditNode={nodeId => { setViewMode('canvas'); setSelected({ type: 'node', id: nodeId }); }} />
      ) : viewMode === 'display' ? (
        <DisplayCanvas nodes={nodes} paths={paths} />
      ) : (
        <div style={pg.body}>
          <svg ref={svgRef} style={pg.canvas} viewBox={viewBoxStr}
            onMouseDown={handleSvgMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={() => { dragRef.current = null; }}
            onClick={e => { if ((e.target as Element) === svgRef.current || (e.target as Element).tagName === 'rect') setSelected(null); }}
            onWheel={handleWheel}>
            <GridPattern />
            <rect x={view.x - 9999} y={view.y - 9999} width={view.w + 19998} height={view.h + 19998} fill="url(#rpg-grid)" style={{ color: 'var(--text-primary)', cursor: 'default' }} />
            {paths.map(path => {
              const a = nodes.find(n => n.id === path.sourceId);
              const b = nodes.find(n => n.id === path.targetId);
              if (!a || !b) return null;
              return <PathLine key={path.id} path={path} nodeA={a} nodeB={b} selected={selected?.type === 'path' && selected.id === path.id} onClick={e => { e.stopPropagation(); setSelected({ type: 'path', id: path.id }); }} />;
            })}
            {arrowSrcNode && arrowDrag?.arrowSvgX !== undefined && (() => {
              const tx = arrowDrag.arrowSvgX!, ty = arrowDrag.arrowSvgY!;
              const dx = tx - arrowSrcNode.x, dy = ty - arrowSrcNode.y;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const r = nodeEditorRadius(arrowSrcNode);
              return <line x1={arrowSrcNode.x + dx / len * r} y1={arrowSrcNode.y + dy / len * r} x2={tx} y2={ty} stroke="var(--accent)" strokeWidth={2} strokeDasharray="8 4" style={{ pointerEvents: 'none' }} />;
            })()}
            {nodes.map(node => (
              <NodeCircle key={node.id} node={node} selected={selected?.type === 'node' && selected.id === node.id}
                onMouseDown={e => handleNodeMouseDown(e, node)}
                onClick={e => { e.stopPropagation(); setSelected({ type: 'node', id: node.id }); setAutoFocusName(false); }} />
            ))}
            {selectedNode && <ArrowHandles node={selectedNode} onArrowMouseDown={(e, _dir) => handleArrowMouseDown(e, selectedNode)} />}
          </svg>
          <div style={pg.props}>
            <div style={pg.propsTitle}>Propriedades</div>
            <PropertiesPanel selected={selected} nodes={nodes} paths={paths} onUpdateNode={updateNode} onUpdatePath={updatePath} onDelete={deleteSelected} autoFocusName={autoFocusName} onFocusDone={() => setAutoFocusName(false)} />
          </div>
        </div>
      )}

      <MapCodeModal
        open={codeModal.open}
        initialCode={codeModal.initial}
        currentMapName={activeId && viewMode !== 'maps-list' ? mapName : null}
        onClose={() => setCodeModal({ open: false, initial: '' })}
        onImport={handleCodeImport}
      />
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const pg: Record<string, any> = {
  shell:        { display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' },
  topbar:       { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', borderBottom: '1px solid var(--border)', flexShrink: 0, flexWrap: 'wrap' },
  nameInput:    { padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, width: 160 },
  toolbar:      { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', flexShrink: 0, flexWrap: 'wrap' },
  toolBtn:      { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '5px 11px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12, transition: 'all 0.15s', whiteSpace: 'nowrap' },
  toolBtnActive:{ background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)', fontWeight: 600 },
  divider:      { width: 1, height: 22, background: 'var(--border)', margin: '0 4px' },
  body:         { display: 'flex', flex: 1, overflow: 'hidden' },
  canvas:       { flex: 1, background: 'var(--bg-elevated)', display: 'block', cursor: 'default' },
  props:        { width: 240, borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 },
  propsTitle:   { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 },
  deleteMapBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--error)', padding: '5px 8px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
};

// ─── MapEditorEmbed (for combat overlay) ─────────────────────────────────────

export interface MapEditorEmbedProps {
  map: GameMap;
  onSaved: (updatedMap: GameMap) => void;
  onClose: () => void;
}

export function MapEditorEmbed({ map, onSaved, onClose }: MapEditorEmbedProps) {
  const [nodes, setNodes] = useState<MapNode[]>(map.nodes);
  const [paths, setPaths] = useState<MapPath[]>(map.paths);
  const [mapName, setMapName] = useState(map.name);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [autoFocusName, setAutoFocusName] = useState(false);
  const clipboardRef = useRef<{ name: string; radius?: number } | null>(null);
  const [view, setView] = useState<ViewBox>(() => {
    if (map.nodes.length === 0) return { x: -300, y: -200, w: 1100, h: 750 };
    const xs = map.nodes.map(n => n.x), ys = map.nodes.map(n => n.y);
    return { x: Math.min(...xs) - 120, y: Math.min(...ys) - 120, w: Math.max(Math.max(...xs) - Math.min(...xs) + 240, 600), h: Math.max(Math.max(...ys) - Math.min(...ys) + 240, 400) };
  });
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const viewRef = useRef<ViewBox>(view);
  viewRef.current = view;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const inInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA';
      if ((e.key === 'Delete' || e.key === 'Backspace') && !inInput) {
        setSelected(sel => {
          if (!sel) return sel;
          if (sel.type === 'node') { setNodes(ns => ns.filter(n => n.id !== sel.id)); setPaths(ps => ps.filter(p => p.sourceId !== sel.id && p.targetId !== sel.id)); }
          else { setPaths(ps => ps.filter(p => p.id !== sel.id)); }
          setIsDirty(true);
          return null;
        });
      }
      if (e.key === 'c' && (e.ctrlKey || e.metaKey) && !inInput) {
        setSelected(sel => {
          if (sel?.type === 'node') setNodes(ns => { const node = ns.find(n => n.id === sel.id); if (node) clipboardRef.current = { name: node.name, radius: node.radius }; return ns; });
          return sel;
        });
      }
      if (e.key === 'v' && (e.ctrlKey || e.metaKey) && !inInput) {
        const clip = clipboardRef.current;
        if (!clip) return;
        const v = viewRef.current;
        const newNode: MapNode = { id: uuidv4(), name: clip.name, occupancyLimit: 4, x: v.x + v.w / 2 + 30, y: v.y + v.h / 2 + 30, radius: clip.radius };
        setNodes(ns => [...ns, newNode]);
        setSelected({ type: 'node', id: newNode.id });
        setAutoFocusName(true);
        setIsDirty(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  function toSvgE(e: { clientX: number; clientY: number }) {
    if (!svgRef.current) return { x: 0, y: 0 };
    return clientToSvg(e, svgRef.current, view);
  }

  function handleAddNode() {
    const n: MapNode = { id: uuidv4(), name: `Nó ${nodes.length + 1}`, occupancyLimit: 4, x: view.x + view.w / 2, y: view.y + view.h / 2 };
    setNodes(ns => [...ns, n]); setSelected({ type: 'node', id: n.id }); setAutoFocusName(true); setIsDirty(true);
  }

  function handleSvgMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    if ((e.target as Element) === svgRef.current || (e.target as Element).tagName === 'rect') {
      dragRef.current = { kind: 'pan', startClientX: e.clientX, startClientY: e.clientY, startViewX: view.x, startViewY: view.y };
    }
  }
  function handleNodeMouseDown(e: React.MouseEvent, node: MapNode) {
    e.stopPropagation();
    dragRef.current = { kind: 'node', nodeId: node.id, startClientX: e.clientX, startClientY: e.clientY, startNodeX: node.x, startNodeY: node.y };
  }
  function handleArrowMouseDown(e: React.MouseEvent, node: MapNode) {
    e.stopPropagation();
    const svgPos = toSvgE(e);
    dragRef.current = { kind: 'arrow', nodeId: node.id, startClientX: e.clientX, startClientY: e.clientY, arrowSvgX: svgPos.x, arrowSvgY: svgPos.y };
  }

  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    const drag = dragRef.current;
    if (!drag || !svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    if (drag.kind === 'pan') {
      const dx = (e.clientX - drag.startClientX) * (view.w / rect.width);
      const dy = (e.clientY - drag.startClientY) * (view.h / rect.height);
      setView(v => ({ ...v, x: (drag.startViewX ?? v.x) - dx, y: (drag.startViewY ?? v.y) - dy }));
    } else if (drag.kind === 'node' && drag.nodeId) {
      const dx = (e.clientX - drag.startClientX) * (view.w / rect.width);
      const dy = (e.clientY - drag.startClientY) * (view.h / rect.height);
      setNodes(ns => ns.map(n => n.id === drag.nodeId ? { ...n, x: (drag.startNodeX ?? n.x) + dx, y: (drag.startNodeY ?? n.y) + dy } : n));
      setIsDirty(true);
    } else if (drag.kind === 'arrow') {
      const svgPos = clientToSvg(e, svgRef.current, view);
      drag.arrowSvgX = svgPos.x; drag.arrowSvgY = svgPos.y;
      setNodes(ns => [...ns]);
    }
  }, [view]);

  function handleMouseUp(e: React.MouseEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (drag?.kind === 'arrow' && drag.nodeId) {
      const svgPos = toSvgE(e);
      const target = findNodeAt(svgPos.x, svgPos.y, nodes);
      if (target && target.id !== drag.nodeId) {
        const newPath: MapPath = { id: uuidv4(), sourceId: drag.nodeId, targetId: target.id, distance: 1, characteristics: [] };
        setPaths(ps => [...ps, newPath]); setSelected({ type: 'path', id: newPath.id }); setIsDirty(true);
      }
    }
  }

  function handleWheel(e: React.WheelEvent<SVGSVGElement>) {
    e.preventDefault();
    const { x: mx, y: my } = toSvgE(e);
    const factor = e.deltaY > 0 ? 1.12 : 0.89;
    setView(v => ({ x: mx - (mx - v.x) * factor, y: my - (my - v.y) * factor, w: v.w * factor, h: v.h * factor }));
  }

  function updateNode(id: string, patch: Partial<MapNode>) { setNodes(ns => ns.map(n => n.id === id ? { ...n, ...patch } : n)); setIsDirty(true); }
  function updatePath(id: string, patch: Partial<MapPath>) { setPaths(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p)); setIsDirty(true); }
  function deleteSelected(sel: Selection) {
    if (sel.type === 'node') { setNodes(ns => ns.filter(n => n.id !== sel.id)); setPaths(ps => ps.filter(p => p.sourceId !== sel.id && p.targetId !== sel.id)); }
    else { setPaths(ps => ps.filter(p => p.id !== sel.id)); }
    setSelected(null); setIsDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    try { const updated = await api.maps.update(map.id, { name: mapName, nodes, paths }); setIsDirty(false); onSaved(updated); }
    finally { setSaving(false); }
  }

  const arrowDrag = dragRef.current?.kind === 'arrow' ? dragRef.current : null;
  const arrowSrcNode = arrowDrag?.nodeId ? nodes.find(n => n.id === arrowDrag.nodeId) : null;
  const selectedNode = selected?.type === 'node' ? nodes.find(n => n.id === selected.id) : null;
  const viewBoxStr = `${view.x} ${view.y} ${view.w} ${view.h}`;

  const toolBtn: React.CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 12 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)', flexShrink: 0, flexWrap: 'wrap' }}>
        <input style={{ padding: '4px 10px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, width: 160 }}
          value={mapName} onChange={e => { setMapName(e.target.value); setIsDirty(true); }} />
        <button style={toolBtn} onClick={handleAddNode}><Plus size={14} /> Adicionar nó</button>
        {selected && (
          <button style={{ ...toolBtn, color: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => deleteSelected(selected)}><Trash2 size={14} /> Remover</button>
        )}
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>Scroll=zoom · Seta=caminho · Del=remover</span>
        <Button variant="primary" size="sm" icon={<Save size={13} />} loading={saving} onClick={handleSave} disabled={!isDirty}>
          {isDirty ? 'Salvar*' : 'Salvo'}
        </Button>
        <button onClick={onClose} style={{ ...toolBtn, marginLeft: 4 }}>Fechar &#10005;</button>
      </div>
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <svg ref={svgRef} style={{ flex: 1, background: 'var(--bg-elevated)', display: 'block', cursor: 'default' }}
          viewBox={viewBoxStr}
          onMouseDown={handleSvgMouseDown} onMouseMove={handleMouseMove} onMouseUp={handleMouseUp}
          onMouseLeave={() => { dragRef.current = null; }}
          onClick={e => { if ((e.target as Element) === svgRef.current || (e.target as Element).tagName === 'rect') setSelected(null); }}
          onWheel={handleWheel}>
          <GridPattern />
          <rect x={view.x - 9999} y={view.y - 9999} width={view.w + 19998} height={view.h + 19998} fill="url(#rpg-grid)" style={{ color: 'var(--text-primary)', cursor: 'default' }} />
          {paths.map(path => {
            const a = nodes.find(n => n.id === path.sourceId);
            const b = nodes.find(n => n.id === path.targetId);
            if (!a || !b) return null;
            return <PathLine key={path.id} path={path} nodeA={a} nodeB={b} selected={selected?.type === 'path' && selected.id === path.id}
              onClick={e => { e.stopPropagation(); setSelected({ type: 'path', id: path.id }); setAutoFocusName(false); }} />;
          })}
          {arrowSrcNode && arrowDrag?.arrowSvgX !== undefined && (() => {
            const tx = arrowDrag.arrowSvgX!, ty = arrowDrag.arrowSvgY!;
            const dx = tx - arrowSrcNode.x, dy = ty - arrowSrcNode.y;
            const len = Math.sqrt(dx * dx + dy * dy) || 1;
            const r = nodeEditorRadius(arrowSrcNode);
            return <line x1={arrowSrcNode.x + dx / len * r} y1={arrowSrcNode.y + dy / len * r} x2={tx} y2={ty} stroke="var(--accent)" strokeWidth={2} strokeDasharray="8 4" style={{ pointerEvents: 'none' }} />;
          })()}
          {nodes.map(node => (
            <NodeCircle key={node.id} node={node} selected={selected?.type === 'node' && selected.id === node.id}
              onMouseDown={e => handleNodeMouseDown(e, node)}
              onClick={e => { e.stopPropagation(); setSelected({ type: 'node', id: node.id }); setAutoFocusName(false); }} />
          ))}
          {selectedNode && <ArrowHandles node={selectedNode} onArrowMouseDown={(e, _dir) => handleArrowMouseDown(e, selectedNode)} />}
        </svg>
        <div style={{ width: 240, borderLeft: '1px solid var(--border)', background: 'var(--bg-surface)', display: 'flex', flexDirection: 'column', overflow: 'hidden', flexShrink: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>Propriedades</div>
          <PropertiesPanel selected={selected} nodes={nodes} paths={paths} onUpdateNode={updateNode} onUpdatePath={updatePath} onDelete={deleteSelected} autoFocusName={autoFocusName} onFocusDone={() => setAutoFocusName(false)} />
        </div>
      </div>
    </div>
  );
}
