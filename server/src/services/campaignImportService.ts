import { v4 as uuidv4 } from 'uuid';
import db from '../database/db';
import {
  ExportData, EffectTemplate, ItemTemplate, ItemEffect, SkillTemplate, Grimorio,
  GameMap, CampaignPlaylist, ResourceEffect,
  ImportableCatalog, ImportableEntry, ImportFromCampaignDTO, ImportFromCampaignResult, ImportKind,
  parseResourceStat, parseProtectionStat,
} from '../types';
import { logHistory } from './historyService';
import * as sheetTypeService from './sheetTypeService';
import * as effectTemplateService from './effectTemplateService';
import * as itemTemplateService from './itemTemplateService';
import * as skillTemplateService from './skillTemplateService';
import * as grimorioService from './grimorioService';
import * as mapService from './mapService';
import * as campaignExtrasService from './campaignExtrasService';

/**
 * Importa partes de uma campanha SALVA (saved_campaigns.snapshot) para dentro da
 * campanha ao vivo, sem trocar de campanha. Diferente de importCampaign(), que
 * apaga tudo e substitui, aqui nada e apagado: cada entidade escolhida entra como
 * uma linha nova.
 *
 * Os dois cuidados que sustentam o resto do arquivo:
 *
 * 1. **Ids sempre novos.** Duas campanhas podem descender uma da outra e conter a
 *    MESMA id (createNewCampaign copia preservando ids), entao reaproveitar a id
 *    de origem estouraria a PK — ou pior, sobrescreveria silenciosamente. Toda
 *    linha nasce com uuid novo e toda referencia e reescrita pelo mapa de ids.
 *
 * 2. **Efeito em item nunca chega solto.** `item_templates.effects[]` guarda uma
 *    COPIA embutida do efeito (nome/icone/aplicacoes) mais um `templateId` que
 *    aponta pro effect_template. Se so o item viesse, esse `templateId` apontaria
 *    pra um efeito inexistente aqui (ou, pior, pra um efeito DIFERENTE que por
 *    acaso tem a mesma uuid) e a proxima edicao do efeito no destino propagaria
 *    valores errados pro item. Entao: o fecho de dependencias e obrigatorio, a
 *    copia embutida e re-sincronizada com o efeito ao qual ela realmente ficou
 *    ligada, e referencia orfã e desvinculada em vez de deixada apontando pro nada.
 */

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMBINING = /[̀-ͯ]/g;
function normName(s: string): string {
  return (s ?? '').normalize('NFD').replace(COMBINING, '').trim().toLowerCase();
}

/** Recursos/protecoes que existem em ALGUM tipo de ficha da campanha atual. */
interface StatIndex { resourceKeys: Set<string>; protectionKeys: Set<string> }

function buildStatIndex(): StatIndex {
  const resourceKeys = new Set<string>();
  const protectionKeys = new Set<string>();
  for (const st of sheetTypeService.listSheetTypes()) {
    for (const r of st.config.resources) resourceKeys.add(r.key);
    for (const p of st.config.protections) protectionKeys.add(p.key);
  }
  return { resourceKeys, protectionKeys };
}

/**
 * Um `EffectApplication.stat` e uma chave dinamica (`resource:<key>:max`,
 * `protection:<key>`) resolvida contra a SheetConfig. Importado pra uma campanha
 * cujos tipos de ficha nao tem aquela chave, o efeito continua salvo mas nunca
 * soma nada — falha silenciosa. Aqui isso vira aviso explicito.
 */
function statWarning(stat: string, idx: StatIndex): string | null {
  const res = parseResourceStat(stat);
  if (res) return idx.resourceKeys.has(res.key) ? null : `recurso "${res.key}"`;
  const prot = parseProtectionStat(stat);
  if (prot) return idx.protectionKeys.has(prot.key) ? null : `proteção "${prot.key}"`;
  return null; // movement / custom valem em qualquer campanha
}

function applicationWarnings(applications: { stat: string }[] | undefined, idx: StatIndex): string[] {
  const out = new Set<string>();
  for (const app of (applications ?? [])) {
    const w = statWarning(app.stat, idx);
    if (w) out.add(w);
  }
  return [...out];
}

