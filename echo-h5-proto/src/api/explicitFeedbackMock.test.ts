import { beforeEach, describe, expect, it } from 'vitest'
import { adaptationProfile, resetExplicitFeedback, setRecommendationMode, submitExplicitFeedback } from './explicitFeedbackMock'
import type { ExplicitFeedbackInput } from '../types'

const base: ExplicitFeedbackInput = {
  scope: 'private_generation',
  targetType: 'generation_result',
  targetId: 'gen-1',
  questionCode: 'likeness',
  answerCode: 'looks_like_it',
  answerVersion: 1,
  sourceSurface: 'first_generation',
}

describe('explicit feedback mock', () => {
  beforeEach(() => resetExplicitFeedback())

  it('keeps the previous answer when the user changes it', () => {
    const first = submitExplicitFeedback('a1', base)
    const same = submitExplicitFeedback('a1', base)
    const changed = submitExplicitFeedback('a1', { ...base, answerCode: 'not_like_it' })
    expect(same.feedbackId).toBe(first.feedbackId)
    expect(changed.supersedesId).toBe(first.feedbackId)
    expect(changed.status).toBe('active')
  })

  it('can close personalization without dropping the answer', () => {
    submitExplicitFeedback('a1', base)
    const closed = setRecommendationMode('a1', 'non_personalized')
    expect(closed.publicRecommendation.enabled).toBe(false)
    expect(adaptationProfile('a1').recommendationMode).toBe('non_personalized')
  })
})
