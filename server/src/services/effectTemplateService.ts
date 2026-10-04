import db from '../database/db';
import { EffectTemplate, CreateEffectTemplateDTO, UpdateEffectTemplateDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';

function rowToEffect(row: any): EffectTemplate {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    iconColor: row.icon_color,
    description: row.description,
    applications: row.applications ? JSON.parse(row.applications) : [],
    grimorioId: row.grimorio_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllEffectTemplates(): EffectTemplate[] {
  return (db.prepare('SELECT * FROM effect_templates ORDER BY name ASC').all() as any[]).map(rowToEffect);
}

export function getEffectTemplateById(id: string): EffectTemplate | null {
  const row = db.prepare('SELECT * FROM effect_templates WHERE id = ?').get(id) as any;
  return row ? rowToEffect(row) : null;
}

export function createEffectTemplate(dto: CreateEffectTemplateDTO): EffectTemplate {
  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO effect_templates (id, name, icon, icon_color, description, applications, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(id, dto.name, dto.icon ?? 'Zap', dto.iconColor ?? '#6366f1', dto.description ?? '', JSON.stringify(dto.applications ?? []), now, now);
  return getEffectTemplateById(id)!;
}

export function updateEffectTemplate(id: string, dto: UpdateEffectTemplateDTO): EffectTemplate | null {
  const current = getEffectTemplateById(id);
  if (!current) return null;
  const now = new Date().toISOString();
  db.prepare(
    'UPDATE effect_templates SET name = ?, icon = ?, icon_color = ?, description = ?, applications = ?, updated_at = ? WHERE id = ?'
  ).run(
    dto.name ?? current.name,
    dto.icon ?? current.icon,
    dto.iconColor ?? current.iconColor,
    dto.description ?? current.description,
    JSON.stringify(dto.applications ?? current.applications),
    now, id,
  );
  return getEffectTemplateById(id);
}

export function deleteEffectTemplate(id: string): boolean {
  const result = db.prepare('DELETE FROM effect_templates WHERE id = ?').run(id);
  return result.changes > 0;
}

/**
 * Propagates changes from an updated EffectTemplate to all ItemTemplates and
 * CharacterItems whose effects reference it via `templateId`.
 * Returns the unique character IDs that were affected (for socket emission).
 */
export function propagateEffectUpdate(templateId: string, template: EffectTemplate): string[] {
  const now = new Date().toISOString();
  const patch = {
    name: template.name,
    icon: template.icon,
    color: template.iconColor,
    description: template.description,
    applications: template.applications,
  };

  // Propagate to item_templates
  for (const row of db.prepare('SELECT id, effects FROM item_templates').all() as any[]) {
    const effects: any[] = row.effects ? JSON.parse(row.effects) : [];
    let changed = false;
    const updated = effects.map((eff: any) => {
      if (eff.templateId !== templateId) return eff;
      changed = true;
      return { ...eff, ...patch };
    });
    if (changed) {
      db.prepare('UPDATE item_templates SET effects = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(updated), now, row.id);
    }
  }

  // Propagate to character_items, collect affected character IDs
  const affectedCharIds = new Set<string>();
  for (const row of db.prepare('SELECT id, character_id, effects FROM character_items').all() as any[]) {
    const effects: any[] = row.effects ? JSON.parse(row.effects) : [];
    let changed = false;
    const updated = effects.map((eff: any) => {
      if (eff.templateId !== templateId) return eff;
      changed = true;
      return { ...eff, ...patch };
    });
    if (changed) {
      db.prepare('UPDATE character_items SET effects = ?, updated_at = ? WHERE id = ?')
        .run(JSON.stringify(updated), now, row.id);
      affectedCharIds.add(row.character_id);
    }
  }

  return [...affectedCharIds];
}
