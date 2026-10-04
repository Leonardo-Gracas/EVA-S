import {
  LayoutDashboard, Users, Sword, BookOpen, Library, Inbox, Backpack,
  Sparkles, Swords, Map, Settings, Scroll, BookMarked, LucideIcon,
} from 'lucide-react';

/** Contadores dinâmicos que a sidebar/palette injetam nos itens. */
export type BadgeKey = 'requests';

export interface NavItem {
  to: string;
  icon: LucideIcon;
  label: string;
  /** casa a rota exata (usado só na raiz) */
  end?: boolean;
  /** prefixos extras que também marcam este item como ativo */
  match?: string[];
  badgeKey?: BadgeKey;
  /** termos alternativos para a busca do Ctrl+K */
  keywords?: string;
}

export interface NavGroup {
  id: string;
  label: string;
  items: NavItem[];
}

/**
 * Antes: 13 links soltos numa lista plana. Agora: 3 grupos por *momento de uso*
 * (o que você faz durante a sessão / quem está na mesa / o que persiste entre
 * sessões). As 4 bibliotecas viraram um link só — a troca entre elas acontece
 * nas abas de /library, que é onde essa navegação lateral realmente importa.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'sessao',
    label: 'Sessão',
    items: [
      { to: '/', icon: LayoutDashboard, label: 'Dashboard', end: true, keywords: 'inicio home visao geral resumo' },
      { to: '/combat', icon: Swords, label: 'Combate', keywords: 'iniciativa turno rodada batalha' },
      { to: '/maps', icon: Map, label: 'Mapas', keywords: 'mapa cena nodes deslocamento' },
      { to: '/requests', icon: Inbox, label: 'Solicitações', badgeKey: 'requests', keywords: 'pedidos aprovar jogador' },
    ],
  },
  {
    id: 'mesa',
    label: 'Mesa',
    items: [
      { to: '/characters', icon: Sword, label: 'Personagens', keywords: 'fichas pc npc party grupo' },
      { to: '/players', icon: Users, label: 'Jogadores', keywords: 'players convidados cores vinculo' },
      {
        to: '/library/skills',
        icon: Library,
        label: 'Biblioteca',
        match: ['/library', '/skill-library', '/effect-library', '/item-library', '/grimorio'],
        keywords: 'acervo habilidades efeitos itens grimorio templates',
      },
    ],
  },
  {
    id: 'campanha',
    label: 'Campanha',
    items: [
      { to: '/campaign', icon: Scroll, label: 'Diário', keywords: 'campanha anotacoes notas sessoes' },
      { to: '/history', icon: BookOpen, label: 'Histórico', keywords: 'log eventos auditoria' },
      { to: '/settings', icon: Settings, label: 'Configurações', keywords: 'ajustes fichas permissoes tipos' },
    ],
  },
];

/** Seções da página /library — também usadas como destinos no Ctrl+K. */
export interface LibrarySection {
  id: string;
  path: string;
  label: string;
  icon: LucideIcon;
  keywords: string;
}

export const LIBRARY_SECTIONS: LibrarySection[] = [
  { id: 'skills', path: '/library/skills', label: 'Habilidades', icon: Library, keywords: 'skills poderes talentos' },
  { id: 'effects', path: '/library/effects', label: 'Efeitos', icon: Sparkles, keywords: 'buffs debuffs condicoes' },
  { id: 'items', path: '/library/items', label: 'Itens', icon: Backpack, keywords: 'equipamentos armas consumiveis' },
  { id: 'grimorio', path: '/library/grimorio', label: 'Grimório', icon: BookMarked, keywords: 'feiticos magias spells' },
];

export const NAV_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items);

/** Um item está ativo se o pathname bate com `to` ou com qualquer prefixo em `match`. */
export function isNavItemActive(item: NavItem, pathname: string): boolean {
  if (item.end) return pathname === item.to;
  const prefixes = [item.to, ...(item.match ?? [])];
  return prefixes.some((p) => pathname === p || pathname.startsWith(p + '/'));
}
