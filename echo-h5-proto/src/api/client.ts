// API 客户层入口：按 env 选择真实 HTTP 后端或本地 mock 后端。
// - VITE_API_BASE 非空 → 走真后端（契约 §0，Base URL `${VITE_API_BASE}/api/v1`）。
// - VITE_API_BASE 为空 → 走本地 mock（localStorage 持久化），前端可独立跑通与部署。

import type { Me, Session } from '../types'
import type { EchoBackend } from './backend'
import { httpBackend } from './http'
import { mockBackend } from './mock'
import { getDeviceId } from './deviceId'
import { getSession, setSession } from './session'
import { track } from './track'

/** 是否处于本地 mock 回退模式 */
export const IS_MOCK = !((import.meta.env.VITE_API_BASE as string | undefined)?.trim())

/** 统一后端句柄 */
export const api: EchoBackend = IS_MOCK ? mockBackend : httpBackend

/**
 * 启动引导：确保拿到游客身份（首次 POST /auth/guest），再取 /me。
 * token 存 localStorage，deviceId 为前端稳定指纹。幂等：已有会话则直接复用。
 */
export async function bootstrap(): Promise<{ session: Session; me: Me }> {
  let session = getSession()
  if (!session) {
    const deviceId = getDeviceId()
    session = await api.authGuest(deviceId)
    setSession(session)
    track('guest_created', { deviceId })
  }
  // 拉取账号概要（hasPet 决定是否进建档）
  const me = await api.me()
  // 会话里的 hasPet 以 /me 为准
  if (me.hasPet !== session.hasPet) {
    session = { ...session, hasPet: me.hasPet }
    setSession(session)
  }
  return { session, me }
}
