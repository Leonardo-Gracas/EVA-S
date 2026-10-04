import React, { useState, useEffect, useCallback } from 'react';
import { useTitle } from '../hooks/useTitle';
import {
  Calendar, Target, Plus, Trash2, Edit2, Save, X,
  Check, ChevronDown, ChevronUp, Circle, Flag, Clock, Users,
} from 'lucide-react';
import { useApp } from '../contexts/AppContext';
import { api } from '../services/api';
import Button from '../components/common/Button';
import { Input, Textarea } from '../components/common/Input';
import { CampaignEvent, CampaignGoal, GoalPriority, GoalStatus } from '../types';

// ── constants ────────────────────────────────────────────────────────────────

const EVENT_TAGS = ['Combate', 'Política', 'Drama', 'Exploração', 'Mistério', 'Social', 'Revelação', 'Morte'];

const PRIORITY_LABELS: Record<GoalPriority, string> = { high: 'Alta', medium: 'Média', low: 'Baixa' };
const PRIORITY_COLORS: Record<GoalPriority, string> = { high: '#ef4444', medium: '#f59e0b', low: '#6b7280' };

// ── helpers ──────────────────────────────────────────────────────────────────

function Tag({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
      background: 'var(--bg-elevated)', color: 'var(--text-secondary)',
      border: '1px solid var(--border)',
    }}>
      {label}
      {onRemove && (
        <button onClick={onRemove} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}>
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function SectionHeader({ label, count, action }: { label: string; count?: number; action?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' }}>{label}</span>
        {count !== undefined && (
          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-elevated)', borderRadius: 99, padding: '1px 7px', border: '1px solid var(--border)' }}>
            {count}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

function emptyCard(msg: string) {
  return (
    <div style={{ textAlign: 'center', padding: '28px 16px', color: 'var(--text-muted)', fontSize: 13 }}>
      {msg}
    </div>
  );
}

// ── EVENTS TAB ───────────────────────────────────────────────────────────────

function EventsTab() {
  const [events, setEvents] = useState<CampaignEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filterSession, setFilterSession] = useState<number | ''>('');
  const [filterHappened, setFilterHappened] = useState<'all' | 'happened' | 'upcoming'>('all');

  // Form state
  const [form, setForm] = useState({ title: '', description: '', eventDate: '', sessionNumber: '', tags: [] as string[], happened: false });

  const load = useCallback(async () => {
    try { setEvents(await api.campaignEvents.list()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ title: '', description: '', eventDate: '', sessionNumber: '', tags: [], happened: false });

  const startCreate = () => { resetForm(); setCreating(true); setEditingId(null); };

  const startEdit = (e: CampaignEvent) => {
    setForm({
      title: e.title,
      description: e.description,
      eventDate: e.eventDate ?? '',
      sessionNumber: e.sessionNumber != null ? String(e.sessionNumber) : '',
      tags: [...e.tags],
      happened: e.happened,
    });
    setEditingId(e.id);
    setCreating(false);
    setExpandedId(e.id);
  };

  const save = async () => {
    const dto = {
      title: form.title.trim(),
      description: form.description,
      eventDate: form.eventDate || null,
      sessionNumber: form.sessionNumber ? parseInt(form.sessionNumber) : null,
      tags: form.tags,
      happened: form.happened,
    };
    if (!dto.title) return;
    if (creating) {
      const ev = await api.campaignEvents.create(dto);
      setEvents(prev => [...prev, ev]);
      setCreating(false);
    } else if (editingId) {
      const ev = await api.campaignEvents.update(editingId, dto);
      setEvents(prev => prev.map(e => e.id === editingId ? ev : e));
      setEditingId(null);
    }
    resetForm();
  };

  const toggleHappened = async (ev: CampaignEvent) => {
    const updated = await api.campaignEvents.update(ev.id, { happened: !ev.happened });
    setEvents(prev => prev.map(e => e.id === ev.id ? updated : e));
  };

  const del = async (id: string) => {
    if (!confirm('Remover este evento?')) return;
    await api.campaignEvents.delete(id);
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  const toggleTag = (tag: string) => {
    setForm(f => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
    }));
  };

  const sessions = [...new Set(events.map(e => e.sessionNumber).filter(Boolean))].sort((a, b) => (a ?? 0) - (b ?? 0)) as number[];

  const filtered = events.filter(ev => {
    if (filterSession !== '' && ev.sessionNumber !== filterSession) return false;
    if (filterHappened === 'happened' && !ev.happened) return false;
    if (filterHappened === 'upcoming' && ev.happened) return false;
    return true;
  });

  const grouped: Record<string, CampaignEvent[]> = {};
  filtered.forEach(ev => {
    const key = ev.sessionNumber != null ? `Sessão ${ev.sessionNumber}` : 'Sem sessão';
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(ev);
  });

  const FormPanel = (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 16, marginBottom: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Input label="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Data do evento</label>
            <input type="date" value={form.eventDate} onChange={e => setForm(f => ({ ...f, eventDate: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }} />
          </div>
          <div style={{ width: 90 }}>
            <Input label="Sessão nº" type="number" value={form.sessionNumber} onChange={e => setForm(f => ({ ...f, sessionNumber: e.target.value }))} />
          </div>
        </div>
      </div>
      <Textarea label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} />
      <div style={{ marginTop: 10, marginBottom: 10 }}>
        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 6 }}>Tags</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {EVENT_TAGS.map(tag => (
            <button key={tag} onClick={() => toggleTag(tag)} style={{
              fontSize: 11, padding: '3px 10px', borderRadius: 99, cursor: 'pointer', fontWeight: 600,
              border: '1px solid var(--border)',
              background: form.tags.includes(tag) ? 'var(--accent)' : 'var(--bg-surface)',
              color: form.tags.includes(tag) ? '#fff' : 'var(--text-secondary)',
            }}>{tag}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: 'var(--text-secondary)' }}>
          <input type="checkbox" checked={form.happened} onChange={e => setForm(f => ({ ...f, happened: e.target.checked }))} />
          Já aconteceu
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={() => { setCreating(false); setEditingId(null); resetForm(); }}>Cancelar</Button>
          <Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save} disabled={!form.title.trim()}>Salvar</Button>
        </div>
      </div>
    </div>
  );

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</p>;

  return (
    <div>
      <SectionHeader
        label="Eventos" count={events.length}
        action={<Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={startCreate}>Novo evento</Button>}
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {['all', 'happened', 'upcoming'].map(f => (
          <button key={f} onClick={() => setFilterHappened(f as any)} style={{
            fontSize: 12, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', fontWeight: 600,
            border: '1px solid var(--border)',
            background: filterHappened === f ? 'var(--accent)' : 'transparent',
            color: filterHappened === f ? '#fff' : 'var(--text-secondary)',
          }}>
            {f === 'all' ? 'Todos' : f === 'happened' ? 'Ocorridos' : 'Por acontecer'}
          </button>
        ))}
        {sessions.length > 0 && (
          <select value={filterSession} onChange={e => setFilterSession(e.target.value === '' ? '' : parseInt(e.target.value))}
            style={{ fontSize: 12, padding: '4px 10px', borderRadius: 99, border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <option value="">Todas as sessões</option>
            {sessions.map(s => <option key={s} value={s}>Sessão {s}</option>)}
          </select>
        )}
      </div>

      {creating && FormPanel}

      {filtered.length === 0 && !creating && emptyCard('Nenhum evento encontrado. Registre os acontecimentos da campanha!')}

      {Object.entries(grouped).map(([group, evs]) => (
        <div key={group} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>{group}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {evs.map(ev => (
              <div key={ev.id}>
                {editingId === ev.id ? FormPanel : (
                  <div style={{
                    background: 'var(--bg-surface)', border: '1px solid var(--border)',
                    borderLeft: `3px solid ${ev.happened ? 'var(--success)' : 'var(--accent)'}`,
                    borderRadius: 'var(--radius-lg)', overflow: 'hidden',
                    opacity: ev.happened ? 0.8 : 1,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer' }}
                      onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)}>
                      <button onClick={e => { e.stopPropagation(); toggleHappened(ev); }} title={ev.happened ? 'Marcar como pendente' : 'Marcar como ocorrido'}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', flexShrink: 0 }}>
                        {ev.happened
                          ? <Check size={16} color="var(--success)" />
                          : <Circle size={16} color="var(--text-muted)" />}
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 14, fontWeight: 600, color: ev.happened ? 'var(--text-secondary)' : 'var(--text-primary)', textDecoration: ev.happened ? 'line-through' : 'none' }}>
                            {ev.title}
                          </span>
                          {ev.eventDate && (
                            <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                              <Clock size={10} /> {new Date(ev.eventDate + 'T00:00').toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>
                        {ev.tags.length > 0 && (
                          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
                            {ev.tags.map(t => <Tag key={t} label={t} />)}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                        <Button variant="ghost" size="sm" icon={<Edit2 size={12} />} onClick={e => { e.stopPropagation(); startEdit(ev); }} />
                        <Button variant="ghost" size="sm" icon={<Trash2 size={12} />} onClick={e => { e.stopPropagation(); del(ev.id); }} />
                        {expandedId === ev.id ? <ChevronUp size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
                      </div>
                    </div>
                    {expandedId === ev.id && ev.description && (
                      <div style={{ padding: '0 14px 12px 42px', fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        {ev.description}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── GOALS TAB ────────────────────────────────────────────────────────────────

function GoalsTab() {
  const { characters } = useApp();
  const pcs = characters.filter(c => c.type === 'pc');
  const [goals, setGoals] = useState<CampaignGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | GoalStatus>('all');
  const [filterPriority, setFilterPriority] = useState<'all' | GoalPriority>('all');

  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as GoalPriority, characterId: '' });

  const load = useCallback(async () => {
    try { setGoals(await api.goals.list()); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const resetForm = () => setForm({ title: '', description: '', priority: 'medium', characterId: '' });

  const save = async () => {
    if (!form.title.trim()) return;
    const dto = { title: form.title.trim(), description: form.description, priority: form.priority, characterId: form.characterId || null };
    if (creating) {
      const g = await api.goals.create(dto);
      setGoals(prev => [...prev, g]);
      setCreating(false);
    } else if (editingId) {
      const g = await api.goals.update(editingId, dto);
      setGoals(prev => prev.map(x => x.id === editingId ? g : x));
      setEditingId(null);
    }
    resetForm();
  };

  const toggleStatus = async (goal: CampaignGoal) => {
    const newStatus: GoalStatus = goal.status === 'done' ? 'pending' : 'done';
    const g = await api.goals.update(goal.id, { status: newStatus });
    setGoals(prev => prev.map(x => x.id === goal.id ? g : x));
  };

  const del = async (id: string) => {
    if (!confirm('Remover esta meta?')) return;
    await api.goals.delete(id);
    setGoals(prev => prev.filter(g => g.id !== id));
  };

  const startEdit = (goal: CampaignGoal) => {
    setForm({ title: goal.title, description: goal.description, priority: goal.priority, characterId: goal.characterId ?? '' });
    setEditingId(goal.id); setCreating(false);
  };

  const filtered = goals.filter(g => {
    if (filterStatus !== 'all' && g.status !== filterStatus) return false;
    if (filterPriority !== 'all' && g.priority !== filterPriority) return false;
    return true;
  });

  const pending = filtered.filter(g => g.status === 'pending');
  const done = filtered.filter(g => g.status === 'done');

  const FormPanel = (
    <div style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 14, marginBottom: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 10 }}>
        <Input label="Título *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Prioridade</label>
            <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value as GoalPriority }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}>
              {Object.entries(PRIORITY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          {pcs.length > 0 && (
            <div style={{ flex: 1 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Personagem</label>
              <select value={form.characterId} onChange={e => setForm(f => ({ ...f, characterId: e.target.value }))}
                style={{ width: '100%', padding: '7px 10px', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--bg-surface)', color: 'var(--text-primary)', fontSize: 13 }}>
                <option value="">Geral</option>
                {pcs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>
      <Textarea label="Descrição" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 10 }}>
        <Button variant="ghost" size="sm" icon={<X size={13} />} onClick={() => { setCreating(false); setEditingId(null); resetForm(); }}>Cancelar</Button>
        <Button variant="primary" size="sm" icon={<Save size={13} />} onClick={save} disabled={!form.title.trim()}>Salvar</Button>
      </div>
    </div>
  );

  const GoalCard = ({ goal }: { goal: CampaignGoal }) => {
    const char = goal.characterId ? pcs.find(c => c.id === goal.characterId) : null;
    const isDone = goal.status === 'done';
    const pColor = PRIORITY_COLORS[goal.priority];
    return (
      <div style={{
        background: 'var(--bg-surface)', border: '1px solid var(--border)',
        borderLeft: `3px solid ${pColor}`, borderRadius: 'var(--radius-lg)',
        padding: '10px 14px', opacity: isDone ? 0.7 : 1,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <button onClick={() => toggleStatus(goal)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', marginTop: 2, flexShrink: 0 }}>
            {isDone
              ? <div style={{ width: 16, height: 16, borderRadius: 3, background: 'var(--success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check size={10} color="#fff" /></div>
              : <div style={{ width: 16, height: 16, borderRadius: 3, border: `2px solid ${pColor}` }} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: isDone ? 'var(--text-muted)' : 'var(--text-primary)', textDecoration: isDone ? 'line-through' : 'none' }}>
                {goal.title}
              </span>
              <span style={{ fontSize: 11, fontWeight: 600, color: pColor, background: `${pColor}15`, borderRadius: 4, padding: '1px 6px' }}>
                <Flag size={9} style={{ display: 'inline', marginRight: 2 }} />{PRIORITY_LABELS[goal.priority]}
              </span>
              {char && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Users size={10} />{char.name}
                </span>
              )}
            </div>
            {goal.description && (
              <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>{goal.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 2, flexShrink: 0 }}>
            <Button variant="ghost" size="sm" icon={<Edit2 size={11} />} onClick={() => startEdit(goal)} />
            <Button variant="ghost" size="sm" icon={<Trash2 size={11} />} onClick={() => del(goal.id)} />
          </div>
        </div>
      </div>
    );
  };

  const doneCount = goals.filter(g => g.status === 'done').length;
  const progress = goals.length > 0 ? Math.round((doneCount / goals.length) * 100) : 0;

  if (loading) return <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>Carregando...</p>;

  return (
    <div>
      <SectionHeader
        label="Metas" count={goals.length}
        action={<Button variant="primary" size="sm" icon={<Plus size={13} />} onClick={() => { setCreating(true); setEditingId(null); resetForm(); }}>Nova meta</Button>}
      />

      {/* Progress bar */}
      {goals.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
            <span>Progresso geral</span>
            <span>{doneCount}/{goals.length} cumpridas ({progress}%)</span>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-elevated)', overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, background: 'var(--success)', borderRadius: 99, transition: 'width 0.4s' }} />
          </div>
        </div>
      )}

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {(['all', 'pending', 'done'] as const).map(f => (
          <button key={f} onClick={() => setFilterStatus(f)} style={{
            fontSize: 12, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', fontWeight: 600,
            border: '1px solid var(--border)',
            background: filterStatus === f ? 'var(--accent)' : 'transparent',
            color: filterStatus === f ? '#fff' : 'var(--text-secondary)',
          }}>
            {f === 'all' ? 'Todas' : f === 'pending' ? 'Pendentes' : 'Cumpridas'}
          </button>
        ))}
        {(['all', 'high', 'medium', 'low'] as const).map(p => (
          <button key={p} onClick={() => setFilterPriority(p)} style={{
            fontSize: 12, padding: '4px 12px', borderRadius: 99, cursor: 'pointer', fontWeight: 600,
            border: `1px solid ${p === 'all' ? 'var(--border)' : PRIORITY_COLORS[p as GoalPriority] || 'var(--border)'}`,
            background: filterPriority === p ? (p === 'all' ? 'var(--accent)' : PRIORITY_COLORS[p as GoalPriority]) : 'transparent',
            color: filterPriority === p ? '#fff' : 'var(--text-secondary)',
          }}>
            {p === 'all' ? 'Qualquer prioridade' : PRIORITY_LABELS[p as GoalPriority]}
          </button>
        ))}
      </div>

      {creating && FormPanel}
      {filtered.length === 0 && !creating && emptyCard('Nenhuma meta encontrada. Defina os objetivos da campanha!')}

      {pending.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Pendentes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pending.map(g => editingId === g.id ? <div key={g.id}>{FormPanel}</div> : <GoalCard key={g.id} goal={g} />)}
          </div>
        </div>
      )}
      {done.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>Cumpridas</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {done.map(g => editingId === g.id ? <div key={g.id}>{FormPanel}</div> : <GoalCard key={g.id} goal={g} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── PAGE ─────────────────────────────────────────────────────────────────────

type Tab = 'events' | 'goals';

export default function CampaignPage() {
  useTitle('Campanha');
  const [activeTab, setActiveTab] = useState<Tab>('events');

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'events', label: 'Eventos', icon: <Calendar size={14} /> },
    { id: 'goals', label: 'Metas', icon: <Target size={14} /> },
  ];

  return (
    <div style={{ padding: 28, maxWidth: 900 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>Campanha</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Gerencie os eventos e as metas da sua campanha</p>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--border)', marginBottom: 24 }}>
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 18px', fontSize: 13, fontWeight: 600,
            background: 'none', border: 'none', cursor: 'pointer',
            color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-secondary)',
            borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
            marginBottom: -2, transition: 'all 0.15s',
          }}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'events' && <EventsTab />}
      {activeTab === 'goals' && <GoalsTab />}
    </div>
  );
}
