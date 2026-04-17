<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('generateSummary.title') }}</h2>
      <p class="text-gray-600 mb-6">{{ $t('generateSummary.description') }}</p>
    </div>

    <!-- Device preview area -->
    <div class="flex flex-col lg:flex-row gap-8">
      <!-- Device simulator -->
      <div class="flex-1">
        <h3 class="text-lg font-medium text-gray-900 mb-4">{{ $t('generateSummary.devicePreview') }}</h3>
        <div class="bg-gray-100 p-4 rounded-lg">
          <div class="max-w-full overflow-auto flex justify-center">
            <!-- Device bezel -->
            <div class="bg-gray-800 p-6 rounded-2xl shadow-2xl inline-block">
              <div class="bg-gray-900 p-2 rounded-xl">
                <!-- Screen area -->
                <div 
                  :style="getScreenStyle()"
                  class="relative rounded-lg overflow-hidden border-2 border-gray-700 flex flex-col items-center justify-center"
                >
                <!-- Background layer -->
                <div
                  :style="getBackgroundStyle()"
                  class="absolute inset-0"
                ></div>

                <!-- Content layer -->
                <div class="relative z-10 flex flex-col items-center justify-center p-4 text-center">
                  <!-- Emoji display -->
                  <div class="mb-4">
                    <div v-if="currentEmoji && availableEmotions.length > 0" class="emoji-container">
                      <img 
                        v-if="currentEmojiImage"
                        :src="currentEmojiImage" 
                        :alt="currentEmoji"
                        :style="getEmojiStyle()"
                        class="emoji-image"
                      />
                      <div 
                        v-else
                        :style="getEmojiStyle()"
                        class="emoji-fallback bg-gray-200 rounded-full flex items-center justify-center text-2xl"
                      >
                        {{ getEmojiCharacter(currentEmoji) }}
                      </div>
                    </div>
                    <div v-else class="emoji-container">
                      <div 
                        :style="getEmojiStyle()"
                        class="emoji-placeholder flex items-center justify-center text-gray-400 border-2 border-dashed border-gray-300 rounded bg-gray-50"
                      >
                        <div class="text-center">
                          <div class="text-sm">{{ config.theme.emoji.type === 'none' ? '📦' : '😕' }}</div>
                          <div class="text-xs">{{ config.theme.emoji.type === 'none' ? $t('emojiConfig.noEmojiPack') : $t('generateSummary.noEmotionConfigured') }}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <!-- Text display -->
                  <div 
                    v-if="!config.theme.font.hide_subtitle"
                    :style="getTextStyle()"
                    class="text-message max-w-full break-words relative"
                  >
                    <div v-if="!fontLoaded" class="absolute inset-0 flex items-center justify-center">
                      <div class="animate-pulse text-gray-400 text-xs">{{ $t('generateSummary.fontLoading') }}</div>
                    </div>
                    <div :class="{ 'opacity-0': !fontLoaded }">
                      {{ previewText }}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            <!-- Device info -->
            <div class="mt-3 text-center text-xs text-gray-400">
              {{ config.chip.display.width }} × {{ config.chip.display.height }}
              {{ config.chip.model.toUpperCase() }}
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Control panel -->
      <div class="w-full lg:w-80">
        <h3 class="text-lg font-medium text-gray-900 mb-4">{{ $t('generateSummary.previewSettings') }}</h3>
        <div class="space-y-6 bg-white border border-gray-200 rounded-lg p-4">
          
          <!-- Preview text editor -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('generateSummary.previewText') }}</label>
            <textarea
              v-model="previewText"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows="3"
              placeholder="Hi, I'm your friend LittleWise!"
            ></textarea>
          </div>

          <!-- Emotion switcher -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('generateSummary.currentEmotion') }}</label>
            <div v-if="availableEmotions.length > 0" class="flex flex-wrap gap-2 max-h-32 overflow-y-auto justify-center">
              <button
                v-for="emotion in availableEmotions"
                :key="emotion.key"
                @click="changeEmotion(emotion.key)"
                :class="[
                  'p-2 border rounded transition-colors flex items-center justify-center',
                  currentEmoji === emotion.key 
                    ? 'border-primary-500 bg-primary-50' 
                    : 'border-gray-200 hover:border-gray-300'
                ]"
                :title="emotion.name"
                :style="{ width: getEmojiControlSize() + 'px', height: getEmojiControlSize() + 'px' }"
              >
                <div v-if="getEmotionImage(emotion.key)">
                  <img 
                    :src="getEmotionImage(emotion.key)"
                    :alt="emotion.name"
                    :style="{ width: getEmojiDisplaySize() + 'px', height: getEmojiDisplaySize() + 'px' }"
                    class="object-contain rounded"
                  />
                </div>
                <div v-else class="text-lg">{{ emotion.emoji }}</div>
              </button>
            </div>
            <div v-else class="text-center py-4 text-gray-500 bg-gray-50 rounded-lg border-2 border-dashed">
              <div class="text-2xl mb-2">{{ config.theme.emoji.type === 'none' ? '📦' : '😕' }}</div>
              <div class="text-sm">{{ config.theme.emoji.type === 'none' ? $t('emojiConfig.noEmojiPackDescription') : $t('generateSummary.configureEmojiFirst') }}</div>
            </div>
          </div>

          <!-- Theme mode switcher -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('generateSummary.themeMode') }}</label>
            <div class="flex space-x-2">
              <button
                @click="themeMode = 'light'"
                :class="[
                  'flex-1 py-2 px-3 text-sm border rounded transition-colors',
                  themeMode === 'light'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                ]"
              >
                🌞 {{ $t('generateSummary.lightMode') }}
              </button>
              <button
                @click="themeMode = 'dark'"
                :class="[
                  'flex-1 py-2 px-3 text-sm border rounded transition-colors',
                  themeMode === 'dark'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-300 hover:border-gray-400'
                ]"
              >
                🌙 {{ $t('generateSummary.darkMode') }}
              </button>
            </div>
          </div>


          <!-- Configuration summary -->
          <div class="border-t pt-4">
            <h4 class="font-medium text-gray-900 mb-2">{{ $t('generateSummary.configSummary') }}</h4>
            <div class="text-xs text-gray-600 space-y-1">
              <div v-if="config.theme.wakeword">{{ $t('generateSummary.wakeword') }} {{ getWakewordName() }}</div>
              <div class="flex items-center">
                <span>{{ $t('generateSummary.font') }} {{ getFontName() }}</span>
                <span v-if="!fontLoaded" class="ml-2 animate-pulse text-blue-500">{{ $t('generateSummary.loading') }}</span>
              </div>
              <div>{{ $t('generateSummary.emotion') }} {{ getEmojiName() }}</div>
              <div>{{ $t('generateSummary.skin') }} {{ getSkinName() }}</div>
              <div v-if="config.theme.font.hide_subtitle">{{ $t('generateSummary.hideSubtitle') }} {{ $t('common.yes') }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action buttons -->
    <div class="flex justify-between">
      <button 
        @click="$emit('prev')"
        class="bg-gray-500 hover:bg-gray-600 text-white px-6 py-2 rounded-lg font-medium transition-colors"
      >
        {{ $t('generateSummary.previous') }}
      </button>
      <button 
        @click="$emit('generate')"
        class="bg-green-500 hover:bg-green-600 text-white px-8 py-2 rounded-lg font-medium transition-colors flex items-center"
      >
        <svg class="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
        </svg>
        {{ $t('generateSummary.generate') }}
      </button>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  config: {
    type: Object,
    required: true
  }
})

