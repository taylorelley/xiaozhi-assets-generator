<template>
  <div class="space-y-6">
    <div>
      <h2 class="text-xl font-semibold text-gray-900 mb-4">{{ $t('generateSummary.title') }}</h2>
      <p class="text-gray-600 mb-6">{{ $t('generateSummary.description') }}</p>
    </div>

    <!-- 设备预览区域 -->
    <div class="flex flex-col lg:flex-row gap-8">
      <!-- 设备模拟器 -->
      <div class="flex-1">
        <h3 class="text-lg font-medium text-gray-900 mb-4">{{ $t('generateSummary.devicePreview') }}</h3>
        <div class="bg-gray-100 p-4 rounded-lg">
          <div class="max-w-full overflow-auto flex justify-center">
            <!-- 设备外框 -->
            <div class="bg-gray-800 p-6 rounded-2xl shadow-2xl inline-block">
              <div class="bg-gray-900 p-2 rounded-xl">
                <!-- 屏幕区域 -->
                <div 
                  :style="getScreenStyle()"
                  class="relative rounded-lg overflow-hidden border-2 border-gray-700 flex flex-col items-center justify-center"
                >
                <!-- 背景层 -->
                <div 
                  :style="getBackgroundStyle()"
                  class="absolute inset-0"
                ></div>
                
                <!-- 内容层 -->
                <div class="relative z-10 flex flex-col items-center justify-center p-4 text-center">
                  <!-- 表情显示 -->
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
                  
                  <!-- 文字显示 -->
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
            
            <!-- 设备信息 -->
            <div class="mt-3 text-center text-xs text-gray-400">
              {{ config.chip.display.width }} × {{ config.chip.display.height }}
              {{ config.chip.model.toUpperCase() }}
            </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 控制面板 -->
      <div class="w-full lg:w-80">
        <h3 class="text-lg font-medium text-gray-900 mb-4">{{ $t('generateSummary.previewSettings') }}</h3>
        <div class="space-y-6 bg-white border border-gray-200 rounded-lg p-4">
          
          <!-- 文字内容编辑 -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('generateSummary.previewText') }}</label>
            <textarea
              v-model="previewText"
              class="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              rows="3"
              placeholder="Hi, I'm your friend Xiaozhi!"
            ></textarea>
          </div>

          <!-- 表情切换 -->
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

          <!-- 主题模式切换 -->
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


          <!-- 配置摘要 -->
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

    <!-- 操作按钮 -->
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

// 预览状态
const previewText = ref(t('generateSummary.defaultPreviewText'))
const currentEmoji = ref('happy')
const themeMode = ref('light')
const fontLoaded = ref(false)
const loadedFontFamily = ref('')

// 表情数据
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

// 可用的表情列表
const availableEmotions = computed(() => {
  if (props.config.theme.emoji.type === 'preset' && props.config.theme.emoji.preset) {
    return emotionList.value
  } else if (props.config.theme.emoji.type === 'custom') {
    // 只显示用户上传的表情
    const customImages = props.config.theme.emoji.custom.images
    return emotionList.value.filter(emotion => customImages[emotion.key])
  } else {
    // 未配置表情时返回空数组
    return []
  }
})

// 当前表情图片
const currentEmojiImage = computed(() => {
  return getEmotionImage(currentEmoji.value)
})

// 获取屏幕样式
const getScreenStyle = () => {
  const { width, height } = props.config.chip.display
  
  // 使用1:1像素比例，直接使用配置中的尺寸
  return {
    width: `${width}px`,
    height: `${height}px`
  }
}

