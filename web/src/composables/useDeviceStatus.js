import { ref, computed, onMounted, onUnmounted } from 'vue'

// Globally shared device status
const deviceStatus = ref({
  isOnline: false,
  error: '',
  lastCheck: null
})

const deviceInfo = ref({
  chip: null,
  board: null,
  firmware: null,
  flash: null,
  assetsPartition: null,
  network: null,
  screen: null
})

const token = ref('')
const isChecking = ref(false)
const retryTimer = ref(null)

// Get URL parameter
const getUrlParameter = (name) => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get(name)
}

// Call an MCP tool
const callMcpTool = async (toolName, params = {}) => {
  if (!token.value) {
    throw new Error('Authentication token not found')
  }

  const response = await fetch('/api/messaging/device/tools/call', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token.value}`
    },
    body: JSON.stringify({
      name: toolName,
      arguments: params
    })
  })

  if (response.ok) {
    const result = await response.json()
    return result
  } else {
    const errorText = await response.text()
    console.error(`MCP tool ${toolName} failed:`, response.status, errorText)
    
    // Parse error message
    let errorMessage = `Failed to call ${toolName}`
    try {
      const errorData = JSON.parse(errorText)
      if (errorData.message) {
        errorMessage = errorData.message
      }
    } catch (e) {
      // If parsing fails, use the HTTP status code
      errorMessage = `${errorMessage}: HTTP ${response.status}`
    }
    
    throw new Error(errorMessage)
  }
}

// Fetch detailed device information
const fetchDeviceInfo = async () => {
  try {
    // Fetch all device information concurrently
    const [systemInfoResponse, deviceStateResponse, screenInfoResponse] = await Promise.allSettled([
      callMcpTool('self.get_system_info'),
      callMcpTool('self.get_device_status'),
      callMcpTool('self.screen.get_info')
    ])

    // Handle system info
    if (systemInfoResponse.status === 'fulfilled' && systemInfoResponse.value) {
      const data = systemInfoResponse.value.data || systemInfoResponse.value

      deviceInfo.value.chip = { model: data.chip_model_name || 'Unknown' }
      deviceInfo.value.board = { model: data.board?.name || 'Unknown' }
      deviceInfo.value.firmware = { version: data.application?.version || 'Unknown' }

      // Get flash size
      if (data.flash_size) {
        const sizeInMB = Math.round(data.flash_size / 1024 / 1024)
        deviceInfo.value.flash = { size: `${sizeInMB}MB` }
      } else {
        deviceInfo.value.flash = { size: 'Unknown' }
      }

      // Get assets partition size
      if (data.partition_table) {
        const assetsPartition = data.partition_table.find(p => p.label === 'assets')
        if (assetsPartition) {
          deviceInfo.value.assetsPartition = { 
            size: assetsPartition.size,
            sizeFormatted: `${Math.round(assetsPartition.size / 1024 / 1024)}MB`
          }
        } else {
          deviceInfo.value.assetsPartition = null
        }
      } else {
        deviceInfo.value.assetsPartition = null
      }
    } else {
      console.warn('Failed to fetch system info:', systemInfoResponse.reason || systemInfoResponse.value)
      deviceInfo.value.chip = { model: 'Unknown' }
      deviceInfo.value.board = { model: 'Unknown' }
      deviceInfo.value.firmware = { version: 'Unknown' }
      deviceInfo.value.flash = { size: 'Unknown' }
      deviceInfo.value.assetsPartition = null
    }

    // Handle device status info
    if (deviceStateResponse.status === 'fulfilled' && deviceStateResponse.value) {
      const data = deviceStateResponse.value.data || deviceStateResponse.value

      deviceInfo.value.network = {
        type: data.network?.type || 'unknown',
        signal: data.network?.signal || 'Unknown'
      }
    } else {
      console.warn('Failed to fetch device status:', deviceStateResponse.reason || deviceStateResponse.value)
      deviceInfo.value.network = { type: 'unknown', signal: 'Unknown' }
    }

    // Handle screen info
    if (screenInfoResponse.status === 'fulfilled' && screenInfoResponse.value) {
      const data = screenInfoResponse.value.data || screenInfoResponse.value

      deviceInfo.value.screen = {
        resolution: `${data.width || 0}x${data.height || 0}`
      }
    } else {
      console.warn('Failed to fetch screen info:', screenInfoResponse.reason || screenInfoResponse.value)
      deviceInfo.value.screen = { resolution: 'Unknown' }
    }
  } catch (error) {
    console.error('Error while fetching device info:', error)
  }
}

// Check whether the device is online
const checkDeviceStatus = async () => {
  if (isChecking.value || !token.value) return

  isChecking.value = true
  try {
    const response = await fetch('/api/messaging/device/tools/list', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token.value}`
      }
    })

    if (response.ok) {
      deviceStatus.value.isOnline = true
      deviceStatus.value.error = ''
      deviceStatus.value.lastCheck = new Date()

      // Fetch detailed device information
      await fetchDeviceInfo()
    } else {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`)
    }
  } catch (error) {
    deviceStatus.value.isOnline = false
    deviceStatus.value.error = ''
    deviceStatus.value.lastCheck = new Date()

    // Retry after 30 seconds
    if (retryTimer.value) {
      clearTimeout(retryTimer.value)
    }
    retryTimer.value = setTimeout(checkDeviceStatus, 30000)
  } finally {
    isChecking.value = false
  }
}

// Format signal strength display text (i18n is now handled in components)
const getSignalDisplayText = (signal, t) => {
  if (!signal) return t('device.signal.unknown')

  switch (signal.toLowerCase()) {
    case 'strong':
      return t('device.signal.strong')
    case 'medium':
      return t('device.signal.medium')
    case 'weak':
      return t('device.signal.weak')
    case 'none':
      return t('device.signal.none')
    default:
      return signal
  }
}

// Initialize device status monitoring
const initializeDeviceStatus = () => {
  token.value = getUrlParameter('token')
  if (token.value) {
    checkDeviceStatus()
  }
}

// Clean up resources
const cleanupDeviceStatus = () => {
  if (retryTimer.value) {
    clearTimeout(retryTimer.value)
    retryTimer.value = null
  }
}

// Manually refresh device status
const refreshDeviceStatus = async () => {
  await checkDeviceStatus()
}

/**
 * Device status composable
 * Shares device status and device info across the entire app
 */
export function useDeviceStatus() {
  // Computed properties
  const hasToken = computed(() => !!token.value)
  const isDeviceOnline = computed(() => deviceStatus.value.isOnline)

  return {
    // State
    deviceStatus,
    deviceInfo,
    isChecking,
    hasToken,
    isDeviceOnline,

    // Methods
    initializeDeviceStatus,
    cleanupDeviceStatus,
    refreshDeviceStatus,
    checkDeviceStatus,
    callMcpTool,
    getSignalDisplayText
  }
}

