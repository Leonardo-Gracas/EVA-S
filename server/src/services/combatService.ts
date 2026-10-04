import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import {
  CombatSession, CombatParticipant, CombatActiveEffect, DisplacementProgress,
  CreateCombatSessionDTO, AddCombatParticipantDTO, EffectApplication,
  MapNode, MapPath, DEFAULT_DISPLACEMENT,
} from '../types';
import * as characterService from './characterService';
import { logHistory } from './historyService';

// ── DB helpers ────────────────────────────────────────────────────────────────

function rowToSession(row: any): CombatSession {
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    participants: JSON.parse(row.participants),
    currentIndex: row.current_index,
    globalTurn: row.global_turn,
    mapId: row.map_id ?? null,
    displacementMode: (row.displacement_mode ?? 'rule') as 'rule' | 'open',
    mapVisibility: (row.map_visibility ?? 4) as 1 | 2 | 3 | 4,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getMapData(mapId: string | null): { nodes: MapNode[]; paths: MapPath[] } | null {
  if (!mapId) return null;
  const row = db.prepare('SELECT data FROM maps WHERE id = ?').get(mapId) as any;
  if (!row) return null;
  return JSON.parse(row.data);
}

export function getActiveSession(): CombatSession | null {
  const row = db.prepare("SELECT * FROM combat_sessions WHERE status = 'active' ORDER BY created_at DESC LIMIT 1").get() as any;
  return row ? rowToSession(row) : null;
}

export function getSessionById(id: string): CombatSession | null {
  const row = db.prepare('SELECT * FROM combat_sessions WHERE id = ?').get(id) as any;
  return row ? rowToSession(row) : null;
}

export function getAllSessions(): CombatSession[] {
  return (db.prepare('SELECT * FROM combat_sessions ORDER BY created_at DESC').all() as any[]).map(rowToSession);
}

function saveSession(session: CombatSession): CombatSession {
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE combat_sessions SET name = ?, status = ?, participants = ?, current_index = ?, global_turn = ?, map_id = ?, displacement_mode = ?, map_visibility = ?, updated_at = ? WHERE id = ?'
  ).run(session.name, session.status, JSON.stringify(session.participants), session.currentIndex, session.globalTurn, session.mapId, session.displacementMode, session.mapVisibility ?? 4, now, session.id);
  return getSessionById(session.id)!;
}

// ── Session lifecycle ─────────────────────────────────────────────────────────

export function createSession(dto: CreateCombatSessionDTO): CombatSession {
  const active = getActiveSession();
  if (active) endSession(active.id);

  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO combat_sessions (id, name, status, participants, current_index, global_turn, map_id, displacement_mode, map_visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, dto.name ?? 'Combate', 'active', '[]', 0, 0, dto.mapId ?? null, 'rule', 4, now, now);
  logHistory('combat:started', `Combate "${dto.name ?? 'Combate'}" iniciado`, { combatId: id });
  return getSessionById(id)!;
}

export function endSession(id: string): CombatSession | null {
  const session = getSessionById(id);
  if (!session) return null;
  session.status = 'ended';
  const result = saveSession(session);
  logHistory('combat:ended', `Combate "${session.name}" encerrado`, { combatId: id });
  return result;
}

export function selectMap(sessionId: string, mapId: string | null): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;
  session.mapId = mapId;
  // Clear positions if map changes
  session.participants = session.participants.map(p => ({
    ...p, currentNodeId: null, displacementProgress: null,
  }));
  return saveSession(session);
}

// ── Participants ──────────────────────────────────────────────────────────────

function autoName(baseName: string, existing: CombatParticipant[]): string {
  const sameName = existing.filter(p =>
    p.displayName === baseName || p.displayName.match(new RegExp(`^${baseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} \\(\\d+\\)$`))
  );
  if (sameName.length === 0) return baseName;
  return `${baseName} (${sameName.length + 1})`;
}

export function addParticipant(sessionId: string, dto: AddCombatParticipantDTO): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const character = characterService.getCharacterById(dto.characterId);
  if (!character) return null;

  const baseName = dto.displayName ?? character.name;
  const displayName = autoName(baseName, session.participants);

  const participant: CombatParticipant = {
    uid: uuidv4(),
    characterId: dto.characterId,
    displayName,
    isBossMode: dto.isBossMode ?? (character.type === 'npc'),
    currentResources: { ...character.currentResources },
    activeEffects: [],
    currentNodeId: null,
    remainingDisplacement: character.displacement ?? DEFAULT_DISPLACEMENT,
    displacementProgress: null,
    moveSnapshot: null,
  };

  session.participants.push(participant);
  return saveSession(session);
}

