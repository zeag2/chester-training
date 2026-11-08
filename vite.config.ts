import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/chester-training/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'sfx/*.wav'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,wav}'] },
      manifest: {
        name: 'PalDex',
        short_name: 'PalDex',
        description: 'Your pet’s training, care and companion log',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#232320',
        start_url: '/chester-training/',
        scope: '/chester-training/',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { environment: 'jsdom', setupFiles: ['./src/test-setup.ts'] },
});
