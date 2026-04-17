<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-lg font-medium text-gray-900 mb-2">{{ $t('wakewordConfig.title') }}</h3>
      <p class="text-gray-600">
        {{ $t('wakewordConfig.description') }}
      </p>
    </div>

    <!-- Notice shown when the chip does not support wake words -->
    <div v-if="!canUseAnyWakeword" class="bg-orange-50 border border-orange-200 rounded-lg p-4">
      <div class="text-sm text-orange-800">
        <strong>{{ $t('wakewordConfig.notice') }}</strong>
        <p class="mt-1">{{ $t('wakewordConfig.unsupportedMessage', { chipModel }) }}</p>
      </div>
    </div>

    <div v-else class="space-y-6">
      <!-- Wake-word type selector -->
      <div class="flex space-x-4">
        <button
          @click="setWakewordType('none')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'none'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('wakewordConfig.noWakeword') }}
        </button>
        <button
          @click="setWakewordType('preset')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'preset'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('wakewordConfig.presetWakeword') }}
        </button>
        <button
          v-if="supportCustom"
          @click="setWakewordType('custom')"
          :class="[
            'px-4 py-2 border rounded-lg transition-colors',
            modelValue.type === 'custom'
              ? 'border-primary-500 bg-primary-50 text-primary-700'
              : 'border-gray-300 hover:border-gray-400'
          ]"
        >
          {{ $t('wakewordConfig.customWakeword') }}
        </button>
      </div>

      <!-- Preset wake-word selector -->
      <div v-if="modelValue.type === 'preset'" class="space-y-4">
        <label class="block text-sm font-medium text-gray-700">{{ $t('wakewordConfig.selectWakeword') }}</label>
        <div class="relative">
          <select 
            :value="modelValue.preset"
            @change="selectPresetWakeword($event.target.value)"
            class="w-full border border-gray-300 rounded-md px-3 py-2 pr-10 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option
              v-for="wakeword in availableWakewords"
              :key="wakeword.id"
              :value="wakeword.id"
            >
              {{ wakeword.name }} ({{ wakeword.model }})
            </option>
          </select>
        </div>
      </div>

      <!-- Custom wake-word settings -->
      <div v-if="modelValue.type === 'custom'" class="space-y-4 bg-gray-50 p-4 rounded-lg border border-gray-200">
        <h4 class="font-medium text-gray-900">{{ $t('wakewordConfig.customSettings') }}</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t('wakewordConfig.wakewordName') }}
              <span class="text-red-500">*</span>
            </label>
            <input 
              type="text"
              v-model="localCustom.name"
              :placeholder="$t('wakewordConfig.wakewordNamePlaceholder')"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              :class="{ 'border-red-500': errors.name }"
            >
            <p v-if="errors.name" class="text-xs text-red-500 mt-1">{{ errors.name }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t('wakewordConfig.wakewordCommand') }}
              <span class="text-red-500">*</span>
            </label>
            <input 
              type="text"
              v-model="localCustom.command"
              :placeholder="localCustom.model.includes('_cn') ? $t('wakewordConfig.wakewordCommandPlaceholderCN') : $t('wakewordConfig.wakewordCommandPlaceholderEN')"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              :class="{ 'border-red-500': errors.command }"
            >
            <p v-if="errors.command" class="text-xs text-red-500 mt-1">{{ errors.command }}</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('wakewordConfig.threshold') }}</label>
            <div class="flex items-center space-x-2">
              <input 
                type="range" 
                v-model.number="localCustom.threshold"
                min="0" max="100" step="1"
                class="flex-1"
              >
              <span class="text-sm text-gray-600 w-8">{{ localCustom.threshold }}</span>
            </div>
            <p class="text-xs text-gray-500 mt-1">{{ $t('wakewordConfig.thresholdDesc') }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">
              {{ $t('wakewordConfig.duration') }} (ms)
            </label>
            <input 
              type="number"
              v-model.number="localCustom.duration"
              min="500" max="10000" step="100"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              :class="{ 'border-red-500': errors.duration }"
            >
            <p v-if="errors.duration" class="text-xs text-red-500 mt-1">{{ errors.duration }}</p>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">{{ $t('wakewordConfig.selectModel') }}</label>
            <select 
              v-model="localCustom.model"
              class="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="mn6_cn">{{ $t('wakewordConfig.mn6cn') }}</option>
              <option value="mn6_en">{{ $t('wakewordConfig.mn6en') }}</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Tips -->
      <div class="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div class="text-sm text-blue-800">
          <strong>{{ $t('wakewordConfig.tips.tipLabel') }}</strong>
          <ul class="mt-1 list-disc list-inside space-y-1">
            <li>{{ $t('wakewordConfig.tips.optional') }}</li>
            <li v-if="supportWakeNet9s">{{ $t('wakewordConfig.tips.wakeNet9sOnly') }}</li>
            <li v-else-if="supportWakeNet9">{{ $t('wakewordConfig.tips.wakeNet9Full') }}</li>
            <li v-if="supportCustom">{{ $t('wakewordConfig.tips.customSupport') }}</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

const props = defineProps({
  modelValue: {
    type: Object,
    required: true
  },
  chipModel: {
    type: String,
    required: true
  }
})

const emit = defineEmits(['update:modelValue'])

// Full wake-word catalog. Display names are English; the `id` is the ESP-SR
// model identifier and must not be renamed. Chinese wake words keep English
// romanisation here; users browsing the picker in Chinese will see translated
// names via the i18n catalog in future iterations.
const wakewordData = [
  // WakeNet9s (supported on C3/C5/C6 chips)
  { id: 'wn9s_hilexin', name: 'Hi, Espressif', model: 'WakeNet9s' },
  { id: 'wn9s_hiesp', name: 'Hi, ESP', model: 'WakeNet9s' },
  { id: 'wn9s_nihaoxiaozhi', name: 'Hello LittleWise', model: 'WakeNet9s' },
  { id: 'wn9s_hijason', name: 'Hi, Jason', model: 'WakeNet9s' },
  { id: 'wn9s_alexa', name: 'Alexa', model: 'WakeNet9s' },

  // WakeNet9 (supported on S3/P4 chips)
  { id: 'wn9_hilexin', name: 'Hi, Espressif', model: 'WakeNet9' },
  { id: 'wn9_hiesp', name: 'Hi, ESP', model: 'WakeNet9' },
  { id: 'wn9_nihaoxiaozhi_tts', name: 'Hello LittleWise', model: 'WakeNet9' },
  { id: 'wn9_hijason_tts2', name: 'Hi, Jason', model: 'WakeNet9' },
  { id: 'wn9_nihaomiaoban_tts2', name: 'Hello Meow Mate', model: 'WakeNet9' },
  { id: 'wn9_xiaoaitongxue', name: 'Xiaoai Classmate', model: 'WakeNet9' },
  { id: 'wn9_himfive', name: 'Hi, M Five', model: 'WakeNet9' },
  { id: 'wn9_alexa', name: 'Alexa', model: 'WakeNet9' },
  { id: 'wn9_jarvis_tts', name: 'Jarvis', model: 'WakeNet9' },
  { id: 'wn9_computer_tts', name: 'Computer', model: 'WakeNet9' },
  { id: 'wn9_heywillow_tts', name: 'Hey, Willow', model: 'WakeNet9' },
  { id: 'wn9_sophia_tts', name: 'Sophia', model: 'WakeNet9' },
  { id: 'wn9_mycroft_tts', name: 'Mycroft', model: 'WakeNet9' },
  { id: 'wn9_heyprinter_tts', name: 'Hey, Printer', model: 'WakeNet9' },
  { id: 'wn9_hijoy_tts', name: 'Hi, Joy', model: 'WakeNet9' },
  { id: 'wn9_heywanda_tts', name: 'Hey, Wand', model: 'WakeNet9' },
  { id: 'wn9_astrolabe_tts', name: 'Astrolabe', model: 'WakeNet9' },
  { id: 'wn9_heyily_tts2', name: 'Hey, Ily', model: 'WakeNet9' },
  { id: 'wn9_hijolly_tts2', name: 'Hi, Jolly', model: 'WakeNet9' },
  { id: 'wn9_hifairy_tts2', name: 'Hi, Fairy', model: 'WakeNet9' },
  { id: 'wn9_bluechip_tts2', name: 'Blue Chip', model: 'WakeNet9' },
  { id: 'wn9_hiandy_tts2', name: 'Hi, Andy', model: 'WakeNet9' },
  { id: 'wn9_heyivy_tts2', name: 'Hey, Ivy', model: 'WakeNet9' },
  { id: 'wn9_histackchan_tts3', name: 'Hi, Stack Chan', model: 'WakeNet9' },
  { id: 'wn9_hiwalle_tts2', name: 'Hi, Wall-E', model: 'WakeNet9' },
  { id: 'wn9_nihaoxiaoxin_tts', name: 'Hello Xiaoxin', model: 'WakeNet9' },
  { id: 'wn9_xiaomeitongxue_tts', name: 'Xiaomei Classmate', model: 'WakeNet9' },
  { id: 'wn9_hixiaoxing_tts', name: 'Hi, Xiaoxing', model: 'WakeNet9' },
  { id: 'wn9_xiaolongxiaolong_tts', name: 'Xiaolong Xiaolong', model: 'WakeNet9' },
  { id: 'wn9_miaomiaotongxue_tts', name: 'Miaomiao Classmate', model: 'WakeNet9' },
  { id: 'wn9_himiaomiao_tts', name: 'Hi, Miaomiao', model: 'WakeNet9' },
  { id: 'wn9_hilili_tts', name: 'Hi, Lily', model: 'WakeNet9' },
  { id: 'wn9_hitelly_tts', name: 'Hi, Telly', model: 'WakeNet9' },
  { id: 'wn9_xiaobinxiaobin_tts', name: 'Xiaobin Xiaobin', model: 'WakeNet9' },
  { id: 'wn9_haixiaowu_tts', name: 'Hi, Xiaowu', model: 'WakeNet9' },
  { id: 'wn9_xiaoyaxiaoya_tts2', name: 'Xiaoya Xiaoya', model: 'WakeNet9' },
  { id: 'wn9_linaiban_tts2', name: 'Linai Pad', model: 'WakeNet9' },
  { id: 'wn9_xiaosurou_tts2', name: 'Xiao Su Rou', model: 'WakeNet9' },
  { id: 'wn9_xiaoyutongxue_tts2', name: 'Xiaoyu Classmate', model: 'WakeNet9' },
  { id: 'wn9_xiaomingtongxue_tts2', name: 'Xiaoming Classmate', model: 'WakeNet9' },
  { id: 'wn9_xiaokangtongxue_tts2', name: 'Xiaokang Classmate', model: 'WakeNet9' },
  { id: 'wn9_xiaojianxiaojian_tts2', name: 'Xiaojian Xiaojian', model: 'WakeNet9' },
  { id: 'wn9_xiaotexiaote_tts2', name: 'Xiaote Xiaote', model: 'WakeNet9' },
  { id: 'wn9_nihaoxiaoyi_tts2', name: 'Hello Xiaoyi', model: 'WakeNet9' },
  { id: 'wn9_nihaobaiying_tts2', name: 'Hello Baiying', model: 'WakeNet9' },
  { id: 'wn9_xiaoluxiaolu_tts2', name: 'Xiaolu Xiaolu', model: 'WakeNet9' },
  { id: 'wn9_nihaodongdong_tts2', name: 'Hello Dongdong', model: 'WakeNet9' },
  { id: 'wn9_nihaoxiaoan_tts2', name: 'Hello Xiaoan', model: 'WakeNet9' },
  { id: 'wn9_ni3hao3xiao3mai4_tts2', name: 'Hello Xiaomai', model: 'WakeNet9' },
  { id: 'wn9_ni3hao3xiao3rui4_tts3', name: 'Hello Xiaorui', model: 'WakeNet9' },
  { id: 'wn9_hai1xiao3ou1_tts3', name: 'Hey Xiao-Ou', model: 'WakeNet9' },
  { id: 'wn9_xiao3jia1xiao3jia1_tts3', name: 'Xiaojia Xiaojia', model: 'WakeNet9' },
  { id: 'wn9_xiao3feng1xiao3feng1_tts3', name: 'Xiaofeng Xiaofeng', model: 'WakeNet9' }
]

// Returns true when the chip supports full-size WakeNet9 models.
const supportWakeNet9 = computed(() => {
  const chip = props.chipModel.toLowerCase()
  return chip === 'esp32s3' || chip === 'esp32p4'
})

// Returns true when the chip supports the lightweight WakeNet9s models.
const supportWakeNet9s = computed(() => {
  const chip = props.chipModel.toLowerCase()
  return chip === 'esp32c3' || chip === 'esp32c5' || chip === 'esp32c6'
})

// Returns true when the chip can run custom wake words (MultiNet — S3-only today).
const supportCustom = computed(() => {
  const chip = props.chipModel.toLowerCase()
  return chip === 'esp32s3'
})

const canUseAnyWakeword = computed(() => supportWakeNet9.value || supportWakeNet9s.value)

// Wake words available for the currently selected chip.
const availableWakewords = computed(() => {
  if (supportWakeNet9.value) {
    return wakewordData.filter(w => w.model === 'WakeNet9')
  } else if (supportWakeNet9s.value) {
    return wakewordData.filter(w => w.model === 'WakeNet9s')
  } else {
    return []
  }
})

const localCustom = ref({
  name: '',
  command: '',
  threshold: 20,
  duration: 3000,
  model: 'mn6_en'
})

const errors = ref({
  name: '',
  command: '',
  duration: ''
})

const validate = () => {
  let isValid = true
  errors.value = { name: '', command: '', duration: '' }

  if (!localCustom.value.name.trim()) {
    errors.value.name = t('wakewordConfig.errors.nameRequired')
    isValid = false
  }
  if (!localCustom.value.command.trim()) {
    errors.value.command = t('wakewordConfig.errors.commandRequired')
    isValid = false
  } else if (localCustom.value.model.includes('_en')) {
    // English model doesn't support punctuation
    if (/[!,.?]/.test(localCustom.value.command)) {
      errors.value.command = t('wakewordConfig.errors.noPunctuation')
      isValid = false
    }
  }

  if (!localCustom.value.duration || localCustom.value.duration < 500 || localCustom.value.duration > 10000) {
    errors.value.duration = t('wakewordConfig.errors.durationRange')
    isValid = false
  }

  return isValid
}

const isUpdatingFromProps = ref(false)

const setWakewordType = (type) => {
  emit('update:modelValue', {
    ...props.modelValue,
    type,
    preset: type === 'preset' ? (props.modelValue.preset || availableWakewords.value[0]?.id || '') : '',
    custom: {
      ...props.modelValue.custom,
      ...localCustom.value
    }
  })
}

const selectPresetWakeword = (id) => {
  emit('update:modelValue', {
    ...props.modelValue,
    preset: id
  })
}

// Watch local custom settings and sync changes back to the parent
watch(localCustom, (newVal) => {
  if (isUpdatingFromProps.value) return
  
  if (props.modelValue.type === 'custom') {
    validate()
    emit('update:modelValue', {
      ...props.modelValue,
      custom: { ...newVal }
    })
  }
}, { deep: true })

// Watch parent prop changes and sync them into local state
watch(() => props.modelValue.custom, (newVal) => {
  if (newVal) {
    isUpdatingFromProps.value = true
    localCustom.value = {
      name: newVal.name || '',
      command: newVal.command || '',
      threshold: newVal.threshold !== undefined ? newVal.threshold : 20,
      duration: newVal.duration !== undefined ? newVal.duration : 3000,
      model: newVal.model || 'mn6_cn'
    }
    nextTick(() => {
      isUpdatingFromProps.value = false
    })
  }
}, { deep: true, immediate: true })

</script>
