import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './contexts/AppContext';
import { api, clearGmToken, getGmToken } from './services/api';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Characters from './pages/Characters';
import CharacterSheet from './pages/CharacterSheet';
import History from './pages/History';
import PlayerView from './pages/PlayerView';
import GMLogin from './pages/GMLogin';
import Library from './pages/Library';
import Requests from './pages/Requests';
import Combat from './pages/Combat';
import MapEditor from './pages/MapEditor';
import CampaignPage from './pages/Campaign';
import Settings from './pages/Settings';

// O token de mestre (ver services/api.ts) e emitido pelo servidor so apos senha
// correta e revalidado a cada restart do processo — por isso nao da pra confiar
// cegamente em "existe um token guardado" (podia ser de uma sessao ja morta, ou
// nem existir e o navegador nunca ter sido usado como mestre). Confirma com o
// servidor antes de liberar as telas de mestre.
function GMGuard({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authed' | 'unauthed'>('checking');

  useEffect(() => {
    if (!getGmToken()) { setStatus('unauthed'); return; }
    api.admin.checkSession()
      .then(() => setStatus('authed'))
      .catch(() => { clearGmToken(); setStatus('unauthed'); });
  }, []);

  if (status === 'checking') return null;
  if (status === 'unauthed') return <GMLogin onAuth={() => setStatus('authed')} />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/player" element={<PlayerView />} />
          <Route element={<GMGuard><Layout /></GMGuard>}>
            <Route index element={<Dashboard />} />
            <Route path="combat" element={<Combat />} />
            <Route path="campaign" element={<CampaignPage />} />
            <Route path="players" element={<Players />} />
            <Route path="characters" element={<Characters />} />
            <Route path="characters/:id" element={<CharacterSheet />} />
            <Route path="library" element={<Navigate to="/library/skills" replace />} />
            <Route path="library/:section" element={<Library />} />
            {/* Rotas antigas — links salvos e atalhos continuam funcionando. */}
            <Route path="skill-library" element={<Navigate to="/library/skills" replace />} />
            <Route path="effect-library" element={<Navigate to="/library/effects" replace />} />
            <Route path="item-library" element={<Navigate to="/library/items" replace />} />
            <Route path="grimorio" element={<Navigate to="/library/grimorio" replace />} />
            <Route path="settings" element={<Settings />} />
            <Route path="maps" element={<MapEditor />} />
            <Route path="requests" element={<Requests />} />
            <Route path="history" element={<History />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AppProvider>
  );
}
