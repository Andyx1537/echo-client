// 本地 mock 后端（VITE_API_BASE 为空时启用）。
// 复用/扩展 data/mock.ts 的假数据 + localStorage 持久化，保证后端未就绪时
// 前端仍可独立完整跑通与部署。所有对外文案过 COPY-GUIDE 词表（copy.gentle）。
// 六项定案在此侧同样落实：献花走额度不加温度、记得为一人一次开关 + 暖光面孔墙。

import type {
  Echo,
  Face,
  FlowerQuota,
  Insights,
  Me,
  Message,
  MyPet,
  OnboardingCandidate,
  Paged,
  Postcard,
  PostcardSkin,
  PurchaseResult,
  RecordItem,
  RelationUser,
  RememberWall,
  SearchResults,
  SearchUser,
  ShadowAreaView,
  SpectrumNodeView,
  UserProfile,
  Visibility,
  Window,
  WindowEcho,
  MuteDuration,
  FeatureFlags,
  MessageDisposition,
  PendingMessage,
  ReactionArrival,
  ReactionKind,
  Work,
  PublishWorkInput,
} from '../types'
import { cardIdOfArrival } from './arrivals'
import {
  freshWorks,
  mockAuthorWorks,
  mockFeed,
  mockPublish,
  type WorksMockState,
} from './worksMock'
import { normalizeQuery, runSearch } from './searchLogic'
import {
  ApiError,
  FLOWER_TOPUP_SKU,
  type EchoBackend,
  type FlowerPayload,
  type FlowerResult,
  type FollowResult,
  type OnboardingConfirmPayload,
  type OnboardingStartPayload,
  type WindowDetail,
} from './backend'
import { asCardId, asPetId } from '../lib/ids'
import { gentle } from './copy'
import { getSession } from './session'
import {
  myEchoes,
  opsAccount,
  myPet as myPetTemplate,
  plazaWindows,
  relations as seedRelations,
  seedAuthorPool,
  seedMessages,
  seedReactionArrivals,
  seedRecords,
} from '../data/mock'
import { SHOW_TEST_DATA, accountsForDisplay, contentForDisplay } from '../data/testData'
import { initialNodes, initialShadows } from '../data/spectrum'

const DB_KEY = 'echo.mock.db'
// 数据版本：造 demo 数据后 bump，可让旧的 localStorage 缓存自动重置为最新种子，
// 保证产品经理即使装过旧版本，打开也能看到最新、最热闹的 demo。
// v4：移除手写的回应到达 m-2 / m-5，改由 seedReactionArrivals + mergeArrivals 产生
// （`PRODUCT-MINDMAP §6.2 B20`）。不 bump 的话，装过旧版本的人会继续看到 m-5 里
// 那句「轻轻留下了一束心意」——正是本轮判定为越线的措辞。
const DB_VERSION = 4
const DAILY_FREE = 5
/** 一次「补充心意」到账的额度（离线可跑；契约 §0.7 #3「献花可买」） */
const FLOWER_TOPUP_COUNT = 10
/**
 * 广场每页条数：让离线态也真正走一遍 `{items,nextCursor}` 游标续拉（契约 §14.1），
 * 广场瀑布与「进窗后连续下翻」（D21/TC-13）共用同一条流、同一个游标。
 * 离线可翻的总条数以本地种子窗口数为上限，翻完给温柔收尾态（不空白、不报错）。
 */
const PLAZA_PAGE_SIZE = 6
/**
 * 「被接住」的到达每页多少**张卡**（与真后端 `limit` 默认值一致）。
 * 🔴 单位是卡不是回应行——见 `reactionArrivals` 的注释。
 */
const ARRIVAL_PAGE_SIZE = 20

/**
 * 共鸣厅内容目录 = 种子内容过一遍测试数据总闸。
 *
 * 原型里 96 条内容都是 originType='seed_ops' 的内部测试数据，
 * `VITE_SHOW_TEST_DATA=0` 时这里会变成空数组，广场/搜索/详情一并看不到它们，
 * 首页自动落到「暂时还没有窗」的温柔空态。开关与口径见 data/testData.ts。
 */
const catalog = contentForDisplay(plazaWindows)

/** 可被搜到的账号 = 官方号（真实账号，恒在）+ 测试账号（受总闸控制） */
const searchableAccounts = [opsAccount, ...accountsForDisplay(seedAuthorPool)]

/**
 * 款式商店：只卖皮肤/边框/材质（装扮·增值），与后端 shopSkins 同形（契约 §7 / 定案 D2）。
 * 绝不锁内容——kind∈{gradient,frame,material}，价格只是心意点数。
 */
const POSTCARD_SKINS: PostcardSkin[] = [
  { id: 'skin_dusk', name: '暮色', kind: 'gradient', price: 0 },
  { id: 'skin_gold_frame', name: '暖金边框', kind: 'frame', price: 6 },
  { id: 'skin_paper', name: '旧纸材质', kind: 'material', price: 6 },
]

