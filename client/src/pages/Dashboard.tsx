import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import { useNavigate } from 'react-router-dom';
import {
  Users, Sword, Wifi, Edit2, Save, X,
  Download, Upload, ChevronRight, Settings, Swords,
  Circle, AlertCircle, Clock, FolderOpen, KeyRound,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import Button from '../components/common/Button';
import { Input, Textarea } from '../components/common/Input';
import Modal from '../components/common/Modal';
import { CampaignManagerModal } from '../components/campaigns/CampaignManagerModal';
import CampaignPasswordChangeForm from '../components/campaigns/CampaignPasswordChangeForm';

function Avatar({ name, src, size = 36, color }: { name: string; src?: string | null; size?: number; color?: string }) {
  return src ? (
    <img src={src} alt={name} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: '50%', background: color ?? 'var(--accent)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.4, fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, onClick }: {
  icon: any; label: string; value: number | string; color: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-surface)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: '16px 20px',
      display: 'flex', alignItems: 'center', gap: 14,
      cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{
        width: 40, height: 40, borderRadius: 'var(--radius)',
        background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      }}>
        <Icon size={20} color={color} />
      </div>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{value}</div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      </div>
    </div>
  );
}

export default function Dashboard() {
  useTitle('Dashboard');
  const { campaign, players, characters, history, requests, activeCombat, refreshAll, dispatch } = useApp();
  const [editingCampaign, setEditingCampaign] = useState(false);
  const [campaignName, setCampaignName] = useState('');
  const [campaignDesc, setCampaignDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [importing, setImporting] = useState(false);
  const [showCampaignManager, setShowCampaignManager] = useState(false);
  const [passwordCampaign, setPasswordCampaign] = useState<{ id: string; name: string; hasPassword: boolean } | null>(null);
  const [loadingPasswordCampaign, setLoadingPasswordCampaign] = useState(false);
  const navigate = useNavigate();

  const onlineCount = players.filter((p) => p.status === 'online').length;
  const pendingCount = requests.filter((r) => r.status === 'pending').length;

  const startEdit = () => {
    setCampaignName(campaign?.name ?? '');
    setCampaignDesc(campaign?.description ?? '');
    setEditingCampaign(true);
  };

  const saveCampaign = async () => {
    setSaving(true);
    try {
      const updated = await api.campaign.update({ name: campaignName, description: campaignDesc });
      dispatch({ type: 'SET_CAMPAIGN', payload: updated });
      setEditingCampaign(false);
    } catch {
      alert('Erro ao salvar campanha');
    } finally {
      setSaving(false);
    }
  };

  const openPasswordChange = async () => {
    setLoadingPasswordCampaign(true);
    try {
      const list = await api.campaigns.list();
      const current = list.find((c) => c.isCurrent);
      if (current) setPasswordCampaign({ id: current.id, name: current.name, hasPassword: current.hasPassword });
      else alert('Não foi possível identificar a campanha atual.');
    } catch {
      alert('Erro ao carregar dados da campanha.');
    } finally {
      setLoadingPasswordCampaign(false);
    }
  };

  const handleExport = async () => {
    try {
      const data = await api.campaign.export();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `campanha-${campaign?.name?.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      alert('Erro ao exportar campanha');
    }
  };

  const handleImport = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target.files[0];
      if (!file) return;
      if (!confirm('Importar substituira todos os dados da campanha atual. Continuar?')) return;
      setImporting(true);
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await api.campaign.import(data);
        await refreshAll();
      } catch {
        alert('Erro ao importar campanha. Verifique o arquivo.');
      } finally {
        setImporting(false);
      }
    };
    input.click();
  };

  const currentParticipant = activeCombat
    ? activeCombat.participants[activeCombat.currentIndex] ?? null
    : null;
  const currentChar = currentParticipant
    ? characters.find((c) => c.id === currentParticipant.characterId)
    : null;

  const recentEvents = history.slice(0, 6);

  return (
    <div style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 1100 }}>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
        <StatCard icon={Wifi} label="Online agora" value={onlineCount} color="var(--success)" />
        <StatCard icon={Users} label="Jogadores" value={players.length} color="var(--accent)" onClick={() => navigate('/players')} />
        <StatCard icon={Sword} label="Personagens" value={characters.length} color="var(--warning)" onClick={() => navigate('/characters')} />
        {pendingCount > 0 && (
          <StatCard icon={AlertCircle} label="Pendentes" value={pendingCount} color="var(--danger)" onClick={() => navigate('/requests')} />
        )}
      </div>

      {/* Main cols */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Campanha */}
        <div style={{ ...card, gap: 0 }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Campanha</span>
            {!editingCampaign ? (
              <Button variant="ghost" size="sm" icon={<Edit2 size={13} />} onClick={startEdit}>Editar</Button>
            ) : (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <Button variant="ghost" size="sm" icon={<KeyRound size={13} />} loading={loadingPasswordCampaign} onClick={openPasswordChange}>Trocar senha</Button>
                <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={() => setEditingCampaign(false)} />
                <Button variant="primary" size="sm" icon={<Save size={13} />} loading={saving} onClick={saveCampaign}>Salvar</Button>
              </div>
            )}
          </div>

          {editingCampaign ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input label="Nome" value={campaignName} onChange={(e) => setCampaignName(e.target.value)} />
              <Textarea label="Descricao" value={campaignDesc} onChange={(e) => setCampaignDesc(e.target.value)} rows={4} />
            </div>
          ) : (
            <div>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 8 }}>
                {campaign?.name}
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.6 }}>
                {campaign?.description || 'Sem descricao.'}
              </p>
            </div>
          )}

          <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Button variant="primary" size="sm" icon={<FolderOpen size={13} />} onClick={() => setShowCampaignManager(true)}>Campanhas</Button>
            <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={handleExport}>Exportar</Button>
            <Button variant="secondary" size="sm" icon={<Upload size={13} />} onClick={handleImport} loading={importing}>Importar</Button>
            <Button variant="ghost" size="sm" icon={<Settings size={13} />} onClick={() => navigate('/settings')}>Configurações</Button>
          </div>
        </div>

        {/* Jogadores */}
        <div style={{ ...card, gap: 0 }}>
          <div style={cardHeader}>
            <span style={cardTitle}>Jogadores</span>
            <Button variant="ghost" size="sm" onClick={() => navigate('/players')}>
              Gerenciar <ChevronRight size={13} />
            </Button>
          </div>
          {players.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum jogador cadastrado.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {players.map((p) => {
                const char = characters.find((c) => c.id === p.characterId);
                const isOnline = p.status === 'online';
                return (
                  <div key={p.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '6px 8px', borderRadius: 'var(--radius)',
                    background: isOnline ? 'rgba(34,197,94,0.06)' : 'transparent',
                  }}>
                    <Avatar name={char?.name ?? p.name} src={char?.avatar} size={34} color={p.color} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      {char && (
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {char.name}
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      <Circle size={7} fill={isOnline ? 'var(--success)' : '#6b7280'} color="transparent" />
                      <span style={{ fontSize: 11, color: isOnline ? 'var(--success)' : 'var(--text-muted)', fontWeight: 500 }}>
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Combate ativo */}
      {activeCombat && activeCombat.status === 'active' && (
        <div style={{ ...card, borderColor: 'rgba(239,68,68,0.4)', borderLeftWidth: 3 }}>
          <div style={cardHeader}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Swords size={15} color="var(--danger)" />
              <span style={cardTitle}>{activeCombat.name}</span>
              <span style={{
                fontSize: 11, fontWeight: 600, color: 'var(--danger)',
                background: 'rgba(239,68,68,0.1)', borderRadius: 4, padding: '2px 7px',
              }}>
                Rodada {activeCombat.globalTurn}
              </span>
              <span style={{
                fontSize: 11, color: 'var(--text-muted)',
                background: 'var(--bg-elevated)', borderRadius: 4, padding: '2px 7px',
              }}>
                {activeCombat.displacementMode === 'rule' ? 'Modo Regra' : 'Modo Livre'}
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/combat')}>
              Abrir <ChevronRight size={13} />
            </Button>
          </div>

          <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {currentChar && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', borderRadius: 'var(--radius)',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
              }}>
                <Avatar name={currentChar.name} src={currentChar.avatar} size={36} />
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--danger)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vez de</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>{currentChar.name}</div>
                </div>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', flex: 1 }}>
              {activeCombat.participants.map((p, idx) => {
                const ch = characters.find((c) => c.id === p.characterId);
                if (!ch) return null;
                const isCurrent = idx === activeCombat.currentIndex;
                return (
                  <div key={p.uid} title={ch.name} style={{
                    opacity: isCurrent ? 1 : 0.45,
                    transform: isCurrent ? 'scale(1.12)' : 'scale(1)',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}>
                    <Avatar name={ch.name} src={ch.avatar} size={26} />
                    {isCurrent && (
                      <div style={{
                        position: 'absolute', bottom: -1, right: -1,
                        width: 7, height: 7, borderRadius: '50%',
                        background: 'var(--danger)', border: '1.5px solid var(--bg-surface)',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
              {activeCombat.participants.length} participante{activeCombat.participants.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
      )}

      {showCampaignManager && (
        <CampaignManagerModal
          onClose={() => setShowCampaignManager(false)}
          onRefresh={async () => { await refreshAll(); setShowCampaignManager(false); }}
        />
      )}

      <Modal open={!!passwordCampaign} onClose={() => setPasswordCampaign(null)} title="Trocar senha da campanha" width={420}>
        {passwordCampaign && (
          <CampaignPasswordChangeForm
            campaign={passwordCampaign}
            onDone={() => setPasswordCampaign(null)}
          />
        )}
      </Modal>

      {/* Atividade recente */}
      <div style={{ ...card, gap: 0 }}>
        <div style={cardHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <Clock size={14} color="var(--text-muted)" />
            <span style={cardTitle}>Atividade recente</span>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/history')}>Ver tudo</Button>
        </div>
        {recentEvents.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhuma atividade ainda.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {recentEvents.map((e, i) => (
              <div key={e.id} style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '9px 0',
                borderBottom: i < recentEvents.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13, color: 'var(--text-primary)', margin: 0 }}>{e.description}</p>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    {new Date(e.createdAt).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius-lg)',
  padding: 20,
  display: 'flex',
  flexDirection: 'column',
};

const cardHeader: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 14,
};

const cardTitle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text-primary)',
};
