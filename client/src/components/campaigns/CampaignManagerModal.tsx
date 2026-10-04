import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ChevronRight, Trash2, X, Lock } from 'lucide-react';
import { SavedCampaignSummary } from '../../types';
import { api } from '../../services/api';
import Button from '../common/Button';
import { AdminPasswordGate, NewCampaignWizard } from './NewCampaignWizard';
import CampaignPasswordGate from './CampaignPasswordGate';

// ── Campaign list ─────────────────────────────────────────────────────────────

interface ListProps {
  campaigns: SavedCampaignSummary[];
  onSwitch: (campaign: SavedCampaignSummary) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
  deleting: string | null;
}

function CampaignList({ campaigns, onSwitch, onDelete, onNew, deleting }: ListProps) {
  const fmt = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--text-primary)' }}>Gerenciar Campanhas</span>
        <Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={onNew}>Nova</Button>
      </div>

      {campaigns.length === 0 && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
          Nenhuma campanha salva. Crie uma nova ou importe um arquivo.
        </p>
      )}

      {campaigns.map(c => (
        <div key={c.id} style={{
          display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
          background: c.isCurrent ? 'var(--accent-dim)' : 'var(--bg-elevated)',
          border: `1px solid ${c.isCurrent ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 'var(--radius)',
        }}>
          {c.isCurrent && (
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.name}
              </span>
              {c.isCurrent && (
                <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: '100px', background: 'var(--accent)', color: '#fff', flexShrink: 0 }}>
                  ATIVA
                </span>
              )}
              {c.hasPassword && <Lock size={11} color="var(--text-muted)" />}
            </div>
            {c.description && (
              <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {c.description}
              </p>
            )}
            <p style={{ fontSize: 10, color: 'var(--text-muted)', margin: '2px 0 0' }}>
              {fmt(c.updatedAt)}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {!c.isCurrent && (
              <Button variant="secondary" size="sm" icon={<ChevronRight size={13} />}
                onClick={() => onSwitch(c)}>
                Carregar
              </Button>
            )}
            {!c.isCurrent && (
              <button
                onClick={() => onDelete(c.id)}
                disabled={deleting === c.id}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, opacity: deleting === c.id ? 0.5 : 1 }}>
                <Trash2 size={14} />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

interface CampaignManagerModalProps {
  onClose: () => void;
  onRefresh: () => void;
}

export function CampaignManagerModal({ onClose, onRefresh }: CampaignManagerModalProps) {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<SavedCampaignSummary[]>([]);
  const [view, setView] = useState<'list' | 'adminGate' | 'new' | 'password'>('list');
  const [switchTarget, setSwitchTarget] = useState<SavedCampaignSummary | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    api.campaigns.list().then(setCampaigns).catch(() => {});
  }, []);

  const handleSwitched = async (result: SavedCampaignSummary[]) => {
    setCampaigns(result);
    await onRefresh();
    setSwitchTarget(null);
    setView('list');
  };

  // Trocar de campanha sempre pede senha (a senha admin, quando a campanha nao tem
  // uma propria) — ver o mesmo cuidado em GMLogin.handlePick.
  const handlePickCampaign = (c: SavedCampaignSummary) => {
    setSwitchTarget(c);
    setView('password');
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Deletar essa campanha salva? Esta ação não pode ser desfeita.')) return;
    setDeleting(id);
    try {
      const result = await api.campaigns.delete(id);
      setCampaigns(result);
    } catch (e: any) {
      alert(e.message ?? 'Erro ao deletar campanha');
    } finally {
      setDeleting(null);
    }
  };

  const handleCreated = async (result: SavedCampaignSummary[]) => {
    setCampaigns(result);
    await onRefresh();
    setView('list');
    // Configurar atributos/recursos/protecoes e o primeiro passo de cada campanha nova
    navigate('/settings', { state: { onboarding: true, tab: 'fichas' } });
    onClose();
  };

  const overlay: React.CSSProperties = {
    position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  };
  const panel: React.CSSProperties = {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', padding: 24, width: '100%', maxWidth: 480,
    maxHeight: '85vh', overflowY: 'auto', position: 'relative',
  };

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={panel}>
        <button onClick={onClose} style={{ position: 'absolute', top: 14, right: 14, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex' }}>
          <X size={18} />
        </button>

        {view === 'list' && (
          <CampaignList
            campaigns={campaigns}
            onSwitch={handlePickCampaign}
            onDelete={handleDelete}
            onNew={() => setView('adminGate')}
            deleting={deleting}
          />
        )}

        {view === 'password' && switchTarget && (
          <CampaignPasswordGate
            campaign={switchTarget}
            onBack={() => { setSwitchTarget(null); setView('list'); }}
            onSuccess={handleSwitched}
          />
        )}

        {view === 'adminGate' && (
          <AdminPasswordGate
            onBack={() => setView('list')}
            onVerified={(pw) => { setAdminPassword(pw); setView('new'); }}
          />
        )}

        {view === 'new' && (
          <NewCampaignWizard
            adminPassword={adminPassword}
            onBack={() => setView('list')}
            onCreated={handleCreated}
          />
        )}
      </div>
    </div>
  );
}
