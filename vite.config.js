import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Un solo runtime React para componentes y renderer, también en tests.
  resolve: { dedupe: ['react', 'react-dom'] },
  test: {
    // Evita que la carga simultánea de todos los entornos retrase los imports lazy.
    maxWorkers: 2,
    environment: 'jsdom',
    include: ['tests/**/*.test.jsx'],
    setupFiles: ['./tests/setup.jsx'],
    restoreMocks: true
  }
})
