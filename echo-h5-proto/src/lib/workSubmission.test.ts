import { describe, expect, it } from 'vitest'
import type { SubmissionCapability, Work } from '../types'
import { canSubmitWork, submissionWaitCopy } from './workSubmission'

const pending: Work = {
  id: 'wk-pending', authorId: 'me', mediaType: 'image', mediaUrl: '/a.jpg', posterUrl: '',
  durationMs: 0, width: 1, height: 1, title: '', excerpt: '', topicIds: [],
  publishedAt: 1, aiGenerated: false, fromCard: false, status: 'pending',
}

describe('work submission capability', () => {
  it('trusts the server flag and never infers from local pending items', () => {
    const items = [pending]
    const allowed: SubmissionCapability = {
      canSubmitWork: true, blockingWorkId: null, blockingStatus: null, nextAction: 'none',
    }
    const blocked: SubmissionCapability = {
      canSubmitWork: false, blockingWorkId: 'wk-pending', blockingStatus: 'pending', nextAction: 'wait',
    }
    expect(canSubmitWork(allowed)).toBe(true)
    expect(canSubmitWork(blocked)).toBe(false)
    expect(canSubmitWork(undefined)).toBe(false)
    expect(submissionWaitCopy(undefined)).toBeNull()
    expect(items.some((work) => work.status === 'pending')).toBe(true)
    expect(canSubmitWork(allowed)).not.toBe(items.every((work) => work.status !== 'pending'))
    expect(submissionWaitCopy(blocked)).toContain('正在处理')
    expect(submissionWaitCopy(allowed)).toBeNull()
  })
})
