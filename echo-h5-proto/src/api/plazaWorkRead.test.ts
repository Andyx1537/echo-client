import { describe, expect, it } from 'vitest'
import { ANON_PLAZA_BATCH, freshWorks, mockPlazaWorks, mockPublicView } from './worksMock'

describe('plaza work read', () => {
  it('public feed hides pending and never gives sourceCardId', () => {
    const state = freshWorks('me')
    state.works.push({
      ...state.works[0],
      id: 'wk_pending_hidden',
      status: 'pending',
      sourceCardId: 'card_secret',
    })
    const page = mockPlazaWorks(state, false, undefined, Date.now())
    expect(page.items.some((work) => work.id === 'wk_pending_hidden')).toBe(false)
    expect(page.items.every((work) => work.sourceCardId === undefined)).toBe(true)
    expect(mockPublicView({ ...state.works[0], sourceCardId: 'card_secret', status: 'public' }))
      .not.toHaveProperty('sourceCardId')
  })

  it('guest freezes about thirty works for two hours', () => {
    const state = freshWorks('me')
    const now = 1_000
    const first = mockPlazaWorks(state, true, undefined, now)
    expect(first.items.length).toBeLessThanOrEqual(ANON_PLAZA_BATCH)
    expect(first.batch?.ids).toHaveLength(first.items.length)

    const again = mockPlazaWorks(state, true, first.batch, now + 30 * 60 * 1000)
    expect(again.items.map((work) => work.id)).toEqual(first.items.map((work) => work.id))

    const bound = mockPlazaWorks(state, false, first.batch, now)
    expect(bound.items.length).toBeGreaterThan(first.items.length)
  })
})
