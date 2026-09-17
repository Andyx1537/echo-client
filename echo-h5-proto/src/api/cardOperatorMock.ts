import type {
  CardOperatorHandleResult,
  CardOperatorTab,
  CardOperatorTicket,
  ModerationMode,
  ModerationSettings,
  WorkAppealAction,
} from '../types'

export interface MockCardTicket {
  moderationId: string
  cardId: string
  submitBy: string
  state: string
  cardStatus: string
  title: string
  body: string
  originType: 'user' | 'official'
  createdAt: number
  handledAt?: number
  appealAt?: number
  appealText?: string
  preAppealStatus?: string
}

export interface CardOpsState {
  tickets: MockCardTicket[]
  settings: ModerationSettings
}

export function freshCardOps(now = Date.now()): CardOpsState {
  return {
    tickets: [
      {
        moderationId: 'cmod_pending_1',
        cardId: 'card_ops_1',
        submitBy: 'acc_lin',
        state: 'pending',
        cardStatus: 'pending',
        title: '窗还留着一条缝',
        body: '晚上风一来，它就会轻轻动一下。',
        originType: 'user',
        createdAt: now - 50 * 60_000,
      },
      {
        moderationId: 'cmod_pending_2',
        cardId: 'card_ops_2',
        submitBy: 'acc_zhou',
        state: 'pending',
        cardStatus: 'pending',
        title: '',
        body: '门口的垫子洗过了，味道却还在。',
        originType: 'user',
        createdAt: now - 80 * 60_000,
      },
      {
        moderationId: 'cmod_appealing_1',
        cardId: 'card_ops_3',
        submitBy: 'acc_mu',
        state: 'appealing',
        cardStatus: 'appealing',
        title: '衣帽钩上还挂着牵引绳',
        body: '每次出门还是会看一眼。',
        originType: 'user',
        createdAt: now - 200 * 60_000,
        handledAt: now - 90 * 60_000,
        appealAt: now - 40 * 60_000,
        appealText: '请再看一眼，这不是给别人看的。',
        preAppealStatus: 'rejected',
      },
      {
        moderationId: 'cmod_handled_1',
        cardId: 'card_ops_4',
        submitBy: 'acc_he',
        state: 'approved',
        cardStatus: 'public',
        title: '碗洗干净了',
        body: '还是放回原来的位置。',
        originType: 'user',
        createdAt: now - 400 * 60_000,
        handledAt: now - 300 * 60_000,
      },
    ],
    settings: { mode: 'review_first', updatedAt: null, updatedBy: null },
  }
}

export function mockCardOperatorQueue(state: CardOpsState, tab: CardOperatorTab = 'pending'): CardOperatorTicket[] {
  return state.tickets
    .filter((ticket) => {
      if (tab === 'pending') return ticket.state === 'pending'
      if (tab === 'appealing') return ticket.state === 'appealing'
      return ticket.handledAt != null && ticket.state !== 'appealing' && ticket.state !== 'pending'
    })
    .sort((a, b) => a.createdAt - b.createdAt)
    .map(toCardTicket)
}

export function mockHandleCard(
  state: CardOpsState,
  moderationId: string,
  action: 'approve' | 'reject' | 'takedown',
  reasonCode?: string,
): CardOperatorHandleResult {
  const ticket = state.tickets.find((item) => item.moderationId === moderationId)
  if (!ticket) {
    throw Object.assign(new Error('这里还空着，没找到你要的内容。'), { code: 2004 })
  }
  if ((action === 'reject' || action === 'takedown') && !reasonCode) {
    throw Object.assign(new Error('还差一个处置理由，选一个就好。'), { code: 2001, detail: 'reason_code_required' })
  }
  const now = Date.now()
  if (action === 'approve') {
    if (ticket.cardStatus !== 'pending') throw conflict()
    ticket.cardStatus = 'public'
    ticket.state = 'approved'
  } else if (action === 'reject') {
    if (ticket.cardStatus !== 'pending') throw conflict()
    ticket.cardStatus = 'rejected'
    ticket.state = 'rejected'
  } else {
    if (ticket.cardStatus !== 'public') throw conflict()
    ticket.cardStatus = 'takendown'
    ticket.state = 'takendown'
  }
  ticket.handledAt = now
  return {
    moderationId: ticket.moderationId,
    cardId: ticket.cardId,
    state: ticket.state,
    cardStatus: ticket.cardStatus,
    handledAt: now,
  }
}

export function mockHandleCardAppeal(
  state: CardOpsState,
  moderationId: string,
  action: WorkAppealAction,
): CardOperatorHandleResult {
  const ticket = state.tickets.find((item) => item.moderationId === moderationId)
  if (!ticket || ticket.state !== 'appealing') {
    throw Object.assign(new Error('这里还空着，没找到你要的内容。'), { code: 2004 })
  }
  const now = Date.now()
  if (action === 'uphold') {
    ticket.cardStatus = ticket.preAppealStatus === 'takendown' ? 'takendown' : 'rejected'
    ticket.state = ticket.cardStatus
  } else {
    ticket.cardStatus = 'pending'
    ticket.state = 'pending'
    ticket.handledAt = undefined
  }
  if (action === 'uphold') ticket.handledAt = now
  return {
    moderationId: ticket.moderationId,
    cardId: ticket.cardId,
    state: ticket.state,
    cardStatus: ticket.cardStatus,
    handledAt: now,
  }
}

export function mockUpdateSettings(state: CardOpsState, mode: ModerationMode, accountId: string): ModerationSettings {
  state.settings = { mode, updatedAt: Date.now(), updatedBy: accountId }
  return state.settings
}

function toCardTicket(ticket: MockCardTicket): CardOperatorTicket {
  return {
    moderationId: ticket.moderationId,
    cardId: ticket.cardId,
    submitBy: ticket.submitBy,
    state: ticket.state,
    cardStatus: ticket.cardStatus,
    cardSnapshot: { title: ticket.title, body: ticket.body },
    originType: ticket.originType,
    createdAt: ticket.createdAt,
    appeal: ticket.appealAt
      ? { appealId: ticket.moderationId, text: ticket.appealText, appealAt: ticket.appealAt }
      : ticket.handledAt
        ? { used: true }
        : null,
  }
}

function conflict(): never {
  throw Object.assign(new Error('这条已经有人处理过了，刷新看看？'), {
    code: 3409,
    detail: 'moderation_state_conflict',
  })
}
