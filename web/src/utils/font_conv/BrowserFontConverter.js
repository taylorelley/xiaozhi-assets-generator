/**
 * BrowserFontConverter - A complete browser-side font converter
 * Based on the core logic of lv_font_conv, adapted for the browser environment
 */

import opentype from 'opentype.js'
import collect_font_data from './CollectFontData.js'
import AppError from './AppError.js'
import write_cbin from './writers/CBinWriter.js'

class BrowserFontConverter {
  constructor() {
    this.initialized = false
    this.supportedFormats = ['ttf', 'woff', 'woff2', 'otf']
    this.charsetCache = new Map() // Cache for already-loaded charsets
  }

  /**
   * Initialize the converter
   */
  async initialize() {
    if (this.initialized) return

    try {
      // Verify that dependencies are available
      if (typeof opentype === 'undefined') {
        throw new Error('opentype.js not loaded')
      }

      this.initialized = true
      console.log('BrowserFontConverter initialization complete')
    } catch (error) {
      console.error('BrowserFontConverter initialization failed:', error)
      throw error
    }
  }

  /**
   * Validate a font file
   */
  validateFont(fontFile) {
    if (!fontFile) return false
    
    if (fontFile instanceof File) {
      const fileName = fontFile.name.toLowerCase()
      const fileType = fontFile.type.toLowerCase()
      
      const validExtension = this.supportedFormats.some(ext => 
        fileName.endsWith(`.${ext}`)
      )
      
      const validMimeType = [
        'font/ttf', 'font/truetype', 'application/x-font-ttf',
        'font/woff', 'font/woff2', 'application/font-woff',
        'font/otf', 'application/x-font-otf'
      ].some(type => fileType.includes(type))
      
      return validExtension || validMimeType
    }
    
    return fontFile instanceof ArrayBuffer && fontFile.byteLength > 0
  }

  /**
   * Get font information
   */
  async getFontInfo(fontFile) {
    try {
      let buffer
      
      if (fontFile instanceof File) {
        buffer = await fontFile.arrayBuffer()
      } else if (fontFile instanceof ArrayBuffer) {
        buffer = fontFile
      } else {
        throw new Error('Unsupported font file type')
      }
      
      const font = opentype.parse(buffer)
      
      return {
        familyName: this.getLocalizedName(font.names.fontFamily) || 'Unknown',
        fullName: this.getLocalizedName(font.names.fullName) || 'Unknown',
        postScriptName: this.getLocalizedName(font.names.postScriptName) || 'Unknown',
        version: this.getLocalizedName(font.names.version) || 'Unknown',
        unitsPerEm: font.unitsPerEm,
        ascender: font.ascender,
        descender: font.descender,
        numGlyphs: font.numGlyphs,
        supported: true
      }
    } catch (error) {
      console.error('Failed to get font information:', error)
      return {
        familyName: 'Unknown',
        supported: false,
        error: error.message
      }
    }
  }

  /**
   * Get a localized name
   */
  getLocalizedName(nameObj) {
    if (!nameObj) return null

    // Priority: Chinese > English > first available
    return nameObj['zh'] || nameObj['zh-CN'] || nameObj['en'] ||
           nameObj[Object.keys(nameObj)[0]]
  }

  /**
   * Convert the font to CBIN format
   */
  async convertToCBIN(options) {
    if (!this.initialized) {
      await this.initialize()
    }

    const {
      fontFile,
      fontName,
      fontSize = 20,
      bpp = 4,
      charset = 'deepseek',
      symbols = '',
      range = '',
      compression = false,
      lcd = false,
      lcd_v = false,
      progressCallback = null
    } = options

    if (!this.validateFont(fontFile)) {
      throw new AppError('Unsupported font file format')
    }

    try {
      if (progressCallback) progressCallback(0, 'Starting font processing...')

      // Prepare font data
      let fontBuffer
      if (fontFile instanceof File) {
        fontBuffer = await fontFile.arrayBuffer()
      } else {
        fontBuffer = fontFile
      }

      if (progressCallback) progressCallback(10, 'Parsing font structure...')

      // Build the character ranges and symbols (async version supports loading a charset from a file)
      const { ranges, charSymbols } = await this.parseCharacterInputAsync(charset, symbols, range)

      if (progressCallback) progressCallback(20, 'Preparing conversion parameters...')

      // Build the conversion parameters
      const convertArgs = {
        font: [{
          source_path: fontName || 'custom_font',
          source_bin: fontBuffer,
          ranges: [{ 
            range: ranges, 
            symbols: charSymbols 
          }],
          autohint_off: false,
          autohint_strong: false
        }],
        size: fontSize,
        bpp: bpp,
        lcd: lcd,
        lcd_v: lcd_v,
        no_compress: !compression,
        no_kerning: false,
        use_color_info: false,
        format: 'cbin',
        output: fontName || 'font'
      }

      if (progressCallback) progressCallback(30, 'Collecting font data...')

      // Collect font data
      const fontData = await collect_font_data(convertArgs)

      if (progressCallback) progressCallback(70, 'Generating CBIN format...')

      // Generate the CBIN data
      const result = write_cbin(convertArgs, fontData)
      const outputName = convertArgs.output
      
      if (progressCallback) progressCallback(100, 'Conversion completed!')

      return result[outputName]

    } catch (error) {
      console.error('Font conversion failed:', error)
      throw new AppError(`Font conversion failed: ${error.message}`)
    }
  }

