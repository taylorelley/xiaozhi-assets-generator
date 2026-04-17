<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('emojiConfig.title') }}</h3>
      <p class="text-gray-600">{{ $t('emojiConfig.description') }}</p>
    </div>

    <!-- Emoji type selector -->
    <div class="space-y-4">
      <div class="flex flex-wrap gap-3">
        <button
          @click="setEmojiType('none')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'none'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('emojiConfig.noEmojiPack') }}
        </button>
        <button
          @click="setEmojiType('preset')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'preset'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('emojiConfig.presetEmojiPack') }}
        </button>
        <button
          @click="setEmojiType('custom')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'custom'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('emojiConfig.customEmojiPack') }}
        </button>
      </div>
      <p v-if="modelValue.type === 'none'" class="text-sm text-gray-500">
        {{ $t('emojiConfig.noEmojiPackDescription') }}
      </p>
    </div>

    <div v-if="modelValue.type === 'preset'" class="space-y-4">
      <h4 class="font-medium text-gray-900">{{ $t('emojiConfig.selectPresetEmojiPack') }}</h4>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div
          v-for="pack in presetEmojis"
          :key="pack.id"
          @click="selectPresetEmoji(pack.id)"
          :class="[
            'border-2 rounded-lg p-4 cursor-pointer transition-all',
            modelValue.preset === pack.id
              ? 'border-primary-500 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          ]"
        >
          <div class="flex items-start justify-between mb-3">
            <div>
              <h5 class="font-medium text-gray-900">{{ pack.name }}</h5>
              <p class="text-sm text-gray-600">{{ pack.description }}</p>
              <div class="text-xs text-gray-500 mt-1">
                {{ $t('emojiConfig.size') }}: {{ pack.size }}px × {{ pack.size }}px
              </div>
            </div>
            <div 
              v-if="modelValue.preset === pack.id"
              class="flex-shrink-0 ml-3"
            >
              <div class="w-5 h-5 bg-primary-500 rounded-full flex items-center justify-center">
                <svg class="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"/>
                </svg>
              </div>
            </div>
          </div>
          
          <!-- Emoji preview grid -->
          <div class="grid grid-cols-7 gap-1 justify-items-center overflow-hidden">
            <div
              v-for="emotion in pack.preview"
              :key="emotion"
              :style="{ width: pack.size + 'px', height: pack.size + 'px' }"
              class="bg-gray-100 rounded flex items-center justify-center"
            >
              <img 
                :src="getPresetEmojiUrl(pack.id, emotion)"
                :alt="emotion"
                :style="{ width: pack.size + 'px', height: pack.size + 'px' }"
                class="object-contain rounded"
                @error="handleImageError"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="modelValue.type === 'custom'" class="space-y-6">
      <h4 class="font-medium text-gray-900">{{ $t('emojiConfig.customEmojiPackConfig') }}</h4>
      
      <!-- Basic configuration -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <!-- Image dimensions -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('emojiConfig.maxImageWidth') }}</label>
          <input
            type="number"
            v-model.number="localCustom.size.width"
            min="16"
            max="200"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
        </div>
        
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">{{ $t('emojiConfig.maxImageHeight') }}</label>
          <input
            type="number"
            v-model.number="localCustom.size.height"
            min="16"
            max="200"
            class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
        </div>
      </div>

      <!-- Emoji image upload -->
      <div class="space-y-4">
        <h5 class="font-medium text-gray-900">{{ $t('emojiConfig.uploadEmojiImages') }}</h5>
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <div
            v-for="emotion in emotionList"
            :key="emotion.key"
            class="space-y-2"
          >
            <div class="text-center">
              <div class="text-lg mb-1">{{ emotion.emoji }}</div>
              <div class="text-xs text-gray-600 flex items-center justify-center gap-1">
                <span>{{ emotion.name }}</span>
                <span v-if="emotion.key === 'neutral'" class="text-red-500">{{ $t('emojiConfig.required') }}</span>
              </div>
            </div>
            
            <div 
              @drop="(e) => handleFileDrop(e, emotion.key)"
              @dragover.prevent
              @dragenter.prevent
              :class="[
                'border-2 border-dashed rounded-lg p-2 text-center cursor-pointer transition-colors aspect-square flex flex-col items-center justify-center',
                modelValue.custom.images[emotion.key]
                  ? 'border-green-300 bg-green-50'
                  : emotion.key === 'neutral'
                    ? 'border-red-300 bg-red-50'
                    : 'border-gray-300 hover:border-gray-400'
              ]"
            >
              <input
                :ref="emotion.key + 'Input'"
                type="file"
                accept=".png,.gif"
                @change="(e) => handleFileSelect(e, emotion.key)"
                class="hidden"
              >
              
              <div v-if="!modelValue.custom.images[emotion.key]" @click="$refs[emotion.key + 'Input'][0]?.click()">
                <svg class="w-6 h-6 text-gray-400 mx-auto mb-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"/>
                </svg>
                <div class="text-xs text-gray-500">{{ $t('emojiConfig.clickToUploadOrDrag') }}</div>
              </div>
              
              <div v-else class="w-full h-full relative">
                <img 
                  v-if="getImagePreview(emotion.key)"
                  :src="getImagePreview(emotion.key)" 
                  :alt="emotion.name"
                  class="w-full h-full object-cover rounded"
                  @error="handleImageError"
                >
                <button
                  @click="removeImage(emotion.key)"
                  class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600"
                >
                  ×
                </button>
              </div>
            </div>
          </div>
        </div>
        
        <div class="text-xs text-gray-500 mt-2">
          {{ $t('emojiConfig.neutralRequiredNotice') }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import StorageHelper from '@/utils/StorageHelper.js'

const { t } = useI18n()

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

/**
 * Compute the SHA-256 hash of a file
 * @param {File} file - The file object
 * @returns {Promise<string>} The hash of the file
 */
const calculateFileHash = async (file) => {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
  return hashHex
}

const presetEmojis = [
  {
    id: 'twemoji32',
    name: t('emojiConfig.twitterEmojiName', { size: 32 }),
    description: t('emojiConfig.twitterEmojiDescription', { size: 32 }),
    size: 32,
    format: 'png',
    preview: ['neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying']
  },
  {
    id: 'twemoji64',
    name: t('emojiConfig.twitterEmojiName', { size: 64 }),
    description: t('emojiConfig.twitterEmojiDescription', { size: 64 }),
    size: 64,
    format: 'png',
    preview: ['neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying']
  },
  {
    id: 'noto-emoji_64',
    name: t('emojiConfig.notoEmojiName', { size: 64 }),
    description: t('emojiConfig.notoEmojiDescription', { size: 64 }),
    size: 64,
    format: 'gif',
    preview: ['neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying']
  },
  {
    id: 'noto-emoji_128',
    name: t('emojiConfig.notoEmojiName', { size: 128 }),
    description: t('emojiConfig.notoEmojiDescription', { size: 128 }),
    size: 128,
    format: 'gif',
    preview: ['neutral', 'happy', 'laughing', 'funny', 'sad', 'angry', 'crying']
  }
]

// Use a computed property to get translated emotion names
const emotionList = computed(() => [
  { key: 'neutral', name: t('emojiConfig.emotions.neutral'), emoji: '😶' },
  { key: 'happy', name: t('emojiConfig.emotions.happy'), emoji: '🙂' },
  { key: 'laughing', name: t('emojiConfig.emotions.laughing'), emoji: '😆' },
  { key: 'funny', name: t('emojiConfig.emotions.funny'), emoji: '😂' },
  { key: 'sad', name: t('emojiConfig.emotions.sad'), emoji: '😔' },
  { key: 'angry', name: t('emojiConfig.emotions.angry'), emoji: '😠' },
  { key: 'crying', name: t('emojiConfig.emotions.crying'), emoji: '😭' },
  { key: 'loving', name: t('emojiConfig.emotions.loving'), emoji: '😍' },
  { key: 'embarrassed', name: t('emojiConfig.emotions.embarrassed'), emoji: '😳' },
  { key: 'surprised', name: t('emojiConfig.emotions.surprised'), emoji: '😯' },
  { key: 'shocked', name: t('emojiConfig.emotions.shocked'), emoji: '😱' },
  { key: 'thinking', name: t('emojiConfig.emotions.thinking'), emoji: '🤔' },
  { key: 'winking', name: t('emojiConfig.emotions.winking'), emoji: '😉' },
  { key: 'cool', name: t('emojiConfig.emotions.cool'), emoji: '😎' },
  { key: 'relaxed', name: t('emojiConfig.emotions.relaxed'), emoji: '😌' },
  { key: 'delicious', name: t('emojiConfig.emotions.delicious'), emoji: '🤤' },
  { key: 'kissy', name: t('emojiConfig.emotions.kissy'), emoji: '😘' },
  { key: 'confident', name: t('emojiConfig.emotions.confident'), emoji: '😏' },
  { key: 'sleepy', name: t('emojiConfig.emotions.sleepy'), emoji: '😴' },
  { key: 'silly', name: t('emojiConfig.emotions.silly'), emoji: '😜' },
  { key: 'confused', name: t('emojiConfig.emotions.confused'), emoji: '🙄' }
])

const localCustom = ref({
  size: { width: 32, height: 32 }
})

const setEmojiType = (type) => {
  // Avoid re-applying the same type
  if (props.modelValue.type === type) return

  const newValue = { ...props.modelValue, type }

  if (type === 'none') {
    // Selected "no emoji pack"
    newValue.preset = ''
    newValue.custom = {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {}
    }
  } else if (type === 'preset') {
    // Switching to preset emojis while preserving custom emoji data
    newValue.preset = props.modelValue.preset || 'twemoji32'
    newValue.custom = {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {}
    }
  } else if (type === 'custom') {
    newValue.preset = ''
    newValue.custom = {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {}
    }
  }
  
  emit('update:modelValue', newValue)
}

const selectPresetEmoji = (id) => {
  // Avoid re-selecting the same preset
  if (props.modelValue.preset === id) return

  // When selecting a different preset emoji pack, preserve custom emoji data
  emit('update:modelValue', {
    ...props.modelValue,
    preset: id,
    custom: {
      ...props.modelValue.custom,
      images: props.modelValue.custom.images || {}
    }
  })
}

const handleFileSelect = (event, emotionKey) => {
  const file = event.target.files[0]
  if (file) {
    updateEmojiImage(emotionKey, file)
  }
}

const handleFileDrop = (event, emotionKey) => {
  event.preventDefault()
  const files = event.dataTransfer.files
  if (files.length > 0) {
    updateEmojiImage(emotionKey, files[0])
  }
}

const updateEmojiImage = async (emotionKey, file) => {
  const validFormats = ['png', 'gif']
  const fileExtension = file.name.split('.').pop().toLowerCase()
  
  if (!validFormats.includes(fileExtension)) {
    alert(t('emojiConfig.selectValidFormat'))
    return
  }

  // 计算文件 hash
  const fileHash = await calculateFileHash(file)
  
  // 获取或初始化 fileMap 和 emotionMap
  const currentCustom = props.modelValue.custom || {}
  const fileMap = { ...(currentCustom.fileMap || {}) }
  const emotionMap = { ...(currentCustom.emotionMap || {}) }
  const images = { ...(currentCustom.images || {}) }
  
  // 检查是否已经存在相同的文件
  let existingEmotions = []
  for (const [emotion, hash] of Object.entries(emotionMap)) {
    if (hash === fileHash && emotion !== emotionKey) {
      existingEmotions.push(emotion)
    }
  }
  
  // 如果检测到相同文件，提示用户
  if (existingEmotions.length > 0) {
    console.log(t('emojiConfig.sharedFileMessage', { emotionKey, existingEmotions: existingEmotions.join(', ') }))
  }
  
  // 更新映射关系
  fileMap[fileHash] = file
  emotionMap[emotionKey] = fileHash
  images[emotionKey] = file  // 保持向后兼容
  
  emit('update:modelValue', {
    ...props.modelValue,
    custom: {
      ...currentCustom,
      size: localCustom.value.size,
      images,
      fileMap,      // 新增：hash -> File
      emotionMap    // 新增：emotion -> hash
    }
  })

  // 自动保存表情文件到存储（按 hash 保存，避免重复）
  await StorageHelper.saveEmojiFile(`hash_${fileHash}`, file, {
    size: localCustom.value.size,
    format: fileExtension,
    emotions: [...existingEmotions, emotionKey]  // 记录使用该文件的所有表情
  })
}

const removeImage = async (emotionKey) => {
  const currentCustom = props.modelValue.custom || {}
  const newImages = { ...currentCustom.images }
  const newEmotionMap = { ...(currentCustom.emotionMap || {}) }
  const newFileMap = { ...(currentCustom.fileMap || {}) }
  
  // 获取要删除的表情对应的 hash
  const fileHash = newEmotionMap[emotionKey]
  
  // 删除表情到 hash 的映射
  delete newImages[emotionKey]
  delete newEmotionMap[emotionKey]
  
  // 检查是否还有其他表情使用同一个文件
  const otherEmotionsUsingFile = Object.values(newEmotionMap).filter(h => h === fileHash)
  
  // 如果没有其他表情使用这个文件，则删除文件本身
  if (otherEmotionsUsingFile.length === 0 && fileHash) {
    delete newFileMap[fileHash]
    // 删除存储中的文件
    await StorageHelper.deleteEmojiFile(`hash_${fileHash}`)
    console.log(t('emojiConfig.fileDeleted', { fileHash }))
  } else {
    console.log(t('emojiConfig.fileRetained', { fileHash }))
  }
  
  emit('update:modelValue', {
    ...props.modelValue,
    custom: {
      ...currentCustom,
      images: newImages,
      emotionMap: newEmotionMap,
      fileMap: newFileMap
    }
  })
}

const getPresetEmojiUrl = (packId, emotion) => {
  const pack = presetEmojis.find(p => p.id === packId)
  const format = pack?.format || 'png'
  return `./static/emojis/${packId}/${emotion}.${format}`
}

const getImagePreview = (emotionKey) => {
  if (props.modelValue.type === 'preset') {
    return getPresetEmojiUrl(props.modelValue.preset, emotionKey)
  } else {
    const file = props.modelValue.custom.images[emotionKey]
    // 仅当为 File 或 Blob 时创建预览，避免恢复后占位对象导致报错
    if (file instanceof File || file instanceof Blob) {
      return URL.createObjectURL(file)
    }
    return null
  }
}

const handleImageError = (event) => {
  console.warn(t('emojiConfig.imageLoadFailed'), event.target.src)
  // 可以设置一个默认的fallback图片
  event.target.style.display = 'none'
}

// 移除可能导致无限递归的 watch
// 使用 computed 来同步 localCustom，避免双向绑定冲突
watch(() => localCustom.value.size, (newSize) => {
  if (props.modelValue.type === 'custom') {
    const currentCustom = props.modelValue.custom
    // 只在尺寸实际值改变时触发更新
    if (JSON.stringify(currentCustom.size) !== JSON.stringify(newSize)) {
      emit('update:modelValue', {
        ...props.modelValue,
        custom: {
          ...currentCustom,
          size: newSize
        }
      })
    }
  }
}, { deep: true })

// 初始化 localCustom
if (props.modelValue.custom.size) {
  localCustom.value = {
    size: { ...props.modelValue.custom.size }
  }
}
</script>
