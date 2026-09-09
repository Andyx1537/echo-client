// 数据模型：严格对齐 docs/API-CONTRACT.md（v1）字段命名，前后端唯一真源。

import type { CardId, PetId } from './lib/ids'

/**
 * 账号类型，对齐后端 `t_account.accountType`（闭集，DEFAULT 'user'）：
 * user 普通用户 · ops 官方运营号（平台自产内容的署名主体）· system 系统号。
 *
 * 注意：这里**刻意不加 'test' 之类的值**。"是谁在说话"与"这条数据是不是真实的"是两个维度，
 * 内部测试账号在功能上就是普通用户（accountType='user'），它的测试身份由 `isSeed` 单独标记。
 * 详见 data/testData.ts 顶部说明。
 */
export type AccountType = 'user' | 'ops' | 'system'

/**
 * 内容来源，对齐后端 `t_memory_card.originType`：
 * user 真实用户发布 · official 官方运营号发布 ·
 * seed_ops 运营铺量的种子内容 · seed_ai AI 生成的种子内容。
 *
 * 后端把它当作**唯一的排除谓词**：对账与指标查询按 `originType='user'` 过滤，
 * 种子内容不占冷启动保底位。前端沿用同一套取值，避免上线时两边口径打架。
 */
export type ContentOrigin = 'user' | 'official' | 'seed_ops' | 'seed_ai'

/**
 * 被牵挂对象的品类，对齐 `SPEC-security §4.3.1` 的联动矩阵（该处是唯一定义位置）。
 *
 * ⚠️ 规格只枚举了 `person` / `pet` 两个值。`PRODUCT-MINDMAP §3.1` 提到的「被牵挂的物 / 地方」
 * 只写了「`objectKind ≠ person`」，没有给出具体取值，因此这里**不擅自造名**——
 * 等那两个品类立项时由规格补齐，前端跟着加。P0 只做宠物，当前不受影响。
 */
export type ObjectKind = 'pet' | 'person'

/**
 * 被牵挂对象的状态（`SPEC-security §4.3.1`）。
 * 🔴 **默认 `unknown`**，且 🔴 **不许由模型推断、不许从文本反推**——必须由数据侧显式传入。
 * 缺字段或取值非法时一律按 `unknown` 走最保守分支。
 */
export type ObjectStatus = 'unknown' | 'deceased' | 'living'

/** 一段柔和的占位色，模拟"会呼吸的电子明信片"定妆图 */
export interface Placeholder {
  /** CSS 渐变背景，模拟场景图 */
  gradient: string
  /** 场景里点缀的 emoji（作为氛围点睛，不是真图） */
  emoji: string
  /** 原创或已获授权的本地视觉素材；缺省时退回渐变占位 */
  imageUrl?: string
  /**
   * 这份视觉素材含 AI 生成成分 → 前端叠一枚「该内容由 AI 生成」角标（不烧进图片）。
   *
   * 判定口径与「是否运营种子内容」无关：真实用户的唤醒视频、由用户素材派生的定妆/回声配图
   * 同样为 true。只标注**有真实素材来源的派生物**，平台凭空编造的内容不走这条路。
   *
   * 🔴 **缺省（undefined）按 `true` 处理**——漏标的风险高于误标，所以不确定的一侧倒向标注。
   * 只有真实拍摄、未经 AI 处理的用户原图才由数据侧**显式**写 `false`。
   * 判定统一走 `lib/aiGenerated.ts` 的 `isAiGenerated()`，各组件不要自己写 `!!aiGenerated`。
   */
  aiGenerated?: boolean
}

/** 生命之书里的一个精选里程碑 */
export interface LifeMoment {
  title: string
  year: string
  desc: string
  placeholder: Placeholder
}

/**
 * 窗口详情里的一条「温柔回声」= 来自其他人的共鸣留言。
 * 注意：这是真实用户的回应（非 AI、也绝不替宠物/逝者代言，§ 反例），故不加「AI 想象」标识。
 */
