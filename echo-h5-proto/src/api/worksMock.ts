// 作品域的 mock 数据与实现（VITE_API_BASE 为空时启用）。
//
// 🔴 种子用**真实封面**（echo-doc/Echo-assets/static/seed-covers/，48 张），
//    不用灰块也不用 Lorem：两案都很空的对比等于没对比，据此做的版面决定是错的。
//
// 🔴 宽高**刻意造得散**（2:3 到 4:5 之间浮动，另有两条横构图）：
//    瀑布流要判的就是高低错落，样本全挤在同一个比例里，
//    有没有按真实宽高排版会长得一模一样。

import type { AppealWorkResult, DraftWorkInput, PublishWorkInput, PublishWorkResult, ResubmitWorkResult, ReviewMode, SubmissionCapability, SubmissionNextAction, Work, WorkModeration } from '../types'
import { assetUrl } from '../lib/assetUrl'

const OCCUPYING = new Set(['pending', 'uploading', 'submitting'])

/** 种子作品。覆盖：图片/视频、AI 生成/用户自制、来自回忆卡/自制上传、竖构图/横构图。 */
const SEED: Array<
  Pick<Work, 'title' | 'excerpt' | 'width' | 'height' | 'aiGenerated' | 'fromCard' | 'mediaType'> & {
    cover: string
    authorId: string
    durationMs?: number
    minutesAgo: number
  }
