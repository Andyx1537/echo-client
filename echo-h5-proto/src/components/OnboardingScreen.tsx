import { useEffect, useRef, useState } from 'react'
import type { OnboardingCandidate } from '../types'
import { api, track } from '../api'
import { ApiError } from '../api'
import type { DetectSubject } from '../api/backend'
import {
  SUBJECT_COPY,
  SUBJECT_UNSURE,
  buildSubjectDeclaration,
  subjectChoiceKeyOf,
  subjectChoiceValue,
  subjectChoices,
  userOverrodeMachine,
  type SubjectChoiceKey,
  type SubjectType,
} from '../lib/subjectDeclaration'
import CandidateFan from './CandidateFan'
import '../styles/subjectDeclare.css'

interface Props {
  /** 建档完成（拿到 petId）后回调，父级刷新 hasPet 并进入「我的它」 */
  onComplete: (petId: string) => void
  /** 先随便看看（游客态浏览，稍后再建档，§2.7） */
  onSkip: () => void
}

/** 四步递进输入 → 定妆两轮 → 纪念场景（对齐契约 §2） */
type Step = 'name' | 'species' | 'media' | 'more' | 'round1' | 'round2' | 'scene'

/** 输入阶段四步（用于顶部进度：第 N 步 · 共 4 步）：先肖像 → 命名 → 补充 → 写/说 */
const INPUT_STEPS: Step[] = ['species', 'name', 'media', 'more']

/** 宠物长列表（常见 + 异宠，30+），「其他」永远排在最后 */
const SPECIES_LIST = [
  '狗', '猫', '兔', '仓鼠', '龙猫', '豚鼠', '刺猬', '松鼠',
  '鸟', '鹦鹉', '鸽子', '鸡', '鸭', '鹅',
  '龟', '蜥蜴', '蛇', '守宫', '蛙', '蝾螈', '变色龙',
  '观赏鱼', '金鱼', '锦鲤', '虾', '螃蟹', '蜗牛',
  '蜘蛛', '蜜袋鼯', '貂', '宠物猪', '羊', '马', '狐狸', '浣熊', '水獭',
  '其他',
]
/** 昵称化展示：猫 → 猫猫 */
const SPECIES_LABEL: Record<string, string> = {
  狗: '狗狗', 猫: '猫猫', 兔: '兔兔', 鸟: '鸟儿',
}
const speciesLabel = (s: string) => (s ? SPECIES_LABEL[s] ?? s : '')

