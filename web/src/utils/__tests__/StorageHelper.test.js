import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the configStorage singleton before importing StorageHelper so the
// static methods resolve to our spies rather than the real IndexedDB shim.
vi.mock('../ConfigStorage.js', () => {
  const configStorage = {
    saveFile: vi.fn(async () => {}),
    loadFile: vi.fn(async () => null),
    deleteFile: vi.fn(async () => {}),
    clearAll: vi.fn(async () => {}),
    getStorageInfo: vi.fn(async () => ({ configs: { count: 0 }, files: { count: 0 }, temp_data: { count: 0 }, lastSaved: null })),
  }
  return { default: configStorage }
})

const { default: configStorage } = await import('../ConfigStorage.js')
const { default: StorageHelper } = await import('../StorageHelper.js')

beforeEach(() => {
  for (const fn of Object.values(configStorage)) {
    if (typeof fn?.mockClear === 'function') fn.mockClear()
  }
})

const makeFile = (name) => ({ name })

describe('StorageHelper - saveFontFile', () => {
  it('delegates to configStorage.saveFile with the expected key and metadata', async () => {
    const file = makeFile('my-font.ttf')
    await StorageHelper.saveFontFile(file, { size: 24, bpp: 2, charset: 'gb2312' })

    expect(configStorage.saveFile).toHaveBeenCalledTimes(1)
    const [key, passedFile, kind, metadata] = configStorage.saveFile.mock.calls[0]
    expect(key).toBe('custom_font')
    expect(passedFile).toBe(file)
    expect(kind).toBe('font')
    expect(metadata).toEqual({ size: 24, bpp: 2, charset: 'gb2312' })
  })

  it('uses defaults when no config is provided', async () => {
    await StorageHelper.saveFontFile(makeFile('f.ttf'))
    const [, , , metadata] = configStorage.saveFile.mock.calls[0]
    expect(metadata).toEqual({ size: 20, bpp: 4, charset: 'deepseek' })
  })

  it('is a no-op when file is null', async () => {
    await StorageHelper.saveFontFile(null)
    expect(configStorage.saveFile).not.toHaveBeenCalled()
  })
})

describe('StorageHelper - saveEmojiFile key prefix logic', () => {
  it("uses the hash as-is when the name starts with 'hash_'", async () => {
    await StorageHelper.saveEmojiFile('hash_abc123', makeFile('e.gif'), { size: { width: 64, height: 64 }, emotions: ['smile'] })
    expect(configStorage.saveFile.mock.calls[0][0]).toBe('hash_abc123')
  })

  it("prefixes plain names with 'emoji_'", async () => {
    await StorageHelper.saveEmojiFile('smile', makeFile('e.gif'))
    expect(configStorage.saveFile.mock.calls[0][0]).toBe('emoji_smile')
  })

  it('defaults the size to 64x64 when config.size is missing', async () => {
    await StorageHelper.saveEmojiFile('cry', makeFile('e.gif'))
    const metadata = configStorage.saveFile.mock.calls[0][3]
    expect(metadata.size).toEqual({ width: 64, height: 64 })
    expect(metadata.name).toBe('cry')
  })

  it('skips saving when the emoji name is missing', async () => {
    await StorageHelper.saveEmojiFile('', makeFile('e.gif'))
    expect(configStorage.saveFile).not.toHaveBeenCalled()
  })
})

describe('StorageHelper - background helpers', () => {
  it("saves backgrounds under 'background_<mode>'", async () => {
    await StorageHelper.saveBackgroundFile('light', makeFile('bg.png'), { tint: 'warm' })
    expect(configStorage.saveFile.mock.calls[0][0]).toBe('background_light')
    const metadata = configStorage.saveFile.mock.calls[0][3]
    expect(metadata.mode).toBe('light')
    expect(metadata.tint).toBe('warm')
  })

  it('survives non-serialisable config objects via fallback clone', async () => {
    const circular = {}
    circular.self = circular
    await expect(
      StorageHelper.saveBackgroundFile('dark', makeFile('bg.png'), circular)
    ).resolves.toBeUndefined()
    expect(configStorage.saveFile).toHaveBeenCalledTimes(1)
  })
})

describe('StorageHelper - restore and delete', () => {
  it('restoreEmojiFile forwards the right key and returns the loaded file', async () => {
    configStorage.loadFile.mockResolvedValueOnce(makeFile('loaded.gif'))
    const file = await StorageHelper.restoreEmojiFile('smile')
    expect(configStorage.loadFile).toHaveBeenCalledWith('emoji_smile')
    expect(file).toEqual({ name: 'loaded.gif' })
  })

  it('restoreEmojiFile honours hash_ prefix pass-through', async () => {
    configStorage.loadFile.mockResolvedValueOnce(null)
    await StorageHelper.restoreEmojiFile('hash_deadbeef')
    expect(configStorage.loadFile).toHaveBeenCalledWith('hash_deadbeef')
  })

  it('restoreBackgroundFile builds the background_<mode> key', async () => {
    await StorageHelper.restoreBackgroundFile('dark')
    expect(configStorage.loadFile).toHaveBeenCalledWith('background_dark')
  })

  it('deleteEmojiFile forwards the prefixed key', async () => {
    await StorageHelper.deleteEmojiFile('smile')
    expect(configStorage.deleteFile).toHaveBeenCalledWith('emoji_smile')
  })

  it('deleteFontFile calls configStorage.deleteFile with custom_font', async () => {
    await StorageHelper.deleteFontFile()
    expect(configStorage.deleteFile).toHaveBeenCalledWith('custom_font')
  })

  it('clearAllFiles re-throws underlying errors', async () => {
    configStorage.clearAll.mockRejectedValueOnce(new Error('boom'))
    await expect(StorageHelper.clearAllFiles()).rejects.toThrow('boom')
  })

  it('getStorageInfo returns a safe default when the backend throws', async () => {
    configStorage.getStorageInfo.mockRejectedValueOnce(new Error('down'))
    const info = await StorageHelper.getStorageInfo()
    expect(info.configs.count).toBe(0)
    expect(info.files.count).toBe(0)
    expect(info.lastSaved).toBeNull()
  })
})