> = [
  {
    cover: 'seed-covers/cover-pet-nap.jpg',
    title: '它最后一个下午',
    excerpt: '阳光从阳台斜进来，它就趴在那块地板上，谁叫都不动。',
    width: 900, height: 1350, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_lin', minutesAgo: 12,
  },
  {
    cover: 'seed-covers/cover-daily-mug.jpg',
    title: '',
    excerpt: '这只杯子还在，缺了个口，我一直没舍得扔。',
    width: 1000, height: 1250, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_zhou', minutesAgo: 40,
  },
  {
    cover: 'seed-covers/cover-pet-collar.jpg',
    title: '今天它好像又在门口等我',
    excerpt: '回声替我把那天写下来了——推门那一下，它总是先到。',
    width: 900, height: 1200, mediaType: 'video', durationMs: 18_000,
    aiGenerated: true, fromCard: true, authorId: 'acc_mu', minutesAgo: 55,
  },
  {
    cover: 'seed-covers/cover-family-heightmarks.jpg',
    title: '门框上的那些线',
    excerpt: '搬家那天量了最后一道，就没再往上画过。',
    width: 1200, height: 900, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_he', minutesAgo: 96,
  },
  {
    cover: 'seed-covers/cover-pet-ball.jpg',
    title: '球还在沙发底下',
    excerpt: '扫地的时候滚出来，愣了一会儿又塞回去了。',
    width: 900, height: 1400, mediaType: 'image',
    aiGenerated: false, fromCard: true, authorId: 'acc_lin', minutesAgo: 140,
  },
  {
    cover: 'seed-covers/cover-bond-letter.jpg',
    title: '',
    excerpt: '整理抽屉翻出来的，字迹已经淡了，但还认得出是谁写的。',
    width: 1000, height: 1300, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_zhou', minutesAgo: 200,
  },
  {
    cover: 'seed-covers/cover-pet-blanket.jpg',
    title: '洗过之后就没有味道了',
    excerpt: '这条毯子我洗了三次才想明白，我其实不想让它变干净。',
    width: 900, height: 1125, mediaType: 'video', durationMs: 26_000,
    aiGenerated: true, fromCard: true, authorId: 'acc_mu', minutesAgo: 260,
  },
  {
    cover: 'seed-covers/cover-daily-camera.jpg',
    title: '相机里还剩十七张',
    excerpt: '一直没洗，怕洗出来之后就真的只有这十七张了。',
    width: 1350, height: 900, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_he', minutesAgo: 330,
  },
  {
    cover: 'seed-covers/cover-pet-bowl.jpg',
    title: '',
    excerpt: '碗还摆在老地方，我每天路过都要绕一下。',
    width: 900, height: 1300, mediaType: 'image',
    aiGenerated: false, fromCard: true, authorId: 'acc_lin', minutesAgo: 420,
  },
  {
    cover: 'seed-covers/cover-family-wok.jpg',
    title: '这口锅比我年纪还大',
    excerpt: '她走以后我才学会用它，火候到现在也不太对。',
    width: 1000, height: 1200, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_zhou', minutesAgo: 540,
  },
  {
    cover: 'seed-covers/cover-pet-butterfly.jpg',
    title: '那天它追过一只蝴蝶',
    excerpt: '草地还是湿的，它跑出去的时候我没来得及喊住。',
    width: 900, height: 1200, mediaType: 'image',
    aiGenerated: true, fromCard: true, authorId: 'acc_mu', minutesAgo: 620,
  },
  {
    cover: 'seed-covers/cover-pet-snowday.jpg',
    title: '第一场雪它站了很久',
    excerpt: '我以为它冷，后来才知道它是在看。',
    width: 900, height: 1280, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_lin', minutesAgo: 700,
  },
  {
    cover: 'seed-covers/cover-pet-sunset.jpg',
    title: '',
    excerpt: '天快黑的时候它总要再看一眼窗外。',
    width: 1000, height: 1250, mediaType: 'image',
    aiGenerated: false, fromCard: true, authorId: 'acc_he', minutesAgo: 780,
  },
  {
    cover: 'seed-covers/cover-pet-seaside.jpg',
    title: '海水碰到爪子它愣住了',
    excerpt: '那是它第一次看见这么大的水。',
    width: 1200, height: 900, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_zhou', minutesAgo: 860,
  },
  {
    cover: 'seed-covers/red-suitcase-v1.jpg',
    title: '红皮箱还在储物间',
    excerpt: '拉链坏了以后就再也没出过门。',
    width: 900, height: 1350, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_he', minutesAgo: 940,
  },
  {
    cover: 'seed-covers/cassette-v1.jpg',
    title: '磁带转不动了',
    excerpt: '里面是谁的声音，我现在也不敢倒回去听。',
    width: 1000, height: 1300, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_zhou', minutesAgo: 1020,
  },
  {
    cover: 'seed-covers/user-classroom-v3.jpg',
    title: '最后一排靠窗',
    excerpt: '放学铃响的时候，桌上还摊着没写完的那页。',
    width: 900, height: 1180, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_mu', minutesAgo: 1100,
  },
  {
    cover: 'seed-covers/user-last-bus-v3.jpg',
    title: '末班车总是差一点',
    excerpt: '站台上那个人回头的样子，后来再也没遇上。',
    width: 1350, height: 900, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_lin', minutesAgo: 1180,
  },
  {
    cover: 'seed-covers/user-noodle-shop-v3.jpg',
    title: '那碗面现在换人煮了',
    excerpt: '汤还是旧味道，位子换成了别人的。',
    width: 900, height: 1220, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_he', minutesAgo: 1260,
  },
  {
    cover: 'seed-covers/user-basketball-v3.jpg',
    title: '',
    excerpt: '球框还在，人散了以后场地特别空。',
    width: 1000, height: 1250, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_zhou', minutesAgo: 1340,
  },
  {
    cover: 'seed-covers/cover-daily-mug.jpg',
    title: '杯沿缺的那一小块',
    excerpt: '每次喝水嘴唇都会碰到，也不想换新的。',
    width: 900, height: 1125, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_lin', minutesAgo: 1420,
  },
  {
    cover: 'seed-covers/cover-family-heightmarks.jpg',
    title: '再往上就没有了',
    excerpt: '最高的那道线是它离开前一年画的。',
    width: 1100, height: 900, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_he', minutesAgo: 1500,
  },
  {
    cover: 'seed-covers/cover-bond-letter.jpg',
    title: '信封没封口',
    excerpt: '写到一半就不写了，纸还夹在书里。',
    width: 900, height: 1320, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_zhou', minutesAgo: 1580,
  },
  {
    cover: 'seed-covers/cover-daily-camera.jpg',
    title: '胶卷还在机身里',
    excerpt: '我怕洗出来的那天，就真的只剩下这些。',
    width: 1200, height: 900, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_mu', minutesAgo: 1660,
  },
  {
    cover: 'seed-covers/cover-pet-bowl.jpg',
    title: '碗沿还是湿的',
    excerpt: '其实没有，是我自己倒的。',
    width: 900, height: 1280, mediaType: 'image',
    aiGenerated: false, fromCard: true, authorId: 'acc_lin', minutesAgo: 1740,
  },
  {
    cover: 'seed-covers/cover-pet-blanket.jpg',
    title: '毯子叠起来就小了一圈',
    excerpt: '以前它躺在上面的时候，毯子是圆的。',
    width: 900, height: 1200, mediaType: 'video', durationMs: 16_000,
    aiGenerated: true, fromCard: true, authorId: 'acc_mu', minutesAgo: 1820,
  },
  {
    cover: 'seed-covers/cover-pet-collar.jpg',
    title: '铃铛不响了',
    excerpt: '我把它放到抽屉最里面，出门前还是会看一眼。',
    width: 1000, height: 1300, mediaType: 'image',
    aiGenerated: false, fromCard: true, authorId: 'acc_he', minutesAgo: 1900,
  },
  {
    cover: 'seed-covers/cover-pet-ball.jpg',
    title: '球上的牙印还在',
    excerpt: '橡胶已经裂了，我还是没扔掉。',
    width: 900, height: 1400, mediaType: 'image',
    aiGenerated: false, fromCard: true, authorId: 'acc_zhou', minutesAgo: 1980,
  },
  {
    cover: 'seed-covers/cover-family-wok.jpg',
    title: '',
    excerpt: '锅沿那圈黑，是很多次晚饭留下的。',
    width: 1000, height: 1180, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_lin', minutesAgo: 2060,
  },
  {
    cover: 'seed-covers/cover-pet-nap.jpg',
    title: '光斑刚好够它躺下',
    excerpt: '下午三点，地板会暖一小块。',
    width: 900, height: 1350, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_he', minutesAgo: 2140,
  },
  {
    cover: 'seed-covers/user-classroom-v3.jpg',
    title: '黑板没擦干净',
    excerpt: '最边上还能认出半个名字。',
    width: 900, height: 1240, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_mu', minutesAgo: 2220,
  },
  {
    cover: 'seed-covers/red-suitcase-v1.jpg',
    title: '轮子卡住的那天',
    excerpt: '以后出门就改用袋子了。',
    width: 900, height: 1280, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_zhou', minutesAgo: 2300,
  },
  {
    cover: 'seed-covers/cassette-v1.jpg',
    title: 'A面听完了',
    excerpt: 'B面是空白，像故意留给谁的。',
    width: 1000, height: 1260, mediaType: 'image',
    aiGenerated: false, fromCard: false, authorId: 'acc_lin', minutesAgo: 2380,
  },
]

