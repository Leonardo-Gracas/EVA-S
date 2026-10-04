import db from '../database/db';
import { ItemTemplate, CreateItemTemplateDTO, UpdateItemTemplateDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';

function rowToItem(row: any): ItemTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    type: row.item_type,
    icon: row.icon ?? undefined,
    iconColor: row.icon_color ?? undefined,
    damage: row.damage ?? undefined,
    effects: row.effects ? JSON.parse(row.effects) : [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllItemTemplates(): ItemTemplate[] {
  return (db.prepare('SELECT * FROM item_templates ORDER BY name ASC').all() as any[]).map(rowToItem);
}

export function getItemTemplateById(id: string): ItemTemplate | null {
  const row = db.prepare('SELECT * FROM item_templates WHERE id = ?').get(id) as any;
  return row ? rowToItem(row) : null;
}

export function createItemTemplate(dto: CreateItemTemplateDTO): ItemTemplate {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO item_templates (id, name, description, item_type, icon, icon_color, damage, effects, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id, dto.name, dto.description ?? '', dto.type,
    dto.icon ?? 'Star', dto.iconColor ?? '#6366f1',
    dto.damage ?? null, JSON.stringify(dto.effects ?? []), now, now
  );
  return getItemTemplateById(id)!;
}

export function updateItemTemplate(id: string, dto: UpdateItemTemplateDTO): ItemTemplate | null {
  const current = getItemTemplateById(id);
  if (!current) return null;
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE item_templates SET name = ?, description = ?, item_type = ?, icon = ?, icon_color = ?, damage = ?, effects = ?, updated_at = ? WHERE id = ?'
  ).run(
    dto.name ?? current.name,
    dto.description ?? current.description,
    dto.type ?? current.type,
    dto.icon ?? current.icon ?? 'Star',
    dto.iconColor ?? current.iconColor ?? '#6366f1',
    dto.damage !== undefined ? (dto.damage ?? null) : (current.damage ?? null),
    JSON.stringify(dto.effects ?? current.effects),
    now, id,
  );
  return getItemTemplateById(id);
}

export function deleteItemTemplate(id: string): boolean {
  const result = db.prepare('DELETE FROM item_templates WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Propagates effect changes from an ItemTemplate to all CharacterItems created
 * from it (those with `template_id === itemTemplateId`).
 * Only the effects list is replaced — per-item fields (name, description, etc.)
 * stay as-is since the GM may have customized them.
 * Returns the unique character IDs that were affected.
 */
export function propagateItemTemplateEffects(itemTemplateId: string, newEffects: any[]): string[] {
  const now = new Date().toISOString();
  const affectedCharIds = new Set<string>();
  for (const row of db.prepare('SELECT id, character_id FROM character_items WHERE template_id = ?').all(itemTemplateId) as any[]) {
    db.prepare('UPDATE character_items SET effects = ?, updated_at = ? WHERE id = ?')
      .run(JSON.stringify(newEffects), now, row.id);
    affectedCharIds.add(row.character_id);
  }
  return [...affectedCharIds];
}
