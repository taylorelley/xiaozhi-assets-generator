/**
 * SpiffsGenerator class
 * Mirrors the behavior of spiffs_assets_gen.py and generates assets.bin in the browser.
 *
 * File format:
 * {
 *     total_files: int (4 bytes)          // Total number of files
 *     checksum: int (4 bytes)             // Checksum
 *     combined_data_length: int (4 bytes) // Total data length
 *     mmap_table: [                       // File mapping table
 *         {
 *             name: char[32]              // Filename (32 bytes)
 *             size: int (4 bytes)         // File size
 *             offset: int (4 bytes)       // File offset
 *             width: short (2 bytes)      // Image width
 *             height: short (2 bytes)     // Image height
 *         }
 *         ...
 *     ]
 *     file_data: [                        // File payloads
 *         0x5A 0x5A + file1_data          // Each file is prefixed with the 0x5A5A marker
 *         0x5A 0x5A + file2_data
 *         ...
 *     ]
 * }
 */

class SpiffsGenerator {
  constructor() {
    this.files = []
    this.textEncoder = new TextEncoder()
  }

  /**
   * Add a file
   * @param {string} filename - Filename
   * @param {ArrayBuffer} data - File data
   * @param {Object} options - Optional parameters {width?, height?}
   */
  addFile(filename, data, options = {}) {
    if (filename.length > 32) {
      console.warn(`Filename "${filename}" exceeds 32 bytes and will be truncated`)
    }

    this.files.push({
      filename,
      data,
      size: data.byteLength,
      width: options.width || 0,
      height: options.height || 0
    })
  }