/** mock 后端的持久化数据库（单用户，落 localStorage） */
interface MockDB {
  /** 数据版本；与 DB_VERSION 不符则视为过期缓存，重建为最新种子 */
  version: number
  accountId: string
  isGuest: boolean
  nickname: string
  visibilityDefault: Visibility
  hasPet: boolean
  pet: MyPet | null
  echoes: Echo[]
  records: RecordItem[]
  messages: Message[]
  /** windowId → 我是否记得（一人一次开关；§0.7 #4） */
  remembered: Record<string, boolean>
  /** windowId → 基础暖光浓度（不含"我"，0-1） */
  warmthByWindow: Record<string, number>
  /** windowId → 我为它献过的花数（owner 可见的私密羁绊；不加温度） */
  flowersByWindow: Record<string, number>
  /** 今日献花额度（按日期滚动） */
  quota: { date: string; usedToday: number; purchasedBalance: number }
  insights: Insights
  /** mock 直接持有视觉 VM（前端持布局，行为与拆分前一致） */
  spectrum: { nodes: SpectrumNodeView[]; shadows: ShadowAreaView[] }
  /** 建档草稿：onboardingId → 提交的原始素材 */
  onboarding: Record<string, OnboardingStartPayload>
  /** 我记得的窗口，我的头像用什么色（聚进面孔墙） */
  myAvatar: string
  seenWindows: string[]
  /** echoId → 回忆本体原文（「换一批」只换外层说法，本体永不丢；旧缓存可缺省） */
  echoCore?: Record<string, string>
  /** 「换一批」已换到第几档口吻（旧缓存可缺省） */
  rerollRound?: number
  /**
   * 我关注的账号 id（🔴「关注」= 人与人的关系，与付费的「订阅」无关）。
   * 旧缓存可缺省，读取一律走 `followingOf()` 兜底，避免为此 bump 掉别人正在用的本地数据。
   */
  following?: string[]
  /** C1 留一句话：别人留在**我这扇窗**上、等我处理的话（旧缓存可缺省） */
  pending?: PendingMessage[]
  /** 我「收下公开」了的留言 → 呈现到我这扇窗的「温柔的回声」里（旧缓存可缺省） */
  publishedEchoes?: WindowEcho[]
  /** 别人对我的卡的回应（未合并的原始行；`PRODUCT-MINDMAP §6.2 B20`，旧缓存可缺省） */
  arrivals?: ReactionArrival[]
  /** 作品（t_work）。旧缓存可缺省，读取一律走 worksOf() 兜底 */
  works?: Work[]
}

const AVATAR_POOL = [
  'linear-gradient(135deg,#f3d9b8,#e0a96c)',
  'linear-gradient(135deg,#cfe0c2,#9cb27e)',
  'linear-gradient(135deg,#e6cfe0,#c9a9c4)',
  'linear-gradient(135deg,#e9c7a3,#c99a70)',
  'linear-gradient(135deg,#f0c9a0,#d99b6c)',
  'linear-gradient(135deg,#e9d3a6,#cdb079)',
  'linear-gradient(135deg,#dfeac2,#b7c79a)',
  'linear-gradient(135deg,#f5ddc4,#e6b98f)',
  'linear-gradient(135deg,#efcfa8,#d7a074)',
  'linear-gradient(135deg,#e6c6a2,#c99a70)',
  'linear-gradient(135deg,#f2d6b4,#e0ad80)',
  'linear-gradient(135deg,#f3ead6,#dcc59a)',
]

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function freshDB(accountId: string): MockDB {
  const warmthByWindow: Record<string, number> = {}
  // 🔴 按**窗口键**建表：`warmthOf` 收的是 petId（`/windows/:petId/remember` 那一路）
  for (const w of catalog) warmthByWindow[w.petId] = w.warmthLevel
  // demo 默认：当前用户已为「豆豆」建过档，让 hasPet 用户一进来「我的它」就有内容。
  // 想体验建档流程时，可用「我的它」页底部 dev-only 的「删除并重新建档」按钮重入。
  return {
    version: DB_VERSION,
    accountId,
    isGuest: true,
    nickname: '温柔的旅人',
    visibilityDefault: 'private',
    hasPet: true,
    pet: { ...myPetTemplate, postcards: myPetTemplate.postcards.map((p) => ({ ...p })), lifeBook: [...myPetTemplate.lifeBook] },
    echoes: [...myEchoes],
    records: [...seedRecords],
    // 消息种子引用的都是测试账号，总闸关掉后连带消失（消息页有安静空态）
    messages: SHOW_TEST_DATA ? [...seedMessages] : [],
    remembered: {},
    warmthByWindow,
    flowersByWindow: {},
    quota: { date: today(), usedToday: 0, purchasedBalance: 0 },
    // `cardCount / unseenCardCount` 是本地假数据：服务端还没有这两个出参（`C-9`）。
    insights: { seenCount: 128, rememberFacesCount: 42, flowersReceived: 60, cardCount: 6, unseenCardCount: 2 },
    spectrum: { nodes: [...initialNodes], shadows: [...initialShadows] },
    onboarding: {},
    myAvatar: 'linear-gradient(135deg,#f3d08a,#e79aa6)',
    seenWindows: [],
    echoCore: {},
    rerollRound: 0,
  }
}

/** 身份 Mock 的受控写入口；只用于本地 UI 状态，不作为身份安全证据。 */
export function mockActivatePhoneAccount(accountId: string, bindCurrent: boolean): void {
  if (bindCurrent) {
    const current = load()
    current.accountId = accountId
    current.isGuest = false
    save()
    return
  }
  db = freshDB(accountId)
  db.isGuest = false
  save()
}

/** 身份 Mock 的匿名设备会话投影。 */
export function mockActivateAnonymousAccount(accountId: string): void {
  db = freshDB(accountId)
  db.isGuest = true
  save()
}

let db: MockDB | null = null

function load(): MockDB {
  if (db) return db
  try {
    const raw = localStorage.getItem(DB_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as MockDB
      // 版本过期 → 用同一 accountId 重建为最新种子（保住会话，不改身份）
      if (parsed.version === DB_VERSION) {
        db = parsed
        return db
      }
      db = freshDB(parsed.accountId)
      save()
      return db
    }
  } catch {
    // ignore
  }
  const session = getSession()
  db = freshDB(session?.accountId ?? 'acc_anon')
  return db
}

function save(): void {
  if (!db) return
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db))
  } catch {
    // ignore
  }
}

function rollQuota(d: MockDB): void {
  if (d.quota.date !== today()) {
    d.quota = { date: today(), usedToday: 0, purchasedBalance: d.quota.purchasedBalance }
  }
}

function quotaOf(d: MockDB): FlowerQuota {
  rollQuota(d)
  const remaining = Math.max(0, DAILY_FREE - d.quota.usedToday)
  return {
    dailyFree: DAILY_FREE,
    usedToday: d.quota.usedToday,
    remaining,
    purchasedBalance: d.quota.purchasedBalance,
  }
}

/** 暖光浓度 → 面孔墙（有上限，不返回精确总数；§0.7 #4 红线） */
function facesFor(windowId: string, warmth: number, meRemembered: boolean, myAvatar: string): Face[] {
  const seed = [...windowId].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7)
  const count = Math.min(11, Math.max(2, Math.round(warmth * 11)))
  const faces: Face[] = []
  for (let i = 0; i < count; i++) {
    const idx = Math.abs(seed + i * 37) % AVATAR_POOL.length
    faces.push({ accountId: `f_${windowId}_${i}`, avatar: AVATAR_POOL[idx] })
  }
  if (meRemembered) faces.unshift({ accountId: 'me', avatar: myAvatar })
  return faces
}

