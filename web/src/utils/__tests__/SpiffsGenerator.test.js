import { describe, it, expect } from 'vitest'
import SpiffsGenerator from '../SpiffsGenerator.js'

const encode = (s) => new TextEncoder().encode(s).buffer

describe('SpiffsGenerator - low-level packers', () => {
  const gen = new SpiffsGenerator()

  it('packUint32 writes little-endian bytes', () => {
    const bytes = gen.packUint32(0x12345678)
    expect(Array.from(bytes)).toEqual([0x78, 0x56, 0x34, 0x12])
  })

  it('packUint32(0) produces four zero bytes', () => {
    expect(Array.from(gen.packUint32(0))).toEqual([0, 0, 0, 0])
  })

  it('packUint16 writes little-endian bytes', () => {
    expect(Array.from(gen.packUint16(0x1234))).toEqual([0x34, 0x12])
  })

  it('packString truncates and zero-pads to the requested length', () => {
    const bytes = gen.packString('ab', 6)
    expect(Array.from(bytes)).toEqual([97, 98, 0, 0, 0, 0])
  })

  it('packString handles exactly-fitting strings', () => {
    const bytes = gen.packString('hello', 5)
    expect(Array.from(bytes)).toEqual([104, 101, 108, 108, 111])
  })

  it('computeChecksum sums bytes and masks to 16 bits', () => {
    expect(gen.computeChecksum(new Uint8Array([1, 2, 3, 4]))).toBe(10)
    // 0xFFFF + 1 should wrap to 0.
    const big = new Uint8Array(0x10000).fill(0)
    big[0] = 1
    for (let i = 1; i <= 0xFFFF; i++) big[i] = 1
    expect(gen.computeChecksum(big)).toBe(0x10000 & 0xFFFF)
  })
})

describe('SpiffsGenerator - sortFiles', () => {
  const gen = new SpiffsGenerator()

  it('sorts first by extension, then by stem', () => {
    const sorted = gen.sortFiles([
      { filename: 'b.png' },
      { filename: 'a.txt' },
      { filename: 'a.png' },
      { filename: 'c.png' },
    ])
    expect(sorted.map((f) => f.filename)).toEqual([
      'a.png',
      'b.png',
      'c.png',
      'a.txt',
    ])
  })
})

describe('SpiffsGenerator - parseSpecialImageFormat', () => {
  const gen = new SpiffsGenerator()

  it('returns 0/0 for non-special extensions', () => {
    const { width, height } = gen.parseSpecialImageFormat('foo.png', new ArrayBuffer(32))
    expect(width).toBe(0)
    expect(height).toBe(0)
  })

  it('reads width/height at offsets 14 and 16 for .sjpg', () => {
    const buf = new ArrayBuffer(32)
    const view = new DataView(buf)
    view.setUint16(14, 320, true)
    view.setUint16(16, 240, true)
    const { width, height } = gen.parseSpecialImageFormat('bg.sjpg', buf)
    expect(width).toBe(320)
    expect(height).toBe(240)
  })
})

describe('SpiffsGenerator - generate()', () => {
  it('throws when no files were added', async () => {
    const gen = new SpiffsGenerator()
    await expect(gen.generate()).rejects.toThrow(/No files to package/)
  })

  it('produces the expected header and embeds the 0x5A5A markers', async () => {
    const gen = new SpiffsGenerator()
    // Use .bin so generate() skips image-dimension probing (which would
    // hang in jsdom because it relies on the real image decoder).
    gen.addFile('a.bin', encode('hello'), { width: 10, height: 20 })
    gen.addFile('b.bin', encode('world!'), { width: 30, height: 40 })

    const buffer = await gen.generate()
    const view = new DataView(buffer)
    const u8 = new Uint8Array(buffer)

    // Header: total_files, checksum, combined_data_length.
    expect(view.getUint32(0, true)).toBe(2)
    const combinedLen = view.getUint32(8, true)

    // Expected combined-data layout: 2 mmap entries (44 bytes each) + 2*(2 prefix + payload)
    const expectedMmapLen = 2 * (32 + 4 + 4 + 2 + 2)
    const expectedDataLen = (2 + 5) + (2 + 6)
    expect(combinedLen).toBe(expectedMmapLen + expectedDataLen)

    // Total buffer length = 12 header + combined.
    expect(buffer.byteLength).toBe(12 + combinedLen)

    // Verify the first file's mmap entry: stem + extension + zero padding, then size/offset/width/height.
    const firstEntryStart = 12
    const firstName = new TextDecoder().decode(u8.slice(firstEntryStart, firstEntryStart + 32))
      .replace(/\0+$/, '')
    expect(firstName).toBe('a.bin')
    expect(view.getUint32(firstEntryStart + 32, true)).toBe(5)     // size
    expect(view.getUint32(firstEntryStart + 36, true)).toBe(0)     // offset
    expect(view.getUint16(firstEntryStart + 40, true)).toBe(10)    // width
    expect(view.getUint16(firstEntryStart + 42, true)).toBe(20)    // height

    // First payload should live at combined-data + mmap length, prefixed with 0x5A 0x5A.
    const firstPayloadStart = 12 + expectedMmapLen
    expect(u8[firstPayloadStart]).toBe(0x5A)
    expect(u8[firstPayloadStart + 1]).toBe(0x5A)
    expect(new TextDecoder().decode(u8.slice(firstPayloadStart + 2, firstPayloadStart + 2 + 5)))
      .toBe('hello')

    // Checksum in the header must match computeChecksum over the combined region.
    const checksum = view.getUint32(4, true)
    const expectedChecksum = new SpiffsGenerator().computeChecksum(
      u8.slice(12, 12 + combinedLen)
    )
    expect(checksum).toBe(expectedChecksum)
  })

  it('invokes the progress callback with monotonic non-decreasing progress', async () => {
    const gen = new SpiffsGenerator()
    gen.addFile('a.bin', encode('hi'), { width: 1, height: 1 })

    const progress = []
    await gen.generate((pct, msg) => progress.push({ pct, msg }))

    expect(progress.length).toBeGreaterThan(0)
    expect(progress[0].pct).toBe(0)
    expect(progress[progress.length - 1].pct).toBe(100)
    for (let i = 1; i < progress.length; i++) {
      expect(progress[i].pct).toBeGreaterThanOrEqual(progress[i - 1].pct)
    }
  })
})

describe('SpiffsGenerator - getStats & clear', () => {
  it('reports file counts, sizes, and extension distribution', () => {
    const gen = new SpiffsGenerator()
    gen.addFile('a.png', encode('12345'))
    gen.addFile('b.png', encode('1234567890'))
    gen.addFile('c.txt', encode('abc'))

    const stats = gen.getStats()
    expect(stats.fileCount).toBe(3)
    expect(stats.totalSize).toBe(5 + 10 + 3)
    expect(stats.fileTypes).toEqual({ png: 2, txt: 1 })
    expect(stats.averageFileSize).toBe(Math.round((5 + 10 + 3) / 3))
  })

  it('clear() empties the file list', () => {
    const gen = new SpiffsGenerator()
    gen.addFile('a.png', encode('x'))
    expect(gen.getStats().fileCount).toBe(1)
    gen.clear()
    expect(gen.getStats().fileCount).toBe(0)
  })
})
