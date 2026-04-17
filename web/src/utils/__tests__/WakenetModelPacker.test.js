import { describe, it, expect } from 'vitest'
import WakenetModelPacker from '../WakenetModelPacker.js'

const ascii = (s) => {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xFF
  return out.buffer
}

describe('WakenetModelPacker - low-level packers', () => {
  const p = new WakenetModelPacker()

  it('packUint32 is little-endian', () => {
    expect(Array.from(p.packUint32(0x12345678))).toEqual([0x78, 0x56, 0x34, 0x12])
  })

  it('packString encodes ASCII and zero-pads to maxLen', () => {
    const bytes = p.packString('abc', 6)
    expect(Array.from(bytes)).toEqual([97, 98, 99, 0, 0, 0])
  })

  it('packString truncates when input exceeds maxLen', () => {
    const bytes = p.packString('abcdef', 3)
    expect(Array.from(bytes)).toEqual([97, 98, 99])
  })

  it('validatePackingCompatibility confirms ASCII + little-endian', () => {
    const report = p.validatePackingCompatibility()
    expect(report.stringPacking.isASCII).toBe(true)
    expect(report.intPacking.isLittleEndian).toBe(true)
  })
})

describe('WakenetModelPacker - addModelFile & getStats', () => {
  it('tracks models and files', () => {
    const p = new WakenetModelPacker()
    p.addModelFile('wn9_a', 'f1', ascii('hello'))
    p.addModelFile('wn9_a', 'f2', ascii('world!'))
    p.addModelFile('wn9_b', 'f1', ascii('xyz'))

    const stats = p.getStats()
    expect(stats.modelCount).toBe(2)
    expect(stats.fileCount).toBe(3)
    expect(stats.totalSize).toBe(5 + 6 + 3)
    expect(stats.models.sort()).toEqual(['wn9_a', 'wn9_b'])
  })

  it('clear() resets the model map', () => {
    const p = new WakenetModelPacker()
    p.addModelFile('wn9_a', 'f', ascii('x'))
    expect(p.getStats().modelCount).toBe(1)
    p.clear()
    expect(p.getStats().modelCount).toBe(0)
  })
})

describe('WakenetModelPacker - isValidModel', () => {
  it('accepts wn9s_* on esp32c3/esp32c6', () => {
    expect(WakenetModelPacker.isValidModel('wn9s_nihaoxiaozhi', 'esp32c3')).toBe(true)
    expect(WakenetModelPacker.isValidModel('wn9s_nihaoxiaozhi', 'esp32c6')).toBe(true)
    expect(WakenetModelPacker.isValidModel('wn9_nihaoxiaozhi', 'esp32c3')).toBe(false)
  })

  it('accepts wn9_* on non-C3/C6 chips', () => {
    expect(WakenetModelPacker.isValidModel('wn9_nihaoxiaozhi', 'esp32s3')).toBe(true)
    expect(WakenetModelPacker.isValidModel('wn9_nihaoxiaozhi', 'esp32p4')).toBe(true)
    expect(WakenetModelPacker.isValidModel('wn9s_nihaoxiaozhi', 'esp32s3')).toBe(false)
  })
})

describe('WakenetModelPacker - packModels()', () => {
  it('throws when no data was added', () => {
    const p = new WakenetModelPacker()
    expect(() => p.packModels()).toThrow(/No model data/)
  })

  it('produces a parseable binary with the expected structure', () => {
    const p = new WakenetModelPacker()
    p.addModelFile('wn9_a', 'fileA', ascii('hello'))
    p.addModelFile('wn9_a', 'fileB', ascii('world!'))
    p.addModelFile('wn9_b', 'fileA', ascii('xyz'))

    const buffer = p.packModels()
    const view = new DataView(buffer)
    const u8 = new Uint8Array(buffer)
    const decoder = new TextDecoder('ascii')
    const readName = (offset) =>
      decoder.decode(u8.slice(offset, offset + 32)).replace(/\0+$/, '')

    // model_num
    expect(view.getUint32(0, true)).toBe(2)

    // Models are sorted alphabetically; 'wn9_a' comes first with 2 files.
    let offset = 4
    expect(readName(offset)).toBe('wn9_a')
    offset += 32
    expect(view.getUint32(offset, true)).toBe(2) // file_number
    offset += 4

    // First file in wn9_a (sorted by name -> 'fileA').
    expect(readName(offset)).toBe('fileA')
    offset += 32
    const fileAStart = view.getUint32(offset, true)
    const fileALen = view.getUint32(offset + 4, true)
    offset += 8
    expect(fileALen).toBe(5)

    // Second file in wn9_a -> 'fileB'.
    expect(readName(offset)).toBe('fileB')
    offset += 32
    const fileBStart = view.getUint32(offset, true)
    const fileBLen = view.getUint32(offset + 4, true)
    offset += 8
    expect(fileBLen).toBe(6)
    expect(fileBStart).toBe(fileAStart + fileALen)

    // Second model: 'wn9_b' with one file.
    expect(readName(offset)).toBe('wn9_b')
    offset += 32
    expect(view.getUint32(offset, true)).toBe(1)
    offset += 4
    expect(readName(offset)).toBe('fileA')
    offset += 32
    const secondModelFileStart = view.getUint32(offset, true)
    const secondModelFileLen = view.getUint32(offset + 4, true)
    expect(secondModelFileLen).toBe(3)
    expect(secondModelFileStart).toBe(fileBStart + fileBLen)

    // Verify the actual payload bytes at the advertised offsets.
    expect(decoder.decode(u8.slice(fileAStart, fileAStart + fileALen))).toBe('hello')
    expect(decoder.decode(u8.slice(fileBStart, fileBStart + fileBLen))).toBe('world!')
    expect(decoder.decode(u8.slice(secondModelFileStart, secondModelFileStart + secondModelFileLen)))
      .toBe('xyz')
  })
})
