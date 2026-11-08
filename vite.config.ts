import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Where the app is served from. GitHub Pages: /chester-training/ (the default). Cloudflare Pages: set BASE_PATH=/
const base: string = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.BASE_PATH || '/chester-training/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt', // applied by src/lib/updates.ts: right away, but never mid-session
      injectRegister: false,
      includeAssets: ['icon.svg', 'sfx/*.wav'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,png,wav}'], globIgnores: ['ocr/**', '**/pdf.worker*'], maximumFileSizeToCacheInBytes: 3_000_000 },
      manifest: {
        name: 'PalDex',
        short_name: 'PalDex',
        description: 'Your pet’s training, care and companion log',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#232320',
        id: base,
        start_url: base,
        scope: base,
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