export interface WindowEcho {
  id: string
  /** 留下回声的人 */
  authorName: string
  /** 头像占位色（CSS 渐变） */
  authorAvatar: string
  /** 一句温柔共鸣（已过 COPY-GUIDE 词表基调） */
  text: string
  /** 相对时间串，如「2 小时前」 */
  time: string
}

/** 可见性直白三档（§0.7 #1，服务端强制），默认 private */
export type Visibility = 'private' | 'friends' | 'public'

/** 回忆卡来源。与服务端 CardView.sourceType 保持一一对应。 */
export type CardSourceType = 'record' | 'book_page' | 'postcard' | 'echo'

/**
 * 共鸣厅列表项（GET /plaza），逐字段对应服务端 CardView。
 * 列表面刻意不包含作者、暖光、互动计数和正文全文。
 */
export interface PlazaCard {
  id: CardId
  petId: PetId
  title: string
  excerpt: string
  cover: string
  hasCover: boolean
  sourceType: CardSourceType | ''
  topicIds: string[]
  publishedAt: number | null
  /** mock/视觉演示专用增强信息；真实 HTTP 响应不会提供。 */
  presentation?: {
    category?: NonNullable<Window['category']>
    cover: Placeholder
    ownerName?: string
    ownerAvatar?: string
    ownerAccountType?: AccountType
  }
}

/**
 * 一扇窗 = 一段可分享的记忆窗口（GET /windows/:petId）。
 * 注意：契约 §6 去掉了精确 rememberCount，改用 warmthLevel（暖光浓度 0-1），
 * 前端据此渲染光晕强度，**绝不展示数字/排名**（§0.7 #4 红线）。
 */
export interface Window {
  /**
   * 🔴 **卡片键**（`GET /plaza` 的 `item.id`）。后端已改发回忆卡，所以它是 cardId，
   * **不再等于 petId**——拿它去调 `/windows/:petId/*` 是静默 404。
   * 🔴 要窗口键必须走 `lib/ids.ts` 的 `petIdOfCard()`，不要就地 `as`。
   */
  id: CardId
  /**
   * 🔴 **窗口键**：这张卡所属的那扇窗（后端 `CardView` 出参的 `petId`，string、**不可空**）。
   * `/windows/:petId/*` 那一组端点收的是这个。
   */
  petId: PetId
  /** 历史字段：宠物窗口的名称；兼容现有接口。非宠物窗口应同时传 title。 */
  petName: string
  /** 面向用户的标题：可为宠物、地点、物件、关系或一段时期 */
  title?: string
  /** 运营内容分栏；用于后续筛选与供给复盘 */
  category?: 'pet' | 'youth' | 'family' | 'place' | 'relationship' | 'daily'
  /**
   * 被牵挂对象的品类/状态（`DECISIONS A7` · `SPEC-security §4.3.1`）。
   * 决定生成类入口是否呈现，判定统一走 `lib/generativeEntry.ts`，各组件不要自己比对字段。
   * ⚠️ P0 只做宠物，两个字段目前都缺省；这里先留正确行为，不为它改结构。
   */
  objectKind?: ObjectKind
  objectStatus?: ObjectStatus
  /**
   * 主人账号 id；有它才能从窗口点进作者的他人主页。
   * ⚠️ 现契约（API-CONTRACT v1）的窗口对象里没有这个字段，真后端补齐前它可能缺省——
   * 缺省时前端只把作者渲染成不可点的纯文本，不去按昵称反查（昵称不唯一，会点错人）。
   */
  ownerId?: string
  /** 主人昵称 */
  ownerName: string
  /** 主人头像占位色（CSS 渐变） */
  ownerAvatar: string
  /** 作者账号类型；缺省视为 'user'。'ops' 时前端加一枚克制的官方标记 */
  ownerAccountType?: AccountType
  /**
   * 内容来源；缺省视为 'user'。原型里全部 96 条都是 'seed_ops'（内部测试数据），
   * 由内容自己带标记，不需要反查作者是不是测试账号。一次性摘除见 data/testData.ts
   */
  originType?: ContentOrigin
  /** 一句温柔近况 */
  recent: string
  /** 性情签名 */
  signature: string
  /** 暖光浓度 0-1：记得它的人聚成的一片暖意（非计数、非点赞） */
  warmthLevel: number
  /** 场景占位图 */
  cover: Placeholder
  /** 生命之书精选（详情页展示 3 条） */
  lifeBook: LifeMoment[]
  /** 卡片在瀑布流里的相对高度（还原小红书错落感） */
  span: 'short' | 'tall'
  /** 可见性（owner 视角；广场公开项恒 public） */
  visibility?: Visibility
  /** 详情页可展示的「温柔回声」= 他人共鸣留言（2-4 条，可缺省） */
  echoes?: WindowEcho[]
  /** 详情页的记忆明信片墙（含已解锁 + 虚线空位；广场态只读，可缺省） */
  postcards?: Postcard[]
}

