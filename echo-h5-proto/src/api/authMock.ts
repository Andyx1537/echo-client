import { mockActivateAnonymousAccount, mockActivatePhoneAccount } from './mock'
import type { AuthApi, Continuation, PhoneResolution } from './authContract'
import { AuthApiError, normalizeMobilePhone } from './authContract'

interface MockChallenge {
  phone: string
  continuation: Continuation
  resolution?: PhoneResolution
}

interface MockAuthStore {
  challenges: Record<string, MockChallenge>
  deviceAccounts: Record<string, string>
}

const KEY = 'echo.mock.auth.v1'

function readStore(): MockAuthStore {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as MockAuthStore) : { challenges: {}, deviceAccounts: {} }
  } catch {
    return { challenges: {}, deviceAccounts: {} }
  }
}

function writeStore(store: MockAuthStore): void {
  try { localStorage.setItem(KEY, JSON.stringify(store)) } catch { /* UI mock may remain page-local. */ }
}

function id(prefix: string): string {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`
}

export const mockAuthApi: AuthApi = {
  async deviceSession(input) {
    const store = readStore()
    const incoming = input.deviceCredential
    const known = incoming ? store.deviceAccounts[incoming] : undefined
    const accountId = known ?? id('account')
    const deviceCredential = known ? incoming! : id('device')
    store.deviceAccounts[deviceCredential] = accountId
    writeStore(store)
    mockActivateAnonymousAccount(accountId)
    return {
      accountId,
      phoneBound: false,
      sessionToken: id('session'),
      deviceCredential,
      deviceCredentialAction: known ? 'restored' : 'issued',
    }
  },

  async createPhoneChallenge(phone, continuation) {
    const normalized = normalizeMobilePhone(phone)
    if (!normalized) throw new AuthApiError('phone_invalid', '请填写完整的手机号和国家/地区代码')
    const store = readStore()
    const challengeId = id('challenge')
    store.challenges[challengeId] = { phone: normalized, continuation }
    writeStore(store)
    return { challengeId, expiresAt: Date.now() + 300_000, resendAvailableAt: Date.now() + 60_000 }
  },

  async verifyPhoneChallenge(challengeId, code) {
    const store = readStore()
    const challenge = store.challenges[challengeId]
    if (!challenge) throw new AuthApiError('challenge_expired', '验证码已经过期，请重新获取')
    if (code !== '9999') throw new AuthApiError('code_invalid', '验证码不太对，请再看一眼')
    const resolution: PhoneResolution = {
      resolution: challenge.phone.endsWith('0000') ? 'switch_existing' : 'bind_current',
      resolutionToken: id('resolution'),
      resolutionExpiresAt: Date.now() + 600_000,
    }
    challenge.resolution = resolution
    store.challenges[resolution.resolutionToken] = challenge
    writeStore(store)
    return resolution
  },

  async confirmPhoneResolution(resolutionToken) {
    const store = readStore()
    const challenge = store.challenges[resolutionToken]
    if (!challenge?.resolution) throw new AuthApiError('resolution_expired', '这次确认已经过期，请重新验证')
    const switched = challenge.resolution.resolution === 'switch_existing'
    const accountId = switched ? `account-${challenge.phone.slice(-4)}` : 'mock-current-account'
    mockActivatePhoneAccount(accountId, !switched)
    delete store.challenges[resolutionToken]
    writeStore(store)
    return {
      accountId,
      phoneBound: true,
      sessionToken: id('session'),
      deviceCredential: null,
      returnToAllowed: !switched && challenge.continuation.intent === 'private_onboarding_generation',
      nextAction: switched
        ? 'restart_in_existing_account'
        : challenge.continuation.intent === 'private_onboarding_generation'
          ? 'resume_private_onboarding'
          : 'open_private_onboarding',
      previousAnonymousCredentialDisposition: switched ? 'retained_as_recovery' : 'revoked',
      ...(switched ? { anonymousRecovery: { recoveryCredential: id('recovery') } } : {}),
    }
  },
}
