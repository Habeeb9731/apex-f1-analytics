import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(root, 'src') } },
  server: {
    proxy: { '/api': { target: 'http://127.0.0.1:3001', changeOrigin: false } },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/recharts/')) return 'charts';
          if (id.includes('/node_modules/d3')) return 'd3';
          if (id.includes('/node_modules/@tanstack/')) return 'query';
          if (id.includes('/node_modules/react-dom/') || id.includes('/node_modules/react/')) return 'react';
        },
      },
    },
  },
});
