import React, { useState, useEffect } from 'react';
import { useTitle } from '../hooks/useTitle';
import { Swords, Plus, SkipForward, ChevronRight, Save } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import { CombatSession, CombatParticipant, Character, GameMap } from '../types';
import PageHeader from '../components/common/PageHeader';
import Button from '../components/common/Button';
import CombatResourceModal from '../components/characters/CombatResourceModal';
import CombatMap from './CombatMap';
import { MapEditorEmbed } from './MapEditor';
import { ParticipantCard } from '../components/combat/ParticipantCard';
import { AddEffectModal } from '../components/combat/AddEffectModal';
import { AddParticipantModal } from '../components/combat/AddParticipantModal';

const selectStyle: React.CSSProperties = {
  padding: '7px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
  borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13,
};

export default function Combat() {
  useTitle('Combate');
  const { activeCombat, characters, effectTemplates, dispatch } = useApp();
  const [creating, setCreating] = useState(false);
  const [combatName, setCombatName] = useState('Combate');
  const [addOpen, setAddOpen] = useState(false);
  const [advancingTurn, setAdvancingTurn] = useState(false);
  const [resourceModal, setResourceModal] = useState<string | null>(null);
  const [effectModal, setEffectModal] = useState<string | null>(null);
  const [selectedMapId, setSelectedMapId] = useState<string>('');
  const [maps, setMaps] = useState<GameMap[]>([]);
  const [gameMap, setGameMap] = useState<GameMap | null>(null);
  const [reorderMode, setReorderMode] = useState(false);
  const [reorderList, setReorderList] = useState<CombatParticipant[]>([]);
  const [mapEditorOpen, setMapEditorOpen] = useState(false);

  const session = activeCombat;

  useEffect(() => { api.maps.list().then(setMaps); }, []);
  useEffect(() => {
    if (!session?.mapId) { setGameMap(null); return; }
    api.maps.list().then(list => setGameMap(list.find(m => m.id === session.mapId) ?? null));
  }, [session?.mapId]);

  const updateCombat = (s: CombatSession | null) => dispatch({ type: 'SET_COMBAT', payload: s });

  const handleCreate = async () => {
    setCreating(true);
    try {
      const s = await api.combat.create({ name: combatName.trim() || 'Combate', mapId: selectedMapId || null });
      updateCombat(s);
    } finally { setCreating(false); }
  };

  const handleEnd = async () => {
    if (!session) return;
    if (!confirm('Encerrar o combate?')) return;
    await api.combat.end(session.id);
    updateCombat(null);
  };

  const handleNextTurn = async () => {
    if (!session || advancingTurn) return;
    setAdvancingTurn(true);
    try { updateCombat(await api.combat.nextTurn(session.id)); } finally { setAdvancingTurn(false); }
  };

  const handleBossToggle = async (uid: string, current: boolean) => {
    if (!session) return;
    updateCombat(await api.combat.updateParticipant(session.id, uid, { isBossMode: !current }));
  };

  const handleRemove = async (uid: string) => {
    if (!session) return;
    updateCombat(await api.combat.removeParticipant(session.id, uid));
  };

  const handleRemoveEffect = async (participantUid: string, effectUid: string) => {
    if (!session) return;
    updateCombat(await api.combat.removeEffect(session.id, participantUid, effectUid));
  };

  const handleAssignNode = async (participantUid: string, nodeId: string | null) => {
    if (!session) return;
    updateCombat(await api.combat.assignNode(session.id, participantUid, nodeId));
  };

  const handleMove = async (participantUid: string, pathId: string) => {
    if (!session) return;
    const result = await api.combat.move(session.id, participantUid, pathId);
    updateCombat(result.session);
  };

  const handleSetDisplacementMode = async (mode: 'rule' | 'open') => {
    if (!session) return;
    updateCombat(await api.combat.setDisplacementMode(session.id, mode));
  };

  const handleSetRemainingDisplacement = async (participantUid: string, value: number) => {
    if (!session) return;
    updateCombat(await api.combat.setRemainingDisplacement(session.id, participantUid, value));
  };

  const handleSelectMap = async (mapId: string) => {
    if (!session) return;
    setSelectedMapId(mapId);
    updateCombat(await api.combat.selectMap(session.id, mapId || null));
  };

  const handleMovementToggle = async (uid: string, currentlyBlocked: boolean) => {
    if (!session) return;
    updateCombat(await api.combat.setMovementLock(session.id, uid, !currentlyBlocked));
  };

  const handleSetMapVisibility = async (level: 1 | 2 | 3 | 4) => {
    if (!session) return;
    updateCombat(await api.combat.setMapVisibility(session.id, level));
  };

  const startReorder = () => {
    if (!session) return;
    setReorderList([...session.participants]);
    setReorderMode(true);
  };

  const moveInList = (idx: number, dir: -1 | 1) => {
    setReorderList(prev => {
      const next = [...prev];
      const swapIdx = idx + dir;
      if (swapIdx < 0 || swapIdx >= next.length) return prev;
      [next[idx], next[swapIdx]] = [next[swapIdx], next[idx]];
      return next;
    });
  };

  const saveReorder = async () => {
    if (!session) return;
    updateCombat(await api.combat.reorder(session.id, reorderList.map(p => p.uid)));
    setReorderMode(false);
  };

  const handleMapSaved = async (updatedMap: GameMap) => {
    setGameMap(updatedMap);
    setMapEditorOpen(false);
    if (!session) return;
    const validNodeIds = new Set(updatedMap.nodes.map(n => n.id));
    for (const p of session.participants) {
      if (p.currentNodeId && !validNodeIds.has(p.currentNodeId)) {
        await handleAssignNode(p.uid, null);
      }
    }
  };

  const currentParticipant = session?.participants[session.currentIndex];
  const queueSize = session?.participants.length ?? 1;

  if (!session || session.status !== 'active') {
    return (
      <div style={pg.page}>
        <PageHeader title="Combate" subtitle="Nenhum combate ativo" />
        <div style={pg.empty}>
          <Swords size={48} color="var(--text-muted)" style={{ opacity: 0.4 }} />
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Inicie um novo combate para gerenciar a fila de turnos.</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input style={pg.nameInput} placeholder="Nome do combate" value={combatName}
                onChange={e => setCombatName(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleCreate()} />
              <Button variant="primary" icon={<Swords size={14} />} loading={creating} onClick={handleCreate}>Iniciar Combate</Button>
            </div>
            {maps.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
                <span style={{ color: 'var(--text-muted)' }}>Mapa:</span>
                <select value={selectedMapId} onChange={e => setSelectedMapId(e.target.value)}
                  style={{ ...selectStyle, width: 200 }}>
                  <option value="">Nenhum</option>
                  {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const resourceParticipant = session.participants.find(x => x.uid === resourceModal);
  const effectParticipant   = session.participants.find(x => x.uid === effectModal);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, padding: '12px 20px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid var(--border)', background: 'var(--bg-surface)' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>{session.name}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Turno global {session.globalTurn} · {session.participants.length} participante{session.participants.length !== 1 ? 's' : ''}</div>
        </div>
        <select value={session.mapId ?? ''} onChange={e => handleSelectMap(e.target.value)}
          style={{ ...selectStyle, width: 170, fontSize: 12 }}>
          <option value="">Sem mapa</option>
          {maps.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        {gameMap && (
          <button onClick={() => setMapEditorOpen(true)} title="Editar mapa"
            style={{ padding: '5px 9px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: 13, display: 'flex', alignItems: 'center' }}>
            &#9999;
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>&#128065;</span>
          <select value={session.mapVisibility ?? 4}
            onChange={e => handleSetMapVisibility(Number(e.target.value) as 1 | 2 | 3 | 4)}
            style={{ ...selectStyle, width: 150, fontSize: 12 }}
            title="Visibilidade do mapa para jogadores">
            <option value={1}>Névoa densa</option>
            <option value={2}>Exploração local</option>
            <option value={3}>Exploração partilhada</option>
            <option value={4}>Visão aberta</option>
          </select>
        </div>
        <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => setAddOpen(true)}>Adicionar</Button>
        <Button variant="ghost" size="sm" onClick={handleEnd} style={{ color: 'var(--error)' }}>Encerrar</Button>
      </div>

      {/* Turn banner */}
      {currentParticipant && (
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '8px 20px', background: 'var(--accent-dim)', borderBottom: '1px solid var(--accent)' }}>
          <ChevronRight size={15} color="var(--accent)" />
          <span style={{ fontSize: 13, color: 'var(--text-secondary)' }}>É a vez de</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{currentParticipant.displayName}</span>
          <div style={{ flex: 1 }} />
          <Button variant="primary" size="sm" icon={<SkipForward size={14} />} loading={advancingTurn} onClick={handleNextTurn}>
            Próximo turno
          </Button>
        </div>
      )}

      {/* Main area */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
          {gameMap ? (
            <CombatMap
              combat={session} gameMap={gameMap} characters={characters} isGM={true}
              onAssignNode={handleAssignNode} onMove={handleMove}
              onSetDisplacementMode={handleSetDisplacementMode}
              onSetRemainingDisplacement={handleSetRemainingDisplacement}
            />
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, color: 'var(--text-muted)' }}>
              <Swords size={36} opacity={0.2} />
              <p style={{ fontSize: 13 }}>Selecione um mapa no topo para exibi-lo no combate.</p>
            </div>
          )}
        </div>

        {/* Queue sidebar */}
        <div style={{ width: 300, borderLeft: '1px solid var(--border)', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: 10, background: 'var(--bg-surface)', flexShrink: 0 }}>
          <div style={{ display: 'flex', gap: 6, paddingBottom: 6, borderBottom: '1px solid var(--border)' }}>
            {reorderMode ? (
              <>
                <Button variant="primary" size="sm" icon={<Save size={12} />} onClick={saveReorder} style={{ flex: 1 }}>Salvar ordem</Button>
                <Button variant="secondary" size="sm" onClick={() => setReorderMode(false)} style={{ flex: 1 }}>Cancelar</Button>
              </>
            ) : (
              <button onClick={startReorder} disabled={session.participants.length < 2}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: 12, color: 'var(--text-secondary)', width: '100%', justifyContent: 'center', opacity: session.participants.length < 2 ? 0.4 : 1 }}>
                &#8597; Reorganizar turnos
              </button>
            )}
          </div>

          {session.participants.length === 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, padding: '40px 0' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center' }}>Nenhum participante.</p>
              <Button variant="ghost" size="sm" icon={<Plus size={13} />} onClick={() => setAddOpen(true)}>Adicionar</Button>
            </div>
          )}
          {(reorderMode ? reorderList : session.participants).map((p, idx) => (
            <ParticipantCard
              key={p.uid}
              participant={p}
              character={characters.find((c: Character) => c.id === p.characterId)}
              isActive={!reorderMode && idx === session.currentIndex}
              isGM={true}
              globalTurn={session.globalTurn}
              queueSize={queueSize}
              effectTemplates={effectTemplates}
              onBossModeToggle={() => handleBossToggle(p.uid, p.isBossMode)}
              onEditResources={() => setResourceModal(p.uid)}
              onRemove={() => handleRemove(p.uid)}
              onAddEffect={() => setEffectModal(p.uid)}
              onRemoveEffect={(effUid) => handleRemoveEffect(p.uid, effUid)}
              onMovementToggle={() => handleMovementToggle(p.uid, !!p.movementBlocked)}
              reorderMode={reorderMode}
              onMoveUp={() => moveInList(idx, -1)}
              onMoveDown={() => moveInList(idx, 1)}
            />
          ))}
        </div>
      </div>

      {/* Map editor overlay */}
      {mapEditorOpen && gameMap && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, display: 'flex', flexDirection: 'column', background: 'var(--bg-base)' }}>
          <MapEditorEmbed map={gameMap} onSaved={handleMapSaved} onClose={() => setMapEditorOpen(false)} />
        </div>
      )}

      <AddParticipantModal open={addOpen} onClose={() => setAddOpen(false)}
        sessionId={session.id} characters={characters} participants={session.participants}
        onDone={updateCombat} />

      {resourceParticipant && (
        <CombatResourceModal open={true} onClose={() => setResourceModal(null)}
          sessionId={session.id} participant={resourceParticipant}
          character={characters.find(c => c.id === resourceParticipant.characterId)}
          onDone={updateCombat} />
      )}

      {effectParticipant && (
        <AddEffectModal open={true} onClose={() => setEffectModal(null)}
          sessionId={session.id} participantUid={effectParticipant.uid}
          effectTemplates={effectTemplates} globalTurn={session.globalTurn}
          queueSize={queueSize} onDone={updateCombat}
          sheetTypeId={characters.find(c => c.id === effectParticipant.characterId)?.sheetTypeId} />
      )}
    </div>
  );
}

const pg: Record<string, any> = {
  page:      { padding: 28, display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 900 },
  empty:     { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '60px 0', textAlign: 'center' },
  nameInput: { padding: '8px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text-primary)', fontSize: 13, width: 200 },
};
