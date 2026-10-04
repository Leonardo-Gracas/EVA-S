import React, { useState } from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import { Character, ResourceMap, ResourceDef, resourceMaxStat } from '../../types';
import { ICON_MAP } from './SkillIconPicker';
import { useApp } from '../../contexts/AppContext';
import { getEquippedBonus } from '../../utils/equippedEffects';

interface Props {
  open: boolean;
  onClose: () => void;
  character: Character;
  onSave: (currentResources: ResourceMap) => Promise<void>;
  confirmLabel?: string;
}

const QUICK_STEPS = [-10, -5, -1, +1, +5, +10];

function ResourceRow({
  def,
  current,
  max,
  onChange,
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
    <div style={styles.row}>
      <div style={styles.rowHeader}>
        <div style={{ ...styles.iconBox, background: `${def.color}20` }}>
          <Icon size={16} color={def.color} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={styles.labelRow}>
            <span style={styles.label}>{def.label}</span>
            <span style={{ ...styles.values, color: def.color }}>
              {current}
              <span style={styles.max}>/{max}</span>
            </span>
          </div>
          <div style={styles.track}>
            <div style={{ ...styles.fill, width: `${pct}%`, background: def.color }} />
          </div>
        </div>
        <button
          title="Restaurar ao máximo"
          style={styles.resetBtn}
          onClick={() => onChange(max)}
        >
          <RotateCcw size={13} color="var(--text-muted)" />
        </button>
      </div>

      <div style={styles.quickRow}>
        {QUICK_STEPS.map((step) => {
          const isPos = step > 0;
          return (
            <button
              key={step}
              style={{
                ...styles.quickBtn,
                background: isPos ? `${def.color}18` : 'var(--bg-overlay)',
                color: isPos ? def.color : 'var(--text-secondary)',
                border: `1px solid ${isPos ? def.color + '40' : 'var(--border)'}`,
              }}
              onClick={() => apply(step)}
            >
              {isPos ? `+${step}` : step}
            </button>
          );
        })}
      </div>

      <div style={styles.customRow}>
        <button style={{ ...styles.signBtn, color: 'var(--error)' }} onClick={() => applyCustom(-1)}>
          <Minus size={14} />
        </button>
        <input
          style={styles.customInput}
          type="number"
          min={1}
          placeholder="valor"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') applyCustom(1);
            if (e.key === '-') { e.preventDefault(); applyCustom(-1); }
          }}
        />
        <button style={{ ...styles.signBtn, color: def.color }} onClick={() => applyCustom(1)}>
          <Plus size={14} />
        </button>
        <span style={styles.customHint}>personalizado</span>
      </div>
    </div>
  );
}

export default function ResourceEditModal({ open, onClose, character, onSave, confirmLabel = 'Confirmar' }: Props) {
  const { getResourceDefs } = useApp();
  const defs = getResourceDefs(character.sheetTypeId);
  const [values, setValues] = useState<ResourceMap>(character.currentResources);
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    if (open) setValues(character.currentResources);
  }, [open, character.currentResources]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(values);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Editar Recursos" width={480}>
      <div style={styles.wrapper}>
        {defs.map((def, i) => (
          <React.Fragment key={def.key}>
            {i > 0 && <div style={styles.divider} />}
            <ResourceRow
              def={def}
              current={values[def.key] ?? 0}
              max={(character.resources[def.key] ?? 0) + getEquippedBonus(character.items, resourceMaxStat(def.key))}
              onChange={(v) => setValues((prev) => ({ ...prev, [def.key]: v }))}
            />
          </React.Fragment>
        ))}

        <div style={styles.actions}>
          <Button variant="secondary" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" loading={saving} onClick={handleSave}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

const styles: Record<string, any> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '4px' },
  divider: { height: '1px', background: 'var(--border)', margin: '8px 0' },
  row: { display: 'flex', flexDirection: 'column', gap: '8px' },
  rowHeader: { display: 'flex', alignItems: 'center', gap: '10px' },
  iconBox: {
    width: '32px', height: '32px', borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' },
  label: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  values: { fontSize: '16px', fontWeight: 700 },
  max: { fontSize: '12px', fontWeight: 400, color: 'var(--text-muted)' },
  track: { height: '6px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: '3px', transition: 'width 0.2s ease' },
  resetBtn: {
    background: 'none', border: 'none', cursor: 'pointer',
    padding: '4px', borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', flexShrink: 0,
    opacity: 0.6,
  },
  quickRow: { display: 'flex', gap: '5px' },
  quickBtn: {
    flex: 1, padding: '5px 0', borderRadius: 'var(--radius-sm)',
    fontSize: '12px', fontWeight: 600, cursor: 'pointer',
    transition: 'opacity 150ms',
  },
  customRow: { display: 'flex', alignItems: 'center', gap: '6px' },
  signBtn: {
    width: '30px', height: '30px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
  customInput: {
    flex: 1, padding: '6px 10px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)', fontSize: '13px', textAlign: 'center',
  },
  customHint: { fontSize: '11px', color: 'var(--text-muted)', whiteSpace: 'nowrap' },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: '8px', paddingTop: '12px' },
};
