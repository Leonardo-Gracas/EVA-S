import db from '../database/db';
import { CharacterItem, ItemEffect, ItemType, AddCharacterItemDTO, UpdateCharacterItemDTO } from '../types';
import { v4 as uuidv4 } from 'uuid';

// Exportado: e a unica mapeadora correta de linha->CharacterItem (inclui icon/iconColor).
// characterService e campaignService tinham copias proprias que esqueciam esses dois campos —
// reusar esta remove a duplicacao e a divergencia.
export function rowToCharacterItem(row: any): CharacterItem {
  return {
    id: row.id,
    characterId: row.character_id,
    templateId: row.template_id ?? undefined,
    name: row.name,
    description: row.description,
    type: row.item_type,
    icon: row.icon ?? undefined,
    iconColor: row.icon_color ?? undefined,
    damage: row.damage ?? undefined,
    effects: row.effects ? JSON.parse(row.effects) : [],
    equipped: row.equipped === 1,
    quantity: row.quantity,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getItemsForCharacter(characterId: string): CharacterItem[] {
  return (db.prepare('SELECT * FROM character_items WHERE character_id = ? ORDER BY created_at ASC').all(characterId) as any[]).map(rowToCharacterItem);
}

export function getCharacterItemById(id: string): CharacterItem | null {
  const row = db.prepare('SELECT * FROM character_items WHERE id = ?').get(id) as any;
  return row ? rowToCharacterItem(row) : null;
}

// Unica fonte da lista de colunas do INSERT em `character_items` — reusada por addItemToCharacter
// aqui e por campaignService.importCampaign / multiCampaignService.createNewCampaign (copia entre
// campanhas). Antes esses dois tinham SQL INSERTs proprios que esqueciam icon/icon_color.
export interface CharacterItemInsertRow {
  id: string;
  characterId: string;
  templateId?: string | null;
  name: string;
  description: string;
  type: ItemType;
  icon?: string | null;
  iconColor?: string | null;
  damage?: string | null;
  effects: ItemEffect[];
  equipped: boolean;
  quantity: number;
  createdAt: string;
  updatedAt: string;
}

const INSERT_ITEM_SQL =
  'INSERT INTO character_items (id, character_id, template_id, name, description, item_type, icon, icon_color, damage, effects, equipped, quantity, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

export function insertCharacterItemRow(row: CharacterItemInsertRow): void {
  db.prepare(INSERT_ITEM_SQL).run(
    row.id, row.characterId, row.templateId ?? null, row.name, row.description, row.type,
    row.icon ?? null, row.iconColor ?? null, row.damage ?? null, JSON.stringify(row.effects ?? []),
    row.equipped ? 1 : 0, row.quantity, row.createdAt, row.updatedAt,
  );
}

export function addItemToCharacter(characterId: string, dto: AddCharacterItemDTO): CharacterItem {
  const now = new Date().toISOString();

  // For consumables, merge quantity with existing item of the same name
  if (dto.type === 'consumable') {
    const existing = db.prepare(
      'SELECT * FROM character_items WHERE character_id = ? AND item_type = ? AND name = ? LIMIT 1'
    ).get(characterId, 'consumable', dto.name) as any;
    if (existing) {
      const newQty = existing.quantity + (dto.quantity ?? 1);
      db.prepare('UPDATE character_items SET quantity = ?, updated_at = ? WHERE id = ?').run(newQty, now, existing.id);
      return getCharacterItemById(existing.id)!;
    }
  }

  const id = uuidv4();
  insertCharacterItemRow({
    id, characterId, templateId: dto.templateId ?? null, name: dto.name, description: dto.description ?? '',
    type: dto.type, icon: dto.icon ?? null, iconColor: dto.iconColor ?? null, damage: dto.damage ?? null,
    effects: dto.effects ?? [], equipped: false, quantity: dto.quantity ?? 1, createdAt: now, updatedAt: now,
  });
  return getCharacterItemById(id)!;
}

export function updateCharacterItem(id: string, dto: UpdateCharacterItemDTO): CharacterItem | null {
  const current = getCharacterItemById(id);
  if (!current) return null;

  // Weapons and vests can be equipped; consumables and specials cannot
  const targetEquipped = dto.equipped !== undefined ? dto.equipped : current.equipped;
  const type = dto.type ?? current.type;
  const equippable = type === 'weapon' || type === 'vest';
  const finalEquipped = equippable ? targetEquipped : false;

  const now = new Date().toISOString();
  db.prepare(
    'UPDATE character_items SET name = ?, description = ?, item_type = ?, icon = ?, icon_color = ?, damage = ?, effects = ?, equipped = ?, quantity = ?, updated_at = ? WHERE id = ?'
  ).run(
    dto.name ?? current.name,
    dto.description ?? current.description,
    type,
    dto.icon !== undefined ? (dto.icon ?? null) : (current.icon ?? null),
    dto.iconColor !== undefined ? (dto.iconColor ?? null) : (current.iconColor ?? null),
    dto.damage !== undefined ? (dto.damage ?? null) : (current.damage ?? null),
    JSON.stringify(dto.effects ?? current.effects),
    finalEquipped ? 1 : 0,
    dto.quantity ?? current.quantity,
    now, id,
  );
  return getCharacterItemById(id);
}

export function removeItemFromCharacter(id: string): boolean {
  const result = db.prepare('DELETE FROM character_items WHERE id = ?').run(id);
  return result.changes > 0;
}

/** Use a consumable: decrement quantity by `qty` (remove if reaches 0) */
export function useConsumable(id: string, qty: number = 1): { item: CharacterItem | null; consumed: boolean } {
  const item = getCharacterItemById(id);
  if (!item || item.type !== 'consumable') return { item, consumed: false };

  const newQty = item.quantity - qty;
  if (newQty <= 0) {
    db.prepare('DELETE FROM character_items WHERE id = ?').run(id);
    return { item: null, consumed: true };
  }
  const now = new Date().toISOString();
  db.prepare('UPDATE character_items SET quantity = ?, updated_at = ? WHERE id = ?').run(newQty, now, id);
  return { item: getCharacterItemById(id), consumed: true };
}
