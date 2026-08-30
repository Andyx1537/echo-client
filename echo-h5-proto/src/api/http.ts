// 真实 HTTP/JSON 后端（契约 §0）。当 VITE_API_BASE 非空时启用。
// Base URL：`${VITE_API_BASE}/api/v1`；鉴权 Authorization: Bearer <token>。
// 成功 { code:0, data }，错误 { code!=0, msg, detail }。

import type {
  Echo,
  FeatureFlags,
  FlowerQuota,
  Insights,
  Me,
  Message,
  MyPet,
  OnboardingCandidate,
  Paged,
  PendingMessage,
  Postcard,
  PostcardSkin,
  PurchaseResult,
  ReactionArrival,
  RecordItem,
  RememberWall,
  SearchResults,
  Session,
  UserProfile,
  ShadowArea,
  SpectrumNode,
  Visibility,
  Window,
  Work,
  MuteDuration,
} from '../types'
import {
  ApiError,
  type DetectResult,
  type EchoBackend,
  type FlowerPayload,
  type FlowerResult,
  type FollowResult,
  type OnboardingConfirmPayload,
  type OnboardingStartPayload,
  type WindowDetail,
} from './backend'
import { getToken } from './session'
import { mapRelations, type RawRelationUser } from './relationsMap'
import { mapSpectrum, toSpectrumNodeView } from './spectrumMap'

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const ROOT = `${API_BASE.replace(/\/$/, '')}/api/v1`

interface Ok<T> {
  code: 0
  data: T
}
interface Err {
  code: number
  msg: string
  detail?: string
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json; charset=utf-8',
    ...(init.headers as Record<string, string> | undefined),
  }
  if (token) headers.Authorization = `Bearer ${token}`

  let resp: Response
  try {
    resp = await fetch(`${ROOT}${path}`, { ...init, headers })
  } catch (e) {
    throw new ApiError(5000, '网络好像开了点小差，待会儿再来看看它', String(e))
  }

  let json: Ok<T> | Err
  try {
    json = (await resp.json()) as Ok<T> | Err
  } catch {
    throw new ApiError(5000, '这边一时没能读懂，稍后再试试', `bad json @ ${path}`)
  }

  if (json.code === 0) return (json as Ok<T>).data
  const err = json as Err
  throw new ApiError(err.code, err.msg || '出了点小状况，待会儿再来', err.detail)
}

function post<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
function patch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}
function get<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'GET' })
}
function del<T>(path: string): Promise<T> {
  return request<T>(path, { method: 'DELETE' })
}

function pageQuery(cursor?: string): string {
  return cursor ? `?cursor=${encodeURIComponent(cursor)}` : ''
}

