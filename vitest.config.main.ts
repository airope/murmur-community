import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/main/__tests__/**/*.test.ts'],
  },
  resolve: {
    alias: {
      // Mock electron in tests
      electron: path.resolve(__dirname, 'src/main/__tests__/__mocks__/electron.ts'),
    }
  }
})
