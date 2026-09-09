// 进窗后连续下翻（定案 D21 / 验收 TC-13）的纯逻辑：流上下文 + 游标推进 + 续拉判定。
//
// 职责边界：
//  · 本文件不碰 DOM、不发请求——只做「第几条 / 有没有下一条 / 该不该续拉 / 怎么并页」的判断，便于单测；
//  · App 持流状态并负责真正拉取（复用 GET /plaza 的 {items,nextCursor} 信封，契约 §14.1）；
//  · DetailScreen 只负责手势与呈现。
//
// 红线：顺序**沿用进入时那份列表**（从广场进顺广场、从题材进顺该题材），绝不在此另起一套推荐排序。

import type { PlazaCard, Window } from '../types'
import type { CardId, CardOrigin } from '../lib/ids'

export type FeedCategory = NonNullable<Window['category']>

/** 一页列表返回（与契约 §14.1 统一信封同形） */
export interface FeedPage {
  items: PlazaCard[]
  nextCursor: string | null
}

/** 一次浏览的「流上下文」= 进窗时那份列表 + 续拉游标 */
export interface FeedState {
  /**
   * 数组顺序即浏览顺序（沿用进入时的排序，不重排）。
   * 🔴 装的是**成对的两个键**（卡片键 + 窗口键），不是单一的 id——
   * 详情页两组端点各要一个，只留卡片键的话 `/windows/:petId/*` 那一组会静默 404。
   * 见 `lib/ids.ts`。
   */
  cards: CardOrigin[]
  /** 下一页游标；null = 这条流已经到底 */
  nextCursor: string | null
  /** 题材聚合上下文：非空时续拉的页也只保留该题材，跟进入时看到的流一致 */
  category: FeedCategory | null
}

/** 距列表末尾还剩几条就先把下一页拉回来（接近底部预取，翻页时不用等） */
export const PREFETCH_DISTANCE = 3

/** 空流（未打开任何窗时） */
export const EMPTY_FEED: FeedState = { cards: [], nextCursor: null, category: null }

/**
 * 单条上下文：搜索结果 / 消息跳转 / 「我的它」这类没有「一条流」可顺的入口。
 * 这样的上下文 isFeedNavigable=false → 不挂上下翻手势，避免从别处进来却串到广场流里。
 */
export function singleFeed(card: CardOrigin): FeedState {
  return { cards: [card], nextCursor: null, category: null }
}

/** 当前窗在流里的位置；不在流里返回 -1 */
export function indexOf(state: FeedState, cardId: CardId | null): number {
  if (!cardId) return -1
  return state.cards.findIndex((c) => c.id === cardId)
}

/** 上下翻是否可用：只有一条且没有更多 → 不必挂手势 */
export function isFeedNavigable(state: FeedState): boolean {
  return state.cards.length > 1 || state.nextCursor !== null
}

/** 还有上一条（签名与 hasNext 对称，便于调用侧成对使用） */
export function hasPrev(_state: FeedState, index: number): boolean {
  return index > 0
}

/** 还有下一条：本地还有 or 游标还能续拉 */
export function hasNext(state: FeedState, index: number): boolean {
  if (index < 0) return false
  return index < state.cards.length - 1 || state.nextCursor !== null
}

/** 本地已有的下一条；本地到头（需要先续拉）时返回 null */
export function localNextCard(state: FeedState, index: number): CardOrigin | null {
  if (index < 0 || index >= state.cards.length - 1) return null
  return state.cards[index + 1]
}

/** 本地已有的上一条 */
export function localPrevCard(state: FeedState, index: number): CardOrigin | null {
  if (index <= 0) return null
  return state.cards[index - 1]
}

/** 到底了（温柔收尾态判定）：已在最后一条，且游标也没有更多 */
export function atFeedEnd(state: FeedState, index: number): boolean {
  return index >= 0 && index === state.cards.length - 1 && state.nextCursor === null
}

/** 是否该续拉下一页：还有游标，且当前位置已接近列表末尾 */
export function shouldLoadMore(
  state: FeedState,
  index: number,
  distance: number = PREFETCH_DISTANCE,
): boolean {
  if (state.nextCursor === null || index < 0) return false
  return state.cards.length - 1 - index <= distance
}

/**
 * 追加一页：按题材过滤 + 去重后接到流尾，并推进游标。
 * 去重是防串台/防重复的关键——同一条窗绝不在流里出现两次。
 */
export function appendPage(state: FeedState, page: FeedPage): FeedState {
  const seen = new Set(state.cards.map((c) => c.id))
  const fresh: CardOrigin[] = []
  for (const w of page.items) {
    if (state.category && w.presentation?.category !== state.category) continue
    if (seen.has(w.id)) continue
    seen.add(w.id)
    fresh.push({ id: w.id, petId: w.petId })
  }
  return {
    cards: fresh.length ? [...state.cards, ...fresh] : state.cards,
    nextCursor: page.nextCursor,
    category: state.category,
  }
}
