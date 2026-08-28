import { describe, expect, it } from 'vitest'
import { allowsGenerativeEntry } from './generativeEntry'

/**
 * 裁定 `DECISIONS A7` 的行为固化。
 *
 * 这个函数只有四行，但它的两个缺省值**方向相反**（`objectKind` 缺省当宠物、
 * `objectStatus` 缺省当 unknown），最容易被后来的人「顺手统一一下」而改坏。
 * 下面每条用例都对应裁定里的一句话，改红的时候先回去读 `A7`，别改用例。
 */
describe('allowsGenerativeEntry（A7：在世对象的生成入口隐藏而非报错）', () => {
  it('宠物一律放行——S10 第五关对宠物不适用（无人格权）', () => {
    expect(allowsGenerativeEntry({ objectKind: 'pet', objectStatus: 'living' })).toBe(true)
    expect(allowsGenerativeEntry({ objectKind: 'pet', objectStatus: 'unknown' })).toBe(true)
    expect(allowsGenerativeEntry({ objectKind: 'pet', objectStatus: 'deceased' })).toBe(true)
  })

  it('person + living / unknown → 隐藏（A7 唯一必须有明确答案的工程点）', () => {
    expect(allowsGenerativeEntry({ objectKind: 'person', objectStatus: 'living' })).toBe(false)
    expect(allowsGenerativeEntry({ objectKind: 'person', objectStatus: 'unknown' })).toBe(false)
  })

  it('person 缺状态 → 按 unknown 隐藏，🔴 不许猜成 deceased 放行', () => {
    expect(allowsGenerativeEntry({ objectKind: 'person' })).toBe(false)
  })

  it('person + deceased 不被第五关拦（deceased 不在 S10 禁区）', () => {
    // ⚠️ 放行的只是这道入口闸。「人（已离世）」这个**品类**本身仍未立项，
    // 且 A6 要求先有伦理与法务框架——那是品类准入，不由本函数把关。
    expect(allowsGenerativeEntry({ objectKind: 'person', objectStatus: 'deceased' })).toBe(true)
  })

  it('完全缺省 → 放行：P0 档案里没有这两个字段，缺省当 person 会把宠物整个关掉', () => {
    expect(allowsGenerativeEntry({})).toBe(true)
    expect(allowsGenerativeEntry(undefined)).toBe(true)
    expect(allowsGenerativeEntry(null)).toBe(true)
  })

  it('只给了状态没给品类 → 仍按宠物放行（状态单独不构成隐藏理由）', () => {
    expect(allowsGenerativeEntry({ objectStatus: 'living' })).toBe(true)
  })
})
