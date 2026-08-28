import type { Message, ReactionArrival, ReactionKind } from '../types'

/**
 * 「被接住」的到达（`PRODUCT-MINDMAP §6.2 B20`）—— 把原始回应合并成消息中心里的通知。
 *
 * ⚠️ 编号消歧：是 `PRODUCT-MINDMAP §6.2` 的 `B20`，不是 `DECISIONS.md` 那条
 * 「暖意呈现＝双模式」的 `B20`。两者撞号但无关。
 *
 * 复用既有的「回声到达」那一套（`DECISIONS B21`/`B22`），🔴 **不新建第二套**：
 * 产物就是普通的 `Message`（`kind: 'system'` → 消息中心「回响」频道），
 * 点击按 `routeTo` 跳统一互动（`TC-10`），🔴 通知本身不自带任何互动界面。
 */

/** 合并后的到达消息 id 前缀。一张卡一条，所以 id 由 cardId 派生而不是由某条回应派生 */
const ARRIVAL_ID_PREFIX = 'arrival:'

/** 某条消息 id 是不是「被接住」的到达（`readMessages` 要据此把整卡的回应一起标已读） */
export function isArrivalId(messageId: string): boolean {
  return messageId.startsWith(ARRIVAL_ID_PREFIX)
}

/** 从合并后的消息 id 取回卡 id；不是到达消息则返回 null */
export function cardIdOfArrival(messageId: string): string | null {
  return isArrivalId(messageId) ? messageId.slice(ARRIVAL_ID_PREFIX.length) : null
}

/**
 * 一张卡上出现过哪些回应 → 一句不带数量的话。
 *
 * 🔴 **三种组合一律用「有人」，不区分单复数、不给任何数量线索。**
 * 中文的「有人」单复数通用，这一条红线因此可以靠**措辞本身**落实，
 * 而不需要先知道有几个人——所以上游连人数都不用传（见 `ReactionArrival` 的注释）。
 *
 * 🔴 反例（绝不允许写成这样）：「3 个人记得了它」「有 5 束心意」「又有 2 人来看过」。
 * 这与共鸣厅「不显热度与精确记得数」是同一条红线在消息侧的延伸。
 */
function previewOf(kinds: Set<ReactionKind>, cardTitle: string): string {
  const remembered = kinds.has('remember')
  const flowered = kinds.has('flower')
  if (remembered && flowered) return `有人记得了${cardTitle}，也有人留下了心意。`
  // ⚠️ 这里**不能写「一束心意」**，哪怕它更顺口、哪怕献花按钮就叫「留一束心意」。
  // 合并后这条可能代表很多人，「一束」既是数量表述、又把实际情况说小了——两头都错。
  if (flowered) return `有人在${cardTitle}那里，轻轻留下了心意。`
  return `有人记得了${cardTitle}。`
}

/**
 * 把原始回应合并成消息中心的到达通知。
 *
 * 🔴 **合并粒度按「卡」不按「人」**：同一张卡被多少人回应过都只出一条。
 * 不合并的话，一张卡热起来就会在消息列表里刷屏，而那正好撞上
 * 「柔性暖点、看过即散、绝不红点轰炸」——三条约束里的第 1 条会被第 3 条的缺失打穿。
 *
 * 🔴 **这一步刻意放在前端，而不是全指望服务端已经合并好。**
 * 服务端当然也该合（契约里会写），但「一张卡只出一条」是红线，
 * 而红线不该依赖上游实现正确：真后端某天多下发几行，用户立刻就被刷屏。
 * 这个函数是纯函数、有用例钉着，放在这里等于给红线上了第二道锁。
 *
 * 合并规则：
 *  · 时间取该卡**最新**一次回应（列表按时间倒序，热卡自然浮上来）；
 *  · 回应类型取并集（记得 / 献花 / 两者都有 → 三种措辞）；
 *  · 🔴 只要还有**任意一条**没读过，合并后的这条就算未读——
 *    读过一半就把暖点散掉，等于把没看过的回应悄悄吞了。
 */
export function mergeArrivals(arrivals: ReactionArrival[]): Message[] {
  const byCard = new Map<
    string,
    { cardTitle: string; kinds: Set<ReactionKind>; latest: number; anyUnread: boolean }
  >()

  for (const a of arrivals) {
    const cur = byCard.get(a.cardId)
    if (!cur) {
      byCard.set(a.cardId, {
        cardTitle: a.cardTitle,
        kinds: new Set([a.reaction]),
        latest: a.createdAt,
        anyUnread: !a.read,
      })
      continue
    }
    cur.kinds.add(a.reaction)
    cur.anyUnread = cur.anyUnread || !a.read
    if (a.createdAt > cur.latest) {
      cur.latest = a.createdAt
      // 标题跟着最新那条走：卡改过名时不至于一直显示旧名字
      cur.cardTitle = a.cardTitle
    }
  }

  return [...byCard.entries()]
    .map(([cardId, v]) => ({
      id: `${ARRIVAL_ID_PREFIX}${cardId}`,
      // 走既有的 system 类 →「回响」频道，复用 B22 的统一入口，不新开一类
      kind: 'system' as const,
      title: '温柔回响',
      preview: previewOf(v.kinds, v.cardTitle),
      createdAt: v.latest,
      read: !v.anyUnread,
      // 点击跳这张卡本身（TC-10：按 routeTo 跳统一互动，不自带第二套互动）。
      // ⚠️ 用既有的 'window' 而不是新造一个 'card'：`OM1` 的窗口/卡层级模型只登记了模型、
      // 🔴 明确未改接口，前端这边不抢跑造新枚举。
      routeTo: { type: 'window' as const, id: cardId },
    }))
    .sort((a, b) => b.createdAt - a.createdAt)
}
