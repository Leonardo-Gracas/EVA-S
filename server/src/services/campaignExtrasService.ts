import { v4 as uuidv4 } from 'uuid';
import db from '../database/db';
import {
  CampaignEvent, CreateCampaignEventDTO, UpdateCampaignEventDTO,
  CampaignPlaylist, PlaylistTrack, CreatePlaylistDTO, UpdatePlaylistDTO, CreateTrackDTO, UpdateTrackDTO,
  CampaignGoal, CreateGoalDTO, UpdateGoalDTO,
} from '../types';

// ── Events ────────────────────────────────────────────────────────────────────

function rowToEvent(row: any): CampaignEvent {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    eventDate: row.event_date ?? null,
    sessionNumber: row.session_number ?? null,
    tags: row.tags ? JSON.parse(row.tags) : [],
    happened: row.happened === 1,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllEvents(): CampaignEvent[] {
  return (db.prepare('SELECT * FROM campaign_events ORDER BY sort_order ASC, session_number ASC, created_at ASC').all() as any[]).map(rowToEvent);
}

export function createEvent(dto: CreateCampaignEventDTO): CampaignEvent {
  const id = uuidv4();
  const now = new Date().toISOString();
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM campaign_events').get() as any).m;
  db.prepare(
    'INSERT INTO campaign_events (id, title, description, event_date, session_number, tags, happened, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, dto.title, dto.description ?? '', dto.eventDate ?? null, dto.sessionNumber ?? null,
    JSON.stringify(dto.tags ?? []), dto.happened ? 1 : 0, maxOrder + 1, now, now);
  return rowToEvent(db.prepare('SELECT * FROM campaign_events WHERE id = ?').get(id) as any);
}

export function updateEvent(id: string, dto: UpdateCampaignEventDTO): CampaignEvent | null {
  const row = db.prepare('SELECT * FROM campaign_events WHERE id = ?').get(id) as any;
  if (!row) return null;
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE campaign_events SET title=?, description=?, event_date=?, session_number=?, tags=?, happened=?, sort_order=?, updated_at=? WHERE id=?'
  ).run(
    dto.title ?? row.title,
    dto.description !== undefined ? dto.description : row.description,
    dto.eventDate !== undefined ? dto.eventDate : row.event_date,
    dto.sessionNumber !== undefined ? dto.sessionNumber : row.session_number,
    JSON.stringify(dto.tags ?? JSON.parse(row.tags ?? '[]')),
    dto.happened !== undefined ? (dto.happened ? 1 : 0) : row.happened,
    dto.sortOrder !== undefined ? dto.sortOrder : row.sort_order,
    now, id,
  );
  return rowToEvent(db.prepare('SELECT * FROM campaign_events WHERE id = ?').get(id) as any);
}

