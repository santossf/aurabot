import 'dotenv/config';
import { z } from 'zod';
 
const schema = z.object({
  // Avalon
  AVALON_CLIENT_ID:         z.string().min(1),
  AVALON_CLIENT_SECRET:     z.string().min(1),
  AVALON_PLATFORM_ID:       z.coerce.number().int().positive(),
  AVALON_SCOPE:             z.string().default('full offline_access'),
  AVALON_OAUTH_API_BASE_URL:z.string().url(),
  AVALON_WEBSOCKET_URL:     z.string().url(),
  AVALON_REDIRECT_URI:      z.string().url(),
 
  // App
  PORT:           z.coerce.number().int().positive().default(4000),
  NODE_ENV:       z.enum(['development', 'production', 'test']).default('development'),
  FRONTEND_URL:   z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET precisa ter pelo menos 32 caracteres'),
});
 
type Env = z.infer<typeof schema>;
 
function loadEnv(): Env {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    console.error('❌ Variáveis de ambiente inválidas:');
    console.error(parsed.error.flatten().fieldErrors);
    process.exit(1);
  }
  return parsed.data;
}
 
export const env: Env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
