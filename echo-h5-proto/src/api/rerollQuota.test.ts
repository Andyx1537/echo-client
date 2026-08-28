import { describe, expect, it } from 'vitest'
import {
  DEFAULT_FREE_REROLL_PER_ROUND,
  canReroll,
  consume,
  reconcile,
  remainingFree,
  resolveFreePerRound,
  roundKeyOf,
} from './rerollQuota'

// TC-23 / B7 纯逻辑单测：每轮免费 1 次、换轮回满、脏配置回落默认。

describe('resolveFreePerRound（B7：服务端配置、默认 1、后续可调）', () => {
  it('缺省 → 默认每轮 1 次', () => {
    expect(resolveFreePerRound(undefined)).toBe(DEFAULT_FREE_REROLL_PER_ROUND)
    expect(DEFAULT_FREE_REROLL_PER_ROUND).toBe(1)
    expect(resolveFreePerRound(null)).toBe(1)
    expect(resolveFreePerRound('')).toBe(1)
  })

  it('合法配置生效（后续可调）', () => {
    expect(resolveFreePerRound('2')).toBe(2)
    expect(resolveFreePerRound(3)).toBe(3)
    expect(resolveFreePerRound('0')).toBe(0)
  })

  it('脏配置（负数/小数/非数字）一律回落默认，不放飞额度', () => {
    expect(resolveFreePerRound('-1')).toBe(1)
    expect(resolveFreePerRound('1.5')).toBe(1)
    expect(resolveFreePerRound('随便')).toBe(1)
  })

  it('超大配置被收到上界', () => {
    expect(resolveFreePerRound('999')).toBe(9)
  })
})

describe('roundKeyOf（一轮 = 当前这批近况）', () => {
  it('取最新一条（流按新→旧排）', () => {
    expect(roundKeyOf([{ echoId: 'e-9' }, { echoId: 'e-8' }])).toBe('e-9')
  })
  it('空流 → 空 key', () => {
    expect(roundKeyOf([])).toBe('')
  })
})

describe('每轮免费 1 次', () => {
  it('本轮首次可换，换过一次即用尽', () => {
    const s0 = reconcile(null, 'e-9')
    expect(canReroll(s0)).toBe(true)
    expect(remainingFree(s0)).toBe(1)

    const s1 = consume(s0)
    expect(canReroll(s1)).toBe(false)
    expect(remainingFree(s1)).toBe(0)
  })

  it('用尽后再 consume 也不会把剩余次数算成负数', () => {
    const spent = consume(consume(reconcile(null, 'e-9')))
    expect(remainingFree(spent)).toBe(0)
    expect(canReroll(spent)).toBe(false)
  })

  it('同一轮内刷新/重进：沿用已用次数，不白送第二次', () => {
    const stored = { roundKey: 'e-9', usedFree: 1 }
    const same = reconcile(stored, 'e-9')
    expect(same).toBe(stored) // 原样返回，便于 setState 判等
    expect(canReroll(same)).toBe(false)
  })

  it('它捎来新的近况（换轮）→ 免费次数自然回满', () => {
    const spent = { roundKey: 'e-9', usedFree: 1 }
    const fresh = reconcile(spent, 'e-10')
    expect(fresh).toEqual({ roundKey: 'e-10', usedFree: 0 })
    expect(canReroll(fresh)).toBe(true)
  })

  it('配置调成每轮 2 次时按配置放行', () => {
    const s1 = consume(reconcile(null, 'e-9'))
    expect(canReroll(s1, 2)).toBe(true)
    expect(canReroll(consume(s1), 2)).toBe(false)
  })

  it('配置为 0 时本轮就不提供免费换（温柔提示由 UI 负责）', () => {
    expect(canReroll(reconcile(null, 'e-9'), 0)).toBe(false)
  })
})
