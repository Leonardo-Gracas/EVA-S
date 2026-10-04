import db from '../database/db';
import { HistoryEvent } from '../types';
import { v4 as uuidv4 } from 'uuid';

function rowToEvent(row: any): HistoryEvent {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    metadata: row.metadata,
    createdAt: row.created_at,
  };
}

export function logHistory(type: string, description: string, metadata: object): HistoryEvent {
  const now = new Date().toISOString();
  const id = uuidv4();

  db.prepare(`
    INSERT INTO history (id, type, description, metadata, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, type, description, JSON.stringify(metadata), now);

  return rowToEvent(db.prepare('SELECT * FROM history WHERE id = ?').get(id) as any);
}

export function getHistory(limit = 50): HistoryEvent[] {
  const rows = db.prepare('SELECT * FROM history ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
  return rows.map(rowToEvent);
}
