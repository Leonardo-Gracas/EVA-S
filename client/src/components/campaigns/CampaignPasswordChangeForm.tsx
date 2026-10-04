import React, { useState } from 'react';
import { Check } from 'lucide-react';
import { api } from '../../services/api';
import Button from '../common/Button';
import { Input } from '../common/Input';

interface Props {
  campaign: { id: string; name: string; hasPassword: boolean };
  onDone: () => void;
}

export default function CampaignPasswordChangeForm({ campaign, onDone }: Props) {
  const [useAdmin, setUseAdmin] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const handle = async () => {
    if (newPassword !== newPasswordConfirm) { setError('As senhas não coincidem'); return; }
    setLoading(true);
    setError('');
    try {
      await api.campaigns.changePassword(campaign.id, {
        ...(useAdmin ? { adminPassword: currentPassword } : { currentPassword }),
        newPassword,
      });
      setDone(true);
    } catch (e: any) {
      setError(e.message ?? 'Erro ao trocar a senha');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'center', textAlign: 'center', padding: '12px 0' }}>
        <Check size={28} color="var(--success)" />
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)' }}>Senha de "{campaign.name}" atualizada.</span>
        <Button variant="primary" size="sm" onClick={onDone}>Voltar</Button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {campaign.hasPassword && (
        <Input
          label={useAdmin ? 'Senha admin' : 'Senha atual'}
          type="password"
          value={currentPassword}
          onChange={(e) => { setCurrentPassword(e.target.value); setError(''); }}
          placeholder={useAdmin ? 'Senha de administrador' : 'Senha atual da campanha'}
          autoFocus
        />
      )}

      {campaign.hasPassword && (
        <button
          onClick={() => { setUseAdmin((v) => !v); setCurrentPassword(''); setError(''); }}
          type="button"
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--accent)', fontSize: 12, fontWeight: 600, padding: 0, textAlign: 'left' }}
        >
          {useAdmin ? 'Sei a senha atual' : 'Esqueci a senha atual (usar senha admin)'}
        </button>
      )}

      <Input
        label="Nova senha"
        type="password"
        value={newPassword}
        onChange={(e) => { setNewPassword(e.target.value); setError(''); }}
        placeholder="Deixe em branco para remover a senha"
      />
      <Input
        label="Confirmar nova senha"
        type="password"
        value={newPasswordConfirm}
        onChange={(e) => { setNewPasswordConfirm(e.target.value); setError(''); }}
        placeholder="Repita a nova senha"
      />

      {error && <span style={{ fontSize: 11, color: 'var(--error)' }}>{error}</span>}

      <Button variant="primary" size="sm" loading={loading} onClick={handle}>Salvar nova senha</Button>
    </div>
  );
}
