import React, { useState } from 'react';
import { useTitle } from '../hooks/useTitle';
import { useApp } from '../contexts/AppContext';
import PageHeader from '../components/common/PageHeader';
import { Clock, ChevronLeft, ChevronRight } from 'lucide-react';
import { timeAgo } from '../utils/timeAgo';

const PAGE_SIZE = 20;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const TYPE_COLORS: Record<string, string> = {
  'request:approved': '#22c55e',
  'request:denied': '#ef4444',
  'character:created': '#6366f1',
  'character:updated': '#3b82f6',
  'skill:trigger': '#f59e0b',
  'resource:change': '#ef4444',
};

const TYPE_LABELS: Record<string, string> = {
  'request:approved': 'Solicitação aprovada',
  'request:denied': 'Solicitação negada',
  'character:created': 'Personagem criado',
  'character:updated': 'Personagem atualizado',
  'skill:trigger': 'Habilidade usada',
  'resource:change': 'Recurso alterado',
};

export default function History() {
  useTitle('Histórico');
  const { history } = useApp();
  const [page, setPage] = useState(0);

  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const slice = history.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={s.page}>
      <PageHeader
        title="Histórico"
        subtitle={`${history.length} evento${history.length !== 1 ? 's' : ''}`}
      />

      {history.length === 0 ? (
        <div style={s.empty}>
          <Clock size={36} color="var(--text-muted)" />
          <p>Nenhum evento registrado ainda.</p>
        </div>
      ) : (
        <>
          <div style={s.timeline}>
            {slice.map((ev, i) => {
              const color = TYPE_COLORS[ev.type] ?? 'var(--text-muted)';
              const label = TYPE_LABELS[ev.type] ?? ev.type;
              return (
                <div key={ev.id} style={{ ...s.item, ...(i === 0 ? {} : {}) }}>
                  <div style={{ ...s.dot, background: color }} />
                  <div style={s.line} />
                  <div style={s.content}>
                    <div style={s.row}>
                      <span style={{ ...s.tag, color, background: `${color}18` }}>{label}</span>
                      <span style={s.time} title={formatDate(ev.createdAt)}>{timeAgo(ev.createdAt)}</span>
                    </div>
                    <p style={s.desc}>{ev.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div style={s.pager}>
              <button
                style={{ ...s.pageBtn, opacity: page === 0 ? 0.4 : 1 }}
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                <ChevronLeft size={15} />
                Anterior
              </button>

              <div style={s.pageInfo}>
                <span style={s.pageNum}>
                  Página <strong>{page + 1}</strong> de <strong>{totalPages}</strong>
                </span>
                <span style={s.pageRange}>
                  eventos {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, history.length)}
                </span>
              </div>

              <button
                style={{ ...s.pageBtn, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próxima
                <ChevronRight size={15} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const s: Record<string, React.CSSProperties> = {
  page: { padding: '28px', display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '780px' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 0', color: 'var(--text-muted)', textAlign: 'center' },
  timeline: { display: 'flex', flexDirection: 'column', gap: '0' },
  item: { display: 'grid', gridTemplateColumns: '16px 2px 1fr', gap: '0 12px', paddingBottom: '16px' },
  dot: { width: 10, height: 10, borderRadius: '50%', marginTop: 4, alignSelf: 'start', gridColumn: 1, gridRow: 1 },
  line: { gridColumn: 1, gridRow: 2, width: 2, background: 'var(--border)', margin: '4px auto 0', height: '100%' },
  content: { gridColumn: 3, gridRow: '1 / 3', paddingBottom: 4 },
  row: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' },
  tag: { fontSize: '11px', fontWeight: 600, padding: '2px 7px', borderRadius: '100px' },
  time: { fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' },
  desc: { fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5', margin: 0 },
  pager: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 16px', background: 'var(--bg-surface)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
  },
  pageBtn: {
    display: 'inline-flex', alignItems: 'center', gap: '6px',
    padding: '7px 14px', background: 'var(--bg-elevated)', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)', cursor: 'pointer', fontSize: '13px', color: 'var(--text-secondary)',
  },
  pageInfo: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' },
  pageNum: { fontSize: '13px', color: 'var(--text-primary)' },
  pageRange: { fontSize: '11px', color: 'var(--text-muted)' },
};
