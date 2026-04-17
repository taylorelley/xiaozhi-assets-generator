// Vitest global setup for the assets-generator tests.
// Runs once before every test file in the project.

import { vi } from 'vitest'

// jsdom doesn't implement URL.createObjectURL / revokeObjectURL; some utilities
// (e.g. SpiffsGenerator.getImageDimensions) call them when parsing images.
if (typeof URL.createObjectURL !== 'function') {
  URL.createObjectURL = vi.fn(() => 'blob:mock')
}
if (typeof URL.revokeObjectURL !== 'function') {
  URL.revokeObjectURL = vi.fn()
}

// Provide a no-op fetch shim so individual tests can override with vi.fn().
if (typeof globalThis.fetch !== 'function') {
  globalThis.fetch = vi.fn(() =>
    Promise.reject(new Error('fetch not mocked in this test'))
  )
}
