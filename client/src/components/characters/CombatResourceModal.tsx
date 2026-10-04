import React, { useState, useEffect } from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { CombatParticipant, Character, ResourceDef, ResourceMap, resourceMaxStat } from '../../types';
import { ICON_MAP } from './SkillIconPicker';
import { useApp } from '../../contexts/AppContext';
import { api } from '../../services/api';
import { CombatSession } from '../../types';
import { getEquippedBonus } from '../../utils/equippedEffects';

const QUICK_STEPS = [-10, -5, -1, +1, +5, +10];

function ResourceRow({
  def, current, max, onChange,
}: {
  def: ResourceDef;
  current: number; max: number;
  onChange: (v: number) => void;
}) {
  const [customInput, setCustomInput] = useState('');
  const Icon = ICON_MAP[def.icon] ?? ICON_MAP['Zap'];
  const pct = max > 0 ? Math.min((current / max) * 100, 100) : 0;

  const apply = (delta: number) => onChange(Math.max(0, Math.min(max, current + delta)));

  const applyCustom = (sign: 1 | -1) => {
    const val = parseInt(customInput);
    if (!isNaN(val) && val > 0) { apply(val * sign); setCustomInput(''); }
  };

  return (
    <div style={s.row}>
      <div style={s.rowHeader}>
        <div style={{ ...s.iconBox, background: `${def.color}20` }}>
          <Icon size={16} color={def.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={s.labelRow}>
            <span style={s.label}>{def.label}</span>
            <span style={{ ...s.values, color: def.color }}>{current}<span style={s.max}>/{max}</span></span>
          </div>
          <div style={s.track}>
            <div style={{ ...s.fill, width: `${pct}%`, background: def.color }} />
          </div>
        </div>
        <button style={s.resetBtn} onClick={() => onChange(max)} title="Restaurar ao máximo">
          <RotateCcw size={13} color="var(--text-muted)" />
        </button>
      </div>
      <div style={s.quickRow}>
        {QUICK_STEPS.map(step => {
          const isPos = step > 0;
          return (
            <button key={step} style={{ ...s.quickBtn, background: isPos ? `${def.color}18` : 'var(--bg-overlay)', color: isPos ? def.color : 'var(--text-secondary)', border: `1px solid ${isPos ? def.color + '40' : 'var(--border)'}` }} onClick={() => apply(step)}>
              {isPos ? `+${step}` : step}
            </button>
          );
        })}
      </div>
      <div style={s.customRow}>
        <button style={{ ...s.signBtn, color: 'var(--error)' }} onClick={() => applyCustom(-1)}><Minus size={14} /></button>
        <input style={s.customInput} type="number" min={1} placeholder="valor" value={customInput} onChange={e => setCustomInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') applyCustom(1); if (e.key === '-') { e.preventDefault(); applyCustom(-1); } }} />
        <button style={{ ...s.signBtn, color: def.color }} onClick={() => applyCustom(1)}><Plus size={14} /></button>
        <span style={s.customHint}>personalizado</span>
      </div>
    </div>
  );
}

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  participant: CombatParticipant;
  character: Character | undefined;
  onDone: (s: CombatSession) => void;
}

export default function CombatResourceModal({ open, onClose, sessionId, participant, character, onDone }: Props) {
  const { getResourceDefs } = useApp();
  const defs = getResourceDefs(character?.sheetTypeId);
  const [values, setValues] = useState<ResourceMap>(participant.currentResources);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setValues(participant.currentResources);
  }, [open, participant.uid]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await api.combat.updateParticipant(sessionId, participant.uid, {
        currentResources: values,
      });
      onDone(updated);
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title={`Recursos — ${participant.displayName}`} width={480}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {defs.map((def, i) => (
          <React.Fragment key={def.key}>
            {i > 0 && <div style={s.divider} />}
            <ResourceRow
              def={def}
              current={values[def.key] ?? 0}
              max={(character?.resources[def.key] ?? 0) + getEquippedBonus(character?.items, resourceMaxStat(def.key))}
              onChange={(v) => setValues((prev) => ({ ...prev, [def.key]: v }))}
            />
          </React.Fragment>
        ))}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, paddingTop: 12 }}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>Confirmar</Button>
        </div>
      </div>
    </Modal>
  );
}

const s: Record<string, any> = {
  row: { display: 'flex', flexDirection: 'column', gap: 8 },
  rowHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  iconBox: { width: 32, height: 32, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' },
  values: { fontSize: 16, fontWeight: 700 },
  max: { fontSize: 12, fontWeight: 400, color: 'var(--text-muted)' },
  track: { height: 6, background: 'var(--bg-elevated)', borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3, transition: 'width 0.2s ease' },
  resetBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: 4, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', flexShrink: 0, opacity: 0.6 },
  quickRow: { display: 'flex', gap: 5 },
  quickBtn: { flex: 1, padding: '5px 0', borderRadius: 'var(--radius-sm)', fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'opacity 150ms' },
  customRow: { display: 'flex', alignItems: 'center', gap: 6 },
  signBtn: { width: 30, height: 30, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  customInput: { flex: 1, padding: '6px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)', fontSize: 13, textAlign: 'center' },
  customHint: { fontSize: 11, color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  divider: { height: 1, background: 'var(--border)', margin: '8px 0' },
};
