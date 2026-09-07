// 活动会话存储。账号状态以服务端签发结果与 /me 为准；本地只保存当前 Bearer 会话。

import type { Session } from '../types'

const KEY = 'echo.auth.session.v2'
const LEGACY_KEY = 'echo.session'

interface StoredSessionV2 {
  schemaVersion: 2
  session: Session
}

let cached: Session | null | undefined

/** 读取当前会话（内存缓存 + localStorage 回退） */
export function getSession(): Session | null {
  if (cached !== undefined) return cached
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const stored = JSON.parse(raw) as StoredSessionV2
      cached = stored.schemaVersion === 2 ? stored.session : null
      return cached
    }
    // 尚未发布，旧值只作一次结构迁移；账号有效性仍由后端 /me 校验。
    const legacy = localStorage.getItem(LEGACY_KEY)
    cached = legacy ? (JSON.parse(legacy) as Session) : null
    if (cached) setSession(cached)
  } catch {
    cached = null
  }
  return cached
}

/** 写入会话（登录/建档后刷新） */
export function setSession(session: Session): void {
  cached = session
  try {
    const stored: StoredSessionV2 = { schemaVersion: 2, session }
    localStorage.setItem(KEY, JSON.stringify(stored))
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // 存储不可用时仅保留内存态
  }
}

/** 局部更新会话字段（如建档后 hasPet=true、绑定后 isGuest=false） */
export function patchSession(patch: Partial<Session>): Session | null {
  const cur = getSession()
  if (!cur) return null
  const next = { ...cur, ...patch }
  setSession(next)
  return next
}

/** 当前 Bearer token */
export function getToken(): string | null {
  return getSession()?.token ?? null
}

/** 清空会话（登出/重置） */
export function clearSession(): void {
  cached = null
  try {
    localStorage.removeItem(KEY)
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    // ignore
  }
}
