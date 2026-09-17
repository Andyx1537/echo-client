import { describe, expect, it } from 'vitest'
import {
  freshWorks,
  mockHandleWorkAppeal,
  mockHandleWorkModeration,
  mockWorkOperatorQueue,
} from './worksMock'

describe('作品运营台 mock', () => {
  it('待审通过后离开队列，广场能看见', () => {
    const state = freshWorks('me')
    const queued = mockWorkOperatorQueue(state, 'pending')
    expect(queued.length).toBeGreaterThanOrEqual(2)
    const first = queued[0]
    const result = mockHandleWorkModeration(state, first.moderationId, {
      action: 'approve',
      expectedStateVersion: first.stateVersion,
    })
    expect(result.workStatus).toBe('public')
    expect(result.reviewedAt).toBeTruthy()
    expect(mockWorkOperatorQueue(state, 'pending').some((item) => item.moderationId === first.moderationId)).toBe(false)
    expect(state.works.find((work) => work.id === first.workId)?.status).toBe('public')
  })

  it('先不公开要理由，之后作者可申', () => {
    const state = freshWorks('me')
    const first = mockWorkOperatorQueue(state, 'pending')[0]
    expect(() => mockHandleWorkModeration(state, first.moderationId, {
      action: 'reject',
      expectedStateVersion: first.stateVersion,
    })).toThrow(/处置理由/)
    const rejected = mockHandleWorkModeration(state, first.moderationId, {
      action: 'reject',
      expectedStateVersion: first.stateVersion,
      reasonCode: 'policy',
    })
    expect(rejected.workStatus).toBe('rejected')
    expect(mockWorkOperatorQueue(state, 'pending').some((item) => item.moderationId === first.moderationId)).toBe(false)
  })

  it('申诉维持离开申诉栏，推翻回待审', () => {
    const state = freshWorks('me')
    const appealing = mockWorkOperatorQueue(state, 'appealing')
    expect(appealing.length).toBeGreaterThanOrEqual(1)
    const keep = appealing[0]
    const upheld = mockHandleWorkAppeal(state, keep.moderationId, {
      action: 'uphold',
      expectedStateVersion: keep.stateVersion,
    })
    expect(upheld.workStatus).toBe('rejected')
    expect(mockWorkOperatorQueue(state, 'appealing').some((item) => item.moderationId === keep.moderationId)).toBe(false)

    const again = freshWorks('me')
    const open = mockWorkOperatorQueue(again, 'appealing')[0]
    const overturned = mockHandleWorkAppeal(again, open.moderationId, {
      action: 'overturn',
      expectedStateVersion: open.stateVersion,
    })
    expect(overturned.workStatus).toBe('pending')
    expect(mockWorkOperatorQueue(again, 'pending').some((item) => item.moderationId === open.moderationId)).toBe(true)
  })

  it('版本对不上就拒绝写', () => {
    const state = freshWorks('me')
    const first = mockWorkOperatorQueue(state, 'pending')[0]
    expect(() => mockHandleWorkModeration(state, first.moderationId, {
      action: 'approve',
      expectedStateVersion: first.stateVersion + 1,
    })).toThrow(/已经有人处理/)
  })
})