  /**
   * Parse character input (charset, symbols, range) - async version
   */
  async parseCharacterInputAsync(charset, symbols, range) {
    let ranges = []
    let charSymbols = symbols || ''

    // Handle the full charset - uses the Unicode range 0x0-0xFFFF
    if (charset === 'full') {
      ranges = [0x0, 0xFFFF, 0x0]
      // The full charset does not need additional symbols
      return { ranges, charSymbols }
    }

    // Handle preset charsets
    if (charset && charset !== 'custom') {
      const presetChars = await this.getCharsetContentAsync(charset)
      charSymbols = presetChars + charSymbols
    }

    // Handle Unicode ranges
    if (range) {
      ranges = this.parseUnicodeRange(range)
    }

    return { ranges, charSymbols }
  }

  /**
   * Parse character input (charset, symbols, range) - sync version (backward compatible)
   */
  parseCharacterInput(charset, symbols, range) {
    let ranges = []
    let charSymbols = symbols || ''

    // Handle the full charset - uses the Unicode range 0x0-0xFFFF
    if (charset === 'full') {
      ranges = [0x0, 0xFFFF, 0x0]
      // The full charset does not need additional symbols
      return { ranges, charSymbols }
    }

    // Handle preset charsets
    if (charset && charset !== 'custom') {
      const presetChars = this.getCharsetContent(charset)
      charSymbols = presetChars + charSymbols
    }

    // Handle Unicode ranges
    if (range) {
      ranges = this.parseUnicodeRange(range)
    }

    return { ranges, charSymbols }
  }


  /**
   * Asynchronously load a charset file
   */
  async loadCharsetFromFile(charset) {
    const charsetFiles = {
      latin: './static/charsets/latin1.txt',
      deepseek: './static/charsets/deepseek.txt',
      gb2312: './static/charsets/gb2312.txt',
      qwen: './static/charsets/qwen18409.txt'
    }
    
    const filePath = charsetFiles[charset]
    if (!filePath) {
      return null
    }
    
    try {
      const response = await fetch(filePath)
      if (!response.ok) {
        throw new Error(`Failed to load charset file: ${response.status}`)
      }
      
      const text = await response.text()
      // Join each line's characters into a single string, preserving all characters (including whitespace)
      const characters = text.split('\n').join('')

      // Cache the result
      this.charsetCache.set(charset, characters)
      return characters
    } catch (error) {
      console.error(`Failed to load charset ${charset}:`, error)
      return null
    }
  }

  /**
   * Get charset content (sync method, used for already-cached charsets)
   */
  getCharsetContent(charset) {
    const charsets = {}

    // For charsets that need to be loaded from a file, check the cache first
    if ((charset === 'latin' || charset === 'deepseek' || charset === 'gb2312') && this.charsetCache.has(charset)) {
      return this.charsetCache.get(charset)
    }

    // If 'basic' is requested, redirect to 'latin' for backward compatibility
    if (charset === 'basic') {
      return this.getCharsetContent('latin')
    }

    // Default: return an empty string; caller needs to invoke the async method first
    return charsets[charset] || ''
  }