/** 记得的"暖光面孔墙"（GET /windows/:petId/remember，§0.7 #4） */
export interface RememberWall {
  /** 暖光浓度 0-1，前端据此渲染光晕强度 */
  warmthLevel: number
  /** 记得它的人的头像（聚成一片暖光；有上限、可分页）——不返回精确总数 */
  faces: Face[]
  /** 当前账号是否已记得（一人一次的开关状态） */
  meRemembered: boolean
}

/** 面孔墙上的一张脸（头像占位色） */
export interface Face {
  accountId: string
  avatar: string
}

/** 我的今日献花额度（GET /flowers/quota，§0.7 #3） */
export interface FlowerQuota {
  dailyFree: number
  usedToday: number
  remaining: number
  purchasedBalance: number
}

/** 献花种类（§2.4） */
export type FlowerType = 'daily' | 'limited' | 'premium'

/** 我的它 · 明信片墙上的一张卡（里程碑陪伴解锁；付费只加速/款式，§2.15） */
export interface Postcard {
  id: string
  date?: string
  caption?: string
  placeholder?: Placeholder
  /** true = 尚未解锁的虚线空位 */
  locked: boolean
  /** 未解锁时的温柔提示，如"相伴满 100 天解锁" */
  unlockHint?: string
}

/**
 * 明信片款式（装扮·增值：皮肤/边框/材质）。
 * 护栏（定案 D2/CR-M）：只卖款式，**绝不把纪念内容锁进付费墙**。
 * kind：gradient 渐变皮肤 · frame 边框 · material 材质。
 */
export interface PostcardSkin {
  id: string
  name: string
  kind: 'gradient' | 'frame' | 'material'
  /** 心意点数价格（0 表示随附款式；与任何解锁进度无关） */
  price: number
}

/**
 * POST /shop/purchase 出参：款式购买回执。
 * affectsUnlock 恒为 false——购买款式不影响任何解锁进度（服务端护栏，定案 D2）。
 */
export interface PurchaseResult {
  ok: boolean
  skinId: string
  affectsUnlock: boolean
}

/** 我的宠物档案（GET /pet/me，对齐 FE MyPet） */
export interface MyPet {
  /** 后端宠物 id（亲友示例数据可为空） */
  petId?: string
  name: string
  signature: string
  /** 羁绊温度 0-100（地板 60，只由主人 1v1 陪伴驱动，外部献花不改） */
  temperature: number
  /** 可见性直白三档 */
  visibility: Visibility
  cover: Placeholder
  postcards: Postcard[]
  lifeBook: LifeMoment[]
  /** 最新一条温柔近况 */
  recent: string
  /**
   * 对象品类/状态（`DECISIONS A7`）。缺省时按「宠物 + unknown」处理：
   * P0 只做宠物，档案里没有这两个字段，不能因为缺省就把宠物的生成入口也关掉。
   * 判定走 `lib/generativeEntry.ts`。
   */
  objectKind?: ObjectKind
  objectStatus?: ObjectStatus
}

