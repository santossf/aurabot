# Scalper.AI — Backend + Frontend

Integração completa com o SDK `@quadcode-tech/client-sdk-js` (a Avalon Broker é um operador da plataforma Quadcode), via OAuth PKCE com `offline_access`.

## Arquitetura

```
┌─────────────────┐         ┌──────────────────┐        ┌─────────────────┐
│    BROWSER      │         │  BACKEND EXPRESS │        │     AVALON      │
│   (Vite/React)  │         │  (Node.js)       │        │  (api.trade.*)  │
├─────────────────┤         ├──────────────────┤        ├─────────────────┤
│ • OAuthMethod   │         │ • OAuthMethod    │        │ • OAuth server  │
│   (sem secret)  │         │   (com secret)   │        │ • REST + WS     │
│ • ClientSdk     │  ◀───▶  │ • iron-session   │ ◀───▶ │ • Order books   │
│ • accessToken   │         │ • refreshToken   │        │ • Quotes        │
│   em memória    │         │   em cookie      │        │                 │
└─────────────────┘         └──────────────────┘        └─────────────────┘
       ▲                            ▲                          │
       │  /auth/exchange            │                          │
       │  /auth/refresh             │                          │
       │  /auth/me                  │                          │
       │  /auth/logout              │                          │
       │                            │                          │
       └────── WS direto ──────────────────────────────────────┘
```

**Princípios de segurança:**
- `client_secret` **só no backend**, em variável de ambiente.
- `refreshToken` **só no backend**, em cookie httpOnly.
- `accessToken` vive em memória no browser, renovado proativamente.
- `codeVerifier` (PKCE) em `sessionStorage` apenas entre login → callback.

## Estrutura

```
scalper-ai/
├─ backend/
│  ├─ .env.example
│  └─ src/
│     ├─ config/env.ts         Validação de envs com Zod
│     ├─ lib/
│     │  ├─ avalon.ts          Wrapper do SDK (server-side, com secret)
│     │  └─ session.ts         iron-session (cookies httpOnly)
│     ├─ routes/auth.ts        /exchange /refresh /me /logout
│     ├─ middleware/requireAuth.ts
│     └─ server.ts
└─ frontend/
   ├─ .env.example
   ├─ vite.config.ts           Proxies para evitar CORS em dev
   └─ src/
      ├─ App.tsx               Router minimalista + AuthProvider
      ├─ ScalperApp.tsx        ⚠️ MOVER PARA AQUI o app que já fizemos
      ├─ lib/
      │  ├─ api.ts             HTTP do nosso backend
      │  └─ avalonClient.ts    Wrapper do SDK no browser
      ├─ hooks/useAuth.tsx     Auth state + instância do SDK
      └─ pages/
         ├─ LoginPage.tsx      Tela de login (já feita)
         └─ CallbackPage.tsx   /auth/callback — recebe ?code, troca, autentica
```

## Fluxo OAuth implementado (PKCE + offline_access)

```
1. User clica "Entrar com Avalon"
   └─ Frontend: OAuthMethod.createAuthorizationUrl()
      └─ Salva codeVerifier em sessionStorage
      └─ window.location = url

2. Avalon mostra tela de login/cadastro
   └─ User autoriza
   └─ Avalon redireciona pra /auth/callback?code=...

3. CallbackPage lê ?code e codeVerifier (sessionStorage)
   └─ POST /auth/exchange { code, codeVerifier }

4. Backend (com client_secret) chama issueAccessTokenWithAuthCode
   └─ Recebe { accessToken, refreshToken, expiresIn }
   └─ Salva refreshToken em cookie httpOnly
   └─ Devolve { accessToken, expiresAt } pro browser

5. Frontend instancia ClientSdk.create(wsUrl, platformId, oauth)
   └─ AuthProvider muda para "authenticated"
   └─ App principal renderiza

6. Auto-refresh: 60s antes de expirar, frontend chama /auth/refresh
   └─ Backend usa refreshToken da sessão
   └─ Devolve novo accessToken
   └─ Frontend re-instancia o ClientSdk
```

## Setup (dev)

### Antes de tudo
1. **Rotacione o Client Secret** que foi compartilhado no chat — gere um novo no painel da Avalon.
2. **Cadastre o redirect URI** no painel da Avalon:
   - Dev: `http://localhost:5173/auth/callback`
   - Prod: `https://app.seudominio.com/auth/callback`

