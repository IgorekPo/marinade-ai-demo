import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        home: resolve(import.meta.dirname, 'index.html'),
        catalog: resolve(import.meta.dirname, 'catalog.html'),
        dry: resolve(import.meta.dirname, 'dry.html'),
        liquid: resolve(import.meta.dirname, 'liquid.html'),
      },
    },
  },
});
