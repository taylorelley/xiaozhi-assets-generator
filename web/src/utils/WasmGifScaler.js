/**
 * WasmGifScaler class
 * Uses gifsicle-wasm-browser to scale GIF images.
 *
 * Main features:
 * - GIF scaling
 * - Aspect-ratio preservation
 * - GIF optimization and compression
 * - Multiple scaling modes
 */

import gifsicle from 'gifsicle-wasm-browser'

class WasmGifScaler {
  constructor(options = {}) {
    this.quality = options.quality || 10 // 1-200, lossy compression quality
    this.debug = options.debug || false
    this.scalingMode = options.scalingMode || 'auto' // 'auto', 'fit', 'fill'
    this.optimize = options.optimize !== false // Optimization enabled by default
    this.optimizationLevel = options.optimizationLevel || 2 // 1-3, optimization level
  }

  /**
   * Scale a GIF image
   * @param {File|Blob|ArrayBuffer} gifFile - GIF file
   * @param {Object} options - Scaling options
   * @param {number} options.maxWidth - Maximum width
   * @param {number} options.maxHeight - Maximum height
   * @param {boolean} options.keepAspectRatio - Whether to keep aspect ratio (default true)
   * @param {boolean} options.optimize - Whether to optimize (default true)
   * @param {number} options.lossy - Lossy compression quality (1-200); defaults to the instance setting
   * @param {number} options.loopCount - Loop count; 0 means infinite loop (default), -1 keeps as-is
   * @returns {Promise<Blob>} The scaled GIF blob
   */
  async scaleGif(gifFile, options = {}) {
    const {
      maxWidth,
      maxHeight,
      keepAspectRatio = true,
      optimize = this.optimize,
      lossy = this.quality,
      loopCount = 0  // Default to infinite loop
    } = options

    if (!maxWidth && !maxHeight) {
      throw new Error('Either maxWidth or maxHeight must be specified')
    }

    try {
      // Build the resize command
      let resizeCmd
      if (keepAspectRatio) {
        // Aspect-preserving scaling uses --resize-fit
        const width = maxWidth || '_'
        const height = maxHeight || '_'
        resizeCmd = `--resize-fit ${width}x${height}`
      } else {
        // Force resize to the target dimensions with --resize
        const width = maxWidth || '_'
        const height = maxHeight || '_'
        resizeCmd = `--resize ${width}x${height}!`
      }

      // Build the full gifsicle command
      const commandParts = []

      // Add -U (unoptimize) to ensure correct processing
      commandParts.push('-U')

      // Add the resize command
      commandParts.push(resizeCmd)

      // Add the loop-count setting (only when loopCount >= 0; -1 means skip)
      if (loopCount >= 0) {
        commandParts.push(`--loopcount=${loopCount}`)
      }

      // Add lossy compression
      if (lossy && lossy > 0) {
        commandParts.push(`--lossy=${lossy}`)
      }

      // Add optimization
      if (optimize) {
        commandParts.push(`-O${this.optimizationLevel}`)
      }

      // Input and output
      commandParts.push('1.gif')
      commandParts.push('-o /out/output.gif')

      const command = commandParts.join(' ')

      if (this.debug) {
        console.log('GIF scaling command:', command)
        console.log('Input file size:', gifFile.size || 'unknown')
      }

      // Invoke gifsicle
      const result = await gifsicle.run({
        input: [{
          file: gifFile,
          name: '1.gif'
        }],
        command: [command]
      })

      if (!result || result.length === 0) {
        throw new Error('gifsicle processing failed; no result returned')
      }

      const outputFile = result[0]

      if (this.debug) {
        console.log('GIF scaling complete')
        console.log('Output file size:', outputFile.size)
        if (gifFile.size) {
          const ratio = ((1 - outputFile.size / gifFile.size) * 100).toFixed(2)
          console.log(`Compression ratio: ${ratio}%`)
        }
      }

      // Convert to a Blob
      return new Blob([outputFile], { type: 'image/gif' })

    } catch (error) {
      console.error('GIF scaling failed:', error)
      throw new Error(`GIF scaling failed: ${error.message}`)
    }
  }

  /**
   * Batch-scale GIF images
   * @param {Array} files - Array of GIF files [{file, options}]
   * @returns {Promise<Array>} Array of scaled GIF Blobs
   */
  async scaleGifBatch(files) {
    const results = []

    for (let i = 0; i < files.length; i++) {
      const { file, options } = files[i]
      try {
        const result = await this.scaleGif(file, options)
        results.push(result)
      } catch (error) {
        console.error(`Batch scaling failed for file #${i + 1}:`, error)
        results.push(null)
      }
    }

    return results
  }

