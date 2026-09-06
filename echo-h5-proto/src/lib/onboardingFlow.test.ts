import { describe, expect, it } from 'vitest'
import type { OnboardingDetail, OnboardingSnapshot } from '../api/onboardingContract'
import { ONBOARDING_QUESTIONS, answerCountIsValid, deriveOnboardingView, firstMissingQuestion, recoverableMessage } from './onboardingFlow'

const snapshot: OnboardingSnapshot = {
  onboardingId: 'ob-1', accountId: 'acc-1', petName: '它', status: 'collecting', currentStep: 'questionnaire',
  sessionVersion: 3, lastOperation: 'none', allowedActions: ['save_answer'], selectedSubjectId: 's-1',
  selectedCandidateId: null, generationJob: null,
}

function detail(patch: Partial<OnboardingDetail> = {}): OnboardingDetail {
  return {
    snapshot, assets: [], subjectCandidates: [], answers: [], candidates: [],
    memoryUseConsent: { granted: false, consentVersion: 0 }, ...patch,
  }
}

describe('onboarding flow', () => {
  it('restores the first unanswered question from server answers', () => {
    expect(firstMissingQuestion([{ questionId: 'q1', answerCodes: ['home'], answerVersion: '1' }])).toBe('q2')
    expect(deriveOnboardingView(detail())).toBe('questionnaire')
  })

  it('uses server status for binding and async recovery', () => {
    expect(deriveOnboardingView(detail({ snapshot: { ...snapshot, status: 'ready_to_bind' } }))).toBe('binding')
    expect(deriveOnboardingView(detail({ snapshot: { ...snapshot, status: 'generating' } }))).toBe('generating')
  })

  it('requires consent after choosing a candidate', () => {
    expect(deriveOnboardingView(detail({ snapshot: { ...snapshot, status: 'candidate_ready', selectedCandidateId: 'c-1' } }))).toBe('consent')
  })

  it('enforces only presentation cardinality, while server remains authoritative', () => {
    expect(answerCountIsValid('q1', ['home'])).toBe(true)
    expect(answerCountIsValid('q2', ['tiny', 'quiet', 'timid'])).toBe(true)
    expect(answerCountIsValid('q2', ['tiny', 'quiet', 'timid', 'energetic'])).toBe(false)
    expect(answerCountIsValid('q4', ['waits_at_door', 'ordinary_routine'])).toBe(true)
  })

  it('keeps the frozen four-question dictionary and unique stable option codes', () => {
    expect(ONBOARDING_QUESTIONS.map((question) => question.id)).toEqual(['q1', 'q2', 'q3', 'q4'])
    expect(ONBOARDING_QUESTIONS.map((question) => question.max)).toEqual([1, 3, 3, 2])
    const codes = ONBOARDING_QUESTIONS.flatMap((question) => question.options.map((option) => `${question.id}:${option.code}`))
    expect(new Set(codes).size).toBe(codes.length)
    expect(codes).toContain('q3:special_gesture')
    expect(codes).toContain('q4:ordinary_routine')
  })

  it('keeps failed asynchronous work recoverable without inventing a failure page state', () => {
    expect(recoverableMessage('generate_failed')).toContain('可以再试一次')
    expect(recoverableMessage('refine_failed')).toContain('原来的候选还在')
    expect(deriveOnboardingView(detail({ snapshot: { ...snapshot, status: 'ready_to_confirm' } }))).toBe('confirming')
  })
})