function warmthOf(d: MockDB, windowId: string): number {
  const base = d.warmthByWindow[windowId] ?? 0.4
  const bump = d.remembered[windowId] ? 0.06 : 0
  return Math.min(1, base + bump)
}

/** 把"我的它"包装成一个窗口，供详情页统一渲染 */
function myWindow(pet: MyPet, echoes: WindowEcho[]): Window {
  return {
    id: asCardId('w-mine'),
    petId: asPetId(pet.petId ?? 'w-mine'),
    petName: pet.name,
    ownerName: '我',
    ownerAvatar: pet.cover.gradient,
    recent: pet.recent,
    signature: pet.signature,
    warmthLevel: 0.7,
    visibility: pet.visibility,
    cover: pet.cover,
    lifeBook: pet.lifeBook,
    span: 'tall',
    // 「收下公开」的留言就落在这里，与其他共鸣留言同一处呈现——不单独开一个「留言区」
    echoes: echoes.length > 0 ? echoes : undefined,
    objectKind: pet.objectKind,
    objectStatus: pet.objectStatus,
  }
}

/**
 * 自己那扇窗在 mock 各张表（暖光/记得/献花/看过）里的内部键。
 * ⚠️ 真后端的自己窗就是 `pet.petId`，而这些表是按 `w-mine` 建的。
 */
const MY_WINDOW = 'w-mine'

/**
 * 把传进来的窗口键归一到 mock 内部键：真实的 `pet.petId` 与历史的 `w-mine` 都指自己那扇窗。
 * 🔴 在入口归一一次，免得每张表都得认两个键——认两个键的地方迟早会漏掉一个。
 */
function winKey(d: MockDB, windowId: string): string {
  return d.pet?.petId && windowId === d.pet.petId ? MY_WINDOW : windowId
}

function findWindow(d: MockDB, windowId: string): Window | null {
  if (windowId === MY_WINDOW && d.pet) return myWindow(d.pet, publishedOf(d))
  return catalog.find((w) => w.petId === windowId) ?? null
}

const SPECIES_EMOJI: Record<string, string> = {
  狗: '🐶',
  猫: '🐱',
  兔: '🐰',
  仓鼠: '🐹',
  鸟: '🐦',
  // 异宠分类
  龟: '🐢',
  蜥蜴: '🦎',
  蛇: '🐍',
  刺猬: '🦔',
  龙猫: '🐭',
  鹦鹉: '🦜',
  观赏鱼: '🐠',
  蜘蛛: '🕷️',
  蜜袋鼯: '🐿️',
  貂: '🦦',
  宠物猪: '🐷',
  守宫: '🦎',
  豚鼠: '🐹',
}

const CANDIDATE_GRADIENTS = [
  'linear-gradient(150deg,#f6e7cd 0%,#eccfa1 55%,#dcae74 100%)',
  'linear-gradient(150deg,#eef3df 0%,#d7e6c0 55%,#c6d3ac 100%)',
  'linear-gradient(150deg,#fbead0 0%,#f1cf9a 55%,#e0ab6a 100%)',
  'linear-gradient(150deg,#f3e6ef 0%,#e6cfe0 55%,#ccb0c9 100%)',
  'linear-gradient(150deg,#fbe7cf 0%,#f3c79a 45%,#e79b74 100%)',
  'linear-gradient(150deg,#e7ecf2 0%,#d3dbe6 55%,#c3ccdb 100%)',
]

function makeCandidates(payload: OnboardingStartPayload, round: number, adjust?: string): OnboardingCandidate[] {
  const emoji = SPECIES_EMOJI[payload.species] ?? '🐾'
  const traitText = payload.traits.slice(0, 2).join('又') || '温柔'
  const flavors = adjust
    ? [`${adjust}的样子`, `再${adjust}一点点`, `${adjust}又安静的它`]
    : [`${traitText}的小可爱`, `爱撒娇的${payload.petName}`, `安静又粘人的它`]
  return [0, 1, 2].map((i) => ({
    id: `cand-${round}-${i}-${Date.now()}`,
    cover: {
      gradient: CANDIDATE_GRADIENTS[(round * 3 + i) % CANDIDATE_GRADIENTS.length],
      emoji,
    },
    signature: gentle(flavors[i]),
  }))
}

/**
 * 「换一批」的口吻轮换（B7 / TC-23 · 基调引擎 B13：多候选、绝不固定单一口吻）。
 * 每档只换**说法的框**，回忆本体（core）原样保留 —— 呼应 CM2「明确回忆/想象框、降低拟真」：
 * 用「在你记忆里…」这类框住的表述，不制造「它此刻真实存在」的错觉。
 */
const REROLL_FRAMES: Array<{ tone: string; frame: (core: string) => string }> = [
  { tone: 'quiet', frame: (c) => `在你记忆里，它大概还是这样：${c}` },
  { tone: 'playful', frame: (c) => `想起来还是会笑一下——${c}` },
  { tone: 'gentle', frame: (c) => `慢慢想起那天：${c}` },
  { tone: 'warm', frame: (c) => c },
]

/** 取某条近况的「回忆本体」：首次换一批时把原文存下来，之后反复换也不会层层套壳 */
function echoCoreOf(d: MockDB, echo: Echo): string {
  if (!d.echoCore) d.echoCore = {}
  const core = d.echoCore[echo.echoId] ?? echo.text
  d.echoCore[echo.echoId] = core
  return core
}

// —— 他人主页 / 关注（SPEC-feature-pages §2.4 · PRD-RESONANCE-PUBLISHING E1）——
// 🔴 这一段全是「关注」：人与人的单向关系。付费的「订阅」是另一回事，别在这里加 sub_* 的东西。

/** 他人主页每页作品数（作品墙同样走 {items,nextCursor} 游标） */
const USER_WINDOWS_PAGE_SIZE = 8

/** 我关注的人（旧缓存没有这个字段，统一在这里兜底） */
function followingOf(d: MockDB): string[] {
  return d.following ?? []
}

