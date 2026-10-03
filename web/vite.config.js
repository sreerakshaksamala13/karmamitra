import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_PROXY_TARGET || 'http://localhost:5005';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Expose on the LAN so a phone browser can hit the web app too.
    host: true,
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true },
    },
  },
});