/** Custos/ganhos de habilidade e feitico miram um recurso pela chave — mesmo risco. */
function resourceEffectWarnings(effects: ResourceEffect[] | undefined, idx: StatIndex): string[] {
  const out = new Set<string>();
  for (const fx of (effects ?? [])) {
    if (!idx.resourceKeys.has(fx.resource)) out.add(`recurso "${fx.resource}"`);
  }
  return [...out];
}

function itemEffectWarnings(effects: ItemEffect[] | undefined, idx: StatIndex): string[] {
  const out = new Set<string>();
  for (const eff of (effects ?? [])) {
    for (const w of applicationWarnings(eff.applications, idx)) out.add(w);
  }
  return [...out];
}

// ── Snapshot da campanha de origem ────────────────────────────────────────────

interface Source {
  campaignId: string;
  campaignName: string;
  data: ExportData;
  effects: Map<string, EffectTemplate>;
  items: Map<string, ItemTemplate>;
  skills: Map<string, SkillTemplate>;
  grimorios: Map<string, Grimorio>;
  maps: Map<string, GameMap>;
  playlists: Map<string, CampaignPlaylist>;
}

function loadSource(campaignId: string): Source {
  const row = db.prepare('SELECT id, name, snapshot, is_current FROM saved_campaigns WHERE id = ?').get(campaignId) as any;
  if (!row) throw new Error('Campanha nao encontrada');
  if (row.is_current === 1) {
    throw new Error('Essa e a campanha ativa — escolha outra para importar dela');
  }

  let data: ExportData;
  try { data = JSON.parse(row.snapshot || '{}'); }
  catch { throw new Error(`A campanha "${row.name}" nao tem dados salvos`); }
  if (!data || !data.version) {
    throw new Error(`A campanha "${row.name}" nao tem dados salvos (nunca foi carregada e salva)`);
  }

  const byId = <T extends { id: string }>(list: T[] | undefined) =>
    new Map((list ?? []).map((x) => [x.id, x]));

  return {
    campaignId: row.id,
    campaignName: row.name,
    data,
    effects: byId(data.effectTemplates),
    items: byId(data.itemTemplates),
    skills: byId(data.skillTemplates),
    grimorios: byId(data.grimorios),
    maps: byId(data.maps),
    playlists: byId(data.campaignPlaylists),
  };
}

// ── Catalogo ──────────────────────────────────────────────────────────────────

const ITEM_TYPE_LABEL: Record<string, string> = {
  weapon: 'Arma', vest: 'Veste', consumable: 'Consumível', special: 'Especial',
};

