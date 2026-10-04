import React from 'react';
import { Sword, Shield, FlaskConical, Star, Edit2, Trash2, Zap, BookOpen } from 'lucide-react';
import { CharacterItem, ItemTemplate, ITEM_TYPE_LABELS, ITEM_TYPE_COLORS, ItemEffect, EffectTemplate } from '../../types';
import { ICON_MAP } from './SkillIconPicker';

export type ItemRowMode = 'gm' | 'player';

interface InventoryItemRowProps {
  item: CharacterItem;
  template?: ItemTemplate | null;
  mode: ItemRowMode;
  effectTemplates?: EffectTemplate[];
  // GM mode: direct action callbacks
  onEquipToggle?: (item: CharacterItem) => void;
  onRemove?: (item: CharacterItem) => void;
  onUse?: (item: CharacterItem) => void;
  onChangeQty?: (item: CharacterItem, delta: number) => void;
  // Player mode: permission-gated, may show request icons
  onEdit?: (item: CharacterItem) => void;
  onEffectClick?: (eff: ItemEffect, rect: DOMRect) => void;
  onCatalizadorClick?: (grimorioId: string, grimorioName: string) => void;
  // Player permissions
  permEquip?: string;
  permUpdate?: string;
  permRemove?: string;
  permUse?: string;
}

const DEFAULT_ICON: Record<string, React.ComponentType<any>> = {
  weapon: Sword,
  vest: Shield,
  consumable: FlaskConical,
  special: Star,
};

export function InventoryItemRow({
  item, template, mode, effectTemplates = [],
  onEquipToggle, onRemove, onUse, onChangeQty, onEdit, onEffectClick, onCatalizadorClick,
  permEquip = 'free', permUpdate = 'free', permRemove = 'free', permUse = 'free',
}: InventoryItemRowProps) {
  const TypeIcon = (template?.icon ? ICON_MAP[template.icon] : item.icon ? ICON_MAP[item.icon] : null) ?? DEFAULT_ICON[item.type] ?? Star;
  const typeColor = template?.iconColor ?? item.iconColor ?? ITEM_TYPE_COLORS[item.type];
  const canEquip = (item.type === 'weapon' || item.type === 'vest') && (mode === 'gm' || permEquip !== 'blocked');
  const canUse = item.type === 'consumable' && (mode === 'gm' || permUse !== 'blocked');
  const showEdit = mode === 'player' && permUpdate !== 'blocked';
  const showRemove = mode === 'gm' || permRemove !== 'blocked';

  const row: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', transition: 'border-color var(--transition)' };
  const rowEquipped: React.CSSProperties = { borderColor: 'var(--accent)', background: 'var(--accent-dim)' };
  const typeBox: React.CSSProperties = { width: 32, height: 32, borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: `${typeColor}20` };
  const actionBtn: React.CSSProperties = { padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 600, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)', cursor: 'pointer' };
  const actionBtnActive: React.CSSProperties = { background: 'var(--accent-dim)', borderColor: 'var(--accent)', color: 'var(--accent)' };
  const iconBtn: React.CSSProperties = { background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' };
  const effectBadge: React.CSSProperties = { fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: '100px', cursor: 'pointer', transition: 'opacity 0.15s', fontFamily: 'inherit' };
  const qtyBtn: React.CSSProperties = { width: 22, height: 22, borderRadius: 4, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 };

  return (
    <div style={{ ...row, ...(item.equipped ? rowEquipped : {}) }}>
      <div style={typeBox}>
        <TypeIcon size={16} color={typeColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
          {item.name}
          {item.equipped && (
            <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '100px', background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent)' }}>Equipado</span>
          )}
          {item.type !== 'consumable' && item.quantity > 1 && (
            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 400 }}>×{item.quantity}</span>
          )}
          <span style={{ fontSize: '10px', color: typeColor, marginLeft: 'auto' }}>{ITEM_TYPE_LABELS[item.type]}</span>
        </div>
        {item.type === 'weapon' && item.damage && (
          <span style={{ fontSize: '11px', color: '#f59e0b', marginTop: 2, display: 'block' }}>⚔ {item.damage}</span>
        )}
        {item.description && (
          <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '3px 0 0', lineHeight: 1.4, whiteSpace: 'pre-wrap' }}>{item.description}</p>
        )}
        {item.effects.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
            {item.effects.map((eff, i) => {
              const effTemplate = eff.templateId ? effectTemplates.find((t) => t.id === eff.templateId) : null;
              const isCatalizador = !!(effTemplate?.grimorioId);
              const color = isCatalizador ? '#a855f7' : (eff.color ?? 'var(--accent)');
              return (
                <button key={i}
                  style={{ ...effectBadge, background: `${color}18`, color, border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', gap: 3 }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isCatalizador && onCatalizadorClick) {
                      onCatalizadorClick(effTemplate!.grimorioId!, eff.name);
                    } else {
                      onEffectClick?.(eff, (e.currentTarget as HTMLElement).getBoundingClientRect());
                    }
                  }}
                  title={isCatalizador ? 'Abrir grimório' : undefined}
                >
                  {isCatalizador && <BookOpen size={9} />}
                  {eff.name}
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', flexShrink: 0 }}>
        {item.type === 'consumable' && (
          mode === 'gm' ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <button style={qtyBtn} onClick={() => onChangeQty?.(item, -1)}>−</button>
              <span style={{ fontSize: 12, fontWeight: 600, minWidth: 18, textAlign: 'center' }}>{item.quantity}</span>
              <button style={qtyBtn} onClick={() => onChangeQty?.(item, 1)}>+</button>
            </div>
          ) : canUse ? (
            <button style={{ ...iconBtn, color: '#22c55e' }} onClick={() => onUse?.(item)} title="Usar consumível">
              <Zap size={12} />
            </button>
          ) : null
        )}
        {canEquip && (
          <button style={{ ...actionBtn, ...(item.equipped ? actionBtnActive : {}) }} onClick={() => onEquipToggle?.(item)} title={item.equipped ? 'Desequipar' : 'Equipar'}>
            {mode === 'gm' ? (item.equipped ? 'Desequipar' : 'Equipar') : <Shield size={12} />}
          </button>
        )}
        {mode === 'gm' && item.type === 'consumable' && (
          <button style={{ padding: '4px 8px', borderRadius: 'var(--radius-sm)', fontSize: '11px', fontWeight: 600, background: 'rgba(34,197,94,0.1)', border: '1px solid rgba(34,197,94,0.4)', color: '#22c55e', cursor: 'pointer' }} onClick={() => onUse?.(item)}>
            Usar
          </button>
        )}
        {showEdit && (
          <button style={iconBtn} onClick={() => onEdit?.(item)} title="Solicitar edição"><Edit2 size={12} /></button>
        )}
        {showRemove && (
          <button style={{ ...iconBtn, color: 'var(--error)' }} onClick={() => onRemove?.(item)} title="Remover"><Trash2 size={13} /></button>
        )}
      </div>
    </div>
  );
}
