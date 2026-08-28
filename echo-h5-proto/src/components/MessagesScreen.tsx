import { useEffect, useState } from 'react'
import type { Message } from '../types'
import { api, loadInbox } from '../api'

interface Props {
  /** 点击消息按 routeTo 跳转到统一互动系统（消息本身不自带互动，§2.14） */
  onRoute: (routeTo: Message['routeTo']) => void
  /**
   * 这一屏被看过了 →「看过即散」（`DECISIONS B23`），把底部导航那颗柔性暖点散掉。
   * 🔴 散的依据是**看过消息中心**，不是「逐条点开」——否则那颗点会一直挂着，
   * 而 `B23` 的原话是「看过即散」，不是「读完每一条才散」。
   */
  onSeen?: () => void
}

type Channel = 'all' | 'friend' | 'pet' | 'system'

const CHANNELS: Array<{ key: Channel; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'friend', label: '亲友' },
  { key: 'pet', label: '来自它' },
  { key: 'system', label: '回响' },
]

const KIND_META: Record<Message['kind'], { icon: string; tag: string }> = {
  friend: { icon: '🫂', tag: '亲友' },
  pet: { icon: '🐾', tag: '来自它' },
  system: { icon: '🕯️', tag: '温柔回响' },
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const h = Math.floor(diff / 3600000)
  if (h < 1) return '刚刚'
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

/** 消息 = 克制的集散地：三类（亲友/系统/宠物更新），点击按 routeTo 跳统一互动 */
export default function MessagesScreen({ onRoute, onSeen }: Props) {
  const [items, setItems] = useState<Message[]>([])
  const [channel, setChannel] = useState<Channel>('all')
  /**
   * 🔴 **在途必须与「真的没有消息」分开。**
   * 少了这个标志位，首帧 `items` 还是空数组，列表会先闪一下
   * 「这里很安静，没有新的消息打扰你。」——扫一眼就走的人会当真。
   * 空态是一句结论，🔴 **没拿到数据之前不许下这个结论**。
   */
  const [loading, setLoading] = useState(true)
  /** 读失败同理：拿不到 ≠ 没有，说成「很安静」是另一种谎 */
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let alive = true
    // 三类消息 +「被接住」的到达（已按卡合并），收口在 loadInbox
    loadInbox()
      .then((list) => alive && setItems(list))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // 看过即散（B23）：进到这一屏就把暖点散掉，不等用户逐条点开
  useEffect(() => {
    onSeen?.()
  }, [onSeen])

  const list = channel === 'all' ? items : items.filter((m) => m.kind === channel)

  async function open(m: Message) {
    if (!m.read) {
      setItems((cur) => cur.map((x) => (x.id === m.id ? { ...x, read: true } : x)))
      api.readMessages([m.id]).catch(() => {})
    }
    onRoute(m.routeTo)
  }

  return (
    <div className="messages">
      <div className="msg-head">
        <h1 className="msg-title">消息</h1>
        <p className="msg-sub">安静的中枢 · 只露出更新，点开就进去看看</p>
      </div>

      <div className="msg-channels">
        {CHANNELS.map((c) => (
          <button
            key={c.key}
            className={`msg-channel ${channel === c.key ? 'on' : ''}`}
            onClick={() => setChannel(c.key)}
          >
            {c.label}
          </button>
        ))}
      </div>

      <div className="msg-list">
        {/* 三态分清楚：在途 / 读失败 / 真的没有。🔴 前两种都不许说「很安静」 */}
        {loading ? (
          <p className="msg-loading">正在把消息轻轻拢过来…</p>
        ) : failed ? (
          <p className="msg-empty">消息没能读过来，待会儿再看看吧。</p>
        ) : list.length === 0 ? (
          <p className="msg-empty">这里很安静，没有新的消息打扰你。</p>
        ) : (
          list.map((m) => {
            const meta = KIND_META[m.kind]
            return (
              <button key={m.id} className={`msg-item ${m.read ? '' : 'unread'}`} onClick={() => open(m)}>
                <span className="msg-ico">{meta.icon}</span>
                <div className="msg-body">
                  <div className="msg-item-top">
                    <span className="msg-item-title">{m.title}</span>
                    <span className="msg-tag">{meta.tag}</span>
                  </div>
                  <p className="msg-preview">{m.preview}</p>
                </div>
                <div className="msg-right">
                  <span className="msg-time">{relTime(m.createdAt)}</span>
                  {!m.read && <span className="msg-dot" />}
                </div>
              </button>
            )
          })
        )}
      </div>
    </div>
  )
}
