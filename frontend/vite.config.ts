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
      },
    },
  },
})
