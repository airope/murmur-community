import { vi } from 'vitest'

const app = {
  getPath: vi.fn((name: string) => {
    if (name === 'userData') return '/tmp/murmur-test-userdata'
    return '/tmp'
  }),
  isPackaged: false,
}

export { app }
export default { app }
