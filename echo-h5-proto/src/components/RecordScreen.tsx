import { useEffect, useState } from 'react'
import type { RecordItem } from '../types'
import { api, track } from '../api'
import CoverPlaceholder from './CoverPlaceholder'

type Scope = 'pet' | 'self'

/** 温柔提问引导（邀请式，可选，绝不是打卡任务） */
const PROMPTS: Record<Scope, string[]> = {
  pet: [
    '今天有什么想对它说的？',
    '你们之间，最近让你想起的一个瞬间？',
    '它最喜欢的那个地方，今天是什么样子？',
    '有空就来，随手记下想它的一刻。',
  ],
  self: [
    '今天有没有为自己做的一件小事？',
    '此刻的心情，想留一句吗？',
    '这一周，你悄悄跨过的一个小坎？',
    '想对未来的自己说点什么？',
  ],
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const h = Math.floor(diff / 3600000)
  if (h < 1) return '刚刚'
  if (h < 24) return `${h} 小时前`
  const d = Math.floor(h / 24)
  return `${d} 天前`
}

/** 记录页（§2.14 双向）：给它 / 给自己；freeform + 可选温柔提问；无连续天数/无红点 */
export default function RecordScreen() {
  const [scope, setScope] = useState<Scope>('pet')
  const [text, setText] = useState('')
  const [items, setItems] = useState<RecordItem[]>([])
  const [busy, setBusy] = useState(false)
  const [promptIdx, setPromptIdx] = useState(0)

  useEffect(() => {
    let alive = true
    // 分页信封（QA M-2）：取 .items，勿把响应当数组
    api.records(scope).then((res) => alive && setItems(res.items)).catch(() => {})
    setPromptIdx(Math.floor(Math.random() * PROMPTS[scope].length))
    return () => {
      alive = false
    }
  }, [scope])

  async function submit() {
    const t = text.trim()
    if (!t || busy) return
    setBusy(true)
    try {
      const rec = await api.createRecord({ scope, text: t })
      track('record_create', { scope })
      setItems((cur) => [rec, ...cur])
      setText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="record">
      <div className="rec-head">
        <h1 className="rec-title">记录</h1>
        <p className="rec-sub">想写就写，不必每天来 · 这里没有打卡</p>
      </div>

      <div className="rec-tabs">
        <button className={`rec-tab ${scope === 'pet' ? 'on' : ''}`} onClick={() => setScope('pet')}>
          给它
        </button>
        <button className={`rec-tab ${scope === 'self' ? 'on' : ''}`} onClick={() => setScope('self')}>
          给自己
        </button>
      </div>

      <div className="rec-composer">
        <button
          className="rec-prompt"
          onClick={() => {
            const list = PROMPTS[scope]
            const next = (promptIdx + 1) % list.length
            setPromptIdx(next)
            if (!text.trim()) setText('')
          }}
        >
          💡 {PROMPTS[scope][promptIdx]}
          <span className="rec-prompt-swap">换一个</span>
        </button>
        <textarea
          className="rec-textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={scope === 'pet' ? '写给它的一笔…' : '写给自己的一笔…'}
          maxLength={200}
          rows={3}
        />
        <div className="rec-composer-foot">
          <span className="rec-count">{text.length}/200</span>
          <button className="rec-submit" onClick={submit} disabled={busy || !text.trim()}>
            {busy ? '收下中…' : '留一笔'}
          </button>
        </div>
      </div>

      <div className="rec-list">
        {items.length === 0 ? (
          <p className="rec-empty">
            这里还空着，等你放进第一段{scope === 'pet' ? '想它的话' : '写给自己的话'}。
          </p>
        ) : (
          items.map((r) => (
            <div key={r.id} className="rec-item">
              {/* 记录缩略图只有 46px，角标出短标 */}
              {r.placeholder && (
                <CoverPlaceholder data={r.placeholder} className="rec-thumb" aiBadge="compact" />
              )}
              <div className="rec-item-body">
                <p className="rec-item-text">{r.text}</p>
                <span className="rec-item-time">{relTime(r.createdAt)}</span>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