function buildSeed(): Work[] {
  const now = Date.now()
  return SEED.map((s, i) => ({
    id: `wk_seed_${i + 1}`,
    authorId: s.authorId,
    mediaType: s.mediaType,
    mediaUrl: assetUrl(s.cover),
    // 视频的首帧在 mock 里就用同一张图。🔴 这是 mock 的偷懒，不是契约允许——
    // 服务端 t_work_ck_video_poster 强制视频必须另有首帧
    posterUrl: s.mediaType === 'video' ? assetUrl(s.cover) : '',
    durationMs: s.durationMs ?? 0,
    width: s.width,
    height: s.height,
    title: s.title,
    excerpt: s.excerpt,
    topicIds: [],
    publishedAt: now - s.minutesAgo * 60_000,
    aiGenerated: s.aiGenerated,
    fromCard: s.fromCard,
    sourceType: s.fromCard ? 'memory_card' : 'user_upload',
    body: s.excerpt,
  }))
}

type MockWork = Work & {
  submittedContentVersion?: number
  contentHash?: string
  resubmitKey?: string
  moderationId?: string
  appealAt?: number
  appealText?: string
  appealResult?: string
  appealHandledAt?: number
  reviewedAt?: number
  handledAt?: number
}

export interface MockReviewEvidence {
  id: string
  sourceCardId: string
  contentHash: string
  result: 'passed' | 'restricted' | 'failed'
  expiresAt: number
  policyEpoch: number
  aigcLabelReady: boolean
  consentRevoked?: boolean
  consumedByWorkId?: string
}

export interface WorksMockState {
  works: Work[]
  evidences: MockReviewEvidence[]
}

