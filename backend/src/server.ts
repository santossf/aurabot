import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authRouter } from './routes/auth.js';
import { requireAuth } from './middleware/requireAuth.js';

const app = express();

app.use(express.json());
app.use(cookieParser());

// CORS — frontend roda em outra porta em dev
app.use(cors({
  origin: env.FRONTEND_URL,
  credentials: true, // permite cookies
}));

// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true }));

// OAuth
app.use('/auth', authRouter);

// Exemplo de rota protegida — daqui em diante todas as rotas /api/* exigem auth
app.get('/api/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// Erro 404
app.use((_req, res) => res.status(404).json({ error: 'not_found' }));

app.listen(env.PORT, () => {
  console.log(`▸ Backend rodando em http://localhost:${env.PORT}`);
  console.log(`▸ Frontend esperado em ${env.FRONTEND_URL}`);
  console.log(`▸ Redirect URI registrado: ${env.AVALON_REDIRECT_URI}`);
});