/** 我的它的近况流（GET /pet/me/echoes item） */
export interface Echo {
  echoId: string
  text: string
  /** 基调（活泼/安静轮换） */
  tone?: string
  createdAt: number
  placeholder?: Placeholder
}

/** owner 私域数据（GET /pet/me/insights，仅本人可见，§6）
 *
 * 🔴 **这个出参把两个层级的量混在了一个对象里**，裁定 2026-08-27（层级口径）：
 * 「记得」对应到**对象**（这只宠物 / 这扇窗），「看见」对应到**卡**。
 * `seenCount` 是跨卡累计，它把卡那一层的量汇总到了对象那一层 ——
 * 前端把三个数并排显示，只是把出参的形状照抄了一遍；**根在这里，不在版面**。
 *
 * 当前渲染状况（`MeScreen`）：
 * - `rememberFacesCount` —— **已不再渲染**（`H-5`，换成暖光）。出参仍在传，见下。
 * - `seenCount` —— **已不再渲染**（层级裁定）。卡那一层改用 `cardCount / unseenCardCount`。
 * - `flowersReceived` —— 仍在用，但**只用来判断是否 > 0**，不显示数值。
 *
 * 🔴 **待契约确认（`C-9`）**：上面三个字段现在都是「传了但前端不据以显示数值」。
 * 渲染层不显示 ≠ 数据没下发 —— 和 `C-8`（`rememberWall` 仍带 `faces`）是同一件事。
 * 该不该继续下发、还是收窄成布尔，归服务端线定，**本线只登记**。
 */
export interface Insights {
  seenCount: number
  rememberFacesCount: number
  flowersReceived: number
  /** 卡那一层：你放出去过几张卡。🔴 **新字段，服务端尚未提供**，mock 先给（`C-9`）。 */
  cardCount?: number
  /** 卡那一层：其中还没有人看过的几张。
   *  🔴 取「还没被看过的张数」而不是「被看过的次数」，是有意的：
   *  前者有上限（自己的卡数）、越小越好、**多发卡只会让它变大**；
   *  后者无上限、越大越好、多发卡就涨 —— 那是曝光指标。 */
  unseenCardCount?: number
}

/** 记录流 item（§2.14 双向：给它 / 给自己） */
export interface RecordItem {
  id: string
  scope: 'pet' | 'self'
  text: string
  placeholder?: Placeholder
  createdAt: number
}

/** 统一消息流 item（GET /messages，三类：亲友/系统/宠物更新，§2.14） */
export interface Message {
  id: string
  kind: 'friend' | 'system' | 'pet'
  title: string
  preview: string
  createdAt: number
  read: boolean
  /** 点击按 routeTo 跳转到统一互动系统（不自带独立互动） */
  routeTo: { type: 'window' | 'relation' | 'record' | 'echo'; id: string }
}

// —— 「被接住」的到达（PRODUCT-MINDMAP §6.2 B20）——
//
// ⚠️ 编号消歧：这里说的是 **`PRODUCT-MINDMAP §6.2` 的 `B20`**（「被接住」的到达形态）。
// `DECISIONS.md` 里另有一条 **`B20`「暖意呈现＝双模式」**，两者编号撞车但毫无关系。
// 引用时务必带上文档名，别只写「B20」。

/**
 * 别人对**我的一张卡**做出的一次回应（「有人记得了你的卡」「有人给你的卡献了花」）。
 *
 * 这是**服务端下发的未合并形态**：一次回应一条，天然就是数据库里的一行。
 * 合并成「一张卡一条通知」由前端的 `mergeArrivals()` 负责，理由见那个函数的注释。
 *
 * 🔴 **这个结构里没有「几个人」，是刻意的，不是漏字段。**
 * 一旦存在一个人数字段，它迟早会被渲染成「3 个人记得了它」，而那正是红线所禁。
 * 「不出现精确数量」靠**不持有这个数**来落实，比靠约束下游别渲染要牢固得多
 * （同 `leaveMessage` 回执只返回 `ok` 的道理）。
 */
