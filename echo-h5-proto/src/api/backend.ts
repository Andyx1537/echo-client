// 后端契约接口：真实 HTTP 后端与本地 mock 后端都实现它。
// 方法/字段严格对齐 docs/API-CONTRACT.md（v1）。client.ts 按 env 选择实现。

import type { CardId, PetId } from '../lib/ids'
import type {
  Echo,
  FeatureFlags,
  FlowerQuota,
  FlowerType,
  Insights,
  Me,
  Message,
  MessageDisposition,
  MyPet,
  PendingMessage,
  OnboardingCandidate,
  Paged,
  Postcard,
  PostcardSkin,
  PurchaseResult,
  ReactionArrival,
  RecordItem,
  RelationUser,
  RememberWall,
  SearchResults,
  Session,
  UserProfile,
  Visibility,
  Window,
  Work,
  PublishWorkInput,
  MuteDuration,
  SpectrumNodeView,
  ShadowAreaView,
} from '../types'

/** 识别出的单个主体（可能一张图里有多个） */
export interface DetectSubject {
  subjectType: 'animal' | 'person' | 'other'
  species: string
  confidence: number
  /** 归一化位置框（0~1，相对肖像宽高），用于多主体时让用户点选单一主体；可缺省 */
  box?: { x: number; y: number; w: number; h: number }
}

/** POST /pet/onboarding/detect 返回：肖像 → 识别到的主体列表（>1 时前端要求用户选定单一主体后才能确认） */
export interface DetectResult {
  subjects: DetectSubject[]
}

/** POST /pet/onboarding/start 入参 */
export interface OnboardingStartPayload {
  petName: string
  species: string
  /**
   * 主体类型的**生效值**，默认 animal。🔴 **已实现的线上契约字段，不改名、不扩值。**
   *
   * 🔴 这是**用户随手能改的预填值**，不是生成门控的判据。门控判据是素材侧的
   * `assetSubjectType`（规格 `SPEC-subject-recognition-and-degradation`），两者严禁互相赋值。
   * 三处同名不同义的完整辨析见 `lib/subjectDeclaration.ts` 文件头。
   */
  subjectType?: 'animal' | 'person' | 'other'
  /**
   * 🆕 机器原判（`/detect` 出参原样），未识别出为 `null`。
   * ⚠️ **后端尚未提供此字段**，契约缺口已列入回执。
   */
  machineSubjectType?: 'animal' | 'person' | 'other' | null
  /**
   * 🆕 用户指认。🔴 `null` = 未作答（「以后再说」或直接走过），**不等于选了 animal**。
   * ⚠️ **后端尚未提供此字段**，契约缺口已列入回执。
   */
  userSubjectType?: 'animal' | 'person' | 'other' | null
  /**
   * 🆕 生效值的来源。🔴 `'user'` 是「用户主动填写」的载体——按裁定第 4 条，
   * **生成侧要真的读它并偏向用户的意愿**，不只是留个痕。
   * ⚠️ **后端尚未提供此字段**，契约缺口已列入回执。
   */
  subjectSource?: 'machine' | 'user' | 'default'
  rawDesc: string
  traits: string[]
  photoRefs?: string[]
  /** 训练授权（PIPL 独立 opt-in，与纪念场景 allowUse 分开）：同意素材用于改进与模型训练 */
  trainConsent?: boolean
}

/** POST /pet/onboarding/confirm 入参 */
export interface OnboardingConfirmPayload {
  onboardingId: string
  finalCandidateId: string
  memoryScene: { caption: string; allowUse: boolean }
}

/** POST /windows/:petId/flower 入参 */
export interface FlowerPayload {
  count: number
  type: FlowerType
  message?: string
  anonymous: boolean
}

/** 献花返回 */
export interface FlowerResult {
  ok: boolean
  quota: FlowerQuota
  bondMark: string
}

/** 窗口详情（GET /windows/:petId） */
export interface WindowDetail extends Window {
  flowerAllowed: boolean
  rememberWall: RememberWall
  /**
   * 这扇窗是不是我自己的。
   *
   * ⚠️ 不要拿 `flowerAllowed` 当替身——它现在恰好等于「不是我的窗」，但它回答的是
   * 「能不能献花」。哪天献花多一条限制（比如对方关了互动），两个语义就会分叉，
   * 而留言的作者侧界面会跟着跑到别人的窗上去。
   */
  isMine: boolean
}

/**
 * 关注/取关的回执（POST · DELETE /users/:id/follow）。
 * 回执带上最新粉丝数，前端不用自己加减，避免并发下数字与服务端不一致。
 */
export interface FollowResult {
  followedByMe: boolean
  followerCount: number
}

/** 后端统一接口 */
export interface EchoBackend {
  // 0. 服务端功能开关（DECISIONS S13）
  /**
   * 拉取服务端功能开关。🔴 **前端只读**：没有写开关的方法，也不该有。
   * 拿不到时由 `hooks/useFeatureFlags.ts` 兜底为**全部关闭**。
   */
  featureFlags(): Promise<FeatureFlags>