export function getImportableCatalog(campaignId: string): ImportableCatalog {
  const src = loadSource(campaignId);
  const idx = buildStatIndex();

  const destEffectNames = new Set(effectTemplateService.getAllEffectTemplates().map((e) => normName(e.name)));
  const destItemNames = new Set(itemTemplateService.getAllItemTemplates().map((i) => normName(i.name)));
  const destSkillNames = new Set(skillTemplateService.getAllTemplates().map((s) => normName(s.title)));
  const destGrimorioNames = new Set(grimorioService.listGrimorios().map((g) => normName(g.name)));
  const destMapNames = new Set(mapService.getAllMaps().map((m) => normName(m.name)));
  const destPlaylistNames = new Set(campaignExtrasService.getAllPlaylists().map((p) => normName(p.name)));

  // Catalizadores nao entram na lista de Efeitos: eles pertencem a um grimorio
  // (effect_templates.grimorio_id) e importados sozinhos virariam um efeito que
  // abre um grimorio inexistente. Vem sempre junto do grimorio deles.
  const effectTemplates: ImportableEntry[] = (src.data.effectTemplates ?? [])
    .filter((e) => !e.grimorioId)
    .map((e) => ({
      id: e.id,
      name: e.name,
      detail: e.applications?.length
        ? `${e.applications.length} aplicaç${e.applications.length === 1 ? 'ão' : 'ões'}`
        : 'Sem aplicações',
      icon: e.icon,
      iconColor: e.iconColor,
      alreadyExists: destEffectNames.has(normName(e.name)),
      brings: [],
      warnings: applicationWarnings(e.applications, idx),
    }));

  const itemTemplates: ImportableEntry[] = (src.data.itemTemplates ?? []).map((t) => {
    const brings: string[] = [];
    const dangling: string[] = [];
    for (const eff of (t.effects ?? [])) {
      if (!eff.templateId) continue;
      const srcEff = src.effects.get(eff.templateId);
      if (!srcEff) { dangling.push(eff.name); continue; }
      if (srcEff.grimorioId) {
        const g = src.grimorios.get(srcEff.grimorioId);
        brings.push(g ? `Grimório "${g.name}"` : `Efeito "${srcEff.name}"`);
      } else {
        brings.push(`Efeito "${srcEff.name}"`);
      }
    }
    const warnings = itemEffectWarnings(t.effects, idx);
    for (const name of dangling) {
      warnings.push(`o efeito "${name}" perdeu o vínculo na origem — virá como cópia solta`);
    }
    return {
      id: t.id,
      name: t.name,
      detail: [ITEM_TYPE_LABEL[t.type] ?? t.type, t.damage ? `dano ${t.damage}` : null]
        .filter(Boolean).join(' · '),
      icon: t.icon,
      iconColor: t.iconColor,
      alreadyExists: destItemNames.has(normName(t.name)),
      brings: [...new Set(brings)],
      warnings,
    };
  });

  const skillTemplates: ImportableEntry[] = (src.data.skillTemplates ?? []).map((s) => ({
    id: s.id,
    name: s.title,
    detail: [
      s.skillType === 'active' ? 'Ativa' : 'Passiva',
      s.usesLimit ? `${s.usesLimit} uso${s.usesLimit === 1 ? '' : 's'}` : null,
    ].filter(Boolean).join(' · '),
    icon: s.icon,
    iconColor: s.iconColor,
    alreadyExists: destSkillNames.has(normName(s.title)),
    brings: [],
    warnings: resourceEffectWarnings(s.resourceEffect, idx),
  }));

  const grimorios: ImportableEntry[] = (src.data.grimorios ?? []).map((g) => {
    const warnings = new Set<string>();
    for (const sp of g.spells) {
      for (const w of resourceEffectWarnings(sp.resourceEffect, idx)) warnings.add(w);
    }
    const cat = g.catalizadorEffectId ? src.effects.get(g.catalizadorEffectId) : undefined;
    for (const w of applicationWarnings(cat?.applications, idx)) warnings.add(w);
    return {
      id: g.id,
      name: g.name,
      detail: `${g.spells.length} conjuraç${g.spells.length === 1 ? 'ão' : 'ões'}`,
      icon: g.icon,
      iconColor: g.iconColor,
      alreadyExists: destGrimorioNames.has(normName(g.name)),
      brings: [`Efeito catalizador "${cat?.name ?? `Catalizador ${g.name}`}"`],
      warnings: [...warnings],
    };
  });

  const maps: ImportableEntry[] = (src.data.maps ?? []).map((m) => ({
    id: m.id,
    name: m.name,
    detail: `${m.nodes.length} local${m.nodes.length === 1 ? '' : 'is'} · ${m.paths.length} caminho${m.paths.length === 1 ? '' : 's'}`,
    alreadyExists: destMapNames.has(normName(m.name)),
    brings: [],
    warnings: [],
  }));

  const playlists: ImportableEntry[] = (src.data.campaignPlaylists ?? []).map((p) => ({
    id: p.id,
    name: p.name,
    detail: `${p.mood} · ${p.tracks.length} faixa${p.tracks.length === 1 ? '' : 's'}`,
    alreadyExists: destPlaylistNames.has(normName(p.name)),
    brings: [],
    warnings: [],
  }));

  return {
    campaignId: src.campaignId,
    campaignName: src.campaignName,
    effectTemplates, itemTemplates, skillTemplates, grimorios, maps, playlists,
  };
}

// ── Importacao ────────────────────────────────────────────────────────────────

const SQL_INSERT_EFFECT =
  'INSERT INTO effect_templates (id, name, icon, icon_color, description, applications, grimorio_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
const SQL_INSERT_ITEM =
  'INSERT INTO item_templates (id, name, description, item_type, icon, icon_color, damage, effects, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const SQL_INSERT_SKILL =
  'INSERT INTO skill_templates (id, title, description, icon, icon_color, skill_type, resource_effect, tags, uses_limit, uses_limit_type, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const SQL_INSERT_GRIMORIO =
  'INSERT INTO grimorios (id, name, description, icon, icon_color, catalizador_effect_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)';
