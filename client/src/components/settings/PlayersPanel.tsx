import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Crown, User } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import Badge from '../common/Badge';
import Button from '../common/Button';

export default function PlayersPanel() {
  const navigate = useNavigate();
  const { players, characters, sheetTypes, dispatch } = useApp();

  const changeCharacterType = async (characterId: string, sheetTypeId: string) => {
    const updated = await api.characters.update(characterId, { sheetTypeId } as any);
    dispatch({ type: 'UPDATE_CHARACTER', payload: updated });
  };

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <p style={s.sub}>
          Jogadores da campanha e o tipo de ficha de cada personagem. Para criar, remover ou editar cor/vínculo de jogadores, use a página completa.
        </p>
        <Button variant="secondary" size="sm" icon={<ArrowRight size={13} />} onClick={() => navigate('/players')}>
          Gerenciar jogadores
        </Button>
      </div>

      {players.length === 0 ? (
        <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Nenhum jogador cadastrado ainda.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {players.map((p) => {
            const linked = characters.filter((c) => c.playerId === p.id && c.type === 'pc');
            return (
              <div key={p.id} style={s.row}>
                <div style={s.rowHeader}>
                  <span style={{ ...s.dot, background: p.color }} />
                  <span style={s.name}>{p.name}</span>
                  <Badge
                    label={p.permission === 'gm' ? 'Mestre' : 'Jogador'}
                    color={p.permission === 'gm' ? '#f59e0b' : 'var(--text-secondary)'}
                    bg={p.permission === 'gm' ? '#f59e0b20' : 'var(--bg-elevated)'}
                    size="sm"
                  />
                  {p.permission === 'gm' ? <Crown size={12} color="#f59e0b" /> : <User size={12} color="var(--text-muted)" />}
                  <div style={{ flex: 1 }} />
                  <span style={{ fontSize: 11, color: p.status === 'online' ? 'var(--success)' : 'var(--text-muted)' }}>
                    {p.status === 'online' ? 'Online' : 'Offline'}
                  </span>
                </div>
                {linked.length === 0 ? (
                  <p style={s.noChar}>Nenhum personagem vinculado.</p>
                ) : (
                  <div style={s.charList}>
                    {linked.map((c) => (
                      <div key={c.id} style={s.charRow}>
                        <span style={s.charName}>{c.name}</span>
                        {sheetTypes.length > 1 ? (
                          <select
                            value={c.sheetTypeId}
                            onChange={(e) => changeCharacterType(c.id, e.target.value)}
                            style={s.select}
                            title="Tipo de ficha"
                          >
                            {sheetTypes.map((st) => <option key={st.id} value={st.id}>{st.name}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{sheetTypes[0]?.name}</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const s: Record<string, any> = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 16 },
  header: { display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  sub: { flex: 1, minWidth: 220, fontSize: 12, color: 'var(--text-muted)', margin: 0, lineHeight: 1.6 },
  row: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8 },
  rowHeader: { display: 'flex', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  name: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' },
  noChar: { fontSize: 12, color: 'var(--text-muted)', margin: 0, paddingLeft: 18 },
  charList: { display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18 },
  charRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-sm)' },
  charName: { flex: 1, fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 },
  select: {
    padding: '4px 8px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 12,
  },
};
