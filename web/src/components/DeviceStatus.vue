<template>
  <!-- Desktop layout -->
  <div v-if="showComponent" class="hidden lg:flex items-center space-x-4" :class="deviceStatus.isOnline ? '' : 'opacity-60'">
    <!-- Device status indicator -->
    <div class="flex items-center space-x-2">
      <!-- Online-status icon -->
      <div class="flex items-center space-x-1">
        <div
          :class="[
            'w-2 h-2 rounded-full',
            deviceStatus.isOnline ? 'bg-green-500' : 'bg-gray-400'
          ]"
        ></div>
        <span :class="[
          'text-sm font-medium',
          deviceStatus.isOnline ? 'text-gray-700' : 'text-gray-500'
        ]">
          {{ deviceStatus.isOnline ? $t('device.online') : $t('device.offline') }}
        </span>
      </div>

      <!-- Network status -->
      <div v-if="deviceStatus.isOnline && deviceInfo.network" class="flex items-center space-x-1">
        <!-- Wi-Fi icon -->
        <WifiIcon v-if="deviceInfo.network.type === 'wifi'" color="text-blue-500" />
        <!-- 4G signal icon -->
        <Signal4GIcon v-else-if="deviceInfo.network.type === '4g'" />
        <span class="text-xs text-gray-500">{{ getSignalDisplayText(deviceInfo.network.signal, t) }}</span>
      </div>
    </div>

    <!-- Device details -->
    <div v-if="deviceStatus.isOnline" class="flex items-center space-x-4 text-sm text-gray-600">
      <!-- Chip info -->
      <div v-if="deviceInfo.chip" class="flex items-center space-x-1">
        <ChipIcon />
        <span>{{ deviceInfo.chip.model }}</span>
      </div>

      <!-- Flash size -->
      <div v-if="deviceInfo.flash" class="flex items-center space-x-1">
        <FlashIcon />
        <span>{{ deviceInfo.flash.size }}</span>
      </div>

      <!-- Board info -->
      <div v-if="deviceInfo.board" class="flex items-center space-x-1">
        <BoardIcon />
        <span>{{ deviceInfo.board.model }}</span>
      </div>

      <!-- Screen resolution -->
      <div v-if="deviceInfo.screen" class="flex items-center space-x-1">
        <ScreenIcon />
        <span>{{ deviceInfo.screen.resolution }}</span>
      </div>
    </div>

  </div>

  <!-- Mobile layout -->
  <div v-if="showComponent" class="lg:hidden flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
    <!-- Header status bar -->
    <div class="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
      <div class="flex items-center space-x-2">
        <div
          :class="[
            'w-2.5 h-2.5 rounded-full',
            deviceStatus.isOnline ? 'bg-green-500' : 'bg-red-400'
          ]"
        ></div>
        <span :class="[
          'text-sm font-medium',
          deviceStatus.isOnline ? 'text-gray-800' : 'text-gray-600'
        ]">
          {{ deviceStatus.isOnline ? $t('device.online') : $t('device.offline') }}
        </span>
      </div>

      <!-- Network status -->
      <div v-if="deviceStatus.isOnline && deviceInfo.network" class="flex items-center space-x-1">
        <WifiIcon v-if="deviceInfo.network.type === 'wifi'" color="text-blue-500" />
        <Signal4GIcon v-else-if="deviceInfo.network.type === '4g'" />
        <span class="text-xs font-medium text-gray-600">{{ getSignalDisplayText(deviceInfo.network.signal, t) }}</span>
      </div>
    </div>

    <!-- Device info area -->
    <div v-if="deviceStatus.isOnline" class="px-4 py-3">
      <div class="grid grid-cols-1 gap-2.5">
        <!-- Row 1: chip and board -->
        <div class="flex justify-between items-center py-1.5 border-b border-gray-100">
          <div v-if="deviceInfo.chip" class="flex items-center space-x-2 flex-1">
            <ChipIcon class="flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-500 leading-tight">{{ $t('device.chip') }}</div>
              <div class="text-sm text-gray-800 font-medium truncate">{{ deviceInfo.chip.model }}</div>
            </div>
          </div>

          <div v-if="deviceInfo.board" class="flex items-center space-x-2 flex-1 ml-3">
            <BoardIcon class="flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-500 leading-tight">{{ $t('device.board') }}</div>
              <div class="text-sm text-gray-800 font-medium truncate">{{ deviceInfo.board.model }}</div>
            </div>
          </div>
        </div>

        <!-- Row 2: flash and screen -->
        <div class="flex justify-between items-center py-1.5">
          <div v-if="deviceInfo.flash" class="flex items-center space-x-2 flex-1">
            <FlashIcon class="flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-500 leading-tight">{{ $t('device.flash') }}</div>
              <div class="text-sm text-gray-800 font-medium">{{ deviceInfo.flash.size }}</div>
            </div>
          </div>

          <div v-if="deviceInfo.screen" class="flex items-center space-x-2 flex-1 ml-3">
            <ScreenIcon class="flex-shrink-0" />
            <div class="min-w-0 flex-1">
              <div class="text-xs text-gray-500 leading-tight">{{ $t('device.screen') }}</div>
              <div class="text-sm text-gray-800 font-medium">{{ deviceInfo.screen.resolution }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup>
import { computed, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDeviceStatus } from '@/composables/useDeviceStatus'
import { WifiIcon, Signal4GIcon, ChipIcon, FlashIcon, BoardIcon, ScreenIcon } from '@/components/icons'

const { t } = useI18n()

// Use the shared device status
const {
  deviceStatus,
  deviceInfo,
  hasToken,
  initializeDeviceStatus,
  cleanupDeviceStatus,
  getSignalDisplayText
} = useDeviceStatus()

// Show the component only when a token is present
const showComponent = computed(() => hasToken.value)

// Initialize the component
onMounted(() => {
  initializeDeviceStatus()
})

// Clean up resources
onUnmounted(() => {
  cleanupDeviceStatus()
})
</script>
