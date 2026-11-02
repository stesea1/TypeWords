<script setup lang="ts">
/**
 * 日语卡片模式：不用打字，看汉字回想读音和意思，翻面后自评。
 * - 复习安排沿用网站的 FSRS 记忆曲线（store.fsrsData），新词进度沿用词典的 lastLearnIndex
 * - 「不认识」的卡片会在本轮稍后再出现，并加入错词本
 * - 「已掌握」与打字模式里的「标记已掌握」相同，以后不再出现
 */
import { computed, onMounted, onUnmounted, ref, toRaw, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { createEmptyCard, Rating } from 'ts-fsrs'
import { BasePage, Toast } from '@/base'
import { useBaseStore } from '@/core/stores/base.ts'
import { useSettingStore } from '@/core/stores/setting.ts'
import type { Dict, Word } from '@/core/types/types.ts'
import { DICT_LIST } from '@/core/config/env.ts'
import { _getDictDataByUrl, resourceWrap, shuffle } from '@/core/utils'
import { useNextCard } from '@/core/hooks/fsrs.ts'
import { useWordOptions } from '@/core/hooks/dict.ts'
import { usePlayWordAudio, useTTsPlayAudio } from '@/core/hooks/sound.ts'
import { createStudyTask } from '@/core/composables/practice-words/study-task.ts'
import { useDataSyncPersistence } from '@/core/composables/useDataSyncPersistence.ts'
import { isJapaneseText, kanaToRomaji, stripFurigana } from '@/core/utils/romaji.ts'

useHead({ title: '卡片记忆 · 日语打字练习' })

const route = useRoute()
const router = useRouter()
const store = useBaseStore()
const settingStore = useSettingStore()
const dataSync = useDataSyncPersistence()
const { nextCard } = useNextCard()
const { isWordSimple, toggleWordSimple } = useWordOptions()
const playWordAudio = usePlayWordAudio()
const ttsPlay = useTTsPlayAudio()

type CardItem = { word: Word; isNew: boolean }

const loading = ref(true)
const dictName = ref('')
const queue = ref<CardItem[]>([])
const flipped = ref(false)
const finished = ref(false)
/** 本轮已经第一次评分过的词（FSRS 只按第一次评分记录） */
const rated = new Set<string>()
const stats = ref({ total: 0, again: 0, hard: 0, good: 0, mastered: 0 })

const current = computed(() => queue.value[0])
const word = computed(() => current.value?.word)
const kanji = computed(() => {
  const w = word.value
  return w && w.phonetic0 && w.phonetic0 !== w.word ? w.phonetic0 : ''
})
const romaji = computed(() => (word.value ? kanaToRomaji(word.value.word) : ''))
const remaining = computed(() => queue.value.length)

/** 例句里「漢字(かな)」转为注音（ruby），其余文字做 HTML 转义 */
function furiganaHtml(text: string) {
  const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!)
  return text
    .split(/([々一-鿿]+[(（][ぁ-ゖァ-ヺー]+[)）])/)
    .map(part => {
      const m = part.match(/^([々一-鿿]+)[(（]([ぁ-ゖァ-ヺー]+)[)）]$/)
      return m ? `<ruby>${esc(m[1]!)}<rt>${esc(m[2]!)}</rt></ruby>` : esc(part)
    })
    .join('')
}

async function findDict(): Promise<Dict | undefined> {
  const id = String(route.params.id ?? '')
  let dict = store.word.bookList.find(v => String(v.id) === id)
  if (!dict) {
    const list = await fetch(resourceWrap(DICT_LIST.WORD.ALL)).then(r => r.json())
    dict = list.flat().find((v: Dict) => String(v.id) === id)
  }
  if (dict && !dict.custom && !dict.words?.length) dict = await _getDictDataByUrl(dict)
  return dict
}

function buildQueue() {
  const { taskWords } = createStudyTask()
  const review = shuffle(toRaw(taskWords.review).slice()).map(w => ({ word: w, isNew: false }))
  const fresh = toRaw(taskWords.new).map(w => ({ word: w, isNew: true }))
  queue.value = [...review, ...fresh]
  rated.clear()
  stats.value = { total: queue.value.length, again: 0, hard: 0, good: 0, mastered: 0 }
  flipped.value = false
  finished.value = queue.value.length === 0
}

