import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/backend'
import { isFavoritesAuthRequired } from './favoritesAuth'

describe('isFavoritesAuthRequired', () => {
  it('treats 1002 as need bind, not empty list', () => {
    expect(isFavoritesAuthRequired(new ApiError(1002, '先绑定一下手机号吧。', 'phone_binding_required'))).toBe(true)
    expect(isFavoritesAuthRequired(new ApiError(1002, '先绑定一下手机号吧。'))).toBe(true)
  })

  it('does not treat other failures as empty-by-auth', () => {
    expect(isFavoritesAuthRequired(new ApiError(5001, '网络不太好'))).toBe(false)
    expect(isFavoritesAuthRequired(new Error('boom'))).toBe(false)
  })
})