export interface ReactionArrival {
  id: string
  /**
   * 🔴 **合并键：被回应的那张卡。** 合并粒度按「卡」不按「人」——
   * 一张卡热起来时，按人合并就是刷屏，正好撞上「绝不红点轰炸」。
   */
  cardId: string
  /** 卡的名字，用于到达通知的标题 */
  cardTitle: string
  /**
   * 回应类型。🔴 **刻意不带回应者身份**：到达只说「有人」，
   * 点进去看的是卡本身（暖光面孔墙自会呈现是谁），通知不替它把人列一遍。
   */
  reaction: ReactionKind
  createdAt: number
  read: boolean
}

/**
 * 能触发「被接住」到达的回应类型。
 * ⚠️ 本轮**只接无文本动作**（记得 / 献花）。`C1 留一句话` 的到达**已明确后移**
 * （它挂在 `S13` 的服务端开关上，P0 默认关闭），🔴 **本枚举不为它预留分支**。
 */
export type ReactionKind = 'remember' | 'flower'

/** 当前账号概要（GET /me） */
export interface Me {
  accountId: string
  isGuest: boolean
  nickname: string
  hasPet: boolean
  visibilityDefault: Visibility
}

/** 领取游客身份（POST /auth/guest 出参） */
export interface Session {
  token: string
  accountId: string
  isGuest: boolean
  hasPet: boolean
}

/** 建档某一轮 AI 生成的候选定妆（POST /pet/onboarding/start|refine） */
export interface OnboardingCandidate {
  id: string
  cover: Placeholder
  signature: string
}

/** 通用分页返回 */
export interface Paged<T> {
  items: T[]
  nextCursor: string | null
}

/** 搜索·用户结果行（GET /search users item；结构与 demo 用户一致：头像 + 昵称 + 一句签名） */
export interface SearchUser {
  id: string
  nickname: string
  /** 头像占位色（CSS 渐变） */
  avatar: string
  /** 一句签名/人设 */
  persona: string
  /** 账号类型；缺省视为 'user' */
  accountType?: AccountType
  /** true = 内部测试账号（非真实用户），见 data/testData.ts；缺省视为真实账号 */
  isSeed?: boolean
}

/**
 * 通用「他人主页」的账号档案（GET /users/:id）。
 *
 * 术语纪律（PRD-RESONANCE-PUBLISHING §4.1）：🔴 **「关注」= 人与人的关系，「订阅」= 付费**。
 * 本结构里的一切都属于「关注」侧，字段与埋点前缀一律 `follow*`，不得出现 `subscribe/sub_*`。
 */
export interface UserProfile {
  id: string
  nickname: string
  /** 头像占位色（CSS 渐变） */
  avatar: string
  /** 一句签名/人设 */
  persona: string
  /** 账号类型；缺省视为 'user'。'ops' 时页面加一枚克制的官方标记 */
  accountType?: AccountType
  /** true = 内部测试账号（非真实用户），见 data/testData.ts */
  isSeed?: boolean
  /**
   * 粉丝数 = 关注 ta 的人数（`PRD-RESONANCE-PUBLISHING E1` 裁定②）。
   * 🔴 三条硬约束，改动前先回去读那条裁定：
   *  ① **公开且精确**——就给真数字，不做「1k+」这类模糊化；
   *  ② 🔴 **只在个体主页展示**，绝不上信息流卡片、搜索结果行、回声行；
   *  ③ 🔴 **不做任何全站作者排行榜**（`DECISIONS D14` 未被推翻）。
   * 「个人页上有一个数字」与「把所有人拉出来排名次」是两件事，前者放开、后者仍禁止。
   */
  followerCount: number
  /** ta 关注的人数（同样公开、精确；同样不参与任何排行） */
  followingCount: number
  /** 我是否已关注 ta（单向关系，可随时取消） */
  followedByMe: boolean
  /** 是否是我自己的主页（自己的页面不出现「关注 ta」） */
  isMe?: boolean
}

