import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project-site base path. The repo is `ds-quiz`, so the published
// URL is https://<user>.github.io/ds-quiz/ and assets must resolve under
// `/ds-quiz/`. Override with VITE_BASE=/ for local-only experiments if needed.
const base = process.env.VITE_BASE ?? '/ds-quiz/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    target: 'es2020',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('recharts') || id.includes('d3-')) return 'vendor-charts';
          if (id.includes('react-markdown') || id.includes('micromark') || id.includes('mdast') || id.includes('hast')) {
            return 'vendor-markdown';
          }
        },
      },
    },
  },
});
