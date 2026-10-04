# EVA S

Gerenciador de campanhas de RPG de mesa para o mestre, com sincronização em tempo real para os jogadores pela rede local. O mestre controla fichas, combate, mapas e trilha sonora no próprio computador; os jogadores abrem a ficha no celular lendo um QR code, sem instalar nada.

Foi construído em torno do **EVA**, um sistema de regras autoral, mas os tipos de ficha são configuráveis e permitem adaptar a outros sistemas.

## Stack

| Camada | Tecnologias |
|---|---|
| Frontend | React 18, TypeScript, Vite, React Router, dnd-kit, lucide-react |
| Backend | Node.js, Express, Socket.IO, TypeScript |
| Banco de dados | SQLite (better-sqlite3) com migrations próprias |
| Rede | mDNS/Bonjour (`eva.local`), QR code de acesso por interface de rede |
| Integrações | YouTube Data API v3 (OAuth) + YouTube IFrame Player |

## Funcionalidades

**Campanhas.** Várias campanhas no mesmo servidor, cada uma protegida por senha própria, com troca rápida entre elas. Exportação e importação da campanha completa em JSON, e importação seletiva de conteúdo de uma campanha para outra.

**Fichas configuráveis.** Tipos de ficha definidos pelo mestre (atributos, recursos, proteções e condições), com tipo padrão, duplicação e ordenação. Personagens jogadores e NPCs, com avatar, recursos em barras, atributos reordenáveis por drag and drop, habilidades com usos limitados por combate ou por descanso, e ação de descanso.

**Inventário e efeitos.** Itens por personagem com equipar, usar e consumir. Itens equipados aplicam efeitos automaticamente aos recursos da ficha.

**Bibliotecas reutilizáveis.** Modelos de habilidades, efeitos e itens, além de um grimório de magias com registro de uso por personagem.

**Combate.** Fila de iniciativa reordenável, controle de turnos e rodadas, efeitos temporários com duração em rodadas que expiram sozinhos, e participantes adicionados direto das fichas ou avulsos.

**Mapas táticos.** Editor visual de mapas em grafo (locais e caminhos com distância e características). Durante o combate, os participantes se movem pelo mapa com deslocamento limitado por regra ou livre, movimento parcial em caminhos, desfazer movimento, travamento individual e controle de visibilidade para os jogadores.

**MAPDSL.** Mapas podem ser gerados a partir de uma notação textual própria (`MAP`, `GRID`, `LAYOUT`, nós `N` e caminhos `P`), com validação linha a linha e layout automático (radial, camadas, anel ou grade). O repositório inclui uma skill do Claude Code (`.claude/skills/gerar-mapa`) que escreve mapas nessa notação.

**Interface do jogador.** Acesso pelo navegador em `/player`, com login por jogador. Mostra a própria ficha atualizada em tempo real e as habilidades públicas dos outros personagens.

**Permissões e solicitações.** Cada ação do jogador (usar item, alterar recurso, criar habilidade, lançar magia, descansar etc.) pode ser liberada, exigir aprovação ou ser bloqueada, globalmente ou por jogador. As ações que exigem aprovação viram solicitações que o mestre aprova ou recusa vendo o diff da mudança.

**Diário e histórico.** Diário da campanha com eventos e objetivos. Histórico de todas as ações que alteram dados.

**Trilha sonora.** Player flutuante que continua tocando entre as telas, com playlists da campanha organizadas por mood, acesso às playlists da conta YouTube/YouTube Music e busca por vídeos.

**Painel do mestre.** Dashboard da campanha, navegação agrupada por momento de uso e paleta de comandos (Ctrl+K).

**Segurança.** Sessões do mestre com token gerado no servidor e validado em todas as rotas de escrita. As senhas ficam armazenadas como hash.

## Como rodar

### Pré-requisitos

Node.js 18 ou superior e npm 9 ou superior. O `better-sqlite3` é um módulo nativo: no Windows ele costuma baixar um binário pronto, mas se a instalação falhar, instale as Build Tools do Visual Studio (C++) e o Python.

### Instalação

```bash
git clone https://github.com/Leonardo-Gracas/EVA-S.git
cd EVA-S
npm run install:all
```

Esse comando instala as dependências da raiz, do `server` e do `client`.

### Desenvolvimento

```bash
npm run dev
```

