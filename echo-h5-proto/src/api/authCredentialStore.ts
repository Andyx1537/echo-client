const ACTIVE_DEVICE_KEY = 'echo.auth.device-credential.v1'
const RECOVERY_KEY = 'echo.auth.anonymous-recovery.v1'
const BOOTSTRAP_KEY = 'echo.auth.bootstrap-operation.v1'

interface BootstrapOperation {
  bootstrapNonce: string
  idempotencyKey: string
}

interface RecoveryVault {
  schemaVersion: 1
  credentials: string[]
  /** 切号时留下的建档钥匙；唤醒后写回 `echo.private-onboarding.active.v1`。 */
  drafts?: Record<string, string>
}

const ONBOARDING_ACTIVE_KEY = 'echo.private-onboarding.active.v1'

function readVault(): RecoveryVault {
  try {
    const raw = localStorage.getItem(RECOVERY_KEY)
    if (!raw) return { schemaVersion: 1, credentials: [], drafts: {} }
    const stored = JSON.parse(raw) as RecoveryVault
    return {
      schemaVersion: 1,
      credentials: stored.schemaVersion === 1 ? stored.credentials.filter(Boolean) : [],
      drafts: stored.schemaVersion === 1 && stored.drafts ? stored.drafts : {},
    }
  } catch {
    return { schemaVersion: 1, credentials: [], drafts: {} }
  }
}

function writeVault(vault: RecoveryVault): void {
  localStorage.setItem(RECOVERY_KEY, JSON.stringify({
    schemaVersion: 1,
    credentials: vault.credentials,
    drafts: vault.drafts ?? {},
  }))
}

function random(prefix: string): string {
  const cryptoApi = globalThis.crypto
  if (cryptoApi?.randomUUID) return `${prefix}-${cryptoApi.randomUUID()}`
  if (cryptoApi?.getRandomValues) {
    const bytes = cryptoApi.getRandomValues(new Uint8Array(16))
    const value = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${prefix}-${value}`
  }
  throw new Error('secure_random_unavailable')
}

export function newIdempotencyKey(): string {
  return random('idem')
}

export function getActiveDeviceCredential(): string | null {
  try { return localStorage.getItem(ACTIVE_DEVICE_KEY) } catch { return null }
}

export function setActiveDeviceCredential(value: string | null): void {
  try {
    if (value) localStorage.setItem(ACTIVE_DEVICE_KEY, value)
    else localStorage.removeItem(ACTIVE_DEVICE_KEY)
  } catch {
    // 无持久存储时仍可使用本次活动会话，但刷新后无法恢复匿名账号。
  }
}

export function retainAnonymousRecoveryCredential(value: string, onboardingId?: string): void {
  try {
    const current = readVault()
    const credentials = current.credentials.includes(value) ? current.credentials : [...current.credentials, value]
    const drafts = { ...(current.drafts ?? {}) }
    if (onboardingId) drafts[value] = onboardingId
    writeVault({ schemaVersion: 1, credentials, drafts })
  } catch {
    // 服务端资料仍保留；本机清理或禁用存储时，后续无法从本机唤醒该匿名账号。
  }
}

export function getAnonymousRecoveryCredentials(): string[] {
  return readVault().credentials
}

export function consumeAnonymousRecoveryCredential(value: string): string | null {
  try {
    const current = readVault()
    const onboardingId = current.drafts?.[value] ?? null
    const drafts = { ...(current.drafts ?? {}) }
    delete drafts[value]
    writeVault({
      schemaVersion: 1,
      credentials: current.credentials.filter((item) => item !== value),
      drafts,
    })
    if (onboardingId) localStorage.setItem(ONBOARDING_ACTIVE_KEY, onboardingId)
    return onboardingId
  } catch {
    // 服务端已消费该凭据；本机清不掉只影响列表展示。
    return null
  }
}

export function getOrCreateBootstrapOperation(): BootstrapOperation {
  try {
    const raw = sessionStorage.getItem(BOOTSTRAP_KEY)
    if (raw) return JSON.parse(raw) as BootstrapOperation
    const operation = { bootstrapNonce: random('bootstrap'), idempotencyKey: newIdempotencyKey() }
    sessionStorage.setItem(BOOTSTRAP_KEY, JSON.stringify(operation))
    return operation
  } catch {
    return { bootstrapNonce: random('bootstrap'), idempotencyKey: newIdempotencyKey() }
  }
}

export function clearBootstrapOperation(): void {
  try { sessionStorage.removeItem(BOOTSTRAP_KEY) } catch { /* ignore */ }
}