defineEmits(['prev', 'generate'])

// Preview state
const previewText = ref(t('generateSummary.defaultPreviewText'))
const currentEmoji = ref('happy')
const themeMode = ref('light')
const fontLoaded = ref(false)
const loadedFontFamily = ref('')

// Emotion data
const emotionList = computed(() => [
  { key: 'neutral', name: t('generateSummary.emotions.neutral'), emoji: '😶' },
  { key: 'happy', name: t('generateSummary.emotions.happy'), emoji: '🙂' },
  { key: 'laughing', name: t('generateSummary.emotions.laughing'), emoji: '😆' },
  { key: 'funny', name: t('generateSummary.emotions.funny'), emoji: '😂' },
  { key: 'sad', name: t('generateSummary.emotions.sad'), emoji: '😔' },
  { key: 'angry', name: t('generateSummary.emotions.angry'), emoji: '😠' },
  { key: 'crying', name: t('generateSummary.emotions.crying'), emoji: '😭' },
  { key: 'loving', name: t('generateSummary.emotions.loving'), emoji: '😍' },
  { key: 'surprised', name: t('generateSummary.emotions.surprised'), emoji: '😯' },
  { key: 'thinking', name: t('generateSummary.emotions.thinking'), emoji: '🤔' },
  { key: 'cool', name: t('generateSummary.emotions.cool'), emoji: '😎' },
  { key: 'sleepy', name: t('generateSummary.emotions.sleepy'), emoji: '😴' }
])