/** 浏览器对照「原样复用」用。撤：去掉 App 的 fromCard 查询和这里的常量。 */
export const REUSE_DEMO_CARD = 'card_reuse_ok'
export const REUSE_DEMO_EVIDENCE = 'ev_card_ok'
export const REUSE_DEMO_TITLE = '它最后一个下午'
export const REUSE_DEMO_BODY = '阳光从阳台斜进来，它就趴在那块地板上。'
export const REUSE_DEMO_MEDIA = assetUrl('seed-covers/cover-pet-nap.jpg')

export function freshWorks(myAccountId: string): WorksMockState {
  const works = buildSeed()
  // 🔴 分两条挂到当前用户名下：一条已公开、一条未通过。
  //    未通过不占投稿名额，才能同时验「还能发新的」和「同一条改完再提」。
  works[1] = { ...works[1], authorId: myAccountId, status: 'public', visibility: 'public' }
  works[4] = {
    ...works[4],
    authorId: myAccountId,
    status: 'rejected',
    visibility: 'public',
    contentVersion: 1,
    nextAction: 'edit',
    submittedContentVersion: 1,
  } as MockWork
  const reuseHash = mockReviewHash({
    mediaType: 'image',
    mediaKey: REUSE_DEMO_MEDIA,
    title: REUSE_DEMO_TITLE,
    body: REUSE_DEMO_BODY,
    aiGenerated: false,
  }, REUSE_DEMO_MEDIA, '')
  return {
    works,
    evidences: [{
      id: REUSE_DEMO_EVIDENCE,
      sourceCardId: REUSE_DEMO_CARD,
      contentHash: reuseHash,
      result: 'passed',
      expiresAt: Date.now() + 90 * 24 * 60 * 60 * 1000,
      policyEpoch: 1,
      aigcLabelReady: true,
    }],
  }
}

/** 发布。自制上传或凭证不可复用 → pending；原样且凭证有效 → public。 */
export function mockPublish(
  state: WorksMockState,
  input: PublishWorkInput,
  authorId: string,
  mediaUrl: string,
  posterUrl: string,
): PublishWorkResult {
  const decision = mockReviewDecision(state, input, authorId, mediaUrl, posterUrl)
  if (decision.hard) {
    throw Object.assign(new Error(decision.message), {
      code: 3002,
      detail: decision.reasonCode,
      data: { reviewMode: 'none', workCreated: false, retryable: false },
    })
  }
  const reused = decision.reviewMode === 'reused'
  const work: Work = {
    id: `wk_${Date.now()}`,
    authorId,
    mediaType: input.mediaType,
    mediaUrl,
    posterUrl: input.mediaType === 'video' ? posterUrl || mediaUrl : '',
    durationMs: input.durationMs ?? 0,
    width: input.width ?? 0,
    height: input.height ?? 0,
    title: input.title ?? '',
    excerpt: (input.body ?? '').slice(0, 40),
    topicIds: [],
    publishedAt: Date.now(),
    aiGenerated: input.aiGenerated ?? false,
    fromCard: Boolean(input.sourceCardId),
    status: reused ? 'public' : 'pending',
    visibility: input.visibility ?? 'public',
    sourceCardId: input.sourceCardId ?? null,
    body: input.body ?? '',
    createdAt: Date.now(),
    contentVersion: 1,
    nextAction: reused ? 'none' : 'wait',
    submittedContentVersion: 1,
    reviewMode: decision.reviewMode,
  } as MockWork
  if (reused && decision.evidence) {
    decision.evidence.consumedByWorkId = work.id
    work.reviewMode = 'reused'
  }
  state.works = [work, ...state.works]
  return {
    work,
    workId: work.id,
    status: work.status,
    reviewMode: decision.reviewMode,
    reasonCode: decision.reasonCode,
    contentVersion: 1,
    nextAction: work.nextAction,
    message: reused ? '已经在广场上了。' : '已提交，过一会儿就能在广场看到它了。',
  }
}

export function mockAuthorView(work: Work, self: boolean): Work {
  if (!self) return mockPublicView(work)
  return { ...work, nextAction: mockNextAction(work), contentVersion: work.contentVersion ?? 1 }
}

