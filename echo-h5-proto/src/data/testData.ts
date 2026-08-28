import type { ContentOrigin } from '../types'

// ============================================================
// 内部测试数据（账号 + 内容）—— 🔴 这一整个文件都不是生产内容
// ------------------------------------------------------------
// 性质：
//   为了让共鸣厅在联调期看起来像个有人的社区，我们内部造了一批账号，
//   把 96 条运营写的种子内容摊在它们名下。这些账号背后**没有真人**，
//   不会登录、不会互动、不产生任何真实行为数据。
//
// 为什么必须能被程序一眼识别（后端硬口径）：
//   测试/非真实用户产生的内容不得计入北极星等核心指标，也不得占用
//   给真实新人的曝光保底位。所以这批数据必须自带标记、可一次性排除，
//   混不出来就会在上线时污染指标。
//
// 标记落在两处，互不依赖：
//   ① 账号：`isSeed: true`（与后端 `t_account.accountType` 正交，理由见下）
//   ② 内容：`originType: 'seed_ops'`（对齐后端 `t_memory_card.originType`）
//   内容自带标记，判断"这条要不要排除"永远不需要反查作者是谁。
//
// 为什么账号侧不写成 `accountType: 'test'`：
//   `t_account.accountType` 是 CHECK 约束的闭集（user / ops / system，DEFAULT 'user'），
//   加值要走建库变更，且改这一列被定为高危操作（需 super_admin 二次审批 + 审计）。
//   更要紧的是语义：accountType 回答"这是谁在说话"，而测试身份回答"这条数据真不真"，
//   两者正交。一旦把 test 塞进 accountType，后端所有 `accountType='user'` /
//   `actorType='user'` 的过滤条件都会连带改写含义。所以账号侧另开一个布尔标记。
//
// 一次性摘除（切生产时）：
//   · 临时关闭展示：`.env.local` 里写 `VITE_SHOW_TEST_DATA=0`，
//     共鸣厅、搜索、亲友、消息里的测试数据会全部消失（官方号「回声整理室」保留）。
//   · 彻底清理：删掉本文件 + mock.ts 里「二、广场态」与「运营扩充池」两节，
//     以及 demoUsers 名册；`originType==='seed_ops'` 是唯一需要 grep 的关键字。
//   · 不在本开关范围内：当前用户自己的建档宠物/记录（那是本机 demo 状态，
//     由「我的 · 重置本地数据」控制，与这批公共测试数据是两件事）。
// ============================================================

/** 一个内部测试账号。字段与 mock.ts 的 DemoUser 同形，可直接混用。 */
export interface SeedAccount {
  id: string
  nickname: string
  /** 头像占位色（CSS 渐变，离线稳定、不入代码库） */
  avatar: string
  /** 人设一句话 */
  persona: string
  /** 恒 true：内部测试账号，不是真实用户 */
  isSeed: true
}

/**
 * 测试数据总闸。默认开（原型/联调期要看内容）；
 * `VITE_SHOW_TEST_DATA=0` 时，所有 isSeed 账号与 seed_* 内容一律不出现在界面上。
 */
export const SHOW_TEST_DATA = import.meta.env.VITE_SHOW_TEST_DATA !== '0'

/** 属于种子/测试来源的 originType 取值（后端同名口径） */
const SEED_ORIGINS: ReadonlySet<string> = new Set<ContentOrigin>(['seed_ops', 'seed_ai'])

/** 这条内容是不是测试数据——只看内容自己的 originType，不反查作者 */
export function isTestContent(item: { originType?: ContentOrigin }): boolean {
  return item.originType !== undefined && SEED_ORIGINS.has(item.originType)
}

/** 这个账号是不是测试账号 */
export function isTestAccount(account: { isSeed?: boolean }): boolean {
  return account.isSeed === true
}

/** 过总闸：开关关闭时摘掉全部测试内容，开启时原样返回 */
export function contentForDisplay<T extends { originType?: ContentOrigin }>(items: T[]): T[] {
  return SHOW_TEST_DATA ? items : items.filter((it) => !isTestContent(it))
}

/** 过总闸：开关关闭时摘掉全部测试账号，开启时原样返回 */
export function accountsForDisplay<T extends { isSeed?: boolean }>(items: T[]): T[] {
  return SHOW_TEST_DATA ? items : items.filter((it) => !isTestAccount(it))
}

// ------------------------------------------------------------
// 名册：36 个测试账号
//   调性沿用产品词表——温和、生活化，不用「测试用户 01」这类编号名，
//   否则联调截图发出去就是一屏机器味。头像统一走 CSS 渐变。
//   前四位（慢慢整理 / 一页旧事 / 今天也记得 / 不赶路的人）是扩充池原有的署名，
//   现在收编为正式的测试账号，不再是散落在数据里的字符串。
// ------------------------------------------------------------

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg,#f3ddc0,#dcb184)', 'linear-gradient(135deg,#d8e2ca,#a9bb92)',
  'linear-gradient(135deg,#e7cdd6,#c396a6)', 'linear-gradient(135deg,#cfdde4,#94b0bd)',
  'linear-gradient(135deg,#efe0c6,#cdb489)', 'linear-gradient(135deg,#ded7e6,#ab9dbf)',
  'linear-gradient(135deg,#f0d9c9,#d3a389)', 'linear-gradient(135deg,#d6e0d3,#9fb39c)',
  'linear-gradient(135deg,#e9dcc4,#c9b184)', 'linear-gradient(135deg,#d3dae6,#9aa6bd)',
  'linear-gradient(135deg,#f1d7cf,#cf9c92)', 'linear-gradient(135deg,#dbe4d8,#a6b8a2)',
]

