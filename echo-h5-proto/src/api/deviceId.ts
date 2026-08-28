// 前端生成的稳定设备指纹（POST /auth/guest 入参）。
// 首次生成后落 localStorage，之后同设备幂等返回同一 deviceId → 后端返回同账号。

const KEY = 'echo.deviceId'

/** 生成一个足够稳定、够随机的匿名设备指纹 */
function generate(): string {
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  // 混入一点点浏览器环境信息，降低跨设备碰撞概率（仍然匿名，不含 PII）
  const env = [navigator.userAgent, navigator.language, screen.width, screen.height]
    .join('|')
  let hash = 0
  for (let i = 0; i < env.length; i++) {
    hash = (hash * 31 + env.charCodeAt(i)) | 0
  }
  return `dev_${Math.abs(hash).toString(36)}_${rand}`
}

/** 取当前设备指纹（不存在则生成并持久化） */
export function getDeviceId(): string {
  try {
    const existing = localStorage.getItem(KEY)
    if (existing) return existing
    const id = generate()
    localStorage.setItem(KEY, id)
    return id
  } catch {
    // localStorage 不可用（隐私模式等）时降级为会话内随机指纹
    return generate()
  }
}
