import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTitle } from '../hooks/useTitle';
import { Lock, Plus, Compass } from 'lucide-react';
import { SavedCampaignSummary } from '../types';
import { api } from '../services/api';
import EvaLogo from '../components/layout/EvaLogo';
import Button from '../components/common/Button';
import { AdminPasswordGate, NewCampaignWizard } from '../components/campaigns/NewCampaignWizard';
import CampaignPasswordGate from '../components/campaigns/CampaignPasswordGate';

interface Props {
  onAuth: () => void;
}

type Screen = 'list' | 'password' | 'adminGate' | 'new';

export default function GMLogin({ onAuth }: Props) {
  useTitle('Mestre');
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<SavedCampaignSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [screen, setScreen] = useState<Screen>('list');
  const [target, setTarget] = useState<SavedCampaignSummary | null>(null);
  const [adminPassword, setAdminPassword] = useState('');

  useEffect(() => {
    api.campaigns.list()
      .then(setCampaigns)
      .finally(() => setLoading(false));
  }, []);

  // O token de mestre ja foi guardado dentro de api.campaigns.switch/createNew
  // no momento em que a senha foi validada — aqui so libera a UI.
  const finishAuth = () => {
    onAuth();
  };

  // Ao criar uma campanha nova, encaminha o mestre para configurar a ficha e
  // as permissoes antes de ir para o painel principal.
  const finishAuthAfterCreate = () => {
    navigate('/settings', { state: { onboarding: true, tab: 'fichas' } });
    finishAuth();
  };

  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  // Toda campanha passa pela tela de senha, inclusive as que nunca tiveram uma:
  // essas pedem a senha admin. Antes o clique entrava direto e qualquer celular
  // que abrisse a raiz do site (em vez de /player) virava mestre sem digitar nada.
  const handlePick = (c: SavedCampaignSummary) => {
    setTarget(c);
    setScreen('password');
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logoRow}>
          <EvaLogo size={40} withText />
        </div>
        <div style={s.subtitle}>Interface do Mestre</div>

        <div style={s.body}>
          {screen === 'list' && (
            <>
              <div style={s.iconRow}>
                <Compass size={18} color="var(--accent)" />
                <span style={s.prompt}>Escolha qual campanha você vai mestrar.</span>
              </div>

              {loading ? (
                <p style={s.muted}>Carregando campanhas...</p>
              ) : campaigns.length === 0 ? (
                <p style={s.muted}>Nenhuma campanha encontrada.</p>
              ) : (
                <div style={s.campaignList}>
                  {campaigns.map((c) => (
                    <button
                      key={c.id}
                      style={s.campaignCard}
                      onClick={() => handlePick(c)}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={s.campaignName}>{c.name}</span>
                          {c.isCurrent && <span style={s.activeBadge}>ATIVA</span>}
                        </div>
                        {c.description && <p style={s.campaignDesc}>{c.description}</p>}
                        <p style={s.campaignDate}>{fmt(c.updatedAt)}</p>
                      </div>
                      {c.hasPassword && <Lock size={13} color="var(--text-muted)" />}
                    </button>
                  ))}
                </div>
              )}

              <Button variant="secondary" icon={<Plus size={14} />} onClick={() => setScreen('adminGate')}>
                Nova campanha
              </Button>
            </>
          )}

          {screen === 'password' && target && (
            <CampaignPasswordGate
              campaign={target}
              onBack={() => { setTarget(null); setScreen('list'); }}
              onSuccess={finishAuth}
            />
          )}

          {screen === 'adminGate' && (
            <AdminPasswordGate
              onBack={() => setScreen('list')}
              onVerified={(pw) => { setAdminPassword(pw); setScreen('new'); }}
            />
          )}

          {screen === 'new' && (
            <NewCampaignWizard
              adminPassword={adminPassword}
              onBack={() => setScreen('list')}
              onCreated={finishAuthAfterCreate}
            />
          )}
        </div>
      </div>
    </div>
  );
}

const s: Record<string, any> = {
  page: {
    minHeight: '100vh',
    background: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '420px',
    overflow: 'hidden',
  },
  logoRow: {
    display: 'flex',
    justifyContent: 'center',
    padding: '28px 24px 8px',
  },
  subtitle: {
    textAlign: 'center',
    fontSize: '13px',
    color: 'var(--text-muted)',
    letterSpacing: '0.08em',
    paddingBottom: '20px',
  },
  body: {
    padding: '20px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  iconRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 12px',
    background: 'var(--accent-dim)',
    borderRadius: 'var(--radius)',
  },
  prompt: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
  },
  muted: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '12px 0',
  },
  campaignList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '340px',
    overflowY: 'auto',
  },
  campaignCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 14px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
  },
  campaignName: {
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activeBadge: {
    fontSize: '10px',
    fontWeight: 700,
    padding: '1px 6px',
    borderRadius: '100px',
    background: 'var(--accent)',
    color: '#fff',
    flexShrink: 0,
  },
  campaignDesc: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    margin: '2px 0 0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  campaignDate: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    margin: '2px 0 0',
  },
};
