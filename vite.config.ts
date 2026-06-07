import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages base path. If repo name changes, update this.
// For user.github.io repo, set base to '/'. For project pages, '/<repo>/'.
const base = process.env.VITE_BASE ?? '/solo-level-up/';

export default defineConfig({
  plugins: [react()],
  base,
  build: {
    // Match the app's tsconfig target so esbuild doesn't down-level modern
    // syntax (smaller, faster output for the evergreen-browser PWA target).
    target: 'es2022',
    rollupOptions: {
      output: {
        // Split the large, rarely-changing vendor libs into their own chunks
        // so a normal app-code deploy doesn't bust their browser cache.
        // IMPORTANT: keep *all* of firebase in a single chunk — splitting
        // auth/firestore apart can trigger "cannot access before
        // initialization" runtime errors from their shared init order.
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@firebase') || id.includes('/firebase/')) return 'vendor-firebase';
          if (
            id.includes('framer-motion') ||
            id.includes('motion-dom') ||
            id.includes('motion-utils')
          ) {
            return 'vendor-motion';
          }
          if (id.includes('@dnd-kit')) return 'vendor-dnd';
        },
      },
    },
  },
});