/** 搜索·主题结果（题材 chip → 复用广场按 category 聚合过滤） */
export interface SearchTopic {
  term: string
  category: NonNullable<Window['category']>
}

/**
 * 搜索三分区信封（GET /search?q=）。
 * 对齐附录 A.5 铁律：三分区各自独立 `{items,nextCursor}` 信封，绝不把响应当裸数组。
 */
export interface SearchResults {
  windows: Paged<Window>
  users: Paged<SearchUser>
  topics: Paged<SearchTopic>
}

/** 亲友的一条"温柔近况"（动态圈 reel 里的一张卡） */
export interface Reel {
  id: string
  /** 场景占位图 */
  placeholder: Placeholder
  /** 一句温柔近况 */
  text: string
  /** 相对时间，如"2 小时前" */
  time: string
}

/** 「不看」时长档位；'permanent' 表示永久 */
export type MuteDuration = '7d' | '3m' | 'permanent'

// —— 我的光谱 (self-spectrum / v-α)：一面照见自己的温柔镜子 ——
//
// 职责划分（契约 §11 · QA M-4 定案：前端持布局、后端只下发语义）：
//   · 后端语义 DTO（SpectrumNode / ShadowArea）：只含 intensity/depth/whisper/label 等语义值；
//   · 前端视觉 VM（SpectrumNodeView / ShadowAreaView）：坐标/尺寸/色相/延迟，由前端从语义值映射生成。
// 映射逻辑见 api/spectrumMap.ts；后端不下发任何布局字段。

/** 暖色调枚举：光面的三种柔光色相（复用设计令牌） */
export type SpectrumTone = 'amber' | 'blossom' | 'green'

/**
 * 「光点/锚点」的**后端语义 DTO**（GET /spectrum item · POST /spectrum/anchor 出参）。
 * 只承载语义值，**不含任何布局字段**（x/y/size/tone/delay 由前端映射）。
 */
export interface SpectrumNode {
  id: string
  /** 该光点承载的一句话（自己给自己的锚点） */
  label: string
  /** 强度 0-1：越强前端渲染得越大越亮 */
  intensity: number
  /** 生成时间（毫秒时间戳） */
  createdAt: number
}

/**
 * 「内在阴影区」的**后端语义 DTO**（GET /spectrum item）。
 * 文案务必氛围化、非指控、第一人称——是"你自己的内在"，绝非他人评价。
 */
export interface ShadowArea {
  id: string
  /** 展开时那句温柔、成长向的低语 */
  whisper: string
  /** 深度 0-1：越深前端渲染的暗区越大（仍明显弱于光面） */
  depth: number
}

/**
 * 光点的**前端视觉 VM**：由 SpectrumNode 语义值映射而来，供 SpectrumScreen 直接渲染。
 * 布局字段（x/y/size/tone/delay）是前端职责，不属于后端契约。
 */
export interface SpectrumNodeView {
  id: string
  /** 该光点承载的一句话 */
  label: string
  /** 星云容器内的相对位置（百分比 0-100） */
  x: number
  y: number
  /** 光点直径(px)，越大越亮 */
  size: number
  /** 暖色色相 */
  tone: SpectrumTone
  /** 呼吸动画错相延迟(s)，让整片星云不同步闪烁 */
  delay: number
}

/**
 * 暗区的**前端视觉 VM**：由 ShadowArea 语义值映射而来。
 * 面积小、边缘柔化、明显弱于光面；可被用户"整合"回暖成光点。
 */
