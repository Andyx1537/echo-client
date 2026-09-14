import { describe, expect, it } from 'vitest'
import { freshWorks, mockPlazaWorks, mockPublicView } from './worksMock'
import { freshSocial, mockCommentPage } from './workSocialMock'

describe('foundation combination', () => {
  it('plaza item is the same work you open, with three-plus-two and no favorite count', () => {
    const works = freshWorks('me')
    const publicWork = works.works.find((work) => work.title === '它最后一个下午')
    expect(publicWork).toBeTruthy()
    const plaza = mockPlazaWorks(works, true, undefined, Date.now())
    const card = plaza.items.find((work) => work.id === publicWork?.id)
    expect(card).toBeTruthy()
    expect(card).not.toHaveProperty('status')
    expect(card).not.toHaveProperty('favoriteCount')

    const opened = mockPublicView(publicWork as typeof works.works[0])
    expect(opened.id).toBe(publicWork?.id)
    expect(opened).not.toHaveProperty('sourceCardId')
    expect(opened).not.toHaveProperty('favoriteCount')

    const comments = mockCommentPage(freshSocial(works.works), publicWork!.id, true, 'hot')
    expect(comments.items).toHaveLength(3)
    expect(comments.nextCursor).toBeNull()
    expect(comments.items[0].previewReplies.length).toBeLessThanOrEqual(2)
    expect(comments.items[0].remainingReplyCount).toBeGreaterThan(0)
    expect(comments.items[0].comment).not.toHaveProperty('favoriteCount')
  })
})
