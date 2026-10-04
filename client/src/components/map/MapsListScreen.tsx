import React from 'react';
import { Map, Plus, List, Edit2, Trash2 } from 'lucide-react';
import { GameMap } from '../../types';
import Button from '../common/Button';

export function MapsListScreen({
  maps, onOpen, onEdit, onDelete, onNew,
}: {
  maps: GameMap[];
  onOpen: (m: GameMap) => void;
  onEdit: (m: GameMap) => void;
  onDelete: (m: GameMap) => void;
  onNew: () => void;
}) {
  return (
    <div style={s.shell}>
      <div style={s.header}>
        <span style={s.title}>Mapas</span>
        <Button variant="primary" icon={<Plus size={14} />} onClick={onNew}>Novo Mapa</Button>
      </div>
      {maps.length === 0 ? (
        <div style={s.empty}>
          <Map size={48} color="var(--text-muted)" style={{ opacity: 0.3, marginBottom: 16 }} />
          <p>Nenhum mapa criado ainda.</p>
          <p style={{ marginTop: 6 }}>Crie um novo mapa para começar.</p>
        </div>
      ) : (
        <div style={s.grid}>
          {maps.map(m => (
            <div key={m.id} style={s.card}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 0 0 1px var(--accent)22'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLDivElement).style.boxShadow = 'none'; }}
              onClick={() => onOpen(m)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'var(--accent)22', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Map size={18} color="var(--accent)" />
                </div>
                <span style={s.cardName}>{m.name}</span>
              </div>
              <span style={s.cardMeta}>{m.nodes.length} nó{m.nodes.length !== 1 ? 's' : ''} · {m.paths.length} caminho{m.paths.length !== 1 ? 's' : ''}</span>
              <div style={s.cardActions} onClick={e => e.stopPropagation()}>
                <button style={s.viewBtn} onClick={() => onOpen(m)}><List size={12} /> Ver</button>
                <button style={s.editBtn} onClick={() => onEdit(m)}><Edit2 size={12} /> Editar</button>
                <button style={s.deleteBtn} title="Excluir mapa" onClick={() => onDelete(m)}><Trash2 size={12} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s: Record<string, any> = {
  shell:      { flex: 1, overflow: 'auto', padding: '32px 40px' },
  header:     { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28 },
  title:      { fontSize: 20, fontWeight: 700, color: 'var(--text-primary)' },
  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 },
  card:       { background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 10, padding: 18, cursor: 'pointer', transition: 'border-color 0.15s, box-shadow 0.15s', display: 'flex', flexDirection: 'column', gap: 10 },
  cardName:   { fontSize: 15, fontWeight: 700, color: 'var(--text-primary)' },
  cardMeta:   { fontSize: 12, color: 'var(--text-muted)' },
  cardActions:{ display: 'flex', gap: 8, marginTop: 4 },
  viewBtn:    { flex: 1, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 },
  editBtn:    { flex: 1, padding: '5px 10px', borderRadius: 6, border: '1px solid var(--accent)', background: 'var(--accent)', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, fontWeight: 600 },
  deleteBtn:  { padding: '5px 8px', borderRadius: 6, border: '1px solid var(--error)', background: 'transparent', color: 'var(--error)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  empty:      { textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 },
};
