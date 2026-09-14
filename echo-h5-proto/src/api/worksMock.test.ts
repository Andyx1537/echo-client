import { describe, expect, it } from 'vitest'
import {
  REUSE_DEMO_BODY,
  REUSE_DEMO_CARD,
  REUSE_DEMO_EVIDENCE,
  REUSE_DEMO_MEDIA,
  REUSE_DEMO_TITLE,
  freshWorks,
  mockPublish,
  mockReviewHash,
} from './worksMock'

describe('work review evidence mock', () => {
  it('reuses a matching ticket and rejects a changed title', () => {
    const state = freshWorks('me')
    const reused = mockPublish(state, {
      mediaType: 'image',
      mediaKey: REUSE_DEMO_MEDIA,
      title: REUSE_DEMO_TITLE,
      body: REUSE_DEMO_BODY,
      sourceCardId: REUSE_DEMO_CARD,
      reviewEvidenceId: REUSE_DEMO_EVIDENCE,
    }, 'me', REUSE_DEMO_MEDIA, '')
    expect(reused.status).toBe('public')
    expect(reused.reviewMode).toBe('reused')
    expect(reused.work.status).toBe('public')

    const changed = freshWorks('me')
    const pending = mockPublish(changed, {
      mediaType: 'image',
      mediaKey: REUSE_DEMO_MEDIA,
      title: '改过就不能复用',
      body: REUSE_DEMO_BODY,
      sourceCardId: REUSE_DEMO_CARD,
      reviewEvidenceId: REUSE_DEMO_EVIDENCE,
    }, 'me', REUSE_DEMO_MEDIA, '')
    expect(pending.status).toBe('pending')
    expect(pending.reviewMode).toBe('full')
    expect(pending.reasonCode).toBe('evidence_content_mismatch')
  })

  it('keeps a user upload in full review', () => {
    const state = freshWorks('me')
    const uploaded = mockPublish(state, {
      mediaType: 'image',
      mediaKey: 'blob:upload',
      title: '自制',
      body: '上传',
    }, 'me', 'blob:upload', '')
    expect(uploaded.status).toBe('pending')
    expect(uploaded.reviewMode).toBe('full')
    expect(uploaded.reasonCode).toBe('user_upload')
    expect(mockReviewHash({
      mediaType: 'image', mediaKey: REUSE_DEMO_MEDIA, title: REUSE_DEMO_TITLE, body: REUSE_DEMO_BODY,
    }, REUSE_DEMO_MEDIA, '')).toContain(REUSE_DEMO_TITLE)
  })
})