export function removeParticipant(sessionId: string, participantUid: string): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const idx = session.participants.findIndex(p => p.uid === participantUid);
  if (idx === -1) return null;

  session.participants.splice(idx, 1);
  if (session.participants.length === 0) {
    session.currentIndex = 0;
  } else if (session.currentIndex >= session.participants.length) {
    session.currentIndex = 0;
  }
  return saveSession(session);
}

export function reorderParticipants(sessionId: string, orderedUids: string[]): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const sorted = orderedUids
    .map(uid => session.participants.find(p => p.uid === uid))
    .filter((p): p is CombatParticipant => !!p);
  session.participants = sorted;
  session.currentIndex = Math.min(session.currentIndex, Math.max(0, sorted.length - 1));
  return saveSession(session);
}

export function nextTurn(sessionId: string): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active' || session.participants.length === 0) return null;

  session.globalTurn += 1;
  session.currentIndex = (session.currentIndex + 1) % session.participants.length;

  // Remove expired effects
  session.participants = session.participants.map(p => ({
    ...p,
    activeEffects: p.activeEffects.filter(e =>
      e.durationRounds === 0 || session.globalTurn <= e.expireAtGlobalTurn
    ),
  }));

  // Reset displacement for the new current participant and clear its snapshot
  const current = session.participants[session.currentIndex];
  if (current) {
    const character = characterService.getCharacterById(current.characterId);
    current.remainingDisplacement = character?.displacement ?? DEFAULT_DISPLACEMENT;
    current.moveSnapshot = null;
  }

  return saveSession(session);
}

// ── Map movement ──────────────────────────────────────────────────────────────

/** GM: toggle displacement mode */
export function setDisplacementMode(sessionId: string, mode: 'rule' | 'open'): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;
  session.displacementMode = mode;
  return saveSession(session);
}

/** GM: set map visibility level (1=fog,2=local,3=shared,4=open) */
export function setMapVisibility(sessionId: string, level: 1 | 2 | 3 | 4): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;
  session.mapVisibility = level;
  return saveSession(session);
}

/** GM: lock/unlock movement for a participant */
export function setParticipantMovement(sessionId: string, participantUid: string, blocked: boolean): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;
  const p = session.participants.find(p => p.uid === participantUid);
  if (!p) return null;
  p.movementBlocked = blocked;
  return saveSession(session);
}

/** GM: directly set remaining displacement for a participant */
export function setRemainingDisplacement(sessionId: string, participantUid: string, value: number): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;
  const p = session.participants.find(p => p.uid === participantUid);
  if (!p) return null;
  p.remainingDisplacement = Math.max(0, value);
  return saveSession(session);
}

/** Player: undo last movement in the current turn */
export function undoMove(sessionId: string, participantUid: string): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;
  const p = session.participants.find(p => p.uid === participantUid);
  if (!p || !p.moveSnapshot) return null;
  p.currentNodeId = p.moveSnapshot.nodeId;
  p.remainingDisplacement = p.moveSnapshot.remainingDisplacement;
  p.displacementProgress = p.moveSnapshot.displacementProgress;
  p.moveSnapshot = null;
  return saveSession(session);
}

/** GM: teleport participant to any node (or clear position) */
export function assignNode(sessionId: string, participantUid: string, nodeId: string | null): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const p = session.participants.find(p => p.uid === participantUid);
  if (!p) return null;

  p.currentNodeId = nodeId;
  p.displacementProgress = null; // clear any partial traversal
  return saveSession(session);
}

/** Compute effective path cost accounting for node exceedance */
function effectiveCost(path: MapPath, sourceNodeId: string, participants: CombatParticipant[], nodes: MapNode[]): number {
  const sourceNode = nodes.find(n => n.id === sourceNodeId);
  if (!sourceNode) return path.distance;

  const occupants = participants.filter(p => p.currentNodeId === sourceNodeId).length;
  const limit = sourceNode.occupancyLimit;
  const doubled = occupants > limit;
  return doubled ? path.distance * 2 : path.distance;
}

