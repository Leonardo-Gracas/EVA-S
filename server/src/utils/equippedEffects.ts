import { CharacterItem } from '../types';

/** Todas as aplicações numéricas de itens equipados (armas/vestes). Espelha client/src/utils/equippedEffects.ts. */
export function getEquippedApplications(items: CharacterItem[] | undefined) {
  return (items ?? [])
    .filter((i) => i.equipped)
    .flatMap((i) => i.effects ?? [])
    .flatMap((e) => e?.applications ?? []);
}

/** Soma o bônus (add/subtract) dos itens equipados para um stat específico. */
export function getEquippedBonus(items: CharacterItem[] | undefined, stat: string): number {
  return getEquippedApplications(items)
    .filter((a) => a.stat === stat)
    .reduce((sum, a) => sum + (a.operation === 'add' ? a.value : -a.value), 0);
}
