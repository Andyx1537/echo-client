import type { Work } from '../types'

/** 广场点进全屏时带上的那份列表。顺序沿用进入时看到的，不另排。 */
export interface WorkFeed {
  items: Work[]
}

export function indexOfWork(feed: WorkFeed, workId: string | null): number {
  if (!workId) return -1
  return feed.items.findIndex((work) => work.id === workId)
}

export function isWorkFeedNavigable(feed: WorkFeed): boolean {
  return feed.items.length > 1
}

export function localNextWork(feed: WorkFeed, index: number): Work | null {
  if (index < 0 || index >= feed.items.length - 1) return null
  return feed.items[index + 1]
}

export function localPrevWork(feed: WorkFeed, index: number): Work | null {
  if (index <= 0) return null
  return feed.items[index - 1]
}

export const WORK_SWIPE_MIN = 56
export const WORK_SWIPE_AXIS = 1.2

export type WorkImmersiveSwipe = 'back' | 'author' | 'next' | 'prev'

/** 全屏手势：右滑回网格，左滑进作者主页，竖滑翻已加载列表。 */
export function workImmersiveSwipe(dx: number, dy: number, navigable: boolean): WorkImmersiveSwipe | null {
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (dx > WORK_SWIPE_MIN && absX > absY * WORK_SWIPE_AXIS) return 'back'
  if (dx < -WORK_SWIPE_MIN && absX > absY * WORK_SWIPE_AXIS) return 'author'
  if (!navigable || absY < WORK_SWIPE_MIN || absY < absX * WORK_SWIPE_AXIS) return null
  return dy < 0 ? 'next' : 'prev'
}
