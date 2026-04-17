/**
 * WakenetModelPacker class
 * Mirrors pack_model.py so that wake-word models can be packaged in the browser.
 *
 * Note: compatibility issues with the Python version have been resolved:
 * - Uses ASCII encoding rather than UTF-8
 * - Ensures consistent little-endian integer format
 * - Removes redundant string-replacement operations
 *
 * Packaging format:
 * {
 *     model_num: int (4 bytes)
 *     model1_info: model_info_t
 *     model2_info: model_info_t
 *     ...
 *     model1 data
 *     model2 data
 *     ...
 * }
 *
 * model_info_t format:
 * {
 *     model_name: char[32] (32 bytes)
 *     file_number: int (4 bytes)
 *     file1_name: char[32] (32 bytes)
 *     file1_start: int (4 bytes)
 *     file1_len: int (4 bytes)
 *     file2_name: char[32] (32 bytes)
 *     file2_start: int (4 bytes)
 *     file2_len: int (4 bytes)
 *     ...
 * }
 */

class WakenetModelPacker {
  constructor() {
    this.models = new Map()
  }

  /**
   * Add a model file
   * @param {string} modelName - Model name
   * @param {string} fileName - Filename
   * @param {ArrayBuffer} fileData - File data
   */
  addModelFile(modelName, fileName, fileData) {
    if (!this.models.has(modelName)) {
      this.models.set(modelName, new Map())
    }
    this.models.get(modelName).set(fileName, fileData)
  }

  /**
   * Load a model from the share/wakenet_model or multinet_model directory
   * @param {string} modelName - Model name (for example: wn9s_nihaoxiaozhi or mn6_cn)
   * @returns {Promise<boolean>} Whether loading succeeded
   */
  async loadModelFromShare(modelName) {
    try {
      let modelFiles = []
      let baseUrl = ''

      if (modelName.startsWith('wn9')) {
        // wakenet model
        modelFiles = ['_MODEL_INFO_', 'wn9_data', 'wn9_index']
        baseUrl = `./static/wakenet_model/${modelName}/`
      } else if (modelName.startsWith('mn6') || modelName.startsWith('mn7')) {
        // multinet model
        modelFiles = ['_MODEL_INFO_', `${modelName.substring(0, 3)}_data`, `${modelName.substring(0, 3)}_index`, 'vocab']
        baseUrl = `./static/multinet_model/${modelName}/`

        // Also load the FST model files (required for Multinet 6/7)
        await this.loadFSTModel()
      } else {
        throw new Error(`Unknown model type: ${modelName}`)
      }

      let loadedFiles = 0
      for (const fileName of modelFiles) {
        try {
          const response = await fetch(`${baseUrl}${fileName}`)
          if (response.ok) {
            const fileData = await response.arrayBuffer()
            this.addModelFile(modelName, fileName, fileData)
            loadedFiles++
          } else {
            console.warn(`Unable to load file: ${fileName}, status: ${response.status}`)
          }
        } catch (error) {
          console.warn(`Failed to load file: ${fileName}`, error)
        }
      }

      return loadedFiles === modelFiles.length
    } catch (error) {
      console.error(`Failed to load model: ${modelName}`, error)
      return false
    }
  }

  /**
   * Load the FST model files (required for Multinet 6/7)
   * @returns {Promise<boolean>} Whether loading succeeded
   */
  async loadFSTModel() {
    try {
      const modelName = 'fst'

      // Short-circuit if already loaded
      if (this.models.has(modelName)) {
        return true
      }

      const modelFiles = ['commands_cn.txt', 'commands_en.txt']
      const baseUrl = `./static/multinet_model/fst/`

      let loadedFiles = 0
      for (const fileName of modelFiles) {
        try {
          const response = await fetch(`${baseUrl}${fileName}`)
          if (response.ok) {
            const fileData = await response.arrayBuffer()
            this.addModelFile(modelName, fileName, fileData)
            loadedFiles++
          } else {
            console.warn(`Unable to load FST file: ${fileName}, status: ${response.status}`)
          }
        } catch (error) {
          console.warn(`Failed to load FST file: ${fileName}`, error)
        }
      }

      return loadedFiles > 0
    } catch (error) {
      console.error('Failed to load FST model', error)
      return false
    }
  }

  /**
   * Pack a string into a fixed-length byte array.
   * Mirrors the Python version's struct_pack_string behavior using ASCII encoding.
   * @param {string} string - Input string
   * @param {number} maxLen - Maximum length
   * @returns {Uint8Array} Packed binary data
   */
  packString(string, maxLen) {
    const bytes = new Uint8Array(maxLen)

    // Use ASCII encoding, matching the Python version.
    // Do not reserve a null terminator; use the full maxLen bytes.
    const copyLen = Math.min(string.length, maxLen)

    for (let i = 0; i < copyLen; i++) {
      // Use charCodeAt to get the ASCII code; mask to 8 bits for compatibility
      bytes[i] = string.charCodeAt(i) & 0xFF
    }

    // Remaining bytes stay 0 (default initialization)
    return bytes
  }

