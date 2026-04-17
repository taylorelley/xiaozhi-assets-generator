# Composables usage

## useDeviceStatus

A composable that shares device status and device information across the entire app.

### Features

- Global sharing: every component can access the same device status
- Automatic detection: detects the device's online status and retries periodically
- Detailed info: exposes chip, board, firmware, partition, network, and screen info
- MCP tools: provides a convenient method for invoking MCP tools

### Basic usage

```javascript
import { useDeviceStatus } from '@/composables/useDeviceStatus'

export default {
  setup() {
    const {
      deviceStatus,      // Device online status
      deviceInfo,        // Detailed device info
      isDeviceOnline,    // Whether the device is online (computed)
      hasToken,          // Whether a token is present (computed)
      refreshDeviceStatus,  // Manually refresh status
      callMcpTool        // Invoke an MCP tool
    } = useDeviceStatus()

    return {
      deviceStatus,
      deviceInfo,
      isDeviceOnline,
      hasToken
    }
  }
}
```

### Example use in HomePage.vue

```vue
<template>
  <div>
    <!-- Show device info -->
    <div v-if="isDeviceOnline">
      <h2>Device connected</h2>
      <p>Chip model: {{ deviceInfo.chip?.model }}</p>
      <p>Board: {{ deviceInfo.board?.model }}</p>
      <p>Flash size: {{ deviceInfo.flash?.size }}</p>
      <p>Assets partition: {{ deviceInfo.assetsPartition?.sizeFormatted }}</p>
      <p>Screen resolution: {{ deviceInfo.screen?.resolution }}</p>
    </div>

    <div v-else>
      <p>Device offline</p>
    </div>

    <!-- Manual refresh button -->
    <button @click="refreshDeviceStatus">Refresh device status</button>
  </div>
</template>

<script setup>
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const {
  deviceStatus,
  deviceInfo,
  isDeviceOnline,
  refreshDeviceStatus
} = useDeviceStatus()
</script>
```

### Usage in any component

```vue
<script setup>
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const { deviceInfo, isDeviceOnline } = useDeviceStatus()

// Adjust UI based on device info
const displaySize = computed(() => {
  if (!deviceInfo.value.screen) return { width: 320, height: 240 }
  const [width, height] = deviceInfo.value.screen.resolution.split('x')
  return { width: parseInt(width), height: parseInt(height) }
})
</script>
```

### Invoke MCP tools

```javascript
import { useDeviceStatus } from '@/composables/useDeviceStatus'

const { callMcpTool } = useDeviceStatus()

// Invoke a tool without parameters
const systemInfo = await callMcpTool('self.get_system_info')

// Invoke a tool with parameters
const result = await callMcpTool('self.assets.set_download_url', {
  url: 'https://example.com/download'
})
```

### Available state and methods

#### State (refs)

- `deviceStatus`: Device status object
  - `isOnline`: Whether the device is online
  - `error`: Error message
  - `lastCheck`: Last check timestamp

- `deviceInfo`: Device info object
  - `chip`: { model: string }
  - `board`: { model: string }
  - `firmware`: { version: string }
  - `flash`: { size: string }  // Total flash size
  - `assetsPartition`: { size: number, sizeFormatted: string }  // Assets partition size (bytes + formatted text)
  - `network`: { type: string, signal: string }
  - `screen`: { resolution: string }

- `isChecking`: Whether a status check is currently running

#### Computed properties

- `hasToken`: Whether an auth token is present
- `isDeviceOnline`: Whether the device is online

#### Methods

- `initializeDeviceStatus()`: Initialize device status monitoring
- `cleanupDeviceStatus()`: Release resources
- `refreshDeviceStatus()`: Manually refresh device status
- `checkDeviceStatus()`: Check device status
- `callMcpTool(toolName, params)`: Invoke an MCP tool
- `getSignalDisplayText(signal)`: Format the signal-strength display text

### Notes

1. Device status is detected automatically and retries every 30 seconds when offline
2. All components share the same device status; changes affect every consumer
3. Components only need to call `useDeviceStatus()` to access the global state - no manual initialization required
4. `DeviceStatus.vue` handles initialization and cleanup automatically