  // 1. 鉴权 / 账号
  authGuest(deviceId: string): Promise<Session>
  bind(type: 'phone' | 'wechat', credential: string): Promise<{ isGuest: boolean }>
  me(): Promise<Me>

  // 2. 建档 Onboarding
  onboardingStart(
    payload: OnboardingStartPayload,
  ): Promise<{ onboardingId: string; candidates: OnboardingCandidate[] }>
  onboardingRefine(
    onboardingId: string,
    chosenCandidateId: string,
    adjust: string,
  ): Promise<{ candidates: OnboardingCandidate[] }>
  onboardingConfirm(payload: OnboardingConfirmPayload): Promise<{ petId: string }>
  upload(file: File): Promise<{ resourceId: string; url: string }>
  /** 肖像识别：把已上传肖像的 resourceId 交后端视觉模型，返回种类/主体类型/置信度 */
  detectSubject(resourceId: string): Promise<DetectResult>

  // 3. 我的它
  petMe(): Promise<MyPet>
  petPatch(patch: { signature?: string; visibility?: Visibility }): Promise<MyPet>
  petVisit(): Promise<{ temperature: number; newEchoes: Echo[] }>
  /** 测试用：删除当前宠物，回到未建档态（方便重入建档流程） */
  resetPet(): Promise<{ ok: boolean }>

  // 4. 近况/来信
  echoes(cursor?: string): Promise<Paged<Echo>>
  replyEcho(echoId: string, text: string): Promise<{ echoId: string; reply?: Echo }>
  /**
   * 「换一批」（定案 B7 / 验收 TC-23）：把当前这批近况**换个表达口吻/呈现**再说一遍。
   * 语义红线：换的是说法，**不抹掉任何已有回忆**——同一段回忆的 echoId 保持不变。
   * 免费次数（默认每轮 1 次）由 api/rerollQuota.ts 统一裁定，此处只负责取新一批文本。
   */
  echoReroll(): Promise<Paged<Echo>>

  // 5. 献花 & 记得（拆开）
  // 🔴 这一组收的是 **petId**，不是广场发的那个 id。迁移期的坑见 `lib/ids.ts`
  flowerQuota(): Promise<FlowerQuota>
  flower(petId: PetId, payload: FlowerPayload): Promise<FlowerResult>
  setRemember(petId: PetId, remembered: boolean): Promise<{ remembered: boolean }>
  rememberWall(petId: PetId): Promise<RememberWall>

  // 6. 窗口页 / 广场
  plaza(cursor?: string): Promise<Paged<Window>>
  windowDetail(petId: PetId): Promise<WindowDetail>
  windowSeen(petId: PetId): Promise<{ ok: boolean }>
  insights(): Promise<Insights>

  // 6.1 搜索（附录 A）：GET /search?q= → 三分区各自 {items,nextCursor} 信封（A.5）
  search(q: string): Promise<SearchResults>

  // 6.2 通用他人主页 + 关注（SPEC-feature-pages §2.4 · PRD-RESONANCE-PUBLISHING E1）
  //     🔴 术语：这一组全是「关注」（人与人的关系），与付费的「订阅」严格分开，
  //     方法名/路径/埋点一律 follow*，出现 subscribe/sub_* 即为写错方向。
  /** 某个账号的公开档案（含精确粉丝数；🔴 只供个体主页使用，勿下发到信息流卡片） */
  userProfile(userId: string): Promise<UserProfile>
  /** 某个账号的作品墙：ta 公开的窗口，按可见性裁剪后分页返回 */
  userWindows(userId: string, cursor?: string): Promise<Paged<Window>>
  /** 关注 / 取消关注 ta（E1b，P0）。单向关系，幂等 */
  setFollow(userId: string, follow: boolean): Promise<FollowResult>

  // 6.3 C1 留一句话（DECISIONS S13 · PALETTE §56/§186）
  //     🔴 整组能力由 featureFlags().leaveMessage 控制，P0 默认关闭。
  //     🔴 开关关闭时前端根本不呈现入口，但服务端**仍须自行校验**——
  //        入口藏起来不等于接口关掉了，客户端不是权限边界。
  /**
   * 访客在某扇窗留一句话（最长 60 字）。
   *
   * 🔴 回执**刻意只有 `ok`**：不返回留言 id、不返回状态、不返回作者的处理结果。
   * `PALETTE I-05` 定死了「绝不显示被拒绝」，而只要回执里带上任何可查询的句柄，
   * 早晚会有人做一个「我留的话怎么样了」的界面，那条红线就等于没有了。
   */
  /*
   * 🔴 **收 cardId**：后端把留言那一组挂在 `/cards/:cardId/` 下，
   * 与 `/windows/:petId/flower` **不是一套键**（后端 `LeaveWordsApi` 类注释专门解释了
   * 为什么挂 `/cards/` 而不是 `/windows/`）。标成 `CardId` 是如实描述契约。
   */
  leaveMessage(cardId: CardId, text: string): Promise<{ ok: boolean }>
  /** 作者侧：这扇窗上待我处理的留言。🔴 仅窗主本人可读，非窗主一律空 */
  pendingMessages(cardId: CardId): Promise<Paged<PendingMessage>>
  /**
   * 作者侧三选一处理（收下公开 / 只自己看 / 不留）。
   * 🔴 三个动作对留言者**一视同仁地静默**：不通知、不回执、不留痕。
   */
  resolveMessage(messageId: string, disposition: MessageDisposition): Promise<{ ok: boolean }>

