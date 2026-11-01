# TypeWords 日语支持

在 TypeWords 上加的日语背单词功能：输入罗马字，自动变成假名并逐字判对错。

## 怎么用

1. 安装依赖并启动：

   ```bash
   pnpm install --shamefully-hoist
   pnpm dev
   ```

2. 浏览器打开 http://localhost:3000 → 单词 → 选择词典 → 「日语」分类下的「日语 N5 基础词汇」→ 学习。
3. **把系统输入法切到英文（半角）**，直接敲罗马字即可，不需要日语输入法。

## 输入规则

和日语输入法的打法一致，常见的几种拼法都能识别：

| 假名 | 可以输入 |
| --- | --- |
| し / ち / つ / ふ | shi 或 si / chi 或 ti / tsu 或 tu / fu 或 hu |
| じ / しゃ / ちょ | ji 或 zi / sha 或 sya / cho 或 tyo |
| っ（促音） | 双写下一个辅音：がっこう → gakkou，まっちゃ → matcha |
| ん | 一般打 n；后面跟元音、や行、な行时要打 nn（こんにちは → konnnichiha） |
| ー（长音） | 减号 `-`：コーヒー → ko-hi- |
| 小写假名 | l 或 x 开头：ぁ → la / xa |
| は（助词读 wa） | 仍按字面打 ha |

- 单词上方显示汉字写法和标准罗马字提示；自测、复习时罗马字提示会被模糊遮住，只留汉字和释义。
- 正在输入、还没凑成假名的字母会以灰色小字显示在光标前，按退格先删这些字母。
- 默写模式不看答案，自由转换，按空格提交。
- 发音用有道日语发音，打不开时退回浏览器自带的日语语音（需要系统装有日语语音包）。

## 添加或修改词库

词库源文件是 `jlpt_n5.tsv`，每行一个词，6 列用 Tab 分隔：

```
假名读音	汉字写法	词性	中文释义	例句	例句翻译
たべる	食べる	动	吃	りんごを食(た)べます。	吃苹果。
```

- 读音只能写假名（平假名、片假名、长音 ー）；没有汉字写法的词第二列留空。
- 例句里汉字后面用括号注假名，朗读时会自动去掉括号部分。
- 改完后运行 `node scripts/ja-dict/build.mjs` 重新生成 `public/dicts/ja/word/JLPT_N5.json`，脚本会检查格式。

想加一本新词库（比如 N4）：

1. 照同样格式写 `jlpt_n4.tsv`，运行 `node scripts/ja-dict/build.mjs scripts/ja-dict/jlpt_n4.tsv JLPT_N4.json`。
2. 在 `public/list/word.json`（以及想放到推荐里的话，`public/list/recommend_word.json`）里照 N5 那条复制一份，改 `id`（不能和已有的重复）、`name`、`url`、`length`，`language` 保持 `"ja"`。

也可以不改代码，直接在网页里自建词典或导入：单词栏填假名读音，音标栏填汉字写法，效果相同。

## 改动了哪些文件

| 文件 | 作用 |
| --- | --- |
| `app/core/utils/romaji.ts` | 罗马字→假名引擎（按目标逐键判定 + 默写用的自由转换） |
| `app/components/word/WordTypingCore.vue` | 日语单词的键盘输入改走罗马字引擎，显示未完成的字母 |
| `app/components/word/TypeWord.vue` | 显示汉字写法和罗马字提示；日语词不进入例句逐词输入 |
| `app/components/word/WordMetaPanel.vue` | 修复：例句没有可输入的英文单词时会被误判为“完成”，导致跳词并记错 |
| `app/core/hooks/sound.ts` | 日语单词用日语发音，朗读例句时去掉注音括号 |
| `public/dicts/ja/word/JLPT_N5.json`、`public/list/*.json` | N5 词库与词库列表 |

运行测试：`node --experimental-strip-types scripts/ja-dict/romaji.test.ts`（Node 22+）。

本项目基于 [TypeWords](https://github.com/zyronon/TypeWords)，遵循 GPL-3.0：如果公开发布修改后的版本，需要同样开源。