Compila o cliente e sobe o servidor (porta **80**, com hot reload) e o Vite (porta **5173**) ao mesmo tempo. O mestre acessa por `http://localhost:5173`. O banco SQLite é criado automaticamente em `server/data/rpg-manager.db` na primeira execução.

### Produção (servidor único)

```bash
npm run build                  # build do frontend
cd server && npm run build     # compila o backend para server/dist
cd .. && npm start
```

Nesse modo o servidor serve o frontend e a API na mesma porta. O mestre acessa por `http://localhost` e os jogadores por `http://<ip-da-máquina>/player`.

### Variáveis de ambiente

| Variável | Padrão | Uso |
|---|---|---|
| `PORT` | `80` | Porta do servidor. Use outra se a 80 estiver ocupada (IIS, Skype etc.). |
| `MDNS_HOST` | `eva` | Nome anunciado na rede (`eva.local`). |
| `GOOGLE_CLIENT_ID` | — | OAuth do YouTube. Tem prioridade sobre o que for salvo pela interface. |
| `GOOGLE_CLIENT_SECRET` | — | OAuth do YouTube. |

No Windows (cmd): `set PORT=3001 && npm start`. No PowerShell: `$env:PORT=3001; npm start`. No Linux/macOS: `PORT=3001 npm start`.

## Conectando os jogadores

Todos precisam estar na mesma rede (mesmo Wi-Fi ou hotspot). O caminho mais simples é **Configurações › Acesso**: o painel mostra um QR code e o link de cada interface de rede da máquina. Os mesmos links aparecem no console quando o servidor sobe.

O servidor também se anuncia como `eva.local`, mas hotspots de celular, redes de convidado e redes públicas costumam bloquear mDNS. Por isso o link com IP é o principal.

Se a página não abrir no celular do jogador:

1. **Firewall do Windows.** Redes de hotspot são marcadas como "Pública" e bloqueiam conexões de entrada. Rode `npm run firewall` uma vez (pede elevação e libera a porta do app e o mDNS).
2. **Dados móveis.** Peça para o jogador desligar, porque eles podem ter prioridade sobre o Wi-Fi.
3. **Várias placas de rede.** Teste os outros links listados em Configurações › Acesso.
4. **Isolamento de clientes.** Alguns roteadores impedem que os aparelhos conversem entre si. Desative essa opção ou use outro ponto de acesso.

## Trilha sonora com YouTube (opcional)

As playlists da campanha funcionam sem configuração: basta colar links de vídeos do YouTube. Para acessar as playlists da sua conta e usar a busca:

1. No [Google Cloud Console](https://console.cloud.google.com/apis/credentials), crie um projeto e ative a **YouTube Data API v3**.
2. Crie uma credencial **OAuth client ID** do tipo *Aplicativo da Web*.
3. Em *URIs de redirecionamento autorizados*, adicione o endereço que aparece na aba **Conta** do player (`http://localhost:5173/api/music/youtube/callback` em dev ou `http://localhost/api/music/youtube/callback` em produção).
4. Com o app em modo *Testing*, adicione sua conta em **Usuários de teste**.
5. Cole o Client ID e o Client Secret na aba **Conta** e clique em **Entrar com Google**.

O login só funciona a partir de `localhost`, porque o Google recusa redirect HTTP em outros hosts. Isso não atrapalha o uso, já que a música toca no navegador do mestre. O player embutido não herda o YouTube Premium, e faixas com reprodução externa bloqueada são puladas.

## Estrutura

```
├── client/                 # Frontend React
│   └── src/
│       ├── components/     # campanhas, fichas, combate, mapa, música, configurações
│       ├── contexts/       # estado global
│       ├── pages/          # telas do mestre e do jogador
│       ├── services/       # cliente REST e Socket.IO
│       └── types/
├── server/                 # Backend Node.js
│   ├── scripts/            # liberação de firewall (Windows)
│   └── src/
│       ├── database/       # conexão SQLite e migrations
│       ├── middleware/     # autenticação do mestre
│       ├── routes/         # API REST
│       ├── services/       # regras de negócio por domínio
│       └── socket/         # eventos em tempo real
└── .claude/skills/         # skill de geração de mapas em MAPDSL
```

## Dados

Os dados ficam em `server/data/` (banco SQLite e imagens enviadas), que está fora do versionamento. Para fazer backup ou migrar de máquina, use **Exportar campanha** (JSON) ou copie essa pasta. Os tokens da conta do YouTube ficam numa tabela separada e não entram no export da campanha.
