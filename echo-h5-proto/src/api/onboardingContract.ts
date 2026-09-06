import { getSession, setSession } from './session'

export type OnboardingStatus =
  | 'collecting'
  | 'ready_to_bind'
  | 'ready_to_generate'
  | 'generating'
  | 'candidate_ready'
  | 'refining'
  | 'ready_to_confirm'
  | 'confirmed'
  | 'abandoned'

export type OnboardingStep =
  | 'upload'
  | 'subject_select'
  | 'crop'
  | 'questionnaire'
  | 'summary'
  | 'bind'
  | 'generate'
  | 'candidate_select'
  | 'refine'
  | 'confirm'
  | 'done'

export type OnboardingAction =
  | 'upload_asset'
  | 'select_subject'
  | 'save_answer'
  | 'bind_phone'
  | 'generate'
  | 'select_candidate'
  | 'refine'
  | 'confirm'
  | 'abandon'

export interface OnboardingSnapshot {
  onboardingId: string
  accountId: string
  petName: string
  status: OnboardingStatus
  currentStep: OnboardingStep
  sessionVersion: number
  lastOperation: 'none' | 'generate_failed' | 'refine_failed' | 'confirm_failed'
  allowedActions: OnboardingAction[]
  selectedSubjectId: string | null
  selectedCandidateId: string | null
  generationJob: GenerationJob | null
}

export interface GenerationJob {
  jobId: string
  status: 'queued' | 'running'
  pollAfterMs: number
}

export interface OnboardingAsset {
  assetId: string
  resourceId?: string
  url?: string
  mediaType: 'image' | 'video'
  name?: string
}

export interface SubjectCandidate {
  subjectId: string
  label?: string
  modelType?: string
  species?: string
  confidence?: number
  boundingBox?: CropValue
  userSelected?: boolean
}

export interface CropValue {
  x: number
  y: number
  w: number
  h: number
}

export interface OnboardingAnswer {
  questionId: QuestionId
  answerCodes: string[]
  answerVersion: string
  freeText?: string
  freeTextSource?: 'typed' | 'voice_transcript'
}

export interface MemoryUseConsent {
  granted: boolean
  consentVersion: number
  policyVersion?: string
  grantedAt?: number
  withdrawnAt?: number
}

export interface OnboardingCandidate {
  candidateId: string
  imageUrl?: string
  gradient?: string
  emoji?: string
  signature?: string
}

export interface OnboardingDetail {
  snapshot: OnboardingSnapshot
  assets: OnboardingAsset[]
  subjectCandidates: SubjectCandidate[]
  selectedSubject?: SubjectCandidate
  crop?: CropValue
  answers: OnboardingAnswer[]
  candidates: OnboardingCandidate[]
  memoryUseConsent: MemoryUseConsent
  petId?: string
  windowId?: string
}

export type QuestionId = 'q1' | 'q2' | 'q3' | 'q4'

export interface PhoneChallenge {
  challengeId: string
  expiresAt: number
  resendAvailableAt: number
}

export interface PhoneResolution {
  resolution: 'bind_current' | 'switch_existing'
  resolutionToken: string
  resolutionExpiresAt: number
}

export interface PhoneResolutionResult {
  accountId: string
  phoneBound: true
  sessionToken: string
  deviceCredential: null
  returnToAllowed: boolean
  nextAction?: string
}

export interface OnboardingErrorData {
  retryable?: boolean
  currentSnapshot?: OnboardingSnapshot
  currentStateVersion?: number
  retryAfterSeconds?: number
}

export class OnboardingApiError extends Error {
  constructor(
    public readonly code: string | number,
    message: string,
    public readonly detail?: string,
    public readonly data?: OnboardingErrorData,
  ) {
    super(message)
  }
}

export interface OnboardingApi {
  create(petName?: string): Promise<OnboardingDetail>
  get(id: string): Promise<OnboardingDetail>
  updateProfile(id: string, petName: string, version: number): Promise<OnboardingDetail>
  upload(id: string, file: File, version: number): Promise<OnboardingDetail>
  selectSubject(id: string, subjectId: string, crop: CropValue, version: number): Promise<OnboardingDetail>
  saveAnswer(id: string, answer: OnboardingAnswer, version: number): Promise<OnboardingDetail>
  setConsent(id: string, granted: boolean, version: number): Promise<OnboardingDetail>
  generate(id: string, version: number): Promise<OnboardingDetail>
  selectCandidate(id: string, candidateId: string, version: number): Promise<OnboardingDetail>
  refine(id: string, candidateId: string, adjustmentCode: string, version: number): Promise<OnboardingDetail>
  confirm(id: string, candidateId: string, consentVersion: number, version: number): Promise<OnboardingDetail>
  abandon(id: string, version: number): Promise<OnboardingDetail>
  createPhoneChallenge(phone: string): Promise<PhoneChallenge>
  verifyPhoneChallenge(challengeId: string, code: string): Promise<PhoneResolution>
  confirmPhoneResolution(resolutionToken: string): Promise<PhoneResolutionResult>
}

interface Envelope<T> {
  code: number | string
  msg?: string
  detail?: string
  data?: T & OnboardingErrorData
}

