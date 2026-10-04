import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import { Check, X, Clock, CheckCircle, XCircle, Inbox, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import { CharacterRequest, CharacterRequestStatus } from '../types';
import PageHeader from '../components/common/PageHeader';
import { RequestDiff } from '../components/common/RequestDiff';
import { timeAgo } from '../utils/timeAgo';

const RESOLVED_PAGE_SIZE = 10;

const TYPE_LABELS: Record<string, string> = {
  resource_change: 'Mudança de recurso',
  skill_create: 'Nova habilidade',
  skill_update: 'Edição de habilidade',
  skill_delete: 'Remoção de habilidade',
  character_update: 'Edição de personagem',
  item_add: 'Adicionar item',
  item_update: 'Editar item',
  item_equip: 'Equipar/desequipar',
  item_remove: 'Remover item',
  item_use: 'Usar item',
  spell_cast: 'Conjuração',
  skill_trigger: 'Engatilhar habilidade',
  skill_charge: 'Gastar uso de habilidade',
  rest: 'Descanso',
};

const STATUS_ICON: Record<CharacterRequestStatus, React.ReactNode> = {
  pending: <Clock size={14} color="var(--text-muted)" />,
  approved: <CheckCircle size={14} color="var(--success)" />,
  denied: <XCircle size={14} color="var(--error)" />,
  free: <Zap size={14} color="#22c55e" />,
};

const STATUS_LABEL: Record<CharacterRequestStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovada',
  denied: 'Negada',
  free: 'Ação Livre',
};


function RequestCard({ req, onReview }: { req: CharacterRequest; onReview: (id: string, action: 'approved' | 'denied') => void }) {
  const { characters } = useApp();
  const [loading, setLoading] = useState<'approved' | 'denied' | null>(null);
  const isPending = req.status === 'pending';

  const handle = async (action: 'approved' | 'denied') => {
    setLoading(action);
    try { await onReview(req.id, action); } finally { setLoading(null); }
  };

  return (
    <div style={{ ...s.card, ...(isPending ? s.cardPending : {}), ...(req.status === 'free' ? s.cardFree : {}) }}>
      <div style={s.cardHeader}>
        <div style={s.cardLeft}>
          <span style={s.playerName}>{req.playerName}</span>
          <span style={s.typeBadge}>{TYPE_LABELS[req.type] ?? req.type}</span>
        </div>
        <div style={s.cardRight}>
          <span style={s.timestamp}>{timeAgo(req.createdAt)}</span>
          <span style={s.statusChip}>
            {STATUS_ICON[req.status as CharacterRequestStatus]}
            <span style={s.statusLabel}>{STATUS_LABEL[req.status as CharacterRequestStatus] ?? req.status}</span>
          </span>
        </div>
      </div>
      <p style={s.description}>{req.description}</p>
      <RequestDiff req={req} sheetTypeId={characters.find((c) => c.id === req.characterId)?.sheetTypeId} />
      {isPending && (
        <div style={s.actions}>
          <button style={{ ...s.btn, ...s.btnApprove }} onClick={() => handle('approved')} disabled={!!loading}>
            {loading === 'approved' ? '...' : <><Check size={13} /> Aprovar</>}
          </button>
          <button style={{ ...s.btn, ...s.btnDeny }} onClick={() => handle('denied')} disabled={!!loading}>
            {loading === 'denied' ? '...' : <><X size={13} /> Negar</>}
          </button>
        </div>
      )}
    </div>
  );
}