### Backend
```bash
cd backend
npm install
cp .env.example .env
# Gere SESSION_SECRET:
#   node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Cole no .env junto com o novo CLIENT_SECRET
npm run dev
# → http://localhost:4000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env
# As VITE_* já vêm com os valores corretos para a Avalon
npm run dev
# → http://localhost:5173
```

### Mover o app já existente
O componente do app que fizemos no início (`scalper-ai-app.tsx`) deve virar `frontend/src/ScalperApp.tsx`. O `App.tsx` já importa de lá:

```tsx
import { ScalperApp } from './ScalperApp';
```

Substitua o `export default function App` original por `export function ScalperApp`.

## Endpoints do backend

| Método | Rota              | Descrição                                              |
|--------|-------------------|--------------------------------------------------------|
| POST   | `/auth/exchange`  | Troca code+codeVerifier por accessToken                |
| POST   | `/auth/refresh`   | Renova accessToken usando refreshToken da sessão       |
| GET    | `/auth/me`        | Retorna user logado ou 401                             |
| POST   | `/auth/logout`    | Destrói a sessão                                       |
| GET    | `/health`         | Healthcheck                                            |

## Pontos a finalizar

- [ ] **Plugar gráfico real** no `BotScreen` — substituir o placeholder do `<ChartArea>` pelo componente `<Chart>` da doc da Quadcode (lightweight-charts + `sdk.realTimeChartDataLayer`).
- [ ] **Lista real de ativos** — substituir o `activeId=1` hardcoded por `sdk.blitzOptions().getActives()` (filtrando os disponíveis para compra agora). Veja a doc do SDK seção "Buy blitz options".
- [ ] **Banca real** — chamar `sdk.balances()` no boot e expor seleção entre real/demo.
- [ ] **Popular `session.user`** com identidade real do usuário (a doc do SDK não detalha qual chamada retorna isso — provavelmente vem em `balances()` ou via REST direto).
- [ ] **Revogar refresh token no logout** — depende do SDK expor isso, ou chamada HTTP direta ao endpoint `/oauth/revoke` da Avalon.

## Stack de IA + Bot (frontend/src/lib/)

A "inteligência" é algorítmica, roda no browser, sem servidor de inferência. Camadas:

```
ai/
├─ indicators.ts    EMA, RSI, ATR, momentum, padrões de candle (puro)
├─ engine.ts        analyze(candles) → Signal { direction, confidence, expiration, reasons }
└─ engine.test.ts   smoke test (rode com: npx tsx engine.test.ts)

bot/
├─ types.ts         Operation, BotState, SequenceState
├─ stopLoss.ts      Cálculo do risco máximo (dominante na UI)
└─ engine.ts        BotEngine: orquestra IA + corretora + gales + stop loss
```

### Como o bot decide entrar

1. Subscreve em candles 1s do ativo via `sdk.realTimeChartDataLayer(activeId, 1)`.
2. A cada 1s, roda `analyze(candles)`:
   - Vota: EMA(5)×EMA(21), RSI(14), momentum(5), padrões de candle.
   - Calcula confidence 0–100 e direction (CALL/PUT/null).
   - Escolhe expiração (5/10/15s) baseada em ATR/preço (volatilidade).
3. Se `confidence >= threshold[profile]`, entra com `sdk.blitzOptions().buy(...)`.
4. Aguarda resolução via `sdk.positions().subscribeOnUpdatePosition`.
5. **Win** → reseta sequência. **Loss** → próxima entrada vira gale (mesma direção, valor × multiplicador).
6. Atingiu `maxGales+1` losses consecutivos → **bot para**, modal de confirmação aparece.

### Thresholds de entrada por perfil

| Perfil | Confidence mínima |
|---|---|
| Conservador | 75 |
| Moderado | 65 |
| Ousado | 55 |

Quanto mais arriscado o perfil, menor o filtro — entra mais vezes, com sinais mais fracos.

### Modo dry-run

Se `sdk` for `null` no `useBot()`, o engine simula resultados pseudo-aleatórios (~45% de win, viés leve pela confidence). Útil para iterar a UI sem precisar de credenciais válidas.

## Avisos de segurança

- ⚠️ Nunca commite o `.env` (já no `.gitignore` por padrão se você criar um repo).
- ⚠️ Em produção, garanta `NODE_ENV=production` e HTTPS — o cookie de sessão só é `Secure` nesse caso.
- ⚠️ `SESSION_SECRET` deve ter no mínimo 32 caracteres, idealmente 64 bytes aleatórios.
