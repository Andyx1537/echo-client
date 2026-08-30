// 作品域的 mock 数据与实现（VITE_API_BASE 为空时启用）。
//
// 🔴 种子用**真实封面**（echo-doc/Echo-assets/static/seed-covers/，48 张），
//    不用灰块也不用 Lorem：两案都很空的对比等于没对比，据此做的版面决定是错的。
//
// 🔴 宽高**刻意造得散**（2:3 到 4:5 之间浮动，另有两条横构图）：
//    瀑布流要判的就是高低错落，样本全挤在同一个比例里，
//    有没有按真实宽高排版会长得一模一样。

import type { PublishWorkInput, Work } from '../types'
import { assetUrl } from '../lib/assetUrl'

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
  }))
}

export interface WorksMockState {
  works: Work[]
}

export function freshWorks(myAccountId: string): WorksMockState {
  const works = buildSeed()
  // 🔴 分两条挂到当前用户名下：一条已公开、一条审核中。
  //    不这么做「我的作品」永远是空的（种子作者都是别人），
  //    而空态看不出「审核中」角标长什么样——那正是这一屏最该验的东西。
  works[1] = { ...works[1], authorId: myAccountId, status: 'public', visibility: 'public' }
  works[4] = { ...works[4], authorId: myAccountId, status: 'pending', visibility: 'public' }
  return { works }
}

/** 发布。🔴 落 pending 而非 public，与服务端 OM3 口径一致 */
export function mockPublish(
  state: WorksMockState,
  input: PublishWorkInput,
  authorId: string,
  mediaUrl: string,
  posterUrl: string,
): Work {
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
    status: 'pending',
    visibility: input.visibility ?? 'public',
    sourceCardId: input.sourceCardId ?? null,
    body: input.body ?? '',
    createdAt: Date.now(),
  }
  state.works = [work, ...state.works]
  return work
}

/** 作品瀑布：只出已公开的（自己刚发的还在审核里，广场上看不到——这是对的）。 */
export function mockFeed(state: WorksMockState): Work[] {
  return state.works.filter((w) => !w.status || w.status === 'public')
}

/** 个人作品页。自己看自己时连草稿与审核中一起给。 */
export function mockAuthorWorks(state: WorksMockState, authorId: string, self: boolean): Work[] {
  return state.works
    .filter((w) => w.authorId === authorId)
    .filter((w) => self || !w.status || w.status === 'public')
}
