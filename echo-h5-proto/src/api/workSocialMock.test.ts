import { describe, expect, it } from 'vitest'
import { freshWorks } from './worksMock'
import { freshSocial, mockCommentPage, mockPostComment } from './workSocialMock'

describe('work comments and favorites mock', () => {
  it('guest only gets three roots and two preview replies', () => {
    const works = freshWorks('me')
    const state = freshSocial(works.works)
    const page = mockCommentPage(state, works.works[0].id, true, 'hot')
    expect(page.items).toHaveLength(3)
    expect(page.nextCursor).toBeNull()
    expect(page.items[0].previewReplies.length).toBeLessThanOrEqual(2)
    expect(page.items[0].remainingReplyCount).toBeGreaterThan(0)
    expect(page.items[0].repliesCursor).toBeNull()
  })

  it('does not expose a favorite count on comments', () => {
    const works = freshWorks('me')
    const state = freshSocial(works.works)
    mockPostComment(state, works.works[0].id, 'me', '我', '留下一句')
    const page = mockCommentPage(state, works.works[0].id, false, 'latest')
    expect(page.items[0].comment).not.toHaveProperty('favoriteCount')
  })
})