// 获取背景样式
const getBackgroundStyle = () => {
  const bg = props.config.theme.skin[themeMode.value]
  
  if (bg.backgroundType === 'image' && bg.backgroundImage) {
    try {
      // 验证背景图片文件是否有效
      if (bg.backgroundImage && typeof bg.backgroundImage === 'object' && bg.backgroundImage.size) {
        return {
          backgroundImage: `url(${URL.createObjectURL(bg.backgroundImage)})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center'
        }
      }
    } catch (error) {
      console.warn('背景图片预览加载失败:', error)
    }
  }
  
  return {
    backgroundColor: bg.backgroundColor || '#ffffff'
  }
}

// 预设表情包尺寸配置
const presetEmojiSizes = {
  'twemoji32': 32,
  'twemoji64': 64,
  'noto-emoji_64': 64,
  'noto-emoji_128': 128
}

// 获取表情样式
const getEmojiStyle = () => {
  let size = 48 // 默认大小
  
  if (props.config.theme.emoji.type === 'preset') {
    size = presetEmojiSizes[props.config.theme.emoji.preset] || 32
  } else if (props.config.theme.emoji.custom.size) {
    size = Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height)
  }
  
  // 使用1:1像素比例，直接使用配置中的表情尺寸
  return {
    width: `${size}px`,
    height: `${size}px`
  }
}

// 获取文字样式
const getTextStyle = () => {
  let fontSize = 14
  
  // 根据字体配置调整字号
  if (props.config.theme.font.type === 'preset') {
    const fontConfig = props.config.theme.font.preset
    if (fontConfig.includes('_14_')) fontSize = 14
    else if (fontConfig.includes('_16_')) fontSize = 16
    else if (fontConfig.includes('_20_')) fontSize = 20
    else if (fontConfig.includes('_30_')) fontSize = 30
  } else if (props.config.theme.font.custom.size) {
    fontSize = props.config.theme.font.custom.size
  }
  
  // 使用1:1像素比例，直接使用配置中的字体大小
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

// 动态加载字体
const loadFont = async () => {
  // 清理之前的字体
  const existingStyles = document.querySelectorAll('style[data-font-preview]')
  existingStyles.forEach(style => style.remove())
  
  fontLoaded.value = false
  loadedFontFamily.value = ''

  try {
    if (props.config.theme.font.type === 'preset') {
      // 加载预设字体
      const presetId = props.config.theme.font.preset
      let fontFamily, fontUrl
      
      // 根据预设字体 ID 判断是 puhui 还是 noto
      if (presetId && presetId.startsWith('font_noto_qwen_')) {
        fontFamily = 'NotoPreview'
        fontUrl = './static/fonts/noto_qwen.ttf'
      } else {
        // 默认为 puhui
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
      
      // 等待字体加载完成
      await document.fonts.load(`16px "${fontFamily}"`)
      loadedFontFamily.value = fontFamily
      fontLoaded.value = true
      
    } else if (props.config.theme.font.custom.file) {
      // 加载自定义字体
      try {
        const fontFile = props.config.theme.font.custom.file
        
        // 验证文件对象是否有效
        if (!fontFile || typeof fontFile !== 'object' || !fontFile.size) {
          throw new Error('字体文件对象无效')
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
        
        // 等待字体加载完成
        await document.fonts.load(`16px "${fontFamily}"`)
        loadedFontFamily.value = fontFamily
        fontLoaded.value = true
      } catch (error) {
        console.warn('自定义字体预览加载失败:', error)
        // 使用系统默认字体作为fallback
        loadedFontFamily.value = 'Arial, sans-serif'
        fontLoaded.value = true
      }
    } else {
      // 使用系统字体
      loadedFontFamily.value = 'system-ui'
      fontLoaded.value = true
    }
  } catch (error) {
    console.warn('Font loading failed:', error)
    loadedFontFamily.value = 'system-ui'
    fontLoaded.value = true
  }
}

// 获取字体族
const getFontFamily = () => {
  if (fontLoaded.value && loadedFontFamily.value) {
    return `"${loadedFontFamily.value}", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif`
  }
  return '"PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
}

// 预设表情包配置
const presetEmojiFormats = {
  'twemoji32': 'png',
  'twemoji64': 'png',
  'noto-emoji_64': 'gif',
  'noto-emoji_128': 'gif'
}

// 获取表情图片
const getEmotionImage = (emotionKey) => {
  if (props.config.theme.emoji.type === 'preset') {
    const presetId = props.config.theme.emoji.preset
    const format = presetEmojiFormats[presetId] || 'png'
    return `./static/emojis/${presetId}/${emotionKey}.${format}`
  } else if (props.config.theme.emoji.type === 'custom' && props.config.theme.emoji.custom.images[emotionKey]) {
    try {
      const emojiFile = props.config.theme.emoji.custom.images[emotionKey]
      // 验证表情文件是否有效
      if (emojiFile && typeof emojiFile === 'object' && emojiFile.size) {
        return URL.createObjectURL(emojiFile)
      }
    } catch (error) {
      console.warn(`表情图片预览加载失败 (${emotionKey}):`, error)
    }
  }
  return null
}

// 获取表情字符
const getEmojiCharacter = (emotionKey) => {
  const emotion = emotionList.value.find(e => e.key === emotionKey)
  return emotion ? emotion.emoji : '😶'
}

// 获取表情控制按钮尺寸
const getEmojiControlSize = () => {
  if (props.config.theme.emoji.type === 'preset') {
    const baseSize = presetEmojiSizes[props.config.theme.emoji.preset] || 32
    return Math.min(baseSize + 16, 80) // 加上padding，限制最大尺寸
  } else if (props.config.theme.emoji.custom.size) {
    const baseSize = Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height)
    return Math.min(baseSize + 16, 80) // 限制最大尺寸
  }
  return 48 // 默认尺寸
}

// 获取表情图片显示尺寸
const getEmojiDisplaySize = () => {
  if (props.config.theme.emoji.type === 'preset') {
    const size = presetEmojiSizes[props.config.theme.emoji.preset] || 32
    return Math.min(size, 64) // 限制控制面板中的显示尺寸
  } else if (props.config.theme.emoji.custom.size) {
    return Math.min(props.config.theme.emoji.custom.size.width, props.config.theme.emoji.custom.size.height, 64)
  }
  return 32 // 默认尺寸
}

// 切换表情
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

// 监听字体配置变化
watch(() => props.config.theme.font, () => {
  loadFont()
}, { deep: true })

// 组件挂载
onMounted(async () => {
  // 确保有可用的表情
  if (availableEmotions.value.length > 0) {
    currentEmoji.value = availableEmotions.value[0].key
  } else {
    currentEmoji.value = ''
  }
  
  // 加载字体
  await loadFont()
})

// 组件卸载时清理字体
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