<script setup lang="ts">
import type { Word } from '@/core/types/types.ts'
import { getDefaultWord } from '@/core/types/func.ts'
import { WordPlayTrigger, WordPracticeType } from '@/core/types/enum.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import { resetActiveWordPlayCount, usePlayBeep, usePlayCorrect, usePlayKeyboardAudio } from '@/core/hooks/sound.ts'
import { emitter, EventKey } from '@/core/utils/eventBus.ts'
import { onUnmounted, ref, watch } from 'vue'
import Space from '@/components/article/Space.vue'
import { _nextTick, last } from '@/core/utils'
import { useOnKeyboardEventListener } from '@/core/hooks/event.ts'
import { Toast } from '@/base'
import { usePracticeWordTyping } from '@/core/composables/practice-words/usePracticeWordTyping.ts'
import { isJapaneseText, isKatakanaText, RomajiFreeConverter, RomajiGuide } from '@/core/utils/romaji.ts'

interface IProps {
  word: Word
  practiceType: WordPracticeType
  isWordMasked: boolean
  showWordResult: boolean
  showFullWord: boolean
  wordFontSize: number
  active?: boolean
}

const props = withDefaults(defineProps<IProps>(), {
  word: () => getDefaultWord(),
  showWordResult: false,
  active: true,
  showFullWord: false,
  isWordMasked: false,
  wordFontSize: 48,
})

const emit = defineEmits<{
  'update:showWordResult': [value: boolean]
  complete: []
  wrong: []
  play: [trigger: WordPlayTrigger]
}>()

const settingStore = useSettingStore()
const playBeep = usePlayBeep()
const playCorrect = usePlayCorrect()
const playKeyboardAudio = usePlayKeyboardAudio()

const typing = usePracticeWordTyping({
  getWord: () => props.word,
  getPracticeType: () => props.practiceType,
  getIsWordMasked: () => props.isWordMasked,
  getShowWordResult: () => props.showWordResult,
  getSettings: () => settingStore,
  setShowWordResult: value => emit('update:showWordResult', value),
  onComplete: () => emit('complete'),
  onWrong: () => emit('wrong'),
  onPlay: trigger => emit('play', trigger),
  onNotice: notice =>
    Toast.info($t(notice.type === 'delete-reinput' ? 'press_delete_reinput' : 'press_space_continue'), {
      duration: 2000,
    }),
  playBeep,
  playCorrect,
  playKeyboardAudio,
  resetWordPlayCount: resetActiveWordPlayCount,
})

const {
  input,
  wrong,
  wholeInputAttempt,
  inputLock,
  inputCharacterStates,
  isWordCorrect,
  typeCharacter,
  backspace,
  reset,
  setWordTestResult,
  clearDeferredTimers,
} = typing

const displayWord = $computed(() => props.word.word.slice(input.value.length + wrong.value.length))
let cursor = $ref({ top: 0, left: 0 })
const typingWordRef = $ref<HTMLDivElement>()

// ---- 日语：罗马字输入 → 假名 ----
const isJapaneseWord = $computed(() => isJapaneseText(props.word.word))
const romajiGuide = new RomajiGuide()
const romajiFree = new RomajiFreeConverter()
/** 正在输入、尚未组成假名的罗马字 */
const romajiPending = ref('')

function resetRomaji() {
  romajiGuide.reset()
  romajiFree.reset()
  romajiPending.value = ''
}

function typeKana(text: string) {
  for (const ch of text) typeCharacter({ key: ch, code: '', shiftKey: false })
}

function onJapaneseTyping(event: KeyboardEvent) {
  const isDictation = props.practiceType === WordPracticeType.Dictation
  const isSpaceKey = event.code === 'Space' || event.key === ' '
  if (event.code === 'Backspace') {
    const handled = isDictation ? romajiFree.backspace() : romajiGuide.backspace()
    if (!handled) backspace()
  } else if (isDictation) {
    // 默写：不看答案，自由转换，按空格提交
    romajiFree.katakana = isKatakanaText(props.word.word)
    if (isSpaceKey) {
      typeKana(romajiFree.flush())
      typeCharacter({ key: ' ', code: 'Space', shiftKey: false })
    } else if (event.key.length === 1 || isJapaneseText(event.key)) {
      typeKana(romajiFree.feed(event.key))
    }
  } else if (isSpaceKey || inputLock.value) {
    // 单词已打完 / 等待空格等状态，交给原有逻辑
    romajiGuide.reset()
    typeCharacter({ key: event.key, code: event.code, shiftKey: event.shiftKey })
  } else if (event.key.length === 1 || isJapaneseText(event.key)) {
    // 跟打 / 自测：按目标假名逐键判定
    const remaining = props.word.word.slice(input.value.length)
    for (const result of romajiGuide.feed(event.key, remaining)) {
      if (result.type === 'commit') typeKana(result.text)
      else if (result.type === 'wrong') typeCharacter({ key: result.key, code: event.code, shiftKey: false })
    }
  }
  romajiPending.value = isDictation ? romajiFree.buffer : romajiGuide.buffer
}

