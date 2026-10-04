import React from 'react';
import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { LIBRARY_SECTIONS } from '../components/layout/navConfig';
import SkillLibrary from './SkillLibrary';
import EffectLibrary from './EffectLibrary';
import ItemLibrary from './ItemLibrary';
import GrimorioLibrary from './GrimorioLibrary';

/**
 * Acervo da campanha num único lugar. Habilidades, Efeitos, Itens e Grimório
 * eram quatro entradas soltas na sidebar, mas na prática você pula entre elas o
 * tempo todo (um item aplica um efeito; um feitiço vira habilidade). Como abas
 * de uma mesma página, essa troca custa um clique e não perde o contexto.
 */
const PANELS: Record<string, React.ComponentType<{ embedded?: boolean }>> = {
  skills: SkillLibrary,
  effects: EffectLibrary,
  items: ItemLibrary,
  grimorio: GrimorioLibrary,
};

export default function Library() {
  const { section } = useParams<{ section: string }>();
  const navigate = useNavigate();

  if (!section || !PANELS[section]) return <Navigate to="/library/skills" replace />;

  const Panel = PANELS[section];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ padding: '22px 28px 12px', background: 'var(--bg-surface)' }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.4px', color: 'var(--text-primary)' }}>
          Biblioteca
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 3 }}>
          Modelos reutilizáveis da campanha — o que você cria aqui pode ser aplicado em qualquer ficha.
        </p>
      </div>

      <div className="gm-section-tabs">
        {LIBRARY_SECTIONS.map((sec) => {
          const Icon = sec.icon;
          const active = sec.id === section;
          return (
            <button
              key={sec.id}
              className={`gm-section-tab${active ? ' active' : ''}`}
              onClick={() => navigate(sec.path)}
            >
              <Icon size={15} />
              {sec.label}
            </button>
          );
        })}
      </div>

      {/* key força remontagem por seção: cada painel tem estado próprio de busca/filtro */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <Panel key={section} embedded />
      </div>
    </div>
  );
}
