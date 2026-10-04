import React, { useState, useEffect } from 'react';
import { useTitle } from '../hooks/useTitle';
import { User, Lock, Plus, ArrowLeft, Eye, EyeOff, Check, Hourglass } from 'lucide-react';
import { Player } from '../types';
import { api } from '../services/api';
import EvaLogo from '../components/layout/EvaLogo';

interface PublicPlayer {
  id: string;
  name: string;
  color: string;
  hasPassword: boolean;
}

const COLORS = [
  '#6366f1', '#ec4899', '#f59e0b', '#22c55e',
  '#3b82f6', '#8b5cf6', '#ef4444', '#06b6d4',
];

interface Props {
  onLogin: (player: Player) => void;
}

export default function PlayerLogin({ onLogin }: Props) {
  useTitle('Acesso do Jogador');
  type Screen = 'select' | 'register';
  const [screen, setScreen] = useState<Screen>('select');
  const [publicPlayers, setPublicPlayers] = useState<PublicPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionOpen, setSessionOpen] = useState<boolean | null>(null);

  // Password prompt state
  const [pwTarget, setPwTarget] = useState<PublicPlayer | null>(null);
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [pwError, setPwError] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // Register state
  const [regName, setRegName] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [showRegPw, setShowRegPw] = useState(false);
  const [regColor, setRegColor] = useState(COLORS[0]);
  const [registering, setRegistering] = useState(false);
  const [regErrors, setRegErrors] = useState<Record<string, string>>({});

  const checkSession = () => {
    api.session.status()
      .then(({ open }) => {
        setSessionOpen(open);
        if (open) {
          fetch('/api/players/public')
            .then((r) => (r.ok ? r.json() : Promise.reject()))
            .then((data: PublicPlayer[]) => setPublicPlayers(data))
            .catch(() => {})
            .finally(() => setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    checkSession();
    const interval = setInterval(checkSession, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleSelectPlayer = (p: PublicPlayer) => {
    if (!p.hasPassword) {
      doLogin(p.id, '');
    } else {
      setPwTarget(p);
      setPassword('');
      setPwError('');
      setShowPw(false);
    }
  };

  const doLogin = async (playerId: string, pw: string) => {
    setLoggingIn(true);
    try {
      const res = await fetch('/api/players/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerId, password: pw }),
      });
      if (!res.ok) {
        const body = await res.json();
        setPwError(body.error || 'Senha incorreta');
        return;
      }
      const player: Player = await res.json();
      localStorage.setItem('rpg_player_session', JSON.stringify(player));
      onLogin(player);
    } catch {
      setPwError('Erro de conexao');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleRegister = async () => {
    const e: Record<string, string> = {};
    if (!regName.trim()) e.name = 'Nome obrigatorio';
    if (regPassword && regPassword !== regConfirm) e.confirm = 'Senhas nao coincidem';
    setRegErrors(e);
    if (Object.keys(e).length > 0) return;

    setRegistering(true);
    try {
      const res = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: regName.trim(), color: regColor, permission: 'player', password: regPassword }),
      });
      if (!res.ok) {
        const body = await res.json();
        setRegErrors({ name: body.error || 'Erro ao criar jogador' });
        return;
      }
      const player: Player = await res.json();
      localStorage.setItem('rpg_player_session', JSON.stringify(player));
      onLogin(player);
    } catch {
      setRegErrors({ name: 'Erro de conexao' });
    } finally {
      setRegistering(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        {/* Logo */}
        <div style={s.logoRow}>
          <EvaLogo size={40} withText />
        </div>
        <div style={s.subtitle}>Acesso do Jogador</div>

        {sessionOpen === false ? (
          <div style={s.body}>
            <div style={s.emptyState}>
              <Hourglass size={32} color="var(--text-muted)" />
              <p style={s.muted}>O mestre ainda não selecionou a campanha.</p>
              <p style={{ ...s.muted, fontSize: '12px' }}>Aguarde o mestre entrar para poder fazer login.</p>
            </div>
          </div>
        ) : (
          <>
        {/* Tabs */}
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(screen === 'select' ? s.tabActive : {}) }}
            onClick={() => { setScreen('select'); setPwTarget(null); }}
          >
            Entrar
          </button>
          <button
            style={{ ...s.tab, ...(screen === 'register' ? s.tabActive : {}) }}
            onClick={() => setScreen('register')}
          >
            Criar conta
          </button>
        </div>

        {/* ── ENTRAR ── */}
        {screen === 'select' && !pwTarget && (
          <div style={s.body}>
            {loading ? (
              <p style={s.muted}>Carregando jogadores...</p>
            ) : publicPlayers.length === 0 ? (
              <div style={s.emptyState}>
                <User size={32} color="var(--text-muted)" />
                <p style={s.muted}>Nenhum jogador cadastrado ainda.</p>
                <p style={{ ...s.muted, fontSize: '12px' }}>Crie sua conta na aba "Criar conta".</p>
              </div>
            ) : (
              <div style={s.playerList}>
                {publicPlayers.map((p) => (
                  <button
                    key={p.id}
                    style={s.playerCard}
                    onClick={() => handleSelectPlayer(p)}
                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = p.color)}
                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
                  >
                    <div style={{ ...s.playerAvatar, background: `${p.color}25`, border: `2px solid ${p.color}` }}>
                      <span style={{ color: p.color, fontWeight: 700, fontSize: '16px' }}>
                        {p.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span style={s.playerName}>{p.name}</span>
                    {p.hasPassword && <Lock size={13} color="var(--text-muted)" />}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── SENHA ── */}
        {screen === 'select' && pwTarget && (
          <div style={s.body}>
            <button style={s.backBtn} onClick={() => setPwTarget(null)}>
              <ArrowLeft size={14} />
              <span>Voltar</span>
            </button>
            <div style={s.pwHeader}>
              <div style={{ ...s.playerAvatar, background: `${pwTarget.color}25`, border: `2px solid ${pwTarget.color}`, width: '52px', height: '52px' }}>
                <span style={{ color: pwTarget.color, fontWeight: 700, fontSize: '20px' }}>
                  {pwTarget.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span style={s.pwName}>{pwTarget.name}</span>
            </div>
            <div style={s.field}>
              <label style={s.label}>Senha</label>
              <div style={s.inputWrap}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setPwError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && doLogin(pwTarget.id, password)}
                  placeholder="Digite sua senha"
                  style={{ ...s.input, borderColor: pwError ? 'var(--error)' : 'var(--border)' }}
                  autoFocus
                />
                <button style={s.eyeBtn} onClick={() => setShowPw(!showPw)} type="button">
                  {showPw ? <EyeOff size={15} color="var(--text-muted)" /> : <Eye size={15} color="var(--text-muted)" />}
                </button>
              </div>
              {pwError && <span style={s.error}>{pwError}</span>}
            </div>
            <button
              style={{ ...s.primaryBtn, opacity: loggingIn ? 0.7 : 1 }}
              onClick={() => doLogin(pwTarget.id, password)}
              disabled={loggingIn}
            >
              {loggingIn ? 'Entrando...' : 'Entrar'}
            </button>
          </div>
        )}

        {/* ── CADASTRAR ── */}
        {screen === 'register' && (
          <div style={s.body}>
            <div style={s.field}>
              <label style={s.label}>Nome</label>
              <input
                type="text"
                value={regName}
                onChange={(e) => { setRegName(e.target.value); setRegErrors({}); }}
                placeholder="Seu nome"
                style={{ ...s.input, borderColor: regErrors.name ? 'var(--error)' : 'var(--border)' }}
              />
              {regErrors.name && <span style={s.error}>{regErrors.name}</span>}
            </div>

            <div style={s.field}>
              <label style={s.label}>Cor identificadora</label>
              <div style={s.colorGrid}>
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    style={{
                      ...s.colorSwatch,
                      background: c,
                      outline: regColor === c ? `3px solid ${c}` : 'none',
                      outlineOffset: '2px',
                      transform: regColor === c ? 'scale(1.2)' : 'scale(1)',
                    }}
                    onClick={() => setRegColor(c)}
                  >
                    {regColor === c && <Check size={12} color="white" />}
                  </button>
                ))}
              </div>
            </div>

            <div style={s.field}>
              <label style={s.label}>Senha <span style={s.optional}>(opcional)</span></label>
              <div style={s.inputWrap}>
                <input
                  type={showRegPw ? 'text' : 'password'}
                  value={regPassword}
                  onChange={(e) => { setRegPassword(e.target.value); setRegErrors({}); }}
                  placeholder="Deixe em branco para nenhuma"
                  style={s.input}
                />
                <button style={s.eyeBtn} onClick={() => setShowRegPw(!showRegPw)} type="button">
                  {showRegPw ? <EyeOff size={15} color="var(--text-muted)" /> : <Eye size={15} color="var(--text-muted)" />}
                </button>
              </div>
            </div>

            {regPassword && (
              <div style={s.field}>
                <label style={s.label}>Confirmar senha</label>
                <input
                  type="password"
                  value={regConfirm}
                  onChange={(e) => { setRegConfirm(e.target.value); setRegErrors({}); }}
                  placeholder="Repita a senha"
                  style={{ ...s.input, borderColor: regErrors.confirm ? 'var(--error)' : 'var(--border)' }}
                />
                {regErrors.confirm && <span style={s.error}>{regErrors.confirm}</span>}
              </div>
            )}

            <button
              style={{ ...s.primaryBtn, opacity: registering ? 0.7 : 1 }}
              onClick={handleRegister}
              disabled={registering}
            >
              <Plus size={15} />
              {registering ? 'Criando...' : 'Criar conta'}
            </button>
          </div>
        )}
          </>
        )}
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
    maxWidth: '400px',
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
  tabs: {
    display: 'flex',
    borderTop: '1px solid var(--border)',
    borderBottom: '1px solid var(--border)',
  },
  tab: {
    flex: 1,
    padding: '11px',
    background: 'transparent',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all var(--transition)',
  },
  tabActive: {
    color: 'var(--accent)',
    background: 'var(--accent-dim)',
    fontWeight: 600,
  },
  body: {
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  muted: {
    color: 'var(--text-muted)',
    fontSize: '13px',
    textAlign: 'center',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '8px',
    padding: '20px 0',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  playerCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 14px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    cursor: 'pointer',
    transition: 'border-color var(--transition)',
    width: '100%',
    textAlign: 'left',
  },
  playerAvatar: {
    width: '40px',
    height: '40px',
    borderRadius: 'var(--radius)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  playerName: {
    flex: 1,
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  backBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    cursor: 'pointer',
    padding: '0',
  },
  pwHeader: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '10px',
    padding: '8px 0',
  },
  pwName: {
    fontSize: '17px',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  label: {
    fontSize: '12px',
    fontWeight: 600,
    color: 'var(--text-secondary)',
  },
  optional: {
    fontWeight: 400,
    color: 'var(--text-muted)',
  },
  inputWrap: {
    position: 'relative',
  },
  input: {
    width: '100%',
    padding: '9px 36px 9px 12px',
    background: 'var(--bg-elevated)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius)',
    color: 'var(--text-primary)',
    fontSize: '14px',
    outline: 'none',
    boxSizing: 'border-box',
  },
  eyeBtn: {
    position: 'absolute',
    right: '10px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    padding: 0,
  },
  error: {
    fontSize: '11px',
    color: 'var(--error)',
  },
  primaryBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '7px',
    padding: '10px',
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 'var(--radius)',
    color: 'white',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'opacity var(--transition)',
    marginTop: '4px',
  },
  colorGrid: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
  },
  colorSwatch: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    cursor: 'pointer',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform var(--transition)',
  },
};
