import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// Where the app is served from. GitHub Pages: /chester-training/ (the default). Cloudflare Pages: set BASE_PATH=/
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};
const base: string = env.BASE_PATH || '/chester-training/';
// The app version attached to "Contact us" messages: package.json's version plus the commit it was built from
// (GitHub Actions or Cloudflare Pages), e.g. "0.1.0 (a1b2c3d)".
const commit = (env.GITHUB_SHA || env.CF_PAGES_COMMIT_SHA || '').slice(0, 7);
const appVersion = (env.npm_package_version || '0.1.0') + (commit ? ` (${commit})` : '');

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(appVersion) },
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
        // long-press the app icon (Android): one-tap logs, the same as Home's Quick log (`#/log/<what>`)
        shortcuts: [
          { name: 'Fed', short_name: 'Fed', url: base + '#/log/fed' },
          { name: 'Litter scooped', short_name: 'Scooped', url: base + '#/log/scoop' },
          { name: 'Played', short_name: 'Played', url: base + '#/log/play' },
          { name: 'Daily check: all normal', short_name: 'All normal', url: base + '#/log/check' },
        ],
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