  // 7. 明信片墙（分页信封 {items,nextCursor}，QA M-8）+ 款式商店（装扮·增值）
  postcards(): Promise<Paged<Postcard>>
  unlockPostcard(id: string): Promise<{ unlocked: boolean }>
  /** 款式商店：只卖皮肤/边框/材质（装扮·增值）。后端 {items} 信封，取 .items（§14.1） */
  postcardSkins(): Promise<PostcardSkin[]>
  /** 购买一款款式（装扮·增值）；服务端护栏 affectsUnlock:false，绝不锁内容（定案 D2/CR-M） */
  purchase(skinId: string): Promise<PurchaseResult>

  // 8. 亲友列表
  relations(): Promise<RelationUser[]>
  patchRelation(
    id: string,
    patch: { priority?: boolean; mute?: MuteDuration | 'clear' },
  ): Promise<{ ok: boolean }>
  relationReelSeen(id: string): Promise<{ ok: boolean }>

  // 9. 记录（分页信封 {items,nextCursor}，QA M-2）
  records(scope: 'pet' | 'self' | 'all', cursor?: string): Promise<Paged<RecordItem>>
  createRecord(payload: {
    scope: 'pet' | 'self'
    text: string
    photoRefs?: string[]
  }): Promise<RecordItem>

  // 10. 消息（分页信封 {items,nextCursor}，QA M-1）
  messages(cursor?: string): Promise<Paged<Message>>
  /**
   * 标记已读。
   * ⚠️ 传进来的 id 可能是**合并后的到达 id**（`arrival:<cardId>`，见 api/arrivals.ts）——
   * 那种情况要把该卡下**全部**回应一起标已读，不能只标一条，否则暖点散不掉。
   */
  readMessages(ids: string[]): Promise<{ ok: boolean }>

  // 10.1「被接住」的到达（PRODUCT-MINDMAP §6.2 B20）
  /**
   * 别人对我的卡做出的回应（记得 / 献花），🔴 **未合并的原始形态**，一次回应一行。
   *
   * 合并成「一张卡一条通知」由前端 `mergeArrivals()` 做（它有用例钉着红线）。
   * 服务端**也该合**，但两边都做不是浪费：「一张卡只出一条」是红线，
   * 不该依赖上游实现正确——真后端某天多下发几行，用户立刻被刷屏。
   *
   * 🔴 返回里**不要带人数**。到达只说「有人」，人数字段一旦存在就迟早会被渲染成
   * 「3 个人记得了它」，而那与共鸣厅「不显热度与精确记得数」是同一条红线。
   */
  reactionArrivals(cursor?: string): Promise<Paged<ReactionArrival>>

  // 11. 光谱（前端持布局：api 层已把后端语义 DTO 映射为视觉 VM，QA M-4）
  spectrum(): Promise<{ nodes: SpectrumNodeView[]; shadows: ShadowAreaView[] }>
  spectrumAnchor(label: string): Promise<SpectrumNodeView>
  spectrumIntegrate(id: string): Promise<{ node: SpectrumNodeView }>

  // 12. 作品（t_work / WorksApi）。补的是主线第 10 步：此前服务端没有任何发布入口。
  /** 发布作品。🔴 成功回执是「已提交」不是「已发布」——落库为 pending，还要过审 */
  publishWork(input: PublishWorkInput): Promise<{ work: Work; message: string }>
  /** 作品瀑布 */
  works(cursor?: string): Promise<Paged<Work>>
  /** 个人作品页。自己看自己时会带上 status/visibility */
  userWorks(userId: string, cursor?: string): Promise<Paged<Work>>
  workDetail(workId: string): Promise<{ work: Work }>
  deleteWork(workId: string): Promise<{ ok: boolean }>
}

/**
 * 「补充心意」的购买 SKU：献花额度可买（契约 §0.7 #3「献花每日5朵/可买」），
 * 复用款式商店同一购买入口 POST /shop/purchase。属增值心意、非内容解锁。
 */
export const FLOWER_TOPUP_SKU = 'flower_topup'

/** 业务错误（携带温柔文案 msg 与错误码 code） */
export class ApiError extends Error {
  code: number
  detail?: string
  constructor(code: number, msg: string, detail?: string) {
    super(msg)
    this.code = code
    this.detail = detail
    this.name = 'ApiError'
  }
}
