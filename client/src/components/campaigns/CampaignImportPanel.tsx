import React, { useEffect, useMemo, useState } from 'react';
import {
  Backpack, BookMarked, Check, ChevronDown, ChevronRight, Download, Library,
  Map as MapIcon, Music, Search, Sparkles, AlertTriangle, LucideIcon,
} from 'lucide-react';
import {
  SavedCampaignSummary, ImportableCatalog, ImportableEntry, ImportKind,
  ImportConflictStrategy, ImportFromCampaignResult,
} from '../../types';
import { api } from '../../services/api';
import { useApp } from '../../contexts/AppContext';
import { matchesSearch } from '../../utils/normalizeSearch';
import { ICON_MAP } from '../characters/SkillIconPicker';
import Button from '../common/Button';
import { Select } from '../common/Input';

/**
 * Painel "importar de outra campanha": escolhe uma campanha salva e traz partes
 * dela (itens, habilidades, efeitos, grimórios, mapas, playlists) pra campanha
 * atual, sem apagar nada do que já está aqui.
 *
 * A seleção é só uma intenção — quem fecha as dependências é o servidor
 * (campaignImportService): marcar um item sempre traz junto os efeitos que ele
 * aplica, e um grimório sempre traz seu catalizador. O painel mostra isso na
 * linha "traz junto" pra escolha não ter surpresa, e mostra em vermelho os
 * efeitos que mirariam um recurso/proteção que esta campanha não tem.
 */

const SECTIONS: { kind: ImportKind; label: string; icon: LucideIcon; note?: string }[] = [
  { kind: 'itemTemplates', label: 'Itens', icon: Backpack },
  { kind: 'skillTemplates', label: 'Habilidades', icon: Library },
  {
    kind: 'effectTemplates', label: 'Efeitos', icon: Sparkles,
    note: 'Efeitos catalizadores não aparecem aqui — eles pertencem a um grimório e vêm junto dele.',
  },
  { kind: 'grimorios', label: 'Grimórios e conjurações', icon: BookMarked },
  { kind: 'maps', label: 'Mapas', icon: MapIcon },
  { kind: 'playlists', label: 'Playlists', icon: Music },
];

const CONFLICT_OPTIONS: { value: ImportConflictStrategy; label: string; hint: string }[] = [
  {
    value: 'reuse',
    label: 'Reaproveitar o que já existe',
    hint: 'Um efeito ou grimório de mesmo nome já presente aqui não é duplicado — os itens importados passam a apontar para ele, valendo os números desta campanha.',
  },
  {
    value: 'duplicate',
    label: 'Trazer cópias independentes',
    hint: 'Tudo entra como entrada nova, mesmo que já exista algo de mesmo nome. Nada nesta campanha é alterado, mas a biblioteca fica com nomes repetidos.',
  },
];

const key = (kind: ImportKind, id: string) => `${kind}:${id}`;

// ── Entry row ─────────────────────────────────────────────────────────────────

