/**
 * 日语罗马字输入引擎
 *
 * 1. RomajiGuide：已知目标假名时，逐键判定（打字游戏式），支持 shi/si、tsu/tu、
 *    っ（双写辅音）、ん（n / nn / n'）、拗音（kya / kilya）、长音符（-）等多种拼法。
 * 2. RomajiFreeConverter：不知道目标时（默写模式），把罗马字自由转换成假名。
 */

const KANA_ROMAJI: Record<string, string[]> = {
  あ: ['a'], い: ['i', 'yi'], う: ['u', 'wu', 'whu'], え: ['e'], お: ['o'],
  か: ['ka', 'ca'], き: ['ki'], く: ['ku', 'cu', 'qu'], け: ['ke'], こ: ['ko', 'co'],
  さ: ['sa'], し: ['shi', 'si', 'ci'], す: ['su'], せ: ['se', 'ce'], そ: ['so'],
  た: ['ta'], ち: ['chi', 'ti'], つ: ['tsu', 'tu'], て: ['te'], と: ['to'],
  な: ['na'], に: ['ni'], ぬ: ['nu'], ね: ['ne'], の: ['no'],
  は: ['ha'], ひ: ['hi'], ふ: ['fu', 'hu'], へ: ['he'], ほ: ['ho'],
  ま: ['ma'], み: ['mi'], む: ['mu'], め: ['me'], も: ['mo'],
  や: ['ya'], ゆ: ['yu'], よ: ['yo'],
  ら: ['ra'], り: ['ri'], る: ['ru'], れ: ['re'], ろ: ['ro'],
  わ: ['wa'], ゐ: ['wi'], ゑ: ['we'], を: ['wo'],
  が: ['ga'], ぎ: ['gi'], ぐ: ['gu'], げ: ['ge'], ご: ['go'],
  ざ: ['za'], じ: ['ji', 'zi'], ず: ['zu'], ぜ: ['ze'], ぞ: ['zo'],
  だ: ['da'], ぢ: ['di', 'ji'], づ: ['du', 'zu'], で: ['de'], ど: ['do'],
  ば: ['ba'], び: ['bi'], ぶ: ['bu'], べ: ['be'], ぼ: ['bo'],
  ぱ: ['pa'], ぴ: ['pi'], ぷ: ['pu'], ぺ: ['pe'], ぽ: ['po'],
  ゔ: ['vu'],
  ぁ: ['la', 'xa'], ぃ: ['li', 'xi'], ぅ: ['lu', 'xu'], ぇ: ['le', 'xe'], ぉ: ['lo', 'xo'],
  ゃ: ['lya', 'xya'], ゅ: ['lyu', 'xyu'], ょ: ['lyo', 'xyo'], ゎ: ['lwa', 'xwa'],
  っ: ['ltu', 'xtu', 'ltsu', 'xtsu'],
  ん: ['nn', "n'", 'xn'],
  ー: ['-'],
  // 拗音
  きゃ: ['kya'], きぃ: ['kyi'], きゅ: ['kyu'], きぇ: ['kye'], きょ: ['kyo'],
  ぎゃ: ['gya'], ぎぃ: ['gyi'], ぎゅ: ['gyu'], ぎぇ: ['gye'], ぎょ: ['gyo'],
  しゃ: ['sha', 'sya'], しぃ: ['syi'], しゅ: ['shu', 'syu'], しぇ: ['she', 'sye'], しょ: ['sho', 'syo'],
  じゃ: ['ja', 'jya', 'zya'], じぃ: ['jyi', 'zyi'], じゅ: ['ju', 'jyu', 'zyu'], じぇ: ['je', 'jye', 'zye'], じょ: ['jo', 'jyo', 'zyo'],
  ちゃ: ['cha', 'tya', 'cya'], ちぃ: ['tyi', 'cyi'], ちゅ: ['chu', 'tyu', 'cyu'], ちぇ: ['che', 'tye', 'cye'], ちょ: ['cho', 'tyo', 'cyo'],
  ぢゃ: ['dya'], ぢぃ: ['dyi'], ぢゅ: ['dyu'], ぢぇ: ['dye'], ぢょ: ['dyo'],
  にゃ: ['nya'], にぃ: ['nyi'], にゅ: ['nyu'], にぇ: ['nye'], にょ: ['nyo'],
  ひゃ: ['hya'], ひぃ: ['hyi'], ひゅ: ['hyu'], ひぇ: ['hye'], ひょ: ['hyo'],
  びゃ: ['bya'], びぃ: ['byi'], びゅ: ['byu'], びぇ: ['bye'], びょ: ['byo'],
  ぴゃ: ['pya'], ぴぃ: ['pyi'], ぴゅ: ['pyu'], ぴぇ: ['pye'], ぴょ: ['pyo'],
  みゃ: ['mya'], みぃ: ['myi'], みゅ: ['myu'], みぇ: ['mye'], みょ: ['myo'],
  りゃ: ['rya'], りぃ: ['ryi'], りゅ: ['ryu'], りぇ: ['rye'], りょ: ['ryo'],
  // 外来语常用
  ふぁ: ['fa'], ふぃ: ['fi'], ふぇ: ['fe'], ふぉ: ['fo'], ふゅ: ['fyu'],
  てぃ: ['thi'], でぃ: ['dhi'], とぅ: ['twu'], どぅ: ['dwu'], でゅ: ['dhu'],
  うぃ: ['wi'], うぇ: ['we'], うぉ: ['who'],
  ゔぁ: ['va'], ゔぃ: ['vi'], ゔぇ: ['ve'], ゔぉ: ['vo'],
  つぁ: ['tsa'], つぃ: ['tsi'], つぇ: ['tse'], つぉ: ['tso'],
}

