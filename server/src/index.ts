import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import { runMigrations } from './database/migrations';
import { initSocket } from './socket/socketManager';
import { startMdns, MDNS_HOST } from './mdns';
import { getAccessInfo, setServeInfo } from './network';
import apiRouter from './routes/api';

const app = express();
const httpServer = createServer(app);
// 80 e a porta padrao do HTTP — permite acessar so "http://eva.local", sem :porta na URL
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 80;
const PORT_SUFFIX = PORT === 80 ? '' : `:${PORT}`;

const UPLOADS_DIR = path.join(process.cwd(), 'data', 'uploads');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  },
});

app.use(cors({ origin: '*', allowedHeaders: ['Content-Type', 'x-gm-token'] }));
app.use(express.json({ limit: '50mb' }));
app.use('/uploads', express.static(UPLOADS_DIR));
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Nenhum arquivo enviado ou tipo invalido' });
  res.json({ url: `/uploads/${req.file.filename}` });
});
app.use('/api', apiRouter);

// Serve o frontend — apenas se o build existir (modo producao)
const clientBuildPath = path.join(__dirname, '../../client/dist');
const hasBuild = fs.existsSync(path.join(clientBuildPath, 'index.html'));

if (hasBuild) {
  app.use(express.static(clientBuildPath));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientBuildPath, 'index.html'));
  });
} else {
  // Dev mode — Vite roda separado na porta 5173
  app.get('/', (_req, res) => {
    res.send(`
      <html><body style="font-family:sans-serif;padding:40px;background:#0f172a;color:#94a3b8">
        <h2 style="color:#818cf8">EVA S — Servidor de API rodando</h2>
        <p>Em modo de desenvolvimento, acesse o GM pelo <strong style="color:#f1f5f9">Vite (porta 5173)</strong>:</p>
        <ul>
          <li>Mestre: <a href="http://localhost:5173" style="color:#818cf8">http://localhost:5173</a></li>
          <li>Jogadores (LAN): compile o cliente primeiro com <code style="color:#f1f5f9">npm run build</code> e reinicie o servidor</li>
        </ul>
        <p style="margin-top:32px;font-size:13px">Para uso em LAN agora: o GM tambem pode abrir <strong style="color:#f1f5f9">http://localhost:5173</strong> e jogadores acessam <strong style="color:#f1f5f9">http://${MDNS_HOST}:5173</strong> (Vite com host aberto).</p>
      </body></html>
    `);
  });
  app.get('*', (_req, res) => {
    // Qualquer rota nao-API retorna 404 em dev — evita o ENOENT
    if (!_req.path.startsWith('/api') && !_req.path.startsWith('/uploads')) {
      res.status(404).json({ error: 'Frontend nao compilado. Execute: npm run build' });
    }
  });
}

runMigrations();
initSocket(httpServer);

httpServer.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✖ Porta ${PORT} ja esta em uso.`);
    if (PORT === 80) {
      console.error(`    No Windows a porta 80 costuma ser tomada por IIS, Skype ou outro servidor web.`);
      console.error(`    Descubra o culpado:  netstat -ano | findstr :80`);
      console.error(`    Ou use outra porta:  set PORT=3001 && npm start\n`);
    } else {
      console.error(`    Encerre o processo que a ocupa ou defina outra em PORT.\n`);
    }
    process.exit(1);
  }
  throw err;
});

// URL clicavel no terminal. Dois detalhes fazem o ctrl+click funcionar:
//   1. caminho sempre presente — "http://localhost" cru (porta 80, sem barra) e
//      justamente a forma que os detectores de link do terminal ignoram;
//   2. OSC 8, a sequencia que marca o texto como hyperlink de verdade (VS Code,
//      Windows Terminal). So e emitida em TTY: redirecionado para arquivo ou
//      pipe, sairia lixo de escape no lugar do endereco.
function link(url: string): string {
  return process.stdout.isTTY ? `\u001b]8;;${url}\u0007${url}\u001b]8;;\u0007` : url;
}

function appUrl(host: string, path = '/'): string {
  return link(`http://${host}${PORT_SUFFIX}${path}`);
}

httpServer.listen(PORT, '0.0.0.0', () => {
  setServeInfo({ port: PORT, hasBuild });
  startMdns(PORT);
  const { links, devMode } = getAccessInfo();
  const ipLinks = links.filter((l) => !l.mdns);
  const mdnsLink = links.find((l) => l.mdns);
  const pad = (n: number) => ' '.repeat(Math.max(0, n));

  console.log('\n  ╔══════════════════════════════════════╗');
  console.log('  ║     EVA S — RPG Campaign Manager     ║');
  console.log('  ╚══════════════════════════════════════╝');

  if (devMode) {
    console.log(`\n  Mestre (dev):  ${link('http://localhost:5173/')}`);
    console.log(`  API:           ${appUrl('localhost', '/api')}`);
  } else {
    console.log(`\n  Mestre:        ${appUrl('localhost')}`);
  }

  // Um link por IP da maquina, do mais provavel ao menos: em hotspot de celular,
  // rede de convidado e Wi-Fi publico o mDNS nao passa, entao o nome eva.local
  // deixa de ser o endereco principal e vira alternativa.
  console.log('\n  Jogadores — passe um destes links (ou o QR em Configuracoes › Acesso):');
  if (ipLinks.length === 0) {
    console.log('    ⚠  Nenhuma rede detectada. Conecte a maquina ao Wi-Fi/hotspot e reinicie.');
  } else {
    ipLinks.forEach((l, i) => {
      const mark = i === 0 ? '→' : ' ';
      console.log(`    ${mark} ${link(l.url)}${pad(38 - l.url.length)}  ${l.label}`);
    });
  }
  if (mdnsLink) {
    console.log(`      ${link(mdnsLink.url)}${pad(38 - mdnsLink.url.length)}  so em rede que permite mDNS`);
  }

  if (devMode) {
    console.log(`\n  ⚠  Build nao encontrado — os links acima apontam pro Vite (5173).`);
    console.log(`     Execute "npm run dev" a partir da raiz para buildar automaticamente.`);
  }

  if (process.platform === 'win32') {
    console.log(`\n  Nao abre no celular? O firewall do Windows bloqueia conexao de fora`);
    console.log(`  em rede marcada como "Publica" — libere a porta uma vez:  npm run firewall`);
  }

  console.log(`\n  Uploads:       ${UPLOADS_DIR}\n`);
});