interface MutationResult {
  snapshot: OnboardingSnapshot
  assets?: OnboardingAsset[]
  asset?: OnboardingAsset
  subjectCandidates?: SubjectCandidate[]
  selectedSubject?: SubjectCandidate
  crop?: CropValue
  answers?: OnboardingAnswer[]
  candidates?: OnboardingCandidate[]
  memoryUseConsent?: MemoryUseConsent
  petId?: string
  windowId?: string
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const ROOT = `${API_BASE.replace(/\/$/, '')}/api/v1`

export function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `ob-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

async function request<T>(path: string, init: RequestInit = {}, idempotent = false): Promise<T> {
  const token = getSession()?.token
  const headers = new Headers(init.headers)
  if (!(init.body instanceof FormData)) headers.set('Content-Type', 'application/json; charset=utf-8')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (idempotent) headers.set('Idempotency-Key', newIdempotencyKey())

  let response: Response
  try {
    response = await fetch(`${ROOT}${path}`, { ...init, headers })
  } catch (error) {
    throw new OnboardingApiError('network_unavailable', '网络暂时没有连上，刚才的内容还在', undefined, {
      retryable: true,
    })
  }

  let envelope: Envelope<T>
  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    throw new OnboardingApiError('invalid_response', '暂时没能读懂返回内容，请稍后再试')
  }
  if (response.ok && (envelope.code === 0 || envelope.code === '0') && envelope.data) {
    return envelope.data
  }
  throw new OnboardingApiError(
    envelope.code,
    envelope.msg || '这一步暂时没完成，刚才的内容还在',
    envelope.detail,
    envelope.data,
  )
}

function normalizeDetail(raw: OnboardingDetail): OnboardingDetail {
  const apiBase = API_BASE.replace(/\/$/, '')
  const apiUrl = (url?: string) => url && url.startsWith('/') && apiBase ? `${apiBase}${url}` : url
  return {
    ...raw,
    assets: (raw.assets ?? []).map((asset) => ({ ...asset, url: apiUrl(asset.url) })),
    subjectCandidates: raw.subjectCandidates ?? [],
    answers: (raw.answers ?? []).map((answer) => ({
      ...answer,
      questionId: answer.questionId.toLowerCase() as QuestionId,
    })),
    candidates: (raw.candidates ?? []).map((candidate) => ({ ...candidate, imageUrl: apiUrl(candidate.imageUrl) })),
    memoryUseConsent: raw.memoryUseConsent ?? { granted: false, consentVersion: 0 },
  }
}

async function refreshAfter(id: string, mutation: Promise<MutationResult>): Promise<OnboardingDetail> {
  const changed = await mutation
  const fresh = normalizeDetail(await request<OnboardingDetail>(`/pet/onboarding/${encodeURIComponent(id)}`, json('GET')))
  return {
    ...fresh,
    subjectCandidates: fresh.subjectCandidates.length ? fresh.subjectCandidates : changed.subjectCandidates ?? [],
    selectedSubject: fresh.selectedSubject ?? changed.selectedSubject,
    crop: fresh.crop ?? changed.crop,
    petId: changed.petId ?? fresh.petId,
    windowId: changed.windowId ?? fresh.windowId,
  }
}

const json = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
})

export const httpOnboardingApi: OnboardingApi = {
  create: async (petName) => {
    const snapshot = await request<OnboardingSnapshot>(
      '/pet/onboarding',
      json('POST', { flowVersion: 'v1', questionnaireVersion: 'v1', petName }),
      true,
    )
    return normalizeDetail(await request(`/pet/onboarding/${encodeURIComponent(snapshot.onboardingId)}`, json('GET')))
  },
  get: async (id) => normalizeDetail(await request(`/pet/onboarding/${encodeURIComponent(id)}`, json('GET'))),
  updateProfile: (id, petName, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/profile`, json('PATCH', { petName, expectedSessionVersion }), true)),
  upload: async (id, file, expectedSessionVersion) => {
    const form = new FormData()
    form.append('file', file)
    form.append('mediaType', file.type.startsWith('video/') ? 'video' : 'image')
    form.append('expectedSessionVersion', String(expectedSessionVersion))
    return refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/assets`, { method: 'POST', body: form }, true))
  },
  selectSubject: (id, subjectId, crop, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/subject/select`, json('POST', { subjectId, crop, expectedSessionVersion }), true)),
  saveAnswer: (id, answer, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/answers/${answer.questionId}`, json('PUT', { ...answer, expectedSessionVersion }), true)),
  setConsent: (id, granted, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/consent`, json('PUT', { granted, policyVersion: 'memory-use-v1', expectedSessionVersion }), true)),
  generate: (id, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/generate`, json('POST', { expectedSessionVersion }), true)),
  selectCandidate: (id, candidateId, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/candidates/${encodeURIComponent(candidateId)}/select`, json('POST', { expectedSessionVersion }), true)),
  refine: (id, candidateId, adjustmentCode, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/refine`, json('POST', { candidateId, adjustmentCode, expectedSessionVersion }), true)),
  confirm: (id, candidateId, consentVersion, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}/confirm`, json('POST', { candidateId, consentVersion, expectedSessionVersion }), true)),
  abandon: (id, expectedSessionVersion) =>
    refreshAfter(id, request(`/pet/onboarding/${encodeURIComponent(id)}`, json('DELETE', { expectedSessionVersion }), true)),
  createPhoneChallenge: (phone) =>
    request('/auth/phone/challenges', json('POST', { phone, purpose: 'login_or_bind' }), true),
  verifyPhoneChallenge: (challengeId, code) =>
    request(`/auth/phone/challenges/${encodeURIComponent(challengeId)}/verify`, json('POST', { code }), true),
  confirmPhoneResolution: async (resolutionToken) => {
    const result = await request<PhoneResolutionResult>(
      `/auth/phone/resolutions/${encodeURIComponent(resolutionToken)}/confirm`,
      json('POST'),
      true,
    )
    const previous = getSession()
    setSession({
      token: result.sessionToken,
      accountId: result.accountId,
      isGuest: false,
      hasPet: previous?.hasPet ?? false,
    })
    return result
  },
}