const ROSTER: ReadonlyArray<readonly [nickname: string, persona: string]> = [
  ['慢慢整理', '不着急，一件一件想起来'],
  ['一页旧事', '把想留的都写在纸上'],
  ['今天也记得', '每天记一件小事'],
  ['不赶路的人', '走得慢一点也没关系'],
  ['阳台有风', '晾衣服的时候最容易想起从前'],
  ['老唱片店', '守着一屋子听旧了的声音'],
  ['三楼的猫', '楼道里遇见过的都算朋友'],
  ['汤要趁热', '一个人也认真做饭'],
  ['拾光的人', '捡起被忘掉的那些下午'],
  ['半罐蜂蜜', '甜的东西留一半慢慢吃'],
  ['傍晚六点', '下班路上想起的都是旧事'],
  ['山下有雨', '南方长大，习惯潮湿的记性'],
  ['抽屉里的春天', '旧信、票根、剪下来的报纸角'],
  ['温水煮茶', '不喝浓的，也不赶时间'],
  ['旧铁皮盒', '装过糖，后来装了一整个童年'],
  ['小院有光', '奶奶家那扇木门还在'],
  ['星期天的鱼', '菜市场比朋友圈热闹'],
  ['剩半格电', '总在快关机的时候想给谁打电话'],
  ['走过菜市场', '认识摊主的名字，也记得他们的老猫'],
  ['云在窗外', '坐飞机总要靠窗'],
  ['一碗糖水', '外婆那口锅还在灶上'],
  ['楼下修鞋铺', '师傅说这双还能穿三年'],
  ['十月的信', '写完了没寄，也没舍得扔'],
  ['把灯留着', '晚归的人回来能看见'],
  ['阿婆的针线', '缝过的口子比新的还结实'],
  ['慢班车', '宁愿多坐两站，看看窗外'],
  ['海边捡贝壳', '每次去都带回一小把沙'],
  ['晒被子的下午', '阳光的味道是能记住的'],
  ['巷口有猫叫', '常年在外面留一碗水'],
  ['收音机还响', '换了三次电池，舍不得换机器'],
  ['两个人的锅', '现在还是习惯做两份'],
  ['记得关窗', '下雨前总要绕回家一趟'],
  ['榆树下', '老家门口那棵还在长'],
  ['冬天的橘子', '暖气房里剥橘子，手是香的'],
  ['借来的伞', '一直想还，一直没还上'],
  ['夜里散步', '睡不着就下楼绕一圈'],
]

export const testAccounts: SeedAccount[] = ROSTER.map(([nickname, persona], i) => ({
  id: `u-seed-${String(i + 1).padStart(2, '0')}`,
  nickname,
  avatar: AVATAR_GRADIENTS[i % AVATAR_GRADIENTS.length],
  persona,
  isSeed: true,
}))

// ------------------------------------------------------------
// 内容分摊
// ------------------------------------------------------------

/**
 * 长尾权重（循环取用）：有人发过五六条，有人只发过一条——
 * 平均摊会让每个账号都恰好两三条，一翻就看出是灌的。
 */
const POST_WEIGHTS = [5, 3, 2, 1, 4, 2, 1, 1, 3, 2, 1, 2]

type OwnerLike = { nickname: string; avatar: string }

/**
 * 给 count 条内容排一份作者序列（确定性，不用随机数，保证每次构建一致）。
 *
 * 两个约束：
 *  ① 按长尾权重分摊，每个账号至少一条（这样搜到谁都点得进去）；
 *  ② 相邻两条不撞同一个作者——瀑布流里挨着的两张卡署同一个名字很假。
 *
 * @param prevOwnerName 上一段（首屏 12 扇窗）最后一条的作者，用来接住衔接处的重复
 */
export function seedOwnerSequence<T extends OwnerLike>(count: number, pool: T[], prevOwnerName?: string): T[] {
  const remaining = pool.map((_, i) => POST_WEIGHTS[i % POST_WEIGHTS.length])
  let total = remaining.reduce((a, b) => a + b, 0)
  // 权重之和几乎不会正好等于 count，缺则从头补、多则从权重高的头部扣（保底每人一条）
  for (let i = 0; total < count; i = (i + 1) % pool.length) {
    remaining[i]++
    total++
  }
  // 多则从「已经不多的那些人」里扣（2 条→1 条），而不是削高产账号——
  // 削高峰会把曲线抹平成人人两三条，反而更像批量灌的数据。
  while (total > count) {
    let i = -1
    for (let k = 0; k < remaining.length; k++) {
      if (remaining[k] <= 1) continue
      if (i === -1 || remaining[k] < remaining[i]) i = k
    }
    if (i === -1) break
    remaining[i]--
    total--
  }

  const out: T[] = []
  let prev = prevOwnerName
  for (let n = 0; n < count; n++) {
    // 每次挑「还剩最多、且不是上一条作者」的人，天然把高产账号摊开
    let pick = -1
    for (let i = 0; i < pool.length; i++) {
      if (remaining[i] <= 0 || pool[i].nickname === prev) continue
      if (pick === -1 || remaining[i] > remaining[pick]) pick = i
    }
    if (pick === -1) pick = remaining.findIndex((r) => r > 0)
    if (pick === -1) break
    remaining[pick]--
    prev = pool[pick].nickname
    out.push(pool[pick])
  }
  return out
}
