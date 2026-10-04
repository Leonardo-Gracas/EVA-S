import { v4 as uuidv4 } from 'uuid';
import db from '../database/db';
import { GameMap, MapNode, MapPath, CreateMapDTO, UpdateMapDTO } from '../types';

interface MapRow {
  id: string; name: string; data: string; created_at: string; updated_at: string;
}

function rowToMap(row: MapRow): GameMap {
  const data = JSON.parse(row.data) as { nodes: MapNode[]; paths: MapPath[] };
  return {
    id: row.id,
    name: row.name,
    nodes: data.nodes ?? [],
    paths: data.paths ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllMaps(): GameMap[] {
  const rows = db.prepare('SELECT * FROM maps ORDER BY created_at ASC').all() as MapRow[];
  return rows.map(rowToMap);
}

export function getMapById(id: string): GameMap | null {
  const row = db.prepare('SELECT * FROM maps WHERE id = ?').get(id) as MapRow | undefined;
  return row ? rowToMap(row) : null;
}

export function createMap(dto: CreateMapDTO): GameMap {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO maps (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
  ).run(id, dto.name || 'Novo Mapa', JSON.stringify({ nodes: [], paths: [] }), now, now);
  return getMapById(id)!;
}

export function updateMap(id: string, dto: UpdateMapDTO): GameMap | null {
  const existing = getMapById(id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const name = dto.name ?? existing.name;
  const nodes = dto.nodes ?? existing.nodes;
  const paths = dto.paths ?? existing.paths;
  db.prepare('UPDATE maps SET name = ?, data = ?, updated_at = ? WHERE id = ?')
    .run(name, JSON.stringify({ nodes, paths }), now, id);
  return getMapById(id);
}

export function deleteMap(id: string): void {
  db.prepare('DELETE FROM maps WHERE id = ?').run(id);
}
