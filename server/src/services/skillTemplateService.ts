import db from '../database/db';
import { SkillTemplate, CreateSkillTemplateDTO, UpdateSkillTemplateDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { logHistory } from './historyService';

function rowToTemplate(row: any): SkillTemplate {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    iconColor: row.icon_color,
    skillType: (row.skill_type ?? 'passive') as 'active' | 'passive',
    resourceEffect: (() => { if (!row.resource_effect) return []; const p = JSON.parse(row.resource_effect); return Array.isArray(p) ? p : [p]; })(),
    tags: row.tags ? JSON.parse(row.tags) : [],
    usesLimit: row.uses_limit ?? null,
    usesLimitType: row.uses_limit_type ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getAllTemplates(): SkillTemplate[] {
  const rows = db.prepare('SELECT * FROM skill_templates ORDER BY title ASC').all() as any[];
  return rows.map(rowToTemplate);
}

export function getTemplateById(id: string): SkillTemplate | null {
  const row = db.prepare('SELECT * FROM skill_templates WHERE id = ?').get(id) as any;
  return row ? rowToTemplate(row) : null;
}

export function getTemplateByTitle(title: string, excludeId?: string): SkillTemplate | null {
  const row = excludeId
    ? db.prepare('SELECT * FROM skill_templates WHERE LOWER(title) = LOWER(?) AND id != ?').get(title.trim(), excludeId) as any
    : db.prepare('SELECT * FROM skill_templates WHERE LOWER(title) = LOWER(?)').get(title.trim()) as any;
  return row ? rowToTemplate(row) : null;
}

export function createTemplate(dto: CreateSkillTemplateDTO): SkillTemplate {
  if (!dto.title?.trim()) throw new Error('Titulo obrigatorio');

  const existing = getTemplateByTitle(dto.title);
  if (existing) {
    throw new Error(JSON.stringify({ code: 'DUPLICATE', id: existing.id, title: existing.title }));
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  db.prepare(
    'INSERT INTO skill_templates (id, title, description, icon, icon_color, skill_type, resource_effect, tags, uses_limit, uses_limit_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
  ).run(
    id,
    dto.title.trim(),
    dto.description ?? '',
    dto.icon ?? 'Star',
    dto.iconColor ?? '#6366f1',
    dto.skillType ?? 'passive',
    JSON.stringify(dto.resourceEffect ?? []),
    JSON.stringify(dto.tags ?? []),
    dto.usesLimit ?? null,
    dto.usesLimitType ?? null,
    now, now,
  );
  const tpl = getTemplateById(id)!;
  logHistory('skill_template:created', `Template "${tpl.title}" criado`, { templateId: id });
  return tpl;
}

export function updateTemplate(id: string, dto: UpdateSkillTemplateDTO): SkillTemplate | null {
  const current = getTemplateById(id);
  if (!current) return null;

  if (dto.title?.trim()) {
    const conflict = getTemplateByTitle(dto.title, id);
    if (conflict) {
      throw new Error(JSON.stringify({ code: 'DUPLICATE', id: conflict.id, title: conflict.title }));
    }
  }

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE skill_templates SET title = ?, description = ?, icon = ?, icon_color = ?, skill_type = ?, resource_effect = ?, tags = ?, uses_limit = ?, uses_limit_type = ?, updated_at = ? WHERE id = ?'
  ).run(
    dto.title?.trim() ?? current.title,
    dto.description ?? current.description,
    dto.icon ?? current.icon,
    dto.iconColor ?? current.iconColor,
    dto.skillType ?? current.skillType,
    JSON.stringify(dto.resourceEffect !== undefined ? (dto.resourceEffect ?? []) : current.resourceEffect),
    JSON.stringify(dto.tags ?? current.tags),
    dto.usesLimit !== undefined ? dto.usesLimit : current.usesLimit,
    dto.usesLimitType !== undefined ? dto.usesLimitType : current.usesLimitType,
    now, id,
  );
  return getTemplateById(id);
}

export function deleteTemplate(id: string): boolean {
  const tpl = getTemplateById(id);
  if (!tpl) return false;
  db.prepare('DELETE FROM skill_templates WHERE id = ?').run(id);
  logHistory('skill_template:deleted', `Template "${tpl.title}" removido`, { templateId: id });
  return true;
}
