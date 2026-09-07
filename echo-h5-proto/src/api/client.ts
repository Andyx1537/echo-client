// API 客户层入口：按 env 选择真实 HTTP 后端或本地 mock 后端。
// - VITE_API_BASE 非空 → 走真后端（契约 §0，Base URL `${VITE_API_BASE}/api/v1`）。
// - VITE_API_BASE 为空 → 走本地 mock（localStorage 持久化），前端可独立跑通与部署。

import type { Me, Session } from '../types'
import type { EchoBackend } from './backend'
import { authApi } from './auth'
import { applyDeviceSession } from './authContract'
import {
  clearBootstrapOperation,
  getActiveDeviceCredential,
  getOrCreateBootstrapOperation,
} from './authCredentialStore'
import { httpBackend } from './http'
import { mockBackend } from './mock'
import { getSession, setSession } from './session'
import { track } from './track'

/** 是否处于本地 mock 回退模式 */
export const IS_MOCK = !((import.meta.env.VITE_API_BASE as string | undefined)?.trim())

/** 统一后端句柄 */
export const api: EchoBackend = IS_MOCK ? mockBackend : httpBackend

/**
 * 无活动会话时，用服务端签发的不透明设备凭据领取匿名会话，再取 /me。
 * bootstrapNonce 与幂等键在同一次未决请求中保持稳定；客户端从不由设备信息推导账号。
 */
export async function bootstrap(): Promise<{ session: Session; me: Me }> {
  let session = getSession()
  if (!session) {
    const operation = getOrCreateBootstrapOperation()
    const deviceCredential = getActiveDeviceCredential() ?? undefined
    const result = await authApi.deviceSession(
      deviceCredential ? { deviceCredential } : { bootstrapNonce: operation.bootstrapNonce },
      operation.idempotencyKey,
    )
    session = applyDeviceSession(result)
    clearBootstrapOperation()
    track('guest_created', { credentialAction: result.deviceCredentialAction })
  }
  // 拉取账号概要（hasPet 决定是否进建档）
  const me = await api.me()
  // 会话里的 hasPet 以 /me 为准
  if (me.hasPet !== session.hasPet || me.isGuest !== session.isGuest || me.accountId !== session.accountId) {
    session = { ...session, accountId: me.accountId, isGuest: me.isGuest, hasPet: me.hasPet }
    setSession(session)
  }
  return { session, me }
}
