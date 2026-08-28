import { describe, expect, it } from 'vitest'
import { demoUsers, opsAccount, plazaWindows, seedAuthorPool } from './mock'
import { isTestAccount, isTestContent, testAccounts } from './testData'

// 后端硬口径：测试/非真实用户产生的内容不得计入核心指标、不得占保底位。
// 这组断言守的就是那条口径能落地——标记不漏、账号池全是测试账号、
// 官方号不被误判成测试数据。漏了标记，上线时污染指标的成本远高于这几行。

describe('测试数据标记', () => {
  it('96 条种子内容每条都带 originType=seed_ops，能被 isTestContent 一次认出', () => {
    expect(plazaWindows.length).toBe(96)
    expect(plazaWindows.filter((w) => w.originType === 'seed_ops').length).toBe(96)
    expect(plazaWindows.every(isTestContent)).toBe(true)
  })

  it('内容标记独立于作者：官方号自留的那几条同样带标记', () => {
    const opsHeld = plazaWindows.filter((w) => w.ownerName === opsAccount.nickname)
    expect(opsHeld.length).toBeGreaterThan(0)
    expect(opsHeld.every(isTestContent)).toBe(true)
  })

  it('作者池（demo 用户 + 测试账号）全部是 isSeed，官方号不是', () => {
    expect(seedAuthorPool.length).toBe(demoUsers.length + testAccounts.length)
    expect(seedAuthorPool.every(isTestAccount)).toBe(true)
    expect(isTestAccount(opsAccount)).toBe(false)
    // accountType 与后端 t_account 的闭集对齐，不掺 'test' 这种值
    expect(seedAuthorPool.every((u) => u.accountType === undefined)).toBe(true)
    expect(opsAccount.accountType).toBe('ops')
  })

  it('真实内容与真实账号不会被误伤', () => {
    expect(isTestContent({ originType: 'user' })).toBe(false)
    expect(isTestContent({ originType: 'official' })).toBe(false)
    expect(isTestContent({})).toBe(false)
    expect(isTestAccount({})).toBe(false)
  })
})

describe('内容分摊', () => {
  it('摊在几十个人身上、有长尾、相邻两条不撞作者', () => {
    const byOwner = new Map<string, number>()
    for (const w of plazaWindows) byOwner.set(w.ownerName, (byOwner.get(w.ownerName) ?? 0) + 1)

    // 每个作者都至少有一扇窗 → 搜到谁都点得进去（App.handleOpenUser 的落地前提）
    expect(seedAuthorPool.filter((u) => !byOwner.has(u.nickname))).toEqual([])
    expect(byOwner.size).toBeGreaterThanOrEqual(40)

    const counts = [...byOwner.values()]
    expect(Math.min(...counts)).toBe(1) // 有人只发过一条
    expect(Math.max(...counts)).toBeGreaterThanOrEqual(4) // 也有人发过好几条
    // 但不能堆在少数几个人身上：最高产的一位占比不过 10%
    expect(Math.max(...counts) / plazaWindows.length).toBeLessThan(0.1)

    const adjacent = plazaWindows.filter((w, i) => i > 0 && w.ownerName === plazaWindows[i - 1].ownerName)
    expect(adjacent).toEqual([])
  })
})
