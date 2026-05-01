# Guia de Deploy — Auraa Bot

Passo a passo do zero até `https://auraabot.online` no ar.

---

## Visão geral

```
┌────────────────────┐         ┌────────────────────┐
│ GitHub             │ ──────▶ │ Netlify            │  Frontend
│ (seu código)       │         │ auraabot.online    │  (React/Vite)
│                    │ ──────▶ │ Render             │  Backend
│                    │         │ api.auraabot.online│  (Express)
└────────────────────┘         └────────────────────┘
                                         │
                                         ▼
                                   Avalon OAuth
```

Custo total: **R$ 0/mês** nos planos gratuitos. Domínio você já tem.

---

## ETAPA 0 — Antes de começar

### Faça isto AGORA, sem desculpa:

1. **Rotacione o Client Secret** no painel da Avalon. O secret que você compartilhou no chat (`y6wrjcdj1cmlrfczicambi595ytfv89g`) deve ser tratado como vazado. Gere um novo — você vai precisar dele em alguns minutos.

2. **Verifique o redirect URI cadastrado.** Confirme no painel da Avalon que o URI cadastrado é:
   ```
   https://auraabot.online/oauth
   ```
   Se você cadastrou só o `www.`, adicione a versão sem `www` também (ou troque). Seu domínio principal vai ser **sem** `www`.

3. **Teste o projeto localmente PRIMEIRO.** Se der erro, melhor descobrir agora do que com o site no ar. Pule para a seção "Teste local" mais abaixo se ainda não fez isso.

---

## ETAPA 1 — Criar conta no GitHub (15 min)

GitHub é onde seu código vai morar. Tanto Netlify quanto Render fazem deploy automático a partir de um repositório GitHub.

