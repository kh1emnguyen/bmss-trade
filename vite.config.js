import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Allow JSX inside .js files (CRA-style convention).
// base: './' makes all asset paths relative — required for GitHub Pages
// subfolder hosting at kh1emnguyen.github.io/bmss-swing-trade/

export default defineConfig({
  plugins: [react()],
  base: './',
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
