import { describe, expect, it } from 'vitest'
import { mapRelation, mapRelations, relativeTime, type RawRelationUser } from './relationsMap'

// M-7：后端 /relations 下发 lastActive、reels[].createdAt 皆为毫秒，前端映射为相对时间串。
// 这里保障纯函数映射的分档正确、边界收敛，以及语义字段透传。now 注入使断言确定。

const NOW = 1_700_000_000_000

const rawRelation = (over: Partial<RawRelationUser> = {}): RawRelationUser => ({
  id: 'r1',
  name: '远山',
  avatar: 'linear-gradient(135deg,#f3d9b8,#e0a96c)',
  online: true,
  priority: false,
  mutedUntil: 0,
  lastActive: NOW,
  hasUnseenReel: true,
  viewableByMe: true,
  reels: [],
  pet: null,
  ...over,
})

describe('relativeTime', () => {
  it('分档：刚刚 / 分钟 / 小时 / 天', () => {
    expect(relativeTime(NOW - 30_000, NOW)).toBe('刚刚')
    expect(relativeTime(NOW - 5 * 60_000, NOW)).toBe('5 分钟前')
    expect(relativeTime(NOW - 3 * 3600_000, NOW)).toBe('3 小时前')
    expect(relativeTime(NOW - 26 * 3600_000, NOW)).toBe('1 天前')
    expect(relativeTime(NOW - 2 * 24 * 3600_000, NOW)).toBe('2 天前')
  })

  it('未来/负 diff 收敛为「刚刚」', () => {
    expect(relativeTime(NOW + 10_000, NOW)).toBe('刚刚')
  })
})

describe('mapRelation', () => {
  it('lastActive(ms)→相对串，reels[].createdAt(ms)→time', () => {
    const raw = rawRelation({
      lastActive: NOW - 5 * 60_000,
      reels: [
        { id: 're1', text: 'a', createdAt: NOW - 3 * 3600_000, placeholder: { gradient: 'g', emoji: '🐾' } },
        { id: 're2', text: 'b', createdAt: NOW - 26 * 3600_000, placeholder: { gradient: 'g', emoji: '🌷' } },
      ],
    })
    const vm = mapRelation(raw, NOW)
    expect(vm.lastActive).toBe('5 分钟前')
    expect(vm.reels[0].time).toBe('3 小时前')
    expect(vm.reels[1].time).toBe('1 天前')
    // 语义/透传字段保持
    expect(vm.id).toBe('r1')
    expect(vm.reels[0].text).toBe('a')
    expect(vm.viewableByMe).toBe(true)
  })

  it('reels 缺省时安全为空数组', () => {
    const raw = rawRelation({ reels: undefined as unknown as RawRelationUser['reels'] })
    expect(mapRelation(raw, NOW).reels).toEqual([])
  })
})

describe('mapRelations', () => {
  it('整份列表逐条映射，长度与顺序保持', () => {
    const list = mapRelations(
      [
        rawRelation({ id: 'a', lastActive: NOW - 2 * 60_000 }),
        rawRelation({ id: 'b', name: '近溪', lastActive: NOW - 24 * 3600_000 }),
      ],
      NOW,
    )
    expect(list).toHaveLength(2)
    expect(list[0].id).toBe('a')
    expect(list[0].lastActive).toBe('2 分钟前')
    expect(list[1].lastActive).toBe('1 天前')
    // 映射后 lastActive 为字符串（非毫秒 number）
    expect(typeof list[0].lastActive).toBe('string')
  })
})