import { describe, expect, it } from 'vitest'
import { asCardId, asPetId } from '../lib/ids'
import type { PlazaCard, Window } from '../types'
import {
  EMPTY_FEED,
  PREFETCH_DISTANCE,
  appendPage,
  atFeedEnd,
  hasNext,
  hasPrev,
  indexOf,
  isFeedNavigable,
  localNextCard,
  localPrevCard,
  shouldLoadMore,
  singleFeed,
  type FeedState,
} from './feedLogic'

// TC-13 / D21 纯逻辑单测：序列导航 + 游标推进 + 续拉判定 + 并页去重/题材过滤。

/**
 * 🔴 **卡片键与窗口键在这里刻意取不同的值**（`petId` 前面多一个 `p-`）。
 * 取值相同的 fixture 没法区分「流里带的是卡自己的 petId」还是「拿 id 顶替的」——
 * 而后者正是广场改发回忆卡那天造成静默 404 的那个错。
 */
const petOf = (id: string) => asPetId(`p-${id}`)

function win(id: string, category?: Window['category']): PlazaCard {
  return {
    id: asCardId(id),
    petId: petOf(id),
    title: id,
    excerpt: '',
    cover: '',
    hasCover: false,
    sourceType: 'record',
    topicIds: category ? [category] : [],
    publishedAt: null,
    presentation: {
      category,
      cover: { gradient: '', emoji: '' },
    },
  }
}

// 用例里 ids 照旧写裸字符串，helper 统一盖章成成对的两个键
const feed = (ids: string[], nextCursor: string | null = null, category: FeedState['category'] = null): FeedState => ({
  cards: ids.map((id) => ({ id: asCardId(id), petId: petOf(id) })),
  nextCursor,
  category,
})

/** 流里的卡片键序列，便于用例按裸字符串断言顺序 */
const cardIds = (s: FeedState) => s.cards.map((c) => c.id)

describe('indexOf / 序列导航', () => {
  it('定位当前窗；不在流里返回 -1', () => {
    const s = feed(['a', 'b', 'c'])
    expect(indexOf(s, asCardId('b'))).toBe(1)
    expect(indexOf(s, asCardId('zzz'))).toBe(-1)
    expect(indexOf(s, null)).toBe(-1)
  })

  it('上一条/下一条按进入时的顺序走，不重排', () => {
    const s = feed(['a', 'b', 'c'])
    expect(localNextCard(s, 0)?.id).toBe('b')
    expect(localPrevCard(s, 2)?.id).toBe('b')
    // 首条没有上一条、末条本地没有下一条
    expect(localPrevCard(s, 0)).toBeNull()
    expect(localNextCard(s, 2)).toBeNull()
  })

  it('🔴 翻到的那一条要连窗口键一起交出来——只给卡片键的话详情页会静默 404', () => {
    const s = feed(['a', 'b'])
    expect(localNextCard(s, 0)).toEqual({ id: 'b', petId: 'p-b' })
  })

  it('hasPrev / hasNext：末条但游标还在 → 仍算有下一条（可续拉）', () => {
    expect(hasPrev(feed(['a', 'b']), 0)).toBe(false)
    expect(hasPrev(feed(['a', 'b']), 1)).toBe(true)
    expect(hasNext(feed(['a', 'b']), 1)).toBe(false)
    expect(hasNext(feed(['a', 'b'], 'c2'), 1)).toBe(true)
  })
})

describe('isFeedNavigable（哪些入口才挂上下翻）', () => {
  it('广场那份列表（多条）→ 可上下翻', () => {
    expect(isFeedNavigable(feed(['a', 'b']))).toBe(true)
  })

  it('单条上下文（搜索/消息/我的它）→ 不挂手势，避免串到别的流里', () => {
    expect(isFeedNavigable(singleFeed({ id: asCardId('w-x'), petId: petOf('w-x') }))).toBe(false)
    expect(isFeedNavigable(EMPTY_FEED)).toBe(false)
  })

  it('只有一条但游标还在 → 仍可翻（下一条靠续拉）', () => {
    expect(isFeedNavigable(feed(['a'], 'c1'))).toBe(true)
  })
})

describe('atFeedEnd（到底了 → 温柔收尾态）', () => {
  it('末条且无游标才算到底', () => {
    expect(atFeedEnd(feed(['a', 'b']), 1)).toBe(true)
    expect(atFeedEnd(feed(['a', 'b']), 0)).toBe(false)
    expect(atFeedEnd(feed(['a', 'b'], 'c2'), 1)).toBe(false)
  })
})

describe('shouldLoadMore（接近底部才续拉）', () => {
  it('无游标 → 永不续拉', () => {
    expect(shouldLoadMore(feed(['a', 'b', 'c', 'd', 'e', 'f']), 5)).toBe(false)
  })

  it('离末尾超过预取距离 → 先不拉', () => {
    const s = feed(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'], 'c2')
    expect(shouldLoadMore(s, 0)).toBe(false)
    // 距末尾正好等于预取距离 → 开始拉
    expect(shouldLoadMore(s, s.cards.length - 1 - PREFETCH_DISTANCE)).toBe(true)
  })

  it('已在末尾 → 一定续拉', () => {
    expect(shouldLoadMore(feed(['a', 'b'], 'c2'), 1)).toBe(true)
  })
})

describe('appendPage（游标推进 + 去重 + 题材过滤）', () => {
  it('把下一页接到流尾，并推进游标', () => {
    const next = appendPage(feed(['a'], 'c1'), {
      items: [win('b'), win('c')],
      nextCursor: 'c2',
    })
    expect(cardIds(next)).toEqual(['a', 'b', 'c'])
    expect(next.nextCursor).toBe('c2')
  })

  it('🔴 并页时窗口键取卡自带的 `petId`，不是拿卡片键顶替', () => {
    const next = appendPage(EMPTY_FEED, { items: [win('b')], nextCursor: null })
    expect(next.cards).toEqual([{ id: 'b', petId: 'p-b' }])
  })

  it('nextCursor=null → 流到底', () => {
    const next = appendPage(feed(['a'], 'c1'), { items: [win('b')], nextCursor: null })
    expect(next.nextCursor).toBeNull()
    expect(atFeedEnd(next, 1)).toBe(true)
  })

  it('重复的窗不会二次入流（防串台/防重复）', () => {
    const next = appendPage(feed(['a', 'b'], 'c1'), {
      items: [win('b'), win('c'), win('c')],
      nextCursor: null,
    })
    expect(cardIds(next)).toEqual(['a', 'b', 'c'])
  })

  it('题材上下文下，续拉的页只留该题材（从题材进就顺该题材的流）', () => {
    const s = feed(['t1'], 'c1', 'youth')
    const next = appendPage(s, {
      items: [win('t2', 'youth'), win('p1', 'pet'), win('t3', 'youth')],
      nextCursor: null,
    })
    expect(cardIds(next)).toEqual(['t1', 't2', 't3'])
    expect(next.category).toBe('youth')
  })

  it('整页都被过滤掉时保持原数组引用不变（避免无谓重渲染）', () => {
    const s = feed(['t1'], 'c1', 'youth')
    const next = appendPage(s, { items: [win('p1', 'pet')], nextCursor: 'c2' })
    expect(next.cards).toBe(s.cards)
    expect(next.nextCursor).toBe('c2')
  })
})