/** 没有到期卡片、也没有新词时：从已学过的词里随机抽一组 */
function buildRandomQueue() {
  const learned = store.sdict.complete ? store.sdict.words : store.sdict.words.slice(0, store.sdict.lastLearnIndex)
  const ignore = store.getIgnoreWordsSet()
  const pick = shuffle(learned.filter(w => !ignore.has(w.word))).slice(0, Math.max(10, store.sdict.perDayStudyNumber))
  queue.value = pick.map(w => ({ word: w, isNew: false }))
  rated.clear()
  stats.value = { total: queue.value.length, again: 0, hard: 0, good: 0, mastered: 0 }
  flipped.value = false
  finished.value = queue.value.length === 0
  if (finished.value) Toast.info('还没有学过的词，先学一组新词吧')
}

async function init() {
  const dict = await findDict()
  if (!dict?.id || !dict.words?.length) {
    Toast.warning('没有找到这本词典')
    return router.push('/words')
  }
  if (!isJapaneseText(dict.words[0]?.word)) {
    Toast.warning('卡片模式目前只支持日语词典')
    return router.push('/words')
  }
  // 传副本：changeDict 会清空词典列表里其他词典的 words，若传入的正是列表里的对象会把自己也清空
  await store.changeDict({ ...dict, words: toRaw(dict.words).slice() })
  dictName.value = dict.name
  buildQueue()
  loading.value = false
}

watch(
  () => store.load,
  ok => {
    if (ok && loading.value) void init()
  },
  { immediate: true }
)

// ---------- 发音 ----------
function speakWord() {
  if (word.value) playWordAudio(word.value.word, false)
}
function speakSentence() {
  const s = word.value?.sentences?.[0]?.c
  if (s) ttsPlay(stripFurigana(s), { lang: 'ja-JP', rate: settingStore.sentenceSoundSpeed })
}

function flip() {
  if (!word.value || flipped.value) return
  flipped.value = true
  if (settingStore.wordSound) speakWord()
}

// ---------- 保存（防抖，离开页面时立即保存） ----------
let saveTimer: ReturnType<typeof setTimeout> | null = null
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => void saveNow(), 1500)
}
async function saveNow() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = null
  try {
    await dataSync.saveDictState(store.$state, { pullWhenRemoteNewer: false })
  } catch (e) {
    console.error('[cards] 保存失败', e)
  }
}

/** 新词第一次评分后推进词典进度，这样中途离开也不会重复学 */
function advanceProgress(w: Word) {
  const d = store.sdict
  const idx = d.words.findIndex(x => x.word === w.word && x.phonetic0 === w.phonetic0)
  if (idx >= 0 && idx + 1 > d.lastLearnIndex) d.lastLearnIndex = idx + 1
  if (d.lastLearnIndex >= d.length) {
    d.lastLearnIndex = d.length
    d.complete = true
  }
}

function addToWrongBook(w: Word) {
  if (!store.wrong.words.some(v => v.word === w.word)) {
    store.wrong.words.push(w)
    store.wrong.length = store.wrong.words.length
  }
}

function grade(kind: 'again' | 'hard' | 'good' | 'mastered') {
  const card = current.value
  if (!card || !flipped.value) return
  const key = card.word.word
  // 同音词（如 かいせい：改正/快晴）分开计数；FSRS 记录沿用网站的做法，按假名保存
  const cardKey = key + '|' + (card.word.phonetic0 ?? '')
  const first = !rated.has(cardKey)

  if (first) {
    rated.add(cardKey)
    stats.value[kind]++
    if (kind !== 'mastered') {
      const rating = { again: Rating.Again, hard: Rating.Hard, good: Rating.Good }[kind]
      store.fsrsData[key] = nextCard(store.fsrsData[key] ?? createEmptyCard(), rating)
    }
    if (card.isNew) advanceProgress(card.word)
  }

  if (kind === 'again') addToWrongBook(card.word)
  if (kind === 'mastered' && !isWordSimple(card.word)) toggleWordSimple(card.word)

  const rest = queue.value.slice(1)
  if (kind === 'again') {
    // 隔几张再出现，直到记住为止
    rest.splice(Math.min(3, rest.length), 0, card)
  }
  queue.value = rest
  flipped.value = false
  finished.value = rest.length === 0
  scheduleSave()
  if (finished.value) void saveNow()
}

function nextRound() {
  buildQueue()
  if (finished.value) buildRandomQueue()
}

