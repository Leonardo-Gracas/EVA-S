import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import { Plus, Trash2, Edit2, UserCheck, User, Check } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import { Player, CreatePlayerDTO, PlayerPermission } from '../types';
import Button from '../components/common/Button';
import Modal from '../components/common/Modal';
import { Input, Select } from '../components/common/Input';
import Badge from '../components/common/Badge';
import PageHeader from '../components/common/PageHeader';

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4',
];

interface PlayerFormData {
  name: string;
  color: string;
  permission: PlayerPermission;
  characterIds: string[];
}

const defaultForm: PlayerFormData = {
  name: '',
  color: COLORS[0],
  permission: 'player',
  characterIds: [],
};

export default function Players() {
  useTitle('Jogadores');
  const { players, characters, dispatch } = useApp();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Player | null>(null);
  const [form, setForm] = useState<PlayerFormData>(defaultForm);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Partial<PlayerFormData>>({});

  const pcOptions = characters.filter((c) => c.type === 'pc');

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setErrors({});
    setModalOpen(true);
  };

  const openEdit = (player: Player) => {
    setEditing(player);
    const linked = characters.filter((c) => c.playerId === player.id).map((c) => c.id);
    setForm({
      name: player.name,
      color: player.color,
      permission: player.permission,
      characterIds: linked,
    });
    setErrors({});
    setModalOpen(true);
  };

  const toggleCharacter = (charId: string) => {
    setForm((f) => ({
      ...f,
      characterIds: f.characterIds.includes(charId)
        ? f.characterIds.filter((id) => id !== charId)
        : [...f.characterIds, charId],
    }));
  };

  const validate = (): boolean => {
    const e: Partial<PlayerFormData> = {};
    if (!form.name.trim()) (e as any).name = 'Nome obrigatorio';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const dto: CreatePlayerDTO = {
        name: form.name.trim(),
        color: form.color,
        permission: form.permission,
        characterId: null,
      };

      let savedPlayer: Player;
      if (editing) {
        savedPlayer = await api.players.update(editing.id, dto);
        dispatch({ type: 'UPDATE_PLAYER', payload: savedPlayer });
      } else {
        savedPlayer = await api.players.create(dto);
        dispatch({ type: 'UPDATE_PLAYER', payload: savedPlayer });
      }

      // Update character assignments
      await api.players.setCharacters(savedPlayer.id, form.characterIds);
      // Refresh characters in context
      const updatedChars = await api.characters.list();
      updatedChars.forEach((c) => dispatch({ type: 'UPDATE_CHARACTER', payload: c }));

      setModalOpen(false);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (player: Player) => {
    if (!confirm(`Remover jogador "${player.name}"?`)) return;
    try {
      await api.players.delete(player.id);
      dispatch({ type: 'REMOVE_PLAYER', payload: player.id });
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={styles.page}>
      <PageHeader
        title="Jogadores"
        subtitle={`${players.length} jogador${players.length !== 1 ? 'es' : ''} cadastrado${players.length !== 1 ? 's' : ''}`}
        actions={
          <Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Novo Jogador
          </Button>
        }
      />

      {players.length === 0 ? (
        <div style={styles.empty}>
          <User size={40} color="var(--text-muted)" />
          <p>Nenhum jogador cadastrado ainda.</p>
          <Button variant="primary" icon={<Plus size={14} />} onClick={openCreate}>
            Criar primeiro jogador
          </Button>
        </div>
      ) : (
        <div style={styles.grid}>
          {players.map((player) => {
            const linked = characters.filter((c) => c.playerId === player.id && c.type === 'pc');
            return (
              <div key={player.id} style={styles.card}>
                <div style={{ ...styles.stripe, background: player.color }} />
                <div style={styles.cardBody}>
                  <div style={styles.cardTop}>
                    <div style={{ ...styles.avatar, background: `${player.color}30`, border: `2px solid ${player.color}` }}>
                      <span style={{ color: player.color, fontWeight: 700, fontSize: '16px' }}>
                        {player.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div style={styles.cardActions}>
                      <Button variant="ghost" size="sm" icon={<Edit2 size={13} />} onClick={() => openEdit(player)} />
                      <Button variant="ghost" size="sm" icon={<Trash2 size={13} />}
                        style={{ color: 'var(--error)' }} onClick={() => handleDelete(player)} />
                    </div>
                  </div>

                  <div style={styles.cardInfo}>
                    <span style={styles.playerName}>{player.name}</span>
                    <div style={styles.badges}>
                      <Badge
                        label={player.permission === 'gm' ? 'Mestre' : 'Jogador'}
                        color={player.permission === 'gm' ? 'var(--warning)' : 'var(--text-secondary)'}
                        bg={player.permission === 'gm' ? 'rgba(245,158,11,0.15)' : 'var(--bg-elevated)'}
                        size="sm"
                      />
                      <Badge
                        label={player.status === 'online' ? 'Online' : 'Offline'}
                        color={player.status === 'online' ? 'var(--success)' : 'var(--text-muted)'}
                        bg={player.status === 'online' ? 'rgba(34,197,94,0.15)' : 'var(--bg-elevated)'}
                        dot
                        size="sm"
                      />
                    </div>
                    {linked.length > 0 ? (
                      <div style={styles.charList}>
                        {linked.map((c) => (
                          <div key={c.id} style={styles.characterLink}>
                            <UserCheck size={12} color="var(--accent)" />
                            <span style={styles.characterName}>{c.name}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={styles.noCharacter}>Sem personagem vinculado</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Editar Jogador' : 'Novo Jogador'}
      >
        <div style={styles.form}>
          <Input
            label="Nome do jogador"
            placeholder="Ex: Joao Silva"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            error={(errors as any).name}
          />

          <Select
            label="Permissao"
            value={form.permission}
            onChange={(e) => setForm({ ...form, permission: e.target.value as PlayerPermission })}
            options={[
              { value: 'player', label: 'Jogador' },
              { value: 'gm', label: 'Mestre' },
            ]}
          />

          {/* Multi-character selector */}
          <div>
            <label style={styles.sectionLabel}>
              Personagens vinculados
              <span style={styles.sectionHint}> (maximo 3)</span>
            </label>
            {pcOptions.length === 0 ? (
              <p style={styles.noCharsHint}>Nenhum personagem PC criado ainda.</p>
            ) : (
              <div style={styles.charCheckList}>
                {pcOptions.map((c) => {
                  const checked = form.characterIds.includes(c.id);
                  const disabledByOther = !checked && characters.find((ch) => ch.id === c.id)?.playerId
                    && characters.find((ch) => ch.id === c.id)?.playerId !== (editing?.id ?? '');
                  const disabledByMax = !checked && form.characterIds.length >= 3;
                  const disabled = !!disabledByOther || disabledByMax;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      disabled={disabled}
                      onClick={() => !disabled && toggleCharacter(c.id)}
                      style={{
                        ...styles.charCheckItem,
                        opacity: disabled ? 0.4 : 1,
                        borderColor: checked ? 'var(--accent)' : 'var(--border)',
                        background: checked ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      }}
                    >
                      <div style={{
                        ...styles.checkBox,
                        background: checked ? 'var(--accent)' : 'transparent',
                        borderColor: checked ? 'var(--accent)' : 'var(--border)',
                      }}>
                        {checked && <Check size={11} color="white" />}
                      </div>
                      {c.avatar && (
                        <img src={c.avatar} alt={c.name} style={{ ...styles.charThumb, objectPosition: c.avatarPosition }} />
                      )}
                      <span style={styles.charCheckName}>{c.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div>
            <label style={styles.colorLabel}>Cor identificadora</label>
            <div style={styles.colorGrid}>
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  style={{
                    ...styles.colorSwatch,
                    background: c,
                    outline: form.color === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '2px',
                    transform: form.color === c ? 'scale(1.15)' : 'scale(1)',
                  }}
                  onClick={() => setForm({ ...form, color: c })}
                />
              ))}
            </div>
          </div>

          <div style={styles.formActions}>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancelar</Button>
            <Button variant="primary" loading={saving} onClick={handleSave}>
              {editing ? 'Salvar alteracoes' : 'Criar jogador'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

const styles: Record<string, any> = {
  page: { padding: '28px', display: 'flex', flexDirection: 'column', gap: '0', maxWidth: '1100px' },
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '16px', color: 'var(--text-muted)', padding: '60px 0', textAlign: 'center',
  },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '14px' },
  card: {
    background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)', overflow: 'hidden', position: 'relative',
    transition: 'border-color var(--transition)',
  },
  stripe: { height: '4px', width: '100%' },
  cardBody: { padding: '16px' },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' },
  avatar: {
    width: '44px', height: '44px', borderRadius: 'var(--radius)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  cardActions: { display: 'flex', gap: '2px' },
  cardInfo: { display: 'flex', flexDirection: 'column', gap: '8px' },
  playerName: { fontSize: '15px', fontWeight: 600, color: 'var(--text-primary)' },
  badges: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  charList: { display: 'flex', flexDirection: 'column', gap: '4px' },
  characterLink: { display: 'flex', alignItems: 'center', gap: '5px' },
  characterName: { fontSize: '12px', color: 'var(--accent)', fontWeight: 500 },
  noCharacter: { fontSize: '12px', color: 'var(--text-muted)' },
  form: { display: 'flex', flexDirection: 'column', gap: '16px' },
  sectionLabel: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' },
  sectionHint: { fontWeight: 400, color: 'var(--text-muted)' },
  noCharsHint: { fontSize: '12px', color: 'var(--text-muted)', padding: '8px 0' },
  charCheckList: { display: 'flex', flexDirection: 'column', gap: '6px' },
  charCheckItem: {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '8px 10px', borderRadius: 'var(--radius)',
    border: '1px solid', cursor: 'pointer',
    transition: 'all var(--transition)', background: 'none',
    width: '100%', textAlign: 'left',
  },
  checkBox: {
    width: '16px', height: '16px', borderRadius: '4px',
    border: '1.5px solid', display: 'flex', alignItems: 'center',
    justifyContent: 'center', flexShrink: 0, transition: 'all var(--transition)',
  },
  charThumb: {
    width: '24px', height: '24px', borderRadius: '4px', objectFit: 'cover', flexShrink: 0,
  },
  charCheckName: { flex: 1, fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 },
  colorLabel: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' },
  colorGrid: { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  colorSwatch: {
    width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer',
    transition: 'transform var(--transition)', border: 'none',
  },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '8px' },
};
