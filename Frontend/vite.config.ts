import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],

  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 1000,
    },

    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        secure: false,
      },
    },

    allowedHosts: [
      'depletion-cartoon-nephew.ngrok-free.dev',
    ],
  },
})
