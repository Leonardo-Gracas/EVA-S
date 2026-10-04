import React, { useEffect, useRef } from 'react';
import { CombatActiveEffect, EffectTemplate, ItemEffect, SheetType, getEffectStatLabel, getEffectStatLabelForCampaign } from '../../types';
import { ICON_MAP } from '../characters/SkillIconPicker';
import { useApp } from '../../contexts/AppContext';

export interface PopoverTarget {
  effect: CombatActiveEffect;
  rect: DOMRect;
}

export interface ItemEffectTarget {
  effect: ItemEffect;
  rect: DOMRect;
}

const POPOVER_WIDTH = 230;
const POPOVER_MARGIN = 8;

export function EffectPopover({ target, globalTurn, onClose, effectTemplates, sheetTypeId }: {
  target: PopoverTarget | null;
  globalTurn: number;
  onClose: () => void;
  effectTemplates?: EffectTemplate[];
  sheetTypeId?: string;
}) {
  const { getSheetType } = useApp();
  const sheetConfig = getSheetType(sheetTypeId).config;
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target || !cardRef.current) return;
    const { rect } = target;
    const cardH = cardRef.current.offsetHeight;
    let top = rect.bottom + POPOVER_MARGIN;
    if (top + cardH > window.innerHeight - 8) top = Math.max(8, rect.top - POPOVER_MARGIN - cardH);
    cardRef.current.style.top = `${top}px`;
  }, [target]);

  if (!target) return null;

  const { effect, rect } = target;
  const Icon = ICON_MAP[effect.icon ?? 'Zap'] ?? ICON_MAP['Zap'];
  const color = effect.color ?? 'var(--accent)';
  // Fallback: look up description from template list if effect was added before the field existed
  const description = effect.description || effectTemplates?.find(t => t.name === effect.name)?.description || '';

  let left = rect.left;
  if (left + POPOVER_WIDTH > window.innerWidth - 8) left = window.innerWidth - POPOVER_WIDTH - 8;
  if (left < 8) left = 8;
  const initialTop = rect.bottom + POPOVER_MARGIN;

  const turnsLeft = effect.durationRounds > 0
    ? Math.max(0, effect.expireAtGlobalTurn - globalTurn)
    : null;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
      <div
        ref={cardRef}
        style={{
          position: 'fixed', top: initialTop, left, width: POPOVER_WIDTH, zIndex: 9999,
          background: 'var(--bg-surface)', border: `1px solid ${color}55`,
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{
          padding: '10px 12px', background: `${color}15`, borderBottom: `1px solid ${color}33`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={15} color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{effect.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              {turnsLeft === null ? 'Permanente' : turnsLeft === 0 ? 'Expira neste turno' : `${turnsLeft} turno${turnsLeft !== 1 ? 's' : ''} restante${turnsLeft !== 1 ? 's' : ''}`}
            </div>
          </div>
        </div>

        {/* Body */}
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {description && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              {description}
            </p>
          )}
          {effect.applications.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Modificadores
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {effect.applications.map((app, i) => {
                  const sign = app.operation === 'add' ? '+' : '−';
                  const label = app.stat === 'custom' ? (app.customName ?? 'Custom') : getEffectStatLabel(app.stat, sheetConfig);
                  return (
                    <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: '100px', background: `${color}18`, color, border: `1px solid ${color}44`, fontWeight: 600 }}>
                      {sign}{app.value} {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {!description && effect.applications.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
              Sem descrição ou modificadores.
            </p>
          )}
        </div>
      </div>
    </>
  );
}

export function ItemEffectPopover({ target, onClose, sheetTypeId, sheetTypes }: {
  target: ItemEffectTarget | null;
  onClose: () => void;
  /** Personagem especifico — resolve o label so contra o tipo de ficha dele. */
  sheetTypeId?: string;
  /** Contexto de biblioteca (item ainda nao ligado a um personagem) — resolve procurando em todos os tipos. Tem prioridade sobre sheetTypeId quando informado. */
  sheetTypes?: SheetType[];
}) {
  const { getSheetType } = useApp();
  const sheetConfig = getSheetType(sheetTypeId).config;
  const resolveLabel = (stat: string) => sheetTypes ? getEffectStatLabelForCampaign(stat, sheetTypes) : getEffectStatLabel(stat, sheetConfig);
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!target || !cardRef.current) return;
    const { rect } = target;
    const cardH = cardRef.current.offsetHeight;
    let top = rect.bottom + POPOVER_MARGIN;
    if (top + cardH > window.innerHeight - 8) top = Math.max(8, rect.top - POPOVER_MARGIN - cardH);
    cardRef.current.style.top = `${top}px`;
  }, [target]);

  if (!target) return null;

  const { effect, rect } = target;
  const Icon = ICON_MAP[effect.icon ?? 'Package'] ?? ICON_MAP['Package'];
  const color = effect.color ?? 'var(--accent)';

  let left = rect.left;
  if (left + POPOVER_WIDTH > window.innerWidth - 8) left = window.innerWidth - POPOVER_WIDTH - 8;
  if (left < 8) left = 8;
  const initialTop = rect.bottom + POPOVER_MARGIN;

  const durationLabel = effect.duration
    ? `${effect.duration} turno${effect.duration !== 1 ? 's' : ''}`
    : 'Permanente';

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 9998 }} />
      <div
        ref={cardRef}
        style={{
          position: 'fixed', top: initialTop, left, width: POPOVER_WIDTH, zIndex: 9999,
          background: 'var(--bg-surface)', border: `1px solid ${color}55`,
          borderRadius: 'var(--radius-lg)', boxShadow: '0 8px 32px rgba(0,0,0,0.45)', overflow: 'hidden',
        }}
      >
        <div style={{
          padding: '10px 12px', background: `${color}15`, borderBottom: `1px solid ${color}33`,
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{ width: 30, height: 30, borderRadius: 8, background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon size={15} color={color} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{effect.name}</div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{durationLabel}</div>
          </div>
        </div>
        <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {effect.description && (
            <p style={{ fontSize: 12, color: 'var(--text-secondary)', margin: 0, lineHeight: 1.55 }}>
              {effect.description}
            </p>
          )}
          {effect.applications.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Modificadores
              </span>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {effect.applications.map((app, i) => {
                  const sign = app.operation === 'add' ? '+' : '−';
                  const label = app.stat === 'custom' ? (app.customName ?? 'Custom') : resolveLabel(app.stat);
                  return (
                    <span key={i} style={{ fontSize: 11, padding: '2px 8px', borderRadius: '100px', background: `${color}18`, color, border: `1px solid ${color}44`, fontWeight: 600 }}>
                      {sign}{app.value} {label}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {!effect.description && effect.applications.length === 0 && (
            <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: 0, fontStyle: 'italic' }}>
              Sem descrição ou modificadores.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
