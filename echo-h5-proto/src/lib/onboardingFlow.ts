import type {
  OnboardingAnswer,
  OnboardingDetail,
  OnboardingSnapshot,
  QuestionId,
} from '../api/onboardingContract'

export type OnboardingView =
  | 'loading'
  | 'upload'
  | 'subject'
  | 'questionnaire'
  | 'summary'
  | 'binding'
  | 'generating'
  | 'candidates'
  | 'consent'
  | 'confirming'
  | 'done'
  | 'abandoned'

export const QUESTION_ORDER: QuestionId[] = ['q1', 'q2', 'q3', 'q4']

export interface OnboardingQuestion {
  id: QuestionId
  title: string
  hint: string
  max: number
  options: Array<{ code: string; label: string }>
}

export const ONBOARDING_QUESTIONS: OnboardingQuestion[] = [
  {
    id: 'q1', title: '第一次见到它，是在哪里？', hint: '选一个最接近的就好。', max: 1,
    options: [
      ['home', '家里'], ['adoption', '领养时'], ['family_friend', '亲友身边'], ['outdoors', '在外面遇见'],
      ['clinic_rescue', '医院或救助站'], ['online', '先在网上看到'], ['unclear', '记不清了'],
    ].map(([code, label]) => ({ code, label })),
  },
  {
    id: 'q2', title: '那时候，什么最让你记住它？', hint: '可以选 1—3 个。', max: 3,
    options: [
      ['tiny', '小小一只'], ['timid', '有点怕人'], ['quiet', '很安静'], ['eye_contact', '一直看着我'],
      ['approached_quickly', '很快靠过来'], ['exploring', '到处探索'], ['tired', '有点疲惫'],
      ['energetic', '精神很好'], ['same_as_now', '和现在差不多'], ['appearance_unclear', '记不清具体样子'],
    ].map(([code, label]) => ({ code, label })),
  },
  {
    id: 'q3', title: '后来，它慢慢有了哪些习惯？', hint: '可以选 1—3 个。', max: 3,
    options: [
      ['follows_me', '跟着我'], ['waits_for_me', '等我回来'], ['nuzzles', '靠过来蹭'],
      ['sleeps_in_spot', '固定位置睡觉'], ['watches_window', '看窗外'], ['runs_to_sound', '听到声音跑来'],
      ['plays_together', '喜欢一起玩'], ['stays_quietly', '自己安静待着'], ['food_motivated', '惦记吃的'],
      ['explores', '到处探索'], ['special_gesture', '有一个特别的小动作'],
    ].map(([code, label]) => ({ code, label })),
  },
  {
    id: 'q4', title: '如果先留下一幅画面，你想从哪一刻开始？', hint: '最多选两个。', max: 2,
    options: [
      ['waits_at_door', '门口等候'], ['sleeps_in_familiar_spot', '熟悉位置睡觉'],
      ['goes_out_together', '一起出门'], ['eats_beside_me', '在身边吃东西'],
      ['watches_me', '看着我做事'], ['being_petted', '被轻轻抚摸'], ['runs_over', '突然跑来'],
      ['ordinary_routine', '普通但反复出现的日常'],
    ].map(([code, label]) => ({ code, label })),
  },
]

export function questionById(id: QuestionId): OnboardingQuestion {
  return ONBOARDING_QUESTIONS.find((question) => question.id === id) ?? ONBOARDING_QUESTIONS[0]
}

export function firstMissingQuestion(answers: OnboardingAnswer[]): QuestionId | null {
  const answered = new Set(answers.filter((answer) => answer.answerCodes.length > 0).map((answer) => answer.questionId))
  return QUESTION_ORDER.find((id) => !answered.has(id)) ?? null
}

export function deriveOnboardingView(detail: OnboardingDetail | null): OnboardingView {
  if (!detail) return 'loading'
  const { snapshot, memoryUseConsent } = detail
  if (snapshot.status === 'confirmed') return 'done'
  if (snapshot.status === 'abandoned') return 'abandoned'
  if (snapshot.status === 'generating' || snapshot.status === 'refining') return 'generating'
  if (snapshot.status === 'ready_to_confirm') return 'confirming'
  if (snapshot.status === 'candidate_ready') {
    if (snapshot.selectedCandidateId && !memoryUseConsent.granted) return 'consent'
    return 'candidates'
  }
  if (snapshot.status === 'ready_to_bind') return 'binding'
  if (snapshot.status === 'ready_to_generate') return 'summary'
  if (snapshot.currentStep === 'subject_select' || snapshot.currentStep === 'crop') return 'subject'
  if (snapshot.currentStep === 'questionnaire') return firstMissingQuestion(detail.answers) ? 'questionnaire' : 'summary'
  if (snapshot.currentStep === 'summary' || snapshot.currentStep === 'bind' || snapshot.currentStep === 'generate') return 'summary'
  return 'upload'
}

export function canPerform(snapshot: OnboardingSnapshot, action: OnboardingSnapshot['allowedActions'][number]): boolean {
  return snapshot.allowedActions.includes(action)
}

export function answerCountIsValid(questionId: QuestionId, codes: string[]): boolean {
  if (questionId === 'q1') return codes.length === 1
  if (questionId === 'q4') return codes.length >= 1 && codes.length <= 2
  return codes.length >= 1 && codes.length <= 3
}

export function recoverableMessage(lastOperation: OnboardingSnapshot['lastOperation']): string | null {
  if (lastOperation === 'generate_failed') return '刚才没有生成成功，你的素材和答案都还在，可以再试一次。'
  if (lastOperation === 'refine_failed') return '这次细化没有完成，原来的候选还在。'
  if (lastOperation === 'confirm_failed') return '窗口还没有建立，确认后可以安全重试。'
  return null
}
