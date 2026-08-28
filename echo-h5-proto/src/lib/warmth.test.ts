import { describe, expect, it } from 'vitest'
import { WARMTH_PHRASE, warmthPhrase, warmthTier, type WarmthTier } from './warmth'

const TIERS: WarmthTier[] = ['low', 'mid', 'high']
const ALL = TIERS.map((t) => WARMTH_PHRASE[t])

/**
 * 🔴 这一组测试守的是**产品红线，不是实现细节**。
 *
 * 它存在的理由：上一版的 high 档文案「被很多人记挂着」在库里活了很久，
 * 期间 `warmth.ts` 的注释一直写着「不得出现人数」——**注释没拦住它**。
 * 所以这里把两条红线做成机械判定：改文案时会红，改不动就得先回来读理由。
 */
/**
 * 数量陈述。
 *
 * ⚠️ 汉字数词**只在后面跟着量词时**才算数量——否则「一直」「一起」会被误伤，
 * 那两个恰恰是本套文案要用的时间词。这条边界是写测试时被「它一直被记着」逼出来的。
 */
const QUANTITY =
  /[0-9０-９]|[一二三四五六七八九十百千万](?=[个位人次张条只份群批])|很多|不少|许多|好多|多少|几个|几人|大量|最多|更多|越来越|人次|人数/

/** 视角词：出现它就意味着这句只对某一类读者成立 */
const PERSPECTIVE = /你|您|我(?!们)|咱|主人|ta\b|TA\b|他|她|自己/

describe('暖光文案 · 红线', () => {
  it('🔴 任何一档都不得出现数量陈述（D5：不排名、不比数量）', () => {
    for (const s of ALL) expect(s, `「${s}」含数量陈述`).not.toMatch(QUANTITY)
  })

  it('🔴 一套文案读的人是谁都成立：不得出现视角词', () => {
    // 出现「你 / 主人 / ta」就意味着这句话只对某一类读者成立，
    // 于是必须分两套 —— 而分两套等于在文案层先分叉，以后每改一次维护两份。
    for (const s of ALL) expect(s, `「${s}」含视角词`).not.toMatch(PERSPECTIVE)
  })

  /**
   * 🔴 守卫本身要能报警。
   *
   * 一条永远不会红的红线测试没有价值，而且看不出来它没价值。
   * 这里拿**真的被枪毙过的那几句**去撞它：撞不响，说明上面两条形同虚设。
   */
  it('🔴 守卫对已作废的旧文案确实会报警', () => {
    expect('被很多人记挂着').toMatch(QUANTITY) // 旧 high 档，被枪毙的正是这一句
    expect('已经有 12 个人记得它').toMatch(QUANTITY)
    expect('三个人记得它').toMatch(QUANTITY)
    expect('你一直记得它').toMatch(PERSPECTIVE) // 上一版主人专用那套
    expect('主人一直记得它').toMatch(PERSPECTIVE) // 上一版访客专用那套
  })

  it('时间词不被误判成数量（一直 / 一起 / 一点）', () => {
    for (const s of ['它一直被记着', '有人和它在一起', '光亮了一点']) {
      expect(s, `「${s}」被误判`).not.toMatch(QUANTITY)
    }
  })

  it('三档各不相同，且都不为空', () => {
    expect(new Set(ALL).size).toBe(3)
    for (const s of ALL) expect(s.trim().length).toBeGreaterThan(0)
  })
})

describe('warmthTier / warmthPhrase', () => {
  it('分界点按 0.55 / 0.8 切三段', () => {
    expect(warmthTier(0)).toBe('low')
    expect(warmthTier(0.54)).toBe('low')
    expect(warmthTier(0.55)).toBe('mid')
    expect(warmthTier(0.79)).toBe('mid')
    expect(warmthTier(0.8)).toBe('high')
    expect(warmthTier(1)).toBe('high')
  })

  it('越界不抛错，落进最近的一档', () => {
    expect(warmthTier(-1)).toBe('low')
    expect(warmthTier(99)).toBe('high')
  })

  it('warmthPhrase 与 WARMTH_PHRASE 是同一份，不是抄的第二份', () => {
    for (const t of TIERS) {
      const probe = { low: 0.1, mid: 0.6, high: 0.95 }[t]
      expect(warmthPhrase(probe)).toBe(WARMTH_PHRASE[t])
    }
  })
})
