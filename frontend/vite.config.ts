import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const backendTarget = (process.env.VITE_API_TARGET || process.env.API_BASE_URL || 'http://localhost:8001').replace(/\/$/, '')

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    host: '0.0.0.0',
    port: Number(process.env.VITE_PORT || 3000),
    strictPort: false,
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        ws: true,
        timeout: 20000,
        proxyTimeout: 20000,
        configure: (proxy) => {
          proxy.on('error', (_error, _request, response) => {
            if ('writeHead' in response && !response.headersSent && !response.writableEnded) {
              response.writeHead(503, { 'Content-Type': 'application/json' });
              response.end(JSON.stringify({ detail: 'The backend is temporarily unavailable. Please retry shortly.' }));
            }
          });
        },
      },
      '/reports': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
        timeout: 20000,
        proxyTimeout: 20000,
      },
    },
  },
})