export function mockSaveDraft(state: WorksMockState, workId: string, authorId: string, input: DraftWorkInput): Work {
  const index = state.works.findIndex((work) => work.id === workId)
  const current = index >= 0 ? (state.works[index] as MockWork) : undefined
  if (!current || current.authorId !== authorId) {
    throw Object.assign(new Error('这个作品找不到了。'), { code: 2004 })
  }
  if (current.status === 'takendown') {
    throw Object.assign(new Error('这条已经不在了，不能从这里改完再发。'), { code: 3002, detail: 'work_takendown' })
  }
  if (current.status !== 'rejected') {
    throw Object.assign(new Error('现在还不能改这一条。'), { code: 2001, detail: 'work_not_rejected' })
  }
  const next: MockWork = {
    ...current,
    title: input.title ?? current.title,
    body: input.body ?? current.body ?? '',
    excerpt: (input.body ?? current.body ?? current.excerpt).slice(0, 40),
    visibility: input.visibility ?? current.visibility,
    mediaType: input.mediaType ?? current.mediaType,
    mediaUrl: input.mediaKey ?? current.mediaUrl,
    posterUrl: input.mediaType === 'video' || current.mediaType === 'video'
      ? (input.posterKey ?? current.posterUrl)
      : '',
    durationMs: input.durationMs ?? current.durationMs,
    width: input.width ?? current.width,
    height: input.height ?? current.height,
    aiGenerated: input.aiGenerated ?? current.aiGenerated,
  }
  const submitted = current.submittedContentVersion ?? 1
  const changed = mockContentKey(next) !== mockContentKey(current)
  next.contentVersion = changed ? submitted + 1 : submitted
  next.submittedContentVersion = submitted
  next.status = 'rejected'
  next.nextAction = next.contentVersion > submitted ? 'resubmit' : 'edit'
  state.works[index] = next
  return mockAuthorView(next, true)
}

export function mockResubmit(
  state: WorksMockState,
  workId: string,
  authorId: string,
  contentVersion: number,
  idempotencyKey: string,
): ResubmitWorkResult {
  const occupying = mockSubmissionCapability(state, authorId)
  const current = state.works.find((work) => work.id === workId) as MockWork | undefined
  if (!current || current.authorId !== authorId) {
    throw Object.assign(new Error('这个作品找不到了。'), { code: 2004 })
  }
  if (current.status === 'pending' && current.resubmitKey === idempotencyKey && current.moderationId) {
    return {
      workId: current.id,
      contentVersion: current.contentVersion ?? 1,
      contentHash: current.contentHash ?? mockContentKey(current),
      status: 'pending',
      moderationId: current.moderationId,
    }
  }
  if (!occupying.canSubmitWork && occupying.blockingWorkId !== workId) {
    throw Object.assign(new Error('还有一条作品正在处理，先等它走完再发新的。'), {
      code: 3002,
      detail: 'submission_slot_occupied',
    })
  }
  if (current.status === 'takendown') {
    throw Object.assign(new Error('这条已经不在了，不能从这里再发。'), { code: 3002, detail: 'work_takendown' })
  }
  if (current.status !== 'rejected') {
    throw Object.assign(new Error('现在还不能再提这一条。'), { code: 2001, detail: 'work_not_rejected' })
  }
  if (contentVersion !== (current.contentVersion ?? 1)) {
    throw Object.assign(new Error('先刷新一下再提。'), { code: 2001, detail: 'work_version_conflict' })
  }
  const submitted = current.submittedContentVersion ?? 1
  const nextVersion = (current.contentVersion ?? 1) <= submitted ? submitted + 1 : (current.contentVersion ?? 1)
  const hash = mockContentKey(current)
  const moderationId = `mod_${Date.now()}`
  const next: MockWork = {
    ...current,
    status: 'pending',
    contentVersion: nextVersion,
    submittedContentVersion: nextVersion,
    contentHash: hash,
    nextAction: 'wait',
    publishedAt: Date.now(),
    resubmitKey: idempotencyKey,
    moderationId,
  }
  state.works = state.works.map((work) => (work.id === workId ? next : work))
  return {
    workId,
    contentVersion: nextVersion,
    contentHash: hash,
    status: 'pending',
    moderationId,
  }
}

const REJECT_REASON = '这一条我们看过了，暂时还不能公开。你可以改一改再试试。'

