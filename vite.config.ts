import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' để bundle chạy được cả ở root domain và sub-path (GitHub Pages)
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('react-router') || id.includes('/react/') || id.includes('/react-dom/')) return 'react'
          if (id.includes('recharts') || id.includes('/d3-')) return 'charts'
          if (id.includes('@xyflow') || id.includes('d3-zoom') || id.includes('d3-drag')) return 'flow'
          if (id.includes('sql.js')) return 'sqlite'
          return undefined
        },
      },
    },
  },
})
