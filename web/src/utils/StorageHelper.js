/**
 * StorageHelper utility class
 * Provides convenient file-storage helpers for individual components.
 */

import configStorage from './ConfigStorage.js'

class StorageHelper {
  /**
   * Auto-save a font file.
   * @param {File} file - Font file
   * @param {Object} config - Font configuration
   * @returns {Promise<void>}
   */
  static async saveFontFile(file, config = {}) {
    if (file) {
      const key = 'custom_font'
      try {
        await configStorage.saveFile(key, file, 'font', {
          size: config.size || 20,
          bpp: config.bpp || 4,
          charset: config.charset || 'deepseek'
        })
        console.log(`Font file saved: ${file.name}`)
      } catch (error) {
        console.warn(`Failed to save font file: ${file.name}`, error)
      }
    }
  }

  /**
   * Auto-save an emoji file.
   * @param {string} emojiName - Emoji name or file hash (if prefixed with `hash_`)
   * @param {File} file - Emoji file
   * @param {Object} config - Emoji configuration
   * @returns {Promise<void>}
   */
  static async saveEmojiFile(emojiName, file, config = {}) {
    if (file && emojiName) {
      // When `emojiName` already starts with `hash_` (new dedup structure) use it as-is,
      // otherwise add the `emoji_` prefix (legacy structure, kept for backward compatibility).
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`

      try {
        const width = config?.size?.width ?? 64
        const height = config?.size?.height ?? 64

        // Pass a cloneable plain object to avoid Vue Proxy issues
        await configStorage.saveFile(key, file, 'emoji', {
          name: emojiName,
          size: { width, height },
          format: config?.format,
          emotions: config?.emotions  // New: list of emotions that use this file
        })
        console.log(`Emoji file saved: ${key} - ${file.name}`)
      } catch (error) {
        console.warn(`Failed to save emoji file: ${emojiName}`, error)
      }
    }
  }

  /**
   * Auto-save a background file.
   * @param {string} mode - Mode ('light' or 'dark')
   * @param {File} file - Background file
   * @param {Object} config - Background configuration
   * @returns {Promise<void>}
   */
  static async saveBackgroundFile(mode, file, config = {}) {
    if (file && mode) {
      const key = `background_${mode}`
      try {
        let safeConfig = {}
        try {
          safeConfig = config ? JSON.parse(JSON.stringify(config)) : {}
        } catch (e) {
          safeConfig = { ...config }
        }

        await configStorage.saveFile(key, file, 'background', {
          mode,
          ...safeConfig
        })
        console.log(`Background file saved: ${mode} - ${file.name}`)
      } catch (error) {
        console.warn(`Failed to save background file: ${mode}`, error)
      }
    }
  }

  /**
   * Restore a font file.
   * @returns {Promise<File|null>}
   */
  static async restoreFontFile() {
    try {
      return await configStorage.loadFile('custom_font')
    } catch (error) {
      console.warn('Failed to restore font file:', error)
      return null
    }
  }

  /**
   * Restore an emoji file.
   * @param {string} emojiName - Emoji name or file hash (if prefixed with `hash_`)
   * @returns {Promise<File|null>}
   */
  static async restoreEmojiFile(emojiName) {
    if (!emojiName) return null

    try {
      // When `emojiName` already starts with `hash_` (new dedup structure) use it as-is,
      // otherwise add the `emoji_` prefix (legacy structure, kept for backward compatibility).
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`
      return await configStorage.loadFile(key)
    } catch (error) {
      console.warn(`Failed to restore emoji file: ${emojiName}`, error)
      return null
    }
  }

  /**
   * Restore a background file.
   * @param {string} mode - Mode ('light' or 'dark')
   * @returns {Promise<File|null>}
   */
  static async restoreBackgroundFile(mode) {
    if (!mode) return null

    try {
      const key = `background_${mode}`
      return await configStorage.loadFile(key)
    } catch (error) {
      console.warn(`Failed to restore background file: ${mode}`, error)
      return null
    }
  }

  /**
   * Delete the font file.
   * @returns {Promise<void>}
   */
  static async deleteFontFile() {
    try {
      await configStorage.deleteFile('custom_font')
      console.log('Font file deleted')
    } catch (error) {
      console.warn('Failed to delete font file:', error)
    }
  }

  /**
   * Delete an emoji file.
   * @param {string} emojiName - Emoji name or file hash (if prefixed with `hash_`)
   * @returns {Promise<void>}
   */
  static async deleteEmojiFile(emojiName) {
    if (!emojiName) return

    try {
      // When `emojiName` already starts with `hash_` (new dedup structure) use it as-is,
      // otherwise add the `emoji_` prefix (legacy structure, kept for backward compatibility).
      const key = emojiName.startsWith('hash_') ? emojiName : `emoji_${emojiName}`
      await configStorage.deleteFile(key)
      console.log(`Emoji file deleted: ${key}`)
    } catch (error) {
      console.warn(`Failed to delete emoji file: ${emojiName}`, error)
    }
  }

  /**
   * Delete a background file.
   * @param {string} mode - Mode ('light' or 'dark')
   * @returns {Promise<void>}
   */
  static async deleteBackgroundFile(mode) {
    if (!mode) return

    try {
      const key = `background_${mode}`
      await configStorage.deleteFile(key)
      console.log(`Background file deleted: ${mode}`)
    } catch (error) {
      console.warn(`Failed to delete background file: ${mode}`, error)
    }
  }

  /**
   * Get storage information.
   * @returns {Promise<Object>}
   */
  static async getStorageInfo() {
    try {
      return await configStorage.getStorageInfo()
    } catch (error) {
      console.warn('Failed to get storage info:', error)
      return {
        configs: { count: 0 },
        files: { count: 0 },
        temp_data: { count: 0 },
        lastSaved: null
      }
    }
  }

  /**
   * Clear all stored files.
   * @returns {Promise<void>}
   */
  static async clearAllFiles() {
    try {
      await configStorage.clearAll()
      console.log('All stored files cleared')
    } catch (error) {
      console.warn('Failed to clear stored files:', error)
      throw error
    }
  }
}

export default StorageHelper
