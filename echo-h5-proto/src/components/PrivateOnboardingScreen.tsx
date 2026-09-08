import { useEffect, useMemo, useRef, useState } from 'react'
import { onboardingApi } from '../api/onboarding'
import {
  OnboardingApiError,
  type CropValue,
  type OnboardingAnswer,
  type OnboardingCandidate,
  type OnboardingDetail,
  type QuestionId,
  type SubjectCandidate,
} from '../api/onboardingContract'
import { usePhoneLogin } from './PhoneLoginCoordinator'
import { afterIdentityRefresh } from '../lib/phoneLoginFlow'
import {
  ONBOARDING_QUESTIONS,
  canPerform,
  deriveOnboardingView,
  firstMissingQuestion,
  questionById,
  recoverableMessage,
} from '../lib/onboardingFlow'
import '../styles/privateOnboarding.css'

interface Props {
  onComplete: (petId: string) => void
  onSkip: () => void
  onIdentityChanged: () => Promise<void>
}

const ACTIVE_KEY = 'echo.private-onboarding.active.v1'
const DEFAULT_CROP: CropValue = { x: 0.1, y: 0.1, w: 0.8, h: 0.8 }

function errorKind(error: unknown): string {
  if (!(error instanceof OnboardingApiError)) return 'unknown'
  return String(error.detail || error.code)
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : '这一步暂时没有完成，刚才的内容还在。'
}

function storeActive(id: string | null): void {
  try {
    if (id) localStorage.setItem(ACTIVE_KEY, id)
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    // 服务端快照仍是权威；浏览器禁用存储时只失去本机恢复入口。
  }
}

function readActive(): string | null {
  try {
    return localStorage.getItem(ACTIVE_KEY)
  } catch {
    return null
  }
}

function candidateStyle(candidate: OnboardingCandidate): React.CSSProperties {
  if (candidate.imageUrl) return { backgroundImage: `url(${candidate.imageUrl})` }
  return { background: candidate.gradient || 'linear-gradient(145deg,#d8c0ad,#efe0ca)' }
}

