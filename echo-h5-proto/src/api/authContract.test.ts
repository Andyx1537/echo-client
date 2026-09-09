import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  applyDeviceSession,
  applyPhoneResolution,
  httpAuthApi,
  type PhoneResolutionResult,
} from './authContract'
import {
  clearBootstrapOperation,
  consumeAnonymousRecoveryCredential,
  getActiveDeviceCredential,
  getAnonymousRecoveryCredentials,
  getOrCreateBootstrapOperation,
  retainAnonymousRecoveryCredential,
  setActiveDeviceCredential,
} from './authCredentialStore'
import { clearSession, getSession, setSession } from './session'
import { afterIdentityRefresh } from '../lib/phoneLoginFlow'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

function response(data: unknown, ok = true): Response {
  return { ok, json: async () => ok ? { code: 0, data } : data } as Response
}

beforeEach(() => {
  vi.unstubAllGlobals()
  vi.stubGlobal('localStorage', new MemoryStorage())
  vi.stubGlobal('sessionStorage', new MemoryStorage())
  clearSession()
})

describe('phone-account-resolution-v1 frontend boundary', () => {
  it('keeps bootstrap nonce and idempotency key stable until the operation is cleared', () => {
    const first = getOrCreateBootstrapOperation()
    expect(getOrCreateBootstrapOperation()).toEqual(first)
    clearBootstrapOperation()
    expect(getOrCreateBootstrapOperation()).not.toEqual(first)
  })

  it('stores the active device credential separately from the active session', () => {
    applyDeviceSession({
      accountId: 'anon-1', phoneBound: false, sessionToken: 'anon-token',
      deviceCredential: 'device-1', deviceCredentialAction: 'issued',
    })
    expect(getSession()).toMatchObject({ accountId: 'anon-1', token: 'anon-token', isGuest: true })
    expect(getActiveDeviceCredential()).toBe('device-1')
    expect(getAnonymousRecoveryCredentials()).toEqual([])
  })

  it('bind_current revokes the active device credential and replaces the session', () => {
    setActiveDeviceCredential('device-current')
    const result: PhoneResolutionResult = {
      accountId: 'anon-1', phoneBound: true, sessionToken: 'bound-token', deviceCredential: null,
      returnToAllowed: true, nextAction: 'resume_private_onboarding',
      previousAnonymousCredentialDisposition: 'revoked',
    }
    applyPhoneResolution(result)
    expect(getActiveDeviceCredential()).toBeNull()
    expect(getAnonymousRecoveryCredentials()).toEqual([])
    expect(getSession()).toMatchObject({ accountId: 'anon-1', token: 'bound-token', isGuest: false })
  })

  it('accepts nextAction none for account-center login without a continuation target', () => {
    setActiveDeviceCredential('device-current')
    applyPhoneResolution({
      accountId: 'anon-1', phoneBound: true, sessionToken: 'bound-token', deviceCredential: null,
      returnToAllowed: false, nextAction: 'none',
      previousAnonymousCredentialDisposition: 'revoked',
    })
    expect(getActiveDeviceCredential()).toBeNull()
    expect(getSession()).toMatchObject({ accountId: 'anon-1', token: 'bound-token', isGuest: false })
  })

  it('switch_existing moves the anonymous credential into the sleeping recovery vault', () => {
    setActiveDeviceCredential('device-current')
    applyPhoneResolution({
      accountId: 'phone-account', phoneBound: true, sessionToken: 'phone-token', deviceCredential: null,
      returnToAllowed: false, nextAction: 'restart_in_existing_account',
      previousAnonymousCredentialDisposition: 'retained_as_recovery',
      anonymousRecovery: { recoveryCredential: 'recovery-1' },
    }, 'onboarding-reserved')
    expect(getActiveDeviceCredential()).toBeNull()
    expect(getAnonymousRecoveryCredentials()).toEqual(['recovery-1'])
    expect(getSession()).toMatchObject({ accountId: 'phone-account', token: 'phone-token', isGuest: false })
    expect(consumeAnonymousRecoveryCredential('recovery-1')).toBe('onboarding-reserved')
    expect(localStorage.getItem('echo.private-onboarding.active.v1')).toBe('onboarding-reserved')
    expect(getAnonymousRecoveryCredentials()).toEqual([])
  })

  it('rejects an incomplete switch response before changing anonymous credentials or session', () => {
    setSession({ token: 'anon-token', accountId: 'anon-1', isGuest: true, hasPet: false })
    setActiveDeviceCredential('device-current')
    expect(() => applyPhoneResolution({
      accountId: 'phone-account', phoneBound: true, sessionToken: 'phone-token', deviceCredential: null,
      returnToAllowed: false, nextAction: 'restart_in_existing_account',
      previousAnonymousCredentialDisposition: 'retained_as_recovery',
    })).toThrowError('当前账号没有变化')
    expect(getActiveDeviceCredential()).toBe('device-current')
    expect(getAnonymousRecoveryCredentials()).toEqual([])
    expect(getSession()).toMatchObject({ token: 'anon-token', accountId: 'anon-1', isGuest: true })
  })

  it('does not replace the anonymous session when confirm fails', async () => {
    setSession({ token: 'anon-token', accountId: 'anon-1', isGuest: true, hasPet: false })
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ code: 'resolution_expired', msg: 'expired' }, false)))
    await expect(httpAuthApi.confirmPhoneResolution('resolution-1', 'same-key')).rejects.toMatchObject({ code: 'resolution_expired' })
    expect(getSession()).toMatchObject({ token: 'anon-token', accountId: 'anon-1', isGuest: true })
  })

  it('sends only the frozen continuation shape and caller-owned stable Idempotency-Key', async () => {
    const fetchMock = vi.fn().mockResolvedValue(response({ challengeId: 'c1', expiresAt: 1, resendAvailableAt: 1 }))
    vi.stubGlobal('fetch', fetchMock)
    await httpAuthApi.createPhoneChallenge('+8613800000000', {
      intent: 'private_onboarding_generation', resourceId: 'onboarding-1', schemaVersion: 'v1',
    }, 'stable-key')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('stable-key')
    expect(JSON.parse(init.body as string)).toEqual({
      phone: '+8613800000000', purpose: 'login_or_bind',
      continuation: { intent: 'private_onboarding_generation', resourceId: 'onboarding-1', schemaVersion: 'v1' },
    })
  })

  it('recovers the reserved anonymous session without sending accountId', async () => {
    retainAnonymousRecoveryCredential('recovery-1')
    const fetchMock = vi.fn().mockResolvedValue(response({
      accountId: 'anon-old', phoneBound: false, sessionToken: 'woken-token',
      deviceCredential: 'device-woken', deviceCredentialAction: 'recovered',
    }))
    vi.stubGlobal('fetch', fetchMock)
    const result = await httpAuthApi.recoverAnonymousSession('recovery-1', 'wake-key')
    applyDeviceSession(result)
    consumeAnonymousRecoveryCredential('recovery-1')
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(new Headers(init.headers).get('Idempotency-Key')).toBe('wake-key')
    expect(new Headers(init.headers).has('Authorization')).toBe(false)
    expect(JSON.parse(init.body as string)).toEqual({ recoveryCredential: 'recovery-1' })
    expect(getSession()).toMatchObject({ accountId: 'anon-old', token: 'woken-token', isGuest: true })
    expect(getActiveDeviceCredential()).toBe('device-woken')
    expect(getAnonymousRecoveryCredentials()).toEqual([])
  })

  it('refreshes /me projection before continuing after a phone account switch', async () => {
    const order: string[] = []
    const value = await afterIdentityRefresh(
      async () => { order.push('me') },
      async () => { order.push('continue'); return 'done' },
    )
    expect(value).toBe('done')
    expect(order).toEqual(['me', 'continue'])
  })
})
