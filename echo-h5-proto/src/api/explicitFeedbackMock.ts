import { ApiError } from './backend'
import type { ExplicitFeedbackInput, ExplicitFeedbackResult } from '../types'

const ANSWERS: Record<ExplicitFeedbackInput['questionCode'], string[]> = {
  likeness: ['looks_like_it', 'somewhat_like_it', 'not_like_it'],
  ease: ['easy', 'acceptable', 'difficult'],
  continue_intent: ['continue', 'pause'],
  change_request: ['keep', 'change_scene', 'change_style', 'change_medium', 'regenerate'],
  less_like_this: ['reduce_similar', 'undo_reduce'],
}

interface Row extends ExplicitFeedbackResult {
  accountId: string
  scope: string
  questionCode: string
  targetId: string
  answerCode: string
}

let rows: Row[] = []
let seq = 1

export function resetExplicitFeedback(): void {
  rows = []
  seq = 1
}

export function submitExplicitFeedback(accountId: string, input: ExplicitFeedbackInput): ExplicitFeedbackResult {
  const allowed = ANSWERS[input.questionCode]
  if (!allowed || !allowed.includes(input.answerCode) || input.answerVersion !== 1) {
    throw new ApiError(2001, '这个选择我这边还认不下来。', 'dictionary_entry_unknown')
  }
  const current = rows.find((row) =>
    row.accountId === accountId && row.scope === input.scope
    && row.questionCode === input.questionCode && row.targetId === input.targetId
    && row.status === 'active')
  if (current && current.answerCode === input.answerCode) {
    return { feedbackId: current.feedbackId, status: current.status, supersedesId: current.supersedesId }
  }
  if (current) current.status = 'superseded'
  const next: Row = {
    feedbackId: `fb_${seq++}`,
    accountId,
    scope: input.scope,
    questionCode: input.questionCode,
    targetId: input.targetId,
    answerCode: input.answerCode,
    status: 'active',
    supersedesId: current?.feedbackId ?? null,
  }
  rows = [...rows, next]
  return { feedbackId: next.feedbackId, status: next.status, supersedesId: next.supersedesId }
}