function onTyping(event: KeyboardEvent) {
  if (isJapaneseWord) return onJapaneseTyping(event)
  if (event.code === 'Backspace') {
    backspace()
    return
  }
  typeCharacter({ key: event.key, code: event.code, shiftKey: event.shiftKey })
}

function checkCursorPosition() {
  _nextTick(() => {
    if (!typingWordRef) return
    const typingWordRect = typingWordRef.getBoundingClientRect()
    const inputList = typingWordRef.querySelectorAll('.l')
    if (inputList.length) {
      const inputRect = last(Array.from(inputList)).getBoundingClientRect()
      cursor = {
        top: inputRect.top - typingWordRect.top,
        left: inputRect.right - typingWordRect.left,
      }
      return
    }
    const element = typingWordRef.querySelector('.dictation') ?? typingWordRef.querySelector('.letter')
    const rect = element?.getBoundingClientRect()
    if (!rect) return
    cursor = {
      top: rect.top - typingWordRect.top,
      left: rect.left - typingWordRect.left,
    }
  })
}

function resetTypingCore(trigger: WordPlayTrigger) {
  resetRomaji()
  reset(trigger)
  checkCursorPosition()
}

function onResetWord() {
  resetTypingCore(WordPlayTrigger.ResetSameWord)
}

useOnKeyboardEventListener(
  () => {},
  () => {}
)

watch(
  () => props.word,
  () => resetTypingCore(WordPlayTrigger.NewWord),
  { immediate: true }
)

watch([input, romajiPending, () => props.showFullWord, () => props.practiceType], checkCursorPosition)

function deactivate() {
  clearDeferredTimers()
  emitter.off(EventKey.resetWord, onResetWord)
  emitter.off(EventKey.onTyping, onTyping)
}

watch(
  () => props.active,
  active => {
    deactivate()
    if (active) {
      emitter.on(EventKey.resetWord, onResetWord)
      emitter.on(EventKey.onTyping, onTyping)
      checkCursorPosition()
    }
  },
  { immediate: true }
)

onUnmounted(deactivate)

defineExpose({
  isWordRight: () => isWordCorrect.value,
  setWordTestResult,
})
</script>

<template>
  <div
    class="typing-core"
    ref="typingWordRef"
    :class="wrong || (wholeInputAttempt && inputLock && !isWordCorrect) ? 'is-wrong' : ''"
  >
    <!-- 默写模式 -->
    <div v-if="practiceType === WordPracticeType.Dictation">
      <div
        class="letter text-align-center w-full inline-block"
        v-opacity:noAnim="!isWordMasked || showWordResult || showFullWord"
      >
        {{ word.word }}
      </div>
      <div
        class="mt-2 min-w-120 pb-1 dictation"
        :style="{ minHeight: wordFontSize + 'px' }"
        :class="showWordResult ? (isWordCorrect ? 'right' : 'wrong') : ''"
      >
        <template v-for="i in input">
          <span class="l" v-if="i !== ' '">{{ i }}</span>
          <Space class="l" v-else :is-wrong="showWordResult ? !isWordCorrect : false" :is-wait="!showWordResult" />
        </template>
        <span class="l romaji-pending" v-if="romajiPending">{{ romajiPending }}</span>
      </div>
    </div>

    <!-- 非默写模式 -->
    <template v-else>
      <template v-if="wholeInputAttempt">
        <template v-for="(item, index) in inputCharacterStates" :key="index">
          <span v-if="item.character === ' '" class="l">
            <Space :is-wrong="!item.isCorrect" :is-wait="false" />
          </span>
          <span v-else class="l" :class="item.isCorrect ? 'input' : 'wrong'">{{ item.character }}</span>
        </template>
      </template>
      <span class="input" v-else-if="input">{{ input }}</span>
      <span class="wrong" v-if="wrong">{{ wrong }}</span>
      <span class="romaji-pending" :class="wholeInputAttempt && 'l'" v-if="romajiPending">{{ romajiPending }}</span>
      <span class="letter" v-if="isWordMasked && !showFullWord">
        {{
          displayWord
            .split('')
            .map(v => (v === ' ' ? '&nbsp;' : '_'))
            .join('')
        }}
      </span>
      <span class="letter" v-else>{{ displayWord }}</span>
    </template>

    <div
      v-if="active"
      class="cursor"
      :style="{
        top: cursor.top + 'px',
        left: cursor.left + 'px',
        height: wordFontSize + 'px',
      }"
    ></div>
  </div>
</template>

<style scoped lang="scss">
.dictation {
  border-bottom: 2px solid gray;
}

.typing-core {
  position: relative;

  &.is-wrong {
    animation: shake 0.82s cubic-bezier(0.36, 0.07, 0.19, 0.97) both;
  }

  .input,
  .right {
    color: rgb(22, 163, 74);
  }

  .wrong {
    color: rgba(red, 0.6);
  }

  .romaji-pending {
    color: var(--color-font-1);
    opacity: 0.55;
    font-size: 0.6em;
    text-decoration: underline dotted;
    margin: 0 0.05em;
  }
}
</style>