export function mockWorkModeration(state: WorksMockState, workId: string, authorId: string): WorkModeration {
  const current = state.works.find((work) => work.id === workId) as MockWork | undefined
  if (!current || current.authorId !== authorId) {
    throw Object.assign(new Error('这个作品找不到了。'), { code: 2004 })
  }
  const used = current.appealAt != null
  const appealable = (current.status === 'rejected' || current.status === 'takendown') && !used
  const showReason = current.status === 'rejected' || current.status === 'takendown' || current.status === 'appealing'
  return {
    workId: current.id,
    status: current.status ?? 'pending',
    reasonCode: showReason ? 'policy' : null,
    reasonText: showReason ? REJECT_REASON : null,
    appealable,
    appealUsed: used,
    appeal: current.appealAt != null
      ? {
          appealId: current.moderationId ?? current.id,
          text: current.appealText,
          appealAt: current.appealAt,
          result: current.appealResult ?? null,
          handledAt: current.appealHandledAt ?? null,
        }
      : used
        ? { used: true }
        : null,
    reviewedAt: current.reviewedAt ?? null,
    handledAt: current.handledAt ?? null,
  }
}

export function mockAppealWork(
  state: WorksMockState,
  workId: string,
  authorId: string,
  text: string,
): AppealWorkResult {
  const current = state.works.find((work) => work.id === workId) as MockWork | undefined
  if (!current || current.authorId !== authorId) {
    throw Object.assign(new Error('这个作品找不到了。'), { code: 2004 })
  }
  const trimmed = text.trim()
  if (!trimmed) {
    throw Object.assign(new Error('先写一句再说。'), { code: 2001, detail: 'appeal text blank' })
  }
  if (trimmed.length > 200) {
    throw Object.assign(new Error('说得有点长了，缩短一些再试试？'), { code: 2001, detail: 'appeal text exceeds 200' })
  }
  if (current.appealAt != null) {
    throw Object.assign(new Error('这条已经申诉过一次了，我们会认真看的。'), {
      code: 3410,
      detail: 'appeal_already_used',
    })
  }
  if (current.status !== 'rejected' && current.status !== 'takendown') {
    throw Object.assign(new Error('这条现在还不需要申诉。'), { code: 3411, detail: 'appeal_not_applicable' })
  }
  const now = Date.now()
  current.status = 'appealing'
  current.nextAction = 'none'
  current.appealAt = now
  current.appealText = trimmed
  current.moderationId = current.moderationId ?? `mod_${now}`
  return {
    appealId: current.moderationId,
    state: 'appealing',
    createdAt: now,
  }
}

function mockNextAction(work: Work): SubmissionNextAction {
  if (work.status && OCCUPYING.has(work.status)) return 'wait'
  if (work.status === 'rejected') {
    const mock = work as MockWork
    return (mock.contentVersion ?? 1) > (mock.submittedContentVersion ?? 1) ? 'resubmit' : 'edit'
  }
  return 'none'
}

function mockContentKey(work: Work): string {
  return [work.mediaType, work.mediaUrl, work.posterUrl, work.title, work.body ?? work.excerpt, work.width, work.height, work.durationMs, work.visibility].join('|')
}

export function mockReviewHash(
  input: Pick<PublishWorkInput, 'mediaType' | 'mediaKey' | 'posterKey' | 'title' | 'body' | 'aiGenerated'>,
  mediaUrl: string,
  posterUrl: string,
): string {
  return [
    input.mediaType,
    input.mediaKey || mediaUrl,
    input.mediaType === 'video' ? (input.posterKey || posterUrl) : '',
    input.title ?? '',
    input.body ?? '',
    String(input.aiGenerated ?? false),
  ].join('\n')
}

