import { ApiError } from './backend'
import type { AdaptationProfile, BehaviorPurpose, ExplicitFeedbackInput, ExplicitFeedbackResult } from '../types'

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
const modes = new Map<string, AdaptationProfile['recommendationMode']>()
const cleared = new Map<string, Set<BehaviorPurpose>>()

export function resetExplicitFeedback(): void {
  rows = []
  seq = 1
  modes.clear()
  cleared.clear()
}

function domain(accountId: string, scope: BehaviorPurpose): { enabled: boolean } {
  if (scope === 'public_recommendation' && modes.get(accountId) === 'non_personalized') {
    return { enabled: false }
  }
  return { enabled: !(cleared.get(accountId)?.has(scope) ?? false) }
}

export function adaptationProfile(accountId: string): AdaptationProfile {
  return {
    recommendationMode: modes.get(accountId) ?? 'personalized',
    uiAdaptation: domain(accountId, 'ui_adaptation'),
    publicRecommendation: domain(accountId, 'public_recommendation'),
    privateGeneration: domain(accountId, 'private_generation'),
  }
}

export function clearAdaptationProfile(accountId: string, scope: BehaviorPurpose): AdaptationProfile {
  const set = cleared.get(accountId) ?? new Set<BehaviorPurpose>()
  set.add(scope)
  cleared.set(accountId, set)
  return adaptationProfile(accountId)
}

export function setRecommendationMode(
  accountId: string,
  mode: AdaptationProfile['recommendationMode'],
): AdaptationProfile {
  modes.set(accountId, mode)
  return adaptationProfile(accountId)
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
