import type { Message, Paged } from '../types'
import { api } from './client'
import { mergeArrivals } from './arrivals'

/**
 * 消息中心的完整清单 = 既有三类消息 + 「被接住」的到达（合并后）。
 *
 * 🔴 **到达复用既有的消息结构，不新建第二套**（`DECISIONS B21`/`B22`）：
 * 合并出来的就是普通 `Message`（`kind: 'system'` →「回响」频道），
 * 点击照样走 `routeTo` 跳统一互动（`TC-10`），🔴 通知不自带任何互动界面。
 *
 * 收口在这里而不是各组件各拉一遍，是因为**未读暖点有两个消费方**
 * （底部导航的柔性点 + 消息列表），两边必须看到同一份清单——
 * 各拉各的迟早会出现「导航上有点、进去却没有新东西」。
 */
export async function loadInbox(): Promise<Message[]> {
  const empty: Paged<never> = { items: [], nextCursor: null }
  // 两路各自兜底：到达那一路挂了不该把整个消息中心一起拖黑，反之亦然
  //
  // ⚠️ 这里刻意只取**第一页**，两路的 `nextCursor` 都没有跟。服务端按「卡」翻页
  // （同一张卡的回应不会被切到两页去，见回执），所以少的是**更早的卡**、
  // 🔴 不会把一张卡劈成两条通知——红线不受影响。消息中心目前也没有下拉加载，
  // 真要接着翻，得连列表的滚动加载一起做。
  const [msgs, arrivals] = await Promise.all([
    api.messages().catch(() => empty),
    api.reactionArrivals().catch(() => empty),
  ])
  return [...msgs.items, ...mergeArrivals(arrivals.items)].sort(
    (a, b) => b.createdAt - a.createdAt,
  )
}

/**
 * 是否要点亮那颗柔性暖点（`DECISIONS B23`）。
 *
 * 🔴 **返回布尔，永远不返回条数。** 未读「几条」这个数一旦被算出来，
 * 就离渲染成红点上的数字只差一步——而 `B23` 要的是**不带数字、看过即散**。
 */
export function hasUnread(items: Message[]): boolean {
  return items.some((m) => !m.read)
}
