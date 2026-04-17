import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useDeviceStatus } from '../useDeviceStatus.js'

const t = (key) => key

describe('useDeviceStatus - getSignalDisplayText', () => {
  const { getSignalDisplayText } = useDeviceStatus()

  it('maps known levels to i18n keys', () => {
    expect(getSignalDisplayText('strong', t)).toBe('device.signal.strong')
    expect(getSignalDisplayText('medium', t)).toBe('device.signal.medium')
    expect(getSignalDisplayText('weak', t)).toBe('device.signal.weak')
    expect(getSignalDisplayText('none', t)).toBe('device.signal.none')
  })

  it('is case-insensitive', () => {
    expect(getSignalDisplayText('STRONG', t)).toBe('device.signal.strong')
    expect(getSignalDisplayText('Weak', t)).toBe('device.signal.weak')
  })

  it('falls back to the raw value for unknown strings', () => {
    expect(getSignalDisplayText('cosmic', t)).toBe('cosmic')
  })

  it('falls back to the unknown i18n key for empty/null signals', () => {
    expect(getSignalDisplayText(null, t)).toBe('device.signal.unknown')
    expect(getSignalDisplayText('', t)).toBe('device.signal.unknown')
    expect(getSignalDisplayText(undefined, t)).toBe('device.signal.unknown')
  })
})

describe('useDeviceStatus - callMcpTool', () => {
  const { callMcpTool } = useDeviceStatus()

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  it('rejects when there is no auth token', async () => {
    await expect(callMcpTool('self.get_system_info')).rejects.toThrow(/Authentication token/)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })
})

describe('useDeviceStatus - checkDeviceStatus is a no-op without a token', () => {
  const { checkDeviceStatus, isChecking, isDeviceOnline } = useDeviceStatus()

  beforeEach(() => {
    globalThis.fetch = vi.fn()
  })

  it('does nothing and leaves isChecking false when there is no token', async () => {
    await checkDeviceStatus()
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(isChecking.value).toBe(false)
    // When no token has ever been set, the device cannot be online.
    expect(isDeviceOnline.value).toBe(false)
  })
})
