import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: './', // Add this line to use relative paths
  build: {
    outDir: 'dist', // This is the default, but it's good practice to be explicit
  },
  server: {
    port: 5173,
    strictPort: true,
  }
});