/** 由 id 派生一个稳定的数（离线也不跳变；只用于造 demo 数字，真数字由后端出） */
function hashOf(userId: string): number {
  let h = 7
  for (let i = 0; i < userId.length; i++) h = (h * 33 + userId.charCodeAt(i)) | 0
  return Math.abs(h)
}

/**
 * demo 粉丝数：刻意造成长尾（多数人两位数，少数人几百），而不是人人三位数。
 * 🔴 数字**公开且精确**，绝不做「1k+」这类模糊化——那是给排行榜用的，我们不做排行榜。
 */
function baseFollowerCount(userId: string): number {
  const n = hashOf(userId)
  return 8 + (n % 11 === 0 ? n % 860 : n % 170)
}

/** demo 关注数：和粉丝数错开取模，免得两个数字长得一样 */
function baseFollowingCount(userId: string): number {
  return 3 + (hashOf(`${userId}#following`) % 96)
}

// —— C1 留一句话（DECISIONS S13 · PALETTE §56）——

/**
 * mock 后端里这个开关的取值。🔴 **默认关闭**，与 `S13 ①` 的 P0 口径一致。
 *
 * `VITE_MOCK_LEAVE_MESSAGE=1` 只是让**这个假后端**把开关下发成 true，方便本地看一眼 UI，
 * 沿用 `detectSubject` 里 `VITE_MOCK_MULTI` 的既有做法。
 * 🔴 它**不是前端本地开关**：组件那边照样只认 `api.featureFlags()` 的返回值，
 * 没有任何组件读得到这个环境变量。接真后端（`VITE_API_BASE` 非空）时这段代码根本不执行。
 */
const MOCK_LEAVE_MESSAGE_ON = import.meta.env.VITE_MOCK_LEAVE_MESSAGE === '1'

/**
 * 落在「我的窗」上、等我处理的留言种子。
 * 全部 60 字以内（`PALETTE §56` 的长度上限），语气过一遍 COPY-GUIDE 基调。
 */
const seedPending: PendingMessage[] = [
  {
    id: 'pm-1',
    authorName: '晚风',
    authorAvatar: 'linear-gradient(135deg,#f3d9b8,#e0a96c)',
    text: '谢谢你留下它。看到这张照片，我想起我家那只也爱这样趴着晒太阳。',
    time: '2 小时前',
  },
  {
    id: 'pm-2',
    authorName: '橘子汽水',
    authorAvatar: 'linear-gradient(135deg,#cfe0c2,#9cb27e)',
    text: '我也被这个瞬间触动了。',
    time: '昨天',
  },
]

/** 我这扇窗上待处理的留言（旧缓存没有这个字段，统一在这里兜底并补种子） */
function pendingOf(d: MockDB): PendingMessage[] {
  if (!d.pending) d.pending = seedPending.map((m) => ({ ...m }))
  return d.pending
}

/** 我已「收下公开」的留言（旧缓存兜底） */
function publishedOf(d: MockDB): WindowEcho[] {
  if (!d.publishedEchoes) d.publishedEchoes = []
  return d.publishedEchoes
}

/** 别人对我的卡做出的回应（旧缓存兜底并补种子；`PRODUCT-MINDMAP §6.2 B20`） */
function arrivalsOf(d: MockDB): ReactionArrival[] {
  if (!d.arrivals) d.arrivals = seedReactionArrivals.map((a) => ({ ...a }))
  return d.arrivals
}

const delay = (ms = 120) => new Promise<void>((r) => setTimeout(r, ms))