/** iOS 风格上下滚轮选择器（scroll-snap + 中心高亮 + 上下渐隐） */
const WHEEL_ITEM_H = 44
function SpeciesWheel({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string
  onChange: (v: string) => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  // 挂载时把当前值滚到中心
  useEffect(() => {
    const idx = Math.max(0, options.indexOf(value))
    if (ref.current) ref.current.scrollTop = idx * WHEEL_ITEM_H
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const onScroll = () => {
    const el = ref.current
    if (!el) return
    const idx = Math.min(options.length - 1, Math.max(0, Math.round(el.scrollTop / WHEEL_ITEM_H)))
    const v = options[idx]
    if (v !== value) onChange(v)
  }
  return (
    <div className="wheel">
      <div className="wheel-band" />
      <div className="wheel-scroll" ref={ref} onScroll={onScroll}>
        <div className="wheel-pad" />
        {options.map((o, i) => (
          <button
            type="button"
            key={o}
            className={`wheel-item ${o === value ? 'on' : ''}`}
            onClick={() => ref.current?.scrollTo({ top: i * WHEEL_ITEM_H, behavior: 'smooth' })}
          >
            {speciesLabel(o)}
          </button>
        ))}
        <div className="wheel-pad" />
      </div>
    </div>
  )
}

/** 性情/状态词库：尽量丰富，辅助描述 ta 的样子（可多选，不设上限） */
const TRAIT_POOL = [
  // 性格
  '温柔', '粘人', '爱撒娇', '安静', '好奇', '慢性子', '话痨', '高冷', '傲娇', '胆小',
  '勇敢', '机灵', '呆萌', '倔强', '敏感', '独立', '黏糊', '爱吃醋', '爱干净', '邋遢',
  '暖心', '固执', '佛系', '暴躁', '温顺', '警惕', '亲人', '怕生',
  // 行为/习惯
  '贪吃', '爱睡觉', '爱追蝴蝶', '爱追光', '爱晒太阳', '爱钻被窝', '爱啃拖鞋', '护食',
  '爱洗澡', '怕洗澡', '爱出门', '宅', '认生', '看家', '爱叫', '爱蹭人', '爱翻肚皮',
  '爱埋东西', '爱咬尾巴', '会握手', '会装死', '挑食', '嘴馋',
  // 神态/气质
  '眼神清澈', '一脸无辜', '总是微笑', '慵懒', '精力旺盛', '文静', '活泼', '沉稳',
  '爱卖萌', '爱耍赖', '爱瞪人', '爱歪头',
]
/** mock 特征识别的候选池（真实实现走后端多模态分析，见契约 §2 photoRefs） */
const FEATURE_POOL = ['好奇', '粘人', '爱追光', '慢性子', '贪吃', '爱撒娇', '安静', '话痨', '爱睡觉', '爱追蝴蝶']

/**
 * 主体类型：`animal` / `person` / `other`。
 *
 * 🔴 **本页那一问（`SR-6`「这个窗口，是为谁留的?」）采集的是<u>主体类型</u>，不是<u>生存状态</u>。**
 * 规格明文警告「后人极易把 `SR-6` 之问读成推翻了『建档不问状态』的裁定」——**它没有推翻。**
 * 两者是两个字段、两回事，不得复用、不得互推（`SR-5`）。所以下面这段依然成立：
 *
 * 🔴 **建档流程刻意不问「对象状态」，`objectStatus` 一律维持 `unknown`——这是有意留的口子，
 * 不是漏补的校验，请不要「顺手补上」。** 两条依据缺一不可：
 *
 *  ① **制作人已拍板：不在建档流程增加对象状态选择，维持 `unknown`。**
 *     🔴 前端建档与后端安全闸必须是同一套口径，这里自行加一步询问就会分叉成两套规则。
 *
 *  ② `DECISIONS A7` 要求 `person + living/unknown` 下生成类入口**隐藏、不报错**，
 *     但在**建档流程里**那个「生成定妆」按钮是**唯一的前进路径**——照搬隐藏＝把用户
 *     卡死在半路。🔴 **把人卡死在唯一前进路径上比报错更糟，而 `A7` 的本意恰恰是不要让用户撞墙。**
 *     所以 A7 的闸落在 `MineScreen`（回访 / 回声 / 换一批，隐藏后页面仍然完整可用），
 *     判定函数见 `lib/generativeEntry.ts`；🔴 **本文件不落这道闸**。
 *
 * ⚠️ P0 只做宠物、「人」品类未立项，本段当前无实际影响。
 *
 * 🔴 **另一条同样重要：本页采集到的主体类型也不落生成门控的闸。**
 * 它是用户随手能改的预填值，拿它当门控 = 让用户自助关掉门控。
 * 真正的门控判据是素材侧的 `assetSubjectType`（服务端）。详见 `lib/subjectDeclaration.ts` 文件头。
 */

interface MediaItem {
  resourceId: string
  url: string
  kind: 'image' | 'audio' | 'video'
  name: string
}

function mediaKind(file: File): MediaItem['kind'] {
  if (file.type.startsWith('video')) return 'video'
  if (file.type.startsWith('audio')) return 'audio'
  return 'image'
}

/** 名字校验：只允许中文 / 字母 / 间隔号 / 空格；禁数字、全角符号等杂字符 */
const NAME_IDLE_HINT = '只用 ta 的名字或字母就好，别的先放一放'
type NameStatus = { state: 'idle' | 'checking' | 'valid' | 'invalid'; msg: string }
function evalName(raw: string): NameStatus {
  const s = raw.trim()
  if (!s) return { state: 'idle', msg: NAME_IDLE_HINT }
  if (/[0-9０-９]/.test(s)) return { state: 'invalid', msg: '名字里先不要放数字哦' }
  if (/[^\p{Script=Han}a-zA-Z· ]/u.test(s)) return { state: 'invalid', msg: '试试只用名字或字母，符号先放一放' }
  return { state: 'valid', msg: '' }
}

export default function OnboardingScreen({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>('species')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [nameStatus, setNameStatus] = useState<NameStatus>({ state: 'idle', msg: NAME_IDLE_HINT })

  // —— 四步输入 ——
  const [petName, setPetName] = useState('')
  const [species, setSpecies] = useState('') // 生效种类（识别结果 / 手动纠正）
  const [customSpecies, setCustomSpecies] = useState('') // 选到「其他」时的自定义
  // —— 第一步：肖像 + AI 识别 ——
  const [portrait, setPortrait] = useState<MediaItem | null>(null)
  const [detecting, setDetecting] = useState(false)
  const [subjects, setSubjects] = useState<DetectSubject[]>([]) // 识别到的主体（可能多个）
  const [chosenIdx, setChosenIdx] = useState<number | null>(null) // 多主体时选定的那一个
  const [correcting, setCorrecting] = useState(false) // 是否展开手动纠正
  /** 机器原判（`/detect` 出参）。🔴 留库备查用，不被用户的选择覆盖——裁定第 3 条 */
  const [machineSubjectType, setMachineSubjectType] = useState<SubjectType | null>(null)
  /**
   * 🔴 **`/detect` 是否已经跑完且一个主体都没认出** —— 低置信度那条路径的判据。
   *
   * ⚠️ **为什么判据是「空数组」而不是拿 `confidence` 比阈值**（两条，缺一条都会做错）：
   *  ① `subjects` 为空时**根本没有 `confidence` 可读** —— 而「一个都没认出」正是
   *     低置信度最典型的形态，阈值比较在这条路径上用不上。
   *  ② 🔴 `/detect` 出参里那个 `confidence` 是**肖像种类识别**的置信度，
   *     **与规格 `SR-8` 要比的 `assetSubjectConfidence`（素材侧，服务端）不是同一个量**。
   *     🔴 拿它比一个阈值再据此收缩，等于**把门控搬到前端**。
   *     前端只能用它决定**这一屏长什么样**，绝不能用它决定落哪个档。
   */
  const [detectedNothing, setDetectedNothing] = useState(false)
  /**
   * 用户在 `SR-6` 那一问里点选的**界面项**（`null` = 还没碰过，此时界面显示预填值）。
   *
   * 🔴 **存的是界面项的键，不是契约值** —— 低置信度那一屏的「一个地方，或一件东西」与
   * 「我也说不清」提交同一个 `other`，用契约值做状态会让两项互相点亮。
   *
   * 🔄 🔴 **不再有 `'defer'`**：`SR-D9` 已裁定不提供「以后再说」，不想说就选「其他」。
   */
  const [userSubjectPick, setUserSubjectPick] = useState<SubjectChoiceKey | null>(null)
  const [advancing, setAdvancing] = useState(false) // 用户确认后淡出、进入下一步
  const [media, setMedia] = useState<MediaItem[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzeNote, setAnalyzeNote] = useState<string | null>(null)
  const [traits, setTraits] = useState<string[]>([])
  const [rawDesc, setRawDesc] = useState('')
  // —— 第四步：语音识别（说一段话 → 文字）——
  const [listening, setListening] = useState(false)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recRef = useRef<any>(null)
  const speechSupported =
    typeof window !== 'undefined' &&
    ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  // —— 建档过程态 ——
  const [onboardingId, setOnboardingId] = useState('')
  const [candidates, setCandidates] = useState<OnboardingCandidate[]>([])
  const [chosen1, setChosen1] = useState<string | null>(null)
  const [finalId, setFinalId] = useState<string | null>(null)

  // —— 场景二次确认 ——
  const [caption, setCaption] = useState('')
  const [allowUse, setAllowUse] = useState(false)
  // 训练授权（PIPL 独立 opt-in，默认不勾）
  const [trainConsent, setTrainConsent] = useState(false)

  // 输入停顿后再"读"名字：梦境般的等待 + 校验（不合法则第二行给温柔提示）
  useEffect(() => {
    if (step !== 'name') return
    const s = petName.trim()
    if (!s) {
      setNameStatus({ state: 'idle', msg: NAME_IDLE_HINT })
      return
    }
    setNameStatus({ state: 'checking', msg: '轻轻感受着这个名字…' })
    const t = setTimeout(() => setNameStatus(evalName(s)), 650)
    return () => clearTimeout(t)
  }, [petName, step])

  const toggleTrait = (t: string) =>
    setTraits((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))

  function fail(e: unknown) {
    setErr(e instanceof ApiError ? e.message : '出了点小状况，待会儿再来试试')
  }

  // —— 选择种类（滚轮）——
  /** 生效种类：选到「其他」时取自定义文本 */
  const effectiveSpecies = species === '其他' ? customSpecies.trim() : species
  function onWheel(v: string) {
    setErr(null)
    setSpecies(v)
  }
  function onCustom(v: string) {
    setCustomSpecies(v)
  }

  // 多主体且尚未选定：此时不能确认（必须先选出单一主体）
  const multiUnresolved = subjects.length > 1 && chosenIdx === null

  // 采用某个识别主体作为生效种类
  function applySubject(s: DetectSubject) {
    setMachineSubjectType(s.subjectType)
    setSpecies(s.species)
    setCustomSpecies('')
  }

  /**
   * 低置信度那条路径。🔴 判据只有「detect 跑完且一个主体都没认出」，理由见 `detectedNothing`。
   */
  const lowConfidence = detectedNothing
  /**
   * detect 已经有结论了吗（认出至少一个 / 明确一个都没认出）。
   * 🔴 「请求失败」不算有结论 —— 那是**没问到**，不是**认不出**，两者的合理形态不同。
   */
  const subjectResolved = subjects.length >= 1 || detectedNothing
  /** 那一屏出哪几项：低置信度多一项「我也说不清」 */
  const subjectOpts = subjectChoices(lowConfidence)
  /**
   * `SR-6` 那一问当前选中的是哪个界面项。
   *
   * 🔴 **一定有一项是选中的**（裁定：预填 + 可改，不是空白必答题）：
   *  · 机器认准了 → 预填机器原判（`SR-D4`）；
   *  · 🔴 **认不出来 → 预填「我也说不清」**，它提交最保守的 `other`。
   *
   * ⚠️ 🔴 **预填<u>不</u>写进 `userSubjectPick`，这一条是整个方案的枢轴。**
   * 写进去就会让 `subjectSource` 变成 `'user'`，于是「用户没动预填值」这个状态消失，
   * `SR-D1` 的兜底（不答则落 `L1`）**又一次失去触发条件**。
   * 预填必须停在**界面层**，留库那三个值照 `buildSubjectDeclaration` 由 `null` 推出来。
   */
  const subjectSelected: SubjectChoiceKey | null =
    userSubjectPick ??
    (machineSubjectType
      ? subjectChoiceKeyOf(machineSubjectType)
      : lowConfidence
        ? SUBJECT_UNSURE.key
        : null)
  /**
   * 预填项要不要标成「还没定」。🔴 只在低置信度且用户没碰过时标 ——
   * 机器认准时那一颗是有把握的判断，标成待确认反而是把系统的犹豫演给人看。
   */
  const subjectTentative = lowConfidence && userSubjectPick === null
  // 多主体时点选其一
  function chooseSubject(i: number) {
    setErr(null)
    setChosenIdx(i)
    applySubject(subjects[i])
  }

  // —— 第一步：上传肖像 → 顺路识别种类（淡入让用户注意到已识别，需用户确认才进入下一步）——
  async function onPortrait(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setErr(null)
    setSubjects([])
    setChosenIdx(null)
    setCorrecting(false)
    setAdvancing(false)
    setDetectedNothing(false)
    setMachineSubjectType(null)
    /*
      🔴 换了肖像就把上一次的指认清掉。两个理由：
       ① 那次指认说的是**上一张**素材里的主体，换图之后它是过期信息；
       ② 🔴 更硬的一条：低置信度时用户可能点过「我也说不清」，而这一项
          **高置信度那一屏根本不出**。不清就会留下一个选不中任何选项的键，
          那一屏又退回成「什么都没选中」的空白必答题 —— 正是本轮要修掉的东西。
    */
    setUserSubjectPick(null)
    try {
      const { resourceId, url } = await api.upload(f)
      setPortrait({ resourceId, url, kind: 'image', name: f.name })
      setDetecting(true)
      const res = await api.detectSubject(resourceId)
      setDetecting(false)
      setSubjects(res.subjects)
      if (res.subjects.length === 1) {
        applySubject(res.subjects[0]) // 单主体：直接作为识别结果
      } else if (res.subjects.length === 0) {
        // 没认出：进手动选择，并落到低置信度那条路径（主体指认改为预填「我也说不清」）
        setCorrecting(true)
        setDetectedNothing(true)
        /*
          🔴 滚轮一展开就必须有一项落在中心带里。
          旧实现把 `species` 留成空串，于是滚轮「展开但没有任何高亮」，
          而 `confirmSpecies` 又要求 `effectiveSpecies` 非空 —— 用户看不出哪里没填，
          点「就 ta 了」只会得到一句「ta 是……再选一下吧」。
          ⚠️ 这里取滚轮首项是**照滚轮自身的语义**（居中那一项就是当前值），
          不是替用户断言种类：那一项明明白白显示在带子里，且仍要他按「就 ta 了 →」才走。
        */
        setSpecies(SPECIES_LIST[0])
      }
      // >1：进入多主体选择态，等用户点选（multiUnresolved）
      track('onboarding_detect', { count: res.subjects.length })
    } catch (e) {
      setDetecting(false)
      fail(e)
    }
  }
  // 用户确认后：淡出动画结束再切到命名步骤
  useEffect(() => {
    if (!advancing) return
    const t = window.setTimeout(() => {
      setAdvancing(false)
      setStep('name')
    }, 460)
    return () => window.clearTimeout(t)
  }, [advancing])
  // 手动纠正：展开滚轮
  function openCorrect() {
    setCorrecting(true)
  }
  // 用户确认「就是 ta」→ 淡出进入下一步
  function confirmSpecies() {
    if (detecting) return
    if (!portrait) return setErr('先上传一张 ta 的肖像吧')
    if (multiUnresolved) return setErr('这张里好像有好几个，先选定一个吧')
    if (!effectiveSpecies) return setErr('ta 是……再选一下吧')
    setErr(null)
    setAdvancing(true)
  }

  // —— 素材导入 + 特征分析 ——
  async function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setErr(null)
    const picked = Array.from(files)
    try {
      const added: MediaItem[] = []
      for (const f of picked) {
        const { resourceId, url } = await api.upload(f)
        added.push({ resourceId, url, kind: mediaKind(f), name: f.name })
      }
      setMedia((cur) => [...cur, ...added])
      setAnalyzeNote(null)
    } catch (e) {
      fail(e)
    }
  }
  function removeMedia(id: string) {
    setMedia((cur) => cur.filter((m) => m.resourceId !== id))
    setAnalyzeNote(null)
  }
  async function analyze() {
    if (media.length === 0) return
    setAnalyzing(true)
    setErr(null)
    // mock：客户端模拟多模态特征识别；真实实现由后端对 photoRefs 做分析（契约 §2）
    await new Promise((r) => setTimeout(r, 900))
    const shuffled = [...FEATURE_POOL].sort(() => Math.random() - 0.5).slice(0, 3)
    setTraits((cur) => {
      const merged = [...cur]
      for (const t of shuffled) {
        if (!merged.includes(t) && merged.length < 3) merged.push(t)
      }
      return merged
    })
    setAnalyzeNote(`从 ${media.length} 段素材里，它的样子渐渐清晰：${shuffled.join('、')}`)
    setAnalyzing(false)
    track('onboarding_media_analyze', { count: media.length })
  }

  // —— 语音识别：说一段话 → 追加到故事文本（Web Speech API；不支持则不显示按钮）——
  useEffect(() => {
    return () => {
      try {
        recRef.current?.stop()
      } catch {
        /* 忽略停止异常 */
      }
    }
  }, [])
  function toggleVoice() {
    if (listening) {
      try {
        recRef.current?.stop()
      } catch {
        /* 忽略 */
      }
      setListening(false)
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition
    if (!SR) return
    const rec = new SR()
    rec.lang = 'zh-CN'
    rec.interimResults = false
    rec.continuous = true
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rec.onresult = (e: any) => {
      let finalText = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) finalText += e.results[i][0].transcript
      }
      if (finalText) setRawDesc((prev) => (prev + finalText).slice(0, 140))
    }
    rec.onend = () => setListening(false)
    rec.onerror = () => setListening(false)
    recRef.current = rec
    try {
      rec.start()
      setListening(true)
      track('onboarding_voice', {})
    } catch {
      setListening(false)
    }
  }

  // —— 步骤导航 ——
  function next() {
    setErr(null)
    if (step === 'species') {
      if (!portrait) return setErr('先上传一张它的肖像吧')
      if (!effectiveSpecies) return setErr('它是……再选一下吧')
      return setStep('name')
    }
    if (step === 'name') {
      const r = evalName(petName)
      if (r.state !== 'valid') {
        setNameStatus(r)
        return
      }
      return setStep('media')
    }
    if (step === 'media') return setStep('more')
  }
  /** 统一回退：覆盖全部步骤（左上角按钮 + 左滑手势共用） */
  function goBack() {
    setErr(null)
    const map: Partial<Record<Step, Step>> = {
      name: 'species',
      media: 'name',
      more: 'media',
      round1: 'more',
      round2: 'round1',
      scene: 'round2',
    }
    const prev = map[step]
    if (prev) setStep(prev)
  }

  // —— 左滑回退手势 ——
  const touchStart = useRef<{ x: number; y: number } | null>(null)
  function onTouchStart(e: React.TouchEvent) {
    const t = e.touches[0]
    touchStart.current = { x: t.clientX, y: t.clientY }
  }
  function onTouchEnd(e: React.TouchEvent) {
    const s = touchStart.current
    touchStart.current = null
    if (!s) return
    const t = e.changedTouches[0]
    const dx = t.clientX - s.x
    const dy = t.clientY - s.y
    // 明确的横向左滑（右→左），且横向位移显著大于纵向，才触发回退
    if (dx < -70 && Math.abs(dx) > Math.abs(dy) * 1.5) goBack()
  }

  async function submitForm() {
    setBusy(true)
    setErr(null)
    try {
      /*
        主体指认的三个值一起送：生效值 + 机器原判 + 用户指认（裁定第 3 条要求都留库）。

        🔴 `userSubjectPick` 为 `null` 就照原样送 `null` —— **不要在这里替它填上界面预填值**。
        界面预填的那一项是「系统的猜测摆在那儿」，送 `null` 才让 `subjectSource` 落
        `machine` / `default`，`SR-D1` 的兜底（不答则 `L1`）才有触发条件。
        ⚠️ 生效值不会因此丢：`buildSubjectDeclaration` 的兜底与界面预填共用同一个常量。
      */
      const subject = buildSubjectDeclaration(
        machineSubjectType,
        userSubjectPick ? subjectChoiceValue(userSubjectPick) : null,
      )
      const res = await api.onboardingStart({
        petName: petName.trim(),
        species: effectiveSpecies || species,
        ...subject,
        rawDesc: rawDesc.trim(),
        traits,
        photoRefs: [portrait, ...media].filter(Boolean).map((m) => (m as MediaItem).resourceId),
        trainConsent,
      })
      track('onboarding_start', { species: effectiveSpecies || species, traits, media: media.length })
      // 🔴 只报来源与「改没改过」，不报用户选了什么——埋点侧同样不该攒出一份主体类型画像
      track('onboarding_subject', {
        source: subject.subjectSource,
        overrode: userOverrodeMachine(subject),
      })
      setOnboardingId(res.onboardingId)
      setCandidates(res.candidates)
      setChosen1(null)
      setStep('round1')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  // round1 满意某张 → 细化到 round2；也用于 round2「重新定妆」重出一批
  async function refine(candId?: string) {
    const cid = candId ?? chosen1
    if (!cid) return
    setBusy(true)
    setErr(null)
    try {
      const res = await api.onboardingRefine(onboardingId, cid, '')
      track('onboarding_refine', {})
      setChosen1(cid)
      setCandidates(res.candidates)
      setFinalId(null)
      setStep('round2')
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  async function confirm() {
    if (!finalId) return
    if (!allowUse) {
      setErr('需要你轻轻点头，我们才会把这个场景留下来')
      return
    }
    setBusy(true)
    setErr(null)
    try {
      const res = await api.onboardingConfirm({
        onboardingId,
        finalCandidateId: finalId,
        memoryScene: { caption: caption.trim(), allowUse },
      })
      track('onboarding_confirm', { petId: res.petId })
      onComplete(res.petId)
    } catch (e) {
      fail(e)
    } finally {
      setBusy(false)
    }
  }

  // —— 顶部进度 + 已填摘要（四步页均展示） ——
  const inputIdx = INPUT_STEPS.indexOf(step) // -1 = 已进入定妆阶段
  const isInput = inputIdx >= 0
  const summaryMain =
    effectiveSpecies && petName
      ? `${speciesLabel(effectiveSpecies)}：${petName}`
      : petName || speciesLabel(effectiveSpecies) || '还没开始'
  const summarySub = [
    media.length ? `${media.length} 段素材` : '',
    traits.length ? traits.join('·') : '',
  ]
    .filter(Boolean)
    .join(' · ')

  const renderHeader = () => (
    <div className="onb-top">
      <div className="onb-progress">
        <button className="onb-back" onClick={goBack} aria-label="返回">
          ‹
        </button>
        <div className="onb-steps">
          {INPUT_STEPS.map((s, i) => (
            <span
              key={s}
              className={`onb-dot ${isInput ? (i <= inputIdx ? 'on' : '') : 'on'}`}
            />
          ))}
        </div>
        <span className="onb-stepcount">
          {isInput ? `第 ${inputIdx + 1} 步 · 共 4 步` : '定妆中'}
        </span>
      </div>
      {(petName || species) && (
        <div className="onb-summary">
          <span className="onb-summary-main">{summaryMain}</span>
          {summarySub && <span className="onb-summary-sub">{summarySub}</span>}
        </div>
      )}
      {step === 'name' && (
        <button className="onb-skip" onClick={onSkip}>
          先随便看看
        </button>
      )}
    </div>
  )

  // 第一步「名字」：梦境进入式沉浸页（暗背景忽闪柔光 + 淡淡输入框 + 停顿校验）
  const nameIdx = INPUT_STEPS.indexOf('name')
  const renderDreamName = () => (
    <div className="onb onb-dream" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="onb-dream-orb onb-dream-orb--a" />
      <div className="onb-dream-orb onb-dream-orb--b" />
      <div className="onb-dream-orb onb-dream-orb--c" />
      <div className="onb-dream-topbar">
        <button className="onb-dream-back" onClick={goBack} aria-label="返回">
          ‹
        </button>
        <div className="onb-dream-dots">
          {INPUT_STEPS.map((s, i) => (
            <span key={s} className={`onb-dream-dot ${i <= nameIdx ? 'on' : ''}`} />
          ))}
        </div>
      </div>
      <button className="onb-dream-skip" onClick={onSkip}>
        先随便看看
      </button>
      <div className="onb-dream-center">
        <p className="onb-dream-prompt">在心里，轻轻唤一声 ta 的名字</p>
        <input
          className={`onb-dream-input ${nameStatus.state}`}
          value={petName}
          onChange={(e) => setPetName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              const r = evalName(petName)
              if (r.state === 'valid') next()
              else setNameStatus(r)
            }
          }}
          placeholder="ta 的名字"
          maxLength={12}
          autoFocus
        />
        {/* 第二行：提示信息（idle 引导 / checking / invalid 原因 / valid 确认） */}
        <p className={`onb-dream-hint ${nameStatus.state}`}>{nameStatus.msg}</p>
        {/* 合法后浮现「推门进去」；输入框保持聚焦、可继续修改 */}
        <button
          className={`onb-dream-go ${nameStatus.state === 'valid' ? 'show' : ''}`}
          onClick={next}
          tabIndex={nameStatus.state === 'valid' ? 0 : -1}
        >
          推门进去 →
        </button>
      </div>
    </div>
  )

  if (step === 'name') return renderDreamName()

  return (
    <div className="onb onb-dream" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <div className="onb-dream-orb onb-dream-orb--a" />
      <div className="onb-dream-orb onb-dream-orb--b" />
      <div className="onb-dream-orb onb-dream-orb--c" />
      {renderHeader()}

      <div className="onb-scroll">
        {/* 第一步：上传肖像 → 顺路识别 → 淡出自动进入下一步 */}
        {step === 'species' && (
          <div className={`onb-body ${advancing ? 'onb-leaving' : ''}`}>
            <h1 className="onb-title">ta的样子</h1>
            <p className="onb-sub">上传一张正面照，我们会认出 ta。</p>

            {!portrait ? (
              <label className="onb-portrait-drop">
                <input
                  type="file"
                  accept="image/*"
                  hidden
                  onChange={(e) => onPortrait(e.target.files)}
                />
                <span className="onb-portrait-plus">＋</span>
                <span className="onb-portrait-hint">点这里上传 ta 的肖像</span>
              </label>
            ) : (
              <div className="onb-portrait">
                <img className="onb-portrait-img" src={portrait.url} alt="肖像" />
                {/* 多主体未选定：在肖像上叠加可点选的位置框 */}
                {multiUnresolved &&
                  !detecting &&
                  subjects.map(
                    (s, i) =>
                      s.box && (
                        <button
                          key={i}
                          className={`onb-subj-box ${chosenIdx === i ? 'on' : ''}`}
                          style={{
                            left: `${s.box.x * 100}%`,
                            top: `${s.box.y * 100}%`,
                            width: `${s.box.w * 100}%`,
                            height: `${s.box.h * 100}%`,
                          }}
                          onClick={() => chooseSubject(i)}
                        >
                          <span className="onb-subj-tag">{speciesLabel(s.species)}</span>
                        </button>
                      ),
                  )}
                <label className="onb-portrait-change">
                  <input
                    type="file"
                    accept="image/*"
                    hidden
                    onChange={(e) => onPortrait(e.target.files)}
                  />
                  换一张
                </label>
              </div>
            )}

            {detecting && <p className="onb-detect detecting">正在认出 ta……</p>}

            {/* 多主体：提醒选定单一主体，否则无法确认 */}
            {multiUnresolved && !detecting && (
              <>
                <p className="onb-multi-hint">这张里好像有好几个小家伙，选出你要陪伴的那一个吧</p>
                {!subjects.some((s) => s.box) && (
                  <div className="onb-subj-list">
                    {subjects.map((s, i) => (
                      <button key={i} className="onb-chip" onClick={() => chooseSubject(i)}>
                        {speciesLabel(s.species)}
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {/*
              SR-6 主体指认：机器预填 + 用户确认（制作人裁定 2026-08-25）。

              🔴 **形态是「已经替你选好了，你可以改」，不是空白必答题**——
              空白必答会增加建档流失；而机器悄悄定则等于用户没有话语权。两头都被裁定否掉了。

              🔴 **这一问读起来必须像产品在了解用户，不像系统在核查用户**：
              不提检测结果、不提合规、没有任何选项暗示「选了会被限制」。
              用户选完得到的是「一个更合适的窗口」，不是一次放行或拒绝。文案与红线用例在
              `lib/subjectDeclaration.ts`。

              🔴 **选什么都不会在这里改变任何入口的可见性。** 收缩只能表现为「这里没有这个入口」，
              且判据在服务端（`assetSubjectType`）。前端在这件事上没有裁量权，更不会灰置——
              灰置等于变相报错。
            */}
            {/*
              🔴 `subjectResolved` 这一项是**不变式的守门人**：
              这一问只在**拿到了 detect 结果**（认出至少一个，或明确一个都没认出）之后才出，
              于是「这一屏可见 ⇒ 必有一项选中」在**所有**路径上都成立。

              ⚠️ 少了它会漏掉一条：**detect 请求抛异常**时 `subjects` 是空的、
              `detectedNothing` 又还是 false（那不是「认不出」，是「没问到」），
              于是四项一项都不选中 —— 正是本轮要消掉的那个空白必答题形态。
              🔴 那条路径下用户本来也走不下去（种类为空，确认按钮不出），
              **让这一问也一并不出，比出一个选不中任何项的它更诚实。**
            */}
            {portrait && !detecting && !multiUnresolved && subjectResolved && (
              <div className="onb-subject">
                <h2 className="onb-subject-title">{SUBJECT_COPY.title}</h2>
                {/*
                  低置信度才出这一行。🔴 **文案为临时采用（2026-08-26），
                  待「文案整体过一遍」专项重写，不要当定稿** —— 制作人对它的评价是
                  「也墨迹和孱弱」，选它只是「目前先这样」。已知缺陷（断言了素材逆光）
                  记在 `SUBJECT_COPY.lowConfidenceNote` 的注释里。
                */}
                {lowConfidence && (
                  <p className="onb-subject-note">{SUBJECT_COPY.lowConfidenceNote}</p>
                )}
                <div className="onb-subject-opts">
                  {subjectOpts.map((o) => {
                    const on = subjectSelected === o.key
                    return (
                      <button
                        key={o.key}
                        type="button"
                        className={`onb-subject-opt ${on ? 'on' : ''} ${
                          on && subjectTentative ? 'tentative' : ''
                        }`}
                        onClick={() => setUserSubjectPick(o.key)}
                      >
                        {o.label}
                      </button>
                    )
                  })}
                </div>
                <p className="onb-subject-hint">{SUBJECT_COPY.hint}</p>
              </div>
            )}

            {/* 单主体 / 已选定：识别结果淡入 + 用户确认 */}
            {subjects.length >= 1 && !detecting && !correcting && !multiUnresolved && (
              <>
                <div className="onb-detect-species" key={effectiveSpecies}>
                  <span className="onb-species-word">{speciesLabel(effectiveSpecies)}</span>
                </div>
                <div className="onb-confirm-row">
                  <button className="onb-fix-link" onClick={openCorrect}>
                    不是 ta？
                  </button>
                  <button className="onb-confirm" onClick={confirmSpecies}>
                    就是 ta →
                  </button>
                </div>
              </>
            )}

            {correcting && (
              <>
                <SpeciesWheel options={SPECIES_LIST} value={species} onChange={onWheel} />
                {species === '其他' && (
                  <input
                    className="onb-input"
                    value={customSpecies}
                    onChange={(e) => onCustom(e.target.value)}
                    placeholder="比如：鹦鹉螺 / 一只很特别的 ta"
                    maxLength={10}
                    autoFocus
                  />
                )}
                <div className="onb-confirm-row">
                  <button className="onb-confirm" onClick={confirmSpecies}>
                    就 ta 了 →
                  </button>
                </div>
              </>
            )}

            {err && <p className="onb-err">{err}</p>}
          </div>
        )}

        {/* 第三步：传入图片 / 音视频 + 特征分析 */}
        {step === 'media' && (
          <div className="onb-body">
            <h1 className="onb-title">再多留一些它的样子</h1>
            <p className="onb-sub">
              除了肖像，再导入一些照片、录音或视频，我们会轻轻读出它的更多特征。（可跳过）
            </p>

            <div className="onb-media-grid">
              {media.map((m) => (
                <div key={m.resourceId} className="onb-media-item">
                  {m.kind === 'image' && m.url ? (
                    <img className="onb-media-thumb" src={m.url} alt={m.name} />
                  ) : (
                    <div className="onb-media-icon">{m.kind === 'video' ? '🎬' : '🎵'}</div>
                  )}
                  <button
                    className="onb-media-remove"
                    onClick={() => removeMedia(m.resourceId)}
                    aria-label="移除"
                  >
                    ×
                  </button>
                </div>
              ))}
              <label className="onb-media-add">
                <input
                  type="file"
                  accept="image/*,audio/*,video/*"
                  multiple
                  hidden
                  onChange={(e) => onFiles(e.target.files)}
                />
                <span className="onb-media-plus">＋</span>
                <span className="onb-media-hint">图片 / 音视频</span>
              </label>
            </div>

            {media.length > 0 && (
              <button className="onb-analyze" onClick={analyze} disabled={analyzing}>
                {analyzing ? '正在读它的样子…' : '✨ 读出它的特征'}
              </button>
            )}
            {analyzeNote && <p className="onb-analyze-result">{analyzeNote}</p>}

            {err && <p className="onb-err">{err}</p>}
            <div className="onb-row">
              <button className="onb-primary" onClick={next}>
                {media.length ? '下一步 →' : '暂时跳过 →'}
              </button>
            </div>
          </div>
        )}

        {/* 第四步：更多 */}
        {step === 'more' && (
          <div className="onb-body">
            <h1 className="onb-title">再多说一点它</h1>
            <p className="onb-sub">这些会让它的样子更像记忆里的那个。</p>

            <label className="onb-label">
              ta 的性情 / 状态（想选几个都行{traits.length ? ` · 已选 ${traits.length}` : ''}）
            </label>
            <div className="onb-chips onb-chips-scroll">
              {Array.from(new Set([...traits, ...TRAIT_POOL])).map((t) => (
                <button
                  key={t}
                  className={`onb-chip ${traits.includes(t) ? 'on' : ''}`}
                  onClick={() => toggleTrait(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="onb-write-head">
              <label className="onb-label">它的故事：写下来，或说一段话（可选）</label>
              {speechSupported && (
                <button
                  type="button"
                  className={`onb-voice ${listening ? 'on' : ''}`}
                  onClick={toggleVoice}
                >
                  {listening ? '● 正在听…点我停' : '🎤 说一段'}
                </button>
              )}
            </div>
            <textarea
              className="onb-textarea"
              value={rawDesc}
              onChange={(e) => setRawDesc(e.target.value)}
              placeholder="那天、那个瞬间、它最喜欢的……写下、或说出你想它的样子。"
              maxLength={140}
              rows={3}
            />

            <label className="onb-consent onb-consent-train">
              <input
                type="checkbox"
                checked={trainConsent}
                onChange={(e) => setTrainConsent(e.target.checked)}
              />
              <span>愿意让 ta 的素材帮助我们把回声做得更好（用于改进与训练，随时可关）</span>
            </label>

            {err && <p className="onb-err">{err}</p>}
            <div className="onb-row">
              <button className="onb-primary" onClick={submitForm} disabled={busy}>
                {busy ? '正在为它定妆…' : '为它定妆 →'}
              </button>
            </div>
          </div>
        )}

        {/* 定妆两轮 */}
        {(step === 'round1' || step === 'round2') && (
          <div className="onb-body">
            <h1 className="onb-title">
              {step === 'round1' ? '挑一张最像它的' : '再挑一张，更像它了吗'}
            </h1>
            <p className="onb-sub">
              {step === 'round1'
                ? '以 ta 的肖像为底生成的定妆——左右滑动挑选，轻触看 ta 动起来。'
                : '又为 ta 调了调——挑一张，动起来看看像不像。'}
            </p>

            <CandidateFan
              candidates={candidates}
              portraitUrl={portrait?.url}
              round={step === 'round1' ? 1 : 2}
              busy={busy}
              onConfirm={(id) => {
                setErr(null)
                if (step === 'round1') {
                  refine(id)
                } else {
                  setFinalId(id)
                  setStep('scene')
                }
              }}
              onRedo={() => {
                setErr(null)
                if (step === 'round1') submitForm()
                else if (chosen1) refine(chosen1)
              }}
            />

            {err && <p className="onb-err">{err}</p>}
          </div>
        )}

        {/* 纪念场景二次确认 */}
        {step === 'scene' && (
          <div className="onb-body">
            <h1 className="onb-title">留下一个纪念的场景</h1>
            <p className="onb-sub">写一句你们之间的瞬间，它会成为这扇窗最开始的样子。</p>

            <textarea
              className="onb-textarea"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="比如：那天午后，它趴在窗台看了一下午的云。"
              maxLength={80}
              rows={3}
            />

            <label className="onb-consent">
              <input
                type="checkbox"
                checked={allowUse}
                onChange={(e) => setAllowUse(e.target.checked)}
              />
              <span>我愿意把这个场景留在它的窗里（你随时可以收回）</span>
            </label>

            {err && <p className="onb-err">{err}</p>}
            <div className="onb-row">
              <button className="onb-primary" onClick={confirm} disabled={busy || !allowUse}>
                {busy ? '正在为它建窗…' : '完成 · 为它建一扇窗'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
