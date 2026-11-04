import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api/auth': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/credits': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/game-rules': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/game-rounds': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/players': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
