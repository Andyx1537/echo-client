import { useEffect, useState } from 'react'
import { DISPOSITION_LABELS, type MessageDisposition, type PendingMessage } from '../types'
import { api, track } from '../api'
import type { CardId } from '../lib/ids'

interface Props {
  /** 🔴 同 `LeaveMessage`：留言这一组端点收的是 cardId，不是 petId */
  cardId: CardId
  /** 作者把一条留言「收下公开」了 → 让详情页重取，好让它出现在温柔的回声里 */
  onPublished?: () => void
}

/** 三选一的呈现顺序：从「最愿意」到「不留」，措辞与 `DISPOSITION_LABELS` 同源 */
const ACTIONS: MessageDisposition[] = ['publish', 'private', 'drop']

/**
 * `C1 留一句话`（作者侧三选一） · 裁定 `DECISIONS S13` · 规格 `PALETTE §56`。
 *
 * 🔴 是否呈现由服务端开关决定，判定在调用方（`DetailScreen`）；本组件不自己判。
 *
 * 🔴 **三个动作是「收下公开 / 只自己看 / 不留」**，用词照规格原文：
 * 第三项叫「**不留**」，不是「不收」、不是「拒绝」、不是「删除」。
 * 差别不只在礼貌：作者点的那一下如果叫「拒绝」，界面下一步就很难不去通知对方，
 * 而 `PALETTE I-05` 要求 🔴 **绝不显示「被拒绝」**。所以这个词从这里就得对。
 *
 * 🔴 三个动作对留言者**一视同仁地静默**：不通知、不回执、不留痕，「不留」也不例外。
 * 作者这边也只给一句极轻的确认，不做「已拒绝 1 条」这类计数——那是拒绝语义的回流。
 */
export default function MessageTriage({ cardId, onPublished }: Props) {
  const [items, setItems] = useState<PendingMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    api
      .pendingMessages(cardId)
      .then((p) => alive && setItems(p.items))
      .catch(() => alive && setItems([]))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [cardId])

  async function resolve(msg: PendingMessage, disposition: MessageDisposition) {
    if (busyId) return
    setBusyId(msg.id)
    try {
      await api.resolveMessage(msg.id, disposition)
      track('message_disposition', { windowId: cardId, disposition })
      setItems((cur) => cur.filter((m) => m.id !== msg.id))
      if (disposition === 'publish') onPublished?.()
    } catch {
      /* 处理失败就把这条留在列表里，作者可以再点一次；不弹技术错误 */
    } finally {
      setBusyId(null)
    }
  }

  // 🔴 没有待处理留言时整块不呈现。
  // 「暂无新留言」这类空态看着无害，但它每天都在提醒作者「今天没有人来」——
  // 一个只在有内容时才出现的区块，比一个长期空着的区块温柔得多。
  if (loading || items.length === 0) return null

  return (
    <div className="mt-block">
      <h2 className="section-title">🍃 有人给你留了话</h2>
      <p className="mt-note">留不留、公不公开，都由你决定。对方不会知道你怎么选。</p>
      <div className="mt-list">
        {items.map((m) => (
          <div key={m.id} className="mt-item">
            <div className="mt-head">
              <span className="mt-avatar" style={{ background: m.authorAvatar }} />
              <span className="mt-name">{m.authorName}</span>
              <span className="mt-time">{m.time}</span>
            </div>
            <p className="mt-text">{m.text}</p>
            <div className="mt-actions">
              {ACTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  className={`mt-action ${a}`}
                  onClick={() => resolve(m, a)}
                  disabled={busyId === m.id}
                >
                  {DISPOSITION_LABELS[a]}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