const SYMBOL_ROMAJI: Record<string, string[]> = {
  '、': [','], '。': ['.'], '・': ['/'], '「': ['['], '」': [']'], '？': ['?'], '！': ['!'], '〜': ['~'], '　': [' '],
}

const KANA_RE = /[ぁ-ゖァ-ヺー]/
const KATAKANA_ONLY_RE = /^[ァ-ヺー・]+$/

/** 是否为日语（含假名或汉字假名混合）的单词；纯英文单词返回 false */
export function isJapaneseText(text: string | undefined | null): boolean {
  return !!text && KANA_RE.test(text)
}

/** 去掉「漢字(かな)」写法里的注音，用于朗读：私(わたし)は → 私は */
export function stripFurigana(text: string): string {
  return text.replace(/[(（][\u3041-\u3096\u30a1-\u30fa\u30fc]+[)）]/g, '')
}

export function isKatakanaText(text: string): boolean {
  return KATAKANA_ONLY_RE.test(text)
}

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヶ]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

export function toKatakana(text: string): string {
  return text.replace(/[ぁ-ゖ]/g, ch => String.fromCharCode(ch.charCodeAt(0) + 0x60))
}

export interface RomajiCandidate {
  romaji: string
  /** 消耗目标中的字符数 */
  consume: number
}