  /**
   * Convert a 32-bit integer to a little-endian byte array.
   * Matches the Python version's struct.pack('<I', value).
   * @param {number} value - Integer value
   * @returns {Uint8Array} 4-byte little-endian array
   */
  packUint32(value) {
    const bytes = new Uint8Array(4)
    bytes[0] = value & 0xFF          // Least significant byte (LSB)
    bytes[1] = (value >> 8) & 0xFF   //
    bytes[2] = (value >> 16) & 0xFF  //
    bytes[3] = (value >> 24) & 0xFF  // Most significant byte (MSB)
    return bytes
  }

  /**
   * Pack all models into the srmodels.bin format
   * @returns {ArrayBuffer} Packed binary data
   */
  packModels() {
    if (this.models.size === 0) {
      throw new Error('No model data to pack')
    }

    // Compute the total number of files and gather their data
    let totalFileNum = 0
    const modelDataList = []

    // Iterate in model-name order
    for (const [modelName, files] of Array.from(this.models.entries()).sort((a, b) => a[0].localeCompare(b[0]))) {
      totalFileNum += files.size
      // Sort files by name to match the Python version's ordering
      const sortedFiles = Array.from(files.entries()).sort((a, b) => a[0].localeCompare(b[0]))
      modelDataList.push({
        name: modelName,
        files: sortedFiles
      })
    }

    // Compute header length: model count (4) + each model info (32+4 + num_files*(32+4+4))
    const modelNum = this.models.size
    let headerLen = 4 // model_num

    for (const model of modelDataList) {
      headerLen += 32 + 4 // model_name + file_number
      headerLen += model.files.length * (32 + 4 + 4) // per-file name + start + len
    }

    // Allocate the output buffer
    const totalSize = headerLen + Array.from(this.models.values())
      .reduce((total, files) => total + Array.from(files.values())
        .reduce((fileTotal, fileData) => fileTotal + fileData.byteLength, 0), 0)

    const output = new Uint8Array(totalSize)
    let offset = 0

    // Write the model count
    output.set(this.packUint32(modelNum), offset)
    offset += 4

    // Write model info headers
    let dataOffset = headerLen

    for (const model of modelDataList) {
      // Write the model name
      output.set(this.packString(model.name, 32), offset)
      offset += 32

      // Write the file count
      output.set(this.packUint32(model.files.length), offset)
      offset += 4

      // Write info for each file
      for (const [fileName, fileData] of model.files) {
        // Filename
        output.set(this.packString(fileName, 32), offset)
        offset += 32

        // File start position
        output.set(this.packUint32(dataOffset), offset)
        offset += 4

        // File length
        output.set(this.packUint32(fileData.byteLength), offset)
        offset += 4

        dataOffset += fileData.byteLength
      }
    }

    // Write file payloads
    for (const model of modelDataList) {
      for (const [fileName, fileData] of model.files) {
        output.set(new Uint8Array(fileData), offset)
        offset += fileData.byteLength
      }
    }

    return output.buffer
  }

  /**
   * Validate whether a model name is valid
   * @param {string} modelName - Model name
   * @param {string} chipModel - Chip model
   * @returns {boolean} Whether the model is valid
   */
  static isValidModel(modelName, chipModel) {
    const isC3OrC6 = chipModel === 'esp32c3' || chipModel === 'esp32c6'
    
    if (isC3OrC6) {
      return modelName.startsWith('wn9s_')
    } else {
      return modelName.startsWith('wn9_')
    }
  }

  /**
   * Clear the loaded model data
   */
  clear() {
    this.models.clear()
  }

  /**
   * Get statistics for the loaded models
   * @returns {Object} Statistics
   */
  getStats() {
    let totalFiles = 0
    let totalSize = 0
    
    for (const files of this.models.values()) {
      totalFiles += files.size
      for (const fileData of files.values()) {
        totalSize += fileData.byteLength
      }
    }

    return {
      modelCount: this.models.size,
      fileCount: totalFiles,
      totalSize,
      models: Array.from(this.models.keys())
    }
  }

  /**
   * Validate packing-format compatibility.
   * Used to check consistency with the Python version.
   * @returns {Object} Validation result
   */
  validatePackingCompatibility() {
    // Test string packing
    const testString = "test_model"
    const packedString = this.packString(testString, 32)

    // Test integer packing
    const testInt = 0x12345678
    const packedInt = this.packUint32(testInt)
    
    return {
      stringPacking: {
        input: testString,
        output: Array.from(packedString).map(b => `0x${b.toString(16).padStart(2, '0')}`),
        isASCII: packedString.every((b, i) => i >= testString.length || b === testString.charCodeAt(i))
      },
      intPacking: {
        input: `0x${testInt.toString(16)}`,
        output: Array.from(packedInt).map(b => `0x${b.toString(16).padStart(2, '0')}`),
        isLittleEndian: packedInt[0] === 0x78 && packedInt[3] === 0x12
      }
    }
  }
}

export default WakenetModelPacker
