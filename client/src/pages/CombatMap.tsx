import React, { useState, useRef, useMemo, useEffect } from 'react';
import { CombatSession, CombatParticipant, Character, GameMap, MapNode, MapPath } from '../types';
import { useSvgViewport, ViewBox } from '../hooks/useSvgViewport';
import { CombatNode, nodeRadius } from '../components/map/CombatNode';
import { CombatPath } from '../components/map/CombatPath';
import { participantColor } from '../components/map/AvatarBubble';

// ─── helpers ─────────────────────────────────────────────────────────────────

function dist(x1: number, y1: number, x2: number, y2: number) {
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function nodePaths(nodeId: string, paths: MapPath[]) {
  return paths.filter(p => p.sourceId === nodeId || p.targetId === nodeId);
}

function pathCost(path: MapPath, sourceId: string, nodes: MapNode[], participants: CombatParticipant[]): number {
  const src = nodes.find(n => n.id === sourceId);
  if (!src) return path.distance;
  const occ = participants.filter(p => p.currentNodeId === sourceId).length;
  return occ > src.occupancyLimit ? path.distance * 2 : path.distance;
}

function canAttemptMove(
  participant: CombatParticipant, pathId: string,
  nodes: MapNode[], paths: MapPath[], allParticipants: CombatParticipant[]
): boolean {
  const path = paths.find(p => p.id === pathId);
  if (!path) return false;
  const sourceId = participant.currentNodeId === path.sourceId ? path.sourceId : path.targetId;
  const cost = pathCost(path, sourceId, nodes, allParticipants);
  const prog = participant.displacementProgress?.pathId === pathId ? participant.displacementProgress : null;
  const fraction = prog
    ? (prog.fraction !== undefined ? prog.fraction : (prog as any).accumulated / cost)
    : 0;
  return participant.remainingDisplacement > 0 && cost * (1 - fraction) > 0.001;
}

// ─── Props ────────────────────────────────────────────────────────────────────

export interface CombatMapProps {
  combat: CombatSession;
  gameMap: GameMap;
  characters: Character[];
  isGM: boolean;
  myParticipantUid?: string;
  onAssignNode: (participantUid: string, nodeId: string | null) => void;
  onMove: (participantUid: string, pathId: string) => Promise<void>;
  onSetDisplacementMode?: (mode: 'rule' | 'open') => Promise<void>;
  onSetRemainingDisplacement?: (participantUid: string, value: number) => Promise<void>;
  onUndoMove?: (participantUid: string) => Promise<void>;
  mapVisibility?: 1 | 2 | 3 | 4;
  labelFontSize?: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CombatMap({
  combat, gameMap, characters, isGM, myParticipantUid,
  onAssignNode, onMove,
  onSetDisplacementMode, onSetRemainingDisplacement, onUndoMove,
  mapVisibility, labelFontSize: labelFontSizeProp,
}: CombatMapProps) {
  const { nodes, paths } = gameMap;

  const [selectedUid, setSelectedUid] = useState<string | null>(null);
  const [moving, setMoving] = useState(false);
  const [editingDisp, setEditingDisp] = useState(false);
  const [editDispValue, setEditDispValue] = useState('');

  useEffect(() => {
    if (selectedUid && !combat.participants.find(p => p.uid === selectedUid)) {
      setSelectedUid(null);
      setEditingDisp(false);
    }
  }, [combat.participants, selectedUid]);

  // Closing the displacement editor when the selected actor changes prevents
  // submitting a value typed for a previous participant onto the new one.
  useEffect(() => {
    setEditingDisp(false);
  }, [selectedUid]);

  // ── Viewport ──────────────────────────────────────────────────────────────
  const initialView = useMemo<ViewBox>(() => {
    if (nodes.length === 0) return { x: -300, y: -200, w: 1100, h: 750 };
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const pad = 140;
    return {
      x: Math.min(...xs) - pad, y: Math.min(...ys) - pad,
      w: Math.max(Math.max(...xs) - Math.min(...xs) + pad * 2, 500),
      h: Math.max(Math.max(...ys) - Math.min(...ys) + pad * 2, 350),
    };
  }, [nodes.length]);

  const vp = useSvgViewport(initialView, { enableTouch: true });

  // Panning: start on background/rect click
  function handleMouseDown(e: React.MouseEvent<SVGSVGElement>) {
    const tgt = e.target as Element;
    if (tgt === vp.svgRef.current || tgt.tagName === 'rect') {
      vp.startPan(e);
      setSelectedUid(null);
    }
  }

  // ── Derived state ──────────────────────────────────────────────────────────
  const currentParticipant = combat.participants[combat.currentIndex] as CombatParticipant | undefined;
  const myParticipant = myParticipantUid
    ? combat.participants.find(p => p.uid === myParticipantUid)
    : undefined;
  const isMyTurn = !!myParticipant && myParticipant.uid === currentParticipant?.uid;

  const actor = isGM
    ? (selectedUid ? combat.participants.find(p => p.uid === selectedUid) : undefined)
    : (isMyTurn ? myParticipant : undefined);

  const reachableNodeIds = useMemo<Set<string>>(() => {
    if (!actor || actor.currentNodeId === null) return new Set();
    const reachable = new Set<string>();
    for (const path of nodePaths(actor.currentNodeId, paths)) {
      if (canAttemptMove(actor, path.id, nodes, paths, combat.participants)) {
        reachable.add(path.sourceId === actor.currentNodeId ? path.targetId : path.sourceId);
      }
    }
    if (actor.displacementProgress) {
      const pp = paths.find(p => p.id === actor.displacementProgress!.pathId);
      if (pp) reachable.add(actor.displacementProgress.direction === 'forward' ? pp.targetId : pp.sourceId);
    }
    return reachable;
  }, [actor, nodes, paths, combat.participants]);

  const reachablePathIds = useMemo<Set<string>>(() => {
    if (!actor || actor.currentNodeId === null) return new Set();
    const reachable = new Set<string>();
    for (const path of nodePaths(actor.currentNodeId, paths)) {
      if (canAttemptMove(actor, path.id, nodes, paths, combat.participants)) reachable.add(path.id);
    }
    if (actor.displacementProgress) reachable.add(actor.displacementProgress.pathId);
    return reachable;
  }, [actor, nodes, paths, combat.participants]);

  const highlightedPathIds = useMemo<Set<string>>(() => {
    if (isGM && selectedUid && actor && actor.currentNodeId !== null) {
      if (combat.displacementMode === 'open') return new Set(paths.map(p => p.id));
      return new Set(nodePaths(actor.currentNodeId, paths).map(p => p.id));
    }
    return reachablePathIds;
  }, [isGM, selectedUid, actor, combat.displacementMode, paths, reachablePathIds]);

  const highlightedNodeIds = useMemo<Set<string>>(() => {
    if (isGM && selectedUid && actor && actor.currentNodeId !== null) {
      if (combat.displacementMode === 'open') return new Set(nodes.map(n => n.id).filter(id => id !== actor.currentNodeId));
      const adjacent = new Set<string>();
      for (const path of nodePaths(actor.currentNodeId, paths)) {
        adjacent.add(path.sourceId === actor.currentNodeId ? path.targetId : path.sourceId);
      }
      return adjacent;
    }
    return reachableNodeIds;
  }, [isGM, selectedUid, actor, combat.displacementMode, nodes, paths, reachableNodeIds]);

  const exceedantNodeIds = useMemo<Set<string>>(() => {
    const s = new Set<string>();
    for (const node of nodes) {
      if (combat.participants.filter(p => p.currentNodeId === node.id).length > node.occupancyLimit) s.add(node.id);
    }
    return s;
  }, [nodes, combat.participants]);

  // ── Visibility ────────────────────────────────────────────────────────────
  const { visibleNodeIds, anonymousNodeIds } = useMemo<{ visibleNodeIds: Set<string>; anonymousNodeIds: Set<string> }>(() => {
    const level = combat.mapVisibility ?? 4;
    if (isGM || level >= 4) return { visibleNodeIds: new Set(nodes.map(n => n.id)), anonymousNodeIds: new Set<string>() };

    const visibleFull = new Set<string>();
    const anonymous   = new Set<string>();
    const observers = level >= 3
      ? combat.participants.filter(p => { const c = characters.find(ch => ch.id === p.characterId); return c?.type === 'pc'; })
      : (myParticipant ? [myParticipant] : []);

    for (const obs of observers) {
      if (!obs.currentNodeId) continue;
      visibleFull.add(obs.currentNodeId);
      for (const path of nodePaths(obs.currentNodeId, paths)) {
        const otherId = path.sourceId === obs.currentNodeId ? path.targetId : path.sourceId;
        if (level === 1) anonymous.add(otherId); else visibleFull.add(otherId);
      }
    }
    for (const id of visibleFull) anonymous.delete(id);
    return { visibleNodeIds: visibleFull, anonymousNodeIds: anonymous };
  }, [isGM, combat.mapVisibility, combat.participants, nodes, paths, characters, myParticipant]);

  const visiblePathIds = useMemo<Set<string>>(() => {
    const level = combat.mapVisibility ?? 4;
    if (isGM || level >= 4) return new Set(paths.map(p => p.id));
    if (level === 1) {
      return new Set(paths.filter(p =>
        (visibleNodeIds.has(p.sourceId) && anonymousNodeIds.has(p.targetId)) ||
        (visibleNodeIds.has(p.targetId) && anonymousNodeIds.has(p.sourceId))
      ).map(p => p.id));
    }
    return new Set(paths.filter(p => visibleNodeIds.has(p.sourceId) && visibleNodeIds.has(p.targetId)).map(p => p.id));
  }, [isGM, combat.mapVisibility, visibleNodeIds, anonymousNodeIds, paths]);

  // ── Interaction ───────────────────────────────────────────────────────────
  function handleParticipantClick(e: React.MouseEvent, p: CombatParticipant) {
    e.stopPropagation();
    if (!isGM) return;
    if (!selectedUid) { setSelectedUid(p.uid); return; }
    if (selectedUid === p.uid) { setSelectedUid(null); return; }
    if (p.currentNodeId) {
      const targetNode = nodes.find(n => n.id === p.currentNodeId);
      if (targetNode) handleNodeClickForGM(targetNode);
    }
  }

  async function handleNodeClickForGM(node: MapNode) {
    if (!selectedUid) return;
    const selActor = combat.participants.find(p => p.uid === selectedUid);
    if (combat.displacementMode === 'open') { onAssignNode(selectedUid, node.id); return; }
    if (!selActor || selActor.currentNodeId === null) { onAssignNode(selectedUid, node.id); return; }
    let pathToUse: MapPath | undefined;
    if (selActor.displacementProgress?.pathId) {
      const pp = paths.find(p => p.id === selActor.displacementProgress!.pathId);
      if (pp) {
        const target = selActor.displacementProgress.direction === 'forward' ? pp.targetId : pp.sourceId;
        if (target === node.id) pathToUse = pp;
      }
    }
    if (!pathToUse) {
      pathToUse = paths.find(pp =>
        (pp.sourceId === selActor.currentNodeId && pp.targetId === node.id) ||
        (pp.targetId === selActor.currentNodeId && pp.sourceId === node.id)
      );
    }
    if (!pathToUse) return;
    setMoving(true);
    onMove(selectedUid, pathToUse.id).finally(() => setMoving(false));
  }

  async function handleNodeClick(e: React.MouseEvent, node: MapNode) {
    e.stopPropagation();
    if (isGM && selectedUid) { await handleNodeClickForGM(node); return; }
    if (!actor || actor.currentNodeId === null) return;
    if (!reachableNodeIds.has(node.id)) return;
    let pathToUse: MapPath | undefined;
    if (actor.displacementProgress) {
      const pp = paths.find(p => p.id === actor.displacementProgress!.pathId);
      if (pp) {
        const target = actor.displacementProgress.direction === 'forward' ? pp.targetId : pp.sourceId;
        if (target === node.id) pathToUse = pp;
      }
    }
    if (!pathToUse) {
      pathToUse = paths.find(pp =>
        (pp.sourceId === actor.currentNodeId && pp.targetId === node.id) ||
        (pp.targetId === actor.currentNodeId && pp.sourceId === node.id)
      );
    }
    if (!pathToUse) return;
    setMoving(true);
    try { await onMove(actor.uid, pathToUse.id); } finally { setMoving(false); }
  }

  const canInteract = isGM || (isMyTurn && !myParticipant?.movementBlocked);

  const participantIndexMap = useMemo(() => {
    const m = new Map<string, number>();
    combat.participants.forEach((p, i) => m.set(p.uid, i));
    return m;
  }, [combat.participants]);

  const participantsByNode = useMemo(() => {
    const m = new Map<string, CombatParticipant[]>();
    for (const p of combat.participants) {
      if (p.currentNodeId) {
        const arr = m.get(p.currentNodeId) ?? [];
        arr.push(p);
        m.set(p.currentNodeId, arr);
      }
    }
    return m;
  }, [combat.participants]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Status bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border)', fontSize: 12, flexShrink: 0, flexWrap: 'wrap' }}>
        {currentParticipant && (
          <>
            <span style={{ color: 'var(--text-muted)' }}>Turno de</span>
            <span style={{ fontWeight: 700, color: 'var(--accent)' }}>{currentParticipant.displayName}</span>
          </>
        )}
        {actor && actor.currentNodeId !== null && (
          <>
            <span style={{ color: 'var(--border)', margin: '0 2px' }}>·</span>
            <span style={{ color: 'var(--text-muted)' }}>Deslocamento:</span>
            {isGM && onSetRemainingDisplacement ? (
              editingDisp ? (
                <form style={{ display: 'flex', gap: 4, alignItems: 'center' }}
                  onSubmit={async e => {
                    e.preventDefault();
                    const v = parseFloat(editDispValue);
                    if (!isNaN(v)) await onSetRemainingDisplacement(actor.uid, Math.max(0, v));
                    setEditingDisp(false);
                  }}>
                  <input autoFocus type="number" step="0.5" min="0" value={editDispValue}
                    onChange={e => setEditDispValue(e.target.value)}
                    onBlur={() => setEditingDisp(false)}
                    style={{ width: 60, padding: '1px 5px', background: 'var(--bg-base)', border: '1px solid var(--accent)', borderRadius: 4, color: '#22c55e', fontSize: 12, fontWeight: 700 }} />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>m</span>
                </form>
              ) : (
                <button title="Clique para editar"
                  onClick={() => { setEditDispValue(actor.remainingDisplacement.toFixed(1)); setEditingDisp(true); }}
                  style={{ fontWeight: 700, color: '#22c55e', background: 'none', border: '1px dashed #22c55e44', borderRadius: 4, padding: '1px 6px', cursor: 'pointer', fontSize: 12 }}>
                  {actor.remainingDisplacement.toFixed(1)}m &#10000;
                </button>
              )
            ) : (
              <span style={{ fontWeight: 700, color: '#22c55e' }}>{actor.remainingDisplacement.toFixed(1)}m</span>
            )}
          </>
        )}
        {isGM && selectedUid && (
          <>
            <span style={{ color: 'var(--border)', margin: '0 2px' }}>·</span>
            <span style={{ color: '#fbbf24', fontWeight: 600 }}>
              {combat.displacementMode === 'open' ? '&#128275; Teleporte' : '&#128207; Mover via regra'}:{' '}
              {combat.participants.find(p => p.uid === selectedUid)?.displayName}
            </span>
            <button onClick={() => setSelectedUid(null)}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 12 }}>&#10005;</button>
          </>
        )}
        {moving && <span style={{ color: 'var(--text-muted)' }}>...movendo</span>}
        <div style={{ flex: 1 }} />
        {!isGM && isMyTurn && myParticipant?.moveSnapshot && onUndoMove && (
          <button onClick={async () => { await onUndoMove(myParticipant.uid); }}
            style={{ padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg-base)', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
            &#8617; Desfazer deslocamento
          </button>
        )}
        {isGM && onSetDisplacementMode && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Deslocamento:</span>
            <button
              onClick={() => onSetDisplacementMode(combat.displacementMode === 'rule' ? 'open' : 'rule')}
              style={{
                padding: '3px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600,
                border: `1px solid ${combat.displacementMode === 'open' ? '#f59e0b' : 'var(--border)'}`,
                background: combat.displacementMode === 'open' ? '#f59e0b22' : 'var(--bg-base)',
                color: combat.displacementMode === 'open' ? '#f59e0b' : 'var(--text-secondary)',
              }}>
              {combat.displacementMode === 'rule' ? '&#128207; Regra' : '&#128275; Aberto'}
            </button>
          </div>
        )}
        {!isGM && myParticipant?.movementBlocked && (
          <span style={{ fontSize: 11, color: '#ef4444', fontWeight: 600 }}>&#128274; Movimento bloqueado pelo mestre</span>
        )}
        {!isGM && isMyTurn && actor?.currentNodeId && !myParticipant?.movementBlocked && (
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>
            {combat.displacementMode === 'open' ? 'Deslocamento livre — clique num nó' : 'Clique num nó ou caminho destacado'}
          </span>
        )}
      </div>

      {/* SVG canvas */}
      <svg
        ref={vp.svgRef}
        style={{ flex: 1, background: 'var(--bg-base)', cursor: 'grab', display: 'block', touchAction: 'none' }}
        viewBox={vp.viewBoxStr}
        onMouseDown={handleMouseDown}
        onMouseMove={e => vp.updatePan(e)}
        onMouseUp={vp.endPan}
        onMouseLeave={vp.endPan}
        onWheel={vp.handleWheel}
        {...(vp.touchHandlers ?? {})}
      >
        <defs>
          <pattern id="cm-grid" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="var(--border)" strokeWidth="0.4" opacity="0.4" />
          </pattern>
        </defs>
        <rect x={vp.view.x - 9999} y={vp.view.y - 9999} width={vp.view.w + 19998} height={vp.view.h + 19998} fill="url(#cm-grid)" />

        {paths.map(path => {
          const a = nodes.find(n => n.id === path.sourceId);
          const b = nodes.find(n => n.id === path.targetId);
          if (!a || !b) return null;
          if (!isGM && !visiblePathIds.has(path.id)) return null;
          return (
            <CombatPath key={path.id}
              path={path} nodeA={a} nodeB={b}
              isReachable={highlightedPathIds.has(path.id)}
              isExceedance={exceedantNodeIds.has(path.sourceId) || exceedantNodeIds.has(path.targetId)}
              participants={combat.participants} characters={characters}
              isAnonymousA={anonymousNodeIds.has(path.sourceId)}
              isAnonymousB={anonymousNodeIds.has(path.targetId)}
              onClick={e => {
                if (!canInteract) return;
                e.stopPropagation();
                if (isGM && selectedUid) {
                  if (combat.displacementMode === 'rule' && actor && actor.currentNodeId !== null && highlightedPathIds.has(path.id)) {
                    setMoving(true);
                    onMove(selectedUid, path.id).finally(() => setMoving(false));
                  }
                  return;
                }
                if (!actor || !reachablePathIds.has(path.id)) return;
                setMoving(true);
                onMove(actor.uid, path.id).finally(() => setMoving(false));
              }}
            />
          );
        })}

        {nodes.map(node => {
          const isAnon   = !isGM && anonymousNodeIds.has(node.id);
          const isHidden = !isGM && !visibleNodeIds.has(node.id) && !anonymousNodeIds.has(node.id);
          if (isHidden) return null;
          return (
            <CombatNode key={node.id}
              node={node}
              participants={isAnon ? [] : (participantsByNode.get(node.id) ?? [])}
              characters={characters}
              currentUid={currentParticipant?.uid}
              selectedUid={selectedUid ?? undefined}
              isReachable={highlightedNodeIds.has(node.id) && !!actor}
              isDimmed={!isGM && !!actor && !reachableNodeIds.has(node.id) && node.id !== actor.currentNodeId}
              isGM={isGM}
              isAnonymous={isAnon}
              onNodeClick={isAnon ? () => {} : handleNodeClick}
              onParticipantClick={handleParticipantClick}
              labelFontSize={labelFontSizeProp}
              participantIndex={participantIndexMap}
            />
          );
        })}
      </svg>

      {/* Center map button */}
      <button onClick={() => vp.setView(initialView)} title="Centralizar mapa"
        style={{ position: 'absolute', bottom: 56, left: 12, zIndex: 10, width: 36, height: 36, borderRadius: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 18, boxShadow: '0 2px 8px rgba(0,0,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-base)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}>
        &#8853;
      </button>

      {/* Unpositioned participants bar */}
      {(() => {
        const unpositioned = combat.participants.filter(p => {
          if (p.currentNodeId) return false;
          if (isGM) return true;
          const char = characters.find(c => c.id === p.characterId);
          return char?.type === 'pc';
        });
        if (unpositioned.length === 0) return null;
        return (
          <div style={{ position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, boxShadow: '0 4px 20px rgba(0,0,0,0.4)', maxWidth: '80%', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>Sem posição:</span>
            {unpositioned.map((p, i) => {
              const char = characters.find(c => c.id === p.characterId);
              const color = participantColor(participantIndexMap.get(p.uid) ?? i);
              const initials = p.displayName.slice(0, 2).toUpperCase();
              const isCurrent = p.uid === currentParticipant?.uid;
              return (
                <div key={p.uid}
                  onClick={() => isGM && setSelectedUid(prev => prev === p.uid ? null : p.uid)}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: isGM ? 'pointer' : 'default', background: selectedUid === p.uid ? color + '22' : 'transparent', borderRadius: 6, padding: '2px 6px', border: isCurrent ? `1px solid #fbbf24` : '1px solid transparent' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                    {char?.avatar
                      ? <img src={char.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: char.avatarPosition ?? '50% 50%' }} alt="" />
                      : initials}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: isCurrent ? 700 : 400 }}>
                    {p.displayName}
                  </span>
                </div>
              );
            })}
          </div>
        );
      })()}
    </div>
  );
}
