import { defineConfig } from 'vite';

export default defineConfig({
  base: '/vibe-node-editor/',
  server: {
    port: 5173,
  },
  preview: {
    port: 4173,
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
