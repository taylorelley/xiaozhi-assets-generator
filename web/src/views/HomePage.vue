<template>
  <div>
    <!-- Config status notification (floating notice at bottom-right) -->
    <div
      v-if="hasStoredConfig"
      class="fixed bottom-4 right-4 z-50 bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-lg transition-opacity duration-300 min-w-[300px]"
      @mouseenter="resetAutoHideTimer"
    >
      <div class="flex items-center justify-between mb-2">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-blue-500 mr-2" fill="currentColor" viewBox="0 0 20 20">
            <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"></path>
          </svg>
          <span class="text-blue-800 font-medium">{{ $t('configNotice.title') }}</span>
        </div>
        <button 
          @click="closeConfigNotice"
          class="text-gray-500 hover:text-gray-700"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
      </div>
      <p class="text-blue-600 text-sm mb-3">
        {{ $t('configNotice.message') }}
      </p>
      <div class="flex justify-end space-x-2">
        <button 
          @click="confirmReset"
          class="px-3 py-1 text-sm text-red-600 hover:text-red-800 font-medium"
        >
          {{ $t('configNotice.restart') }}
        </button>
      </div>
    </div>

    <!-- Step Indicator -->
    <div class="flex items-center justify-center mb-8">
      <div v-for="(step, index) in steps" :key="index" class="flex items-center">
        <div class="flex flex-col items-center">
          <div :class="getStepClass(index)">
            {{ index + 1 }}
          </div>
          <span class="text-sm mt-2 text-gray-600">{{ $t(step.titleKey) }}</span>
        </div>
        <div v-if="index < steps.length - 1" class="w-16 h-0.5 bg-gray-300 mx-4"></div>
      </div>
    </div>

    <!-- Step Content -->
    <div class="bg-white rounded-lg shadow-sm border p-6">
      <ChipConfig 
        v-if="currentStep === 0"
        v-model="config.chip"
        @next="nextStep"
      />
      
      <ThemeDesign 
        v-if="currentStep === 1"
        v-model="config.theme"
        :chipModel="config.chip.model"
        :activeTab="activeThemeTab"
        @next="nextStep"
        @prev="prevStep"
        @tabChange="handleThemeTabChange"
      />
      
      <GenerateSummary 
        v-if="currentStep === 2"
        :config="config"
        @generate="handleGenerate"
        @prev="prevStep"
      />
    </div>

    <!-- Generate Modal -->
    <GenerateModal
      v-if="showGenerateModal"
      :config="config"
      @close="showGenerateModal = false"
      @generate="handleModalGenerate"
      @startFlash="handleStartFlash"
      @cancelFlash="handleCancelFlash"
    />

    <!-- Reset Confirmation Modal -->
    <!-- Reset confirmation dialog removed -->
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import ChipConfig from '@/components/ChipConfig.vue'
import ThemeDesign from '@/components/ThemeDesign.vue'
import GenerateSummary from '@/components/GenerateSummary.vue'
import GenerateModal from '@/components/GenerateModal.vue'
import configStorage from '@/utils/ConfigStorage.js'
import AssetsBuilder from '@/utils/AssetsBuilder.js'
import WebSocketTransfer from '@/utils/WebSocketTransfer.js'
import { useDeviceStatus } from '@/composables/useDeviceStatus.js'

// Use the shared device status
const {
  callMcpTool: callDeviceMcpTool
} = useDeviceStatus()

// Use i18n
const { t } = useI18n()

const currentStep = ref(0)
const showGenerateModal = ref(false)
const activeThemeTab = ref('wakeword') // Preserve the tab state of the theme design page

// Storage-related state
const hasStoredConfig = ref(false) // Whether config was restored from storage
const isAutoSaveEnabled = ref(false) // Whether auto-save is enabled
const isResetting = ref(false)
const isLoading = ref(true)
const assetsBuilder = new AssetsBuilder()
const autoHideTimer = ref(null) // Auto-hide timer
const webSocketTransfer = ref(null) // WebSocket transfer instance

// Note: since we're outside the setup function, we need to define a helper here to get translations,
// or move this into the setup function
const steps = [
  { titleKey: 'steps.chip', key: 'chip' },
  { titleKey: 'steps.theme', key: 'theme' },
  { titleKey: 'steps.generate', key: 'generate' }
]

