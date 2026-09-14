import { beforeEach, describe, expect, it, vi } from 'vitest'
import { rememberPlazaBatch, reportPlazaSeen, reportWorkOpened } from './phase0'
import type { Work } from '../types'

vi.mock('./client', () => ({
  api: {
    reportBehaviorEvents: vi.fn().mockResolvedValue({ results: [] }),
  },
}))

vi.mock('./session', () => ({
  getSession: () => ({ token: 't', accountId: 'a1', isGuest: true, hasPet: false }),
}))

vi.mock('./authCredentialStore', () => ({
  newIdempotencyKey: () => 'idemp-1',
}))

import { api } from './client'

const work: Work = {
  id: 'w1',
  authorId: 'u1',
  mediaType: 'image',
  mediaUrl: 'x',
  posterUrl: '',
  durationMs: 0,
  width: 1,
  height: 1,
  title: '它最后一个下午',
  excerpt: '光',
  topicIds: [],
  publishedAt: 1,
  aiGenerated: false,
  fromCard: false,
}

describe('phase0 client events', () => {
  beforeEach(() => {
    vi.mocked(api.reportBehaviorEvents).mockClear()
    rememberPlazaBatch('plaza-1', [work])
  })

  it('reports plaza batch and impressions without throwing', async () => {
    reportPlazaSeen([work])
    await Promise.resolve()
    expect(api.reportBehaviorEvents).toHaveBeenCalled()
    const payload = vi.mocked(api.reportBehaviorEvents).mock.calls[0][0]
    expect(payload[0].eventName).toBe('plaza_batch_received')
    expect(payload[1].eventName).toBe('work_impression')
    expect(payload[1].context).not.toHaveProperty('body')
  })

  it('reports work opened from the remembered batch', async () => {
    reportWorkOpened(work)
    await Promise.resolve()
    const payload = vi.mocked(api.reportBehaviorEvents).mock.calls[0][0]
    expect(payload.map((e) => e.eventName)).toEqual(['work_opened', 'comment_panel_opened'])
    expect(payload[0].context).toMatchObject({ batchId: 'plaza-1', position: 0, mediaFormat: 'still' })
  })
})
