import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import {
  SheetType, SheetConfig, CreateSheetTypeDTO, UpdateSheetTypeDTO, DEFAULT_SHEET_CONFIG, parseSheetConfig,
} from '../types';
import { logHistory } from './historyService';
import * as characterService from './characterService';

function rowToSheetType(row: any): SheetType {
  return {
    id: row.id,
    name: row.name,
    icon: row.icon,
    color: row.color,
    isDefault: row.is_default === 1,
    sortOrder: row.sort_order,
    config: parseSheetConfig(row.config),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSheetTypes(): SheetType[] {
  const rows = db.prepare('SELECT * FROM sheet_types ORDER BY sort_order ASC').all() as any[];
  return rows.map(rowToSheetType);
}

export function getSheetTypeById(id: string): SheetType | null {
  const row = db.prepare('SELECT * FROM sheet_types WHERE id = ?').get(id) as any;
  return row ? rowToSheetType(row) : null;
}

export function getDefaultSheetType(): SheetType {
  const row = db.prepare('SELECT * FROM sheet_types WHERE is_default = 1 LIMIT 1').get() as any;
  if (row) return rowToSheetType(row);
  const any = db.prepare('SELECT * FROM sheet_types LIMIT 1').get() as any;
  if (!any) throw new Error('Nenhum tipo de ficha configurado');
  return rowToSheetType(any);
}

function mergeConfig(base: SheetConfig, patch?: Partial<SheetConfig>): SheetConfig {
  return {
    attributes: patch?.attributes ?? base.attributes,
    resources: patch?.resources ?? base.resources,
    protections: patch?.protections ?? base.protections,
    conditions: patch?.conditions ?? base.conditions,
  };
}

export function createSheetType(dto: CreateSheetTypeDTO): SheetType {
  const id = uuidv4();
  const now = new Date().toISOString();
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as max FROM sheet_types').get() as any)?.max ?? -1;
  const config = mergeConfig(DEFAULT_SHEET_CONFIG, dto.config);
  db.prepare(
    'INSERT INTO sheet_types (id, name, icon, color, is_default, sort_order, config, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?)'
  ).run(id, dto.name, dto.icon ?? 'Scroll', dto.color ?? '#6366f1', maxOrder + 1, JSON.stringify(config), now, now);
  logHistory('sheetType:created', `Tipo de ficha "${dto.name}" criado`, { sheetTypeId: id });
  return getSheetTypeById(id)!;
}

export function updateSheetType(id: string, dto: UpdateSheetTypeDTO): SheetType {
  const current = getSheetTypeById(id);
  if (!current) throw new Error('Tipo de ficha nao encontrado');
  const now = new Date().toISOString();
  const newConfig = mergeConfig(current.config, dto.config);

  db.prepare('UPDATE sheet_types SET name = ?, icon = ?, color = ?, config = ?, updated_at = ? WHERE id = ?')
    .run(dto.name ?? current.name, dto.icon ?? current.icon, dto.color ?? current.color, JSON.stringify(newConfig), now, id);

  if (dto.config) {
    characterService.reconcileCharactersOfType(id, newConfig, current.config);
  }

  logHistory('sheetType:updated', `Tipo de ficha "${current.name}" atualizado`, { sheetTypeId: id });
  return getSheetTypeById(id)!;
}

export function setDefaultSheetType(id: string): SheetType[] {
  const target = getSheetTypeById(id);
  if (!target) throw new Error('Tipo de ficha nao encontrado');
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    db.prepare('UPDATE sheet_types SET is_default = 0, updated_at = ? WHERE is_default = 1').run(now);
    db.prepare('UPDATE sheet_types SET is_default = 1, updated_at = ? WHERE id = ?').run(now, id);
  });
  tx();
  logHistory('sheetType:updated', `Tipo de ficha "${target.name}" definido como padrao`, { sheetTypeId: id });
  return listSheetTypes();
}

export function reorderSheetTypes(orderedIds: string[]): SheetType[] {
  const update = db.prepare('UPDATE sheet_types SET sort_order = ?, updated_at = ? WHERE id = ?');
  const now = new Date().toISOString();
  const tx = db.transaction(() => {
    orderedIds.forEach((typeId, index) => update.run(index, now, typeId));
  });
  tx();
  return listSheetTypes();
}

export function duplicateSheetType(id: string): SheetType {
  const source = getSheetTypeById(id);
  if (!source) throw new Error('Tipo de ficha nao encontrado');
  return createSheetType({ name: `${source.name} (cópia)`, icon: source.icon, color: source.color, config: source.config });
}

export function deleteSheetType(id: string): SheetType[] {
  const all = listSheetTypes();
  if (all.length <= 1) throw new Error('A campanha precisa ter ao menos um tipo de ficha');
  const target = all.find((t) => t.id === id);
  if (!target) throw new Error('Tipo de ficha nao encontrado');

  // Personagens que usavam o tipo removido migram pro tipo padrao da campanha (ou pro proximo
  // disponivel, se o proprio tipo padrao for o que esta sendo removido), com seus recursos/
  // protecoes/condicoes reconciliados contra a config do tipo de destino.
  const fallback = all.find((t) => t.id !== id && t.isDefault) ?? all.find((t) => t.id !== id)!;

  const now = new Date().toISOString();
  const characterIds = (db.prepare('SELECT id FROM characters WHERE sheet_type_id = ?').all(id) as any[]).map((r) => r.id);

  const tx = db.transaction(() => {
    db.prepare('UPDATE characters SET sheet_type_id = ?, updated_at = ? WHERE sheet_type_id = ?').run(fallback.id, now, id);
    for (const characterId of characterIds) {
      characterService.reconcileCharacterToSheetType(characterId, fallback.config);
    }
    db.prepare('DELETE FROM sheet_types WHERE id = ?').run(id);
    if (target.isDefault) {
      db.prepare('UPDATE sheet_types SET is_default = 1, updated_at = ? WHERE id = ?').run(now, fallback.id);
    }
  });
  tx();

  logHistory('sheetType:deleted', `Tipo de ficha "${target.name}" removido`, { sheetTypeId: id });
  return listSheetTypes();
}
