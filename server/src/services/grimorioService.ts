import { v4 as uuidv4 } from 'uuid';
import db from '../database/db';
import {
  Grimorio, GrimorioSpell,
  CreateGrimorioDTO, UpdateGrimorioDTO,
  CreateGrimorioSpellDTO, UpdateGrimorioSpellDTO,
  ResourceEffect, Character, resourceMaxStat,
} from '../types';
import { logHistory } from './historyService';
import { getAllCharacters, getCharacterById, updateCharacter } from './characterService';
import { getEquippedBonus } from '../utils/equippedEffects';

// ── Mappers ───────────────────────────────────────────────────────────────────

function rowToSpell(row: any): GrimorioSpell {
  return {
    id: row.id,
    grimorioId: row.grimorio_id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    iconColor: row.icon_color,
    skillType: row.skill_type ?? 'active',
    resourceEffect: (() => {
      if (!row.resource_effect) return [];
      const p = JSON.parse(row.resource_effect);
      return Array.isArray(p) ? p : [p];
    })(),
    tags: row.tags ? JSON.parse(row.tags) : [],
    usesLimit: row.uses_limit ?? null,
    usesLimitType: row.uses_limit_type ?? null,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToGrimorio(row: any, spells: GrimorioSpell[]): Grimorio {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    icon: row.icon,
    iconColor: row.icon_color,
    catalizadorEffectId: row.catalizador_effect_id ?? null,
    catalizadorEffectName: row.effect_name ?? null,
    spells,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const GRIMORIO_SELECT = `
  SELECT g.*, et.name as effect_name
  FROM grimorios g
  LEFT JOIN effect_templates et ON et.id = g.catalizador_effect_id
`;

// ── Queries ───────────────────────────────────────────────────────────────────

export function listGrimorios(): Grimorio[] {
  const rows = db.prepare(`${GRIMORIO_SELECT} ORDER BY g.name ASC`).all() as any[];
  const spellRows = db.prepare('SELECT * FROM grimorio_spells ORDER BY sort_order ASC, title ASC').all() as any[];
  return rows.map((row) => {
    const spells = spellRows.filter((s) => s.grimorio_id === row.id).map(rowToSpell);
    return rowToGrimorio(row, spells);
  });
}

export function getGrimorio(id: string): Grimorio {
  const row = db.prepare(`${GRIMORIO_SELECT} WHERE g.id = ?`).get(id) as any;
  if (!row) throw new Error('Grimório não encontrado');
  const spells = (db.prepare('SELECT * FROM grimorio_spells WHERE grimorio_id = ? ORDER BY sort_order ASC, title ASC').all(id) as any[]).map(rowToSpell);
  return rowToGrimorio(row, spells);
}

// ── Grimório CRUD ─────────────────────────────────────────────────────────────

export function createGrimorio(dto: CreateGrimorioDTO): Grimorio {
  const id = uuidv4();
  const effectId = uuidv4();
  const now = new Date().toISOString();
  const icon = dto.icon ?? 'BookOpen';
  const iconColor = dto.iconColor ?? '#6366f1';

  const effectName = dto.effectName?.trim() || `Catalizador ${dto.name}`;

  const tx = db.transaction(() => {
    db.prepare('INSERT INTO grimorios (id, name, description, icon, icon_color, catalizador_effect_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(id, dto.name, dto.description ?? '', icon, iconColor, effectId, now, now);

    db.prepare('INSERT INTO effect_templates (id, name, icon, icon_color, description, applications, grimorio_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(effectId, effectName, 'BookOpen', iconColor, `Permite acesso ao Grimório ${dto.name}`, '[]', id, now, now);
  });
  tx();

  logHistory('grimorio:created', `Grimório "${dto.name}" criado`, {});
  return getGrimorio(id);
}

export function updateGrimorio(id: string, dto: UpdateGrimorioDTO): Grimorio {
  const current = getGrimorio(id);
  const now = new Date().toISOString();
  const newName = dto.name ?? current.name;
  const newIcon = dto.icon ?? current.icon;
  const newColor = dto.iconColor ?? current.iconColor;

  const tx = db.transaction(() => {
    db.prepare('UPDATE grimorios SET name = ?, description = ?, icon = ?, icon_color = ?, updated_at = ? WHERE id = ?')
      .run(newName, dto.description ?? current.description, newIcon, newColor, now, id);

    if (current.catalizadorEffectId) {
      const effectName = dto.effectName?.trim() || current.catalizadorEffectName || `Catalizador ${newName}`;
      db.prepare('UPDATE effect_templates SET name = ?, icon_color = ?, description = ?, updated_at = ? WHERE id = ?')
        .run(effectName, newColor, `Permite acesso ao Grimório ${newName}`, now, current.catalizadorEffectId);
    }
  });
  tx();

  logHistory('grimorio:updated', `Grimório "${newName}" atualizado`, {});
  return getGrimorio(id);
}

export function deleteGrimorio(id: string): void {
  const current = getGrimorio(id);
  const tx = db.transaction(() => {
    if (current.catalizadorEffectId) {
      db.prepare('DELETE FROM effect_templates WHERE id = ?').run(current.catalizadorEffectId);
    }
    db.prepare('DELETE FROM grimorios WHERE id = ?').run(id);
  });
  tx();
  logHistory('grimorio:deleted', `Grimório "${current.name}" removido`, {});
}

// ── Spell CRUD ────────────────────────────────────────────────────────────────

export function createSpell(grimorioId: string, dto: CreateGrimorioSpellDTO): Grimorio {
  const id = uuidv4();
  const now = new Date().toISOString();
  const maxOrder = (db.prepare('SELECT MAX(sort_order) as m FROM grimorio_spells WHERE grimorio_id = ?').get(grimorioId) as any)?.m ?? -1;

  db.prepare('INSERT INTO grimorio_spells (id, grimorio_id, title, description, icon, icon_color, skill_type, resource_effect, tags, uses_limit, uses_limit_type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, grimorioId, dto.title, dto.description ?? '', dto.icon ?? 'Star', dto.iconColor ?? '#6366f1',
      dto.skillType ?? 'active',
      dto.resourceEffect && dto.resourceEffect.length ? JSON.stringify(dto.resourceEffect) : null,
      JSON.stringify(dto.tags ?? []),
      dto.usesLimit ?? null, dto.usesLimitType ?? null,
      maxOrder + 1, now, now);

  return getGrimorio(grimorioId);
}

export function updateSpell(spellId: string, dto: UpdateGrimorioSpellDTO): Grimorio {
  const row = db.prepare('SELECT * FROM grimorio_spells WHERE id = ?').get(spellId) as any;
  if (!row) throw new Error('Feitiço não encontrado');
  const now = new Date().toISOString();

  db.prepare('UPDATE grimorio_spells SET title = ?, description = ?, icon = ?, icon_color = ?, skill_type = ?, resource_effect = ?, tags = ?, uses_limit = ?, uses_limit_type = ?, updated_at = ? WHERE id = ?')
    .run(
      dto.title ?? row.title,
      dto.description ?? row.description,
      dto.icon ?? row.icon,
      dto.iconColor ?? row.icon_color,
      dto.skillType ?? row.skill_type,
      dto.resourceEffect !== undefined
        ? (dto.resourceEffect.length ? JSON.stringify(dto.resourceEffect) : null)
        : row.resource_effect,
      JSON.stringify(dto.tags ?? (row.tags ? JSON.parse(row.tags) : [])),
      dto.usesLimit !== undefined ? dto.usesLimit : row.uses_limit,
      dto.usesLimitType !== undefined ? dto.usesLimitType : row.uses_limit_type,
      now, spellId,
    );

  return getGrimorio(row.grimorio_id);
}

export function deleteSpell(spellId: string): Grimorio {
  const row = db.prepare('SELECT grimorio_id FROM grimorio_spells WHERE id = ?').get(spellId) as any;
  if (!row) throw new Error('Feitiço não encontrado');
  db.prepare('DELETE FROM grimorio_spells WHERE id = ?').run(spellId);
  return getGrimorio(row.grimorio_id);
}

// ── Uses tracking ─────────────────────────────────────────────────────────────

export function getSpellUsesForCharacter(characterId: string): Record<string, number> {
  const rows = db.prepare('SELECT spell_id, current_uses FROM grimorio_spell_uses WHERE character_id = ?').all(characterId) as any[];
  const map: Record<string, number> = {};
  for (const row of rows) map[row.spell_id] = row.current_uses;
  return map;
}

export function restCharacterSpells(characterId: string): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE grimorio_spell_uses
    SET current_uses = (SELECT uses_limit FROM grimorio_spells WHERE id = spell_id), updated_at = ?
    WHERE character_id = ?
    AND spell_id IN (SELECT id FROM grimorio_spells WHERE uses_limit_type = 'rest')
  `).run(now, characterId);
}

export function resetCombatSpellsForAll(): void {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE grimorio_spell_uses
    SET current_uses = (SELECT uses_limit FROM grimorio_spells WHERE id = spell_id), updated_at = ?
    WHERE spell_id IN (SELECT id FROM grimorio_spells WHERE uses_limit_type = 'combat')
  `).run(now);
}

// ── Casting ───────────────────────────────────────────────────────────────────

export function castSpell(spellId: string, characterId: string): Character {
  const spellRow = db.prepare('SELECT * FROM grimorio_spells WHERE id = ?').get(spellId) as any;
  if (!spellRow) throw new Error('Feitiço não encontrado');

  const charRow = db.prepare('SELECT * FROM characters WHERE id = ?').get(characterId) as any;
  if (!charRow) throw new Error('Personagem não encontrado');

  // Check (but don't yet consume) uses limit — a failed cast must not burn a use
  let currentUses: number | null = null;
  if (spellRow.uses_limit !== null) {
    const usesRow = db.prepare('SELECT current_uses FROM grimorio_spell_uses WHERE spell_id = ? AND character_id = ?')
      .get(spellId, characterId) as any;
    currentUses = usesRow?.current_uses ?? spellRow.uses_limit;
    if (currentUses! <= 0) throw new Error(`Usos de "${spellRow.title}" esgotados. Descanse para recuperar.`);
  }

  const effects: ResourceEffect[] = spellRow.resource_effect ? JSON.parse(spellRow.resource_effect) : [];
  const character = getCharacterById(characterId)!;
  const current = { ...character.currentResources };

  // Validate every cost can be paid in full before mutating anything
  if (Array.isArray(effects)) {
    for (const fx of effects) {
      if (fx.direction !== 'cost') continue;
      const available = current[fx.resource] ?? 0;
      if (available < fx.amount) {
        throw new Error(`Recursos insuficientes para conjurar "${spellRow.title}".`);
      }
    }
  }

  // All checks passed — now consume the use and apply resource deltas
  if (spellRow.uses_limit !== null) {
    const now = new Date().toISOString();
    db.prepare('INSERT INTO grimorio_spell_uses (spell_id, character_id, current_uses, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(spell_id, character_id) DO UPDATE SET current_uses = ?, updated_at = ?')
      .run(spellId, characterId, currentUses! - 1, now, currentUses! - 1, now);
  }

  if (!Array.isArray(effects) || effects.length === 0) {
    logHistory('spell:cast', `${charRow.name} conjurou "${spellRow.title}"`, {});
    return getAllCharacters().find((c: Character) => c.id === characterId)!;
  }

  for (const fx of effects) {
    const delta = fx.direction === 'gain' ? fx.amount : -fx.amount;
    const max = (character.resources[fx.resource] ?? 0) + getEquippedBonus(character.items, resourceMaxStat(fx.resource));
    current[fx.resource] = Math.min(max, Math.max(0, (current[fx.resource] ?? 0) + delta));
  }

  updateCharacter(characterId, { currentResources: current });

  const costDesc = effects.map(fx => `${fx.direction === 'gain' ? '+' : '-'}${fx.amount} ${fx.resource}`).join(', ');
  logHistory('spell:cast', `${charRow.name} conjurou "${spellRow.title}" (${costDesc})`, {});

  return getAllCharacters().find((c: Character) => c.id === characterId)!;
}