// ---------- 键盘：空格/回车翻面，1-4 评分 ----------
function onKey(e: KeyboardEvent) {
  if (e.ctrlKey || e.metaKey || e.altKey) return
  if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
  if (!flipped.value && (e.code === 'Space' || e.code === 'Enter')) {
    e.preventDefault()
    flip()
  } else if (flipped.value) {
    const map: Record<string, 'again' | 'hard' | 'good' | 'mastered'> = {
      Digit1: 'again', Digit2: 'hard', Digit3: 'good', Digit4: 'mastered',
      Numpad1: 'again', Numpad2: 'hard', Numpad3: 'good', Numpad4: 'mastered',
    }
    if (map[e.code]) {
      e.preventDefault()
      grade(map[e.code]!)
    } else if (e.code === 'KeyP') speakWord()
  }
}

function onHide() {
  if (document.hidden) void saveNow()
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  document.addEventListener('visibilitychange', onHide)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
  document.removeEventListener('visibilitychange', onHide)
  if (saveTimer) void saveNow()
})
</script>

<template>
  <BasePage>
    <div class="cards-page">
      <header class="top">
        <button class="link" @click="router.push('/words')">← 返回</button>
        <div class="title">{{ dictName || '卡片记忆' }}</div>
        <div class="count" v-if="!loading && !finished">剩 {{ remaining }}</div>
      </header>

      <div v-if="loading" class="center-box">加载中…</div>

      <!-- 完成 -->
      <div v-else-if="finished" class="center-box done">
        <div class="done-title">{{ stats.total ? '这一组完成了 🎉' : '现在没有要复习的卡片' }}</div>
        <div v-if="stats.total" class="done-stats">
          <span>共 {{ stats.total }} 张</span>
          <span class="c-good">认识 {{ stats.good }}</span>
          <span class="c-hard">模糊 {{ stats.hard }}</span>
          <span class="c-again">不认识 {{ stats.again }}</span>
          <span v-if="stats.mastered">已掌握 {{ stats.mastered }}</span>
        </div>
        <div class="done-progress">
          词典进度：{{ store.sdict.lastLearnIndex }} / {{ store.sdict.length }}
        </div>
        <div class="done-actions">
          <button class="btn primary" @click="nextRound">再来一组</button>
          <button class="btn" @click="router.push('/words')">返回</button>
        </div>
      </div>

      <!-- 卡片 -->
      <template v-else-if="word">
        <div class="card" :class="{ flipped }" @click="flip">
          <div class="tag" v-if="current?.isNew">新词</div>
          <div class="front" :class="{ 'kana-only': !kanji }">{{ kanji || word.word }}</div>

          <div v-if="!flipped" class="hint">{{ kanji ? '想想读音和意思' : '想想意思' }} · 点击翻面</div>

          <div v-else class="back" @click.stop>
            <div class="reading" v-if="kanji">
              {{ word.word }}
              <button class="icon" title="发音 (P)" @click="speakWord">🔊</button>
            </div>
            <div class="romaji">
              {{ romaji }}
              <button v-if="!kanji" class="icon" title="发音 (P)" @click="speakWord">🔊</button>
            </div>
            <div class="meaning" v-for="(t, i) in word.trans" :key="i">
              <span class="pos" v-if="t.pos">{{ t.pos }}</span>{{ t.cn }}
            </div>
            <div class="sentence" v-if="word.sentences?.length">
              <div class="ja">
                <span v-html="furiganaHtml(word.sentences[0].c)"></span>
                <button class="icon" title="朗读例句" @click="speakSentence">🔊</button>
              </div>
              <div class="cn">{{ word.sentences[0].cn }}</div>
            </div>
          </div>
        </div>

        <div class="actions" v-if="flipped">
          <button class="btn again" @click="grade('again')">不认识<small>1</small></button>
          <button class="btn hard" @click="grade('hard')">模糊<small>2</small></button>
          <button class="btn good" @click="grade('good')">认识<small>3</small></button>
          <button class="btn mastered" @click="grade('mastered')">已掌握<small>4</small></button>
        </div>
        <div class="actions" v-else>
          <button class="btn primary wide" @click="flip">显示答案<small>空格</small></button>
        </div>
      </template>
    </div>
  </BasePage>
</template>

