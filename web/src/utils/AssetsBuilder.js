/**
 * AssetsBuilder class
 * Handles assets.bin packaging for LittleWise AI custom themes.
 *
 * Main features:
 * - Configuration validation and processing
 * - Generation of index.json contents
 * - Resource-file management
 * - Interaction with the backend API to produce assets.bin
 * - Integration with browser-side font conversion
 */

import browserFontConverter from './font_conv/BrowserFontConverter.js'
import WakenetModelPacker from './WakenetModelPacker.js'
import SpiffsGenerator from './SpiffsGenerator.js'
import WasmGifScaler from './WasmGifScaler.js'
import configStorage from './ConfigStorage.js'

class AssetsBuilder {
  constructor() {
    this.config = null
    this.resources = new Map() // Resource files
    this.tempFiles = [] // List of temporary files
    this.fontConverterBrowser = browserFontConverter // Browser-side font converter
    this.convertedFonts = new Map() // Cache of converted fonts
    this.wakenetPacker = new WakenetModelPacker() // Wake-word model packer
    this.spiffsGenerator = new SpiffsGenerator() // SPIFFS generator
    this.gifScaler = new WasmGifScaler({
      quality: 30,
      debug: true,
      scalingMode: 'auto',  // Automatically pick the best scaling mode
      optimize: true,       // Enable GIF optimization
      optimizationLevel: 2  // Optimization level (1-3)
    }) // WASM GIF scaler
    this.configStorage = configStorage // Configuration storage manager
    this.autoSaveEnabled = true // Whether automatic saving is enabled
  }

  /**
   * Set the configuration object
   * @param {Object} config - Full configuration object
   */
  setConfig(config, options = {}) {
    const strict = options?.strict ?? true
    if (strict && !this.validateConfig(config)) {
      throw new Error('Configuration object validation failed')
    }
    this.config = { ...config }
    return this
  }

  /**
   * Validate the configuration object
   * @param {Object} config - Configuration object to validate
   * @returns {boolean} Validation result
   */
  validateConfig(config) {
    if (!config) return false

    // Validate chip configuration
    if (!config.chip?.model) {
      console.error('Missing chip model configuration')
      return false
    }

    // Validate display configuration
    const display = config.chip.display
    if (!display?.width || !display?.height) {
      console.error('Missing display resolution configuration')
      return false
    }

    // Validate font configuration
    const font = config.theme?.font
    if (font?.type === 'preset' && !font.preset) {
      console.error('Preset font configuration is incomplete')
      return false
    }
    if (font?.type === 'custom' && !font.custom?.file) {
      console.error('Custom font file not provided')
      return false
    }

    return true
  }

  /**
   * Add a resource file
   * @param {string} key - Resource key
   * @param {File|Blob} file - File object
   * @param {string} filename - Filename
   * @param {string} resourceType - Resource type (font, emoji, background)
   */
  addResource(key, file, filename, resourceType = 'other') {
    this.resources.set(key, {
      file,
      filename,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified || Date.now(),
      resourceType
    })

    // Automatically save the file to storage
    if (this.autoSaveEnabled && file instanceof File) {
      this.saveFileToStorage(key, file, resourceType).catch(error => {
        console.warn(`Auto-saving file ${filename} failed:`, error)
      })
    }

    return this
  }

  /**
   * Save a file to storage
   * @param {string} key - Resource key
   * @param {File} file - File object
   * @param {string} resourceType - Resource type
   * @returns {Promise<void>}
   */
  async saveFileToStorage(key, file, resourceType) {
    try {
      await this.configStorage.saveFile(key, file, resourceType)
      console.log(`File ${file.name} auto-saved to storage`)
    } catch (error) {
      console.error(`Failed to save file to storage: ${file.name}`, error)
      throw error
    }
  }

  /**
   * Restore a resource file from storage
   * @param {string} key - Resource key
   * @returns {Promise<boolean>} Whether the restore succeeded
   */
  async restoreResourceFromStorage(key) {
    try {
      const file = await this.configStorage.loadFile(key)
      if (file) {
        this.resources.set(key, {
          file,
          filename: file.name,
          size: file.size,
          type: file.type,
          lastModified: file.lastModified,
          resourceType: file.storedType,
          fromStorage: true
        })
        console.log(`Resource ${key} restored from storage successfully: ${file.name}`)
        return true
      }
      return false
    } catch (error) {
      console.error(`Failed to restore resource from storage: ${key}`, error)
      return false
    }
  }

