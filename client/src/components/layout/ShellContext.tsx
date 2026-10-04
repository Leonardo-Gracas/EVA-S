import { createContext, useContext } from 'react';

/** Modo inicial da paleta: 'all' abre vazia, 'characters' já filtra o elenco. */
export type PaletteMode = 'all' | 'characters';

export interface ShellValue {
  collapsed: boolean;
  toggleCollapsed: () => void;
  paletteOpen: boolean;
  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
}

export const ShellContext = createContext<ShellValue | null>(null);

export function useShell(): ShellValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell deve ser usado dentro do Layout do mestre');
  return ctx;
}