  /**
   * Retrieve dimensions from an image file
   * @param {ArrayBuffer} imageData - Image data
   * @returns {Promise<Object>} {width, height}
   */
  async getImageDimensions(imageData) {
    return new Promise((resolve) => {
      try {
        const blob = new Blob([imageData])
        const url = URL.createObjectURL(blob)
        const img = new Image()
        
        img.onload = () => {
          URL.revokeObjectURL(url)
          resolve({ width: img.width, height: img.height })
        }
        
        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve({ width: 0, height: 0 })
        }
        
        img.src = url
      } catch (error) {
        resolve({ width: 0, height: 0 })
      }
    })
  }

  /**
   * Check whether this is a special image format (.sjpg, .spng, .sqoi)
   * @param {string} filename - Filename
   * @param {ArrayBuffer} data - File data
   * @returns {Object} {width, height}
   */
  parseSpecialImageFormat(filename, data) {
    const ext = filename.toLowerCase().split('.').pop()

    if (['.sjpg', '.spng', '.sqoi'].includes('.' + ext)) {
      try {
        // Special format header: at offset 14 the width and height follow (2 bytes each, little-endian)
        const view = new DataView(data)
        const width = view.getUint16(14, true)  // little-endian
        const height = view.getUint16(16, true) // little-endian
        return { width, height }
      } catch (error) {
        console.warn(`Failed to parse special image format: ${filename}`, error)
      }
    }

    return { width: 0, height: 0 }
  }

  /**
   * Convert a 32-bit integer to a little-endian byte array
   * @param {number} value - Integer value
   * @returns {Uint8Array} 4-byte little-endian array
   */
  packUint32(value) {
    const bytes = new Uint8Array(4)
    bytes[0] = value & 0xFF
    bytes[1] = (value >> 8) & 0xFF
    bytes[2] = (value >> 16) & 0xFF
    bytes[3] = (value >> 24) & 0xFF
    return bytes
  }

  /**
   * Convert a 16-bit integer to a little-endian byte array
   * @param {number} value - Integer value
   * @returns {Uint8Array} 2-byte little-endian array
   */
  packUint16(value) {
    const bytes = new Uint8Array(2)
    bytes[0] = value & 0xFF
    bytes[1] = (value >> 8) & 0xFF
    return bytes
  }

  /**
   * Pack a string into a fixed-length byte array
   * @param {string} string - Input string
   * @param {number} maxLen - Maximum length
   * @returns {Uint8Array} Packed binary data
   */
  packString(string, maxLen) {
    const bytes = new Uint8Array(maxLen)
    const encoded = this.textEncoder.encode(string)

    // Copy the string data, making sure the maximum length is not exceeded
    const copyLen = Math.min(encoded.length, maxLen)
    bytes.set(encoded.slice(0, copyLen), 0)

    // Remaining bytes stay zero-filled
    return bytes
  }

  /**
   * Compute the checksum
   * @param {Uint8Array} data - Data
   * @returns {number} 16-bit checksum
   */
  computeChecksum(data) {
    let checksum = 0
    for (let i = 0; i < data.length; i++) {
      checksum += data[i]
    }
    return checksum & 0xFFFF
  }

  /**
   * Sort the list of files
   * @param {Array} files - File list
   * @returns {Array} Sorted file list
   */
  sortFiles(files) {
    return files.slice().sort((a, b) => {
      const extA = a.filename.split('.').pop() || ''
      const extB = b.filename.split('.').pop() || ''
      
      if (extA !== extB) {
        return extA.localeCompare(extB)
      }
      
      const nameA = a.filename.replace(/\.[^/.]+$/, '')
      const nameB = b.filename.replace(/\.[^/.]+$/, '')
      return nameA.localeCompare(nameB)
    })
  }

  /**
   * Generate the assets.bin file
   * @param {Function} progressCallback - Progress callback function
   * @returns {Promise<ArrayBuffer>} The generated assets.bin data
   */
  async generate(progressCallback = null) {
    if (this.files.length === 0) {
      throw new Error('No files to package')
    }

    if (progressCallback) progressCallback(0, 'Starting to package files...')

    // Sort the files
    const sortedFiles = this.sortFiles(this.files)
    const totalFiles = sortedFiles.length

    // Process file info and collect image dimensions
    const fileInfoList = []
    let mergedDataSize = 0

    for (let i = 0; i < sortedFiles.length; i++) {
      const file = sortedFiles[i]
      let width = file.width
      let height = file.height

      if (progressCallback) {
        progressCallback(10 + (i / totalFiles) * 30, `Processing file: ${file.filename}`)
      }

      // If no dimensions were provided, try to detect them automatically
      if (width === 0 && height === 0) {
        // First check for special image formats
        const specialDimensions = this.parseSpecialImageFormat(file.filename, file.data)
        if (specialDimensions.width > 0 || specialDimensions.height > 0) {
          width = specialDimensions.width
          height = specialDimensions.height
        } else {
          // Try parsing as a regular image
          const ext = file.filename.toLowerCase().split('.').pop()
          if (['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'].includes(ext)) {
            const dimensions = await this.getImageDimensions(file.data)
            width = dimensions.width
            height = dimensions.height
          }
        }
      }

      fileInfoList.push({
        filename: file.filename,
        data: file.data,
        size: file.size,
        offset: mergedDataSize,
        width,
        height
      })

      mergedDataSize += 2 + file.size // 2-byte prefix + file data
    }

    if (progressCallback) progressCallback(40, 'Building file mapping table...')

    // Build the mapping table
    const mmapTableSize = totalFiles * (32 + 4 + 4 + 2 + 2) // name + size + offset + width + height
    const mmapTable = new Uint8Array(mmapTableSize)
    let mmapOffset = 0

    for (const fileInfo of fileInfoList) {
      // Filename (32 bytes)
      mmapTable.set(this.packString(fileInfo.filename, 32), mmapOffset)
      mmapOffset += 32

      // File size (4 bytes)
      mmapTable.set(this.packUint32(fileInfo.size), mmapOffset)
      mmapOffset += 4

      // File offset (4 bytes)
      mmapTable.set(this.packUint32(fileInfo.offset), mmapOffset)
      mmapOffset += 4

      // Image width (2 bytes)
      mmapTable.set(this.packUint16(fileInfo.width), mmapOffset)
      mmapOffset += 2

      // Image height (2 bytes)
      mmapTable.set(this.packUint16(fileInfo.height), mmapOffset)
      mmapOffset += 2
    }

    if (progressCallback) progressCallback(60, 'Merging file data...')

    // Merge file data
    const mergedData = new Uint8Array(mergedDataSize)
    let mergedOffset = 0

    for (let i = 0; i < fileInfoList.length; i++) {
      const fileInfo = fileInfoList[i]
      
      if (progressCallback) {
        progressCallback(60 + (i / totalFiles) * 20, `Merging file: ${fileInfo.filename}`)
      }

      // Add the 0x5A5A prefix
      mergedData[mergedOffset] = 0x5A
      mergedData[mergedOffset + 1] = 0x5A
      mergedOffset += 2

      // Append the file data
      mergedData.set(new Uint8Array(fileInfo.data), mergedOffset)
      mergedOffset += fileInfo.size
    }

    if (progressCallback) progressCallback(80, 'Computing checksum...')

    // Compute the checksum of the combined data
    const combinedData = new Uint8Array(mmapTableSize + mergedDataSize)
    combinedData.set(mmapTable, 0)
    combinedData.set(mergedData, mmapTableSize)

    const checksum = this.computeChecksum(combinedData)
    const combinedDataLength = combinedData.length

    if (progressCallback) progressCallback(90, 'Building final file...')

    // Build the final output
    const headerSize = 4 + 4 + 4 // total_files + checksum + combined_data_length
    const totalSize = headerSize + combinedDataLength
    const finalData = new Uint8Array(totalSize)

    let offset = 0

    // Write the total file count
    finalData.set(this.packUint32(totalFiles), offset)
    offset += 4

    // Write the checksum
    finalData.set(this.packUint32(checksum), offset)
    offset += 4

    // Write the combined data length
    finalData.set(this.packUint32(combinedDataLength), offset)
    offset += 4

    // Write the combined data
    finalData.set(combinedData, offset)

    if (progressCallback) progressCallback(100, 'Packaging completed')

    return finalData.buffer
  }

  /**
   * Get file statistics
   * @returns {Object} Statistics
   */
  getStats() {
    let totalSize = 0
    const fileTypes = new Map()

    for (const file of this.files) {
      totalSize += file.size
      
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'unknown'
      fileTypes.set(ext, (fileTypes.get(ext) || 0) + 1)
    }

    return {
      fileCount: this.files.length,
      totalSize,
      fileTypes: Object.fromEntries(fileTypes),
      averageFileSize: this.files.length > 0 ? Math.round(totalSize / this.files.length) : 0
    }
  }

  /**
   * Print the list of packaged files
   */
  printFileList() {
    console.log('=== Packaged File List ===')
    console.log(`Total files: ${this.files.length}`)

    if (this.files.length === 0) {
      console.log('No files available')
      return
    }

    // Sort by extension and filename before printing
    const sortedFiles = this.sortFiles(this.files)

    sortedFiles.forEach((file, index) => {
      const ext = file.filename.split('.').pop()?.toLowerCase() || 'unknown'
      const sizeKB = (file.size / 1024).toFixed(2)
      const dimensions = (file.width && file.height) ? `${file.width}x${file.height}` : 'N/A'

      console.log(`${String(index + 1).padStart(3, ' ')}. ${file.filename}`)
      console.log(`    Type: ${ext.toUpperCase()}`)
      console.log(`    Size: ${sizeKB} KB (${file.size} bytes)`)
      console.log(`    Dimensions: ${dimensions}`)
      console.log('')
    })

    // Print statistics
    const stats = this.getStats()
    console.log('=== File Statistics ===')
    console.log(`Total size: ${(stats.totalSize / 1024).toFixed(2)} KB`)
    console.log(`Average size: ${(stats.averageFileSize / 1024).toFixed(2)} KB`)
    console.log('File type distribution:')
    Object.entries(stats.fileTypes).forEach(([ext, count]) => {
      console.log(`  ${ext.toUpperCase()}: ${count} files`)
    })
  }

  /**
   * Clear the file list
   */
  clear() {
    this.files = []
  }
}

export default SpiffsGenerator
