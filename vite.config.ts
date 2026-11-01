import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Auf GitHub Pages liegt die App unter /<repo-name>/. Der Workflow setzt VITE_BASE_PATH.
const base = process.env.VITE_BASE_PATH ?? '/'

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      // "prompt": UpdatePrompt.tsx entscheidet, wann neu geladen wird, damit beim Tippen nichts verloren geht.
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Crack',
        short_name: 'Crack',
        description: 'Gemeinsam einkaufen, kochen und Ideen sammeln.',
        lang: 'de',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f3',
        theme_color: '#5b7f64',
        // Android: Crack erscheint im "Teilen"-Menue, zum Beispiel in TikTok. iOS kennt das bei PWAs nicht.
        share_target: {
          action: '.',
          method: 'GET',
          params: { title: 'title', text: 'text', url: 'url' },
        },
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
  test: {
    include: ['src/**/*.test.ts', 'supabase/functions/**/*.test.ts'],
  },
})
