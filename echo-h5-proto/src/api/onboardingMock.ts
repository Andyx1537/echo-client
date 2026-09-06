import { getSession, setSession } from './session'
import type {
  MemoryUseConsent,
  OnboardingApi,
  OnboardingCandidate,
  OnboardingDetail,
  OnboardingSnapshot,
  PhoneResolution,
  SubjectCandidate,
} from './onboardingContract'
import { OnboardingApiError } from './onboardingContract'

const STORAGE_KEY = 'echo.mock.private-onboarding.v1'

interface MockSession extends OnboardingDetail {
  pendingJob?: { kind: 'generate' | 'refine'; readyAt: number }
}

interface MockStore {
  sessions: Record<string, MockSession>
  challenges: Record<string, { phone: string; resolution?: PhoneResolution }>
}

function initialStore(): MockStore {
  return { sessions: {}, challenges: {} }
}

function readStore(): MockStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as MockStore) : initialStore()
  } catch {
    return initialStore()
  }
}

function writeStore(store: MockStore): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // The real API remains durable. Mock storage can degrade to the current page only.
  }
}

function id(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

function allowed(detail: MockSession): OnboardingSnapshot['allowedActions'] {
  const status = detail.snapshot.status
  if (status === 'confirmed' || status === 'abandoned') return []
  const actions: OnboardingSnapshot['allowedActions'] = ['abandon']
  if (status === 'collecting') actions.push('upload_asset', 'select_subject', 'save_answer')
  if (status === 'ready_to_bind') actions.push('bind_phone', 'save_answer')
  if (status === 'ready_to_generate') actions.push('generate', 'save_answer')
  if (status === 'candidate_ready') actions.push('select_candidate', 'refine')
  if (status === 'ready_to_confirm') actions.push('refine', 'confirm')
  return actions
}

function touch(detail: MockSession, currentStep?: OnboardingSnapshot['currentStep']): void {
  detail.snapshot.sessionVersion += 1
  if (currentStep) detail.snapshot.currentStep = currentStep
  detail.snapshot.allowedActions = allowed(detail)
}

function assertVersion(detail: MockSession, expected: number): void {
  if (detail.snapshot.sessionVersion !== expected) {
    throw new OnboardingApiError('onboarding_version_conflict', '另一处刚刚更新了建档内容，已为你恢复最新进度', undefined, {
      currentSnapshot: clone(detail.snapshot),
      currentStateVersion: detail.snapshot.sessionVersion,
    })
  }
}

function getMutable(store: MockStore, onboardingId: string): MockSession {
  const detail = store.sessions[onboardingId]
  if (!detail) throw new OnboardingApiError('onboarding_not_found', '这次建档没有找到，可以重新开始')
  return detail
}

function updateReadiness(detail: MockSession): void {
  const answered = new Set(detail.answers.filter((answer) => answer.answerCodes.length).map((answer) => answer.questionId))
  if (answered.size < 4) {
    detail.snapshot.status = 'collecting'
    detail.snapshot.currentStep = 'questionnaire'
    return
  }
  if (getSession()?.isGuest ?? true) {
    detail.snapshot.status = 'ready_to_bind'
    detail.snapshot.currentStep = 'bind'
  } else {
    detail.snapshot.status = 'ready_to_generate'
    detail.snapshot.currentStep = 'generate'
  }
}

function candidateSet(round = 0): OnboardingCandidate[] {
  const palettes = round
    ? [['#b6c8ba', '#e7d9c4'], ['#d4b9a8', '#f0dfc8'], ['#b8aecb', '#e4d7d0']]
    : [['#dabca5', '#f2dfc6'], ['#b5c6ac', '#e8dbc7'], ['#c4b6cf', '#ead9d1']]
  return palettes.map(([a, b], index) => ({
    candidateId: `candidate-${round}-${index + 1}`,
    gradient: `linear-gradient(145deg, ${a}, ${b})`,
    emoji: '🐾',
    signature: round ? '把熟悉的小动作再靠近一点' : '从你记得的日常里，轻轻长出来',
  }))
}

function settleJob(detail: MockSession): void {
  if (!detail.pendingJob || Date.now() < detail.pendingJob.readyAt) return
  const round = detail.pendingJob.kind === 'refine' ? 1 : 0
  detail.candidates = candidateSet(round)
  detail.snapshot.status = 'candidate_ready'
  detail.snapshot.currentStep = 'candidate_select'
  detail.snapshot.generationJob = null
  detail.snapshot.lastOperation = 'none'
  delete detail.pendingJob
  touch(detail)
}

async function fileUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export const mockOnboardingApi: OnboardingApi = {
  async create(petName) {
    const store = readStore()
    const onboardingId = id('onboarding')
    const accountId = getSession()?.accountId ?? 'anonymous'
    const snapshot: OnboardingSnapshot = {
      onboardingId,
      accountId,
      petName: petName?.trim() || '它',
      status: 'collecting',
      currentStep: 'upload',
      sessionVersion: 1,
      lastOperation: 'none',
      allowedActions: ['upload_asset', 'select_subject', 'save_answer', 'abandon'],
      selectedSubjectId: null,
      selectedCandidateId: null,
      generationJob: null,
    }
    const detail: MockSession = {
      snapshot,
      assets: [],
      subjectCandidates: [],
      answers: [],
      candidates: [],
      memoryUseConsent: { granted: false, consentVersion: 0 },
    }
    store.sessions[onboardingId] = detail
    writeStore(store)
    return clone(detail)
  },

  async get(onboardingId) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    settleJob(detail)
    detail.snapshot.allowedActions = allowed(detail)
    writeStore(store)
    return clone(detail)
  },

  async updateProfile(onboardingId, petName, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    detail.snapshot.petName = petName.trim() || '它'
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async upload(onboardingId, file, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    const mediaType = file.type.startsWith('video/') ? 'video' : 'image'
    const assetId = id('asset')
    detail.assets.push({ assetId, url: await fileUrl(file), mediaType, name: file.name })
    if (mediaType === 'image') {
      const multiple = /multi|多只/i.test(file.name)
      const candidates: SubjectCandidate[] = multiple
        ? [
            { subjectId: `${assetId}-left`, label: '左边这只', modelType: 'animal', boundingBox: { x: 0.08, y: 0.16, w: 0.4, h: 0.7 } },
            { subjectId: `${assetId}-right`, label: '右边这只', modelType: 'animal', boundingBox: { x: 0.52, y: 0.16, w: 0.4, h: 0.7 } },
          ]
        : [{ subjectId: `${assetId}-pet`, label: '这只宠物', modelType: 'animal', boundingBox: { x: 0.15, y: 0.1, w: 0.7, h: 0.8 } }]
      detail.subjectCandidates = candidates
      detail.snapshot.currentStep = 'subject_select'
    }
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async selectSubject(onboardingId, subjectId, crop, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    const selected = detail.subjectCandidates.find((subject) => subject.subjectId === subjectId)
    if (!selected) throw new OnboardingApiError('subject_selection_required', '请先选定一只宠物')
    detail.selectedSubject = selected
    detail.crop = crop
    detail.snapshot.selectedSubjectId = subjectId
    detail.snapshot.currentStep = 'questionnaire'
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async saveAnswer(onboardingId, answer, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    const index = detail.answers.findIndex((item) => item.questionId === answer.questionId)
    if (index >= 0) detail.answers[index] = answer
    else detail.answers.push(answer)
    updateReadiness(detail)
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async setConsent(onboardingId, granted, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    const next: MemoryUseConsent = {
      granted,
      consentVersion: detail.memoryUseConsent.consentVersion + 1,
      policyVersion: 'memory-use-v1',
      ...(granted ? { grantedAt: Date.now() } : { withdrawnAt: Date.now() }),
    }
    detail.memoryUseConsent = next
    if (detail.snapshot.selectedCandidateId) {
      detail.snapshot.status = granted ? 'ready_to_confirm' : 'candidate_ready'
      detail.snapshot.currentStep = granted ? 'confirm' : 'candidate_select'
    }
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async generate(onboardingId, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    if (getSession()?.isGuest ?? true) {
      throw new OnboardingApiError('phone_binding_required', '完成手机号验证后，就能继续生成了', undefined, {
        currentSnapshot: clone(detail.snapshot),
      })
    }
    detail.snapshot.status = 'generating'
    detail.snapshot.currentStep = 'generate'
    detail.snapshot.generationJob = { jobId: id('job'), status: 'queued', pollAfterMs: 300 }
    detail.pendingJob = { kind: 'generate', readyAt: Date.now() + 700 }
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async selectCandidate(onboardingId, candidateId, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    if (!detail.candidates.some((candidate) => candidate.candidateId === candidateId)) {
      throw new OnboardingApiError('candidate_not_found', '这张候选已经不在了，请重新选择')
    }
    detail.snapshot.selectedCandidateId = candidateId
    detail.snapshot.status = detail.memoryUseConsent.granted ? 'ready_to_confirm' : 'candidate_ready'
    detail.snapshot.currentStep = detail.memoryUseConsent.granted ? 'confirm' : 'candidate_select'
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async refine(onboardingId, candidateId, _adjustmentCode, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    detail.snapshot.selectedCandidateId = candidateId
    detail.snapshot.status = 'refining'
    detail.snapshot.currentStep = 'refine'
    detail.snapshot.generationJob = { jobId: id('refine'), status: 'queued', pollAfterMs: 300 }
    detail.pendingJob = { kind: 'refine', readyAt: Date.now() + 700 }
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async confirm(onboardingId, candidateId, consentVersion, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    if (!detail.memoryUseConsent.granted) throw new OnboardingApiError('consent_required', '请先确认素材和场景的使用方式')
    if (detail.memoryUseConsent.consentVersion !== consentVersion) {
      throw new OnboardingApiError('consent_version_conflict', '授权状态刚刚变化，请重新确认', undefined, {
        currentSnapshot: clone(detail.snapshot),
      })
    }
    detail.snapshot.selectedCandidateId = candidateId
    detail.snapshot.status = 'confirmed'
    detail.snapshot.currentStep = 'done'
    detail.petId = id('pet')
    detail.windowId = id('window')
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async abandon(onboardingId, version) {
    const store = readStore()
    const detail = getMutable(store, onboardingId)
    assertVersion(detail, version)
    detail.snapshot.status = 'abandoned'
    detail.snapshot.currentStep = 'done'
    touch(detail)
    writeStore(store)
    return clone(detail)
  },

  async createPhoneChallenge(phone) {
    if (!/^1\d{10}$/.test(phone.replace(/\s/g, ''))) throw new OnboardingApiError('phone_invalid', '请检查手机号是否完整')
    const store = readStore()
    const challengeId = id('challenge')
    store.challenges[challengeId] = { phone }
    writeStore(store)
    return { challengeId, expiresAt: Date.now() + 300_000, resendAvailableAt: Date.now() + 60_000 }
  },

  async verifyPhoneChallenge(challengeId, code) {
    const store = readStore()
    const challenge = store.challenges[challengeId]
    if (!challenge) throw new OnboardingApiError('challenge_expired', '验证码已经过期，请重新获取')
    if (code !== '123456') throw new OnboardingApiError('code_invalid', '验证码不太对，请再看一眼')
    const resolution: PhoneResolution = {
      resolution: challenge.phone.endsWith('0000') ? 'switch_existing' : 'bind_current',
      resolutionToken: id('resolution'),
      resolutionExpiresAt: Date.now() + 600_000,
    }
    challenge.resolution = resolution
    store.challenges[resolution.resolutionToken] = challenge
    writeStore(store)
    return resolution
  },

  async confirmPhoneResolution(resolutionToken) {
    const store = readStore()
    const challenge = store.challenges[resolutionToken]
    if (!challenge?.resolution) throw new OnboardingApiError('resolution_expired', '这次确认已经过期，请重新验证')
    const switched = challenge.resolution.resolution === 'switch_existing'
    const previous = getSession()
    const accountId = switched ? `account-${challenge.phone.slice(-4)}` : previous?.accountId ?? id('account')
    const result = {
      accountId,
      phoneBound: true as const,
      sessionToken: id('token'),
      deviceCredential: null,
      returnToAllowed: !switched,
      nextAction: switched ? 'restart_in_existing_account' : undefined,
    }
    setSession({ token: result.sessionToken, accountId, isGuest: false, hasPet: previous?.hasPet ?? false })
    if (!switched) {
      for (const detail of Object.values(store.sessions)) {
        if (detail.snapshot.status === 'ready_to_bind') {
          detail.snapshot.accountId = accountId
          detail.snapshot.status = 'ready_to_generate'
          detail.snapshot.currentStep = 'generate'
          touch(detail)
        }
      }
    }
    delete store.challenges[resolutionToken]
    writeStore(store)
    return result
  },
}