const SQL_INSERT_SPELL =
  'INSERT INTO grimorio_spells (id, grimorio_id, title, description, icon, icon_color, skill_type, resource_effect, tags, uses_limit, uses_limit_type, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
const SQL_INSERT_MAP =
  'INSERT INTO maps (id, name, data, created_at, updated_at) VALUES (?, ?, ?, ?, ?)';
const SQL_INSERT_PLAYLIST =
  'INSERT INTO campaign_playlists (id, name, mood, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)';
const SQL_INSERT_TRACK =
  'INSERT INTO playlist_tracks (id, playlist_id, title, url, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)';

export function importFromCampaign(campaignId: string, dto: ImportFromCampaignDTO): ImportFromCampaignResult {
  const src = loadSource(campaignId);
  const idx = buildStatIndex();
  const now = new Date().toISOString();
  const reuse = dto.conflictStrategy !== 'duplicate';

  const imported: Record<ImportKind, number> = {
    effectTemplates: 0, itemTemplates: 0, skillTemplates: 0, grimorios: 0, maps: 0, playlists: 0,
  };
  const reused = { effectTemplates: 0, grimorios: 0 };
  const warnings = new Set<string>();

  const addStatWarnings = (label: string, list: string[]) => {
    for (const w of list) warnings.add(`${label}: a campanha atual não tem ${w} — esse efeito não vai somar nada até você criá-lo.`);
  };

  // id de origem -> id no destino. Cobre efeitos criados agora E efeitos do
  // destino reaproveitados; e a unica fonte de verdade pro remapeamento de
  // `ItemEffect.templateId` e `grimorios.catalizador_effect_id`.
  const effectIdMap = new Map<string, string>();
  /** Efeito resolvido (ja no destino) por id de destino — usado pra re-sincronizar a copia embutida do item. */
  const destEffectById = new Map<string, EffectTemplate>();

  const tx = db.transaction(() => {
    const destEffects = effectTemplateService.getAllEffectTemplates();
    for (const e of destEffects) destEffectById.set(e.id, e);
    const destGrimorios = grimorioService.listGrimorios();

    // ── 1) Grimorios ────────────────────────────────────────────────────────
    // Vem antes de tudo porque um item pode carregar o efeito CATALIZADOR de um
    // grimorio (e assim dar acesso a ele na ficha) — nesse caso o grimorio inteiro
    // e uma dependencia do item, nao uma escolha independente.
    const grimorioIds = new Set(dto.grimorioIds ?? []);
    for (const itemId of (dto.itemTemplateIds ?? [])) {
      for (const eff of (src.items.get(itemId)?.effects ?? [])) {
        if (!eff.templateId) continue;
        const srcEff = src.effects.get(eff.templateId);
        if (srcEff?.grimorioId && src.grimorios.has(srcEff.grimorioId)) grimorioIds.add(srcEff.grimorioId);
      }
    }

    for (const gId of grimorioIds) {
      const g = src.grimorios.get(gId);
      if (!g) continue;

      const existing = reuse ? destGrimorios.find((d) => normName(d.name) === normName(g.name)) : undefined;
      if (existing) {
        // Reaproveita o grimorio daqui: o catalizador da origem passa a apontar
        // pro catalizador DELE, e nenhum feitico e duplicado.
        if (g.catalizadorEffectId && existing.catalizadorEffectId) {
          effectIdMap.set(g.catalizadorEffectId, existing.catalizadorEffectId);
        }
        reused.grimorios++;
        warnings.add(`Grimório "${g.name}" já existe aqui — os itens importados foram ligados ao grimório desta campanha.`);
        continue;
      }

      const newGid = uuidv4();
      const newEffId = uuidv4();
      db.prepare(SQL_INSERT_GRIMORIO).run(
        newGid, g.name, g.description, g.icon, g.iconColor, newEffId, g.createdAt, now,
      );

      // O catalizador NUNCA e reaproveitado de outro grimorio: a coluna
      // grimorio_id o torna propriedade exclusiva de um grimorio (deleteGrimorio
      // apaga o efeito junto), entao compartilhar um levaria os dois a se
      // destruirem mutuamente.
      const srcCat = g.catalizadorEffectId ? src.effects.get(g.catalizadorEffectId) : undefined;
      db.prepare(SQL_INSERT_EFFECT).run(
        newEffId,
        srcCat?.name ?? `Catalizador ${g.name}`,
        srcCat?.icon ?? 'BookOpen',
        srcCat?.iconColor ?? g.iconColor,
        srcCat?.description ?? `Permite acesso ao Grimório ${g.name}`,
        JSON.stringify(srcCat?.applications ?? []),
        newGid, srcCat?.createdAt ?? now, now,
      );
      addStatWarnings(`Catalizador de "${g.name}"`, applicationWarnings(srcCat?.applications, idx));
      if (g.catalizadorEffectId) effectIdMap.set(g.catalizadorEffectId, newEffId);
      destEffectById.set(newEffId, {
        id: newEffId,
        name: srcCat?.name ?? `Catalizador ${g.name}`,
        icon: srcCat?.icon ?? 'BookOpen',
        iconColor: srcCat?.iconColor ?? g.iconColor,
        description: srcCat?.description ?? `Permite acesso ao Grimório ${g.name}`,
        applications: srcCat?.applications ?? [],
        grimorioId: newGid,
        createdAt: srcCat?.createdAt ?? now,
        updatedAt: now,
      });

      let order = 0;
      for (const sp of g.spells) {
        db.prepare(SQL_INSERT_SPELL).run(
          uuidv4(), newGid, sp.title, sp.description, sp.icon, sp.iconColor, sp.skillType,
          sp.resourceEffect && sp.resourceEffect.length ? JSON.stringify(sp.resourceEffect) : null,
          JSON.stringify(sp.tags ?? []), sp.usesLimit ?? null, sp.usesLimitType ?? null,
          order++, sp.createdAt, now,
        );
        addStatWarnings(`Conjuração "${sp.title}"`, resourceEffectWarnings(sp.resourceEffect, idx));
      }
      imported.grimorios++;
    }

    // ── 2) Efeitos ──────────────────────────────────────────────────────────
    // Fecho de dependencias: todo efeito referenciado por um item selecionado
    // entra, marcado pelo usuario ou nao. Catalizadores ficam de fora — ja
    // resolvidos no passo 1, com o grimorio deles.
    const effectIds = new Set((dto.effectTemplateIds ?? []).filter((id) => !src.effects.get(id)?.grimorioId));
    for (const itemId of (dto.itemTemplateIds ?? [])) {
      for (const eff of (src.items.get(itemId)?.effects ?? [])) {
        if (!eff.templateId) continue;
        const srcEff = src.effects.get(eff.templateId);
        if (srcEff && !srcEff.grimorioId) effectIds.add(srcEff.id);
      }
    }

    for (const eId of effectIds) {
      const e = src.effects.get(eId);
      if (!e) continue;

      const existing = reuse
        ? (destEffects.find((d) => d.id === e.id) ?? destEffects.find((d) => normName(d.name) === normName(e.name)))
        : undefined;
      if (existing) {
        effectIdMap.set(e.id, existing.id);
        reused.effectTemplates++;
        continue;
      }

      const newId = uuidv4();
      db.prepare(SQL_INSERT_EFFECT).run(
        newId, e.name, e.icon, e.iconColor, e.description,
        JSON.stringify(e.applications ?? []), null, e.createdAt, now,
      );
      effectIdMap.set(e.id, newId);
      destEffectById.set(newId, { ...e, id: newId, grimorioId: null, updatedAt: now });
      addStatWarnings(`Efeito "${e.name}"`, applicationWarnings(e.applications, idx));
      imported.effectTemplates++;
    }

    // ── 3) Itens ────────────────────────────────────────────────────────────
    for (const itemId of (dto.itemTemplateIds ?? [])) {
      const t = src.items.get(itemId);
      if (!t) continue;

      const effects: ItemEffect[] = (t.effects ?? []).map((eff) => {
        // Efeito avulso (nunca veio da biblioteca): a copia embutida ja e tudo
        // o que existe dele, entao viaja inteira.
        if (!eff.templateId) return { ...eff };

        const destId = effectIdMap.get(eff.templateId);
        if (!destId) {
          // O efeito referenciado nao existe mais no snapshot de origem. Manter o
          // templateId apontaria pro vazio — ou, se por acaso uma uuid igual
          // existir aqui, ligaria o item a um efeito que nao e o dele. Desvincula.
          warnings.add(`Item "${t.name}": o efeito "${eff.name}" não existe mais na campanha de origem — veio como cópia solta, sem vínculo com a biblioteca.`);
          const { templateId, ...loose } = eff;
          return loose;
        }

        // Re-sincroniza a copia embutida com o efeito ao qual o item REALMENTE
        // ficou ligado. Sem isso, um item reaproveitando um efeito do destino
        // continuaria exibindo/aplicando os numeros da origem ate alguem editar o
        // efeito aqui — e propagateEffectUpdate sobrescreveria tudo de uma vez.
        const destEff = destEffectById.get(destId);
        if (!destEff) return { ...eff, templateId: destId };
        if (
          destEff.name !== eff.name ||
          JSON.stringify(destEff.applications ?? []) !== JSON.stringify(eff.applications ?? [])
        ) {
          warnings.add(`Item "${t.name}": o efeito "${eff.name}" foi ligado ao "${destEff.name}" desta campanha — valem os números daqui.`);
        }
        return {
          ...eff,
          templateId: destId,
          name: destEff.name,
          icon: destEff.icon,
          color: destEff.iconColor,
          description: destEff.description,
          applications: destEff.applications ?? [],
        };
      });

      db.prepare(SQL_INSERT_ITEM).run(
        uuidv4(), t.name, t.description, t.type, t.icon ?? 'Star', t.iconColor ?? '#6366f1',
        t.damage ?? null, JSON.stringify(effects), t.createdAt, now,
      );
      addStatWarnings(`Item "${t.name}"`, itemEffectWarnings(effects, idx));
      imported.itemTemplates++;
    }

    // ── 4) Habilidades ──────────────────────────────────────────────────────
    for (const sId of (dto.skillTemplateIds ?? [])) {
      const s = src.skills.get(sId);
      if (!s) continue;
      db.prepare(SQL_INSERT_SKILL).run(
        uuidv4(), s.title, s.description, s.icon, s.iconColor, s.skillType ?? 'passive',
        s.resourceEffect && s.resourceEffect.length ? JSON.stringify(s.resourceEffect) : null,
        JSON.stringify(s.tags ?? []), s.usesLimit ?? null, s.usesLimitType ?? null,
        s.createdAt, now,
      );
      addStatWarnings(`Habilidade "${s.title}"`, resourceEffectWarnings(s.resourceEffect, idx));
      imported.skillTemplates++;
    }

    // ── 5) Mapas ────────────────────────────────────────────────────────────
    // O JSON de nodes/paths e fechado em si mesmo (ids so referenciados de dentro
    // do proprio mapa), entao viaja intacto sob uma id nova.
    for (const mId of (dto.mapIds ?? [])) {
      const m = src.maps.get(mId);
      if (!m) continue;
      db.prepare(SQL_INSERT_MAP).run(
        uuidv4(), m.name, JSON.stringify({ nodes: m.nodes ?? [], paths: m.paths ?? [] }), m.createdAt, now,
      );
      imported.maps++;
    }

    // ── 6) Playlists ────────────────────────────────────────────────────────
    let playlistOrder = (db.prepare('SELECT COALESCE(MAX(sort_order), -1) as m FROM campaign_playlists').get() as any).m as number;
    for (const pId of (dto.playlistIds ?? [])) {
      const p = src.playlists.get(pId);
      if (!p) continue;
      const newPid = uuidv4();
      db.prepare(SQL_INSERT_PLAYLIST).run(newPid, p.name, p.mood, ++playlistOrder, p.createdAt, now);
      let trackOrder = 0;
      for (const tr of (p.tracks ?? [])) {
        db.prepare(SQL_INSERT_TRACK).run(uuidv4(), newPid, tr.title, tr.url, trackOrder++, tr.createdAt, now);
      }
      imported.playlists++;
    }
  });

  tx();

  const total = Object.values(imported).reduce((a, b) => a + b, 0);
  logHistory(
    'campaign:partial_import',
    `Importado de "${src.campaignName}": ${total} ${total === 1 ? 'item' : 'itens'}`,
    { imported, reused },
  );

  return { imported, reused, warnings: [...warnings] };
}