const config = ref({
  chip: {
    model: '',
    display: {
      width: 320,
      height: 240,
      color: 'RGB565'
    }
  },
  theme: {
    wakeword: {
      type: 'none',
      preset: '',
      custom: {
        name: '',
        command: '',
        threshold: 20,
        duration: 3000,
        model: 'mn6_en'
      }
    },
    font: {
      type: 'none',
      preset: '',
      hide_subtitle: false,
      custom: {
        file: null,
        size: 20,
        bpp: 4,
        charset: 'deepseek'
      }
    },
    emoji: {
      type: 'none',
      preset: '',
      custom: {
        size: { width: 160, height: 120 },
        images: {}
      }
    },
    skin: {
      light: {
        backgroundType: 'color',
        backgroundColor: '#ffffff',
        textColor: '#000000',
        backgroundImage: null
      },
      dark: {
        backgroundType: 'color', 
        backgroundColor: '#121212',
        textColor: '#ffffff',
        backgroundImage: null
      }
    }
  }
})

const canGenerate = computed(() => {
  return config.value.chip.model && 
         (config.value.theme.font.type === 'none' || config.value.theme.font.preset || config.value.theme.font.custom.file)
})

const getStepClass = (index) => {
  if (index < currentStep.value) return 'step-indicator completed'
  if (index === currentStep.value) return 'step-indicator active'
  return 'step-indicator inactive'
}

const nextStep = async () => {
  if (currentStep.value < steps.length - 1) {
    currentStep.value++
    
    // Enable auto-save (if not already enabled)
    if (!isAutoSaveEnabled.value) {
      isAutoSaveEnabled.value = true
      await saveConfigToStorage()
    }
  }
}

const prevStep = () => {
  if (currentStep.value > 0) {
    currentStep.value--
  }
}

const handleGenerate = () => {
  showGenerateModal.value = true
}

const handleModalGenerate = async (selectedItems) => {
  // TODO: implement actual generation logic
}

// Get the token from URL query parameters
const getToken = () => {
  const urlParams = new URLSearchParams(window.location.search)
  return urlParams.get('token')
}

// Call an MCP tool (using the shared method)
const callMcpTool = async (toolName, params = {}) => {
  return await callDeviceMcpTool(toolName, params)
}

// Handle the start of online flashing
const handleStartFlash = async (flashData) => {
  const { blob, onProgress, onComplete, onError } = flashData

  try {
    const token = getToken()
    if (!token) {
      throw new Error(t('flashProgress.authTokenMissing'))
    }

    // Step 1: check device status
    onProgress(5, t('flashProgress.checkingDeviceStatus'))
    try {
      const deviceStatus = await callMcpTool('self.get_device_status')
      if (!deviceStatus) {
        throw new Error(t('flashProgress.deviceOfflineOrUnresponsive', { error: t('flashProgress.unableToGetDeviceStatus') }))
      }
    } catch (error) {
      console.error('Failed to check device status:', error)
      onError(t('flashProgress.deviceOfflineOrUnresponsive', { error: error.message }))
      return
    }

    // Step 2: initialize WebSocket transfer and obtain the download URL
    onProgress(15, t('flashProgress.initializingTransferService'))
    webSocketTransfer.value = new WebSocketTransfer(token)

    // Create a Promise that resolves once the download URL is ready
    let downloadUrlReady = null
    const downloadUrlPromise = new Promise((resolve, reject) => {
      downloadUrlReady = resolve
    })

    // Create a Promise that resolves when the transfer_started event is received
    let transferStartedResolver = null
    const transferStartedPromise = new Promise((resolve, reject) => {
      transferStartedResolver = resolve
    })

    // Initialize the WebSocket session (only establishes connection and obtains URL)
    webSocketTransfer.value.onTransferStarted = () => {
      // When transfer_started is received, resolve the waiting Promise
      if (transferStartedResolver) {
        transferStartedResolver()
        transferStartedResolver = null
      }
    }

    await webSocketTransfer.value.initializeSession(
      blob,
      (progress, step) => {
        // Initialization progress: 15-30
        onProgress(15 + progress * 0.75, step)
      },
      (error) => {
        console.error('WebSocket initialization failed:', error)
        onError(t('flashProgress.initializeTransferFailed', { error: error.message }))
      },
      (downloadUrl) => {
        downloadUrlReady(downloadUrl)
      }
    )

    // Wait for the download URL to be ready
    const downloadUrl = await downloadUrlPromise

    // Step 3: set the device's download URL
    onProgress(30, t('flashProgress.settingDeviceDownloadUrl'))
    try {
      await callMcpTool('self.assets.set_download_url', {
        url: downloadUrl
      })
    } catch (error) {
      console.error('Failed to set download URL:', error)
      onError(t('flashProgress.setDownloadUrlFailed', { error: error.message }))
      return
    }

    // Step 4: reboot the device
    onProgress(40, t('flashProgress.rebootingDevice'))
    // The reboot command has no return value; no need to await, just call
    callMcpTool('self.reboot').catch(error => {
      console.warn('reboot command warning (device may have already rebooted):', error)
      // Continue the flow even if reboot fails, because the device may already be rebooting
    })

    // Step 5: wait for device reboot and HTTP connection (via transfer_started event)
    onProgress(50, t('flashProgress.waitingForDeviceReboot'))

    // Wait for the transfer_started event with a 60-second timeout
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(t('flashProgress.deviceRebootTimeout'))), 60000)
    })

    await Promise.race([transferStartedPromise, timeoutPromise])

    // Step 6: start the actual file transfer
    onProgress(60, t('flashProgress.startingFileTransfer'))

    // Device is ready; start transfer directly (transfer_started received, sendFileData runs immediately)
    await webSocketTransfer.value.startTransfer(
      (progress, step) => {
        // File transfer progress: 60-100
        const adjustedProgress = 60 + (progress * 0.4)
        onProgress(Math.round(adjustedProgress), step)
      },
      (error) => {
        onError(t('flashProgress.onlineFlashFailed', { error: error.message }))
      },
      () => {
        onComplete()
      }
    )

    // Clear callback reference
    webSocketTransfer.value.onTransferStarted = null

  } catch (error) {
    console.error('Online flashing failed:', error)
    onError(t('flashProgress.onlineFlashFailed', { error: error.message }))
  }
}

