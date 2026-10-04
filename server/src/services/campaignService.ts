import db from '../database/db';
import { v4 as uuidv4 } from 'uuid';
import {
  Campaign, UpdateCampaignDTO, ExportData, Player, Character,
  GlobalPermissions, DEFAULT_GLOBAL_PERMISSIONS,
  ItemTemplate, EffectTemplate, SkillTemplate, DEFAULT_DISPLACEMENT,
  GameMap, Grimorio, CampaignEvent, CampaignPlaylist, CampaignGoal, CombatSession,
  SheetType, DEFAULT_SHEET_CONFIG,
} from '../types';
import { logHistory } from './historyService';
import * as characterService from './characterService';
import * as characterItemService from './characterItemService';
import * as mapService from './mapService';
import * as grimorioService from './grimorioService';
import * as campaignExtrasService from './campaignExtrasService';
import * as combatService from './combatService';
import * as sheetTypeService from './sheetTypeService';

function rowToCampaign(row: any): Campaign {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    // Mesclado com os defaults: campanhas criadas antes de uma acao existir tem
    // um JSON sem essa chave, e sem o merge o painel do mestre mostraria a linha
    // sem nenhuma opcao marcada (e salvaria de volta o objeto incompleto).
    globalPermissions: {
      ...DEFAULT_GLOBAL_PERMISSIONS,
      ...(row.global_permissions ? JSON.parse(row.global_permissions) : {}),
    },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function getCampaign(): Campaign {
  const row = db.prepare('SELECT * FROM campaigns LIMIT 1').get();
  if (!row) throw new Error('Campanha nao encontrada');
  return rowToCampaign(row);
}

export function updateCampaign(dto: UpdateCampaignDTO): Campaign {
  const current = getCampaign();
  const now = new Date().toISOString();
  db.prepare('UPDATE campaigns SET name = ?, description = ?, updated_at = ? WHERE id = ?')
    .run(dto.name ?? current.name, dto.description ?? current.description, now, current.id);
  const updated = getCampaign();
  logHistory('campaign:updated', `Campanha "${updated.name}" atualizada`, {});
  return updated;
}

export function getGlobalPermissions(): GlobalPermissions {
  const campaign = getCampaign();
  return campaign.globalPermissions;
}

export function setGlobalPermissions(perms: GlobalPermissions): Campaign {
  const current = getCampaign();
  const now = new Date().toISOString();
  // Merge tambem na escrita: um cliente desatualizado que envie um objeto parcial
  // nao pode apagar as acoes que ele desconhece.
  const merged: GlobalPermissions = { ...DEFAULT_GLOBAL_PERMISSIONS, ...current.globalPermissions, ...perms };
  db.prepare('UPDATE campaigns SET global_permissions = ?, updated_at = ? WHERE id = ?')
    .run(JSON.stringify(merged), now, current.id);
  logHistory('campaign:updated', 'Permissoes globais atualizadas', {});
  return getCampaign();
}

export function exportCampaign(): ExportData {
  const campaign = getCampaign();
  const players = db.prepare('SELECT * FROM players').all() as any[];
  const characters = db.prepare('SELECT * FROM characters').all() as any[];
  const skills = db.prepare('SELECT * FROM skills').all() as any[];
  const allItems = db.prepare('SELECT * FROM character_items').all() as any[];
  const itemTemplateRows = db.prepare('SELECT * FROM item_templates ORDER BY name ASC').all() as any[];
  const effectTemplateRows = db.prepare('SELECT * FROM effect_templates ORDER BY name ASC').all() as any[];
  const skillTemplateRows = db.prepare('SELECT * FROM skill_templates ORDER BY title ASC').all() as any[];

  const mapItemTemplate = (row: any): ItemTemplate => ({
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
  });

  const mapEffectTemplate = (row: any): EffectTemplate => ({
    id: row.id,
    name: row.name,
    icon: row.icon,
    iconColor: row.icon_color,
    description: row.description,
    applications: row.applications ? JSON.parse(row.applications) : [],
    grimorioId: row.grimorio_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  const mapSkillTemplate = (row: any): SkillTemplate => ({
    id: row.id,
    title: row.title,
    description: row.description,
    icon: row.icon,
    iconColor: row.icon_color,
    skillType: (row.skill_type ?? 'passive') as 'active' | 'passive',
    resourceEffect: (() => {
      if (!row.resource_effect) return [];
      const p = JSON.parse(row.resource_effect);
      return Array.isArray(p) ? p : [p];
    })(),
    tags: row.tags ? JSON.parse(row.tags) : [],
    usesLimit: row.uses_limit ?? null,
    usesLimitType: row.uses_limit_type ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });

  // Reusa a mesma mapeadora linha->Character de characterService.getCharacterById — evita manter uma
  // segunda copia da logica de parse de resources/protections/conditions/etc so pra exportar em lote.
  const mapChar = (row: any): Character => characterService.rowToCharacter(
    row,
    skills.filter((s: any) => s.character_id === row.id).map(characterService.rowToSkill),
    allItems.filter((i: any) => i.character_id === row.id).map(characterItemService.rowToCharacterItem),
  );

  return {
    version: '1.2.0',
    exportedAt: new Date().toISOString(),
    campaign,
    players: players.map((p: any) => ({
      id: p.id, name: p.name, characterId: p.character_id,
      color: p.color, permission: p.permission, status: 'offline' as const,
      socketId: null, createdAt: p.created_at, updatedAt: p.updated_at,
    })),
    characters: characters.map(mapChar),
    itemTemplates: itemTemplateRows.map(mapItemTemplate),
    effectTemplates: effectTemplateRows.map(mapEffectTemplate),
    skillTemplates: skillTemplateRows.map(mapSkillTemplate),
    maps: mapService.getAllMaps(),
    grimorios: grimorioService.listGrimorios(),
    campaignEvents: campaignExtrasService.getAllEvents(),
    campaignPlaylists: campaignExtrasService.getAllPlaylists(),
    campaignGoals: campaignExtrasService.getAllGoals(),
    combatSessions: combatService.getAllSessions(),
    sheetTypes: sheetTypeService.listSheetTypes(),
  };
}

export function importCampaign(data: ExportData): void {
  const SQL_INSERT_PLAYER =
    'INSERT INTO players (id, name, character_id, color, permission, status, socket_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?)';

  const SQL_INSERT_ITEM_TEMPLATE =
    'INSERT INTO item_templates (id, name, description, item_type, icon, icon_color, damage, effects, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  // grimorio_id vai junto: e ele que marca um efeito como o CATALIZADOR de um
  // grimorio (o item que carrega esse efeito abre o grimorio na ficha, ver
  // InventoryItemRow). Sem essa coluna, cada troca de campanha transformava todo
  // catalizador num efeito comum e o item deixava de dar acesso ao grimorio.
  const SQL_INSERT_EFFECT_TEMPLATE =
    'INSERT INTO effect_templates (id, name, icon, icon_color, description, applications, grimorio_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_SKILL_TEMPLATE =
    'INSERT INTO skill_templates (id, title, description, icon, icon_color, skill_type, resource_effect, tags, uses_limit, uses_limit_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_MAP =
    'INSERT INTO maps (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)';

  const SQL_INSERT_GRIMORIO =
    'INSERT INTO grimorios (id, name, description, icon, icon_color, catalizador_effect_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_GRIMORIO_SPELL =
    'INSERT INTO grimorio_spells (id, grimorio_id, title, description, icon, icon_color, skill_type, resource_effect, tags, uses_limit, uses_limit_type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_EVENT =
    'INSERT INTO campaign_events (id, title, description, event_date, session_number, tags, happened, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_PLAYLIST =
    'INSERT INTO campaign_playlists (id, name, mood, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_TRACK =
    'INSERT INTO playlist_tracks (id, playlist_id, title, url, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_GOAL =
    'INSERT INTO campaign_goals (id, title, description, status, priority, character_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_COMBAT =
    'INSERT INTO combat_sessions (id, name, status, participants, current_index, global_turn, map_id, displacement_mode, map_visibility, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';

  const SQL_INSERT_SHEET_TYPE =
    'INSERT INTO sheet_types (id, name, icon, color, is_default, sort_order, config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

  const importFn = db.transaction(() => {
    const now = new Date().toISOString();

    db.prepare('DELETE FROM character_items').run();
    db.prepare('DELETE FROM skills').run();
    db.prepare('DELETE FROM characters').run();
    db.prepare('DELETE FROM players').run();
    db.prepare('DELETE FROM item_templates').run();
    db.prepare('DELETE FROM effect_templates').run();
    db.prepare('DELETE FROM skill_templates').run();
    db.prepare('DELETE FROM combat_sessions').run();
    db.prepare('DELETE FROM maps').run();
    db.prepare('DELETE FROM grimorio_spell_uses').run();
    db.prepare('DELETE FROM grimorio_spells').run();
    db.prepare('DELETE FROM grimorios').run();
    db.prepare('DELETE FROM playlist_tracks').run();
    db.prepare('DELETE FROM campaign_playlists').run();
    db.prepare('DELETE FROM campaign_events').run();
    db.prepare('DELETE FROM campaign_goals').run();
    db.prepare('DELETE FROM sheet_types').run();

    // Exports antigos (de antes de multi-ficha) guardavam a config em campaign.sheetConfig —
    // se nao vier `sheetTypes`, migra esse valor pra um unico tipo "Padrao" na importacao.
    const legacySheetConfig = (data.campaign as any)?.sheetConfig;
    const importedTypes: SheetType[] = (data.sheetTypes && data.sheetTypes.length > 0)
      ? data.sheetTypes
      : [{
          id: uuidv4(), name: 'Padrão', icon: 'Scroll', color: '#6366f1', isDefault: true, sortOrder: 0,
          config: legacySheetConfig ?? DEFAULT_SHEET_CONFIG, createdAt: now, updatedAt: now,
        }];
    for (const st of importedTypes) {
      db.prepare(SQL_INSERT_SHEET_TYPE).run(
        st.id, st.name, st.icon, st.color, st.isDefault ? 1 : 0, st.sortOrder, JSON.stringify(st.config), st.createdAt, now,
      );
    }
    const defaultImportedTypeId = importedTypes.find((t) => t.isDefault)?.id ?? importedTypes[0].id;

    for (const p of data.players) {
      db.prepare(SQL_INSERT_PLAYER)
        .run(p.id, p.name, p.characterId, p.color, p.permission, 'offline', p.createdAt, now);
    }

    for (const c of data.characters) {
      characterService.insertCharacterRow({
        id: c.id, name: c.name, type: c.type ?? 'pc', playerId: c.playerId, avatar: c.avatar,
        avatarPosition: c.avatarPosition ?? '50% 50%', description: c.description,
        sheetTypeId: (c as any).sheetTypeId ?? defaultImportedTypeId,
        resources: c.resources ?? {}, currentResources: c.currentResources ?? {},
        protections: c.protections ?? {}, conditions: c.conditions ?? {}, inspiration: c.inspiration ?? 0,
        playerPermissions: c.playerPermissions ?? {}, displacement: c.displacement ?? DEFAULT_DISPLACEMENT,
        attributes: c.attributes, createdAt: c.createdAt, updatedAt: now,
      });
      for (const s of c.skills) {
        characterService.insertSkillRow({
          id: s.id, characterId: c.id, icon: s.icon, iconColor: s.iconColor, title: s.title,
          description: s.description, visibility: s.visibility, skillType: s.skillType ?? 'passive',
          resourceEffect: s.resourceEffect ?? [], tags: s.tags ?? [], order: s.order,
          usesLimit: s.usesLimit ?? null, usesLimitType: s.usesLimitType ?? null,
          currentUses: s.currentUses ?? null, createdAt: s.createdAt, updatedAt: now,
        });
      }
      for (const item of (c.items ?? [])) {
        characterItemService.insertCharacterItemRow({
          id: item.id, characterId: c.id, templateId: item.templateId ?? null, name: item.name,
          description: item.description, type: item.type, icon: item.icon ?? null, iconColor: item.iconColor ?? null,
          damage: item.damage ?? null, effects: item.effects ?? [], equipped: item.equipped, quantity: item.quantity,
          createdAt: item.createdAt, updatedAt: now,
        });
      }
    }

    for (const t of (data.itemTemplates ?? [])) {
      db.prepare(SQL_INSERT_ITEM_TEMPLATE).run(
        t.id, t.name, t.description, t.type, t.icon ?? null, t.iconColor ?? null,
        t.damage ?? null, JSON.stringify(t.effects ?? []), t.createdAt, now,
      );
    }
    for (const e of (data.effectTemplates ?? [])) {
      db.prepare(SQL_INSERT_EFFECT_TEMPLATE).run(
        e.id, e.name, e.icon, e.iconColor, e.description,
        JSON.stringify(e.applications ?? []), e.grimorioId ?? null, e.createdAt, now,
      );
    }
    for (const st of (data.skillTemplates ?? [])) {
      db.prepare(SQL_INSERT_SKILL_TEMPLATE).run(
        st.id, st.title, st.description, st.icon, st.iconColor,
        st.skillType ?? 'passive',
        st.resourceEffect && st.resourceEffect.length ? JSON.stringify(st.resourceEffect) : null,
        JSON.stringify(st.tags ?? []),
        st.usesLimit ?? null,
        st.usesLimitType ?? null,
        st.createdAt, now,
      );
    }

    for (const m of (data.maps ?? [])) {
      db.prepare(SQL_INSERT_MAP).run(m.id, m.name, JSON.stringify({ nodes: m.nodes, paths: m.paths }), m.createdAt, now);
    }

    for (const g of (data.grimorios ?? [])) {
      db.prepare(SQL_INSERT_GRIMORIO).run(g.id, g.name, g.description, g.icon, g.iconColor, g.catalizadorEffectId, g.createdAt, now);
      for (const sp of g.spells) {
        db.prepare(SQL_INSERT_GRIMORIO_SPELL).run(
          sp.id, g.id, sp.title, sp.description, sp.icon, sp.iconColor, sp.skillType,
          sp.resourceEffect && sp.resourceEffect.length ? JSON.stringify(sp.resourceEffect) : null,
          JSON.stringify(sp.tags ?? []), sp.usesLimit ?? null, sp.usesLimitType ?? null,
          sp.sortOrder, sp.createdAt, now,
        );
      }
    }

    for (const ev of (data.campaignEvents ?? [])) {
      db.prepare(SQL_INSERT_EVENT).run(
        ev.id, ev.title, ev.description, ev.eventDate, ev.sessionNumber,
        JSON.stringify(ev.tags ?? []), ev.happened ? 1 : 0, ev.sortOrder, ev.createdAt, now,
      );
    }

    for (const pl of (data.campaignPlaylists ?? [])) {
      db.prepare(SQL_INSERT_PLAYLIST).run(pl.id, pl.name, pl.mood, pl.sortOrder, pl.createdAt, now);
      for (const tr of pl.tracks) {
        db.prepare(SQL_INSERT_TRACK).run(tr.id, pl.id, tr.title, tr.url, tr.sortOrder, tr.createdAt, now);
      }
    }

    for (const gl of (data.campaignGoals ?? [])) {
      db.prepare(SQL_INSERT_GOAL).run(
        gl.id, gl.title, gl.description, gl.status, gl.priority, gl.characterId, gl.sortOrder, gl.createdAt, now,
      );
    }

    for (const cs of (data.combatSessions ?? [])) {
      db.prepare(SQL_INSERT_COMBAT).run(
        cs.id, cs.name, cs.status, JSON.stringify(cs.participants), cs.currentIndex, cs.globalTurn,
        cs.mapId, cs.displacementMode, cs.mapVisibility, cs.createdAt, now,
      );
    }

    const gpJson = data.campaign.globalPermissions
      ? JSON.stringify(data.campaign.globalPermissions)
      : null;
    db.prepare('UPDATE campaigns SET name = ?, description = ?, global_permissions = COALESCE(?, global_permissions), updated_at = ?')
      .run(data.campaign.name, data.campaign.description, gpJson, now);
  });

  importFn();
  logHistory('campaign:imported', 'Campanha importada', {});
}