export default function Requests() {
  useTitle('Solicitações');
  const { requests, dispatch } = useApp();
  const [showResolved, setShowResolved] = useState(false);
  const [resolvedPage, setResolvedPage] = useState(0);

  const pending = requests.filter((r) => r.status === 'pending');
  const resolved = requests.filter((r) => r.status !== 'pending');
  const resolvedTotalPages = Math.max(1, Math.ceil(resolved.length / RESOLVED_PAGE_SIZE));
  const resolvedSlice = resolved.slice(resolvedPage * RESOLVED_PAGE_SIZE, (resolvedPage + 1) * RESOLVED_PAGE_SIZE);

  const handleReview = async (id: string, action: 'approved' | 'denied') => {
    try {
      const updated = await api.requests.review(id, action);
      dispatch({ type: 'UPDATE_REQUEST', payload: updated });
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div style={s.page}>
      <PageHeader
        title="Solicitações"
        subtitle={`${pending.length} pendente${pending.length !== 1 ? 's' : ''}`}
      />

      {pending.length === 0 && (
        <div style={s.empty}>
          <Inbox size={36} color="var(--text-muted)" />
          <p>Nenhuma solicitação pendente.</p>
        </div>
      )}

      <div style={s.list}>
        {pending.map((req) => (
          <RequestCard key={req.id} req={req} onReview={handleReview} />
        ))}
      </div>

      {resolved.length > 0 && (
        <div style={s.resolvedSection}>
          <button style={s.resolvedToggle} onClick={() => { setShowResolved(v => !v); setResolvedPage(0); }}>
            {showResolved ? '▾' : '▸'} Resolvidas ({resolved.length}) • {resolved.filter(r => r.status === 'free').length} ação livre
          </button>
          {showResolved && (
            <>
              <div style={s.list}>
                {resolvedSlice.map((req) => (
                  <RequestCard key={req.id} req={req} onReview={handleReview} />
                ))}
              </div>
              {resolvedTotalPages > 1 && (
                <div style={s.pager}>
                  <button
                    style={{ ...s.pageBtn, opacity: resolvedPage === 0 ? 0.4 : 1 }}
                    onClick={() => setResolvedPage(p => Math.max(0, p - 1))}
                    disabled={resolvedPage === 0}
                  >
                    <ChevronLeft size={14} /> Anterior
                  </button>
                  <span style={s.pageInfo}>
                    {resolvedPage + 1} / {resolvedTotalPages}
                    <span style={s.pageRange}> ({resolvedPage * RESOLVED_PAGE_SIZE + 1}–{Math.min((resolvedPage + 1) * RESOLVED_PAGE_SIZE, resolved.length)} de {resolved.length})</span>
                  </span>
                  <button
                    style={{ ...s.pageBtn, opacity: resolvedPage >= resolvedTotalPages - 1 ? 0.4 : 1 }}
                    onClick={() => setResolvedPage(p => Math.min(resolvedTotalPages - 1, p + 1))}
                    disabled={resolvedPage >= resolvedTotalPages - 1}
                  >
                    Próxima <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s: Record<string, any> = {
  page: { padding: '28px', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '760px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 0', color: 'var(--text-muted)', textAlign: 'center' },
  list: { display: 'flex', flexDirection: 'column', gap: '10px' },
  card: { background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '8px' },
  cardPending: { borderLeft: '3px solid var(--accent)' },
  cardFree: { borderLeft: '3px solid #22c55e', opacity: 0.85 },
  cardHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' },
  cardLeft: { display: 'flex', alignItems: 'center', gap: '10px' },
  cardRight: { display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  playerName: { fontSize: '14px', fontWeight: 700, color: 'var(--text-primary)' },
  typeBadge: { fontSize: '11px', fontWeight: 500, padding: '2px 8px', borderRadius: '100px', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' },
  timestamp: { fontSize: '12px', color: 'var(--text-muted)' },
  statusChip: { display: 'flex', alignItems: 'center', gap: '4px' },
  statusLabel: { fontSize: '12px', color: 'var(--text-secondary)' },
  description: { fontSize: '13px', color: 'var(--text-primary)', lineHeight: 1.5, margin: 0, padding: '6px 0' },
  actions: { display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' },
  btn: { display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: 'var(--radius)', fontSize: '13px', fontWeight: 600, cursor: 'pointer', border: 'none', transition: 'all var(--transition)' },
  btnApprove: { background: 'rgba(34,197,94,0.15)', color: '#22c55e' },
  btnDeny: { background: 'rgba(239,68,68,0.1)', color: '#ef4444' },
  resolvedSection: { display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '8px' },
  resolvedToggle: { background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', color: 'var(--text-muted)', fontWeight: 500, textAlign: 'left', padding: '4px 0' },
  pager: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)' },
  pageBtn: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px 12px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' },
  pageInfo: { fontSize: '13px', color: 'var(--text-primary)' },
  pageRange: { fontSize: '11px', color: 'var(--text-muted)' },
};