function EntryRow({
  entry, kind, checked, onToggle,
}: {
  entry: ImportableEntry;
  kind: ImportKind;
  checked: boolean;
  onToggle: () => void;
}) {
  const Icon = entry.icon ? ICON_MAP[entry.icon] : undefined;
  return (
    <div style={{ ...s.entry, ...(checked ? s.entryOn : {}) }} onClick={onToggle}>
      <div style={s.check(checked)}>{checked && <Check size={11} color="#fff" strokeWidth={3} />}</div>
      {Icon && <Icon size={15} color={entry.iconColor ?? 'var(--text-secondary)'} style={{ flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={s.entryName}>{entry.name}</span>
          {entry.alreadyExists && <span style={s.badgeExists}>JÁ EXISTE AQUI</span>}
        </div>
        {entry.detail && <span style={s.entryDetail}>{entry.detail}</span>}
        {checked && entry.brings.length > 0 && (
          <div style={s.brings}>traz junto: {entry.brings.join(' · ')}</div>
        )}
        {entry.warnings.map((w, i) => (
          <div key={i} style={s.warn}>
            <AlertTriangle size={11} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{kind === 'itemTemplates' || kind === 'effectTemplates' || kind === 'grimorios' || kind === 'skillTemplates'
              ? (w.startsWith('o ') ? w : `esta campanha não tem ${w}`)
              : w}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Section ───────────────────────────────────────────────────────────────────

function Section({
  kind, label, icon: Icon, note, entries, selected, onToggle, onBulk, search,
}: {
  kind: ImportKind;
  label: string;
  icon: LucideIcon;
  note?: string;
  entries: ImportableEntry[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onBulk: (ids: string[], value: boolean) => void;
  search: string;
}) {
  const [open, setOpen] = useState(true);
  const visible = entries.filter((e) => matchesSearch(e.name, search) || matchesSearch(e.detail, search));
  const chosen = entries.filter((e) => selected.has(key(kind, e.id))).length;
  const allVisibleOn = visible.length > 0 && visible.every((e) => selected.has(key(kind, e.id)));

  if (entries.length === 0) return null;

  return (
    <div style={s.section}>
      <div style={s.sectionHead}>
        <button style={s.sectionToggle} onClick={() => setOpen((o) => !o)}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <Icon size={15} />
          <span style={{ fontWeight: 700, fontSize: 14 }}>{label}</span>
          <span style={s.count}>{chosen > 0 ? `${chosen}/${entries.length}` : entries.length}</span>
        </button>
        {open && visible.length > 0 && (
          <button style={s.bulkBtn} onClick={() => onBulk(visible.map((e) => e.id), !allVisibleOn)}>
            {allVisibleOn ? 'Nenhum' : 'Todos'}
          </button>
        )}
      </div>
      {open && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {note && <p style={s.note}>{note}</p>}
          {visible.length === 0
            ? <p style={s.empty}>Nada corresponde à busca.</p>
            : visible.map((e) => (
              <EntryRow
                key={e.id}
                entry={e}
                kind={kind}
                checked={selected.has(key(kind, e.id))}
                onToggle={() => onToggle(e.id)}
              />
            ))}
        </div>
      )}
    </div>
  );
}

// ── Panel ─────────────────────────────────────────────────────────────────────

export default function CampaignImportPanel() {
  const { refreshAll } = useApp();
  const [campaigns, setCampaigns] = useState<SavedCampaignSummary[]>([]);
  const [sourceId, setSourceId] = useState('');
  const [catalog, setCatalog] = useState<ImportableCatalog | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [conflict, setConflict] = useState<ImportConflictStrategy>('reuse');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ImportFromCampaignResult | null>(null);

  useEffect(() => {
    api.campaigns.list()
      .then((list) => setCampaigns(list.filter((c) => !c.isCurrent)))
      .catch((e) => setError(e.message ?? 'Erro ao listar campanhas'));
  }, []);

  const loadCatalog = async (id: string) => {
    setSourceId(id);
    setCatalog(null);
    setSelected(new Set());
    setResult(null);
    setError('');
    if (!id) return;
    setLoading(true);
    try {
      setCatalog(await api.campaigns.importable(id));
    } catch (e: any) {
      setError(e.message ?? 'Erro ao ler a campanha');
    } finally {
      setLoading(false);
    }
  };

  const toggle = (kind: ImportKind, id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const k = key(kind, id);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });
  };

  const bulk = (kind: ImportKind, ids: string[], value: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const id of ids) {
        if (value) next.add(key(kind, id)); else next.delete(key(kind, id));
      }
      return next;
    });
  };

  const idsFor = (kind: ImportKind): string[] =>
    (catalog?.[kind] ?? []).filter((e) => selected.has(key(kind, e.id))).map((e) => e.id);

  const totalSelected = selected.size;

  /** Avisos das entradas escolhidas — o que o mestre precisa ver ANTES de confirmar. */
  const pendingWarnings = useMemo(() => {
    if (!catalog) return [];
    const out = new Set<string>();
    for (const { kind } of SECTIONS) {
      for (const e of (catalog[kind] ?? [])) {
        if (!selected.has(key(kind, e.id))) continue;
        for (const w of e.warnings) out.add(`${e.name}: ${w.startsWith('o ') ? w : `esta campanha não tem ${w}`}`);
      }
    }
    return [...out];
  }, [catalog, selected]);

  const handleImport = async () => {
    if (!sourceId || totalSelected === 0) return;
    setImporting(true);
    setError('');
    try {
      const res = await api.campaigns.importInto(sourceId, {
        effectTemplateIds: idsFor('effectTemplates'),
        itemTemplateIds: idsFor('itemTemplates'),
        skillTemplateIds: idsFor('skillTemplates'),
        grimorioIds: idsFor('grimorios'),
        mapIds: idsFor('maps'),
        playlistIds: idsFor('playlists'),
        conflictStrategy: conflict,
      });
      setResult(res);
      setSelected(new Set());
      // Mapas e playlists não vivem no AppContext (cada página busca ao montar),
      // mas bibliotecas sim — e o catálogo precisa recalcular "já existe aqui".
      await refreshAll();
      setCatalog(await api.campaigns.importable(sourceId));
    } catch (e: any) {
      setError(e.message ?? 'Erro ao importar');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardTitle}>Importar de outra campanha</span>
        </div>
        <p style={s.sub}>
          Traz itens, habilidades, efeitos, grimórios, mapas e playlists de uma campanha salva para
          esta, sem apagar nada do que já existe aqui.
        </p>

        <Select
          label="Campanha de origem"
          value={sourceId}
          onChange={(e) => loadCatalog(e.target.value)}
          options={[
            { value: '', label: 'Selecione uma campanha…' },
            ...campaigns.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        {campaigns.length === 0 && (
          <p style={s.empty}>
            Nenhuma outra campanha salva. Só dá para importar de campanhas que já foram salvas
            (ao criar outra campanha ou ao trocar de campanha guardando a atual).
          </p>
        )}
      </div>

      {loading && <p style={s.empty}>Lendo a campanha…</p>}
      {error && <p style={s.error}>{error}</p>}

      {result && (
        <div style={{ ...s.card, borderColor: 'var(--accent)' }}>
          <span style={s.cardTitle}>Importação concluída</span>
          <p style={s.sub}>
            {SECTIONS
              .filter(({ kind }) => result.imported[kind] > 0)
              .map(({ kind, label }) => `${result.imported[kind]} ${label.toLowerCase()}`)
              .join(' · ') || 'Nada novo foi criado.'}
            {result.reused.effectTemplates > 0 && ` · ${result.reused.effectTemplates} efeito(s) reaproveitado(s)`}
            {result.reused.grimorios > 0 && ` · ${result.reused.grimorios} grimório(s) reaproveitado(s)`}
          </p>
          {result.warnings.map((w, i) => (
            <div key={i} style={s.warn}>
              <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{w}</span>
            </div>
          ))}
        </div>
      )}

      {catalog && (
        <>
          <div style={s.card}>
            <span style={s.cardTitle}>Se já existir algo com o mesmo nome</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
              {CONFLICT_OPTIONS.map((opt) => (
                <div
                  key={opt.value}
                  style={{ ...s.entry, ...(conflict === opt.value ? s.entryOn : {}) }}
                  onClick={() => setConflict(opt.value)}
                >
                  <div style={s.radio(conflict === opt.value)} />
                  <div style={{ flex: 1 }}>
                    <span style={s.entryName}>{opt.label}</span>
                    <span style={s.entryDetail}>{opt.hint}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={s.searchRow}>
            <Search size={14} color="var(--text-muted)" />
            <input
              style={s.searchInput}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome…"
            />
          </div>

          {SECTIONS.map(({ kind, label, icon, note }) => (
            <Section
              key={kind}
              kind={kind}
              label={label}
              icon={icon}
              note={note}
              entries={catalog[kind] ?? []}
              selected={selected}
              onToggle={(id) => toggle(kind, id)}
              onBulk={(ids, value) => bulk(kind, ids, value)}
              search={search}
            />
          ))}

          {pendingWarnings.length > 0 && (
            <div style={{ ...s.card, borderColor: 'var(--warning, #f59e0b)' }}>
              <span style={s.cardTitle}>Atenção antes de importar</span>
              <p style={s.sub}>
                Isso não impede a importação — o efeito entra salvo do mesmo jeito, mas só passa a
                valer quando o recurso/proteção existir em algum tipo de ficha desta campanha.
              </p>
              {pendingWarnings.map((w, i) => (
                <div key={i} style={s.warn}>
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 2 }} />
                  <span>{w}</span>
                </div>
              ))}
            </div>
          )}

          <div style={s.footer}>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {totalSelected === 0 ? 'Nada selecionado' : `${totalSelected} selecionado${totalSelected === 1 ? '' : 's'}`}
            </span>
            <Button
              variant="primary"
              icon={<Download size={14} />}
              loading={importing}
              disabled={totalSelected === 0}
              onClick={handleImport}
            >
              Importar para esta campanha
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

const s: Record<string, any> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 14 },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  sub: { fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 12px', lineHeight: 1.5 },
  note: { fontSize: 11, color: 'var(--text-muted)', margin: '0 0 4px', lineHeight: 1.4 },
  empty: { fontSize: 12, color: 'var(--text-muted)', margin: '6px 0' },
  error: { fontSize: 13, color: 'var(--error)', margin: 0 },

  section: { display: 'flex', flexDirection: 'column', gap: 6, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px' },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 8 },
  sectionToggle: { flex: 1, display: 'flex', alignItems: 'center', gap: 7, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-primary)', padding: 0, textAlign: 'left' },
  count: { fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 100, padding: '1px 8px' },
  bulkBtn: { background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)', fontSize: 11, padding: '3px 9px', cursor: 'pointer' },

  entry: { display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'var(--bg-elevated)' },
  entryOn: { background: 'var(--accent-dim)' },
  entryName: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' },
  entryDetail: { fontSize: 11, color: 'var(--text-muted)', display: 'block', marginTop: 1, lineHeight: 1.4 },
  brings: { fontSize: 11, color: 'var(--accent)', marginTop: 3 },
  warn: { display: 'flex', gap: 5, fontSize: 11, color: '#f59e0b', marginTop: 3, lineHeight: 1.4 },
  badgeExists: { fontSize: 9, fontWeight: 700, letterSpacing: '0.05em', padding: '1px 6px', borderRadius: 100, background: 'var(--bg-base)', border: '1px solid var(--border)', color: 'var(--text-muted)' },

  check: (on: boolean): React.CSSProperties => ({
    width: 17, height: 17, borderRadius: 4, marginTop: 1,
    border: `2px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: on ? 'var(--accent)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  }),
  radio: (on: boolean): React.CSSProperties => ({
    width: 15, height: 15, borderRadius: '50%', marginTop: 2, flexShrink: 0,
    border: `5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
    background: 'var(--bg-base)',
  }),

  searchRow: { display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '7px 11px' },
  searchInput: { flex: 1, background: 'none', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: 13 },

  footer: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, position: 'sticky', bottom: 0, background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 16px' },
};
