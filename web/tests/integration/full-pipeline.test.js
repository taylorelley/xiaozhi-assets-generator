// Integration test: pack a wake-word model and embed it into a SPIFFS image,
// then verify the produced bytes are internally consistent (offsets, sizes,
// 0x5A5A marker, checksum).

import { describe, it, expect } from 'vitest'
import SpiffsGenerator from '@/utils/SpiffsGenerator.js'
import WakenetModelPacker from '@/utils/WakenetModelPacker.js'

const ascii = (s) => {
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i) & 0xFF
  return out.buffer
}

describe('integration: wakenet model packed into spiffs image', () => {
  it('produces a valid assets.bin containing the srmodels blob', async () => {
    const packer = new WakenetModelPacker()
    packer.addModelFile('wn9_nihaoxiaozhi', '_MODEL_INFO_', ascii('INFO-v1'))
    packer.addModelFile('wn9_nihaoxiaozhi', 'wn9_data', ascii('DATA-blob-payload-0123456789'))
    packer.addModelFile('wn9_nihaoxiaozhi', 'wn9_index', ascii('IDX-123'))

    const srmodelsBuf = packer.packModels()
    expect(srmodelsBuf.byteLength).toBeGreaterThan(32)

    // Model count lives in the first 4 bytes, little-endian.
    const srView = new DataView(srmodelsBuf)
    expect(srView.getUint32(0, true)).toBe(1)

    const spiffs = new SpiffsGenerator()
    spiffs.addFile('srmodels.bin', srmodelsBuf)
    spiffs.addFile('manifest.json', ascii('{"version":1}'))
    spiffs.addFile('readme.txt', ascii('readme body'))

    const assetsBuf = await spiffs.generate()
    const view = new DataView(assetsBuf)
    const u8 = new Uint8Array(assetsBuf)

    expect(view.getUint32(0, true)).toBe(3)
    const combinedLen = view.getUint32(8, true)

    // Walk the three mmap entries and confirm the embedded payload bytes for
    // each file match what we pushed in (accounting for the 2-byte 0x5A5A prefix).
    const mmapStart = 12
    const entrySize = 32 + 4 + 4 + 2 + 2
    const dataStart = mmapStart + 3 * entrySize

    const decoder = new TextDecoder('ascii')
    const fileNames = []
    for (let i = 0; i < 3; i++) {
      const entryOffset = mmapStart + i * entrySize
      const name = decoder.decode(u8.slice(entryOffset, entryOffset + 32)).replace(/\0+$/, '')
      fileNames.push(name)
      const size = view.getUint32(entryOffset + 32, true)
      const offset = view.getUint32(entryOffset + 36, true)

      // Prefix marker sits before each payload in the merged data region.
      expect(u8[dataStart + offset]).toBe(0x5A)
      expect(u8[dataStart + offset + 1]).toBe(0x5A)

      if (name === 'srmodels.bin') {
        // The embedded wake-word binary should match byte-for-byte.
        expect(size).toBe(srmodelsBuf.byteLength)
        const embedded = u8.slice(dataStart + offset + 2, dataStart + offset + 2 + size)
        const original = new Uint8Array(srmodelsBuf)
        expect(embedded.length).toBe(original.length)
        for (let j = 0; j < embedded.length; j++) {
          expect(embedded[j]).toBe(original[j])
        }
      }
    }

    // Files are sorted by extension then stem; expected order:
    //   srmodels.bin (ext=bin), manifest.json (ext=json), readme.txt (ext=txt).
    expect(fileNames).toEqual(['srmodels.bin', 'manifest.json', 'readme.txt'])

    // Header checksum must match a fresh checksum computed over the combined region.
    const headerChecksum = view.getUint32(4, true)
    const recomputed = new SpiffsGenerator().computeChecksum(
      u8.slice(12, 12 + combinedLen)
    )
    expect(headerChecksum).toBe(recomputed)
  })
})
