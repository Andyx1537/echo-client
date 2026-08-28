// 会话/令牌存储：游客 token 存 localStorage，随请求头 Authorization: Bearer 携带。
// 绑定手机/微信后 token 不变、账号升级（isGuest=false）。

import type { Session } from '../types'

const KEY = 'echo.session'

let cached: Session | null | undefined

/** 读取当前会话（内存缓存 + localStorage 回退） */
export function getSession(): Session | null {
  if (cached !== undefined) return cached
  try {
    const raw = localStorage.getItem(KEY)
    cached = raw ? (JSON.parse(raw) as Session) : null
  } catch {
    cached = null
  }
  return cached
}

/** 写入会话（登录/建档后刷新） */
export function setSession(session: Session): void {
  cached = session
  try {
    localStorage.setItem(KEY, JSON.stringify(session))
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
  } catch {
    // ignore
  }
}