export const mockBackend: EchoBackend = {
  async featureFlags(): Promise<FeatureFlags> {
    await delay(40)
    return { leaveMessage: MOCK_LEAVE_MESSAGE_ON }
  },

  async me(): Promise<Me> {
    await delay(60)
    const d = load()
    return {
      accountId: d.accountId,
      isGuest: d.isGuest,
      nickname: d.nickname,
      hasPet: d.hasPet,
      visibilityDefault: d.visibilityDefault,
    }
  },

  async detectSubject(_resourceId: string) {
    // mock 占位：无后端时看不到图，只能给中性默认——「永远单主体」，绝不假装多主体冤枉单宠照片。
    // 真实识别（含多主体/位置框）走后端视觉模型（契约 §2 /pet/onboarding/detect）。
    // 仅当显式开启 VITE_MOCK_MULTI=1 时，返回两个带框主体，用于本地演示「多主体需选定」交互。
    await delay(700)
    /*
      🔴 VITE_MOCK_NO_SUBJECT=1：一个主体都不返回，用于本地走**低置信度**那条路径
      （主体指认预填「我也说不清」、种类滚轮展开、`SR-D1` 兜底落 `other`）。

      ⚠️ **加这个开关本身就是一条经验**：这条路径此前在本地**根本走不到**
      —— mock 永远返回单主体 —— 而它恰恰是「预填值缺失、退化成空白必答题」
      那个缺陷藏身的地方。🔴 没有开关的分支等于没人看过的分支。
      沿用 VITE_MOCK_MULTI 的既有做法：只让这个假后端改变返回，组件读不到这个变量。
    */
    if (import.meta.env.VITE_MOCK_NO_SUBJECT === '1') {
      return { subjects: [] }
    }
    if (import.meta.env.VITE_MOCK_MULTI === '1') {
      return {
        subjects: [
          { subjectType: 'animal' as const, species: '狗', confidence: 0.62, box: { x: 0.06, y: 0.16, w: 0.42, h: 0.68 } },
          { subjectType: 'animal' as const, species: '猫', confidence: 0.55, box: { x: 0.54, y: 0.2, w: 0.4, h: 0.62 } },
        ],
      }
    }
    return { subjects: [{ subjectType: 'animal' as const, species: '狗', confidence: 0.5 }] }
  },

  async onboardingStart(payload: OnboardingStartPayload) {
    await delay(240)
    const d = load()
    const onboardingId = `ob-${Date.now()}`
    // 整包原样落盘，🔴 主体指认那三个值（生效值 / 机器原判 / 用户指认来源）**都要留着**：
    // 裁定第 3 条要的就是「不能只存最终值」，mock 这里先把形状占住，
    // 免得后端补字段时前端才发现自己一路只传了一个值。
    d.onboarding[onboardingId] = payload
    save()
    return { onboardingId, candidates: makeCandidates(payload, 0) }
  },

  async onboardingRefine(onboardingId, _chosenCandidateId, adjust) {
    await delay(240)
    const d = load()
    const payload = d.onboarding[onboardingId]
    if (!payload) throw new ApiError(2001, '这次建档好像走散了，我们从头再来一次吧')
    return { candidates: makeCandidates(payload, 1, adjust) }
  },

  async onboardingConfirm(payload: OnboardingConfirmPayload) {
    await delay(280)
    const d = load()
    if (!payload.memoryScene.allowUse) {
      throw new ApiError(2002, '需要你轻轻点头，我们才会把这个场景留下来')
    }
    const raw = d.onboarding[payload.onboardingId]
    const petId = `pet-${Date.now()}`
    // 以模板为底，套用建档得到的名字/签名/定妆
    const emoji = raw ? SPECIES_EMOJI[raw.species] ?? '🐾' : '🐾'
    d.pet = {
      ...myPetTemplate,
      petId,
      name: raw?.petName ?? myPetTemplate.name,
      signature: gentle(raw?.traits?.slice(0, 2).join('又') ?? myPetTemplate.signature) || myPetTemplate.signature,
      temperature: 66,
      visibility: d.visibilityDefault,
      recent: gentle(payload.memoryScene.caption) || myPetTemplate.recent,
      cover: { ...myPetTemplate.cover, emoji },
    }
    d.hasPet = true
    d.echoes = [...myEchoes]
    save()
    return { petId }
  },

  async upload(file: File) {
    await delay(160)
    // mock：用本地 objectURL 占位，返回一个资源 id
    const resourceId = `res-${Date.now()}`
    const url = typeof URL !== 'undefined' && URL.createObjectURL ? URL.createObjectURL(file) : ''
    return { resourceId, url }
  },

  async petMe(): Promise<MyPet> {
    await delay(80)
    const d = load()
    if (!d.pet) throw new ApiError(2003, '还没有为它建一扇窗，先一起把它请回来吧')
    return d.pet
  },

  async resetPet() {
    // 测试用：清空当前宠物，回到未建档态，方便重入建档流程
    await delay(120)
    const d = load()
    d.pet = null
    d.hasPet = false
    d.echoes = []
    d.onboarding = {}
    save()
    return { ok: true }
  },

  async petPatch(p: { signature?: string; visibility?: Visibility }) {
    await delay()
    const d = load()
    if (!d.pet) throw new ApiError(2003, '还没有它的档案哦')
    if (p.signature !== undefined) d.pet.signature = gentle(p.signature)
    if (p.visibility !== undefined) d.pet.visibility = p.visibility
    save()
    return d.pet
  },

  async petVisit() {
    await delay(200)
    const d = load()
    if (!d.pet) throw new ApiError(2003, '还没有它的档案哦')
    // 温度回暖：不惩罚式，只由 1v1 陪伴驱动；地板 60
    d.pet.temperature = Math.max(60, Math.min(100, d.pet.temperature + 3))
    const newEcho: Echo = {
      echoId: `e-${Date.now()}`,
      text: gentle('你来啦，它感觉到你了。午后的光很好，它刚打了个小小的哈欠。'),
      tone: 'warm',
      createdAt: Date.now(),
      placeholder: { gradient: 'linear-gradient(135deg,#f6e7cf,#ecd3ad)', emoji: '🌤️' },
    }
    d.echoes = [newEcho, ...d.echoes]
    save()
    return { temperature: d.pet.temperature, newEchoes: [newEcho] }
  },

  async echoes(_cursor): Promise<Paged<Echo>> {
    await delay(80)
    const d = load()
    return { items: d.echoes, nextCursor: null }
  },

  async echoReroll(): Promise<Paged<Echo>> {
    // 换一批（B7）：同一批回忆换个口吻再说一遍。
    // 红线：echoId / 时间 / 配图都不动 —— 只有 text 与 tone 换，回忆一条都没少。
    await delay(320)
    const d = load()
    if (!d.pet) throw new ApiError(2003, '还没有它的档案哦')
    d.rerollRound = (d.rerollRound ?? 0) + 1
    const picked = REROLL_FRAMES[d.rerollRound % REROLL_FRAMES.length]
    d.echoes = d.echoes.map((e) => ({
      ...e,
      tone: picked.tone,
      text: gentle(picked.frame(echoCoreOf(d, e))),
    }))
    save()
    return { items: d.echoes, nextCursor: null }
  },

  async replyEcho(echoId, text) {
    await delay(160)
    const reply: Echo = {
      echoId: `reply-${Date.now()}`,
      text: gentle('它把头轻轻靠了过来，好像收到了你说的话。'),
      tone: 'gentle',
      createdAt: Date.now(),
    }
    void text
    return { echoId, reply }
  },

  async flowerQuota(): Promise<FlowerQuota> {
    await delay(60)
    return quotaOf(load())
  },

  async flower(rawWindowId, payload: FlowerPayload): Promise<FlowerResult> {
    await delay(160)
    const d = load()
    const windowId = winKey(d, rawWindowId)
    const q = quotaOf(d)
    const available = q.remaining + q.purchasedBalance
    if (payload.count > available) {
      throw new ApiError(3001, '今天的心意先到这里啦，想多留一点可以补充一些')
    }
    // 先扣免费额度，再扣购买余额；**绝不写入宠物温度**（§0.7 #5）
    let remaining = payload.count
    const fromFree = Math.min(remaining, Math.max(0, DAILY_FREE - d.quota.usedToday))
    d.quota.usedToday += fromFree
    remaining -= fromFree
    if (remaining > 0) d.quota.purchasedBalance = Math.max(0, d.quota.purchasedBalance - remaining)
    d.flowersByWindow[windowId] = (d.flowersByWindow[windowId] ?? 0) + payload.count
    save()
    const total = d.flowersByWindow[windowId]
    return {
      ok: true,
      quota: quotaOf(d),
      bondMark: gentle(`你已为它留下 ${total} 束心意`),
    }
  },

  async setRemember(rawWindowId, remembered) {
    await delay(120)
    const d = load()
    const windowId = winKey(d, rawWindowId)
    // 一人一次的状态；重复置 true 幂等，不叠加、不加温度
    d.remembered[windowId] = remembered
    save()
    return { remembered }
  },

  async rememberWall(rawWindowId): Promise<RememberWall> {
    await delay(80)
    const d = load()
    const windowId = winKey(d, rawWindowId)
    const meRemembered = !!d.remembered[windowId]
    const warmth = warmthOf(d, windowId)
    return {
      warmthLevel: warmth,
      faces: facesFor(windowId, warmth, meRemembered, d.myAvatar),
      meRemembered,
    }
  },

  async plaza(cursor): Promise<Paged<Window>> {
    await delay(120)
    const d = load()
    // 游标 = 下一页起始偏移（离线实现细节；前端只认 nextCursor 不解析其含义）
    const start = Math.max(0, Number(cursor ?? 0) || 0)
    const slice = catalog.slice(start, start + PLAZA_PAGE_SIZE)
    const end = start + slice.length
    // 用暖光浓度呈现，去精确数字
    const items = slice.map((w) => ({ ...w, warmthLevel: warmthOf(d, w.petId) }))
    return { items, nextCursor: end < catalog.length ? String(end) : null }
  },

  async windowDetail(rawWindowId): Promise<WindowDetail> {
    await delay(120)
    const d = load()
    const windowId = winKey(d, rawWindowId)
    const w = findWindow(d, windowId)
    if (!w) throw new ApiError(2004, '这扇窗好像暂时关上了')
    const meRemembered = !!d.remembered[windowId]
    const warmth = warmthOf(d, windowId)
    return {
      ...w,
      isMine: windowId === MY_WINDOW,
      flowerAllowed: windowId !== MY_WINDOW,
      rememberWall: {
        warmthLevel: warmth,
        faces: facesFor(windowId, warmth, meRemembered, d.myAvatar),
        meRemembered,
      },
    }
  },

  async windowSeen(rawWindowId) {
    await delay(40)
    const d = load()
    const windowId = winKey(d, rawWindowId)
    // 看过=被动脚印，只 owner 内部可见（§0.6），此处仅累计到私域 insights
    if (!d.seenWindows.includes(windowId)) {
      d.seenWindows.push(windowId)
      d.insights.seenCount += 1
      save()
    }
    return { ok: true }
  },

  async insights(): Promise<Insights> {
    await delay(60)
    return load().insights
  },

  async search(q: string): Promise<SearchResults> {
    // 离线 mock：从现有 12(+扩充) 窗口 + 8 demo 用户 + 热门题材本地过滤（A.5 mock 分支）。
    // 轻量 delay 让联想在途有「加载态」可呈现；真接口去向见 http.ts（标 TODO）。
    await delay(90)
    const query = normalizeQuery(q)
    const d = load()
    // 用暖光浓度呈现（与广场一致，去精确数字；结果卡字段白名单在组件侧收敛）
    const windows = catalog.map((w) => ({ ...w, warmthLevel: warmthOf(d, w.petId) }))
    // 官方号「回声整理室」也是一个可被搜到的账号，accountType 让结果行显示官方标记；
    // 其余都是内部测试账号，isSeed 一路带到结果行，前端/后续统计都能识别出来。
    const users: SearchUser[] = searchableAccounts.map((u) => ({
      id: u.id,
      nickname: u.nickname,
      avatar: u.avatar,
      persona: u.persona,
      accountType: u.accountType ?? 'user',
      isSeed: u.isSeed,
    }))
    return runSearch(query, { windows, users })
  },

  async userProfile(userId): Promise<UserProfile> {
    await delay(90)
    const d = load()
    const u = searchableAccounts.find((x) => x.id === userId)
    // 总闸关掉测试账号后，原来的链接会指向一个查不到的人——给温柔话术，不抛技术错误
    if (!u) throw new ApiError(2005, '这个人的主页暂时打不开')
    const followedByMe = followingOf(d).includes(userId)
    return {
      id: u.id,
      nickname: u.nickname,
      avatar: u.avatar,
      persona: u.persona,
      accountType: u.accountType ?? 'user',
      isSeed: u.isSeed,
      // 我这一关注也要如实计进去，否则点了关注数字纹丝不动，看着像没生效
      followerCount: baseFollowerCount(u.id) + (followedByMe ? 1 : 0),
      followingCount: baseFollowingCount(u.id),
      followedByMe,
      isMe: false,
    }
  },

  async userWindows(userId, cursor): Promise<Paged<Window>> {
    await delay(110)
    const d = load()
    // 作品墙只收公开的窗（可见性裁剪在服务端做，这里按同一口径过一遍）
    const mine = catalog.filter((w) => w.ownerId === userId && (w.visibility ?? 'public') === 'public')
    const start = Math.max(0, Number(cursor ?? 0) || 0)
    const slice = mine.slice(start, start + USER_WINDOWS_PAGE_SIZE)
    const end = start + slice.length
    const items = slice.map((w) => ({ ...w, warmthLevel: warmthOf(d, w.petId) }))
    return { items, nextCursor: end < mine.length ? String(end) : null }
  },

  async setFollow(userId, follow): Promise<FollowResult> {
    await delay(140)
    const d = load()
    const cur = followingOf(d)
    // 幂等：重复关注不叠加，取关不存在的关系也不报错
    d.following = follow ? [...new Set([...cur, userId])] : cur.filter((x) => x !== userId)
    save()
    const followedByMe = d.following.includes(userId)
    return {
      followedByMe,
      followerCount: baseFollowerCount(userId) + (followedByMe ? 1 : 0),
    }
  },

  async leaveMessage(windowId, text): Promise<{ ok: boolean }> {
    await delay(180)
    if (!MOCK_LEAVE_MESSAGE_ON) {
      // 前端此时根本不该有入口可点；这一层是服务端侧的第二道校验，照真后端该有的样子写。
      throw new ApiError(4030, '这里暂时安静一会儿')
    }
    if (!text.trim()) throw new ApiError(4001, '还没有写下什么呢')
    const d = load()
    // 留在**别人**窗上的话，会去到那个人的待处理列表——在单用户 mock 里我看不到它，
    // 这恰好就是正确的产品行为：留言者对处理结果一无所知（PALETTE I-05）。
    if (windowId === 'w-mine') {
      pendingOf(d).unshift({
        id: `pm-${Date.now()}`,
        authorName: '温柔的旅人',
        authorAvatar: d.myAvatar,
        text: text.trim().slice(0, 60),
        time: '刚刚',
      })
      save()
    }
    // 🔴 回执只有 ok：不给 id、不给状态，杜绝日后长出「我留的话被收下了吗」的界面
    return { ok: true }
  },

  async pendingMessages(windowId): Promise<Paged<PendingMessage>> {
    await delay(90)
    // 🔴 只有窗主本人读得到；别人的窗一律空，不是「暂无权限」而是压根没有这份数据
    if (windowId !== 'w-mine') return { items: [], nextCursor: null }
    return { items: [...pendingOf(load())], nextCursor: null }
  },

  async resolveMessage(messageId, disposition: MessageDisposition): Promise<{ ok: boolean }> {
    await delay(140)
    const d = load()
    const list = pendingOf(d)
    const msg = list.find((m) => m.id === messageId)
    // 幂等：重复处理同一条不报错（作者手抖点两下不该看到红字）
    if (!msg) return { ok: true }
    d.pending = list.filter((m) => m.id !== messageId)
    // 「收下公开」→ 落到这扇窗的温柔回声里；「只自己看」与「不留」都只是从待处理里消失。
    // 🔴 三个分支都**不产生任何发往留言者的通知**——包括「不留」，那正是 I-05 的红线。
    if (disposition === 'publish') {
      publishedOf(d).unshift({
        id: `we-${msg.id}`,
        authorName: msg.authorName,
        authorAvatar: msg.authorAvatar,
        text: msg.text,
        time: msg.time,
      })
    }
    save()
    return { ok: true }
  },

  async postcards(): Promise<Paged<Postcard>> {
    await delay(60)
    const d = load()
    // 统一分页信封（QA M-8）；mock 单页到底，nextCursor=null
    return { items: d.pet?.postcards ?? [], nextCursor: null }
  },

  async unlockPostcard(id) {
    await delay(160)
    const d = load()
    if (!d.pet) throw new ApiError(2003, '还没有它的档案哦')
    // 内容永远靠陪伴解锁；此处模拟里程碑达成
    const pc = d.pet.postcards.find((p) => p.id === id)
    if (pc) {
      pc.locked = false
      pc.caption = pc.caption ?? gentle('又一段温柔的回忆，被慢慢珍藏了下来')
      pc.date = pc.date ?? today().replace(/-/g, '.')
      pc.placeholder = pc.placeholder ?? { gradient: 'linear-gradient(150deg,#f6e4c4,#e7c087)', emoji: '🌿' }
      save()
    }
    return { unlocked: true }
  },

  async postcardSkins(): Promise<PostcardSkin[]> {
    await delay(60)
    // 与后端同形；离线也能浏览款式（皮肤/边框/材质），不涉及任何内容解锁
    return POSTCARD_SKINS.map((s) => ({ ...s }))
  },

  async purchase(skinId: string): Promise<PurchaseResult> {
    await delay(160)
    const d = load()
    // 护栏（定案 D2/CR-M）：购买仅款式/增值，绝不影响解锁进度 → affectsUnlock 恒 false
    // 「补充心意」复用同一购买入口（契约 §0.7 #3「献花可买」）：离线态补一些心意额度，保 UX 可跑
    if (skinId === FLOWER_TOPUP_SKU) {
      rollQuota(d)
      d.quota.purchasedBalance += FLOWER_TOPUP_COUNT
      save()
    }
    return { ok: true, skinId, affectsUnlock: false }
  },

  async relations(): Promise<RelationUser[]> {
    await delay(80)
    // 亲友名单全是测试账号，总闸关掉后返回空（亲友页有 rel-empty 空态）
    return SHOW_TEST_DATA ? seedRelations : []
  },

  async patchRelation(_id, _patch: { priority?: boolean; mute?: MuteDuration | 'clear' }) {
    await delay(60)
    // 关系链的可变状态在前端 useRelations 内维护（原型态），此处仅回执
    return { ok: true }
  },

  async relationReelSeen(_id) {
    await delay(40)
    return { ok: true }
  },

  async records(scope): Promise<Paged<RecordItem>> {
    await delay(80)
    const d = load()
    const all = [...d.records].sort((a, b) => b.createdAt - a.createdAt)
    const items = scope === 'all' ? all : all.filter((r) => r.scope === scope)
    // 统一分页信封（QA M-2）；mock 单页到底，nextCursor=null
    return { items, nextCursor: null }
  },

  async createRecord(p: { scope: 'pet' | 'self'; text: string; photoRefs?: string[] }) {
    await delay(120)
    const d = load()
    const rec: RecordItem = {
      id: `rec-${Date.now()}`,
      scope: p.scope,
      text: gentle(p.text),
      createdAt: Date.now(),
    }
    d.records = [rec, ...d.records]
    save()
    return rec
  },

  async messages(): Promise<Paged<Message>> {
    await delay(80)
    // 读时再过一遍总闸：改环境变量不会清掉已有的 localStorage
    const items = (SHOW_TEST_DATA ? [...load().messages] : []).sort((a, b) => b.createdAt - a.createdAt)
    // 统一分页信封（QA M-1）；未读柔性暖点由前端 items.some(!read) 判定
    return { items, nextCursor: null }
  },

  async reactionArrivals(cursor?: string): Promise<Paged<ReactionArrival>> {
    await delay(70)
    if (!SHOW_TEST_DATA) return { items: [], nextCursor: null }

    // 与真后端同构的三步。🔴 **游标的单位是「卡」不是「回应行」**：
    // 一张卡的回应整块落在同一页，翻页永远切不开它，
    // 于是「一张卡只出一条」在数据源头就成立，不必指望前端恰好把相关行拉进了同一批。
    //
    // 🔴 仍然返回**未合并**的行（一张卡至多两行：记得、献花），合并交给 api/arrivals.ts。
    // 合并有意留在两处：红线不该只有一处实现。

    // ① 每卡每类只留最新一行。等价性（与拿全量行合并逐字段相同）已在
    //    arrivals.test.ts 里独立验过，并钉住了它依赖「已读由单调水位派生」这个前提。
    const newestByCard = new Map<string, Map<ReactionKind, ReactionArrival>>()
    for (const a of arrivalsOf(load())) {
      let byKind = newestByCard.get(a.cardId)
      if (!byKind) newestByCard.set(a.cardId, (byKind = new Map()))
      const prev = byKind.get(a.reaction)
      if (!prev || a.createdAt > prev.createdAt) byKind.set(a.reaction, a)
    }

    // ② 卡按「最近一次被回应」倒序，刚热起来的窗自然浮上来
    const latestOf = (byKind: Map<ReactionKind, ReactionArrival>) =>
      Math.max(...[...byKind.values()].map((m) => m.createdAt))
    const cards = [...newestByCard.keys()].sort(
      (x, y) => latestOf(newestByCard.get(y)!) - latestOf(newestByCard.get(x)!),
    )

    // ③ 按卡切页。⚠️ offset 游标与 records/messages/postcards 一致，
    //    翻页途中新来回应会让排序漂移、边界那张卡可能重复或漏。重复这一侧无害
    //    （合并按 cardId 归并，会被吸收，有用例钉着）；根治要换 (最新时刻, cardId) keyset。
    const from = Math.max(0, Number.parseInt(cursor ?? '0', 10) || 0)
    const to = Math.min(cards.length, from + ARRIVAL_PAGE_SIZE)
    const items = cards.slice(from, to).flatMap((id) => [...newestByCard.get(id)!.values()])
    return { items, nextCursor: to < cards.length ? String(to) : null }
  },

  async readMessages(ids) {
    await delay(40)
    const d = load()
    for (const m of d.messages) if (ids.includes(m.id)) m.read = true
    // 到达是合并出来的，一个 id 背后是这张卡下的**全部**回应，要整卡一起标已读。
    // 只标一条的话暖点散不掉（mergeArrivals 里「任一未读即未读」会把它留着）。
    const arrivals = arrivalsOf(d)
    for (const id of ids) {
      const cardId = cardIdOfArrival(id)
      if (!cardId) continue
      for (const a of arrivals) if (a.cardId === cardId) a.read = true
    }
    save()
    return { ok: true }
  },

  async spectrum() {
    await delay(80)
    return load().spectrum
  },

  async spectrumAnchor(label): Promise<SpectrumNodeView> {
    await delay(120)
    const d = load()
    // mock 持布局：直接生成视觉 VM（行为与拆分前一致）
    const tones: SpectrumNodeView['tone'][] = ['amber', 'blossom', 'green']
    const node: SpectrumNodeView = {
      id: `n-${Date.now()}`,
      x: 24 + Math.round(Math.random() * 52),
      y: 22 + Math.round(Math.random() * 56),
      size: 16 + Math.round(Math.random() * 8),
      tone: tones[Math.floor(Math.random() * 3)],
      delay: Math.random() * 2.5,
      label: gentle(label),
    }
    d.spectrum.nodes = [...d.spectrum.nodes, node]
    save()
    return node
  },

  async spectrumIntegrate(id): Promise<{ node: SpectrumNodeView }> {
    await delay(160)
    const d = load()
    const shadow: ShadowAreaView | undefined = d.spectrum.shadows.find((s) => s.id === id)
    const node: SpectrumNodeView = {
      id: `n-int-${id}-${Date.now()}`,
      x: shadow?.x ?? 50,
      y: shadow?.y ?? 50,
      size: 18,
      tone: 'amber',
      delay: Math.random() * 2,
      label: gentle(shadow?.whisper ?? '被温柔接住的那一面'),
    }
    d.spectrum.shadows = d.spectrum.shadows.filter((s) => s.id !== id)
    d.spectrum.nodes = [...d.spectrum.nodes, node]
    save()
    return { node }
  },

  // ============================================================ 作品（t_work）

  async publishWork(input: PublishWorkInput): Promise<{ work: Work; message: string }> {
    await delay(240)
    const d = load()
    const state = worksState(d)
    // mock 里 mediaKey 就是 upload 返回的 objectURL 资源 id，直接当地址用
    const work = mockPublish(state, input, d.accountId, input.mediaKey, input.posterKey ?? '')
    d.works = state.works
    save()
    // 🔴 「已提交」不是「已发布」：落 pending，还要过审，广场上现在还看不到它
    return { work, message: '已提交，过一会儿就能在广场看到它了。' }
  },

  async works(cursor): Promise<Paged<Work>> {
    await delay(120)
    const all = mockFeed(worksState(load()))
    return slicePage(all, cursor)
  },

  async userWorks(userId, cursor): Promise<Paged<Work>> {
    await delay(120)
    const d = load()
    const all = mockAuthorWorks(worksState(d), userId, userId === d.accountId)
    return slicePage(all, cursor)
  },

  async workDetail(workId): Promise<{ work: Work }> {
    await delay(90)
    const found = worksState(load()).works.find((w) => w.id === workId)
    if (!found) throw new ApiError(2004, '这个作品找不到了。')
    return { work: found }
  },

  async deleteWork(workId): Promise<{ ok: boolean }> {
    await delay(120)
    const d = load()
    const state = worksState(d)
    // 🔴 mock 这里是真删数组，服务端是软删（G0-1）。对前端行为等价，
    //    但别照着 mock 去理解后端语义
    state.works = state.works.filter((w) => w.id !== workId)
    d.works = state.works
    save()
    return { ok: true }
  },
}

/** 旧 localStorage 缓存里没有 works 字段，兜底建一份种子，不为此 bump DB_VERSION。 */
function worksState(d: MockDB): WorksMockState {
  if (!d.works) {
    d.works = freshWorks(d.accountId).works
  }
  return { works: d.works }
}

/** 游标 = 下一页起始偏移，与 plaza 同一套（前端只认 nextCursor，不解析其含义）。 */
function slicePage<T>(all: T[], cursor?: string): Paged<T> {
  const size = 12
  const start = Math.max(0, Number(cursor ?? 0) || 0)
  const items = all.slice(start, start + size)
  const end = start + items.length
  return { items, nextCursor: end < all.length ? String(end) : null }
}
