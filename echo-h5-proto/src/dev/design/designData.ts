/**
 * 🔴 设计稿用数据。真实比例的封面 + 真写出来的文案，**不用占位符** ——
 * 空占位会让任何排版看起来都一样好，等于没设计。
 */

import type { Placeholder, Visibility } from '../../types'
import { assetUrl } from '../../lib/assetUrl'

function cover(file: string, gradient: string, emoji: string): Placeholder {
  return { gradient, emoji, imageUrl: assetUrl(`seed-covers/${file}`), aiGenerated: true }
}

// ============================================================
// B18 · 这只它的公开回忆卡
// ============================================================

/**
 * 一张公开的回忆卡（`B18` 的 item）。
 *
 * 🔴 **前端今天没有这个类型**，`types.ts` 里只有整扇窗的 `Window`。
 * 字段照 `schema.sql` 的 `t_memory_card` 取（`title` ≤30 · `body` ≤500 · `topicIds` 0–3 ·
 * `visibility` 三档），**不自己造名**。`excerpt` 是 `body` 的前两行，由服务端截还是前端截需要契约定，
 * 见 docs/visual/README-redesign.md 的契约清单。
 */
export interface PublicCard {
  id: string
  /**
   * 🔴 **可能为空。** `schema.sql` 里 `title varchar(64) NOT NULL DEFAULT ''` ——
   * 默认空串本身就是「允许没有标题」的证据。而卡表要装的是**所有可发布的回忆**
   * （AI 产出 + 手写 `record` + 生命之书，`PRODUCT-MINDMAP §3.3.1`），
   * 后两类**多半没有标题**：用户写下的是一段话，不是一个题目。
   *
   * 所以卡型**不能靠标题撑版面**，一行文字的取值链见 {@link cardLine}。
   */
  title?: string
  /** `body` 的摘要 */
  excerpt: string
  /** 🔴 **可能没有。** 手写 `record` 常常只有文字，卡型必须给出无图时的形态 */
  cover?: Placeholder
  date: string
  /**
   * 主题标签，0–3 个（`t_topic`）。
   *
   * 🔴 **当前没有任何一处渲染它**（裁定 2026-08-27：题材不上卡封面）。
   * 留着字段而不是删掉，是因为它是 `t_memory_card.topicIds` 的真实契约，
   * 而且题材下一步要做成**列表顶上的筛选器**，那时候要用同一份数据。
   * ⚠️ 但这就意味着它现在是**不设防的**：改坏了没有任何一张图会变样。
   */
  topic?: string
  /** 🔴 只有作者自己看得到；陌生人那一版根本不读这个字段 */
  visibility: Visibility
}

/**
 * 卡片那一行文字取什么。
 *
 * 🔴 **取值链 = `title` → 正文首句**，不是「只取 title」。
 * 只取 title 的后果不是「难看一点」，是**整类卡露出空位**：AI 回声与手写 record 都没有标题，
 * 而它们恰恰是卡表里最大的两类。首句用中英文句末标点切，切不出来就整段截断交给省略号。
 */
export function cardLine(card: PublicCard): string {
  if (card.title) return card.title
  const m = card.excerpt.match(/^[^。！？.!?]+[。！？.!?]?/)
  return (m ? m[0] : card.excerpt).replace(/[。.]$/, '')
}

/**
 * 小黑这只它的全部回忆卡（含未公开的，供作者视角用）。
 *
 * ⚠️ 顺序是**手排**的，为的是让折叠阈值（前 3 张）在图上看得见。
 * 线上建议的默认序是「作者置顶的在前 + 其余按发布时间倒序」，见 README 的 `B18` 一节。
 */
