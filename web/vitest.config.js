import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@share': resolve(__dirname, 'share'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.js'],
    include: [
      'src/**/__tests__/**/*.{test,spec}.{js,mjs}',
      'src/**/*.{test,spec}.{js,mjs}',
      'tests/**/*.{test,spec}.{js,mjs}',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/utils/**/*.js', 'src/composables/**/*.js'],
      exclude: [
        'src/utils/font_conv/**',
        'src/utils/WasmGifScaler.js',
        'src/utils/WebSocketTransfer.js',
        'src/utils/AssetsBuilder.js',
      ],
    },
  },
})
