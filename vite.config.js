import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Un solo runtime React para componentes y renderer, también en tests.
  resolve: { dedupe: ['react', 'react-dom'] },
  optimizeDeps: {
    // Analizar sólo la entrada del portal, no HTML de pruebas o perfiles locales.
    entries: ['index.html'],
    // Preparar el generador PDF antes de solicitar su import dinámico.
    include: ['jspdf']
  },
  test: {
    // Evita que la carga simultánea de todos los entornos retrase los imports lazy.
    maxWorkers: 2,
    environment: 'jsdom',
    include: ['tests/**/*.test.jsx'],
    setupFiles: ['./tests/setup.jsx'],
    restoreMocks: true
  }
})
