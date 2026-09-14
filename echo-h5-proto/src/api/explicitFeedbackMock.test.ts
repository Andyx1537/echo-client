import { beforeEach, describe, expect, it } from 'vitest'
import { resetExplicitFeedback, submitExplicitFeedback } from './explicitFeedbackMock'
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
})