export default function PrivateOnboardingScreen({ onComplete, onSkip, onIdentityChanged }: Props) {
  const [detail, setDetail] = useState<OnboardingDetail | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [pollRetry, setPollRetry] = useState(0)
  const [editingQuestion, setEditingQuestion] = useState<QuestionId | null>(null)
  const [draftCodes, setDraftCodes] = useState<string[]>([])
  const [freeText, setFreeText] = useState('')
  const [petName, setPetName] = useState('')
  const [pickedSubject, setPickedSubject] = useState<SubjectCandidate | null>(null)
  const [crop, setCrop] = useState<CropValue>(DEFAULT_CROP)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const { login } = usePhoneLogin()
  const mounted = useRef(true)

  async function createFresh(): Promise<OnboardingDetail> {
    const created = await onboardingApi.create()
    storeActive(created.snapshot.onboardingId)
    return created
  }

  useEffect(() => {
    mounted.current = true
    void (async () => {
      try {
        const active = readActive()
        const restored = active ? await onboardingApi.get(active) : await createFresh()
        if (!mounted.current) return
        setDetail(restored)
        setPetName(restored.snapshot.petName === '它' ? '' : restored.snapshot.petName)
      } catch (cause) {
        if (!mounted.current) return
        const kind = errorKind(cause)
        if (kind === 'onboarding_not_found' || kind === 'onboarding_forbidden') {
          try {
            const fresh = await createFresh()
            if (mounted.current) setDetail(fresh)
          } catch (next) {
            if (mounted.current) setError(errorMessage(next))
          }
        } else {
          setError(errorMessage(cause))
        }
      }
    })()
    return () => {
      mounted.current = false
      if (localPreview) URL.revokeObjectURL(localPreview)
    }
    // localPreview is deliberately not a dependency: only revoke the final URL on unmount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const job = detail?.snapshot.generationJob
    if (!detail || !job || !['generating', 'refining'].includes(detail.snapshot.status)) return
    const timer = window.setTimeout(async () => {
      try {
        const next = await onboardingApi.get(detail.snapshot.onboardingId)
        if (mounted.current) setDetail(next)
      } catch (cause) {
        if (mounted.current) setError(errorMessage(cause))
      }
    }, Math.max(300, job.pollAfterMs || 1500))
    return () => window.clearTimeout(timer)
  }, [detail, pollRetry])

  async function run(task: (current: OnboardingDetail) => Promise<OnboardingDetail>): Promise<OnboardingDetail | null> {
    if (!detail || busy) return null
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const next = await task(detail)
      setDetail(next)
      setPetName(next.snapshot.petName === '它' ? '' : next.snapshot.petName)
      return next
    } catch (cause) {
      const kind = errorKind(cause)
      if (cause instanceof OnboardingApiError && cause.data?.currentSnapshot) {
        try {
          const latest = await onboardingApi.get(cause.data.currentSnapshot.onboardingId)
          setDetail(latest)
          setNotice(kind === 'onboarding_version_conflict' ? '另一处刚更新了内容，已恢复到最新进度。' : null)
        } catch {
          // 原错误仍是对用户最有用的反馈。
        }
      }
      setError(errorMessage(cause))
      return null
    } finally {
      setBusy(false)
    }
  }

  const view = deriveOnboardingView(detail)
  const recovery = detail ? recoverableMessage(detail.snapshot.lastOperation) : null
  const firstMissing = detail ? firstMissingQuestion(detail.answers) : null
  const currentQuestion = editingQuestion ?? firstMissing
  const answerMap = useMemo(
    () => new Map(detail?.answers.map((answer) => [answer.questionId, answer]) ?? []),
    [detail?.answers],
  )

  function openQuestion(id: QuestionId): void {
    const answer = answerMap.get(id)
    setEditingQuestion(id)
    setDraftCodes(answer?.answerCodes ?? [])
    setFreeText(answer?.freeText ?? '')
    setError(null)
  }

  function toggleCode(codeValue: string, max: number): void {
    setDraftCodes((current) => {
      if (current.includes(codeValue)) return current.filter((value) => value !== codeValue)
      if (max === 1) return [codeValue]
      if (current.length >= max) return current
      return [...current, codeValue]
    })
  }

  async function saveQuestion(id: QuestionId): Promise<void> {
    const question = questionById(id)
    if (!draftCodes.length) {
      setError('先选一个最接近的答案吧。')
      return
    }
    const answer: OnboardingAnswer = {
      questionId: id,
      answerCodes: draftCodes,
      answerVersion: 'v1',
      ...(id === 'q3' && draftCodes.includes('special_gesture') && freeText.trim()
        ? { freeText: freeText.trim(), freeTextSource: 'typed' as const }
        : {}),
    }
    const next = await run((current) => onboardingApi.saveAnswer(
      current.snapshot.onboardingId,
      answer,
      current.snapshot.sessionVersion,
    ))
    if (!next) return
    const missing = firstMissingQuestion(next.answers)
    setEditingQuestion(missing)
    setDraftCodes(missing ? answerMap.get(missing)?.answerCodes ?? [] : [])
    setFreeText('')
    if (!missing) setNotice(`关于${next.snapshot.petName}的第一幅画面，已经有了清晰的起点。`)
    if (draftCodes.length > question.max) setDraftCodes(draftCodes.slice(0, question.max))
  }

  async function upload(file: File | undefined): Promise<void> {
    if (!file) return
    if (localPreview) URL.revokeObjectURL(localPreview)
    setLocalPreview(URL.createObjectURL(file))
    await run((current) => onboardingApi.upload(current.snapshot.onboardingId, file, current.snapshot.sessionVersion))
  }

  function chooseSubject(subject: SubjectCandidate): void {
    setPickedSubject(subject)
    setCrop(subject.boundingBox ?? DEFAULT_CROP)
    setError(null)
  }

  function updateCrop(field: keyof CropValue, value: number): void {
    setCrop((current) => {
      const next = { ...current, [field]: value }
      next.w = Math.min(next.w, 1 - next.x)
      next.h = Math.min(next.h, 1 - next.y)
      return next
    })
  }

  async function confirmSubject(): Promise<void> {
    if (!pickedSubject) {
      setError('请明确选定一只宠物。')
      return
    }
    await run((current) => onboardingApi.selectSubject(
      current.snapshot.onboardingId,
      pickedSubject.subjectId,
      crop,
      current.snapshot.sessionVersion,
    ))
  }

  async function saveName(): Promise<void> {
    await run((current) => onboardingApi.updateProfile(
      current.snapshot.onboardingId,
      petName,
      current.snapshot.sessionVersion,
    ))
  }

  if (!detail) {
    return (
      <main className="pob pob-center" aria-busy="true">
        <span className="pob-orb" />
        <p>正在找回刚才的进度…</p>
        {error && <button className="pob-primary" onClick={() => window.location.reload()}>再试一次</button>}
      </main>
    )
  }

  const snapshot = detail.snapshot
  const selectedAsset = detail.assets.find((asset) => asset.mediaType === 'image')
  const previewUrl = localPreview || selectedAsset?.url

  function shell(content: React.ReactNode, title?: string): React.ReactElement {
    return (
      <main className="pob">
        <header className="pob-head">
          <button className="pob-close" type="button" onClick={onSkip} aria-label="暂时离开">×</button>
          <div>
            <span className="pob-kicker">为一只宠物，留一扇窗</span>
            {title && <h1>{title}</h1>}
          </div>
          <span className="pob-saved">已保存</span>
        </header>
        <div className="pob-scroll">
          {(notice || recovery) && <div className="pob-note" role="status">{notice || recovery}</div>}
          {error && <div className="pob-error" role="alert">{error}</div>}
          {content}
        </div>
      </main>
    )
  }

  if (view === 'abandoned') {
    return shell(
      <section className="pob-panel pob-center">
        <h2>这次先停在这里</h2>
        <p>没有创建窗口。想重新开始时，再带一张清晰的照片来就好。</p>
        <button className="pob-primary" disabled={busy} onClick={() => void createFresh().then(setDetail)}>重新开始</button>
        <button className="pob-link" onClick={onSkip}>回到大厅</button>
      </section>,
    )
  }

  if (view === 'done') {
    return shell(
      <section className="pob-panel pob-center">
        <div className="pob-done-mark">🐾</div>
        <h2>{snapshot.petName}的一扇窗，已经准备好了</h2>
        <p>这次确认只建立了一扇窗口。</p>
        <button className="pob-primary" onClick={() => detail.petId && onComplete(detail.petId)}>去看看</button>
      </section>,
    )
  }

  if (view === 'upload') {
    return shell(
      <section className="pob-panel">
        <p className="pob-lead">先从一张能看清它的照片开始。照片里有多只也没关系，下一步会让你只选一只。</p>
        <label className={`pob-drop ${busy ? 'is-busy' : ''}`}>
          <input type="file" accept="image/*,video/*" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} />
          <span className="pob-drop-plus">＋</span>
          <strong>{busy ? '正在安全保存…' : '上传照片或视频'}</strong>
          <small>首张清晰照片是必需的；视频可以稍后再补</small>
        </label>
        <button className="pob-link" onClick={onSkip}>暂时离开，保留这次进度</button>
      </section>,
      '先让我认出它',
    )
  }

  if (view === 'subject') {
    const candidates = detail.subjectCandidates
    return shell(
      <section className="pob-panel">
        <p className="pob-lead">只选这次要建档的一只。裁切框里要能清楚辨认脸部和主要特征。</p>
        <div className="pob-crop-stage">
          {previewUrl ? <img src={previewUrl} alt="待裁切的宠物素材" /> : <div className="pob-media-missing">素材已保存<br />等待服务端返回安全预览</div>}
          {previewUrl && <span className="pob-crop-box" style={{ left: `${crop.x * 100}%`, top: `${crop.y * 100}%`, width: `${crop.w * 100}%`, height: `${crop.h * 100}%` }} />}
        </div>
        <div className="pob-subject-list" aria-label="识别到的宠物">
          {candidates.map((subject, index) => (
            <button
              type="button"
              key={subject.subjectId}
              className={pickedSubject?.subjectId === subject.subjectId ? 'is-on' : ''}
              onClick={() => chooseSubject(subject)}
            >
              {subject.label || subject.species || `第 ${index + 1} 只`}
            </button>
          ))}
        </div>
        {pickedSubject && (
          <div className="pob-crop-controls">
            <label>左右位置<input type="range" min="0" max={Math.max(0, 1 - crop.w)} step="0.01" value={crop.x} onChange={(event) => updateCrop('x', Number(event.target.value))} /></label>
            <label>上下位置<input type="range" min="0" max={Math.max(0, 1 - crop.h)} step="0.01" value={crop.y} onChange={(event) => updateCrop('y', Number(event.target.value))} /></label>
            <label>裁切宽度<input type="range" min="0.2" max={1 - crop.x} step="0.01" value={crop.w} onChange={(event) => updateCrop('w', Number(event.target.value))} /></label>
            <label>裁切高度<input type="range" min="0.2" max={1 - crop.y} step="0.01" value={crop.h} onChange={(event) => updateCrop('h', Number(event.target.value))} /></label>
          </div>
        )}
        <button className="pob-primary" disabled={busy || !pickedSubject} onClick={() => void confirmSubject()}>
          {busy ? '正在检查辨识度…' : '就是这一只，继续'}
        </button>
        <label className="pob-link pob-replace">换一份素材<input type="file" accept="image/*" disabled={busy} onChange={(event) => void upload(event.target.files?.[0])} /></label>
      </section>,
      candidates.length > 1 ? '请明确选定一只' : '确认是它，再裁切清楚',
    )
  }

  if ((view === 'questionnaire' && currentQuestion) || editingQuestion) {
    const id = currentQuestion ?? 'q1'
    const question = questionById(id)
    const hasDraft = draftCodes.length > 0 || answerMap.has(id)
    const codes = hasDraft ? draftCodes : answerMap.get(id)?.answerCodes ?? []
    return shell(
      <section className="pob-panel">
        {id === 'q1' && (
          <div className="pob-name-row">
            <label htmlFor="pet-name">平时怎么称呼它？</label>
            <div><input id="pet-name" value={petName} maxLength={64} placeholder="可以先用“它”" onChange={(event) => setPetName(event.target.value)} /><button disabled={busy} onClick={() => void saveName()}>保存</button></div>
          </div>
        )}
        <p className="pob-question-count">{ONBOARDING_QUESTIONS.findIndex((item) => item.id === id) + 1} / 4</p>
        <h2>{question.title}</h2>
        <p className="pob-lead">{question.hint}</p>
        <div className="pob-options">
          {question.options.map((option) => (
            <button
              type="button"
              key={option.code}
              className={codes.includes(option.code) ? 'is-on' : ''}
              onClick={() => {
                if (!hasDraft) setDraftCodes(answerMap.get(id)?.answerCodes ?? [])
                toggleCode(option.code, question.max)
              }}
            >
              <span>{option.label}</span><i>{codes.includes(option.code) ? '✓' : ''}</i>
            </button>
          ))}
        </div>
        {id === 'q3' && codes.includes('special_gesture') && (
          <label className="pob-free-text">愿意的话，留一句它的小动作<input value={freeText} maxLength={120} onChange={(event) => setFreeText(event.target.value)} /></label>
        )}
        <button className="pob-primary" disabled={busy || !codes.length} onClick={() => void saveQuestion(id)}>
          {busy ? '正在保存…' : editingQuestion && answerMap.has(id) ? '保存修改' : id === 'q4' ? '看看我们记下了什么' : '继续'}
        </button>
        {editingQuestion && !firstMissing && <button className="pob-link" onClick={() => setEditingQuestion(null)}>不修改，返回总结</button>}
      </section>,
      id === 'q1' ? '从第一次见到它开始' : `慢慢想起${snapshot.petName}`,
    )
  }

  const summary = (
    <div className="pob-summary-list">
      {ONBOARDING_QUESTIONS.map((question) => {
        const answer = answerMap.get(question.id)
        const labels = question.options.filter((option) => answer?.answerCodes.includes(option.code)).map((option) => option.label)
        return (
          <button type="button" key={question.id} disabled={!canPerform(snapshot, 'save_answer')} onClick={() => openQuestion(question.id)}>
            <span>{question.title}</span><strong>{labels.join('、') || '还没回答'}</strong><i>修改</i>
          </button>
        )
      })}
    </div>
  )

  if (view === 'binding') {
    async function resolveIdentity(): Promise<void> {
      setBusy(true); setError(null)
      try {
        const outcome = await login({ intent: 'private_onboarding_generation', resourceId: snapshot.onboardingId, schemaVersion: 'v1' })
        if (!outcome) return
        if (outcome.result.returnToAllowed && outcome.result.nextAction === 'resume_private_onboarding') {
          const restored = await afterIdentityRefresh(onIdentityChanged, () => onboardingApi.get(snapshot.onboardingId))
          setDetail(restored)
          setNotice('已经安全回到刚才的资料，可以继续生成。')
        } else {
          const fresh = await afterIdentityRefresh(onIdentityChanged, async () => {
            storeActive(null)
            return createFresh()
          })
          setDetail(fresh)
          setNotice('已切换到原有账号。刚才匿名资料没有迁移，请重新上传。')
        }
      } catch (cause) { setError(errorMessage(cause)) }
      finally { setBusy(false) }
    }
    return shell(
      <section className="pob-panel">
        <p className="pob-lead">这些资料已经暂存。现在绑定手机号，是为了下次换设备或退出后还能找回来。</p>
        {summary}
        <button className="pob-primary" disabled={busy} onClick={() => void resolveIdentity()}>{busy ? '正在确认…' : '手机号登录并继续'}</button>
      </section>,
      '生成前，把这份资料安全收好',
    )
  }

  if (view === 'summary') {
    return shell(
      <section className="pob-panel">
        <p className="pob-lead">我们只会用你主动选择的事实，先为{snapshot.petName}构造第一幅画面。</p>
        {summary}
        <button className="pob-primary" disabled={busy || !canPerform(snapshot, 'generate')} onClick={() => void run((current) => onboardingApi.generate(current.snapshot.onboardingId, current.snapshot.sessionVersion))}>
          {busy ? '正在提交…' : recovery ? '再试一次生成' : '开始生成'}
        </button>
      </section>,
      `先看看${snapshot.petName}的第一幅画面`,
    )
  }

  if (view === 'generating') {
    return shell(
      <section className="pob-panel pob-center" aria-live="polite">
        <span className="pob-loader" />
        <h2>{snapshot.status === 'refining' ? '正在把熟悉的感觉靠近一点' : '正在从这些真实片段里，慢慢勾勒它'}</h2>
        <p>可以暂时离开。回来后会从服务端恢复，不会重新提交任务。</p>
        {error && <button className="pob-primary" onClick={() => { setError(null); setPollRetry((value) => value + 1) }}>重新查询进度</button>}
        <button className="pob-link" onClick={onSkip}>先去别处看看</button>
      </section>,
    )
  }

  if (view === 'candidates') {
    return shell(
      <section className="pob-panel">
        <p className="pob-lead">选一幅最接近的。这里还没有创建正式窗口。</p>
        <div className="pob-candidates">
          {detail.candidates.map((candidate) => (
            <article key={candidate.candidateId}>
              <div className="pob-candidate-art" style={candidateStyle(candidate)}><span>{candidate.emoji || '🐾'}</span></div>
              <p>{candidate.signature || '从熟悉的日常里轻轻长出来'}</p>
              <button disabled={busy} onClick={() => void run((current) => onboardingApi.selectCandidate(current.snapshot.onboardingId, candidate.candidateId, current.snapshot.sessionVersion))}>这幅最像</button>
              <button className="pob-link" disabled={busy} onClick={() => void run((current) => onboardingApi.refine(current.snapshot.onboardingId, candidate.candidateId, 'closer_to_subject', current.snapshot.sessionVersion))}>基于这幅再靠近一点</button>
            </article>
          ))}
        </div>
      </section>,
      `哪一幅更像${snapshot.petName}？`,
    )
  }

  if (view === 'consent') {
    return shell(
      <section className="pob-panel">
        <div className="pob-consent-card">
          <span>素材与场景使用确认</span>
          <h2>允许把本次上传和你选择的场景，用于生成{snapshot.petName}的这扇私人窗口</h2>
          <p>授权仅针对这次建档用途。你可以在确认窗口前撤回；不同意时不会建立窗口。</p>
        </div>
        <button className="pob-primary" disabled={busy} onClick={() => void run((current) => onboardingApi.setConsent(current.snapshot.onboardingId, true, current.snapshot.sessionVersion))}>同意并查看最终确认</button>
        <button className="pob-link" disabled={busy} onClick={() => void run((current) => onboardingApi.setConsent(current.snapshot.onboardingId, false, current.snapshot.sessionVersion))}>暂不同意</button>
      </section>,
      '最后确认一次使用方式',
    )
  }

  if (view === 'confirming') {
    const selected = detail.candidates.find((candidate) => candidate.candidateId === snapshot.selectedCandidateId)
    return shell(
      <section className="pob-panel pob-center">
        {selected && <div className="pob-final-art" style={candidateStyle(selected)}><span>{selected.emoji || '🐾'}</span></div>}
        <h2>确认“就是它”后，才会正式建立一扇窗口</h2>
        <p>重复点击也只会得到同一扇窗口；如果另一处已更新，会先恢复最新版本。</p>
        <button className="pob-primary" disabled={busy || !selected || !canPerform(snapshot, 'confirm')} onClick={() => selected && void run((current) => onboardingApi.confirm(current.snapshot.onboardingId, selected.candidateId, current.memoryUseConsent.consentVersion, current.snapshot.sessionVersion)).then((next) => next?.petId && onComplete(next.petId))}>
          {busy ? '正在安全确认…' : '就是它，建立窗口'}
        </button>
        <button className="pob-link" disabled={busy} onClick={() => selected && void run((current) => onboardingApi.refine(current.snapshot.onboardingId, selected.candidateId, 'change_scene', current.snapshot.sessionVersion))}>换一种画面再看看</button>
      </section>,
      `为${snapshot.petName}建立这扇窗`,
    )
  }

  return shell(
    <section className="pob-panel pob-center"><p>正在恢复可继续的步骤…</p></section>,
  )
}
