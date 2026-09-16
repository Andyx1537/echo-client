import { describe, expect, it } from 'vitest'
import type { Work } from '../types'
import { indexOfWork, isWorkFeedNavigable, localNextWork, localPrevWork, workImmersiveSwipe } from './workFeed'

function work(id: string): Work {
  return {
    id,
    authorId: 'a',
    mediaType: 'image',
    mediaUrl: `/${id}.jpg`,
    posterUrl: '',
    durationMs: 0,
    width: 1,
    height: 1,
    title: id,
    excerpt: '',
    topicIds: [],
    publishedAt: 1,
    aiGenerated: false,
    fromCard: false,
  }
}

describe('work immersive feed', () => {
  it('walks the list entered from the plaza, without reordering', () => {
    const feed = { items: [work('a'), work('b'), work('c')] }
    expect(indexOfWork(feed, 'b')).toBe(1)
    expect(localNextWork(feed, 0)?.id).toBe('b')
    expect(localPrevWork(feed, 2)?.id).toBe('b')
    expect(localPrevWork(feed, 0)).toBeNull()
    expect(localNextWork(feed, 2)).toBeNull()
    expect(isWorkFeedNavigable(feed)).toBe(true)
    expect(isWorkFeedNavigable({ items: [work('a')] })).toBe(false)
  })

  it('sends left swipe to the author home, right swipe back to the grid', () => {
    expect(workImmersiveSwipe(-80, 10, true)).toBe('author')
    expect(workImmersiveSwipe(80, 10, true)).toBe('back')
    expect(workImmersiveSwipe(10, -80, true)).toBe('next')
    expect(workImmersiveSwipe(10, 80, true)).toBe('prev')
    expect(workImmersiveSwipe(10, -80, false)).toBeNull()
    expect(workImmersiveSwipe(-20, 10, true)).toBeNull()
  })
})
