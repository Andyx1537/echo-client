import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyPhoneResolution } from '../api/authContract'
import { mockAuthApi } from '../api/authMock'
import { mockOnboardingApi } from '../api/onboardingMock'
import { clearSession, setSession } from '../api/session'
import { restoreOrRestartOnboarding } from './onboardingFlow'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  get length() { return this.values.size }
  clear() { this.values.clear() }
  getItem(key: string) { return this.values.get(key) ?? null }
  key(index: number) { return [...this.values.keys()][index] ?? null }
  removeItem(key: string) { this.values.delete(key) }
  setItem(key: string, value: string) { this.values.set(key, value) }
}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  clearSession()
})

afterEach(() => {
  clearSession()
  vi.unstubAllGlobals()
})

describe('switch-existing onboarding isolation', () => {
  it('starts an empty draft after switching to an existing phone and leaves the reserved session intact', async () => {
    setSession({ token: 'anon-token', accountId: 'anon-1', isGuest: true, hasPet: false })
    const created = await mockOnboardingApi.create('麦麦')
    const id = created.snapshot.onboardingId
    let current = created
    for (const [questionId, answerCodes] of [
      ['q1', ['home']],
      ['q2', ['quiet']],
      ['q3', ['follows_me']],
      ['q4', ['ordinary_routine']],
    ] as const) {
      current = await mockOnboardingApi.saveAnswer(id, {
        questionId, answerCodes, answerVersion: 'v1',
      }, current.snapshot.sessionVersion)
    }
    expect(current.snapshot.status).toBe('ready_to_bind')
    expect(current.answers).toHaveLength(4)

    const challenge = await mockAuthApi.createPhoneChallenge('13800000000', {
      intent: 'private_onboarding_generation', resourceId: id, schemaVersion: 'v1',
    })
    const verified = await mockAuthApi.verifyPhoneChallenge(challenge.challengeId, '9999')
    const confirmed = await mockAuthApi.confirmPhoneResolution(verified.resolutionToken)
    applyPhoneResolution(confirmed)
    expect(confirmed.nextAction).toBe('restart_in_existing_account')

    const { detail, resumed } = await restoreOrRestartOnboarding(
      confirmed,
      () => mockOnboardingApi.get(id),
      () => mockOnboardingApi.create('新的开始'),
    )
    expect(resumed).toBe(false)
    expect(detail.snapshot.onboardingId).not.toBe(id)
    expect(detail.snapshot.petName).toBe('新的开始')
    expect(detail.assets).toEqual([])
    expect(detail.answers).toEqual([])

    const leftover = await mockOnboardingApi.get(id)
    expect(leftover.snapshot.petName).toBe('麦麦')
    expect(leftover.answers).toHaveLength(4)
  })
})
