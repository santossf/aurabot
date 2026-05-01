import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Proxies recomendados pela doc do SDK da Quadcode para evitar CORS em dev.
 * Em produção, o SDK fala direto com api.trade.avalonbroker.com.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/proxy/api': {
        target: 'https://api.trade.avalonbroker.com',
        changeOrigin: true,
        secure: false,
        rewrite: p => p.replace(/^\/proxy\/api/, ''),
      },
      '/proxy/ws': {
        target: 'wss://ws.trade.avalonbroker.com',
        ws: true,
        changeOrigin: true,
        rewriteWsOrigin: true,
        rewrite: p => p.replace(/^\/proxy\/ws/, ''),
      },
    },
  },
});