// Available emotion list
const availableEmotions = computed(() => {
  if (props.config.theme.emoji.type === 'preset' && props.config.theme.emoji.preset) {
    return emotionList.value
  } else if (props.config.theme.emoji.type === 'custom') {
    // Show only emotions the user has uploaded
    const customImages = props.config.theme.emoji.custom.images
    return emotionList.value.filter(emotion => customImages[emotion.key])
  } else {
    // Return an empty array when no emojis are configured
    return []
  }
})

// Current emoji image
const currentEmojiImage = computed(() => {
  return getEmotionImage(currentEmoji.value)
})

// Get the screen style
const getScreenStyle = () => {
  const { width, height } = props.config.chip.display

  // Use a 1:1 pixel ratio and apply the configured dimensions directly
  return {
    width: `${width}px`,
    height: `${height}px`
  }
}

// Get the background style
const getBackgroundStyle = () => {
  const bg = props.config.theme.skin[themeMode.value]

  if (bg.backgroundType === 'image' && bg.backgroundImage) {
    try {
      // Verify that the background image is a valid file
      if (bg.backgroundImage && typeof bg.backgroundImage === 'object' && bg.backgroundImage.size) {
        return {
          backgroundImage: `url(${URL.createObjectURL(bg.backgroundImage)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }
      }
    } catch (error) {
      console.warn('Failed to load background image preview:', error)
    }
  }

  return {
    backgroundColor: bg.backgroundColor || '#ffffff'
  }
}

// Preset emoji-pack size configuration
const presetEmojiSizes = {
  'twemoji32': 32,
  'twemoji64': 64,
  'noto-emoji_64': 64,
  'noto-emoji_128': 128
}

// Get the emoji style
const getEmojiStyle = () => {
  let size = 48 // Default size

  if (props.config.theme.emoji.type === 'preset') {
    size = presetEmojiSizes[props.config.theme.emoji.preset] || 32
  } else if (props.config.theme.emoji.custom.size) {
    size = Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height)
  }

  // Use a 1:1 pixel ratio and apply the configured emoji size directly
  return {
    width: `${size}px`,
    height: `${size}px`
  }
}

// Get the text style
const getTextStyle = () => {
  let fontSize = 14

  // Adjust font size based on the font configuration
  if (props.config.theme.font.type === 'preset') {
    const fontConfig = props.config.theme.font.preset
    if (fontConfig.includes('_14_')) fontSize = 14
    else if (fontConfig.includes('_16_')) fontSize = 16
    else if (fontConfig.includes('_20_')) fontSize = 20
    else if (fontConfig.includes('_30_')) fontSize = 30
  } else if (props.config.theme.font.custom.size) {
    fontSize = props.config.theme.font.custom.size
  }

  // Use a 1:1 pixel ratio and apply the configured font size directly
  const textColor = themeMode.value === 'dark'
    ? props.config.theme.skin.dark.textColor 
    : props.config.theme.skin.light.textColor
  
  return {
    fontSize: `${fontSize}px`,
    color: textColor,
    fontFamily: getFontFamily(),
    textShadow: themeMode.value === 'dark' ? '1px 1px 2px rgba(0,0,0,0.5)' : '1px 1px 2px rgba(255,255,255,0.5)'
  }
}

// Dynamically load the font
const loadFont = async () => {
  // Clean up previously loaded fonts
  const existingStyles = document.querySelectorAll('style[data-font-preview]')
  existingStyles.forEach(style => style.remove())

  fontLoaded.value = false
  loadedFontFamily.value = ''

  try {
    if (props.config.theme.font.type === 'preset') {
      // Load the preset font
      const presetId = props.config.theme.font.preset
      let fontFamily, fontUrl

      // Pick puhui or noto based on the preset font ID
      if (presetId && presetId.startsWith('font_noto_qwen_')) {
        fontFamily = 'NotoPreview'
        fontUrl = './static/fonts/noto_qwen.ttf'
      } else {
        // Default to puhui
        fontFamily = 'PuHuiPreview'
        fontUrl = './static/fonts/puhui_deepseek.ttf'
      }
      
      const style = document.createElement('style')
      style.setAttribute('data-font-preview', 'true')
      style.textContent = `
        @font-face {
          font-family: '${fontFamily}';
          src: url('${fontUrl}') format('truetype');
          font-display: swap;
        }
      `
      document.head.appendChild(style)
      
      // Wait for the font to load
      await document.fonts.load(`16px "${fontFamily}"`)
      loadedFontFamily.value = fontFamily
      fontLoaded.value = true

    } else if (props.config.theme.font.custom.file) {
      // Load the custom font
      try {
        const fontFile = props.config.theme.font.custom.file

        // Verify that the file object is valid
        if (!fontFile || typeof fontFile !== 'object' || !fontFile.size) {
          throw new Error('Invalid font file object')
        }

        const fontFamily = 'CustomFontPreview'
        const fontUrl = URL.createObjectURL(fontFile)
        
        const style = document.createElement('style')
        style.setAttribute('data-font-preview', 'true')
        style.textContent = `
          @font-face {
            font-family: '${fontFamily}';
            src: url('${fontUrl}');
            font-display: swap;
          }
        `
        document.head.appendChild(style)
        
        // Wait for the font to load
        await document.fonts.load(`16px "${fontFamily}"`)
        loadedFontFamily.value = fontFamily
        fontLoaded.value = true
      } catch (error) {
        console.warn('Failed to load custom font preview:', error)
        // Fall back to the system default font
        loadedFontFamily.value = 'Arial, sans-serif'
        fontLoaded.value = true
      }
    } else {
      // Use the system font
      loadedFontFamily.value = 'system-ui'
      fontLoaded.value = true
    }
  } catch (error) {
    console.warn('Font loading failed:', error)
    loadedFontFamily.value = 'system-ui'
    fontLoaded.value = true
  }
}

// Get the font family
const getFontFamily = () => {
  if (fontLoaded.value && loadedFontFamily.value) {
    return `"${loadedFontFamily.value}", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
  }
  return '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
}

// Preset emoji-pack configuration
const presetEmojiFormats = {
  'twemoji32': 'png',
  'twemoji64': 'png',
  'noto-emoji_64': 'gif',
  'noto-emoji_128': 'gif'
}

// Get the image for an emotion
const getEmotionImage = (emotionKey) => {
  if (props.config.theme.emoji.type === 'preset') {
    const presetId = props.config.theme.emoji.preset
    const format = presetEmojiFormats[presetId] || 'png'
    return `./static/emojis/${presetId}/${emotionKey}.${format}`
  } else if (props.config.theme.emoji.type === 'custom' && props.config.theme.emoji.custom.images[emotionKey]) {
    try {
      const emojiFile = props.config.theme.emoji.custom.images[emotionKey]
      // Verify that the emoji file is valid
      if (emojiFile && typeof emojiFile === 'object' && emojiFile.size) {
        return URL.createObjectURL(emojiFile)
      }
    } catch (error) {
      console.warn(`Failed to load emoji preview (${emotionKey}):`, error)
    }
  }
  return null
}

// Get the emoji character glyph
const getEmojiCharacter = (emotionKey) => {
  const emotion = emotionList.value.find(e => e.key === emotionKey)
  return emotion ? emotion.emoji : '😶'
}

// Get the size of the emoji control button
const getEmojiControlSize = () => {
  if (props.config.theme.emoji.type === 'preset') {
    const baseSize = presetEmojiSizes[props.config.theme.emoji.preset] || 32
    return Math.min(baseSize + 16, 80) // Add padding and clamp the max size
  } else if (props.config.theme.emoji.custom.size) {
    const baseSize = Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height)
    return Math.min(baseSize + 16, 80) // Clamp the max size
  }
  return 48 // Default size
}

// Get the display size of the emoji image
const getEmojiDisplaySize = () => {
  if (props.config.theme.emoji.type === 'preset') {
    const size = presetEmojiSizes[props.config.theme.emoji.preset] || 32
    return Math.min(size, 64) // Clamp the display size in the control panel
  } else if (props.config.theme.emoji.custom.size) {
    return Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height, 64)
  }
  return 32 // Default size
}

// Switch to a different emotion
const changeEmotion = (emotionKey) => {
  currentEmoji.value = emotionKey
}


// Build the configuration summary displayed in step 3.
const getWakewordName = () => {
  const wakeword = props.config.theme.wakeword
  if (!wakeword || wakeword.type === 'none') return t('wakewordConfig.noWakeword')

  if (wakeword.type === 'preset') {
    const names = {
      'wn9s_hilexin': 'Hi, Espressif', 'wn9s_hiesp': 'Hi, ESP', 'wn9s_nihaoxiaozhi': 'Hello LittleWise',
      'wn9_nihaoxiaozhi_tts': 'Hello LittleWise', 'wn9_alexa': 'Alexa', 'wn9_jarvis_tts': 'Jarvis'
    }
    return names[wakeword.preset] || wakeword.preset
  }
  
  if (wakeword.type === 'custom') {
    return wakeword.custom.name || t('wakewordConfig.customWakeword')
  }
  
  return t('wakewordConfig.noWakeword')
}

const getFontName = () => {
  if (props.config.theme.font.type === 'preset') {
    // Resolve the preset font's display name via the i18n catalog.
    return t('fontConfig.presetFontNames.' + props.config.theme.font.preset) || props.config.theme.font.preset
  } else {
    const custom = props.config.theme.font.custom
    return t('generateSummary.customFont', { size: custom.size })
  }
}

const getEmojiName = () => {
  if (props.config.theme.emoji.type === 'preset' && props.config.theme.emoji.preset) {
    const presetNames = {
      'twemoji32': 'Twemoji 32×32',
      'twemoji64': 'Twemoji 64×64',
      'noto-emoji_64': 'Noto Emoji 64×64',
      'noto-emoji_128': 'Noto Emoji 128×128'
    }
    return presetNames[props.config.theme.emoji.preset] || props.config.theme.emoji.preset
  } else if (props.config.theme.emoji.type === 'custom') {
    const count = Object.keys(props.config.theme.emoji.custom.images).length
    return t('generateSummary.customEmoji', { count })
  } else if (props.config.theme.emoji.type === 'none') {
    return t('emojiConfig.noEmojiPack')
  } else {
    return t('generateSummary.notConfigured')
  }
}

const getSkinName = () => {
  const lightType = props.config.theme.skin.light.backgroundType === 'image' ? t('generateSummary.image') : t('generateSummary.color')
  const darkType = props.config.theme.skin.dark.backgroundType === 'image' ? t('generateSummary.image') : t('generateSummary.color')
  return t('generateSummary.skinLight', { type: lightType }) + '/' + t('generateSummary.skinDark', { type: darkType })
}

// Watch for font-config changes
watch(() => props.config.theme.font, () => {
  loadFont()
}, { deep: true })

// Component mount
onMounted(async () => {
  // Ensure an available emotion is selected
  if (availableEmotions.value.length > 0) {
    currentEmoji.value = availableEmotions.value[0].key
  } else {
    currentEmoji.value = ''
  }

  // Load the font
  await loadFont()
})

// Clean up fonts when the component unmounts
onUnmounted(() => {
  const existingStyles = document.querySelectorAll('style[data-font-preview]')
  existingStyles.forEach(style => style.remove())
})
</script>

<style scoped>
.emoji-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.emoji-image {
  border-radius: 8px;
  object-fit: contain;
}

.emoji-fallback {
  display: flex;
  align-items: center;
  justify-content: center;
}

.text-message {
  line-height: 1;
  word-wrap: break-word;
}
</style>