function mockReviewDecision(
  state: WorksMockState,
  input: PublishWorkInput,
  authorId: string,
  mediaUrl: string,
  posterUrl: string,
): { reviewMode: ReviewMode; reasonCode: string | null; hard: boolean; message: string; evidence?: MockReviewEvidence } {
  if (!input.sourceCardId) {
    return { reviewMode: 'full', reasonCode: 'user_upload', hard: false, message: '' }
  }
  const found = input.reviewEvidenceId
    ? state.evidences.find((item) => item.id === input.reviewEvidenceId)
    : state.evidences.find((item) => item.sourceCardId === input.sourceCardId && !item.consumedByWorkId)
  if (!found) {
    return { reviewMode: 'full', reasonCode: 'evidence_missing', hard: false, message: '' }
  }
  if (found.consentRevoked) {
    return { reviewMode: 'none', reasonCode: 'consent_revoked', hard: true, message: '这份授权已经收回，不能这样发出去。' }
  }
  if (found.consumedByWorkId) {
    return { reviewMode: 'none', reasonCode: 'evidence_consumed', hard: true, message: '这份审核已经用过了。' }
  }
  if (found.expiresAt <= Date.now()) {
    return { reviewMode: 'full', reasonCode: 'evidence_expired', hard: false, message: '' }
  }
  if (found.result !== 'passed' || found.policyEpoch !== 1) {
    return { reviewMode: 'full', reasonCode: 'evidence_policy_invalid', hard: false, message: '' }
  }
  if ((input.aiGenerated ?? false) && !found.aigcLabelReady) {
    return { reviewMode: 'none', reasonCode: 'aigc_label_missing', hard: true, message: '还缺一个生成标识，先补上再发。' }
  }
  if (found.contentHash !== mockReviewHash(input, mediaUrl, posterUrl)) {
    return { reviewMode: 'full', reasonCode: 'evidence_content_mismatch', hard: false, message: '' }
  }
  return { reviewMode: 'reused', reasonCode: null, hard: false, message: '', evidence: found }
}

/** 作品瀑布：只出已公开的（自己刚发的还在审核里，广场上看不到——这是对的）。 */
export function mockFeed(state: WorksMockState): Work[] {
  return state.works.filter((w) => !w.status || w.status === 'public').map((w) => mockPublicView(w))
}

export function mockPublicView(work: Work): Work {
  return {
    id: work.id,
    authorId: work.authorId,
    mediaType: work.mediaType,
    mediaUrl: work.mediaUrl,
    posterUrl: work.posterUrl,
    durationMs: work.durationMs,
    width: work.width,
    height: work.height,
    title: work.title,
    excerpt: work.excerpt,
    topicIds: work.topicIds,
    publishedAt: work.publishedAt,
    aiGenerated: work.aiGenerated,
    fromCard: work.fromCard,
    sourceType: work.sourceType ?? (work.fromCard ? 'memory_card' : 'user_upload'),
    body: work.body,
    createdAt: work.createdAt,
  }
}

export const ANON_PLAZA_BATCH = 30
export const ANON_PLAZA_TTL_MS = 2 * 60 * 60 * 1000

export interface PlazaAnonBatch {
  ids: string[]
  startedAt: number
}

/** 匿名两小时一批；绑定后不限。批次内被拿掉的作品直接隐去，不补新的。 */
export function mockPlazaWorks(
  state: WorksMockState,
  guest: boolean,
  batch: PlazaAnonBatch | undefined,
  now: number,
): { items: Work[]; batch?: PlazaAnonBatch } {
  const publicItems = mockFeed(state)
  if (!guest) return { items: publicItems }
  if (batch && now - batch.startedAt < ANON_PLAZA_TTL_MS) {
    const byId = new Map(publicItems.map((work) => [work.id, work]))
    return {
      items: batch.ids.flatMap((id) => {
        const found = byId.get(id)
        return found ? [found] : []
      }),
      batch,
    }
  }
  const items = publicItems.slice(0, ANON_PLAZA_BATCH)
  return { items, batch: { ids: items.map((work) => work.id), startedAt: now } }
}

/** 个人作品页。自己看自己时连草稿与审核中一起给。 */
export function mockAuthorWorks(state: WorksMockState, authorId: string, self: boolean): Work[] {
  return state.works
    .filter((w) => w.authorId === authorId)
    .filter((w) => self || !w.status || w.status === 'public')
    .map((w) => mockAuthorView(w, self))
}

export function mockSubmissionCapability(state: WorksMockState, authorId: string): SubmissionCapability {
  const blocking = state.works.find((work) => work.authorId === authorId && work.status && OCCUPYING.has(work.status))
  if (!blocking) {
    return { canSubmitWork: true, blockingWorkId: null, blockingStatus: null, nextAction: 'none' }
  }
  return {
    canSubmitWork: false,
    blockingWorkId: blocking.id,
    blockingStatus: blocking.status ?? 'pending',
    nextAction: 'wait',
  }
}