/** Player/GM: attempt to move participant along a path */
export function moveParticipant(
  sessionId: string,
  participantUid: string,
  pathId: string,
): { session: CombatSession; result: 'moved' | 'progress' | 'error'; message?: string } | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const p = session.participants.find(p => p.uid === participantUid);
  if (!p) return null;

  if (p.movementBlocked) return { session, result: 'error', message: 'Movimento bloqueado pelo mestre' };

  const mapData = getMapData(session.mapId);
  if (!mapData) return { session, result: 'error', message: 'Nenhum mapa selecionado' };

  const { nodes, paths } = mapData;
  const path = paths.find(pa => pa.id === pathId);
  if (!path) return { session, result: 'error', message: 'Caminho não encontrado' };

  // Determine direction: participant must be at one end
  let sourceId: string;
  let targetId: string;
  let direction: 'forward' | 'backward';

  if (p.currentNodeId === path.sourceId) {
    sourceId = path.sourceId; targetId = path.targetId; direction = 'forward';
  } else if (p.currentNodeId === path.targetId) {
    sourceId = path.targetId; targetId = path.sourceId; direction = 'backward';
  } else if (p.displacementProgress?.pathId === pathId) {
    sourceId = p.displacementProgress.direction === 'forward' ? path.sourceId : path.targetId;
    targetId = p.displacementProgress.direction === 'forward' ? path.targetId : path.sourceId;
    direction = p.displacementProgress.direction;
  } else {
    return { session, result: 'error', message: 'Participante não está na origem do caminho' };
  }

  // Save snapshot before the first move of this turn (for undo)
  if (!p.moveSnapshot) {
    p.moveSnapshot = {
      nodeId: p.currentNodeId,
      remainingDisplacement: p.remainingDisplacement,
      displacementProgress: p.displacementProgress,
    };
  }

  // Open displacement mode: move freely, no cost
  if (session.displacementMode === 'open') {
    p.currentNodeId = targetId;
    p.displacementProgress = null;
    const updatedSession = saveSession(session);
    return { session: updatedSession, result: 'moved' };
  }

  const cost = effectiveCost(path, sourceId, session.participants, nodes);

  // Use fraction-based progress so overcrowding changes scale proportionally
  const existingProg = p.displacementProgress?.pathId === pathId ? p.displacementProgress : null;
  // Backward-compat: if old data has accumulated instead of fraction, convert
  const currentFraction = existingProg
    ? (existingProg.fraction !== undefined ? existingProg.fraction : (existingProg as any).accumulated / cost)
    : 0;
  const remaining = cost * (1 - currentFraction);

  if (p.remainingDisplacement >= remaining) {
    p.remainingDisplacement = Math.max(0, p.remainingDisplacement - remaining);
    p.currentNodeId = targetId;
    p.displacementProgress = null;
    const updatedSession = saveSession(session);
    return { session: updatedSession, result: 'moved' };
  } else {
    const newFraction = currentFraction + p.remainingDisplacement / cost;
    p.displacementProgress = { pathId, fraction: newFraction, direction };
    p.remainingDisplacement = 0;
    const updatedSession = saveSession(session);
    return { session: updatedSession, result: 'progress' };
  }
}

// ── Resources & effects ───────────────────────────────────────────────────────

export function updateParticipant(
  sessionId: string,
  participantUid: string,
  patch: {
    isBossMode?: boolean;
    currentResources?: Record<string, number>;
  }
): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const p = session.participants.find(p => p.uid === participantUid);
  if (!p) return null;

  if (patch.isBossMode !== undefined) p.isBossMode = patch.isBossMode;
  if (patch.currentResources) p.currentResources = { ...p.currentResources, ...patch.currentResources };

  return saveSession(session);
}

export function syncCharacterResources(characterId: string, currentResources: Record<string, number>): CombatSession | null {
  const session = getActiveSession();
  if (!session) return null;

  let changed = false;
  session.participants = session.participants.map(p => {
    if (p.characterId !== characterId) return p;
    changed = true;
    return { ...p, currentResources: { ...p.currentResources, ...currentResources } };
  });
  if (!changed) return null;

  return saveSession(session);
}

export function addEffect(
  sessionId: string,
  participantUid: string,
  effect: { name: string; icon?: string; color?: string; description?: string; durationRounds: number; applications: EffectApplication[] }
): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session || session.status !== 'active') return null;

  const p = session.participants.find(p => p.uid === participantUid);
  if (!p) return null;

  const queueSize = session.participants.length || 1;
  const active: CombatActiveEffect = {
    uid: uuidv4(),
    name: effect.name,
    icon: effect.icon,
    color: effect.color,
    description: effect.description,
    applications: effect.applications,
    durationRounds: effect.durationRounds,
    appliedAtGlobalTurn: session.globalTurn,
    expireAtGlobalTurn: effect.durationRounds > 0
      ? session.globalTurn + effect.durationRounds * queueSize
      : 0,
  };
  p.activeEffects.push(active);
  return saveSession(session);
}

export function removeEffect(sessionId: string, participantUid: string, effectUid: string): CombatSession | null {
  const session = getSessionById(sessionId);
  if (!session) return null;
  const p = session.participants.find(p => p.uid === participantUid);
  if (!p) return null;
  p.activeEffects = p.activeEffects.filter(e => e.uid !== effectUid);
  return saveSession(session);
}
