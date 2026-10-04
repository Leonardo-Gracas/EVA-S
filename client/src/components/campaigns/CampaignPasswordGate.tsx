import React, { useState } from 'react';
import { Eye, EyeOff, ArrowLeft, ShieldCheck } from 'lucide-react';
import { SavedCampaignSummary } from '../../types';
import { api } from '../../services/api';
import Button from '../common/Button';
import { Input } from '../common/Input';

interface Props {
  campaign: { id: string; name: string; hasPassword?: boolean };
  onBack: () => void;
  onSuccess: (campaigns: SavedCampaignSummary[]) => void;
}

// Autentica a campanha (senha propria ou senha admin) e, se a senha admin foi
// usada para entrar, oferece a chance de definir uma senha nova na hora.
export default function CampaignPasswordGate({ campaign, onBack, onSuccess }: Props) {
  const [step, setStep] = useState<'password' | 'newPassword'>('password');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgot, setForgot] = useState(false);

  // Campanha que nunca teve senha propria so abre com a senha admin — nao existe
  // mais o caminho de entrar sem digitar nada. Depois de entrar, o passo
  // "definir nova senha" aparece igual (o servidor devolve isAdminOverride).
  const noPassword = campaign.hasPassword === false;
  const adminMode = noPassword || forgot;

  const [pendingCampaigns, setPendingCampaigns] = useState<SavedCampaignSummary[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [changeError, setChangeError] = useState('');
  const [changeLoading, setChangeLoading] = useState(false);

  const submitPassword = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await api.campaigns.switch(campaign.id, password);
      if (result.isAdminOverride) {
        setPendingCampaigns(result.campaigns);
        setStep('newPassword');
      } else {
        onSuccess(result.campaigns);
      }
    } catch (e: any) {
      setError(e.message ?? 'Senha incorreta');
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async () => {
    if (!newPassword || newPassword !== newPasswordConfirm) {
      setChangeError('As senhas nao coincidem');
      return;
    }
    setChangeLoading(true);
    setChangeError('');
    try {
      await api.campaigns.changePassword(campaign.id, { adminPassword: password, newPassword });
      onSuccess(pendingCampaigns);
    } catch (e: any) {
      setChangeError(e.message ?? 'Erro ao definir nova senha');
    } finally {
      setChangeLoading(false);
    }
  };

  if (step === 'newPassword') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <ShieldCheck size={16} color="var(--accent)" />
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>Definir nova senha</span>
        </div>
        <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0 }}>
          Voce entrou em "{campaign.name}" com a senha admin. Defina uma nova senha para esta campanha (ou pule por agora).
        </p>
        <Input
          label="Nova senha"
          type="password"
          value={newPassword}
          onChange={(e) => { setNewPassword(e.target.value); setChangeError(''); }}
          placeholder="Nova senha da campanha"
        />
        <Input
          label="Confirmar nova senha"
          type="password"
          value={newPasswordConfirm}
          onChange={(e) => { setNewPasswordConfirm(e.target.value); setChangeError(''); }}
          placeholder="Repita a nova senha"
        />
        {changeError && <span style={{ fontSize: 11, color: 'var(--error)' }}>{changeError}</span>}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button variant="ghost" size="sm" onClick={() => onSuccess(pendingCampaigns)}>Pular por agora</Button>
          <Button variant="primary" size="sm" loading={changeLoading} onClick={submitNewPassword}>Salvar senha</Button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', padding: 4 }}>
          <ArrowLeft size={16} />
        </button>
        <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{campaign.name}</span>
      </div>

      <div style={{ position: 'relative' }}>
        <input
          type={showPw ? 'text' : 'password'}
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(''); }}
          onKeyDown={(e) => e.key === 'Enter' && submitPassword()}
          placeholder={adminMode ? 'Senha admin' : 'Senha da campanha'}
          autoFocus
          style={{
            width: '100%', padding: '9px 36px 9px 12px', background: 'var(--bg-elevated)',
            border: `1px solid ${error ? 'var(--error)' : 'var(--border)'}`, borderRadius: 'var(--radius)',
            color: 'var(--text-primary)', fontSize: 14, outline: 'none', boxSizing: 'border-box',
          }}
        />
        <button
          onClick={() => setShowPw((v) => !v)}
          type="button"
          style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', padding: 0 }}
        >
          {showPw ? <EyeOff size={15} color="var(--text-muted)" /> : <Eye size={15} color="var(--text-muted)" />}
        </button>
      </div>

      {error && <span style={{ fontSize: 11, color: 'var(--error)' }}>{error}</span>}

      {!noPassword && (
        <button
          onClick={() => setForgot((v) => !v)}
          type="button"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: 0, textAlign: 'left' }}
        >
          {forgot ? 'Voltar a senha normal' : 'Esqueci a senha desta campanha'}
        </button>
      )}
      {adminMode && (
        <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: 0 }}>
          {noPassword
            ? 'Esta campanha ainda nao tem senha propria. Entre com a senha de administrador para abri-la e definir uma agora.'
            : 'Digite a senha de administrador acima para entrar e poder definir uma nova senha.'}
        </p>
      )}

      <Button variant="primary" size="sm" loading={loading} onClick={submitPassword}>
        Entrar
      </Button>
    </div>
  );
}
