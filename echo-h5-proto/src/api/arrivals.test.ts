import { describe, expect, it } from 'vitest'
import type { ReactionArrival } from '../types'
import { cardIdOfArrival, isArrivalId, mergeArrivals } from './arrivals'

/**
 * 「被接住」的到达（`PRODUCT-MINDMAP §6.2 B20`）的三条硬约束，逐条钉死。
 * 改红之前先回去读那三条，别改用例。
 */

function arrival(over: Partial<ReactionArrival> = {}): ReactionArrival {
  return {
    id: 'ra-1',
    cardId: 'card-1',
    cardTitle: '豆豆',
    reaction: 'remember',
    createdAt: 1_000,
    read: false,
    ...over,
  }
}

/** 全角/半角数字与中文数词——措辞里出现任意一个都算越线 */
const QUANTITY_RE = /[0-9０-９]|[一二两三四五六七八九十几多]\s*(个|位|人|束|条|次)/

describe('约束 3 · 同一张卡被多人回应合并成一条（粒度按卡不按人）', () => {
  it('同一张卡的多条回应只出一条通知', () => {
    const out = mergeArrivals([
      arrival({ id: 'a', cardId: 'card-1', createdAt: 1 }),
      arrival({ id: 'b', cardId: 'card-1', createdAt: 2 }),
      arrival({ id: 'c', cardId: 'card-1', createdAt: 3 }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].routeTo).toEqual({ type: 'window', id: 'card-1' })
  })

  it('一张卡被 50 个人回应，仍然只有一条——这正是防刷屏的那一条', () => {
    const many = Array.from({ length: 50 }, (_, i) =>
      arrival({ id: `a${i}`, cardId: 'card-hot', createdAt: i }),
    )
    expect(mergeArrivals(many)).toHaveLength(1)
  })

  it('不同卡不合并：合并的是卡，不是「所有回应」', () => {
    const out = mergeArrivals([
      arrival({ id: 'a', cardId: 'card-1' }),
      arrival({ id: 'b', cardId: 'card-2' }),
    ])
    expect(out).toHaveLength(2)
  })

  it('同一张卡上「记得」与「献花」并存时仍是一条，两种回应都被说到', () => {
    const out = mergeArrivals([
      arrival({ id: 'a', reaction: 'remember' }),
      arrival({ id: 'b', reaction: 'flower' }),
    ])
    expect(out).toHaveLength(1)
    expect(out[0].preview).toContain('记得')
    expect(out[0].preview).toContain('心意')
  })

  it('时间取该卡最新一次回应，列表按时间倒序', () => {
    const out = mergeArrivals([
      arrival({ id: 'a', cardId: 'card-1', createdAt: 10 }),
      arrival({ id: 'b', cardId: 'card-1', createdAt: 99 }),
      arrival({ id: 'c', cardId: 'card-2', createdAt: 50 }),
    ])
    expect(out.map((m) => m.createdAt)).toEqual([99, 50])
  })
})

describe('约束 2 · 措辞里不出现精确数量', () => {
  it('三种回应组合的措辞都不含任何数量表述', () => {
    const cases: ReactionArrival[][] = [
      [arrival({ reaction: 'remember' })],
      [arrival({ reaction: 'flower' })],
      [arrival({ id: 'a', reaction: 'remember' }), arrival({ id: 'b', reaction: 'flower' })],
    ]
    for (const c of cases) {
      const [msg] = mergeArrivals(c)
      expect(msg.preview).not.toMatch(QUANTITY_RE)
      expect(msg.title).not.toMatch(QUANTITY_RE)
    }
  })

  it('🔴 人越多措辞也一个字不变——「有人」单复数通用，不给任何数量线索', () => {
    const one = mergeArrivals([arrival({ id: 'a' })])[0]
    const many = mergeArrivals(
      Array.from({ length: 7 }, (_, i) => arrival({ id: `a${i}`, createdAt: i })),
    )[0]
    expect(many.preview).toBe(one.preview)
  })

  it('🔴 合并后的消息不携带任何人数字段——没有这个数，就渲染不出「3 个人」', () => {
    const [msg] = mergeArrivals([
      arrival({ id: 'a' }),
      arrival({ id: 'b' }),
      arrival({ id: 'c' }),
    ])
    // 逐个值扫一遍：不允许出现 3（本例的真实人数）这样的计数残留
    for (const v of Object.values(msg)) {
      expect(typeof v === 'number' && v === 3).toBe(false)
    }
    expect(Object.keys(msg).sort()).toEqual(
      ['createdAt', 'id', 'kind', 'preview', 'read', 'routeTo', 'title'].sort(),
    )
  })
})

describe('约束 1 · 柔性暖点、看过即散（不带数字、不红点轰炸）', () => {
  it('只要还有一条没读过，合并后就算未读——读过一半不能把暖点散掉', () => {
    const [msg] = mergeArrivals([
      arrival({ id: 'a', read: true }),
      arrival({ id: 'b', read: false }),
    ])
    expect(msg.read).toBe(false)
  })

  it('整卡都读过了才算已读，暖点随之散去', () => {
    const [msg] = mergeArrivals([
      arrival({ id: 'a', read: true }),
      arrival({ id: 'b', read: true }),
    ])
    expect(msg.read).toBe(true)
  })

  it('未读与否是布尔，不是计数——暖点没有「几条未读」这个概念', () => {
    const [msg] = mergeArrivals([arrival({ id: 'a' }), arrival({ id: 'b' })])
    expect(typeof msg.read).toBe('boolean')
  })
})

describe('到达消息 id ↔ 卡 id 的互认（标已读要按整卡标）', () => {
  it('到达消息可被识别，并能取回卡 id', () => {
    const [msg] = mergeArrivals([arrival({ cardId: 'card-9' })])
    expect(isArrivalId(msg.id)).toBe(true)
    expect(cardIdOfArrival(msg.id)).toBe('card-9')
  })

  it('普通消息不会被误认成到达', () => {
    expect(isArrivalId('m-1')).toBe(false)
    expect(cardIdOfArrival('m-1')).toBeNull()
  })
})

/**
 * 服务端为了让「按卡翻页」的每页体积可控，下发前把每张卡**每类回应只留最新一行**
 * （至多两行：记得、献花）。它给的论证是：合并只用到「最新时刻 / 类型并集 / 有没有未读」，
 * 前两样每类最新那行就给全了，第三样因为已看水位单调、等价于「最新那条是否越过水位」。
 *
 * 🔴 **这一组用例是来独立验这个论证的，不是来背书的。** 结论：论证成立，
 * 但它**有一个没有被写出来的前提**——「已读必须由单调水位派生」。
 * 下面最后一个用例给出前提不成立时的反例，把这个耦合钉在这里。
 */
describe('服务端折叠（每卡每类只留最新一行）与拿全量行合并是否等价', () => {
  /** 服务端下发前做的那一步：每 (卡, 回应类型) 只留 createdAt 最大的一行 */
  function collapseNewestPerKind(rows: ReactionArrival[]): ReactionArrival[] {
    const keep = new Map<string, ReactionArrival>()
    for (const r of rows) {
      const k = `${r.cardId}|${r.reaction}`
      const prev = keep.get(k)
      if (!prev || r.createdAt > prev.createdAt) keep.set(k, r)
    }
    return [...keep.values()]
  }

  /** 已读按「每扇窗一条已看水位」派生，与服务端 read = createdAt <= seenAt 同构 */
  function applyWatermark(rows: ReactionArrival[], seenAt: Record<string, number>) {
    return rows.map((r) => ({ ...r, read: r.createdAt <= (seenAt[r.cardId] ?? 0) }))
  }

  it('构造好的用例上：折叠前后合并结果逐字段相同', () => {
    const raw = [
      arrival({ id: 'a', cardId: 'c1', reaction: 'remember', createdAt: 10 }),
      arrival({ id: 'b', cardId: 'c1', reaction: 'remember', createdAt: 30 }),
      arrival({ id: 'c', cardId: 'c1', reaction: 'flower', createdAt: 20 }),
      arrival({ id: 'd', cardId: 'c2', reaction: 'flower', createdAt: 40 }),
      arrival({ id: 'e', cardId: 'c2', reaction: 'flower', createdAt: 5 }),
    ]
    const seenAt = { c1: 15, c2: 100 }
    const full = applyWatermark(raw, seenAt)
    expect(mergeArrivals(collapseNewestPerKind(full))).toEqual(mergeArrivals(full))
  })

  it('随机 200 组数据上穷举：折叠前后合并结果始终相同', () => {
    // 固定种子的 LCG，保证失败可复现
    let seed = 20260825
    const rnd = (n: number) => (seed = (seed * 1103515245 + 12345) % 2147483648) % n

    for (let round = 0; round < 200; round++) {
      const rows: ReactionArrival[] = []
      const rowCount = 1 + rnd(12)
      for (let i = 0; i < rowCount; i++) {
        rows.push(
          arrival({
            id: `r${i}`,
            cardId: `c${rnd(3)}`,
            cardTitle: '豆豆',
            reaction: rnd(2) === 0 ? 'remember' : 'flower',
            createdAt: 1 + rnd(50),
          }),
        )
      }
      const seenAt: Record<string, number> = { c0: rnd(50), c1: rnd(50), c2: rnd(50) }
      const full = applyWatermark(rows, seenAt)
      expect(mergeArrivals(collapseNewestPerKind(full))).toEqual(mergeArrivals(full))
    }
  })

  it('🔴 前提反例：已读一旦不由水位派生（逐行各自已读），折叠就会把未读吞掉', () => {
    // 同一张卡同一类回应：老的没读、新的读过了。水位模型下这种组合不可能出现
    // （水位淹掉新的就必然淹掉老的），但逐行已读位可以。
    const full = [
      arrival({ id: 'old', cardId: 'c1', reaction: 'remember', createdAt: 10, read: false }),
      arrival({ id: 'new', cardId: 'c1', reaction: 'remember', createdAt: 20, read: true }),
    ]
    expect(mergeArrivals(full)[0].read).toBe(false) // 还有一条没看过 → 暖点该亮着
    expect(mergeArrivals(collapseNewestPerKind(full))[0].read).toBe(true) // 折叠后暖点灭了
    // 🔴 所以「折叠无损」这个结论**依赖已读是单调水位**。
    // 谁哪天改成逐行已读位，这条等价性就静默失效、未读会被悄悄吞掉。
  })
})

describe('offset 游标漂移在前端的表现', () => {
  it('漂移导致同一张卡在两页里各出现一次时，合并后仍然只有一条', () => {
    // 翻页途中新来回应会让卡的排序偏移，边界那张卡可能被下发两次。
    // 合并按 cardId 归并，🔴 重复这一侧天然被吸收，不会冒出第二条通知。
    const page1 = [arrival({ id: 'p1', cardId: 'c-edge', reaction: 'remember', createdAt: 10 })]
    const page2 = [arrival({ id: 'p2', cardId: 'c-edge', reaction: 'flower', createdAt: 8 })]
    const out = mergeArrivals([...page1, ...page2])
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('arrival:c-edge')
  })
})

describe('边界', () => {
  it('没有任何回应时返回空列表，而不是一条空通知', () => {
    expect(mergeArrivals([])).toEqual([])
  })

  it('卡改过名时标题跟最新那条走', () => {
    const [msg] = mergeArrivals([
      arrival({ id: 'a', createdAt: 1, cardTitle: '旧名字' }),
      arrival({ id: 'b', createdAt: 2, cardTitle: '新名字' }),
    ])
    expect(msg.preview).toContain('新名字')
    expect(msg.preview).not.toContain('旧名字')
  })
})