  /**
   * Restore all related resource files
   * @param {Object} config - Configuration object
   * @returns {Promise<void>}
   */
  async restoreAllResourcesFromStorage(config) {
    if (!config) return

    const restoredFiles = []

    // Restore the custom font file (attempt this regardless of the current font type)
    if (config.theme?.font?.custom && config.theme.font.custom?.file === null) {
      const fontKey = 'custom_font'
      if (await this.restoreResourceFromStorage(fontKey)) {
        const resource = this.resources.get(fontKey)
        if (resource) {
          config.theme.font.custom.file = resource.file
          restoredFiles.push(`Custom font: ${resource.filename}`)
          console.log(`Custom font restored even when type is '${config.theme.font.type}'`)
        }
      }
    }

    // Restore custom emoji images (supports the new hash-deduplication structure)
    if (config.theme?.emoji?.type === 'custom' && config.theme.emoji.custom) {
      const emojiCustom = config.theme.emoji.custom
      const emotionMap = emojiCustom.emotionMap || {}
      const fileMap = emojiCustom.fileMap || {}
      const images = emojiCustom.images || {}

      // If the new structure (emotionMap and fileMap) is present, use it
      if (Object.keys(emotionMap).length > 0 || Object.keys(fileMap).length > 0) {
        // Collect every hash that needs to be restored
        const hashesToRestore = new Set()

        // Gather all hashes from fileMap
        for (const hash of Object.keys(fileMap)) {
          if (fileMap[hash] === null) {
            hashesToRestore.add(hash)
          }
        }

        // Restore each unique file (by hash)
        for (const hash of hashesToRestore) {
          let fileKey = `hash_${hash}`
          let restored = await this.restoreResourceFromStorage(fileKey)

          // If restoring the new format fails, fall back to the legacy format (compatibility)
          if (!restored) {
            const oldKey = `emoji_hash_${hash}`
            restored = await this.restoreResourceFromStorage(oldKey)
            if (restored) {
              fileKey = oldKey
            }
          }

          if (restored) {
            const resource = this.resources.get(fileKey)
            if (resource) {
              // Update fileMap
              fileMap[hash] = resource.file

              // Find every emotion that uses this hash
              const emotionsUsingHash = Object.entries(emotionMap)
                .filter(([_, h]) => h === hash)
                .map(([emotion, _]) => emotion)

              // Update images for every emotion that uses this file
              emotionsUsingHash.forEach(emotion => {
                images[emotion] = resource.file
              })

              restoredFiles.push(`Emoji file ${hash.substring(0, 8)}... (used for: ${emotionsUsingHash.join(', ')})`)
            }
          }
        }

        // Mutate the original object directly (preserving reactivity)
        // Update fileMap one entry at a time
        Object.keys(fileMap).forEach(hash => {
          config.theme.emoji.custom.fileMap[hash] = fileMap[hash]
        })

        // Update images one entry at a time
        Object.keys(images).forEach(emotion => {
          config.theme.emoji.custom.images[emotion] = images[emotion]
        })
      } else {
        // Legacy structure fallback: restore emoji files one by one
        for (const [emojiName, file] of Object.entries(images)) {
          if (file === null) {
            const emojiKey = `emoji_${emojiName}`
            if (await this.restoreResourceFromStorage(emojiKey)) {
              const resource = this.resources.get(emojiKey)
              if (resource) {
                images[emojiName] = resource.file
                restoredFiles.push(`Emoji ${emojiName}: ${resource.filename}`)
              }
            }
          }
        }
        config.theme.emoji.custom.images = images
      }
    }

    // Restore background images
    if (config.theme?.skin?.light?.backgroundType === 'image' && config.theme.skin.light.backgroundImage === null) {
      const bgKey = 'background_light'
      if (await this.restoreResourceFromStorage(bgKey)) {
        const resource = this.resources.get(bgKey)
        if (resource) {
          config.theme.skin.light.backgroundImage = resource.file
          restoredFiles.push(`Light background: ${resource.filename}`)
        }
      }
    }
    
    if (config.theme?.skin?.dark?.backgroundType === 'image' && config.theme.skin.dark.backgroundImage === null) {
      const bgKey = 'background_dark'
      if (await this.restoreResourceFromStorage(bgKey)) {
        const resource = this.resources.get(bgKey)
        if (resource) {
          config.theme.skin.dark.backgroundImage = resource.file
          restoredFiles.push(`Dark background: ${resource.filename}`)
        }
      }
    }

    // Restore converted font data
    try {
      const fontInfo = this.getFontInfo()
      if (fontInfo && fontInfo.type === 'custom') {
        const tempKey = `converted_font_${fontInfo.filename}`
        const tempData = await this.configStorage.loadTempData(tempKey)
        if (tempData) {
          this.convertedFonts.set(fontInfo.filename, tempData.data)
          console.log(`Converted font data restored: ${fontInfo.filename}`)
        }
      }
    } catch (error) {
      console.warn('Error restoring converted font data:', error)
    }

    if (restoredFiles.length > 0) {
      console.log('Files restored from storage:', restoredFiles)
    }
  }

  /**
   * Get wake-word model information
   * @returns {Object|null} Wake-word model info
   */
  getWakewordModelInfo() {
    if (!this.config || !this.config.chip || !this.config.theme) {
      return null
    }

    const chipModel = this.config.chip.model
    const wakeword = this.config.theme.wakeword

    if (!wakeword || wakeword.type === 'none') return null

    if (wakeword.type === 'preset') {
      // Pick the wake-word model type based on the chip
      const isC3OrC6 = chipModel === 'esp32c3' || chipModel === 'esp32c6'
      const modelType = isC3OrC6 ? 'WakeNet9s' : 'WakeNet9'
      
      return {
        type: modelType,
        name: wakeword.preset,
        filename: 'srmodels.bin'
      }
    } else if (wakeword.type === 'custom') {
      return {
        type: 'MultiNet',
        name: wakeword.custom.model,
        filename: 'srmodels.bin',
        custom: wakeword.custom
      }
    }
    
    return null
  }