// Handle flash cancellation
const handleCancelFlash = () => {
  if (webSocketTransfer.value) {
    webSocketTransfer.value.cancel()
    webSocketTransfer.value.destroy()
    webSocketTransfer.value = null
  }
}

const handleThemeTabChange = (tabId) => {
  activeThemeTab.value = tabId
}

// Load config from storage
const loadConfigFromStorage = async () => {
  try {
    isLoading.value = true
    const storedData = await configStorage.loadConfig()

    if (storedData) {
      // Restore config (but don't restore step/tab; always start at step one)
      config.value = storedData.config
      // Always start at the first step
      currentStep.value = 0
      activeThemeTab.value = 'wakeword'
      hasStoredConfig.value = true // Show the "Saved configuration detected" notice
      isAutoSaveEnabled.value = true // Enable auto-save

      // Check and clear legacy emoji data structure (incompatible with old versions)
      await cleanupLegacyEmojiData()

      // Clear any previous timer
      if (autoHideTimer.value) {
        clearTimeout(autoHideTimer.value)
      }

      // Auto-hide the notice after 5 seconds
      autoHideTimer.value = setTimeout(() => {
        hasStoredConfig.value = false
      }, 5000)

      // Set AssetsBuilder config (non-strict mode: allow restoring files first, then validating)
      assetsBuilder.setConfig(config.value, { strict: false })
      await assetsBuilder.restoreAllResourcesFromStorage(config.value)

      // Trigger a shallow copy to refresh references, avoiding createObjectURL on placeholder values during render
      try {
        const emojiCustom = config.value?.theme?.emoji?.custom || {}
        const images = emojiCustom.images || {}
        const fileMap = emojiCustom.fileMap || {}
        const emotionMap = emojiCustom.emotionMap || {}
        
        config.value = {
          ...config.value,
          theme: {
            ...config.value.theme,
            emoji: {
              ...config.value.theme.emoji,
              custom: {
                ...emojiCustom,
                images: { ...images },
                fileMap: { ...fileMap },
                emotionMap: { ...emotionMap }
              }
            }
          }
        }
      } catch (e) {
        console.error('Failed to refresh emoji config references:', e)
      }
      
    } else {
      hasStoredConfig.value = false
      isAutoSaveEnabled.value = false
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    hasStoredConfig.value = false
    isAutoSaveEnabled.value = false
  } finally {
    isLoading.value = false
  }
}

// 清理旧版本表情数据（强制使用新的 hash 结构）
const cleanupLegacyEmojiData = async () => {
  try {
    const emojiCustom = config.value?.theme?.emoji?.custom
    if (!emojiCustom) return
    
    // 检查是否使用旧结构（有 images 但没有 fileMap 和 emotionMap）
    const hasImages = Object.keys(emojiCustom.images || {}).length > 0
    const hasFileMap = emojiCustom.fileMap && Object.keys(emojiCustom.fileMap).length > 0
    const hasEmotionMap = emojiCustom.emotionMap && Object.keys(emojiCustom.emotionMap).length > 0
    const hasOldStructure = hasImages && (!hasFileMap || !hasEmotionMap)
    
    if (hasOldStructure) {
      console.warn('⚠️ 检测到旧版本的表情数据结构（不兼容）')
      console.log('正在清理旧数据...')
      
      // 清除存储中的旧表情文件
      try {
        const oldEmotions = Object.keys(emojiCustom.images || {})
        for (const emotion of oldEmotions) {
          await configStorage.deleteFile(`emoji_${emotion}`)
        }
        console.log(`已删除 ${oldEmotions.length} 个旧表情文件`)
      } catch (error) {
        console.warn('清理旧表情文件时出错:', error)
      }
      
      // 重置为新的空结构
      config.value.theme.emoji.custom = {
        size: emojiCustom.size || { width: 64, height: 64 },
        images: {},
        fileMap: {},
        emotionMap: {}
      }
      
      // 如果当前在使用自定义表情，重置为未选择状态
      if (config.value.theme.emoji.type === 'custom') {
        config.value.theme.emoji.type = ''
        console.log('已重置表情类型，请重新选择')
      }
      
      // 立即保存清理后的配置
      await saveConfigToStorage()
      
      console.log('✅ 旧表情数据已完全清除')
      
      // 友好的用户提示
      setTimeout(() => {
        alert('检测到旧版本的表情数据结构已被清除。\n\n新版本使用文件去重技术，可以节省存储空间。\n\n请重新上传自定义表情图片。')
      }, 500)
    }
  } catch (error) {
    console.error('清理旧表情数据时出错:', error)
  }
}

// 保存配置到存储
const saveConfigToStorage = async () => {
  try {
    await configStorage.saveConfig(config.value)
  } catch (error) {
    console.error('保存配置失败:', error)
  }
}

// 确认重新开始
const confirmReset = async () => {
  try {
    isResetting.value = true
    
    // 清理 AssetsBuilder 的存储数据
    await assetsBuilder.clearAllStoredData()
    
    // 保存当前的芯片配置
    const currentChipConfig = {
      model: config.value.chip.model,
      display: { ...config.value.chip.display }
    }
    
    // Reset config to defaults while preserving the chip configuration
    config.value = {
      chip: currentChipConfig,
      theme: {
        wakeword: {
          type: 'none',
          preset: '',
          custom: {
            name: '',
            command: '',
            threshold: 20,
            model: 'mn6_en'
          }
        },
        font: {
          type: 'none',
          preset: '',
          hide_subtitle: false,
          custom: {
            file: null,
            size: 20,
            bpp: 4,
            charset: 'deepseek'
          }
        },
        emoji: {
          type: 'none',
          preset: '',
          custom: {
            size: { width: 64, height: 64 },
            images: {}
          }
        },
        skin: {
          light: {
            backgroundType: 'color',
            backgroundColor: '#ffffff',
            textColor: '#000000',
            backgroundImage: null
          },
          dark: {
            backgroundType: 'color', 
            backgroundColor: '#121212',
            textColor: '#ffffff',
            backgroundImage: null
          }
        }
      }
    }
    
    // 重置步骤和状态
    currentStep.value = 0
    activeThemeTab.value = 'wakeword'
    hasStoredConfig.value = false
    isAutoSaveEnabled.value = false
    
  } catch (error) {
    console.error('重置配置失败:', error)
    alert(t('errors.resetFailed'))
  } finally {
    isResetting.value = false
  }
}

// 监听配置变化，自动保存
watch(config, async (newConfig) => {
  if (!isLoading.value && isAutoSaveEnabled.value) {
    await saveConfigToStorage()
  }
}, { deep: true })

// 页面加载时初始化
onMounted(async () => {
  await configStorage.initialize()
  await loadConfigFromStorage()
})

// 组件卸载时清除定时器
onUnmounted(() => {
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
  }
})

// 修改关闭按钮逻辑
const closeConfigNotice = () => {
  hasStoredConfig.value = false
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
  }
}

// 重置自动隐藏定时器（鼠标悬停时调用）
const resetAutoHideTimer = () => {
  // 清除之前的定时器
  if (autoHideTimer.value) {
    clearTimeout(autoHideTimer.value)
  }

  // 设置新的5秒定时器
  autoHideTimer.value = setTimeout(() => {
    hasStoredConfig.value = false
  }, 5000)
}
</script>

