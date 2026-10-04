import React, { useState, useEffect } from 'react';
import {
  PlayerActionKey, ActionPermission, PlayerPermissions,
  GlobalPermissions, DEFAULT_GLOBAL_PERMISSIONS,
  ACTION_LABELS, ACTION_HINTS, PERMISSION_GROUPS, PLAYER_ACTION_KEYS, Character,
} from '../../types';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';

// ── constants ─────────────────────────────────────────────────────────────────

const PERM_ACTIONS = PLAYER_ACTION_KEYS;

const PERM_OPTIONS: { value: ActionPermission; label: string; color: string }[] = [
  { value: 'free',    label: 'Livre',     color: '#22c55e' },
  { value: 'request', label: 'Solicitar', color: '#6366f1' },
  { value: 'blocked', label: 'Bloqueado', color: '#ef4444' },
];

// ── GlobalPermissionsCard ─────────────────────────────────────────────────────

function GlobalPermissionsCard({
  initial,
  onSave,
}: {
  initial: GlobalPermissions;
  onSave: (p: GlobalPermissions) => Promise<void>;
}) {
  const [perms, setPerms] = useState<GlobalPermissions>({ ...initial });
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { setPerms({ ...initial }); setDirty(false); }, [JSON.stringify(initial)]);

  const set = (action: PlayerActionKey, value: ActionPermission) => {
    setPerms(p => ({ ...p, [action]: value }));
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(perms); setDirty(false); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <span style={s.cardTitle}>Permissões Padrão</span>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
          Aplicadas a todos os personagens sem override específico
        </span>
        <div style={{ flex: 1 }} />
        {dirty && (
          <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
        )}
      </div>
      {PERMISSION_GROUPS.map(group => (
        <div key={group.label} style={s.group}>
          <span style={s.groupLabel}>{group.label}</span>
          <div style={s.grid}>
            {group.actions.map(action => {
              const cur = perms[action];
              return (
                <div key={action} style={s.row}>
                  <span style={s.actionLabel}>
                    {ACTION_LABELS[action]}
                    <span style={s.actionHint}>{ACTION_HINTS[action]}</span>
                  </span>
                  <div style={s.btnGroup}>
                    {PERM_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => set(action, opt.value)}
                        style={{ ...s.optBtn, ...(cur === opt.value ? { background: `${opt.color}20`, borderColor: opt.color, color: opt.color, fontWeight: 700 } : {}) }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── CharacterPermissionsRow ───────────────────────────────────────────────────

function CharacterPermissionsRow({
  character,
  globalPerms,
  onSave,
}: {
  character: Character;
  globalPerms: GlobalPermissions;
  onSave: (id: string, p: PlayerPermissions) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [perms, setPerms] = useState<PlayerPermissions>(character.playerPermissions ?? {});
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPerms(character.playerPermissions ?? {});
    setDirty(false);
  }, [character.id, JSON.stringify(character.playerPermissions)]);

  const set = (action: PlayerActionKey, value: ActionPermission | 'default') => {
    setPerms(p => {
      const next = { ...p };
      if (value === 'default') delete next[action];
      else next[action] = value;
      return next;
    });
    setDirty(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await onSave(character.id, perms); setDirty(false); }
    catch (e: any) { alert(e.message); }
    finally { setSaving(false); }
  };

  // Summary: count overrides
  const overrideCount = PERM_ACTIONS.filter(a => perms[a] !== undefined).length;

  return (
    <div style={{ borderRadius: 'var(--radius)', border: '1px solid var(--border)', overflow: 'hidden', background: 'var(--bg-surface)' }}>
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', background: expanded ? 'var(--bg-elevated)' : 'transparent' }}
        onClick={() => setExpanded(v => !v)}>
        {/* Avatar */}
        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'var(--bg-elevated)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {character.avatar
            ? <img src={character.avatar} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="" />
            : <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)' }}>{character.name[0]}</span>}
        </div>
        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--text-primary)', flex: 1 }}>{character.name}</span>
        {/* Override summary chips */}
        {PERM_ACTIONS.map(action => {
          const override = perms[action];
          if (!override) return null;
          const opt = PERM_OPTIONS.find(o => o.value === override);
          if (!opt) return null;
          return (
            <span key={action} style={{ fontSize: 9, padding: '1px 6px', borderRadius: 100, border: `1px solid ${opt.color}`, color: opt.color, background: `${opt.color}15`, fontWeight: 600 }}>
              {ACTION_LABELS[action].split(' ')[0]}: {opt.label}
            </span>
          );
        })}
        {overrideCount === 0 && (
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tudo padrão</span>
        )}
        <span style={{ fontSize: 16, color: 'var(--text-muted)', marginLeft: 4 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded permissions */}
      {expanded && (
        <div style={{ padding: '12px 14px', borderTop: '1px solid var(--border)' }}>
          <div style={s.grid}>
            {PERM_ACTIONS.map(action => {
              const override = perms[action];
              const effectiveGlobal = globalPerms[action] ?? DEFAULT_GLOBAL_PERMISSIONS[action];
              const effectiveOpt = PERM_OPTIONS.find(o => o.value === effectiveGlobal);
              return (
                <div key={action} style={s.row}>
                  <span style={s.actionLabel}>{ACTION_LABELS[action]}</span>
                  <div style={s.btnGroup}>
                    {/* Padrão button */}
                    <button
                      onClick={() => set(action, 'default')}
                      style={{
                        ...s.optBtn,
                        ...(override === undefined ? {
                          background: 'var(--bg-base)',
                          borderColor: 'var(--text-muted)',
                          color: 'var(--text-muted)',
                          fontWeight: 700,
                        } : {}),
                      }}>
                      Padrão{override === undefined && effectiveOpt ? ` (${effectiveOpt.label})` : ''}
                    </button>
                    {PERM_OPTIONS.map(opt => (
                      <button key={opt.value} onClick={() => set(action, opt.value)}
                        style={{ ...s.optBtn, ...(override === opt.value ? { background: `${opt.color}20`, borderColor: opt.color, color: opt.color, fontWeight: 700 } : {}) }}>
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {dirty && (
            <div style={{ marginTop: 10, display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={handleSave} disabled={saving} style={s.saveBtn}>
                {saving ? 'Salvando…' : 'Salvar alterações'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export default function PermissionsPanel() {
  const { campaign, characters, dispatch } = useApp();
  const globalPerms: GlobalPermissions = campaign?.globalPermissions ?? { ...DEFAULT_GLOBAL_PERMISSIONS };
  const pcChars = characters.filter(c => c.type === 'pc');

  const handleSaveGlobal = async (perms: GlobalPermissions) => {
    const updated = await api.campaign.setPermissions(perms);
    if (campaign) {
      dispatch({ type: 'SET_CAMPAIGN', payload: { ...campaign, globalPermissions: updated } });
    }
  };

  const handleSaveCharacter = async (characterId: string, perms: PlayerPermissions) => {
    const updated = await api.characters.update(characterId, { playerPermissions: perms } as any);
    dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <GlobalPermissionsCard initial={globalPerms} onSave={handleSaveGlobal} />

      <div style={s.section}>
        <h2 style={s.sectionTitle}>Por Personagem</h2>
        <p style={s.sectionSub}>
          Overrides individuais. "Padrão" usa o valor global acima.
        </p>
        {pcChars.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum personagem jogador cadastrado.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pcChars.map(c => (
              <CharacterPermissionsRow
                key={c.id}
                character={c}
                globalPerms={globalPerms}
                onSave={handleSaveCharacter}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s: Record<string, any> = {
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '18px 20px' },
  cardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  saveBtn: { padding: '6px 16px', background: 'var(--accent)', border: 'none', borderRadius: 'var(--radius)', color: 'white', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  grid: { display: 'flex', flexDirection: 'column', gap: 6 },
  group: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 14 },
  groupLabel: { fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--text-muted)' },
  row: { display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' },
  actionLabel: { flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500, display: 'flex', flexDirection: 'column' },
  actionHint: { fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', lineHeight: 1.35 },
  btnGroup: { display: 'flex', gap: 4, flexWrap: 'wrap' },
  optBtn: {
    padding: '3px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)',
    background: 'var(--bg-base)', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 12,
    transition: 'all 0.1s',
  },
  section: { display: 'flex', flexDirection: 'column', gap: 12 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: 'var(--text-primary)', margin: 0 },
  sectionSub: { fontSize: 12, color: 'var(--text-muted)', margin: 0 },
};
