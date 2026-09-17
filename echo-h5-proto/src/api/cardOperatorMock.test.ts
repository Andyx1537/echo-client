import { describe, expect, it } from 'vitest'
import { freshCardOps, mockCardOperatorQueue, mockHandleCard, mockHandleCardAppeal, mockUpdateSettings } from './cardOperatorMock'

describe('回忆卡运营 mock', () => {
  it('待审通过后进已处置', () => {
    const state = freshCardOps()
    const first = mockCardOperatorQueue(state, 'pending')[0]
    mockHandleCard(state, first.moderationId, 'approve')
    expect(mockCardOperatorQueue(state, 'pending').some((item) => item.moderationId === first.moderationId)).toBe(false)
    expect(mockCardOperatorQueue(state, 'handled').some((item) => item.moderationId === first.moderationId)).toBe(true)
  })

  it('申诉推翻回待审', () => {
    const state = freshCardOps()
    const open = mockCardOperatorQueue(state, 'appealing')[0]
    mockHandleCardAppeal(state, open.moderationId, 'overturn')
    expect(mockCardOperatorQueue(state, 'pending').some((item) => item.moderationId === open.moderationId)).toBe(true)
  })

  it('开关只记当前档', () => {
    const state = freshCardOps()
    const next = mockUpdateSettings(state, 'publish_first', 'me')
    expect(next.mode).toBe('publish_first')
    expect(next.updatedAt).toBeTruthy()
  })

  it('超时只信服务端字段，不自己算', () => {
    const state = freshCardOps()
    const overdue = mockCardOperatorQueue(state, 'pending').find((item) => item.slaBreached)
    expect(overdue?.slaBreached).toBe(true)
    expect(mockCardOperatorQueue(state, 'handled').every((item) => item.slaBreached !== true)).toBe(true)
  })

  it('已公开可下架，不能直接恢复', () => {
    const state = freshCardOps()
    const open = mockCardOperatorQueue(state, 'handled').find((item) => item.cardStatus === 'public')
    expect(open).toBeTruthy()
    mockHandleCard(state, open!.moderationId, 'takedown', 'policy')
    const after = mockCardOperatorQueue(state, 'handled').find((item) => item.moderationId === open!.moderationId)
    expect(after?.cardStatus).toBe('takendown')
    expect(() => mockHandleCard(state, open!.moderationId, 'takedown', 'policy')).toThrow()
  })
})
