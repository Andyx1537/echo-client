import { afterEach, describe, expect, it, vi } from 'vitest'
import { setSession } from './session'
import {
  httpOnboardingApi,
  type OnboardingDetail,
  type OnboardingSnapshot,
} from './onboardingContract'

const snapshot: OnboardingSnapshot = {
  onboardingId: 'ob-1', accountId: 'acc-1', petName: '它', status: 'collecting', currentStep: 'subject_select',
  sessionVersion: 2, lastOperation: 'none', allowedActions: ['select_subject'], selectedSubjectId: null,
  selectedCandidateId: null, generationJob: null,
}

function detail(patch: Partial<OnboardingDetail> = {}): OnboardingDetail {
  return {
    snapshot, assets: [], subjectCandidates: [], answers: [], candidates: [],
    memoryUseConsent: { granted: false, consentVersion: 0 }, ...patch,
  }
}

function response(data: unknown, ok = true): Response {
  return { ok, json: async () => ({ code: ok ? 0 : 4031, detail: ok ? undefined : 'onboarding_version_conflict', msg: '请刷新', data }) } as Response
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('Onboarding v1 HTTP consumer contract', () => {
  it('creates the session and answers against the same v1 questionnaire contract', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response(snapshot))
      .mockResolvedValueOnce(response(detail()))
    vi.stubGlobal('fetch', fetchMock)

    await httpOnboardingApi.create('麦麦')

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toEqual({
      flowVersion: 'v1',
      questionnaireVersion: 'v1',
      petName: '麦麦',
    })
  })

  it('normalizes backend question IDs and keeps candidateId as the only candidate identity', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(detail({
      answers: [{ questionId: 'Q1' as 'q1', answerCodes: ['home'], answerVersion: 'v1' }],
      candidates: [{ candidateId: 'candidate-1', signature: '熟悉的一刻' }],
    }))))

    const restored = await httpOnboardingApi.get('ob-1')
    expect(restored.answers[0].questionId).toBe('q1')
    expect(restored.candidates[0].candidateId).toBe('candidate-1')
  })

  it('sends server crop shape and reads the authoritative detail after mutation', async () => {
    setSession({ token: 'token-1', accountId: 'acc-1', isGuest: true, hasPet: false })
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(response({ snapshot: { ...snapshot, sessionVersion: 3 } }))
      .mockResolvedValueOnce(response(detail({ snapshot: { ...snapshot, sessionVersion: 3, selectedSubjectId: 'subject-1', currentStep: 'questionnaire' } })))
    vi.stubGlobal('fetch', fetchMock)

    const crop = { x: 0.1, y: 0.2, w: 0.7, h: 0.6 }
    const restored = await httpOnboardingApi.selectSubject('ob-1', 'subject-1', crop, 2)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/pet/onboarding/ob-1/subject/select')
    expect(JSON.parse(init.body as string)).toEqual({ subjectId: 'subject-1', crop, expectedSessionVersion: 2 })
    expect(new Headers(init.headers).get('Idempotency-Key')).toBeTruthy()
    expect(restored.snapshot.sessionVersion).toBe(3)
    expect(fetchMock.mock.calls[1][0]).toContain('/pet/onboarding/ob-1')
  })

  it('branches on stable error detail instead of translated HTTP copy', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({ currentStateVersion: 8, currentSnapshot: snapshot }, false)))
    await expect(httpOnboardingApi.updateProfile('ob-1', '麦麦', 2)).rejects.toMatchObject({
      detail: 'onboarding_version_conflict',
      data: { currentStateVersion: 8 },
    })
  })
})
