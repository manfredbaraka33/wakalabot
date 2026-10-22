import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const backendUrl = env.BACKEND_URL || 'http://localhost:8000'
  return {
    plugins: [
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        devOptions: {
          enabled: true, // Enables service worker during npm run dev
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'wakalabot_logo.png'],
        manifest: {
          name: 'Wakalabot',
          short_name: 'Wakalabot',
          description: 'Msaidizi wa AI kwa biashara na taasisi za Tanzania',
          theme_color: '#0a0a0a',
          background_color: '#0a0a0a',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '/',
          icons: [
            {
              src: '/wakalabot_logo.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: '/wakalabot_logo.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: '/wakalabot_logo.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          // Cache static assets aggressively — dashboard shell loads fast
          // on repeat visits even on slow Tanzanian mobile data
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Never cache API calls — always fetch fresh data
              urlPattern: /^https:\/\/wakalabot\.co\.tz\/api\/.*/,
              handler: 'NetworkOnly',
            },
            {
              // Cache Cloudinary images so product photos load instantly on repeat
              urlPattern: /^https:\/\/res\.cloudinary\.com\/.*/,
              handler: 'CacheFirst',
              options: {
                cacheName: 'cloudinary-images',
                expiration: {
                  maxEntries: 200,
                  maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
                },
              },
            },
          ],
        },
      }),
    ],
    server: {
      https: false,
      port: 5173,
      allowedHosts: 'all',
      proxy: {
        '/api': {
          target: backendUrl,
          changeOrigin: true,
          secure: false,
        },
      },
    },
  }
})