export const HEIHEI_CARDS: PublicCard[] = [
  {
    id: 'c-heihei-2',
    title: '雨夜屋檐下的第一次见面',
    excerpt: '它蜷在纸箱边上，浑身湿透，却还是抬头看了我一眼。那一眼我记了八年。',
    cover: cover('cover-place-alley.jpg', 'linear-gradient(160deg,#dce4e8,#8fa3ad)', '🌧️'),
    date: '2016.06.02',
    topic: '相遇',
    visibility: 'public',
  },
  {
    id: 'c-heihei-3',
    title: '它把纸箱当成了自己的房间',
    excerpt: '买过三个猫窝，一个都没用上。最后它选中的是快递箱，还自己叼了条毯子进去。',
    cover: cover('cover-pet-blanket.jpg', 'linear-gradient(160deg,#eef3e6,#cdd9b4)', '🧺'),
    date: '2018.03.11',
    topic: '日常',
    visibility: 'public',
  },
  {
    id: 'c-heihei-4',
    title: '空着的那只碗，我还是没收',
    excerpt: '洗干净放回原来的位置，好像这样它随时都能回来吃一口。',
    cover: cover('cover-pet-bowl.jpg', 'linear-gradient(160deg,#f6ead6,#e2c79c)', '🍚'),
    date: '2024.11.20',
    topic: '想念',
    visibility: 'public',
  },
  {
    id: 'c-heihei-1',
    title: '午后那块阳光，是它的固定座位',
    excerpt: '太阳挪到哪儿它挪到哪儿。有一年冬天冷，它就整个下午都不下沙发。',
    cover: cover('cover-pet-nap.jpg', 'linear-gradient(160deg,#f6efe2,#ddd0bb)', '🛋️'),
    date: '2020.09.18',
    topic: '日常',
    visibility: 'public',
  },
  {
    id: 'c-heihei-5',
    title: '它最后那半年，都待在这间屋子里',
    excerpt: '它挑了衣柜最下面那格，铺着我那件旧毛衣，说什么也不肯出来。',
    cover: cover('cover-family-wardrobe.jpg', 'linear-gradient(160deg,#e9e2d6,#b9ac97)', '🚪'),
    date: '2024.06.30',
    topic: '陪伴',
    visibility: 'friends',
  },
  {
    id: 'c-heihei-6',
    title: '送它去医院的那条路',
    excerpt: '路上它一直很安静。我到现在也没敢再走那条路。',
    cover: cover('cover-place-busstop.jpg', 'linear-gradient(160deg,#f0e4d3,#c9b6a0)', '🌇'),
    date: '2024.10.02',
    topic: '告别',
    visibility: 'private',
  },
]

/**
 * 生命之书三条（`W1`）。
 *
 * 🔴 **刻意用抽象封面，不用实拍**：它和回忆卡在同一屏里挨着出现，
 * 都上实拍图会让人以为是同一批内容的两种排法。抽象封面同时解决了另一个问题——
 * 里程碑往往根本没有对应的照片（「相遇那天」谁也没来得及拍）。
 */
export interface LifeItem {
  title: string
  year: string
  desc: string
  placeholder: Placeholder
}

export const LIFE_BOOK: LifeItem[] = [
  { year: '2016', title: '雨夜相遇', desc: '它蜷在屋檐下，我们就这样认识了。', placeholder: { gradient: 'linear-gradient(135deg,#e7ddd0,#b9a894)', emoji: '🌧️', aiGenerated: false } },
  { year: '2020', title: '窗边的习惯', desc: '每到黄昏，它都会去窗台等我回家。', placeholder: { gradient: 'linear-gradient(135deg,#f6e2c6,#dcb083)', emoji: '🪟', aiGenerated: false } },
  { year: '2024', title: '换个地方', desc: '它去了很远的地方，晚霞替它跟我道别。', placeholder: { gradient: 'linear-gradient(135deg,#efdcc6,#cba184)', emoji: '✨', aiGenerated: false } },
]

/**
 * 已解锁的记忆明信片三张（`W11`）。
 *
 * ⚠️ 图刻意用**空景**（它待过的地方，画面里没有它）：这是纪念类产品里最常见的一类照片，
 * 也顺带避开了素材库里猫狗混用的问题。
 */
export interface DesignPostcard {
  id: string
  date: string
  caption: string
  placeholder: Placeholder
}

export const DESIGN_POSTCARDS: DesignPostcard[] = [
  { id: 'dp-1', date: '2022.04.12', caption: '春天的光又落回它常坐的那块地板', placeholder: cover('cover-daily-mug.jpg', 'linear-gradient(150deg,#f7f0e3,#ddd2bd)', '🌤️') },
  { id: 'dp-2', date: '2023.01.06', caption: '楼道的灯，还是那个亮法', placeholder: cover('cover-place-stairlight.jpg', 'linear-gradient(150deg,#e6ece8,#c2cec8)', '💡') },
  { id: 'dp-3', date: '2023.09.20', caption: '阳台的风吹了一整个下午', placeholder: cover('cover-pet-collar.jpg', 'linear-gradient(150deg,#eee6d8,#cbbba2)', '🌬️') },
]

/** 陌生人能看到的那一批（服务端按 `visibility='public'` 过滤后的结果） */
export const HEIHEI_PUBLIC_CARDS = HEIHEI_CARDS.filter((c) => c.visibility === 'public')

