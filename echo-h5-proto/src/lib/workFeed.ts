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
