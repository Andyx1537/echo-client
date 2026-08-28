// COPY-GUIDE 词表护栏（§2.1 禁用词）。
// 前端侧的最后一道兜底：任何对外文案（尤其 mock 生成/错误文案）过一遍，
// 命中禁用词则温柔改写。真后端也会在服务端强制过滤（契约 §12 #6）。

/** 禁用词 → 推荐替代（对齐 COPY-GUIDE §2.1） */
const REPLACEMENTS: Array<[RegExp, string]> = [
  [/去世|逝世|死亡|死了|亡故/g, '去了那边'],
  [/永别/g, '好好想它的时候，它就在'],
  [/再也见不到/g, '想它的时候它就在'],
  [/你害死|都怪你/g, ''],
]

/** 把一段对外文案过词表：命中禁用词则温柔改写 */
export function gentle(text: string): string {
  let out = text
  for (const [re, to] of REPLACEMENTS) {
    out = out.replace(re, to)
  }
  return out.trim()
}