export interface ShadowAreaView {
  id: string
  /** 展开时那句温柔、成长向的低语 */
  whisper: string
  /** 星云容器内的相对位置（百分比 0-100） */
  x: number
  y: number
  /** 暗区直径(px) */
  size: number
  /** 呼吸动画错相延迟(s) */
  delay: number
}

/**
 * 亲友/家人关系用户。字段命名贴近后端关系链模型（GET /relations）：
 * priority / mutedUntil 挂关系链 edge，pet 复用 MindSpace/Echo 档案，
 * reel 走可见性（§2.1/§2.7）过滤。
 */
export interface RelationUser {
  id: string
  name: string
  /** 头像占位色（CSS 渐变） */
  avatar: string
  /** 当前在线 */
  online: boolean
  /** 用户自设"优先展示"（置顶） */
  priority: boolean
  /** 「不看」到期时间戳(ms)；null=未静音；Infinity=永久 */
  mutedUntil: number | null
  /** 相对活跃时间，如"3 分钟前" */
  lastActive: string
  /** 有当前用户尚未看过的新动态 */
  hasUnseenReel: boolean
  /** 对方的可见性设置允许"我"查看其动态 */
  viewableByMe: boolean
  /** 动态圈内容（1-3 条） */
  reels: Reel[]
  /** 该亲友的宠物主页（复用「我的它」布局渲染） */
  pet: MyPet
}

// —— 服务端功能开关 · C1 留一句话（DECISIONS S13）——

/**
 * 服务端下发的功能开关（GET /config/flags）。
 *
 * 🔴 **这是服务端开关，不是前端本地开关。** 前端只读、不写、不提供任何本地覆盖入口，
 * 也不把开关状态缓存到 localStorage——那等于给了一个绕过服务端的旁路。
 *
 * 🔴 **取不到时一律按「关闭」处理**（见 `hooks/useFeatureFlags.ts`）。
 * 与 AI 角标 `aiGenerated` 缺省为 `true` 的方向相反，但道理是同一条：**倒向代价更小的那一侧**。
 * 角标漏标是合规风险，所以缺省标；留言开关误开则是在治理能力就绪前敞开自由文本入口
 * （`S13 ②`：拉黑/举报/关互动/审核队列/文本安全闸五项全部就绪才允许打开），所以缺省关。
 */
export interface FeatureFlags {
  /**
   * `C1 留一句话`（`DECISIONS S13` · `PALETTE §186` P0 清单）。
   * 🔴 **P0 默认关闭**；关闭期间整个入口不呈现，🔴 **不出「功能暂未开放」之类的占位**
   * ——占位等于告诉用户这里少了点东西，而这里本来就不该有东西。
   */
  leaveMessage: boolean
}

/**
 * 作者对一条留言的处理，🔴 **三选一**（`PALETTE §56`）。
 * 用词照规格原文：第三项是「**不留**」，不是「不收」，更不是「拒绝」。
 */
export type MessageDisposition = 'publish' | 'private' | 'drop'

/** 三个处理动作面向作者的说法（🔴 唯一定义处，各组件引用它，不要另写一套） */
export const DISPOSITION_LABELS: Record<MessageDisposition, string> = {
  publish: '收下公开',
  private: '只自己看',
  drop: '不留',
}

/**
 * 一条待作者处理的留言（作者侧，🔴 仅作者本人可读）。
 *
 * 🔴 **留言者永远看不到处理结果**（`PALETTE I-05`）：没有「被拒绝」通知，
 * 也没有任何能反推出「我被拒了」的状态——所以这个结构**不下发给留言者**，
 * 前端也不提供「我留的话现在怎么样了」这类查询。
 */
export interface PendingMessage {
  id: string
  /** 留言者昵称 */
  authorName: string
  /** 留言者头像占位色（CSS 渐变） */
  authorAvatar: string
  /** 留言正文（最长 60 字，长度上限在 PALETTE §56） */
  text: string
  /** 相对时间串，如「2 小时前」 */
  time: string
}

