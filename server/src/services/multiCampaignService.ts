import { v4 as uuidv4 } from 'uuid';
import db from '../database/db';
import {
  SavedCampaignSummary, CreateNewCampaignDTO, ExportData, DEFAULT_SHEET_CONFIG, DEFAULT_DISPLACEMENT,
  ChangeCampaignPasswordDTO, CampaignAuthResult,
} from '../types';
import { logHistory } from './historyService';
import { exportCampaign, importCampaign } from './campaignService';
import * as characterService from './characterService';
import * as characterItemService from './characterItemService';
import { hashPassword, verifyPassword } from '../utils/password';
import { verifyAdminPassword } from './adminService';

function rowToSummary(row: any): SavedCampaignSummary {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isCurrent: row.is_current === 1,
    hasPassword: !!row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listSavedCampaigns(): SavedCampaignSummary[] {
  const rows = db.prepare(
    'SELECT id, name, description, is_current, password_hash, created_at, updated_at FROM saved_campaigns ORDER BY updated_at DESC'
  ).all() as any[];
  return rows.map(rowToSummary);
}

export function createNewCampaign(dto: CreateNewCampaignDTO): SavedCampaignSummary[] {
  const now = new Date().toISOString();
  const exported = exportCampaign();

  const SQL_MAP = 'INSERT INTO maps (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)';
  const SQL_GRIMORIO = 'INSERT INTO grimorios (id, name, description, icon, icon_color, catalizador_effect_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
  const SQL_GRIMORIO_SPELL = 'INSERT INTO grimorio_spells (id, grimorio_id, title, description, icon, icon_color, skill_type, resource_effect, tags, uses_limit, uses_limit_type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const SQL_EVENT = 'INSERT INTO campaign_events (id, title, description, event_date, session_number, tags, happened, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
  const SQL_PLAYLIST = 'INSERT INTO campaign_playlists (id, name, mood, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)';
  const SQL_TRACK = 'INSERT INTO playlist_tracks (id, playlist_id, title, url, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)';
  const SQL_GOAL = 'INSERT INTO campaign_goals (id, title, description, status, priority, character_id, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';

  // Copiar um grimorio sem copiar seu efeito catalizador o deixaria quebrado
  // (referencia um effect_template inexistente) — forca a dependencia aqui
  // tambem, nao so na validacao da UI.
  const copyEffectTemplates = dto.copy.effectTemplates || dto.copy.grimorios;

  const tx = db.transaction(() => {
    if (dto.saveCurrent) {
      const existing = db.prepare('SELECT id FROM saved_campaigns WHERE is_current = 1 LIMIT 1').get() as any;
      const snapshotJson = JSON.stringify(exported);
      if (existing) {
        db.prepare('UPDATE saved_campaigns SET name = ?, description = ?, snapshot = ?, is_current = 0, updated_at = ? WHERE id = ?')
          .run(exported.campaign.name, exported.campaign.description, snapshotJson, now, existing.id);
      } else {
        db.prepare('INSERT INTO saved_campaigns (id, name, description, snapshot, is_current, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
          .run(uuidv4(), exported.campaign.name, exported.campaign.description, snapshotJson, now, now);
      }
    } else {
      db.prepare('UPDATE saved_campaigns SET is_current = 0 WHERE is_current = 1').run();
    }

    db.prepare('DELETE FROM character_items').run();
    db.prepare('DELETE FROM skills').run();
    db.prepare('DELETE FROM characters').run();
    db.prepare('DELETE FROM players').run();
    db.prepare('DELETE FROM item_templates').run();
    db.prepare('DELETE FROM effect_templates').run();
    db.prepare('DELETE FROM skill_templates').run();
    // Combate nunca e copiado — toda campanha nova comeca sem combate ativo.
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

    // Cada campanha nova comeca com um unico tipo de ficha "Padrao" — configuracao de
    // atributos/recursos/protecoes e o primeiro passo de cada campanha, nao herda os
    // tipos de ficha customizados que a campanha anterior tinha montado.
    const newDefaultSheetTypeId = uuidv4();
    db.prepare(
      'INSERT INTO sheet_types (id, name, icon, color, is_default, sort_order, config, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?)'
    ).run(newDefaultSheetTypeId, 'Padrão', 'Scroll', '#6366f1', JSON.stringify(DEFAULT_SHEET_CONFIG), now, now);

    if (copyEffectTemplates) {
      for (const e of (exported.effectTemplates ?? [])) {
        // grimorio_id so sobrevive se o grimorio dono tambem esta sendo copiado —
        // senao o efeito viraria um catalizador apontando pra um grimorio inexistente.
        const grimorioId = dto.copy.grimorios ? (e.grimorioId ?? null) : null;
        db.prepare('INSERT INTO effect_templates (id, name, icon, icon_color, description, applications, grimorio_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(e.id, e.name, e.icon, e.iconColor, e.description, JSON.stringify(e.applications ?? []), grimorioId, e.createdAt, now);
      }
    }

    if (dto.copy.itemTemplates) {
      for (const t of (exported.itemTemplates ?? [])) {
        db.prepare('INSERT INTO item_templates (id, name, description, item_type, icon, icon_color, damage, effects, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(t.id, t.name, t.description, t.type, t.icon ?? null, t.iconColor ?? null, t.damage ?? null, JSON.stringify(t.effects ?? []), t.createdAt, now);
      }
    }

    if (dto.copy.skillTemplates) {
      for (const st of (exported.skillTemplates ?? [])) {
        db.prepare('INSERT INTO skill_templates (id, title, description, icon, icon_color, skill_type, resource_effect, tags, uses_limit, uses_limit_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
          .run(st.id, st.title, st.description, st.icon, st.iconColor, st.skillType ?? 'passive',
            st.resourceEffect && st.resourceEffect.length ? JSON.stringify(st.resourceEffect) : null,
            JSON.stringify(st.tags ?? []), st.usesLimit ?? null, st.usesLimitType ?? null, st.createdAt, now);
      }
    }

    const copyCharacter = (c: ExportData['characters'][number], type: 'pc' | 'npc') => {
      characterService.insertCharacterRow({
        id: c.id, name: c.name, type, playerId: null, avatar: c.avatar,
        avatarPosition: c.avatarPosition ?? '50% 50%', description: c.description,
        // Personagens copiados sempre usam o tipo de ficha padrao novo — o `sheetTypeId` antigo
        // aponta pra um tipo que so existia na campanha de origem.
        sheetTypeId: newDefaultSheetTypeId,
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
    };

    if (dto.copy.npcs) {
      for (const c of exported.characters.filter(c => c.type === 'npc')) copyCharacter(c, 'npc');
    }

    if (dto.copy.characters) {
      for (const c of exported.characters.filter(c => c.type === 'pc')) copyCharacter(c, 'pc');
    }

    if (dto.copy.maps) {
      for (const m of (exported.maps ?? [])) {
        db.prepare(SQL_MAP).run(m.id, m.name, JSON.stringify({ nodes: m.nodes, paths: m.paths }), m.createdAt, now);
      }
    }

    if (dto.copy.grimorios) {
      for (const g of (exported.grimorios ?? [])) {
        db.prepare(SQL_GRIMORIO).run(g.id, g.name, g.description, g.icon, g.iconColor, g.catalizadorEffectId, g.createdAt, now);
        for (const sp of g.spells) {
          db.prepare(SQL_GRIMORIO_SPELL).run(
            sp.id, g.id, sp.title, sp.description, sp.icon, sp.iconColor, sp.skillType,
            sp.resourceEffect && sp.resourceEffect.length ? JSON.stringify(sp.resourceEffect) : null,
            JSON.stringify(sp.tags ?? []), sp.usesLimit ?? null, sp.usesLimitType ?? null,
            sp.sortOrder, sp.createdAt, now,
          );
        }
      }
    }

    if (dto.copy.events) {
      for (const ev of (exported.campaignEvents ?? [])) {
        db.prepare(SQL_EVENT).run(
          ev.id, ev.title, ev.description, ev.eventDate, ev.sessionNumber,
          JSON.stringify(ev.tags ?? []), ev.happened ? 1 : 0, ev.sortOrder, ev.createdAt, now,
        );
      }
    }

    if (dto.copy.playlists) {
      for (const pl of (exported.campaignPlaylists ?? [])) {
        db.prepare(SQL_PLAYLIST).run(pl.id, pl.name, pl.mood, pl.sortOrder, pl.createdAt, now);
        for (const tr of pl.tracks) {
          db.prepare(SQL_TRACK).run(tr.id, pl.id, tr.title, tr.url, tr.sortOrder, tr.createdAt, now);
        }
      }
    }

    if (dto.copy.goals) {
      for (const gl of (exported.campaignGoals ?? [])) {
        const characterId = dto.copy.characters ? gl.characterId : null;
        db.prepare(SQL_GOAL).run(
          gl.id, gl.title, gl.description, gl.status, gl.priority, characterId, gl.sortOrder, gl.createdAt, now,
        );
      }
    }

    db.prepare('UPDATE campaigns SET name = ?, description = ?, updated_at = ? WHERE id = (SELECT id FROM campaigns LIMIT 1)')
      .run(dto.name, dto.description ?? '', now);

    db.prepare('INSERT INTO saved_campaigns (id, name, description, snapshot, is_current, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)')
      .run(uuidv4(), dto.name, dto.description ?? '', '{}', hashPassword(dto.password), now, now);
  });

  tx();
  logHistory('campaign:new', `Nova campanha "${dto.name}" criada`, {});
  return listSavedCampaigns();
}

export function authenticateCampaign(id: string, password: string): CampaignAuthResult {
  const row = db.prepare('SELECT * FROM saved_campaigns WHERE id = ?').get(id) as any;
  if (!row) throw new Error('Campanha nao encontrada');

  const matchesOwnPassword = verifyPassword(password, row.password_hash);
  const isAdminOverride = !matchesOwnPassword && verifyAdminPassword(password);
  if (!matchesOwnPassword && !isAdminOverride) throw new Error('Senha incorreta');

  if (row.is_current !== 1) {
    switchCampaign(id, true);
  }

  return { campaigns: listSavedCampaigns(), isAdminOverride };
}

export function changeCampaignPassword(id: string, dto: ChangeCampaignPasswordDTO): SavedCampaignSummary {
  const row = db.prepare('SELECT * FROM saved_campaigns WHERE id = ?').get(id) as any;
  if (!row) throw new Error('Campanha nao encontrada');

  // Campanha sem senha nao tem "senha atual" pra conferir; definir a primeira senha
  // fica liberado porque a rota ja exige sessao de mestre valida (requireGmAuth).
  const okCurrent = !row.password_hash
    || (dto.currentPassword !== undefined && verifyPassword(dto.currentPassword, row.password_hash));
  const okAdmin = !!dto.adminPassword && verifyAdminPassword(dto.adminPassword);
  if (!okCurrent && !okAdmin) throw new Error('Senha atual incorreta');

  const now = new Date().toISOString();
  db.prepare('UPDATE saved_campaigns SET password_hash = ?, updated_at = ? WHERE id = ?')
    .run(hashPassword(dto.newPassword), now, id);
  logHistory('campaign:password_changed', 'Senha da campanha alterada', {});

  const updated = db.prepare('SELECT * FROM saved_campaigns WHERE id = ?').get(id);
  return rowToSummary(updated);
}

export function switchCampaign(id: string, saveCurrent: boolean): SavedCampaignSummary[] {
  const target = db.prepare('SELECT * FROM saved_campaigns WHERE id = ?').get(id) as any;
  if (!target) throw new Error('Campanha nao encontrada');

  const now = new Date().toISOString();
  const exported = exportCampaign();

  if (saveCurrent) {
    const existing = db.prepare('SELECT id FROM saved_campaigns WHERE is_current = 1 LIMIT 1').get() as any;
    const snapshotJson = JSON.stringify(exported);
    if (existing) {
      db.prepare('UPDATE saved_campaigns SET name = ?, description = ?, snapshot = ?, is_current = 0, updated_at = ? WHERE id = ?')
        .run(exported.campaign.name, exported.campaign.description, snapshotJson, now, existing.id);
    } else {
      db.prepare('INSERT INTO saved_campaigns (id, name, description, snapshot, is_current, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)')
        .run(uuidv4(), exported.campaign.name, exported.campaign.description, snapshotJson, now, now);
    }
  } else {
    db.prepare('UPDATE saved_campaigns SET is_current = 0 WHERE is_current = 1').run();
  }

  const snapshot: ExportData = JSON.parse(target.snapshot);
  importCampaign(snapshot);

  db.prepare('UPDATE saved_campaigns SET is_current = 0').run();
  db.prepare('UPDATE saved_campaigns SET is_current = 1, updated_at = ? WHERE id = ?').run(now, id);

  logHistory('campaign:switch', `Alternado para campanha "${target.name}"`, {});
  return listSavedCampaigns();
}

export function deleteSavedCampaign(id: string): SavedCampaignSummary[] {
  const target = db.prepare('SELECT is_current FROM saved_campaigns WHERE id = ?').get(id) as any;
  if (!target) throw new Error('Campanha nao encontrada');
  if (target.is_current === 1) throw new Error('Nao e possivel deletar a campanha ativa');
  db.prepare('DELETE FROM saved_campaigns WHERE id = ?').run(id);
  return listSavedCampaigns();
}
