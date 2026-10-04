import db from './db';
import { v4 as uuidv4 } from 'uuid';
import fs from 'fs';
import path from 'path';
import { DEFAULT_SHEET_CONFIG, DEFAULT_DISPLACEMENT, parseSheetConfig } from '../types';

export function runMigrations(): void {
  const uploadsDir = path.join(process.cwd(), 'data', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Nova Campanha',
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS players (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      character_id TEXT,
      color TEXT NOT NULL DEFAULT '#6366f1',
      permission TEXT NOT NULL DEFAULT 'player' CHECK(permission IN ('player', 'gm')),
      status TEXT NOT NULL DEFAULT 'offline' CHECK(status IN ('online', 'offline')),
      socket_id TEXT,
      password_hash TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS characters (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      character_type TEXT NOT NULL DEFAULT 'pc',
      player_id TEXT,
      avatar TEXT,
      description TEXT NOT NULL DEFAULT '',
      health INTEGER NOT NULL DEFAULT 20,
      sanity INTEGER NOT NULL DEFAULT 25,
      exposure INTEGER NOT NULL DEFAULT 25,
      current_health INTEGER NOT NULL DEFAULT -1,
      current_sanity INTEGER NOT NULL DEFAULT -1,
      current_exposure INTEGER NOT NULL DEFAULT -1,
      avatar_position TEXT NOT NULL DEFAULT '50% 50%',
      attributes TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Star',
      icon_color TEXT NOT NULL DEFAULT '#6366f1',
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private', 'public')),
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS history (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      metadata TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );
  `);

  const safeAdd = (sql: string) => { try { db.exec(sql); } catch {} };
  safeAdd(`ALTER TABLE characters ADD COLUMN current_health INTEGER NOT NULL DEFAULT -1`);
  safeAdd(`ALTER TABLE characters ADD COLUMN current_sanity INTEGER NOT NULL DEFAULT -1`);
  safeAdd(`ALTER TABLE characters ADD COLUMN current_exposure INTEGER NOT NULL DEFAULT -1`);
  safeAdd(`ALTER TABLE characters ADD COLUMN avatar_position TEXT NOT NULL DEFAULT '50% 50%'`);
  safeAdd(`ALTER TABLE characters ADD COLUMN character_type TEXT NOT NULL DEFAULT 'pc'`);
  safeAdd(`ALTER TABLE players ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`);
  safeAdd(`ALTER TABLE skills ADD COLUMN skill_type TEXT NOT NULL DEFAULT 'passive'`);
  safeAdd(`ALTER TABLE skills ADD COLUMN resource_effect TEXT DEFAULT NULL`);
  safeAdd(`ALTER TABLE skills ADD COLUMN tags TEXT NOT NULL DEFAULT '[]'`);
  safeAdd(`ALTER TABLE characters ADD COLUMN protections TEXT NOT NULL DEFAULT '{"physical":0,"mental":0,"ethereal":0}'`);
  safeAdd(`ALTER TABLE characters ADD COLUMN player_permissions TEXT NOT NULL DEFAULT '{}'`);
  safeAdd(`ALTER TABLE characters ADD COLUMN displacement REAL NOT NULL DEFAULT ${DEFAULT_DISPLACEMENT}`);
  safeAdd(`ALTER TABLE combat_sessions ADD COLUMN map_id TEXT`);
  safeAdd(`ALTER TABLE combat_sessions ADD COLUMN displacement_mode TEXT NOT NULL DEFAULT 'rule'`);
  safeAdd(`ALTER TABLE combat_sessions ADD COLUMN map_visibility INTEGER NOT NULL DEFAULT 4`);
  safeAdd(`ALTER TABLE item_templates ADD COLUMN icon TEXT NOT NULL DEFAULT 'Star'`);
  safeAdd(`ALTER TABLE item_templates ADD COLUMN icon_color TEXT NOT NULL DEFAULT '#6366f1'`);
  safeAdd(`ALTER TABLE campaigns ADD COLUMN global_permissions TEXT`);
  safeAdd(`ALTER TABLE skills ADD COLUMN uses_limit INTEGER DEFAULT NULL`);
  safeAdd(`ALTER TABLE skills ADD COLUMN uses_limit_type TEXT DEFAULT NULL`);
  safeAdd(`ALTER TABLE skills ADD COLUMN current_uses INTEGER DEFAULT NULL`);
  safeAdd(`ALTER TABLE skill_templates ADD COLUMN uses_limit INTEGER DEFAULT NULL`);
  safeAdd(`ALTER TABLE skill_templates ADD COLUMN uses_limit_type TEXT DEFAULT NULL`);
  safeAdd(`ALTER TABLE character_items ADD COLUMN icon TEXT`);
  safeAdd(`ALTER TABLE character_items ADD COLUMN icon_color TEXT`);
  safeAdd(`ALTER TABLE campaigns ADD COLUMN sheet_config TEXT`);
  safeAdd(`ALTER TABLE characters ADD COLUMN resources TEXT`);
  safeAdd(`ALTER TABLE characters ADD COLUMN current_resources TEXT`);
  safeAdd(`ALTER TABLE characters ADD COLUMN inspiration INTEGER NOT NULL DEFAULT 0`);
  safeAdd(`ALTER TABLE characters ADD COLUMN conditions TEXT NOT NULL DEFAULT '{}'`);
  safeAdd(`ALTER TABLE characters ADD COLUMN sheet_type_id TEXT`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS sheet_types (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Ficha',
      icon TEXT NOT NULL DEFAULT 'Scroll',
      color TEXT NOT NULL DEFAULT '#6366f1',
      is_default INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      config TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS skill_templates (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'Star',
      icon_color TEXT NOT NULL DEFAULT '#6366f1',
      skill_type TEXT NOT NULL DEFAULT 'passive',
      resource_effect TEXT DEFAULT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS effect_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      icon TEXT NOT NULL DEFAULT 'Zap',
      icon_color TEXT NOT NULL DEFAULT '#6366f1',
      description TEXT NOT NULL DEFAULT '',
      applications TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS item_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      item_type TEXT NOT NULL DEFAULT 'special',
      icon TEXT NOT NULL DEFAULT 'Star',
      icon_color TEXT NOT NULL DEFAULT '#6366f1',
      damage TEXT DEFAULT NULL,
      effects TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS character_items (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      template_id TEXT DEFAULT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      item_type TEXT NOT NULL DEFAULT 'special',
      damage TEXT DEFAULT NULL,
      effects TEXT NOT NULL DEFAULT '[]',
      equipped INTEGER NOT NULL DEFAULT 0,
      quantity INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS character_requests (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      player_id TEXT NOT NULL,
      player_name TEXT NOT NULL,
      type TEXT NOT NULL,
      description TEXT NOT NULL,
      payload TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );
  `);

  const campaign = db.prepare('SELECT id FROM campaigns LIMIT 1').get();
  if (!campaign) {
    const now = new Date().toISOString();
    db.prepare(
      'INSERT INTO campaigns (id, name, description, sheet_config, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(uuidv4(), 'Minha Campanha', 'Uma aventura epica comeca aqui...', JSON.stringify(DEFAULT_SHEET_CONFIG), now, now);
  }
  db.prepare('UPDATE campaigns SET sheet_config = ? WHERE sheet_config IS NULL')
    .run(JSON.stringify(DEFAULT_SHEET_CONFIG));

  // Migracao: campanhas anteriores a multi-ficha tinham uma unica SheetConfig em
  // campaigns.sheet_config. Se `sheet_types` ainda esta vazia, cria um tipo "Padrao"
  // a partir dela e atribui todo personagem sem sheet_type_id a esse tipo — preserva
  // a config customizada que o mestre ja tinha montado, so muda onde ela mora.
  const hasSheetType = db.prepare('SELECT id FROM sheet_types LIMIT 1').get();
  if (!hasSheetType) {
    const campaignRow = db.prepare('SELECT sheet_config FROM campaigns LIMIT 1').get() as any;
    const config = parseSheetConfig(campaignRow?.sheet_config);
    const defaultTypeId = uuidv4();
    const migrationNow = new Date().toISOString();
    db.prepare(
      'INSERT INTO sheet_types (id, name, icon, color, is_default, sort_order, config, created_at, updated_at) VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?)'
    ).run(defaultTypeId, 'Padrão', 'Scroll', '#6366f1', JSON.stringify(config), migrationNow, migrationNow);
    db.prepare('UPDATE characters SET sheet_type_id = ? WHERE sheet_type_id IS NULL').run(defaultTypeId);
  }

  // Backfill: personagens antigos guardavam saude/sanidade/exposicao em colunas fixas.
  // Migra para os JSONs dinamicos resources/current_resources uma unica vez.
  const legacyRows = db.prepare(
    `SELECT id, health, sanity, exposure, current_health, current_sanity, current_exposure
     FROM characters WHERE resources IS NULL`
  ).all() as any[];
  if (legacyRows.length > 0) {
    const update = db.prepare('UPDATE characters SET resources = ?, current_resources = ? WHERE id = ?');
    const tx = db.transaction(() => {
      for (const row of legacyRows) {
        const resources = { health: row.health, sanity: row.sanity, exposure: row.exposure };
        const currentResources = {
          health: row.current_health === -1 ? row.health : row.current_health,
          sanity: row.current_sanity === -1 ? row.sanity : row.current_sanity,
          exposure: row.current_exposure === -1 ? row.exposure : row.current_exposure,
        };
        update.run(JSON.stringify(resources), JSON.stringify(currentResources), row.id);
      }
    });
    tx();
  }

  db.exec(`
    CREATE TABLE IF NOT EXISTS combat_sessions (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Combate',
      status TEXT NOT NULL DEFAULT 'active',
      participants TEXT NOT NULL DEFAULT '[]',
      current_index INTEGER NOT NULL DEFAULT 0,
      global_turn INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS maps (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL DEFAULT 'Novo Mapa',
      data TEXT NOT NULL DEFAULT '{"nodes":[],"paths":[]}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      event_date TEXT,
      session_number INTEGER,
      tags TEXT NOT NULL DEFAULT '[]',
      happened INTEGER NOT NULL DEFAULT 0,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_playlists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      mood TEXT NOT NULL DEFAULT 'exploration',
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS playlist_tracks (
      id TEXT PRIMARY KEY,
      playlist_id TEXT NOT NULL REFERENCES campaign_playlists(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      url TEXT NOT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS campaign_goals (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      priority TEXT NOT NULL DEFAULT 'medium',
      character_id TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  safeAdd(`ALTER TABLE effect_templates ADD COLUMN grimorio_id TEXT DEFAULT NULL`);

  db.exec(`
    CREATE TABLE IF NOT EXISTS grimorios (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'BookOpen',
      icon_color TEXT NOT NULL DEFAULT '#6366f1',
      catalizador_effect_id TEXT DEFAULT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS grimorio_spells (
      id TEXT PRIMARY KEY,
      grimorio_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      icon TEXT NOT NULL DEFAULT 'Star',
      icon_color TEXT NOT NULL DEFAULT '#6366f1',
      skill_type TEXT NOT NULL DEFAULT 'active',
      resource_effect TEXT DEFAULT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      uses_limit INTEGER DEFAULT NULL,
      uses_limit_type TEXT DEFAULT NULL,
      sort_order INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (grimorio_id) REFERENCES grimorios(id) ON DELETE CASCADE
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS grimorio_spell_uses (
      spell_id TEXT NOT NULL,
      character_id TEXT NOT NULL,
      current_uses INTEGER NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (spell_id, character_id)
    );
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS saved_campaigns (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      snapshot TEXT NOT NULL DEFAULT '{}',
      is_current INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  safeAdd(`ALTER TABLE saved_campaigns ADD COLUMN password_hash TEXT NOT NULL DEFAULT ''`);

  // gm_session_open substitui o antigo flag em memoria (perdido a cada restart do servidor,
  // travando os jogadores ate o mestre logar de novo). So faz o backfill no momento em que a
  // coluna e criada pela primeira vez — instalacoes existentes ja tinham uma campanha sendo
  // mestrada normalmente (is_current=1), entao nasce aberta pra elas. Depois desse ponto o
  // flag e controlado so por openGmSession(), sem essa migracao sobrescrever de novo.
  let addedGmSessionOpen = false;
  try { db.exec(`ALTER TABLE saved_campaigns ADD COLUMN gm_session_open INTEGER NOT NULL DEFAULT 0`); addedGmSessionOpen = true; } catch {}
  if (addedGmSessionOpen) {
    db.prepare('UPDATE saved_campaigns SET gm_session_open = 1 WHERE is_current = 1').run();
  }

  // Toda campanha "ao vivo" (a que esta nas tabelas principais) precisa ter uma
  // linha correspondente em saved_campaigns com is_current=1, para aparecer na
  // tela de selecao do mestre e guardar sua senha. Instalacoes existentes podem
  // nao ter essa linha ainda (a funcionalidade multi-campanha e posterior).
  const hasCurrentSaved = db.prepare('SELECT id FROM saved_campaigns WHERE is_current = 1 LIMIT 1').get();
  if (!hasCurrentSaved) {
    const liveCampaign = db.prepare('SELECT id, name, description, created_at, updated_at FROM campaigns LIMIT 1').get() as any;
    if (liveCampaign) {
      db.prepare(
        'INSERT INTO saved_campaigns (id, name, description, snapshot, is_current, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, 1, ?, ?, ?)'
      ).run(uuidv4(), liveCampaign.name, liveCampaign.description, '{}', '', liveCampaign.created_at, liveCampaign.updated_at);
    }
  }

  // Conta do YouTube / YouTube Music do mestre (player da trilha sonora).
  // Fica FORA do snapshot de campanha de proposito: os tokens sao da conta do
  // mestre, entao trocar de campanha nao pode desconectar a conta.
  db.exec(`
    CREATE TABLE IF NOT EXISTS youtube_music_auth (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL DEFAULT '',
      client_secret TEXT NOT NULL DEFAULT '',
      access_token TEXT NOT NULL DEFAULT '',
      refresh_token TEXT NOT NULL DEFAULT '',
      expires_at TEXT NOT NULL DEFAULT '',
      account_name TEXT NOT NULL DEFAULT '',
      account_thumb TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL
    );
  `);

  console.log('Migrations executadas com sucesso');
}
// NOTE: this line intentionally left blank
