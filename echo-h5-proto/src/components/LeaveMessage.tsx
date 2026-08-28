import { useState } from 'react'
import { api, ApiError, track } from '../api'
import type { CardId } from '../lib/ids'

interface Props {
  /** 🔴 留言挂在 `/cards/:cardId/messages`，与 `/windows/:petId/flower|remember` 不是一套键 */
  cardId: CardId
}

/** 最长 60 字（`PRD-RESONANCE-INTERACTION-PALETTE §56`） */
const MAX_LEN = 60

/**
 * 起笔（`PALETTE §56`）：给一句现成的开头，让不知道说什么的人也能开口。
 * 点一下把它填进输入框，仍可继续改——不是模板发送，是**起笔**。
 */
const OPENERS = ['谢谢你留下它', '我也被这个瞬间触动']

/**
 * `C1 留一句话`（访客侧） · 裁定 `DECISIONS S13` · 规格 `PALETTE §56`。
 *
 * 🔴 **是否呈现由服务端开关决定，判定在调用方**（`DetailScreen` 读 `useFeatureFlags()`）。
 * 本组件被渲染出来就意味着开关是开的；🔴 组件内部**不再自己判一次**，
 * 更不读环境变量——两处判定早晚会飘开，而飘开的方向必然是「本该关着的地方开着」。
 *
 * 规格里的三条「没有」，都是靠**不写**来实现的，别当成待办：
 *  · **无楼中楼** —— 这里只有一个输入框，没有对某条留言回复的入口；
 *  · **无 @** —— 不做 mention 解析，输入的 @ 就是普通字符；
 *  · **无公开拒绝通知** —— 见下方 `flashDone()` 的注释。
 */
export default function LeaveMessage({ cardId }: Props) {
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [failed, setFailed] = useState<string | null>(null)

  const trimmed = text.trim()
  const canSend = trimmed.length > 0 && !sending

  async function send() {
    if (!canSend) return
    setSending(true)
    setFailed(null)
    try {
      await api.leaveMessage(cardId, trimmed)
      track('leave_message', { windowId: cardId })
      setText('')
      setDone(true)
    } catch (e) {
      // 只说「没送出去、可以再试」，并把原文留在框里。
      // ⚠️ 这是**发送失败**，与作者的处理结果无关——后者永远不会走到这里。
      setFailed(e instanceof ApiError ? e.message : '这句话没能送出去，待会儿再试一次吧')
    } finally {
      setSending(false)
    }
  }

  if (done) {
    return (
      <div className="lm-block">
        <h2 className="section-title">🍃 留一句话</h2>
        {/*
          🔴 `PALETTE I-05`：**绝不显示「被拒绝」**。
          所以这里只说「送到了」，不说「已被收下」——收不收下是作者的三选一，此刻还没发生。
          🔴 也**不给任何后续状态**：没有「查看我的留言」，没有「处理中」，没有小红点。
          只要留下一个能查状态的钩子，「被拒绝」就迟早会以某种形式被读出来。
        */}
        <p className="lm-done">你的话已经轻轻放在这里了 🌿</p>
      </div>
    )
  }

  return (
    <div className="lm-block">
      <h2 className="section-title">🍃 留一句话</h2>
      <div className="lm-openers">
        {OPENERS.map((o) => (
          <button
            key={o}
            type="button"
            className="lm-opener"
            onClick={() => setText(o)}
            disabled={sending}
          >
            {o}
          </button>
        ))}
      </div>
      <textarea
        className="lm-input"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_LEN))}
        maxLength={MAX_LEN}
        rows={3}
        placeholder="说点什么都好，一句就够"
        disabled={sending}
      />
      <div className="lm-foot">
        <span className="lm-count">
          {trimmed.length} / {MAX_LEN}
        </span>
        <button type="button" className="lm-send" onClick={send} disabled={!canSend}>
          {sending ? '正在送过去…' : '轻轻放下'}
        </button>
      </div>
      {failed && <p className="lm-failed">{failed}</p>}
      {/* 说清楚「作者会看到、由 ta 决定留不留」，别让人以为发出去就一定会公开 */}
      <p className="lm-note">这句话会先交给 ta，由 ta 决定要不要留下。</p>
    </div>
  )
}
