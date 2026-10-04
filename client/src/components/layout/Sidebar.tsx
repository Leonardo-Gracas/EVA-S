import React, { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { ChevronDown, PanelLeftClose, PanelLeftOpen, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '../../contexts/AppContext';
import EvaLogo from './EvaLogo';
import { useShell } from './ShellContext';
import { NAV_GROUPS, LIBRARY_SECTIONS, isNavItemActive, NavItem } from './navConfig';

const COLLAPSED_GROUPS_KEY = 'gm.sidebar.collapsedGroups';

function loadCollapsedGroups(): string[] {
  try {
    const raw = localStorage.getItem(COLLAPSED_GROUPS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export default function Sidebar() {
  const { players, requests } = useApp();
  const { collapsed, toggleCollapsed } = useShell();
  const { pathname } = useLocation();
  const [closedGroups, setClosedGroups] = useState<string[]>(loadCollapsedGroups);

  const online = players.filter((p) => p.status === 'online').length;
  const badges = { requests: requests.filter((r) => r.status === 'pending').length };

  const toggleGroup = (id: string) => {
    setClosedGroups((prev) => {
      const next = prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id];
      try { localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(next)); } catch { /* storage indisponivel */ }
      return next;
    });
  };

  const renderItem = (item: NavItem) => {
    const { to, icon: Icon, label, badgeKey } = item;
    const active = isNavItemActive(item, pathname);
    const badge = badgeKey ? badges[badgeKey] : 0;

    return (
      <div key={to}>
        {/* `end` evita que o NavLink do Dashboard ("/") fique ativo em toda rota;
            o estado ativo real vem de isNavItemActive, que também cobre os apelidos. */}
        <NavLink
          to={to}
          end={item.end}
          className={`gm-nav-item gm-tip${active ? ' active' : ''}`}
          data-tip={label}
        >
          <Icon size={17} color={active ? 'var(--accent)' : 'currentColor'} style={{ flexShrink: 0 }} />
          <span className="gm-nav-label">{label}</span>
          {badge > 0 && <span className="gm-nav-badge">{badge}</span>}
        </NavLink>

        {/* Sub-itens da Biblioteca aparecem só quando você já está nela —
            o resto do tempo eles não ocupam espaço na lista. */}
        {to.startsWith('/library') && active && !collapsed && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1, margin: '2px 0 2px 26px' }}>
            {LIBRARY_SECTIONS.map((sec) => {
              const secActive = pathname === sec.path;
              return (
                <NavLink
                  key={sec.id}
                  to={sec.path}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                    borderRadius: 'var(--radius-sm)', fontSize: 12.5,
                    color: secActive ? 'var(--accent)' : 'var(--text-muted)',
                    fontWeight: secActive ? 600 : 500,
                    borderLeft: `2px solid ${secActive ? 'var(--accent)' : 'var(--border)'}`,
                  }}
                >
                  {sec.label}
                </NavLink>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className="gm-side">
      <div className="gm-side-head">
        <EvaLogo size={30} withText={!collapsed} />
        {!collapsed && <div style={{ flex: 1 }} />}
        {!collapsed && (
          <button className="gm-icon-btn" onClick={toggleCollapsed} title="Recolher menu (Ctrl+B)">
            <PanelLeftClose size={16} />
          </button>
        )}
      </div>

      <nav className="gm-side-nav">
        {collapsed && (
          <button className="gm-icon-btn gm-tip" data-tip="Expandir menu" onClick={toggleCollapsed} style={{ alignSelf: 'center', marginBottom: 4 }}>
            <PanelLeftOpen size={16} />
          </button>
        )}

        {NAV_GROUPS.map((group) => {
          const open = !closedGroups.includes(group.id);
          const hiddenBadge = !open
            ? group.items.reduce((sum, i) => sum + (i.badgeKey ? badges[i.badgeKey] : 0), 0)
            : 0;

          return (
            <div key={group.id}>
              <button className="gm-group-label" onClick={() => toggleGroup(group.id)}>
                <span>{group.label}</span>
                {hiddenBadge > 0 && <span className="gm-nav-badge">{hiddenBadge}</span>}
                <ChevronDown size={12} className="gm-group-chevron" data-open={open} />
              </button>
              {(open || collapsed) && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {group.items.map(renderItem)}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="gm-side-foot gm-tip" data-tip={online > 0 ? `${online} online` : 'Ninguém conectado'}>
        {online > 0
          ? <Wifi size={14} color="var(--success)" style={{ flexShrink: 0 }} />
          : <WifiOff size={14} color="var(--text-muted)" style={{ flexShrink: 0 }} />}
        <span className="gm-side-foot-text" style={{ fontSize: 12, color: 'var(--text-muted)', flex: 1 }}>
          {online > 0 ? `${online} jogador${online > 1 ? 'es' : ''} online` : 'Nenhum conectado'}
        </span>
        <span
          className="gm-side-foot-text"
          style={{
            width: 8, height: 8, borderRadius: '50%',
            background: online > 0 ? 'var(--success)' : 'var(--text-muted)',
          }}
        />
      </div>
    </aside>
  );
}
