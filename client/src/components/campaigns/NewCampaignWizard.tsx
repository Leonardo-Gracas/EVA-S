import React, { useState } from 'react';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { SavedCampaignSummary, CreateCampaignOptions, CreateNewCampaignDTO } from '../../types';
import { api } from '../../services/api';
import Button from '../common/Button';
import { Input, Textarea } from '../common/Input';

// ── Dependency rules: checking an item auto-checks its prerequisites ──────────

const DEPS: Record<keyof CreateCampaignOptions, (keyof CreateCampaignOptions)[]> = {
  effectTemplates: [],
  itemTemplates: ['effectTemplates'],
  skillTemplates: ['effectTemplates'],
  npcs: ['effectTemplates', 'skillTemplates'],
  characters: ['effectTemplates', 'skillTemplates'],
  grimorios: ['effectTemplates'],
  maps: [],
  events: [],
  playlists: [],
  goals: [],
};

const COPY_LABELS: Record<keyof CreateCampaignOptions, string> = {
  effectTemplates: 'Efeitos',
  itemTemplates: 'Itens',
  skillTemplates: 'Habilidades (biblioteca)',
  npcs: 'NPCs',
  characters: 'Personagens (PCs)',
  grimorios: 'Grimórios',
  maps: 'Mapas',
  events: 'Eventos',
  playlists: 'Playlists',
  goals: 'Metas',
};

const DEFAULT_COPY: CreateCampaignOptions = {
  effectTemplates: false,
  itemTemplates: false,
  skillTemplates: false,
  npcs: false,
  characters: false,
  grimorios: false,
  maps: false,
  events: false,
  playlists: false,
  goals: false,
};

function toggleCopy(prev: CreateCampaignOptions, key: keyof CreateCampaignOptions): CreateCampaignOptions {
  const next = { ...prev };
  const enabling = !prev[key];

  if (enabling) {
    next[key] = true;
    for (const dep of DEPS[key]) next[dep] = true;
  } else {
    next[key] = false;
    for (const [k, deps] of Object.entries(DEPS) as [keyof CreateCampaignOptions, (keyof CreateCampaignOptions)[]][]) {
      if (deps.includes(key) && next[k]) {
        next[k] = false;
      }
    }
  }

  return next;
}

// ── Step 1: confirm admin password before allowing campaign creation ─────────

interface AdminGateProps {
  onBack: () => void;
  onVerified: (adminPassword: string) => void;
}

