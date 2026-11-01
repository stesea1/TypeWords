import { RomajiGuide, RomajiFreeConverter, kanaToRomaji } from '../../app/core/utils/romaji.ts'

let fail = 0
function guided(target: string, keys: string) {
  const g = new RomajiGuide()
  let typed = ''
  const wrongs: string[] = []
  for (const k of keys) {
    for (const r of g.feed(k, target.slice(typed.length))) {
      if (r.type === 'commit') typed += r.text
      if (r.type === 'wrong') wrongs.push(r.key)
    }
  }
  return { typed, wrongs, buffer: g.buffer }
}
function ok(target: string, keys: string) {
  const r = guided(target, keys)
  if (!(r.typed === target && r.wrongs.length === 0)) {
    fail++
    console.log('FAIL ok', target, keys, r)
  }
}
function bad(target: string, keys: string) {
  const r = guided(target, keys)
  if (r.wrongs.length === 0) {
    fail++
    console.log('FAIL bad', target, keys, r)
  }
}

ok('たんご', 'tango'); ok('たんご', 'tanngo'); ok('かんじ', 'kanji'); ok('かんじ', 'kannji'); ok('かんじ', 'kanzi')
ok('ほん', 'hon'); ok('せんせい', 'sensei'); ok('きんよう', 'kinnyou'); bad('きんよう', 'kinyou')
ok('こんにちは', 'konnnichiha'); ok('こんにちは', 'konnnitiha'); bad('こんにちは', 'konnichiha')
ok('がっこう', 'gakkou'); ok('がっこう', 'galtukou'); ok('きって', 'kitte'); ok('まっちゃ', 'matcha'); ok('まっちゃ', 'maccha')
ok('しゃしん', 'shashin'); ok('しゃしん', 'syasin'); ok('しゃしん', 'silyasin'); ok('ちゃ', 'cha'); ok('ちゃ', 'tya')
ok('つくえ', 'tsukue'); ok('つくえ', 'tukue'); ok('ふゆ', 'huyu'); ok('じしょ', 'jisho'); ok('じしょ', 'zisyo')
ok('テレビ', 'terebi'); ok('コーヒー', 'ko-hi-'); ok('パーティー', 'pa-thi-'); ok('ノート', 'no-to')
ok('おとうさん', 'otousan'); ok('でんわ', 'denwa'); ok('でんわ', 'dennwa'); ok('きんえん', 'kinnen'); bad('きんえん', 'kinen')
ok('ぎゅうにゅう', 'gyuunyuu'); ok('りょこう', 'ryokou'); ok('ちょっと', 'chotto'); ok('いっしょ', 'issho'); ok('いっしょ', 'issyo')
ok('はなび', 'HANABI'); ok('ちず', 'chizu'); ok('ちぢむ', 'chidimu'); ok('みかん', 'mikan')
bad('いぬ', 'ina'); bad('ねこ', 'nego')

console.log('romaji:', kanaToRomaji('がっこう'), kanaToRomaji('コーヒー'), kanaToRomaji('しんぶん'), kanaToRomaji('きんよう'), kanaToRomaji('ちゃわん'))

function free(keys: string, kata = false) {
  const c = new RomajiFreeConverter(kata)
  let s = ''
  for (const k of keys) s += c.feed(k)
  return s + c.flush()
}
const fcases: [string, string, boolean?][] = [
  ['tango', 'たんご'], ['kanji', 'かんじ'], ['gakkou', 'がっこう'], ['hon', 'ほん'], ['honn', 'ほん'],
  ['shashin', 'しゃしん'], ['konnnichiha', 'こんにちは'], ['ko-hi-', 'コーヒー', true], ['matcha', 'まっちゃ'],
  ['kinnyou', 'きんよう'], ['zisyo', 'じしょ'], ['tsukue', 'つくえ'], ['denwa', 'でんわ'], ['ryokou', 'りょこう'],
]
for (const [k, e, kata] of fcases) {
  const r = free(k, !!kata)
  if (r !== e) {
    fail++
    console.log('FAIL free', k, r, e)
  }
}
console.log(fail ? `${fail} failures` : 'all passed')