// ============================================================
// 卡型比稿与边界样本
// ============================================================

/** 🔴 四种卡型比的就是这三张，同一份数据、同一个位置，只有卡型不同 */
export const CARD_SAMPLES: PublicCard[] = HEIHEI_PUBLIC_CARDS.slice(0, 3)

/** 无图的卡：手写 `record`，只有一段话 —— 卡型必须能接住它 */
export const CARD_NO_IMAGE: PublicCard = {
  id: 'edge-noimg',
  title: '今天整理抽屉，翻到了它的项圈',
  excerpt: '铃铛还在响。我坐在地上听了很久，然后原样放了回去。',
  date: '2025.03.08',
  topic: '想念',
  visibility: 'public',
}

/** 没有标题的卡：AI 回声与手写 record 的常态 —— 一行文字要回落到正文首句 */
export const CARD_NO_TITLE: PublicCard = {
  id: 'edge-notitle',
  excerpt: '风把窗帘吹得轻轻动，它好像在等一个和你说话的时刻。今天午后的光很好。',
  cover: cover('cover-pet-nap.jpg', 'linear-gradient(160deg,#f6efe2,#ddd0bb)', '🛋️'),
  date: '2025.01.19',
  visibility: 'public',
}

/** 超长标题：`title` 上限 30 字，这条正好顶格 —— 省略号必须在这里就收住 */
export const CARD_LONG_TITLE: PublicCard = {
  id: 'edge-long',
  title: '那年冬天特别冷，它在窗台上守了整整一个下午才等到我回家的那一天',
  excerpt: '后来我才知道，它认得的不是时间，是楼下那班车的声音。',
  cover: cover('cover-pet-sunset.jpg', 'linear-gradient(160deg,#f3ddc4,#b98a72)', '🌆'),
  date: '2019.12.21',
  topic: '日常',
  visibility: 'public',
}

/** 四条边界排在一起：正常 / 超长标题 / 无标题 / 无图 */
export const CARD_EDGE_CASES: PublicCard[] = [
  CARD_SAMPLES[0],
  CARD_LONG_TITLE,
  CARD_NO_TITLE,
  CARD_NO_IMAGE,
]

const EXTRA_LINES: Array<[string, string, string, string]> = [
  ['cover-pet-blanket.jpg', '它挑中的永远是纸箱', '2021.02.14', '日常'],
  ['cover-place-stairlight.jpg', '楼道那盏灯，它比我先认得', '2018.11.03', '日常'],
  ['cover-daily-mug.jpg', '早饭时间它一定在脚边', '2019.07.22', '陪伴'],
  ['cover-family-wardrobe.jpg', '衣柜最下面那格是它的', '2022.09.05', '陪伴'],
  ['cover-place-alley.jpg', '巷口那只野猫，它认识', '2017.05.30', '相遇'],
  ['cover-place-busstop.jpg', '接我下班这件事它做了八年', '2020.03.17', '日常'],
  ['cover-pet-collar.jpg', '晒被子的下午，它躺在最中间', '2023.04.28', '日常'],
  ['cover-pet-bowl.jpg', '换了新碗它闻了三天才肯吃', '2018.08.11', '日常'],
]

/** 十几张的密度：看这一屏刷起来会不会变成「无限流」 */
export const MANY_CARDS: PublicCard[] = [
  ...HEIHEI_PUBLIC_CARDS,
  ...EXTRA_LINES.map(([file, title, date, topic], i) => ({
    id: `many-${i}`,
    title,
    excerpt: '这一条是为了看密度造的真实长度文案，排版上只出一行，超出交给省略号。',
    cover: cover(file, 'linear-gradient(160deg,#f2e7d6,#cfbda2)', '🌿'),
    date,
    topic,
    visibility: 'public' as Visibility,
  })),
]

/** 只有一张卡：最容易被漏掉的那一端 */
export const ONE_CARD: PublicCard[] = [HEIHEI_PUBLIC_CARDS[0]]

// ============================================================
// 暖光：三档的语义与文案
// ============================================================

export type WarmthTier = 'low' | 'mid' | 'high'

/** 服务端只下发档位（候选口径）；分界点仍待定，与本次设计无关 */
export function tierOf(faces: number): WarmthTier {
  if (faces < 7) return 'low'
  if (faces < 15) return 'mid'
  return 'high'
}