export function AdminPasswordGate({ onBack, onVerified }: AdminGateProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handle = async () => {
    if (!password) { setError('Digite a senha admin'); return; }
    setLoading(true);
    setError('');
    try {
      await api.admin.verify(password);
      onVerified(password);
    } catch (e: any) {
      setError(e.message ?? 'Senha incorreta');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Criar nova campanha</span>
      </div>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
        Criar uma campanha e uma acao do mestre. Confirme a senha de administrador para continuar.
      </p>
      <Input
        label="Senha admin"
        type="password"
        value={password}
        onChange={(e) => { setPassword(e.target.value); setError(''); }}
        onKeyDown={(e) => e.key === 'Enter' && handle()}
        placeholder="Senha de administrador"
        autoFocus
      />
      {error && <span style={{ fontSize: 11, color: 'var(--error)' }}>{error}</span>}
      <Button variant="primary" size="sm" loading={loading} onClick={handle}>Continuar</Button>
    </div>
  );
}

// ── Step 2: wizard ─────────────────────────────────────────────────────────────

interface WizardProps {
  adminPassword: string;
  onBack: () => void;
  onCreated: (campaigns: SavedCampaignSummary[]) => void;
}

export function NewCampaignWizard({ adminPassword, onBack, onCreated }: WizardProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirm, setPasswordConfirm] = useState('');
  const [saveCurrent, setSaveCurrent] = useState(true);
  const [copy, setCopy] = useState<CreateCampaignOptions>(DEFAULT_COPY);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handle = async () => {
    if (!name.trim()) { setError('Nome obrigatório'); return; }
    if (password !== passwordConfirm) { setError('As senhas não coincidem'); return; }
    setLoading(true);
    setError('');
    try {
      const dto: CreateNewCampaignDTO & { adminPassword: string } = {
        name: name.trim(), description: description.trim(), password, saveCurrent, copy, adminPassword,
      };
      const result = await api.campaigns.createNew(dto);
      onCreated(result);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao criar campanha');
    } finally {
      setLoading(false);
    }
  };

  const label: React.CSSProperties = { fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6, display: 'block' };
  const toggleRow: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 'var(--radius)', cursor: 'pointer' };
  const checkBox = (active: boolean): React.CSSProperties => ({
    width: 18, height: 18, borderRadius: 4, border: `2px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    background: active ? 'var(--accent)' : 'transparent',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.15s',
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', padding: 4 }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Nova Campanha</span>
      </div>

      <Input label="Nome da campanha" value={name} onChange={e => setName(e.target.value)} placeholder="Ex: A Névoa de Arhanor" />
      <Textarea label="Descrição" value={description} onChange={e => setDescription(e.target.value)} rows={2} placeholder="Sobre o que é essa campanha?" />

      <div style={{ display: 'flex', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Input label="Senha da campanha (opcional)" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Deixe em branco para nenhuma" />
        </div>
        {password && (
          <div style={{ flex: 1 }}>
            <Input label="Confirmar senha" type="password" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} placeholder="Repita a senha" />
          </div>
        )}
      </div>

      {/* Save current toggle */}
      <div>
        <label style={label}>Campanha atual</label>
        <div style={toggleRow} onClick={() => setSaveCurrent(v => !v)}>
          <div style={checkBox(saveCurrent)}>
            {saveCurrent && <Check size={11} color="#fff" strokeWidth={3} />}
          </div>
          <span style={{ fontSize: 13, color: 'var(--text-primary)' }}>Salvar campanha atual antes de criar</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 28, marginTop: 2 }}>
          Se desmarcado, os dados atuais não serão preservados na lista.
        </p>
      </div>

      {/* Copy options */}
      <div>
        <label style={label}>Copiar da campanha atual</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, background: 'var(--bg-elevated)', borderRadius: 'var(--radius)', padding: 6 }}>
          {(Object.keys(COPY_LABELS) as (keyof CreateCampaignOptions)[]).map(key => {
            const active = copy[key];
            const requiredBy = DEPS[key];
            const isForced = requiredBy.length === 0 ? false
              : (Object.entries(DEPS) as [keyof CreateCampaignOptions, (keyof CreateCampaignOptions)[]][])
                .some(([k, deps]) => deps.includes(key) && copy[k]);
            return (
              <div key={key} style={{ ...toggleRow, background: active ? 'var(--accent-dim)' : 'transparent' }}
                onClick={() => !isForced && setCopy(p => toggleCopy(p, key))}>
                <div style={checkBox(active)}>
                  {active && <Check size={11} color="#fff" strokeWidth={3} />}
                </div>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: 13, color: active ? 'var(--accent)' : 'var(--text-primary)', fontWeight: active ? 600 : 400 }}>
                    {COPY_LABELS[key]}
                  </span>
                  {requiredBy.length > 0 && (
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 6 }}>
                      (requer {requiredBy.map(d => COPY_LABELS[d]).join(', ')})
                    </span>
                  )}
                </div>
                {isForced && <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>AUTO</span>}
              </div>
            );
          })}
        </div>
      </div>

      {error && <p style={{ fontSize: 13, color: 'var(--error)', margin: 0 }}>{error}</p>}

      <Button variant="primary" icon={<Save size={14} />} loading={loading} onClick={handle}>
        Criar Campanha
      </Button>
    </div>
  );
}