/**
 * 可见性档位的温柔标签（§0.7 #1，档位逻辑不变，措辞出更柔候选）。
 * 合规口径：只承诺「可见范围」，不承诺「存在范围」——平台依法承担内容审核义务，
 * 后台在审批与审计下具备受控可见能力，故不写「只留给自己」这类说法。
 */
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  private: '仅自己可见',
  friends: '挚友可见',
  public: '公开',
}

// ============================================================== 作品（t_work）

/**
 * 一条作品。服务端 `WorkView.listItem` / `detail` 的下发形状。
 *
 * 🔴 **作品不是回忆卡。** 回忆卡是私域产物——AI 生成的近况、随手记、生命之书页，
 * 用户什么都不做它也会长出来；作品是公开物，每一条都对应一次明确的作者意图
 * （挑素材、写字、按发布）。两者由 `fromCard` 连接：作者把一张回忆卡发出去就长出一个作品。
 *
 * ⚠️ **这套字段是照着服务端 `WorkView` 逐个抄下来的，不是照着渲染需要设计的。**
 * 广场页（`Window`）就是反过来做的，结果两边只有四个字段对得上，
 * 而因为前端默认跑 mock，这个不一致至今没暴露——见 `PRODUCT-IMPLEMENTATION-AUDIT §0b`。
 * 🔴 改这里的任何字段，先去改 `WorkView.java`。
 */
export interface Work {
  id: string
  authorId: string
  mediaType: WorkMediaType
  /** 素材直链。服务端由 resourceId 换算，前端不拼路径 */
  mediaUrl: string
  /** 视频首帧。🔴 图片作品是空串，不要回退成 mediaUrl——那会让列表页直接加载视频流 */
  posterUrl: string
  durationMs: number
  /**
   * 原始宽高。瀑布流的高低错落由前端按它算，
   * 服务端刻意不给 'tall'/'short' 档位（档位会把布局焊进数据）。
   */
  width: number
  height: number
  title: string
  /** 正文摘要（40 字）。全文只在详情里给 */
  excerpt: string
  topicIds: string[]
  publishedAt: number | null
  /** 🔴 AI 生成标识（S-8 显式标识）。列表每一条上都要渲染，不是只在详情页 */
  aiGenerated: boolean
  /** 是否由回忆卡发布而来 */
  fromCard: boolean
  /** 以下三项只在作者本人视角下发 */
  status?: WorkStatus
  visibility?: Visibility
  sourceCardId?: string | null
  /** 仅详情 */
  body?: string
  createdAt?: number
}

export type WorkMediaType = 'image' | 'video'

/**
 * 作品状态。
 *
 * 🔴 `pending` 是发布后的**正常**状态，不是异常。`OM3` 定死了生成/发布/过审是三个时刻，
 * 所以按下发布之后它先进审核，广场上还看不到——文案要写「已提交」不能写「已发布」。
 */
export type WorkStatus =
  | 'draft'
  | 'pending'
  | 'public'
  | 'rejected'
  | 'takendown'
  | 'appealing'
  | 'deleted'

/** 发布作品的入参。字段名与服务端 `WorksApi.publish` 逐个对应。 */
export interface PublishWorkInput {
  mediaType: WorkMediaType
  /** POST /upload 返回的 resourceId */
  mediaKey: string
  /** 视频必填 */
  posterKey?: string
  durationMs?: number
  width?: number
  height?: number
  title?: string
  body?: string
  visibility?: Visibility
  /** 从回忆卡发布时带上 */
  sourceCardId?: string
  aiGenerated?: boolean
}

export const WORK_STATUS_LABELS: Record<WorkStatus, string> = {
  draft: '草稿',
  pending: '审核中',
  public: '已公开',
  rejected: '未通过',
  takendown: '已下架',
  appealing: '申诉中',
  deleted: '已删除',
}