export const httpBackend: EchoBackend = {
  // TODO(真后端·DECISIONS S13)：GET /config/flags 尚未上线。
  // 🔴 这里**刻意不加 catch 兜底**——兜底逻辑统一在 hooks/useFeatureFlags.ts，
  // 端点 404 时那边会按「全部关闭」处理。在这一层 catch 成 {leaveMessage:true} 之类，
  // 等于在客户端把服务端开关打开了，那正是 S13 ② 要防的事。
  featureFlags: () => get<FeatureFlags>('/config/flags'),

  authGuest: (deviceId) => post<Session>('/auth/guest', { deviceId }),
  bind: (type, credential) =>
    post<{ isGuest: boolean }>('/auth/bind', { type, credential }),
  me: () => get<Me>('/me'),

  onboardingStart: (payload: OnboardingStartPayload) =>
    post<{ onboardingId: string; candidates: OnboardingCandidate[] }>(
      '/pet/onboarding/start',
      payload,
    ),
  onboardingRefine: (onboardingId, chosenCandidateId, adjust) =>
    post<{ candidates: OnboardingCandidate[] }>('/pet/onboarding/refine', {
      onboardingId,
      chosenCandidateId,
      adjust,
    }),
  onboardingConfirm: (payload: OnboardingConfirmPayload) =>
    post<{ petId: string }>('/pet/onboarding/confirm', payload),
  detectSubject: (resourceId) => post<DetectResult>('/pet/onboarding/detect', { resourceId }),
  upload: async (file: File) => {
    const token = getToken()
    const form = new FormData()
    form.append('file', file)
    const resp = await fetch(`${ROOT}/upload`, {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: form,
    })
    const json = (await resp.json()) as {
      code: number
      data?: { resourceId: string; url: string }
      msg?: string
    }
    if (json.code === 0 && json.data) return json.data
    throw new ApiError(json.code, json.msg ?? '这份素材没能存下来，待会儿再试试')
  },

  petMe: () => get<MyPet>('/pet/me'),
  petPatch: (p: { signature?: string; visibility?: Visibility }) =>
    patch<MyPet>('/pet/me', p),
  petVisit: () => post<{ temperature: number; newEchoes: Echo[] }>('/pet/me/visit'),
  resetPet: () => del<{ ok: boolean }>('/pet/me'),

  echoes: (cursor) => get<Paged<Echo>>(`/pet/me/echoes${pageQuery(cursor)}`),
  // 「换一批」（B7/TC-23）：换表达口吻，不动已有回忆。
  // TODO(真后端·§4)：POST /pet/me/echoes/reroll 尚未上线；端点缺失或生成失败时按既有 AI 降级
  // 回落为重取近况流 —— 不阻断、不把技术错误抛给用户（温柔兜底文案由调用方给）。
  echoReroll: () =>
    post<Paged<Echo>>('/pet/me/echoes/reroll').catch(() =>
      get<Paged<Echo>>('/pet/me/echoes'),
    ),
  replyEcho: (echoId, text) =>
    post<{ echoId: string; reply?: Echo }>(
      `/pet/me/echoes/${encodeURIComponent(echoId)}/reply`,
      { text },
    ),

  flowerQuota: () => get<FlowerQuota>('/flowers/quota'),
  flower: (windowId, payload: FlowerPayload) =>
    post<FlowerResult>(
      `/windows/${encodeURIComponent(windowId)}/flower`,
      payload,
    ),
  setRemember: (windowId, remembered) =>
    post<{ remembered: boolean }>(
      `/windows/${encodeURIComponent(windowId)}/remember`,
      { remembered },
    ),
  rememberWall: (windowId) =>
    get<RememberWall>(`/windows/${encodeURIComponent(windowId)}/remember`),

  plaza: (cursor) => get<Paged<Window>>(`/plaza${pageQuery(cursor)}`),
  windowDetail: (windowId) =>
    get<WindowDetail>(`/windows/${encodeURIComponent(windowId)}`),
  windowSeen: (windowId) =>
    post<{ ok: boolean }>(`/windows/${encodeURIComponent(windowId)}/seen`),
  insights: () => get<Insights>('/pet/me/insights'),

  // TODO(真后端·附录 A.5)：GET /search?q= 尚未上线；此处预留按三分区各自 {items,nextCursor}
  // 信封解析（windows/users/topics）。本轮只做 mock，真接口就绪后直接切换（IS_MOCK 决定实现）。
  search: (q) => get<SearchResults>(`/search?q=${encodeURIComponent(q)}`),

  // TODO(真后端·SPEC-feature-pages §2.4 / PRD-RESONANCE-PUBLISHING E1)：
  // 他人主页与关注这三个端点在 API-CONTRACT v1 里尚无定义，路径按下方形状预留，
  // 后端确认契约后如有出入，改这三行即可（IS_MOCK 决定走哪套实现）。
  // 🔴 路径与埋点一律用 follow：这是「关注」（人与人的关系），不是付费的「订阅」。
  userProfile: (userId) => get<UserProfile>(`/users/${encodeURIComponent(userId)}`),
  userWindows: (userId, cursor) =>
    get<Paged<Window>>(`/users/${encodeURIComponent(userId)}/windows${pageQuery(cursor)}`),
  setFollow: (userId, follow) => {
    const path = `/users/${encodeURIComponent(userId)}/follow`
    return follow ? post<FollowResult>(path) : del<FollowResult>(path)
  },

  // 留一句话（DECISIONS S13 / PALETTE §56）。
  // 🔴 **挂在 `/cards/` 下，收的是 cardId**（后端 `LeaveWordsApi.register`：
  //    `POST /cards/:cardId/messages`、`GET /cards/:cardId/messages/pending`）。
  //    ⚠️ 前端此前写的是 `/windows/:id/messages` —— 后端**从来没有**这个路由，
  //    那两个调用一直是 404，只是 `leaveMessage` 开关默认关着所以没人碰到。
  // 🔴 服务端**自己又判了一次开关**：前端隐藏入口只是不呈现，客户端从来不是权限边界。
  // 🔴 处理结果对留言者一律静默——resolveMessage 不派生任何发往留言者的通知。
  // ⚠️ 后端另有「一人一卡只留一句」的限制，且重复提交同样回 ok（告诉对方「你已经留过了」
  //    本身就是可被探测的信号）。🔴 前端因此**不该知道**这条限制，也不要据此隐藏输入框——
  //    那等于把后端刻意不泄露的信号从界面上泄露出去。
  leaveMessage: (cardId, text) =>
    post<{ ok: boolean }>(`/cards/${encodeURIComponent(cardId)}/messages`, { text }),
  pendingMessages: (cardId) =>
    get<Paged<PendingMessage>>(`/cards/${encodeURIComponent(cardId)}/messages/pending`),
  resolveMessage: (messageId, disposition) =>
    post<{ ok: boolean }>(`/messages/${encodeURIComponent(messageId)}/disposition`, {
      disposition,
    }),

  // 明信片墙统一分页信封 {items,nextCursor}（QA M-8），与 records/messages 对齐。
  postcards: () => get<Paged<Postcard>>('/pet/me/postcards'),
  unlockPostcard: (id) =>
    post<{ unlocked: boolean }>(
      `/pet/me/postcards/${encodeURIComponent(id)}/unlock`,
    ),
  // 款式商店：后端返 {items} 信封，取 .items（§14.1）；只款式、不锁内容。
  postcardSkins: () =>
    get<{ items: PostcardSkin[] }>('/shop/postcard-skins').then((r) => r.items),
  purchase: (skinId) => post<PurchaseResult>('/shop/purchase', { skinId }),

  // 亲友列表走统一分页信封 {items,nextCursor}（契约 §8）；取 .items 后做时间映射（QA M-7）：
  // 后端 lastActive、reels[].createdAt 皆为毫秒，此处映射为前端约定的相对时间串，再交给 useRelations。
  relations: () =>
    get<Paged<RawRelationUser>>('/relations').then((p) => mapRelations(p.items)),
  patchRelation: (id, p: { priority?: boolean; mute?: MuteDuration | 'clear' }) =>
    patch<{ ok: boolean }>(`/relations/${encodeURIComponent(id)}`, p),
  relationReelSeen: (id) =>
    post<{ ok: boolean }>(`/relations/${encodeURIComponent(id)}/reel-seen`),

  // 记录：统一分页信封（QA M-2），返回 Paged 让前端取 .items，勿把响应当数组。
  records: (scope, cursor) =>
    get<Paged<RecordItem>>(
      `/records?scope=${scope}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
    ),
  createRecord: (p: { scope: 'pet' | 'self'; text: string; photoRefs?: string[] }) =>
    post<RecordItem>('/records', p),

  // 消息：统一分页信封（QA M-1），返回 Paged<Message>。
  messages: (cursor) => get<Paged<Message>>(`/messages${pageQuery(cursor)}`),
  // ⚠️ ids 里可能是合并后的到达 id（`arrival:<cardId>`）；服务端要据此把该卡下
  // 全部回应一起标已读，否则暖点散不掉。契约见回执。
  readMessages: (ids) => post<{ ok: boolean }>('/messages/read', { ids }),

  // 「被接住」的到达（PRODUCT-MINDMAP §6.2 B20）：后端已按此形状落地。
  // 🔴 下发**未合并**的行，且🔴 **不带人数字段**（理由见 backend.ts 的方法注释）。
  //
  // 🔴 **游标的单位是「卡」不是「回应行」**——这是「分页会把一张卡切成两条通知」那个
  // 冲突的解法：一张卡的回应整块落在同一页，翻页切不开它。改这一行前先想清楚这件事。
  // 服务端另做了「每卡每类只留最新一行」的折叠，等价性由 arrivals.test.ts 独立验过。
  reactionArrivals: (cursor) =>
    get<Paged<ReactionArrival>>(`/messages/arrivals${pageQuery(cursor)}`),

  // 光谱：后端只下发语义 DTO（intensity/depth/whisper/label），此处映射为视觉 VM（QA M-4）。
  spectrum: () =>
    get<{ nodes: SpectrumNode[]; shadows: ShadowArea[] }>('/spectrum').then(mapSpectrum),
  spectrumAnchor: (label) =>
    post<SpectrumNode>('/spectrum/anchor', { label }).then(toSpectrumNodeView),
  spectrumIntegrate: (id) =>
    post<{ node: SpectrumNode }>(
      `/spectrum/shadows/${encodeURIComponent(id)}/integrate`,
    ).then((r) => ({ node: toSpectrumNodeView(r.node) })),

  // 作品（WorksApi）。🔴 这几个方法的字段是照着服务端 WorkView 抄的，
  // 不是照着渲染需要设计的——广场页反着做的后果见 PRODUCT-IMPLEMENTATION-AUDIT §0b。
  publishWork: (input) => post<{ work: Work; message: string }>('/works', input),
  works: (cursor) => get<Paged<Work>>(`/works${pageQuery(cursor)}`),
  userWorks: (userId, cursor) =>
    get<Paged<Work>>(`/users/${encodeURIComponent(userId)}/works${pageQuery(cursor)}`),
  workDetail: (workId) => get<{ work: Work }>(`/works/${encodeURIComponent(workId)}`),
  deleteWork: (workId) => del<{ ok: boolean }>(`/works/${encodeURIComponent(workId)}`),
}
