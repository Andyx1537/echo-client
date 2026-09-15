import { describe, expect, it, vi } from 'vitest'
import type { OnboardingDetail, OnboardingSnapshot } from '../api/onboardingContract'
import { ONBOARDING_QUESTIONS, answerCountIsValid, canPerform, deriveOnboardingView, firstMissingQuestion, isOnboardingImageFile, pollGenerationProgress, recoverableMessage, restoreOrRestartOnboarding, shouldResumePrivateOnboarding } from './onboardingFlow'

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

  it('keeps candidate and refine behind server allowedActions, and only accepts photos', () => {
    const ready: OnboardingSnapshot = {
      ...snapshot, status: 'candidate_ready', allowedActions: ['select_candidate', 'refine', 'abandon'],
    }
    expect(canPerform(ready, 'select_candidate')).toBe(true)
    expect(canPerform(ready, 'refine')).toBe(true)
    expect(canPerform({ ...ready, allowedActions: ['abandon'] }, 'select_candidate')).toBe(false)
    expect(canPerform({ ...ready, allowedActions: ['abandon'] }, 'refine')).toBe(false)
    expect(isOnboardingImageFile({ type: 'image/jpeg' })).toBe(true)
    expect(isOnboardingImageFile({ type: 'video/mp4' })).toBe(false)
  })

  it('keeps failed asynchronous work recoverable without inventing a failure page state', () => {
    expect(recoverableMessage('generate_failed')).toContain('可以再试一次')
    expect(recoverableMessage('refine_failed')).toContain('原来的候选还在')
    expect(deriveOnboardingView(detail({ snapshot: { ...snapshot, status: 'ready_to_confirm' } }))).toBe('confirming')
  })

  it('resumes only when the server allows return and names the onboarding continuation', () => {
    expect(shouldResumePrivateOnboarding({
      returnToAllowed: true, nextAction: 'resume_private_onboarding',
    })).toBe(true)
    expect(shouldResumePrivateOnboarding({
      returnToAllowed: false, nextAction: 'restart_in_existing_account',
    })).toBe(false)
    expect(shouldResumePrivateOnboarding({
      returnToAllowed: true, nextAction: 'restart_in_existing_account',
    })).toBe(false)
    expect(shouldResumePrivateOnboarding({
      returnToAllowed: false, nextAction: 'resume_private_onboarding',
    })).toBe(false)
  })

  it('retries generation progress with GET only after a failed poll', async () => {
    const generating = {
      onboardingId: 'ob-1',
      status: 'generating' as const,
      generationJob: { jobId: 'job-1', status: 'running' as const, pollAfterMs: 300 },
    }
    const get = vi.fn()
      .mockRejectedValueOnce(new Error('network_unavailable'))
      .mockResolvedValueOnce(detail({ snapshot: { ...snapshot, status: 'candidate_ready', generationJob: null } }))
    const generate = vi.fn()

    await expect(pollGenerationProgress(get, generating)).rejects.toThrow('network_unavailable')
    expect(await pollGenerationProgress(get, generating)).toMatchObject({ snapshot: { status: 'candidate_ready' } })
    expect(get).toHaveBeenCalledTimes(2)
    expect(get).toHaveBeenNthCalledWith(1, 'ob-1')
    expect(get).toHaveBeenNthCalledWith(2, 'ob-1')
    expect(generate).not.toHaveBeenCalled()
  })

  it('does not poll when there is no in-flight generation job', async () => {
    const get = vi.fn()
    expect(await pollGenerationProgress(get, { onboardingId: 'ob-1', status: 'ready_to_generate', generationJob: null })).toBeNull()
    expect(get).not.toHaveBeenCalled()
  })

  it('restarts onboarding after a switch instead of reading the reserved draft', async () => {
    const resume = vi.fn()
    const restart = vi.fn().mockResolvedValue(detail({ snapshot: { ...snapshot, onboardingId: 'fresh' }, assets: [], answers: [] }))
    const result = await restoreOrRestartOnboarding({
      returnToAllowed: false, nextAction: 'restart_in_existing_account',
    }, resume, restart)
    expect(result.resumed).toBe(false)
    expect(result.detail.snapshot.onboardingId).toBe('fresh')
    expect(resume).not.toHaveBeenCalled()
    expect(restart).toHaveBeenCalledOnce()
  })
})
