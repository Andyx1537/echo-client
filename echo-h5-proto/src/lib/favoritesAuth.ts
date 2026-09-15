import { ApiError } from '../api/backend'

/** 私有收藏列表对游客返回 1002；不能当成「还没有收下什么」。 */
export function isFavoritesAuthRequired(error: unknown): boolean {
  return error instanceof ApiError
    && (error.code === 1002 || error.detail === 'phone_binding_required')
}