  /**
   * Asynchronously get charset content
   */
  async getCharsetContentAsync(charset) {
    // If 'basic' is requested, redirect to 'latin' for backward compatibility
    if (charset === 'basic') {
      charset = 'latin'
    }

    // Return immediately if the charset is already cached
    if (this.charsetCache.has(charset)) {
      return this.charsetCache.get(charset)
    }

    // For charsets that need to be loaded from a file
    if (charset === 'latin' || charset === 'deepseek' || charset === 'gb2312' || charset === 'qwen') {
      const loadedCharset = await this.loadCharsetFromFile(charset)
      if (loadedCharset) {
        return loadedCharset
      }
    }

    // Fall back to the sync method
    return this.getCharsetContent(charset)
  }

  /**
   * Parse a Unicode range string
   */
  parseUnicodeRange(rangeStr) {
    const ranges = []
    const parts = rangeStr.split(',')
    
    for (const part of parts) {
      const trimmed = part.trim()
      if (!trimmed) continue
      
      if (trimmed.includes('-')) {
        const [start, end] = trimmed.split('-')
        const startCode = this.parseHexOrDec(start)
        const endCode = this.parseHexOrDec(end)
        
        if (startCode !== null && endCode !== null) {
          ranges.push(startCode, endCode, startCode)
        }
      } else {
        const code = this.parseHexOrDec(trimmed)
        if (code !== null) {
          ranges.push(code, code, code)
        }
      }
    }
    
    return ranges
  }

  /**
   * Parse a hexadecimal or decimal number
   */
  parseHexOrDec(str) {
    const trimmed = str.trim()
    
    if (trimmed.startsWith('0x') || trimmed.startsWith('0X')) {
      const parsed = parseInt(trimmed, 16)
      return isNaN(parsed) ? null : parsed
    }
    
    const parsed = parseInt(trimmed, 10)
    return isNaN(parsed) ? null : parsed
  }

  /**
   * Estimate output size - async version
   */
  async estimateSizeAsync(options) {
    const { fontSize = 20, bpp = 4, charset = 'latin', symbols = '', range = '' } = options

    // Compute the character count
    let charCount = symbols.length

    // Handle the full charset - includes 0x0-0xFFFF (65536 characters)
    if (charset === 'full') {
      charCount = 65536
    } else if (charset && charset !== 'custom') {
      const charsetContent = await this.getCharsetContentAsync(charset)
      charCount += charsetContent.length
    }

    if (range) {
      const ranges = this.parseUnicodeRange(range)
      for (let i = 0; i < ranges.length; i += 3) {
        charCount += ranges[i + 1] - ranges[i] + 1
      }
    }

    // Rough deduplication estimate; the full charset is not deduplicated
    if (charset !== 'full') {
      charCount = Math.min(charCount, charCount * 0.8)
    }

    // Estimate the average number of bytes per character
    const avgBytesPerChar = Math.ceil((fontSize * fontSize * bpp) / 8) + 40

    const estimatedSize = charCount * avgBytesPerChar + 2048 // Add header and index

    return {
      characterCount: Math.floor(charCount),
      avgBytesPerChar,
      estimatedSize,
      formattedSize: this.formatBytes(estimatedSize)
    }
  }

  /**
   * Estimate output size - sync version (backward compatible)
   */
  estimateSize(options) {
    const { fontSize = 20, bpp = 4, charset = 'latin', symbols = '', range = '' } = options

    // Compute the character count
    let charCount = symbols.length

    // Handle the full charset - includes 0x0-0xFFFF (65536 characters)
    if (charset === 'full') {
      charCount = 65536
    } else if (charset && charset !== 'custom') {
      const charsetContent = this.getCharsetContent(charset)
      charCount += charsetContent.length
    }

    if (range) {
      const ranges = this.parseUnicodeRange(range)
      for (let i = 0; i < ranges.length; i += 3) {
        charCount += ranges[i + 1] - ranges[i] + 1
      }
    }

    // Rough deduplication estimate; the full charset is not deduplicated
    if (charset !== 'full') {
      charCount = Math.min(charCount, charCount * 0.8)
    }

    // Estimate the average number of bytes per character
    const avgBytesPerChar = Math.ceil((fontSize * fontSize * bpp) / 8) + 40

    const estimatedSize = charCount * avgBytesPerChar + 2048 // Add header and index

    return {
      characterCount: Math.floor(charCount),
      avgBytesPerChar,
      estimatedSize,
      formattedSize: this.formatBytes(estimatedSize)
    }
  }

  /**
   * Format a byte size
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Clean up resources
   */
  cleanup() {
    // Clean up any lingering resource references
    this.initialized = false
  }
}

// Create a singleton instance
const browserFontConverter = new BrowserFontConverter()

export default browserFontConverter
export { BrowserFontConverter }