export function deleteEvent(id: string): boolean {
  const result = db.prepare('DELETE FROM campaign_events WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Playlists & Tracks ────────────────────────────────────────────────────────

function rowToTrack(row: any): PlaylistTrack {
  return {
    id: row.id,
    playlistId: row.playlist_id,
    title: row.title,
    url: row.url,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToPlaylist(row: any, tracks: PlaylistTrack[]): CampaignPlaylist {
  return {
    id: row.id,
    name: row.name,
    mood: row.mood ?? 'exploration',
    tracks: tracks.filter((t) => t.playlistId === row.id),
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllPlaylists(): CampaignPlaylist[] {
  const playlists = db.prepare('SELECT * FROM campaign_playlists ORDER BY sort_order ASC, created_at ASC').all() as any[];
  const tracks = (db.prepare('SELECT * FROM playlist_tracks ORDER BY sort_order ASC').all() as any[]).map(rowToTrack);
  return playlists.map((p) => rowToPlaylist(p, tracks));
}

export function createPlaylist(dto: CreatePlaylistDTO): CampaignPlaylist {
  const id = uuidv4();
  const now = new Date().toISOString();
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM campaign_playlists').get() as any).m;
  db.prepare(
    'INSERT INTO campaign_playlists (id, name, mood, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
  ).run(id, dto.name, dto.mood ?? 'exploration', maxOrder + 1, now, now);
  return rowToPlaylist(db.prepare('SELECT * FROM campaign_playlists WHERE id = ?').get(id) as any, []);
}

export function updatePlaylist(id: string, dto: UpdatePlaylistDTO): CampaignPlaylist | null {
  const row = db.prepare('SELECT * FROM campaign_playlists WHERE id = ?').get(id) as any;
  if (!row) return null;
  const now = new Date().toISOString();
  db.prepare('UPDATE campaign_playlists SET name=?, mood=?, updated_at=? WHERE id=?')
    .run(dto.name ?? row.name, dto.mood ?? row.mood, now, id);
  const tracks = (db.prepare('SELECT * FROM playlist_tracks WHERE playlist_id = ? ORDER BY sort_order ASC').all(id) as any[]).map(rowToTrack);
  return rowToPlaylist(db.prepare('SELECT * FROM campaign_playlists WHERE id = ?').get(id) as any, tracks);
}

export function deletePlaylist(id: string): boolean {
  const result = db.prepare('DELETE FROM campaign_playlists WHERE id = ?').run(id);
  return result.changes > 0;
}

export function addTrack(playlistId: string, dto: CreateTrackDTO): PlaylistTrack {
  const id = uuidv4();
  const now = new Date().toISOString();
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM playlist_tracks WHERE playlist_id = ?').get(playlistId) as any).m;
  db.prepare(
    'INSERT INTO playlist_tracks (id, playlist_id, title, url, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, playlistId, dto.title, dto.url, maxOrder + 1, now, now);
  return rowToTrack(db.prepare('SELECT * FROM playlist_tracks WHERE id = ?').get(id) as any);
}

export function updateTrack(id: string, dto: UpdateTrackDTO): PlaylistTrack | null {
  const row = db.prepare('SELECT * FROM playlist_tracks WHERE id = ?').get(id) as any;
  if (!row) return null;
  const now = new Date().toISOString();
  db.prepare('UPDATE playlist_tracks SET title=?, url=?, updated_at=? WHERE id=?')
    .run(dto.title ?? row.title, dto.url ?? row.url, now, id);
  return rowToTrack(db.prepare('SELECT * FROM playlist_tracks WHERE id = ?').get(id) as any);
}

export function deleteTrack(id: string): boolean {
  const result = db.prepare('DELETE FROM playlist_tracks WHERE id = ?').run(id);
  return result.changes > 0;
}

// ── Goals ─────────────────────────────────────────────────────────────────────

function rowToGoal(row: any): CampaignGoal {
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? '',
    status: row.status ?? 'pending',
    priority: row.priority ?? 'medium',
    characterId: row.character_id ?? null,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllGoals(): CampaignGoal[] {
  return (db.prepare('SELECT * FROM campaign_goals ORDER BY sort_order ASC, created_at ASC').all() as any[]).map(rowToGoal);
}

export function createGoal(dto: CreateGoalDTO): CampaignGoal {
  const id = uuidv4();
  const now = new Date().toISOString();
  const maxOrder = (db.prepare('SELECT COALESCE(MAX(sort_order),0) as m FROM campaign_goals').get() as any).m;
  db.prepare(
    'INSERT INTO campaign_goals (id, title, description, status, priority, character_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, dto.title, dto.description ?? '', 'pending', dto.priority ?? 'medium', dto.characterId ?? null, maxOrder + 1, now, now);
  return rowToGoal(db.prepare('SELECT * FROM campaign_goals WHERE id = ?').get(id) as any);
}

export function updateGoal(id: string, dto: UpdateGoalDTO): CampaignGoal | null {
  const row = db.prepare('SELECT * FROM campaign_goals WHERE id = ?').get(id) as any;
  if (!row) return null;
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE campaign_goals SET title=?, description=?, status=?, priority=?, character_id=?, sort_order=?, updated_at=? WHERE id=?'
  ).run(
    dto.title ?? row.title,
    dto.description !== undefined ? dto.description : row.description,
    dto.status ?? row.status,
    dto.priority ?? row.priority,
    dto.characterId !== undefined ? dto.characterId : row.character_id,
    dto.sortOrder !== undefined ? dto.sortOrder : row.sort_order,
    now, id,
  );
  return rowToGoal(db.prepare('SELECT * FROM campaign_goals WHERE id = ?').get(id) as any);
}

export function deleteGoal(id: string): boolean {
  const result = db.prepare('DELETE FROM campaign_goals WHERE id = ?').run(id);
  return result.changes > 0;
}
