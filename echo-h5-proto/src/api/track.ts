// 轻量埋点（契约 §13）。
// 先 console 输出 + 可选上报端点（VITE_TRACK_ENDPOINT）；覆盖漏斗关键事件。
// 每事件带：accountId(匿名)、isGuest、ts、ctx。

import { getSession } from './session'

/** 契约 §13 事件清单 */
export type TrackEvent =
  | 'guest_created'
  | 'onboarding_start'
  | 'onboarding_refine'
  | 'onboarding_confirm'
  | 'onboarding_media_analyze'
  | 'onboarding_detect'
  // 🔴 只报来源（machine/user/default）与改没改过机器原判，**不报用户选了哪一类**——
  // 埋点侧攒出一份主体类型画像，与「不暴露主体识别结果」是同一条红线的反面。
  | 'onboarding_subject'
  | 'onboarding_voice'
  | 'pet_visit'
  | 'echo_view'
  | 'echo_reply'
  // —— 回声「换一批」（B7 / TC-23）：只记换了没换与是否用尽，不记内容 ——
  | 'echo_reroll'
  | 'echo_reroll_limit'
  | 'flower_offer'
  | 'remember_toggle'
  | 'window_seen'
  | 'window_open'
  // —— 进窗后连续下翻（D21 / TC-13）：翻页由手势驱动，仅记方向/续页/到底 ——
  | 'window_feed_next'
  | 'window_feed_prev'
  | 'window_feed_page'
  | 'window_feed_end'
  | 'postcard_unlock'
  | 'shop_purchase'
  | 'share_click'
  | 'record_create'
  | 'spectrum_anchor'
  | 'spectrum_integrate'
  | 'bind_account'
  // —— 搜索页（附录 A.6，可拆维度、不聚合公开榜）——
  | 'search_open'
  | 'search_query'
  | 'search_result_click'
  | 'search_history_clear'
  | 'search_hot_click'
  | 'search_view_all'
  | 'search_history_click'
  | 'search_history_delete_single'
  // —— 他人主页 / 关注（PRD-RESONANCE-PUBLISHING R7 · E1b）——
  // 🔴 前缀 follow_*：这是人与人的关系。付费会员的埋点走 sub_*，两套永不混用，
  // 否则关系互动量会和营收口径搅在一起。
  // 🔴 只记单账号维度的事件，绝不聚合成任何「谁粉丝最多」的公开榜（DECISIONS D14 未被推翻）。
  | 'user_profile_open'
  | 'follow_author'
  | 'unfollow_author'
  // —— C1 留一句话（DECISIONS S13 · PALETTE §56）——
  // 🔴 只记「留了一句 / 作者做了哪种处理」，绝不记留言正文——内容审核走服务端审核队列，
  // 埋点管道不是内容通道，把正文带进来等于多开一个没人审的内容出口。
  // 🔴 `message_disposition` 只上报 publish/private/drop 三选一的枚举值，
  // 且**绝不据此向留言者派生任何通知**（`PALETTE I-05`：绝不显示「被拒绝」）。
  // ⚠️ 开关关闭期间这两个事件恒为 0，但深共鸣率必须显示「无数据」而不是 0（`S13 ③`）——
  // 那是看板侧的口径，别在这里补一个假的 0 上去。
  | 'leave_message'
  | 'message_disposition'

const ENDPOINT = import.meta.env.VITE_TRACK_ENDPOINT as string | undefined

/** 记录一个埋点事件 */
export function track(event: TrackEvent, ctx: Record<string, unknown> = {}): void {
  const session = getSession()
  const payload = {
    event,
    accountId: session?.accountId ?? 'anon',
    isGuest: session?.isGuest ?? true,
    ts: Date.now(),
    ctx,
  }

  // 开发期可视化漏斗
  // eslint-disable-next-line no-console
  console.info('[track]', event, payload)

  // 可选上报（配置了端点才发；失败静默，不打扰用户）
  if (ENDPOINT) {
    try {
      const body = JSON.stringify(payload)
      if (navigator.sendBeacon) {
        navigator.sendBeacon(ENDPOINT, body)
      } else {
        void fetch(ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          keepalive: true,
        }).catch(() => {})
      }
    } catch {
      // 埋点失败绝不影响主流程
    }
  }
}
