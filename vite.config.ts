import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Relative base so the offline build works when opened from the filesystem
  // and when wrapped by the Tauri/Electron desktop shell.
  base: './',
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('./src/core', import.meta.url)),
      '@app': fileURLToPath(new URL('./src/app', import.meta.url)),
      '@ai': fileURLToPath(new URL('./src/ai', import.meta.url)),
      '@persistence': fileURLToPath(new URL('./src/persistence', import.meta.url)),
    },
  },
  build: {
    target: 'es2022',
    outDir: 'dist',
    sourcemap: true,
  },
  test: {
    // Vitest config for component tests (engine tests run via `node --test`).
    environment: 'jsdom',
    globals: true,
    include: ['tests/component/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/component/setup.ts'],
  },
});