<style scoped lang="scss">
.cards-page {
  width: 100%;
  max-width: 34rem;
  margin: 0 auto;
  box-sizing: border-box;
  padding: 0.5rem 0 2rem;
  color: var(--color-font-1, #222);
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  .title {
    font-weight: 600;
    font-size: 1rem;
    text-align: center;
    flex: 1;
  }
  .count {
    font-size: 0.85rem;
    opacity: 0.7;
    min-width: 3.5rem;
    text-align: right;
  }
}
.link {
  background: none;
  border: none;
  color: inherit;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 0.4rem 0;
  min-width: 3.5rem;
  text-align: left;
}
.card {
  position: relative;
  background: var(--color-card-bg, #fff);
  border: 1px solid var(--color-item-border, #e5e5e5);
  border-radius: 1rem;
  min-height: 22rem;
  padding: 2.5rem 1.25rem 1.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  cursor: pointer;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  &.flipped {
    cursor: default;
  }
}
.tag {
  position: absolute;
  top: 0.75rem;
  left: 0.75rem;
  font-size: 0.75rem;
  padding: 0.1rem 0.5rem;
  border-radius: 999px;
  background: rgba(59, 130, 246, 0.12);
  color: rgb(37, 99, 235);
}
.front {
  font-size: 3.2rem;
  font-weight: 500;
  letter-spacing: 0.1em;
  line-height: 1.3;
  text-align: center;
  margin-top: 1.5rem;
  word-break: keep-all;
  &.kana-only {
    font-size: 2.6rem;
  }
}
.hint {
  margin-top: auto;
  font-size: 0.85rem;
  opacity: 0.5;
}
.back {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.6rem;
  border-top: 1px dashed var(--color-line, #ddd);
  padding-top: 1rem;
}
.reading {
  font-size: 1.8rem;
  color: rgb(22, 163, 74);
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.romaji {
  font-size: 1rem;
  opacity: 0.6;
  display: flex;
  align-items: center;
  gap: 0.4rem;
}
.meaning {
  font-size: 1.15rem;
  text-align: center;
  .pos {
    color: rgb(37, 99, 235);
    margin-right: 0.5rem;
    font-size: 0.9rem;
  }
}
.sentence {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.75rem;
  border-radius: 0.6rem;
  background: rgba(127, 127, 127, 0.08);
  font-size: 1rem;
  line-height: 2;
  .cn {
    opacity: 0.7;
    font-size: 0.9rem;
    line-height: 1.5;
  }
  :deep(rt) {
    font-size: 0.6em;
    opacity: 0.8;
  }
}
.icon {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 1rem;
  padding: 0.2rem;
  line-height: 1;
}
.actions {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 0.5rem;
  .wide {
    grid-column: 1 / -1;
  }
}
.btn {
  border: 1px solid var(--color-item-border, #ddd);
  background: var(--color-card-bg, #fff);
  color: inherit;
  border-radius: 0.75rem;
  padding: 0.9rem 0.25rem;
  font-size: 1rem;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.15rem;
  -webkit-tap-highlight-color: transparent;
  small {
    font-size: 0.7rem;
    opacity: 0.5;
  }
  &:active {
    transform: scale(0.97);
  }
  &.primary {
    background: rgb(37, 99, 235);
    border-color: rgb(37, 99, 235);
    color: #fff;
  }
  &.again {
    color: rgb(220, 38, 38);
  }
  &.hard {
    color: rgb(217, 119, 6);
  }
  &.good {
    color: rgb(22, 163, 74);
  }
  &.mastered {
    opacity: 0.75;
  }
}
.center-box {
  min-height: 20rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  text-align: center;
}
.done-title {
  font-size: 1.4rem;
  font-weight: 600;
}
.done-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}
.done-progress {
  opacity: 0.6;
  font-size: 0.9rem;
}
.done-actions {
  display: flex;
  gap: 0.75rem;
  .btn {
    padding: 0.7rem 1.5rem;
  }
}
.c-good {
  color: rgb(22, 163, 74);
}
.c-hard {
  color: rgb(217, 119, 6);
}
.c-again {
  color: rgb(220, 38, 38);
}
@media (max-width: 768px) {
  .cards-page {
    max-width: none;
    padding-top: 2rem; // 让出手机版顶部导航的收起按钮
  }
  .front {
    font-size: 2.8rem;
  }
  .card {
    min-height: 19rem;
  }
}
</style>
