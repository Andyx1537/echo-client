import { describe, expect, it } from 'vitest'
import {
  REUSE_DEMO_BODY,
  REUSE_DEMO_CARD,
  REUSE_DEMO_EVIDENCE,
  REUSE_DEMO_MEDIA,
  REUSE_DEMO_TITLE,
  freshWorks,
  mockAppealWork,
  mockPublish,
  mockReviewHash,
  mockWorkModeration,
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

describe('work appeal mock', () => {
  it('lets a rejected work appeal once, then locks appealAt', () => {
    const state = freshWorks('me')
    const rejected = state.works.find((work) => work.status === 'rejected')
    expect(rejected).toBeTruthy()
    const before = mockWorkModeration(state, rejected!.id, 'me')
    expect(before.appealable).toBe(true)
    expect(before.appealUsed).toBe(false)

    const appealed = mockAppealWork(state, rejected!.id, 'me', '请再看一眼')
    expect(appealed.state).toBe('appealing')
    const after = mockWorkModeration(state, rejected!.id, 'me')
    expect(after.appealable).toBe(false)
    expect(after.appealUsed).toBe(true)
    expect(after.appeal?.text).toBe('请再看一眼')

    expect(() => mockAppealWork(state, rejected!.id, 'me', '再申一次')).toThrow()
    try {
      mockAppealWork(state, rejected!.id, 'me', '再申一次')
    } catch (error) {
      expect((error as { detail?: string }).detail).toBe('appeal_already_used')
    }
  })

  it('does not let pending works appeal', () => {
    const state = freshWorks('me')
    const pending = mockPublish(state, {
      mediaType: 'image',
      mediaKey: 'blob:upload',
      title: '待审',
      body: '不能申',
    }, 'me', 'blob:upload', '')
    expect(() => mockAppealWork(state, pending.workId!, 'me', '还没判')).toThrow()
  })
})