  /**
   * Get font information
   * @returns {Object|null} Font info
   */
  getFontInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.font) {
      return null
    }
    
    const font = this.config.theme.font
    
    if (font.type === 'preset') {
      return {
        type: 'preset',
        filename: `${font.preset}.bin`,
        source: font.preset
      }
    }
    
    if (font.type === 'custom' && font.custom.file) {
      const custom = font.custom
      const filename = `font_custom_${custom.size}_${custom.bpp}.bin`
      
      return {
        type: 'custom',
        filename,
        source: font.custom.file,
        config: {
          size: custom.size,
          bpp: custom.bpp,
          charset: custom.charset
        }
      }
    }
    
    return null
  }

  /**
   * Get emoji collection information
   * @returns {Array} Array of emoji collection entries
   */
  getEmojiCollectionInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.emoji) {
      return []
    }

    const emoji = this.config.theme.emoji
    const collection = []

    if (emoji.type === 'preset') {
      // Preset emoji pack
      const presetEmojis = [
        'neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying',
        'loving', 'embarrassed', 'surprised', 'shocked', 'thinking', 'winking',
        'cool', 'relaxed', 'delicious', 'kissy', 'confident', 'sleepy', 'silly', 'confused'
      ]
      
      // Preset emoji pack configurations
      const presetConfigs = {
        'twemoji32': { size: 32, format: 'png' },
        'twemoji64': { size: 64, format: 'png' },
        'noto-emoji_64': { size: 64, format: 'gif' },
        'noto-emoji_128': { size: 128, format: 'gif' }
      }
      
      const config = presetConfigs[emoji.preset] || { size: 64, format: 'png' }
      presetEmojis.forEach(name => {
        collection.push({
          name,
          file: `${name}.${config.format}`,
          source: `preset:${emoji.preset}`,
          size: { width: config.size, height: config.size }
        })
      })
    } else if (emoji.type === 'custom') {
      // Custom emoji pack (supports file deduplication)
      const images = emoji.custom.images || {}
      const emotionMap = emoji.custom.emotionMap || {}
      const fileMap = emoji.custom.fileMap || {}
      const size = emoji.custom.size || { width: 64, height: 64 }

      // The new hash-based mapping structure is required
      if (Object.keys(emotionMap).length === 0 || Object.keys(fileMap).length === 0) {
        console.error('Error: Detected old version of emoji data structure')
        console.error('Please clear browser cache or reset configuration, then re-upload emoji images')
        throw new Error('Incompatible emoji data structure: Missing fileMap or emotionMap. Please reconfigure emojis.')
      }

      // Map from hash to filename (used for dedup)
      const hashToFilename = new Map()

      Object.entries(emotionMap).forEach(([emotionName, fileHash]) => {
        const file = fileMap[fileHash]
        if (file) {
          // Generate a shared filename for each unique file hash
          if (!hashToFilename.has(fileHash)) {
            const fileExtension = file.name ? file.name.split('.').pop().toLowerCase() : 'png'
            // Use the first 8 hash characters as part of the filename to keep it unique
            const sharedFilename = `emoji_${fileHash.substring(0, 8)}.${fileExtension}`
            hashToFilename.set(fileHash, sharedFilename)
          }

          const sharedFilename = hashToFilename.get(fileHash)

          collection.push({
            name: emotionName,
            file: sharedFilename,  // Multiple emotions may point to the same file
            source: file,
            fileHash,  // Keep hash info for dedup-aware processing later
            size: { ...size }
          })
        }
      })

      console.log(`Emoji deduplication: ${Object.keys(emotionMap).length} emojis using ${hashToFilename.size} different image files`)

      // Ensure at least the `neutral` emoji is present
      if (!collection.find(item => item.name === 'neutral')) {
        console.warn('Warning: neutral emoji not provided, default image will be used')
      }
    }
    
    return collection
  }

  /**
   * Get skin configuration info
   * @returns {Object} Skin configuration
   */
  getSkinInfo() {
    if (!this.config || !this.config.theme || !this.config.theme.skin) {
      return {}
    }

    const skin = this.config.theme.skin
    const result = {}

    // Process light mode
    if (skin.light) {
      result.light = {
        text_color: skin.light.textColor || '#000000',
        background_color: skin.light.backgroundColor || '#ffffff'
      }

      if (skin.light.backgroundType === 'image' && skin.light.backgroundImage) {
        result.light.background_image = 'background_light.raw'
      }
    }

    // Process dark mode
    if (skin.dark) {
      result.dark = {
        text_color: skin.dark.textColor || '#ffffff',
        background_color: skin.dark.backgroundColor || '#121212'
      }

      if (skin.dark.backgroundType === 'image' && skin.dark.backgroundImage) {
        result.dark.background_image = 'background_dark.raw'
      }
    }

    return result
  }

  /**
   * Generate index.json contents
   * @returns {Object} index.json object
   */
  generateIndexJson() {
    if (!this.config) {
      throw new Error('Configuration object not set')
    }

    const indexData = {
      version: 1,
      chip_model: this.config.chip.model,
      hide_subtitle: this.config.theme.font.hide_subtitle || false,
      display_config: {
        width: this.config.chip.display.width,
        height: this.config.chip.display.height,
        monochrome: false,
        color: this.config.chip.display.color || 'RGB565'
      }
    }

    // Add the wake-word model
    const wakewordInfo = this.getWakewordModelInfo()
    if (wakewordInfo) {
      indexData.srmodels = wakewordInfo.filename

      // If it's a custom wake word, add the multinet_model config
      if (wakewordInfo.type === 'MultiNet' && wakewordInfo.custom) {
        const custom = wakewordInfo.custom
        indexData.multinet_model = {
          language: custom.model.includes('_en') ? 'en' : 'cn',
          duration: custom.duration || 3000,
          threshold: custom.threshold / 100.0,
          commands: [
            {
              command: custom.command,
              text: custom.name,
              action: "wake"
            }
          ]
        }
      }
    }

    // Add font info
    const fontInfo = this.getFontInfo()
    if (fontInfo) {
      indexData.text_font = fontInfo.filename
    }

    // Add skin configuration
    const skinInfo = this.getSkinInfo()
    if (Object.keys(skinInfo).length > 0) {
      indexData.skin = skinInfo
    }

    // Add the emoji collection
    const emojiCollection = this.getEmojiCollectionInfo()
    if (emojiCollection.length > 0) {
      indexData.emoji_collection = emojiCollection.map(emoji => ({
        name: emoji.name,
        file: emoji.file
      }))
    }

    return indexData
  }

  /**
   * Prepare packaged resources
   * @returns {Object} Packaged resource manifest
   */
  preparePackageResources() {
    const resources = {
      files: [],
      indexJson: this.generateIndexJson(),
      config: { ...this.config }
    }

    // Add the wake-word model
    const wakewordInfo = this.getWakewordModelInfo()
    if (wakewordInfo && wakewordInfo.name) {
      resources.files.push({
        type: 'wakeword',
        name: wakewordInfo.name,
        filename: wakewordInfo.filename,
        modelType: wakewordInfo.type,
        isCustom: wakewordInfo.type === 'MultiNet'
      })
    }

    // Add the font file
    const fontInfo = this.getFontInfo()
    if (fontInfo) {
      resources.files.push({
        type: 'font',
        filename: fontInfo.filename,
        source: fontInfo.source,
        config: fontInfo.config || null
      })
    }

    // Add emoji files (with deduplication)
    const emojiCollection = this.getEmojiCollectionInfo()
    const addedFileHashes = new Set()  // Tracks already-added file hashes

    emojiCollection.forEach(emoji => {
      // If a fileHash exists (custom emoji using the new structure), skip duplicates
      if (emoji.fileHash) {
        if (addedFileHashes.has(emoji.fileHash)) {
          // File already added, skip (but keep it in index.json's emoji_collection)
          console.log(`Skipping duplicate file: ${emoji.name} -> ${emoji.file} (hash: ${emoji.fileHash.substring(0, 8)})`)
          return
        }
        addedFileHashes.add(emoji.fileHash)
      }

      // Add the unique file
      resources.files.push({
        type: 'emoji',
        name: emoji.name,
        filename: emoji.file,
        source: emoji.source,
        size: emoji.size,
        fileHash: emoji.fileHash  // Pass hash info through
      })
    })

    // Add background images
    const skin = this.config?.theme?.skin
    if (skin?.light?.backgroundType === 'image' && skin.light.backgroundImage) {
      resources.files.push({
        type: 'background',
        filename: 'background_light.raw',
        source: skin.light.backgroundImage,
        mode: 'light'
      })
    }
    if (skin?.dark?.backgroundType === 'image' && skin.dark.backgroundImage) {
      resources.files.push({
        type: 'background', 
        filename: 'background_dark.raw',
        source: skin.dark.backgroundImage,
        mode: 'dark'
      })
    }

    return resources
  }

  /**
   * Preprocess custom fonts
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<void>}
   */
  async preprocessCustomFonts(progressCallback = null) {
    const fontInfo = this.getFontInfo()
    
    if (fontInfo && fontInfo.type === 'custom' && !this.convertedFonts.has(fontInfo.filename)) {
      if (progressCallback) progressCallback(20, 'Converting custom font...')
      
      try {
        const convertOptions = {
          fontFile: fontInfo.source,
          fontName: fontInfo.filename.replace(/\.bin$/, ''),
          fontSize: fontInfo.config.size,
          bpp: fontInfo.config.bpp,
          charset: fontInfo.config.charset,
          symbols: fontInfo.config.symbols || '',
          range: fontInfo.config.range || '',
          compression: false,
          progressCallback: (progress, message) => {
            if (progressCallback) progressCallback(20 + progress * 0.2, `Font conversion: ${message}`)
          }
        }
        
        let convertedFont

        // Use the browser-side font converter
        await this.fontConverterBrowser.initialize()
        convertedFont = await this.fontConverterBrowser.convertToCBIN(convertOptions)
        this.convertedFonts.set(fontInfo.filename, convertedFont)

        // Save the converted font to temporary storage
        if (this.autoSaveEnabled) {
          const tempKey = `converted_font_${fontInfo.filename}`
          try {
            await this.configStorage.saveTempData(tempKey, convertedFont, 'converted_font', {
              filename: fontInfo.filename,
              size: fontInfo.config.size,
              bpp: fontInfo.config.bpp,
              charset: fontInfo.config.charset
            })
            console.log(`Converted font saved to storage: ${fontInfo.filename}`)
          } catch (error) {
            console.warn(`Failed to save converted font: ${fontInfo.filename}`, error)
          }
        }
      } catch (error) {
        console.error('Font conversion failed:', error)
        throw new Error(`Font conversion failed: ${error.message}`)
      }
    }
  }

  /**
   * Generate assets.bin
   * @param {Function} progressCallback - Progress callback
   * @returns {Promise<Blob>} The generated assets.bin file
   */
  async generateAssetsBin(progressCallback = null) {
    if (!this.config) {
      throw new Error('Configuration object not set')
    }

    try {
      if (progressCallback) progressCallback(0, 'Starting generation...')

      // Preprocess custom fonts
      await this.preprocessCustomFonts(progressCallback)

      await new Promise(resolve => setTimeout(resolve, 100))
      if (progressCallback) progressCallback(40, 'Preparing resource files...')

      const resources = this.preparePackageResources()

      // Reset generator state
      this.wakenetPacker.clear()
      this.spiffsGenerator.clear()

      // Process each kind of resource file
      await this.processResourceFiles(resources, progressCallback)

      await new Promise(resolve => setTimeout(resolve, 100))
      if (progressCallback) progressCallback(90, 'Generating final file...')

      // Print file list
      this.spiffsGenerator.printFileList()

      // Generate the final assets.bin
      const assetsBinData = await this.spiffsGenerator.generate((progress, message) => {
        if (progressCallback) {
          progressCallback(90 + progress * 0.1, message)
        }
      })
      
      if (progressCallback) progressCallback(100, 'Generation completed')
      
      return new Blob([assetsBinData], { type: 'application/octet-stream' })
      
    } catch (error) {
      console.error('Failed to generate assets.bin:', error)
      throw error
    }
  }

  /**
   * Download the assets.bin file
   * @param {Blob} blob - The assets.bin file data
   * @param {string} filename - Download filename
   */
  downloadAssetsBin(blob, filename = 'assets.bin') {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  /**
   * Get font information (with conversion helpers)
   * @param {File} fontFile - Font file (optional; if provided, info is retrieved for that file)
   * @returns {Promise<Object>} Font info
   */
  async getFontInfoWithDetails(fontFile = null) {
    try {
      const file = fontFile || this.config?.theme?.font?.custom?.file
      if (!file) return null

      let info

      // Use the browser-side font converter
      await this.fontConverterBrowser.initialize()
      info = await this.fontConverterBrowser.getFontInfo(file)
      
      return {
        ...info,
        file: file,
        isCustom: true
      }
    } catch (error) {
      console.error('Failed to get font details:', error)
      return null
    }
  }

  /**
   * Estimate font size
   * @param {Object} fontConfig - Font configuration
   * @returns {Promise<Object>} Size estimation result
   */
  async estimateFontSize(fontConfig = null) {
    try {
      const config = fontConfig || this.config?.theme?.font?.custom
      if (!config) return null
      
      const estimateOptions = {
        fontSize: config.size,
        bpp: config.bpp,
        charset: config.charset,
        symbols: config.symbols || '',
        range: config.range || ''
      }
      
      let sizeInfo

      // Use the browser-side font converter
      sizeInfo = this.fontConverterBrowser.estimateSize(estimateOptions)
      
      return sizeInfo
    } catch (error) {
      console.error('Failed to estimate font size:', error)
      return null
    }
  }

  /**
   * Validate a custom font configuration
   * @param {Object} fontConfig - Font configuration
   * @returns {Object} Validation result
   */
  validateCustomFont(fontConfig) {
    const errors = []
    const warnings = []

    if (!fontConfig.file) {
      errors.push('Missing font file')
    } else {
      // Validate using the browser-side converter
      const isValid = this.fontConverterBrowser.validateFont(fontConfig.file)
        
      if (!isValid) {
        errors.push('Font file format not supported')
      }
    }
    
    if (fontConfig.size < 8 || fontConfig.size > 80) {
      errors.push('Font size must be between 8-80')
    }
    
    if (![1, 2, 4, 8].includes(fontConfig.bpp)) {
      errors.push('BPP must be 1, 2, 4 or 8')
    }
    
    if (!fontConfig.charset && !fontConfig.symbols && !fontConfig.range) {
      warnings.push('No charset, symbols or range specified, default charset will be used')
    }
    
    return {
      valid: errors.length === 0,
      errors,
      warnings
    }
  }


  /**
   * Get font converter status
   * @returns {Object} Converter status info
   */
  getConverterStatus() {
    return {
      initialized: this.fontConverterBrowser.initialized,
      supportedFormats: this.fontConverterBrowser.supportedFormats
    }
  }

  /**
   * Process resource files
   * @param {Object} resources - Resource config
   * @param {Function} progressCallback - Progress callback
   */
  async processResourceFiles(resources, progressCallback = null) {
    let processedCount = 0
    const totalFiles = resources.files.length

    // Add the index.json file
    const indexJsonData = new TextEncoder().encode(JSON.stringify(resources.indexJson, null, 2))
    // print json string
    console.log('index.json', resources.indexJson);
    this.spiffsGenerator.addFile('index.json', indexJsonData.buffer)
    
    for (const resource of resources.files) {
      const progressPercent = 40 + (processedCount / totalFiles) * 40
      if (progressCallback) {
        progressCallback(progressPercent, `Processing file: ${resource.filename}`)
      }
      
      try {
        await this.processResourceFile(resource)
        processedCount++
      } catch (error) {
        console.error(`Failed to process resource file: ${resource.filename}`, error)
        throw new Error(`Failed to process resource file: ${resource.filename} - ${error.message}`)
      }
    }
  }

  /**
   * Process a single resource file
   * @param {Object} resource - Resource config
   */
  async processResourceFile(resource) {
    switch (resource.type) {
      case 'wakeword':
        await this.processWakewordModel(resource)
        break
      case 'font':
        await this.processFontFile(resource)
        break
      case 'emoji':
        await this.processEmojiFile(resource)
        break
      case 'background':
        await this.processBackgroundFile(resource)
        break
      default:
        console.warn(`Unknown resource type: ${resource.type}`)
    }
  }

  /**
   * Process the wake-word model
   * @param {Object} resource - Resource config
   */
  async processWakewordModel(resource) {
    const success = await this.wakenetPacker.loadModelFromShare(resource.name)
    if (!success) {
      throw new Error(`Failed to load wakeword model: ${resource.name}`)
    }
    
    const srmodelsData = this.wakenetPacker.packModels()
    this.spiffsGenerator.addFile(resource.filename, srmodelsData)
  }

  /**
   * Process a font file
   * @param {Object} resource - Resource config
   */
  async processFontFile(resource) {
    if (resource.config) {
      // Custom font: use the converted data
      const convertedFont = this.convertedFonts.get(resource.filename)
      if (convertedFont) {
        this.spiffsGenerator.addFile(resource.filename, convertedFont)
      } else {
        throw new Error(`Converted font not found: ${resource.filename}`)
      }
    } else {
      // Preset font: load from the share/fonts directory
      const fontData = await this.loadPresetFont(resource.source)
      this.spiffsGenerator.addFile(resource.filename, fontData)
    }
  }

  /**
   * Process an emoji file
   * @param {Object} resource - Resource config
   */
  async processEmojiFile(resource) {
    // Note: file deduplication already happened in preparePackageResources().
    // Every file processed here is unique.

    let imageData
    let needsScaling = false
    let imageFormat = 'png' // Default format
    let isGif = false

    if (typeof resource.source === 'string' && resource.source.startsWith('preset:')) {
      // Preset emoji pack
      const presetName = resource.source.replace('preset:', '')
      imageData = await this.loadPresetEmoji(presetName, resource.name)
    } else {
      // Custom emoji
      const file = resource.source

      // Detect GIF format
      isGif = this.isGifFile(file)

      // Determine the file's format
      const fileExtension = file.name.split('.').pop().toLowerCase()
      imageFormat = fileExtension

      // Inspect the actual image dimensions
      try {
        const actualDimensions = await this.getImageDimensions(file)
        const targetSize = resource.size || { width: 64, height: 64 }

        // Scaling is required if the actual size exceeds the target bounds
        if (actualDimensions.width > targetSize.width ||
            actualDimensions.height > targetSize.height) {
          needsScaling = true
          console.log(`Emoji ${resource.name} needs scaling: ${actualDimensions.width}x${actualDimensions.height} -> ${targetSize.width}x${targetSize.height}`)
        }
      } catch (error) {
        console.warn(`Failed to get emoji image dimensions: ${resource.name}`, error)
      }

      // If no scaling is needed, read the file directly
      if (!needsScaling) {
        imageData = await this.fileToArrayBuffer(file)
      }
    }

    // When scaling is required, pick the scaler based on file type
    if (needsScaling) {
      try {
        const targetSize = resource.size || { width: 64, height: 64 }

        if (isGif) {
          // Use WasmGifScaler to process GIF files
          console.log(`Using WasmGifScaler to process GIF emoji: ${resource.name}`)
          const scaledGifBlob = await this.gifScaler.scaleGif(resource.source, {
            maxWidth: targetSize.width,
            maxHeight: targetSize.height,
            keepAspectRatio: true,
            lossy: 30  // Use lossy compression to reduce file size
          })
          imageData = await this.fileToArrayBuffer(scaledGifBlob)
        } else {
          // Use the regular pathway for other image formats
          imageData = await this.scaleImageToFit(resource.source, targetSize, imageFormat)
        }
      } catch (error) {
        console.error(`Failed to scale emoji image: ${resource.name}`, error)
        // Fall back to the original image if scaling fails
        imageData = await this.fileToArrayBuffer(resource.source)
      }
    }

    // Add the file to SPIFFS
    this.spiffsGenerator.addFile(resource.filename, imageData, {
      width: resource.size?.width || 0,
      height: resource.size?.height || 0
    })

    // Log the processing step
    if (resource.fileHash) {
      console.log(`Emoji file added: ${resource.filename} (hash: ${resource.fileHash.substring(0, 8)})`)
    }
  }

  /**
   * Process a background file
   * @param {Object} resource - Resource config
   */
  async processBackgroundFile(resource) {
    const imageData = await this.fileToArrayBuffer(resource.source)

    // Convert the image into raw RGB565 data
    const rawData = await this.convertImageToRgb565(imageData)
    this.spiffsGenerator.addFile(resource.filename, rawData)
  }

  /**
   * Load a preset font
   * @param {string} fontName - Font name
   * @returns {Promise<ArrayBuffer>} Font data
   */
  async loadPresetFont(fontName) {
    try {
      const response = await fetch(`./static/fonts/${fontName}.bin`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (error) {
      throw new Error(`Failed to load preset font: ${fontName} - ${error.message}`)
    }
  }

  /**
   * Load a preset emoji
   * @param {string} presetName - Preset name (twemoji32/twemoji64/noto-emoji_64/noto-emoji_128)
   * @param {string} emojiName - Emoji name
   * @returns {Promise<ArrayBuffer>} Emoji data
   */
  async loadPresetEmoji(presetName, emojiName) {
    try {
      // Determine file format based on preset name
      const presetConfigs = {
        'twemoji32': 'png',
        'twemoji64': 'png',
        'noto-emoji_64': 'gif',
        'noto-emoji_128': 'gif'
      }
      const format = presetConfigs[presetName] || 'png'
      
      const response = await fetch(`./static/emojis/${presetName}/${emojiName}.${format}`)
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      return await response.arrayBuffer()
    } catch (error) {
      throw new Error(`Failed to load preset emoji: ${presetName}/${emojiName} - ${error.message}`)
    }
  }

  /**
   * Convert a file to an ArrayBuffer
   * @param {File|Blob} file - File object
   * @returns {Promise<ArrayBuffer>} File data
   */
  fileToArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsArrayBuffer(file)
    })
  }

  /**
   * Scale an image to fit the target size (aspect-preserving, `contain` behavior)
   * @param {ArrayBuffer|File} imageData - Image data
   * @param {Object} targetSize - Target size {width, height}
   * @param {string} format - Image format (used for transparent-background handling)
   * @returns {Promise<ArrayBuffer>} The scaled image data
   */
  async scaleImageToFit(imageData, targetSize, format = 'png') {
    return new Promise((resolve, reject) => {
      const blob = imageData instanceof File ? imageData : new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d')

          // Set the target canvas dimensions
          canvas.width = targetSize.width
          canvas.height = targetSize.height

          // Compute aspect-preserving scale dimensions (contain effect)
          const imgAspectRatio = img.width / img.height
          const targetAspectRatio = targetSize.width / targetSize.height

          let drawWidth, drawHeight, offsetX, offsetY

          if (imgAspectRatio > targetAspectRatio) {
            // Image is wider, scale by width
            drawWidth = targetSize.width
            drawHeight = targetSize.width / imgAspectRatio
            offsetX = 0
            offsetY = (targetSize.height - drawHeight) / 2
          } else {
            // Image is taller, scale by height
            drawHeight = targetSize.height
            drawWidth = targetSize.height * imgAspectRatio
            offsetX = (targetSize.width - drawWidth) / 2
            offsetY = 0
          }

          // Preserve transparency for PNGs
          if (format === 'png') {
            // Clear the canvas to keep it transparent
            ctx.clearRect(0, 0, canvas.width, canvas.height)
          } else {
            // Other formats get a white background
            ctx.fillStyle = '#FFFFFF'
            ctx.fillRect(0, 0, canvas.width, canvas.height)
          }

          // Draw the scaled image
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

          // Convert to ArrayBuffer
          canvas.toBlob((blob) => {
            const reader = new FileReader()
            reader.onload = () => resolve(reader.result)
            reader.onerror = () => reject(new Error('Failed to convert image data'))
            reader.readAsArrayBuffer(blob)
          }, `image/${format}`)
          
          URL.revokeObjectURL(url)
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to load image'))
      }
      
      img.src = url
    })
  }

  /**
   * Check whether a file is a GIF
   * @param {File} file - File object
   * @returns {boolean} Whether the file is a GIF
   */
  isGifFile(file) {
    // Check the MIME type
    if (file.type === 'image/gif') {
      return true
    }

    // Check the file extension
    const extension = file.name.split('.').pop().toLowerCase()
    return extension === 'gif'
  }

  /**
   * Get image dimensions
   * @param {ArrayBuffer|File} imageData - Image data
   * @returns {Promise<Object>} Image dimensions {width, height}
   */
  async getImageDimensions(imageData) {
    return new Promise((resolve, reject) => {
      const blob = imageData instanceof File ? imageData : new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({
          width: img.width,
          height: img.height
        })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to get image dimensions'))
      }
      
      img.src = url
    })
  }

  /**
   * Convert an image into raw RGB565 data
   * @param {ArrayBuffer} imageData - Image data
   * @returns {Promise<ArrayBuffer>} RGB565 raw data
   */
  async convertImageToRgb565(imageData) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([imageData])
      const url = URL.createObjectURL(blob)
      const img = new Image()
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          const ctx = canvas.getContext('2d', { willReadFrequently: true })
          
          canvas.width = this.config?.chip?.display?.width || 320
          canvas.height = this.config?.chip?.display?.height || 240

          // Draw using cover mode, keeping the aspect ratio and centering the image
          const imgAspectRatio = img.width / img.height
          const canvasAspectRatio = canvas.width / canvas.height

          let drawWidth, drawHeight, offsetX, offsetY

          if (imgAspectRatio > canvasAspectRatio) {
            // Image is wider: scale by height (cover)
            drawHeight = canvas.height
            drawWidth = canvas.height * imgAspectRatio
            offsetX = (canvas.width - drawWidth) / 2
            offsetY = 0
          } else {
            // Image is taller: scale by width (cover)
            drawWidth = canvas.width
            drawHeight = canvas.width / imgAspectRatio
            offsetX = 0
            offsetY = (canvas.height - drawHeight) / 2
          }

          // Draw the image to the canvas in cover mode, centered
          ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight)

          // Read the pixel data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const pixels = imageData.data

          // Convert to RGB565
          const rgb565Data = new ArrayBuffer(canvas.width * canvas.height * 2)
          const rgb565View = new Uint16Array(rgb565Data)

          for (let i = 0; i < pixels.length; i += 4) {
            const r = pixels[i] >> 3      // 5-bit red
            const g = pixels[i + 1] >> 2  // 6-bit green
            const b = pixels[i + 2] >> 3  // 5-bit blue

            rgb565View[i / 4] = (r << 11) | (g << 5) | b
          }

          // LVGL constants
          const LV_IMAGE_HEADER_MAGIC = 0x19  // LVGL image header magic
          const LV_COLOR_FORMAT_RGB565 = 0x12 // RGB565 color format

          // Compute stride (bytes per row)
          const stride = canvas.width * 2  // 2 bytes per RGB565 pixel

          // Construct a header that matches lv_image_dsc_t
          const headerSize = 28  // lv_image_dsc_t size: header(12) + data_size(4) + data(4) + reserved(4) + reserved_2(4) = 28 bytes
          const totalSize = headerSize + rgb565Data.byteLength
          const finalData = new ArrayBuffer(totalSize)
          const finalView = new Uint8Array(finalData)
          const headerView = new DataView(finalData)

          let offset = 0

          // lv_image_header_t (16 bytes)
          // magic: 8 bits, cf: 8 bits, flags: 16 bits (4 bytes total)
          const headerWord1 = (0 << 24) | (0 << 16) | (LV_COLOR_FORMAT_RGB565 << 8) | LV_IMAGE_HEADER_MAGIC
          headerView.setUint32(offset, headerWord1, true)
          offset += 4

          // w: 16 bits, h: 16 bits (4 bytes total)
          const sizeWord = (canvas.height << 16) | canvas.width

          headerView.setUint32(offset, sizeWord, true)
          offset += 4

          // stride: 16 bits, reserved_2: 16 bits (4 bytes total)
          const strideWord = (0 << 16) | stride
          headerView.setUint32(offset, strideWord, true)
          offset += 4

          // Remaining lv_image_dsc_t fields
          // data_size: 32 bits (4 bytes)
          headerView.setUint32(offset, rgb565Data.byteLength, true)
          offset += 4

          // data pointer placeholder (4 bytes; in use this points to the data section)
          headerView.setUint32(offset, headerSize, true)  // Relative offset
          offset += 4

          // reserved (4 bytes)
          headerView.setUint32(offset, 0, true)
          offset += 4

          // reserved_2 (4 bytes)
          headerView.setUint32(offset, 0, true)
          offset += 4

          // Copy the RGB565 data after the header
          finalView.set(new Uint8Array(rgb565Data), headerSize)
          
          URL.revokeObjectURL(url)
          resolve(finalData)
        } catch (error) {
          URL.revokeObjectURL(url)
          reject(error)
        }
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Unable to load image'))
      }
      
      img.src = url
    })
  }

  /**
   * Clean up temporary resources
   */
  cleanup() {
    this.resources.clear()
    this.tempFiles = []
    this.convertedFonts.clear()
    this.wakenetPacker.clear()
    this.spiffsGenerator.clear()
    this.gifScaler.dispose() // Release WasmGifScaler resources
  }

  /**
   * Clear all stored data (used by the "Restart" feature)
   * @returns {Promise<void>}
   */
  async clearAllStoredData() {
    try {
      await this.configStorage.clearAll()
      this.cleanup()
      console.log('All stored data cleared')
    } catch (error) {
      console.error('Failed to clear stored data:', error)
      throw error
    }
  }

  /**
   * Get storage status info
   * @returns {Promise<Object>} Storage status info
   */
  async getStorageStatus() {
    try {
      const storageInfo = await this.configStorage.getStorageInfo()
      const hasConfig = await this.configStorage.hasStoredConfig()
      
      return {
        hasStoredData: hasConfig,
        storageInfo,
        autoSaveEnabled: this.autoSaveEnabled
      }
    } catch (error) {
      console.error('Failed to get storage status:', error)
      return {
        hasStoredData: false,
        storageInfo: null,
        autoSaveEnabled: this.autoSaveEnabled
      }
    }
  }

  /**
   * Enable/disable auto-save
   * @param {boolean} enabled - Whether to enable
   */
  setAutoSave(enabled) {
    this.autoSaveEnabled = enabled
    console.log(`Auto-save ${enabled ? 'enabled' : 'disabled'}`)
  }

  /**
   * Get a resource summary for display
   * @returns {Array} Resource summary
   */
  getResourceSummary() {
    const summary = []
    const resources = this.preparePackageResources()

    // Tally each resource category
    const counts = {
      wakeword: 0,
      font: 0, 
      emoji: 0,
      background: 0
    }
    
    resources.files.forEach(file => {
      counts[file.type] = (counts[file.type] || 0) + 1
      
      let description = ''
      switch (file.type) {
        case 'wakeword':
          description = `Wakeword model: ${file.name} (${file.modelType})`
          break
        case 'font':
          if (file.config) {
            description = `Custom font: size ${file.config.size}px, BPP ${file.config.bpp}`
          } else {
            description = `Preset font: ${file.source}`
          }
          break
        case 'emoji':
          description = `Emoji: ${file.name} (${file.size.width}x${file.size.height})`
          break
        case 'background':
          description = `${file.mode === 'light' ? 'Light' : 'Dark'} mode background`
          break
      }
      
      summary.push({
        type: file.type,
        filename: file.filename,
        description
      })
    })
    
    return {
      files: summary,
      counts,
      totalFiles: summary.length,
      indexJson: resources.indexJson
    }
  }
}

export default AssetsBuilder
