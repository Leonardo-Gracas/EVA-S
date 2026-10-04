import { ResourceEffect } from '../types';

export type ResEffectsForm = Record<string, { enabled: boolean; amount: number; direction: ResourceEffect['direction'] }>;

export function defaultResEffects(resourceKeys: string[]): ResEffectsForm {
  return Object.fromEntries(resourceKeys.map((k) => [k, { enabled: false, amount: 5, direction: 'cost' as const }]));
}

export function buildResourceEffect(resEffects: ResEffectsForm): ResourceEffect[] {
  return Object.entries(resEffects)
    .filter(([, v]) => v.enabled)
    .map(([res, v]) => ({ resource: res, amount: v.amount, direction: v.direction }));
}

export function applyResEffects(effects: ResourceEffect[], resourceKeys: string[]): ResEffectsForm {
  const next = defaultResEffects(resourceKeys);
  (effects ?? []).forEach((fx) => {
    if (fx.resource in next) {
      next[fx.resource] = { enabled: true, amount: fx.amount, direction: fx.direction };
    }
  });
  return next;
}