  /**
   * Optimize a GIF without changing its dimensions
   * @param {File|Blob|ArrayBuffer} gifFile - GIF file
   * @param {Object} options - Optimization options
   * @param {number} options.lossy - Lossy compression quality (1-200)
   * @param {number} options.level - Optimization level (1-3)
   * @param {number} options.loopCount - Loop count; 0 means infinite loop (default), -1 keeps as-is
   * @returns {Promise<Blob>} The optimized GIF blob
   */
  async optimizeGif(gifFile, options = {}) {
    const {
      lossy = this.quality,
      level = this.optimizationLevel,
      loopCount = 0  // Default to infinite loop
    } = options

    try {
      const commandParts = ['-U']

      // Add the loop-count setting
      if (loopCount >= 0) {
        commandParts.push(`--loopcount=${loopCount}`)
      }

      if (lossy && lossy > 0) {
        commandParts.push(`--lossy=${lossy}`)
      }

      commandParts.push(`-O${level}`)
      commandParts.push('1.gif')
      commandParts.push('-o /out/output.gif')

      const command = commandParts.join(' ')

      if (this.debug) {
        console.log('GIF optimize command:', command)
      }

      const result = await gifsicle.run({
        input: [{
          file: gifFile,
          name: '1.gif'
        }],
        command: [command]
      })

      if (!result || result.length === 0) {
        throw new Error('gifsicle optimization failed')
      }

      return new Blob([result[0]], { type: 'image/gif' })

    } catch (error) {
      console.error('GIF optimization failed:', error)
      throw new Error(`GIF optimization failed: ${error.message}`)
    }
  }

  /**
   * Get GIF information
   * @param {File|Blob|ArrayBuffer} gifFile - GIF file
   * @returns {Promise<Object>} GIF info
   */
  async getGifInfo(gifFile) {
    try {
      const result = await gifsicle.run({
        input: [{
          file: gifFile,
          name: '1.gif'
        }],
        command: ['--info 1.gif -o /out/info.txt']
      })

      if (!result || result.length === 0) {
        throw new Error('Unable to retrieve GIF info')
      }

      const infoFile = result[0]
      const infoText = await infoFile.text()

      // Parse the info text
      const info = this.parseGifInfo(infoText)

      return info

    } catch (error) {
      console.error('Failed to get GIF info:', error)
      // Return basic info
      return {
        size: gifFile.size || 0,
        type: 'image/gif'
      }
    }
  }

  /**
   * Parse GIF info text
   * @param {string} infoText - Output from `gifsicle --info`
   * @returns {Object} Parsed info
   */
  parseGifInfo(infoText) {
    const info = {
      frames: 0,
      width: 0,
      height: 0,
      colors: 0,
      loopCount: 0
    }

    try {
      // Parse frame count
      const framesMatch = infoText.match(/(\d+) images?/)
      if (framesMatch) {
        info.frames = parseInt(framesMatch[1])
      }

      // Parse dimensions
      const sizeMatch = infoText.match(/logical screen (\d+)x(\d+)/)
      if (sizeMatch) {
        info.width = parseInt(sizeMatch[1])
        info.height = parseInt(sizeMatch[2])
      }

      // Parse color count
      const colorsMatch = infoText.match(/(\d+) colors/)
      if (colorsMatch) {
        info.colors = parseInt(colorsMatch[1])
      }

      // Parse loop count
      if (infoText.includes('loop forever')) {
        info.loopCount = 0
      } else {
        const loopMatch = infoText.match(/loop count (\d+)/)
        if (loopMatch) {
          info.loopCount = parseInt(loopMatch[1])
        }
      }
    } catch (error) {
      console.warn('Error while parsing GIF info:', error)
    }

    return info
  }

  /**
   * Crop a GIF
   * @param {File|Blob|ArrayBuffer} gifFile - GIF file
   * @param {Object} cropRect - Crop region {x, y, width, height}
   * @returns {Promise<Blob>} The cropped GIF blob
   */
  async cropGif(gifFile, cropRect) {
    const { x, y, width, height } = cropRect

    try {
      const command = [
        '-U',
        `--crop ${x},${y}+${width}x${height}`,
        '1.gif',
        '-o /out/output.gif'
      ].join(' ')

      if (this.debug) {
        console.log('GIF crop command:', command)
      }

      const result = await gifsicle.run({
        input: [{
          file: gifFile,
          name: '1.gif'
        }],
        command: [command]
      })

      if (!result || result.length === 0) {
        throw new Error('gifsicle cropping failed')
      }

      return new Blob([result[0]], { type: 'image/gif' })

    } catch (error) {
      console.error('GIF cropping failed:', error)
      throw new Error(`GIF cropping failed: ${error.message}`)
    }
  }

  /**
   * Release resources
   */
  dispose() {
    // gifsicle-wasm-browser does not require any special cleanup
    if (this.debug) {
      console.log('WasmGifScaler disposed')
    }
  }

  /**
   * Set debug mode
   * @param {boolean} enabled - Whether to enable debug
   */
  setDebug(enabled) {
    this.debug = enabled
  }

  /**
   * Set compression quality
   * @param {number} quality - Compression quality (1-200)
   */
  setQuality(quality) {
    if (quality < 1 || quality > 200) {
      throw new Error('Quality must be between 1 and 200')
    }
    this.quality = quality
  }

  /**
   * Set optimization level
   * @param {number} level - Optimization level (1-3)
   */
  setOptimizationLevel(level) {
    if (level < 1 || level > 3) {
      throw new Error('Optimization level must be between 1 and 3')
    }
    this.optimizationLevel = level
  }
}

export default WasmGifScaler

