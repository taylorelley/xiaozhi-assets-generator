class WebSocketTransfer {
  constructor(token) {
    this.token = token
    this.ws = null
    this.isConnected = false
    this.isCancelled = false
    this.chunkSize = 64 * 1024 // 64KB per chunk
    this.onProgress = null
    this.onError = null
    this.onComplete = null
    this.onDownloadUrlReady = null
    this.onTransferStarted = null // New: callback for the transfer_started event
    this.currentSession = null
    this.totalBytesSent = 0 // New: tracks the total bytes sent
    this.isSendingChunk = false // New: flag indicating a chunk is currently being sent
  }

  // Connect to the transfer server
  async connect() {
    return new Promise((resolve, reject) => {
      try {
        // Uses a fixed transfer-server address
        const wsUrl = `wss://api.tenclass.net/transfer/?token=${encodeURIComponent(this.token)}`
        this.ws = new WebSocket(wsUrl)

        this.ws.onopen = () => {
          this.isConnected = true
          console.log('WebSocket connected to transfer server')
          resolve()
        }

        this.ws.onmessage = (event) => {
          this.handleMessage(event)
        }

        this.ws.onerror = (error) => {
          console.error('WebSocket error:', error)
          this.isConnected = false
          reject(new Error('WebSocket connection failed'))
        }

        this.ws.onclose = (event) => {
          console.log('WebSocket closed:', event.code, event.reason)
          this.isConnected = false
        }

        // Set the connection timeout
        setTimeout(() => {
          if (!this.isConnected) {
            this.ws.close()
            reject(new Error('WebSocket connection timeout'))
          }
        }, 10000)

      } catch (error) {
        reject(new Error(`Failed to create WebSocket connection: ${error.message}`))
      }
    })
  }

  // Handle WebSocket messages
  handleMessage(event) {
    try {
      if (typeof event.data === 'string') {
        const message = JSON.parse(event.data)

        switch (message.type) {
          case 'file_created':
            if (this.currentSession) {
              this.currentSession.url = message.url
              // Notify that the download URL is ready
              if (this.onDownloadUrlReady) {
                this.onDownloadUrlReady(message.url)
              }
              // Wait for the transfer_started message before sending data
            }
            break

          case 'transfer_started':
            if (this.currentSession) {
              // Mark that the transfer_started message has been received
              this.currentSession.transferStarted = true

              // Notify external listeners
              if (this.onTransferStarted) {
                this.onTransferStarted()
              }

              // If the transfer is ready, start sending file data
              if (this.currentSession.transferReady) {
                this.sendFileData()
              }
            }
            break

          case 'ack':
            // Ack received: validate and update bytesSent
            if (this.currentSession) {
              const { blob } = this.currentSession
              const totalSize = blob.size
              const serverBytesSent = message.bytesSent

              // Validate the bytesSent value reported by the server
              if (serverBytesSent < 0) {
                console.error('Invalid server bytesSent (negative):', serverBytesSent)
                this.isSendingChunk = false // Reset the sending flag
                if (this.onError) {
                  this.onError(new Error('Server returned invalid byte count'))
                }
                return
              }

              if (serverBytesSent > totalSize) {
                console.error(`Server bytesSent (${serverBytesSent}) exceeds fileSize (${totalSize})`)
                this.isSendingChunk = false // Reset the sending flag
                if (this.onError) {
                  this.onError(new Error('Server byte count exceeds file size'))
                }
                return
              }

              // Mark the current chunk as finished
              this.isSendingChunk = false

              // Use the bytesSent value acknowledged by the server
              if (serverBytesSent > this.currentSession.bytesSent) {
                this.currentSession.bytesSent = serverBytesSent
              }

              // Send the next chunk
              this.sendFileData()
            }
            break

          case 'transfer_completed':
            // Verify transfer integrity
            if (this.currentSession) {
              const expectedSize = this.currentSession.blob.size
              if (this.totalBytesSent !== expectedSize) {
                console.warn(`Transfer size mismatch: sent ${this.totalBytesSent} bytes, expected ${expectedSize} bytes`)
              }
            }

            if (this.onComplete) {
              this.onComplete()
            }
            break

          case 'error':
            console.error('Transfer error:', message.message)
            if (this.onError) {
              this.onError(new Error(message.message))
            }
            break
        }
      }
    } catch (error) {
      console.error('Error handling message:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // Send file data
  async sendFileData() {
    // Prevent concurrent sends
    if (this.isSendingChunk) {
      return
    }

    if (!this.currentSession || this.isCancelled) {
      return
    }

    const { blob } = this.currentSession
    const totalSize = blob.size
    let bytesSent = this.currentSession.bytesSent

    // Strict check: ensure we never send more than the file size
    if (bytesSent >= totalSize) {
      if (this.onProgress) {
        this.onProgress(100, 'Transfer completed, waiting for device confirmation...')
      }
      return
    }

    this.isSendingChunk = true

    // Double-check that bytesSent does not exceed the file size
    if (bytesSent > totalSize) {
      console.error(`Critical error: bytesSent (${bytesSent}) exceeds fileSize (${totalSize})`)
      if (this.onError) {
        this.onError(new Error('Transfer byte count exceeds file size'))
      }
      return
    }

    // Compute the next chunk size, ensuring we stay within the file
    const remainingBytes = Math.max(0, totalSize - bytesSent)
    const chunkSize = Math.min(this.chunkSize, remainingBytes)

    if (chunkSize <= 0) {
      return
    }

    const chunk = blob.slice(bytesSent, bytesSent + chunkSize)

    try {
      // Read the file chunk
      const arrayBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result)
        reader.onerror = () => reject(new Error('File read failed'))
        reader.readAsArrayBuffer(chunk)
      })

      if (this.isCancelled) {
        return
      }

      // Send the binary data
      this.ws.send(arrayBuffer)

      // Optimistically update the local bytesSent counter
      const newBytesSent = bytesSent + chunkSize
      this.currentSession.bytesSent = newBytesSent
      this.totalBytesSent += chunkSize // Update total bytes sent

      // Verify that the updated bytesSent does not exceed the file size
      if (newBytesSent > totalSize) {
        console.error(`Critical error: bytesSent (${newBytesSent}) exceeds fileSize (${totalSize})`)
        if (this.onError) {
          this.onError(new Error('Transfer byte count exceeds file size'))
        }
        return
      }

      // Extra check: total bytes sent should also not exceed the file size
      if (this.totalBytesSent > totalSize) {
        console.error(`Critical error: totalBytesSent (${this.totalBytesSent}) exceeds fileSize (${totalSize})`)
        if (this.onError) {
          this.onError(new Error('Total sent bytes exceed file size'))
        }
        return
      }

      // Update progress (transfer-progress portion only)
      const transferProgress = Math.round(newBytesSent / totalSize * 60) + 40 // Range 40-100
      const step = `Transferring... ${Math.round(newBytesSent / 1024)}KB / ${Math.round(totalSize / 1024)}KB`

      if (this.onProgress) {
        this.onProgress(transferProgress, step)
      }

    } catch (error) {
      console.error('Error sending file chunk:', error)
      this.isSendingChunk = false // Reset the sending flag
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // Initialize the transfer session (only establishes the connection and fetches the URL)
  async initializeSession(blob, onProgress, onError, onDownloadUrlReady) {
    return new Promise((resolve, reject) => {
      this.onProgress = onProgress
      this.onError = (error) => {
        if (onError) onError(error)
        reject(error)
      }
      this.onDownloadUrlReady = (url) => {
        if (onDownloadUrlReady) onDownloadUrlReady(url)
        resolve(url)
      }
      this.isCancelled = false

      try {
        // Connect to the WebSocket server
        if (this.onProgress) {
          this.onProgress(5, 'Connecting to transfer server...')
        }

        this.connect().then(() => {
          // Send the file-creation request
          if (this.onProgress) {
            this.onProgress(10, 'Creating file session...')
          }

          const createMessage = {
            type: 'create_file',
            fileName: 'assets.bin',
            fileSize: blob.size
          }

          this.ws.send(JSON.stringify(createMessage))

          // Save the blob reference and wait for the file_created message
          this.currentSession = {
            blob: blob,
            bytesSent: 0,
            fileSize: blob.size,
            transferStarted: false,
            transferReady: true // Set to true at init time because transfer may start immediately after initializeSession
          }
          // Reset the total bytes-sent counter
          this.totalBytesSent = 0
        }).catch(error => {
          console.error('Transfer initialization failed:', error)
          if (this.onError) {
            this.onError(error)
          }
        })

      } catch (error) {
        console.error('Transfer initialization failed:', error)
        if (this.onError) {
          this.onError(error)
        }
      }
    })
  }

  // Start sending file data (assumes the session is already initialized)
  async startTransfer(onProgress, onError, onComplete) {
    return new Promise((resolve, reject) => {
      this.onProgress = onProgress
      this.onError = (error) => {
        this.isSendingChunk = false // Reset the sending flag
        if (onError) onError(error)
        reject(error)
      }
      this.onComplete = () => {
        this.isSendingChunk = false // Reset the sending flag
        if (onComplete) onComplete()
        resolve()
      }

      if (!this.currentSession || !this.currentSession.blob) {
        const error = new Error('Transfer session not initialized')
        if (this.onError) this.onError(error)
        reject(error)
        return
      }

      // Mark the transfer as ready and wait for transfer_started
      this.currentSession.transferReady = true

      // If transfer_started was already received, start immediately
      if (this.currentSession.transferStarted) {
        this.sendFileData()
      } else {
      }
      // Otherwise wait for the transfer_started message
    })
  }

  // Start a file transfer
  async transferFile(blob, onProgress, onError, onComplete, onDownloadUrlReady) {
    // When an onDownloadUrlReady callback is provided, use the staged transfer flow
    if (onDownloadUrlReady) {
      await this.initializeSession(blob, onProgress, onError, onDownloadUrlReady)
      // Return and let the caller decide when to start the transfer
      return
    }

    // Otherwise, use the legacy one-shot transfer flow
    this.onProgress = onProgress
    this.onError = onError
    this.onComplete = onComplete
    this.isCancelled = false

    try {
      // Connect to the WebSocket server
      if (this.onProgress) {
        this.onProgress(5, 'Connecting to transfer server...')
      }

      await this.connect()

      // Send the file-creation request
      if (this.onProgress) {
        this.onProgress(10, 'Creating file session...')
      }

      const createMessage = {
        type: 'create_file',
        fileName: 'assets.bin',
        fileSize: blob.size
      }

      this.ws.send(JSON.stringify(createMessage))

      // Save the blob reference and wait for the file_created message
      this.currentSession = {
        blob: blob,
        bytesSent: 0,
        fileSize: blob.size,
        transferStarted: false,
        transferReady: true // In the legacy flow, set this to true immediately
      }

    } catch (error) {
      console.error('Transfer initialization failed:', error)
      if (this.onError) {
        this.onError(error)
      }
    }
  }

  // Cancel the transfer
  cancel() {
    this.isCancelled = true
    this.isSendingChunk = false // Reset the sending flag
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.close()
    }
  }

  // Clean up resources
  destroy() {
    this.cancel()
    this.onProgress = null
    this.onError = null
    this.onComplete = null
    this.onDownloadUrlReady = null
    this.onTransferStarted = null
    this.totalBytesSent = 0
    this.isSendingChunk = false
  }
}

export default WebSocketTransfer
