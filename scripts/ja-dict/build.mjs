// 把 jlpt_n5.tsv 生成为 TypeWords 词库 JSON
// 用法：node scripts/ja-dict/build.mjs [源文件.tsv] [输出文件名.json]
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join, basename } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const src = process.argv[2] ?? join(here, 'jlpt_n5.tsv')
const outName = process.argv[3] ?? 'JLPT_N5.json'
const outFile = join(here, '../../public/dicts/ja/word', outName)
const idPrefix = basename(outName, '.json').toLowerCase()

const KANA_ONLY = /^[ぁ-ゖァ-ヺー]+$/
const errors = []
const seen = new Set()
const words = []

readFileSync(src, 'utf8')
  .split(/\r?\n/)
  .forEach((line, i) => {
    if (!line.trim() || line.startsWith('#')) return
    const cols = line.split('\t')
    const at = `第 ${i + 1} 行`
    if (cols.length !== 6) return errors.push(`${at}：应为 6 列，实际 ${cols.length} 列`)
    const [kana, kanji, pos, cn, sentence, sentenceCn] = cols.map(c => c.trim())
    if (!KANA_ONLY.test(kana)) errors.push(`${at}：读音「${kana}」只能是假名`)
    if (seen.has(kana + kanji)) errors.push(`${at}：重复的词「${kana}」`)
    if (!cn) errors.push(`${at}：缺少中文释义`)
    if (sentence && /[(（][^)）]*[^ぁ-ゖァ-ヺー)）][^)）]*[)）]/.test(sentence)) {
      errors.push(`${at}：例句括号里只能写假名注音`)
    }
    seen.add(kana + kanji)
    words.push({
      id: `${idPrefix}-${String(words.length + 1).padStart(3, '0')}`,
      word: kana,
      phonetic0: kanji || '',
      phonetic1: kanji || '',
      trans: [{ pos, cn }],
      sentences: sentence ? [{ c: sentence, cn: sentenceCn }] : [],
      phrases: [],
      synos: [],
      relWords: { root: '', rels: [] },
      etymology: [],
    })
  })

if (errors.length) {
  console.error(errors.join('\n'))
  process.exit(1)
}
mkdirSync(dirname(outFile), { recursive: true })
writeFileSync(outFile, JSON.stringify(words))
console.log(`已生成 ${outFile}，共 ${words.length} 个单词`)
