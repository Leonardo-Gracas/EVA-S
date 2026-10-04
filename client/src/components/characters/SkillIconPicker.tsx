import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { matchesSearch } from '../../utils/normalizeSearch';
import { CUSTOM_ICON_MAP } from './customIcons';
import {
  Star, Zap, Shield, Sword, Heart, Eye, Brain, Flame,
  Wind, Droplets, Droplet, Anchor, Lock, Unlock, Key, Target, Trophy,
  Skull, Crown, Gem, Moon, Sun, CloudLightning, Swords,
  Axe, Crosshair, Sparkles, Dna, Ghost, Infinity,
  FlameKindling, Bomb, Biohazard, Atom, Mountain,
  Snowflake, Leaf, Bug, Fish, Bird, Rabbit,
  Music, Book, Scroll, Map, Compass, Hourglass, Clock,
  Hand, Footprints, Fingerprint, Dumbbell,
  Wand2, Wand, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6,
  Rainbow, Feather, Cross, ShieldHalf,
  Hammer, Circle, Package, PocketKnife, DollarSign, Activity,
} from 'lucide-react';

// Mapeamento nome → componente
export const ICON_MAP: Record<string, React.ComponentType<any>> = {
  Star, Zap, Shield, Sword, Heart, Eye, Brain, Flame,
  Wind, Droplets, Droplet, Anchor, Lock, Unlock, Key, Target, Trophy,
  Skull, Crown, Gem, Moon, Sun, CloudLightning, Swords,
  Axe, Crosshair, Sparkles, Dna, Ghost, Infinity,
  FlameKindling, Bomb, Biohazard, Atom, Mountain,
  Snowflake, Leaf, Bug, Fish, Bird, Rabbit,
  Music, Book, Scroll, Map, Compass, Hourglass, Clock,
  Hand, Footprints, Fingerprint, Dumbbell,
  Wand2, Wand, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6,
  Rainbow, Feather, Cross, ShieldHalf,
  Hammer, Circle, Package, PocketKnife, DollarSign, Activity,
  ...CUSTOM_ICON_MAP,
};

export const ICON_NAMES = Object.keys(ICON_MAP);

const COLOR_OPTIONS = [
  '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444',
  '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#78716c', '#1e293b', '#94a3b8', '#ffffff',
];

interface Props {
  selectedIcon: string;
  selectedColor: string;
  onIconChange: (icon: string) => void;
  onColorChange: (color: string) => void;
  collapsible?: boolean;
}

export default function SkillIconPicker({ selectedIcon, selectedColor, onIconChange, onColorChange, collapsible }: Props) {
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState(!collapsible);

  const filtered = ICON_NAMES.filter((n) => matchesSearch(n, search));

  const SelectedIcon = ICON_MAP[selectedIcon] ?? Star;

  return (
    <div style={styles.wrapper}>
      {/* Preview */}
      <div
        style={{ ...styles.preview, cursor: collapsible ? 'pointer' : 'default' }}
        onClick={collapsible ? () => setExpanded((v) => !v) : undefined}
      >
        <div style={{ ...styles.previewBox, background: `${selectedColor}20` }}>
          <SelectedIcon size={28} color={selectedColor} />
        </div>
        <div style={{ flex: 1 }}>
          <p style={styles.previewLabel}>Icone selecionado</p>
          <p style={styles.previewName}>{selectedIcon}</p>
        </div>
        {collapsible && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--text-muted)', fontSize: 12 }}>
            {expanded ? 'Recolher' : 'Personalizar'}
            <ChevronDown size={13} style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
          </div>
        )}
      </div>

      {(!collapsible || expanded) && (
        <>
          {/* Seletor de cor */}
          <div>
            <label style={styles.label}>Cor do icone</label>
            <div style={styles.colorRow}>
              {COLOR_OPTIONS.map((c) => (
                <button
                  key={c}
                  type="button"
                  title={c}
                  style={{
                    ...styles.colorSwatch,
                    background: c,
                    border: selectedColor === c ? `2px solid white` : '2px solid transparent',
                    outline: selectedColor === c ? `2px solid ${c}` : 'none',
                    outlineOffset: '1px',
                    transform: selectedColor === c ? 'scale(1.2)' : 'scale(1)',
                  }}
                  onClick={() => onColorChange(c)}
                />
              ))}
              {/* Input de cor personalizada */}
              <label style={styles.customColor} title="Cor personalizada">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => onColorChange(e.target.value)}
                  style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                />
                <span style={styles.customColorLabel}>+</span>
              </label>
            </div>
          </div>

          {/* Busca */}
          <div>
            <label style={styles.label}>Icone</label>
            <input
              style={styles.search}
              placeholder="Buscar icone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Grid de icones */}
          <div style={styles.grid}>
            {filtered.map((name) => {
              const Icon = ICON_MAP[name];
              const active = name === selectedIcon;
              return (
                <button
                  key={name}
                  type="button"
                  title={name}
                  onClick={() => onIconChange(name)}
                  style={{
                    ...styles.iconBtn,
                    background: active ? `${selectedColor}25` : 'var(--bg-elevated)',
                    border: `1px solid ${active ? selectedColor : 'var(--border)'}`,
                  }}
                >
                  <Icon size={18} color={active ? selectedColor : 'var(--text-secondary)'} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const styles: Record<string, any> = {
  wrapper: { display: 'flex', flexDirection: 'column', gap: '12px' },
  preview: {
    display: 'flex', alignItems: 'center', gap: '12px',
    padding: '10px 12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius)',
  },
  previewBox: {
    width: '48px', height: '48px', borderRadius: 'var(--radius)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  previewLabel: { fontSize: '11px', color: 'var(--text-muted)', marginBottom: '2px' },
  previewName: { fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' },
  label: { display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '7px' },
  colorRow: { display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' },
  colorSwatch: {
    width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer',
    transition: 'transform 150ms', flexShrink: 0,
  },
  customColor: {
    width: '24px', height: '24px', borderRadius: '50%',
    background: 'var(--bg-elevated)', border: '1px dashed var(--border)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', position: 'relative',
  },
  customColorLabel: { fontSize: '14px', color: 'var(--text-muted)', pointerEvents: 'none' },
  search: {
    width: '100%', padding: '7px 10px', background: 'var(--bg-elevated)',
    border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)', fontSize: '13px',
  },
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(36px, 1fr))',
    gap: '4px', maxHeight: '180px', overflowY: 'auto', padding: '2px',
  },
  iconBtn: {
    width: '36px', height: '36px', borderRadius: 'var(--radius-sm)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', transition: 'all 150ms',
  },
};