1. Acesse [github.com/signup](https://github.com/signup) e crie uma conta gratuita.
2. Verifique seu e-mail.

### Subir o código pela primeira vez

A forma mais simples sem instalar nada é pelo **GitHub Desktop**:

1. Baixe e instale [GitHub Desktop](https://desktop.github.com).
2. Faça login com a conta que você acabou de criar.
3. **File > New repository**:
   - Name: `auraabot`
   - Local path: escolha onde quer salvar (ex: `~/Documents`)
   - Initialize with a README: **desmarque**
   - Click "Create repository".
4. Abra a pasta criada e **copie todo o conteúdo do `scalper-ai/` para dentro dela** (o conteúdo, não a pasta).
5. Volte ao GitHub Desktop. Você vai ver todos os arquivos listados.
6. **MUITO IMPORTANTE**: confirme que `.env` **NÃO está na lista**. Se estiver, pare e me avisa antes de continuar — significa que o `.gitignore` não está funcionando.
7. No campo "Summary" embaixo: `inicial`. Click **Commit to main**.
8. Click **Publish repository** no topo. Marque "Keep this code private" (privado, importante). Click Publish.

Pronto. Seu código está no GitHub.

---

## ETAPA 2 — Backend no Render (10 min)

1. Acesse [render.com](https://render.com) e clique em "Get Started for Free".
2. Click **"Sign in with GitHub"** — autorize o Render a ler seus repositórios.
3. No dashboard, click **New +** > **Blueprint**.
4. Selecione o repositório `auraabot`.
5. Render detecta automaticamente o `render.yaml` e mostra um preview do serviço.
6. Click **Apply**.

### Preencher variáveis sensíveis

O Render vai criar o serviço, mas algumas envs ele não preenche automaticamente. Click no serviço criado (`auraabot-backend`) > **Environment** no menu lateral > **Add Environment Variable**:

| Key | Value | Observação |
|---|---|---|
| `AVALON_CLIENT_SECRET` | `<o secret NOVO que você gerou>` | **NÃO use o antigo do chat** |

Click **Save Changes**. O Render vai fazer redeploy automático.

### Pegue a URL do backend

Quando o build terminar (3–5 min), no topo da página do serviço aparece a URL:
```
https://auraabot-backend-xxxx.onrender.com
```

Anote essa URL — você vai usar no próximo passo.

> **Dica:** o tier gratuito do Render "dorme" depois de 15 minutos sem requisições, levando ~30s para acordar na primeira chamada. Para produção real, eventualmente vale subir para o tier de US$ 7/mês.

---

## ETAPA 3 — Frontend na Netlify (10 min)

1. Acesse [netlify.com](https://netlify.com) e clique em **Sign up**.
2. Click **"Sign up with GitHub"**.
3. No dashboard, click **Add new site** > **Import an existing project**.
4. **Deploy with GitHub** > selecione o repositório `auraabot`.
5. A Netlify vai detectar o `netlify.toml` automaticamente. Confirme que mostra:
   - Base directory: `frontend`
   - Publish directory: `frontend/dist`
   - Build command: `npm install && npm run build`

6. Antes de clicar Deploy, click em **Show advanced** > **Add environment variables**. Adicione:

| Key | Value |
|---|---|
| `VITE_AVALON_API_BASE_URL` | `https://api.trade.avalonbroker.com` |
| `VITE_AVALON_WS_URL` | `wss://ws.trade.avalonbroker.com/echo/websocket` |
| `VITE_AVALON_CLIENT_ID` | `242284863837060` |
| `VITE_AVALON_PLATFORM_ID` | `199` |
| `VITE_AVALON_SCOPE` | `full offline_access` |
| `VITE_AVALON_REDIRECT_URI` | `https://auraabot.online/oauth` |
| `VITE_API_BASE_URL` | `https://auraabot-backend-xxxx.onrender.com` ← URL do passo 2 |

7. Click **Deploy auraabot**.

Em ~2 minutos você terá uma URL tipo `https://random-name-12345.netlify.app`. **O site já está no ar nessa URL temporária**, mas ainda falta apontar seu domínio.

---

## ETAPA 4 — Apontar o domínio auraabot.online

### No painel da Netlify

1. Vá no site recém-criado > **Domain management**.
2. Click **Add a domain** > digite `auraabot.online` > **Verify**.
3. A Netlify pergunta se você quer transferir DNS para ela ou apontar manualmente. **Recomendo apontar manualmente** (mais flexível).
4. A Netlify mostra os registros DNS que você precisa configurar:
   - `A` record para `@` apontando para um IP da Netlify
   - `CNAME` para `www` apontando para `<seu-site>.netlify.app`

### No painel onde você comprou o domínio

(Registro.br, GoDaddy, Hostinger, Namecheap, etc.)

1. Encontre a seção **DNS** ou **Zona DNS**.
2. Adicione os registros que a Netlify mostrou.
3. **Salve**.

DNS leva de minutos a algumas horas para propagar. Se em 30 minutos `auraabot.online` ainda não funcionar, espere mais um pouco.

### Habilitar HTTPS (automático)

Quando o DNS estiver propagado, a Netlify vai oferecer **HTTPS** automaticamente via Let's Encrypt. Click no botão para gerar o certificado. Em 5 minutos seu site vai estar em `https://auraabot.online`.

---

## ETAPA 5 — Atualizar URL do backend

Você ainda está usando a URL feia do Render (`onrender.com`). Para profissionalizar, aponte um subdomínio.

### No Render
1. Serviço `auraabot-backend` > **Settings** > **Custom Domains** > Add Custom Domain.
2. Digite `api.auraabot.online`.
3. Render mostra um CNAME para você adicionar no DNS.

### No painel do seu domínio
Adicione `CNAME` para `api` apontando para o destino que o Render mostrou.

### Atualize as configs

**Na Netlify** (site > Site configuration > Environment variables): mude `VITE_API_BASE_URL` para `https://api.auraabot.online`.

**No Render** (envs do backend): mude:
- `FRONTEND_URL` para `https://auraabot.online`
- `AVALON_REDIRECT_URI` para `https://auraabot.online/oauth` (se ainda não estiver)

Faça redeploy nos dois (Netlify: trigger deploy; Render: manual deploy ou commit no Git).

---

## ETAPA 6 — Testar

1. Abra `https://auraabot.online`.
2. Você vê a tela de login.
3. Clique em **ENTRAR COM AVALON**.
4. Você é redirecionado para a Avalon, faz login lá.
5. A Avalon te manda de volta para `https://auraabot.online/oauth?code=...`.
6. O frontend troca o code via backend, e você cai na home com 4 banners.
7. Clica em "Inteligência para Operar em Scalping" e abre o painel.

Se travar em algum passo, abra o **DevTools do navegador (F12) > Console e Network** e me manda o erro.

---

## Atualizar o site depois

Toda vez que você quiser mudar algo:

1. Edite os arquivos localmente (no editor que preferir — recomendo VS Code, gratuito).
2. Abra GitHub Desktop, escreva uma mensagem de commit (ex: "ajusta cor do botão"), click Commit, click Push.
3. Pronto. Netlify e Render detectam o push e fazem redeploy sozinhos em ~2 minutos.

---

## Teste local (faça ANTES de subir)

Se você não testou ainda:

```bash
# Terminal 1: backend
cd backend
npm install
cp .env.example .env
# Edite .env: cole CLIENT_SECRET novo
# Gere SESSION_SECRET com: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Cole o resultado em SESSION_SECRET no .env
npm run dev

# Terminal 2: frontend
cd frontend
npm install
cp .env.example .env
# .env já vem com os valores certos para dev
npm run dev
```

Acesse `http://localhost:5173`. Para testar OAuth localmente, você precisa que o redirect `http://localhost:5173/oauth` esteja cadastrado na Avalon (peça pra cadastrarem para teste).

---

## Troubleshooting comum

**"Site Not Found" na Netlify após apontar o domínio:**
- DNS ainda não propagou. Aguarde 30 min.
- Verifique se o registro `A` tem o IP correto. Use [whatsmydns.net](https://whatsmydns.net).

**"CORS error" no console do navegador:**
- Confirme que `FRONTEND_URL` no Render está EXATO como o domínio que você está acessando, com `https://`.

**"unauthenticated" infinito após login:**
- O cookie de sessão precisa cruzar entre `auraabot.online` (frontend) e `api.auraabot.online` (backend). Como são subdomínios do mesmo domínio raiz, funciona — mas só com `SameSite=Lax` e `Secure`. Confirme que `NODE_ENV=production` no Render.

**Backend "dormiu" e demora 30s para responder:**
- Comportamento esperado do tier free do Render. Normal.

**Erro de OAuth "redirect_uri_mismatch":**
- O URI cadastrado na Avalon precisa bater EXATAMENTE com o que o frontend manda. Sem barra no final, com/sem `www` consistente.

---

## Checklist final antes de divulgar

- [ ] Client Secret antigo foi rotacionado
- [ ] `.env` NÃO está commitado no GitHub (verifique no site do GitHub)
- [ ] Domínio com HTTPS funcionando
- [ ] Backend respondendo em `api.auraabot.online/health` (deve retornar `{"ok":true}`)
- [ ] Login → callback → home funciona end-to-end
- [ ] DevTools sem erros no Console
