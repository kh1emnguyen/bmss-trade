import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Allow JSX inside .js files (CRA-style convention) — works on StackBlitz / WebContainer.
//
// Why this shape: setting esbuild.loader = 'jsx' globally is the only form that
// is reliably honoured across Vite's dev server (esbuild) AND build (rollup +
// esbuild). The narrower `esbuild.include` filter is not a first-class Vite
// option and is dropped silently in some environments. Esbuild's JSX loader is
// tolerant of pure-JS files, so applying it globally is safe.

export default defineConfig({
  plugins: [react()],
  esbuild: {
    loader: 'jsx',
    include: /.*\.jsx?$/,
    exclude: [],
  },
  optimizeDeps: {
    esbuildOptions: {
      loader: { '.js': 'jsx' },
    },
  },
  server: { host: true },
});