const VOWEL_LIKE = /^[aiueoyn']/

function unitCandidates(hira: string, depth = 0): RomajiCandidate[] {
  if (!hira) return []
  const c0 = hira[0]!
  const result: RomajiCandidate[] = []

  // 拗音等两字单位
  const two = hira.slice(0, 2)
  if (two.length === 2 && KANA_ROMAJI[two]) {
    for (const r of KANA_ROMAJI[two]!) result.push({ romaji: r, consume: 2 })
  }

  if (c0 === 'っ' && depth === 0) {
    // 双写下一个音的辅音：っか → kka，っち → cchi / tchi
    for (const next of unitCandidates(hira.slice(1), depth + 1)) {
      const first = next.romaji[0]
      if (!first || !/[bcdfghjklmpqrstvwxyz]/.test(first)) continue
      result.push({ romaji: first + next.romaji, consume: next.consume + 1 })
      if (next.romaji.startsWith('ch')) result.push({ romaji: 't' + next.romaji, consume: next.consume + 1 })
    }
  }

  if (c0 === 'ん') {
    const rest = hira.slice(1)
    if (!rest) {
      // 词尾的 ん：单个 n 即可
      result.push({ romaji: 'n', consume: 1 }, { romaji: 'xn', consume: 1 })
      return result
    }
    const nextNeedsDoubleN = unitCandidates(rest, depth + 1).some(c => VOWEL_LIKE.test(c.romaji))
    if (!nextNeedsDoubleN) result.push({ romaji: 'n', consume: 1 })
  }

  const singles = KANA_ROMAJI[c0] ?? SYMBOL_ROMAJI[c0] ?? [c0.toLowerCase()]
  for (const r of singles) result.push({ romaji: r, consume: 1 })
  return result
}

/** 目标剩余部分（可为平假名/片假名）当前可接受的所有罗马字拼法 */
export function getRomajiCandidates(remaining: string): RomajiCandidate[] {
  return unitCandidates(toHiragana(remaining))
}

/** 把假名转成一种标准罗马字（用于提示） */
export function kanaToRomaji(kana: string): string {
  let rest = toHiragana(kana)
  let out = ''
  while (rest) {
    const cands = unitCandidates(rest)
    // 优先：消耗最多的第一个拼法（表里第一个是标准赫本式）
    const best = cands.find(c => c.romaji === 'n') ?? cands.reduce((a, b) => (b.consume > a.consume ? b : a))
    out += best.romaji
    rest = rest.slice(best.consume)
  }
  return out
}

export type GuideResult =
  | { type: 'pending' } // 已接受，还在等后续按键
  | { type: 'commit'; text: string } // 确定了一段假名（原目标字形）
  | { type: 'wrong'; key: string } // 按错

/**
 * 按目标假名逐键判定。
 * feed 返回的 commit 可能有多段（例如 n 在 j 之前被确认为 ん，再把 j 作为新的开始）。
 */
export class RomajiGuide {
  buffer = ''

  reset() {
    this.buffer = ''
  }

  backspace(): boolean {
    if (!this.buffer) return false
    this.buffer = this.buffer.slice(0, -1)
    return true
  }

  feed(rawKey: string, remaining: string): GuideResult[] {
    const key = rawKey.toLowerCase()
    // 直接输入假名（手机日语键盘等）
    if (isJapaneseText(key)) {
      this.buffer = ''
      return [{ type: 'commit', text: key }]
    }
    if (!remaining) {
      this.buffer = ''
      return [{ type: 'wrong', key: rawKey }]
    }
    const cands = getRomajiCandidates(remaining)
    const next = this.buffer + key
    const matching = cands.filter(c => c.romaji.startsWith(next))
    if (matching.length) {
      this.buffer = next
      const exact = matching.find(c => c.romaji === next)
      const longer = matching.some(c => c.romaji.length > next.length)
      if (exact && !longer) {
        this.buffer = ''
        return [{ type: 'commit', text: remaining.slice(0, exact.consume) }]
      }
      return [{ type: 'pending' }]
    }
    // 缓冲区已经是一个完整拼法（如 ん 的单个 n），先确认它，再处理当前键
    const done = this.buffer ? cands.find(c => c.romaji === this.buffer) : undefined
    if (done) {
      const text = remaining.slice(0, done.consume)
      this.buffer = ''
      return [{ type: 'commit', text }, ...this.feed(rawKey, remaining.slice(done.consume))]
    }
    this.buffer = ''
    return [{ type: 'wrong', key: rawKey }]
  }
}

const ROMAJI_TO_KANA: Record<string, string> = (() => {
  const map: Record<string, string> = {}
  for (const [kana, list] of Object.entries(KANA_ROMAJI)) {
    for (const r of list) if (!(r in map)) map[r] = kana
  }
  // 自由输入时 ぢ/づ 不作为 ji/zu 的结果
  map.ji = 'じ'
  map.zu = 'ず'
  for (const [sym, list] of Object.entries(SYMBOL_ROMAJI)) {
    for (const r of list) if (r !== ' ' && !(r in map)) map[r] = sym
  }
  return map
})()
const ROMAJI_KEYS = Object.keys(ROMAJI_TO_KANA)

/** 不依赖目标的罗马字→假名转换（默写模式用） */
export class RomajiFreeConverter {
  buffer = ''
  katakana: boolean
  constructor(katakana = false) {
    this.katakana = katakana
  }

  reset() {
    this.buffer = ''
  }

  backspace(): boolean {
    if (!this.buffer) return false
    this.buffer = this.buffer.slice(0, -1)
    return true
  }

  private out(text: string) {
    return this.katakana ? toKatakana(text) : text
  }

  /** 返回本次确定的假名（可能为空） */
  feed(rawKey: string): string {
    const key = rawKey.toLowerCase()
    if (isJapaneseText(key)) {
      const flushed = this.flush()
      return flushed + key
    }
    this.buffer += key
    let result = ''
    while (this.buffer) {
      const b = this.buffer
      if (ROMAJI_TO_KANA[b] !== undefined && !ROMAJI_KEYS.some(k => k !== b && k.startsWith(b))) {
        result += this.out(ROMAJI_TO_KANA[b]!)
        this.buffer = ''
        break
      }
      if (ROMAJI_KEYS.some(k => k.startsWith(b)) || b === 'tc') break
      // n + 辅音 → ん
      if (b[0] === 'n' && b.length >= 2) {
        result += this.out('ん')
        this.buffer = b.slice(1)
        continue
      }
      // 双写辅音 → っ
      if (b.length >= 2 && b[0] === b[1] && /[bcdfghjklmpqrstvwxyz]/.test(b[0]!)) {
        result += this.out('っ')
        this.buffer = b.slice(1)
        continue
      }
      // tch → っch
      if (b.startsWith('tch')) {
        result += this.out('っ')
        this.buffer = b.slice(1)
        continue
      }
      // 无法转换：原样输出第一个字符
      result += b[0]
      this.buffer = b.slice(1)
    }
    return result
  }

  /** 结束输入（例如按空格）时，把残留的 n 等转换出来 */
  flush(): string {
    const b = this.buffer
    this.buffer = ''
    if (!b) return ''
    if (b === 'n') return this.out('ん')
    if (ROMAJI_TO_KANA[b] !== undefined) return this.out(ROMAJI_TO_KANA[b]!)
    return b
  }
}