/**
 * 🔴 **文案已上生产，这里不再自己存一份。**
 *
 * 2026-08-27 之前这里放过 `TIER_LABEL_OWNER` / `TIER_LABEL_VISITOR` 两套
 * （主人一套、别人一套）。**两套已被产品否掉**：这才刚起步，不能在文案层先分叉——
 * 两套意味着以后每改一次文案都要维护两份，而这个产品的文案还要整体重写一遍。
 *
 * 现在只有一套，定义在 `src/lib/warmth.ts`，读的人是谁都成立。
 * 比稿板从那里取，🔴 **不要在这里抄第二份**——抄了就会和线上飘开，而且不报错。
 */
export { WARMTH_PHRASE as TIER_LABEL_VISITOR } from '../../lib/warmth'

/** 现状的三句，🔴 已作废，只用于对照图，不要写回产品 */
export const TIER_LABEL_OLD: Record<WarmthTier, string> = {
  low: '静静被记得着',
  mid: '一直被记得',
  high: '被很多人记挂着',
}

/** 广场对照用的一批卡（沿用第一轮那 16 张的 faces 分布，换成设计稿要展示的 8 张） */
export interface WarmthDemoCard {
  id: string
  recent: string
  ownerName: string
  ownerAvatar: string
  cover: Placeholder
  span: 'short' | 'tall'
  faces: number
}

export const WARMTH_DEMO_CARDS: WarmthDemoCard[] = [
  { id: 'wd-1', faces: 2, recent: '它走后，最先空下来的不是窝，是门口那双拖鞋。', ownerName: '小满', ownerAvatar: 'linear-gradient(135deg,#f3d9a8,#e0b071)', cover: cover('cover-pet-slippers.jpg', 'linear-gradient(160deg,#f4e6cd,#e0c49a)', '🥿'), span: 'short' },
  { id: 'wd-2', faces: 18, recent: '那条线早就改号了，我还是下意识站在原来的站牌下。', ownerName: '回声整理室', ownerAvatar: 'linear-gradient(135deg,#f0c27a,#d78f3a)', cover: cover('cover-place-busstop.jpg', 'linear-gradient(160deg,#dce9ec,#8daab5)', '🚌'), span: 'short' },
  { id: 'wd-3', faces: 5, recent: '玻璃上那一点印子留了很久，后来才发现自己没舍得擦。', ownerName: '阿哲', ownerAvatar: 'linear-gradient(135deg,#cfe0c2,#a8c48c)', cover: cover('cover-pet-blanket.jpg', 'linear-gradient(160deg,#eef3e6,#cdd9b4)', '🧺'), span: 'tall' },
  { id: 'wd-4', faces: 26, recent: '今天的晚霞，很像你回来的那天。', ownerName: '念夏', ownerAvatar: 'linear-gradient(135deg,#e6d3ea,#c1a8d4)', cover: cover('cover-pet-sunset.jpg', 'linear-gradient(160deg,#f3ddc4,#b98a72)', '🌆'), span: 'tall' },
  { id: 'wd-5', faces: 9, recent: '收起来又拿出来，最后还是放回了原来的位置。', ownerName: '念夏', ownerAvatar: 'linear-gradient(135deg,#e6d3ea,#c1a8d4)', cover: cover('cover-pet-bowl.jpg', 'linear-gradient(160deg,#f6ead6,#e2c79c)', '🍚'), span: 'short' },
  { id: 'wd-6', faces: 11, recent: '播放器坏了，但我还记得按下倒带键时那一下轻响。', ownerName: '倒北', ownerAvatar: 'linear-gradient(135deg,#ddd0ea,#ab8ec4)', cover: cover('cassette-v1.jpg', 'linear-gradient(160deg,#e8dced,#a789b7)', '📼'), span: 'short' },
  { id: 'wd-7', faces: 3, recent: '毕业时锁进去的那张纸条，钥匙早就找不到了。', ownerName: '夏七', ownerAvatar: 'linear-gradient(135deg,#cfdff0,#9bb8d8)', cover: cover('cover-youth-drawer.jpg', 'linear-gradient(160deg,#edf0df,#b7c597)', '🗝️'), span: 'short' },
  { id: 'wd-8', faces: 40, recent: '下雪了，第一次见到雪的开心模样。', ownerName: '念夏', ownerAvatar: 'linear-gradient(135deg,#e6d3ea,#c1a8d4)', cover: cover('cover-pet-snowday.jpg', 'linear-gradient(160deg,#e7ecf2,#c3ccdb)', '❄️'), span: 'tall' },
]
