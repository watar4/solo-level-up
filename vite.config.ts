import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages base path. If repo name changes, update this.
// For user.github.io repo, set base to '/'. For project pages, '/<repo>/'.
const base = process.env.VITE_BASE ?? '/solo-level-up/';

export default defineConfig({
  plugins: [react()],
  base,
});
