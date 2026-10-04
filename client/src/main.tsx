import React, { Suspense } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/shell.css';

// Build online (Netlify): antes do app, o lobby da sala (criar / entrar).
// No build LAN essa parte nem entra no bundle.
const ONLINE = import.meta.env.VITE_ONLINE === '1';
const OnlineGate = ONLINE ? React.lazy(() => import('./online/OnlineGate')) : null;

// Volta do login do Google (YouTube) numa popup: no modo online nao ha servidor
// pra receber o callback, entao a popup repassa code/state pra aba do mestre.
const isYtCallback = ONLINE && window.location.pathname.startsWith('/api/music/youtube/callback');

function YtCallbackRelay() {
  React.useEffect(() => {
    try {
      window.opener?.postMessage({ source: 'evas-yt-callback', search: window.location.search }, window.location.origin);
    } catch { /* sem opener */ }
    const t = setTimeout(() => window.close(), 1200);
    return () => clearTimeout(t);
  }, []);
  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', background: '#0f1117', color: '#e2e8f0', padding: 40, textAlign: 'center', minHeight: '100vh' }}>
      <p>Concluindo o login do YouTube... pode fechar esta janela.</p>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);

if (isYtCallback) {
  root.render(<YtCallbackRelay />);
} else if (OnlineGate) {
  root.render(
    <React.StrictMode>
      <Suspense fallback={null}>
        <OnlineGate><App /></OnlineGate>
      </Suspense>
    </React.StrictMode>
  );
} else {
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}
