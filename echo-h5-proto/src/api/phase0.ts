import { api } from './client'
import { newIdempotencyKey } from './authCredentialStore'
import { getSession } from './session'
import type { BehaviorEventInput, BehaviorPurpose, Work } from '../types'

const SESSION_KEY = 'echo.phase0.session'

type Draft = Omit<BehaviorEventInput, 'idempotencyKey' | 'sessionId' | 'occurredAt' | 'schemaVersion'>

let lastPlaza: { batchId: string; items: Work[] } = { batchId: 'plaza-local', items: [] }

export function rememberPlazaBatch(batchId: string, items: Work[]): void {
  lastPlaza = { batchId, items }
}

export function reportPlazaSeen(items: Work[]): void {
  const batchId = lastPlaza.batchId.startsWith('plaza-') && lastPlaza.items === items
    ? lastPlaza.batchId
    : `plaza-${Date.now()}`
  rememberPlazaBatch(batchId, items)
  const events: Draft[] = [
    {
      eventName: 'plaza_batch_received',
      surface: 'plaza',
      targetType: 'plaza_batch',
      targetId: batchId,
      purposeCode: 'public_recommendation',
      context: { batchId },
    },
    ...items.map((work, position) => plazaWork('work_impression', work, position)),
  ]
  void send(events)
}

export function reportWorkOpened(work: Work): void {
  const position = Math.max(0, lastPlaza.items.findIndex((item) => item.id === work.id))
  void send([
    plazaWork('work_opened', work, position),
    {
      eventName: 'comment_panel_opened',
      surface: 'work_detail',
      targetType: 'comment_panel',
      targetId: work.id,
      purposeCode: 'public_recommendation',
      context: { batchId: lastPlaza.batchId, position, sourceSurface: 'plaza', mediaFormat: mediaFormat(work) },
    },
  ])
}

function plazaWork(eventName: Draft['eventName'], work: Work, position: number): Draft {
  return {
    eventName,
    surface: eventName === 'work_opened' ? 'work_detail' : 'plaza',
    targetType: 'work',
    targetId: work.id,
    purposeCode: 'public_recommendation',
    context: {
      batchId: lastPlaza.batchId,
      position,
      sourceSurface: 'plaza',
      mediaFormat: mediaFormat(work),
    },
  }
}

function mediaFormat(work: Work): 'still' | 'comic' | 'video' {
  return work.mediaType === 'video' ? 'video' : 'still'
}

export async function send(drafts: Draft[]): Promise<void> {
  const session = getSession()
  if (!session) return
  const events: BehaviorEventInput[] = drafts.map((draft) => ({
    ...draft,
    idempotencyKey: newIdempotencyKey(),
    sessionId: sessionId(),
    occurredAt: new Date().toISOString(),
    schemaVersion: 1,
    purposeCode: draft.purposeCode as BehaviorPurpose,
  }))
  try {
    await api.reportBehaviorEvents(events)
  } catch {
    // 埋点失败不挡主操作
  }
}

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY)
    if (existing) return existing
    const next = newIdempotencyKey()
    sessionStorage.setItem(SESSION_KEY, next)
    return next
  } catch {
    return 'session-local'
  }
}
