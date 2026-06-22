import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        '/api/gemini': {
          target: 'https://generativelanguage.googleapis.com',
          changeOrigin: true,
          headers: {
            'x-goog-api-key': env.GEMINI_API_KEY || '',
            'Content-Type': 'application/json',
          },
          rewrite: () => '/v1beta/interactions',
        },
      },
    },
  }
})
