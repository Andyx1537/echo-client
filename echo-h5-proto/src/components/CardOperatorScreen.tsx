import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { CardOperatorTab, CardOperatorTicket } from '../types'

const TABS: { id: CardOperatorTab; label: string }[] = [
  { id: 'pending', label: '待审' },
  { id: 'appealing', label: '申诉' },
  { id: 'handled', label: '已处置' },
]

export default function CardOperatorScreen() {
  const [tab, setTab] = useState<CardOperatorTab>('pending')
  const [items, setItems] = useState<CardOperatorTicket[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load(nextTab = tab, keep = false) {
    setError(null)
    if (!keep) setItems(null)
    try {
      setItems((await api.cardOperatorQueue(nextTab)).items)
    } catch (e) {
      setItems([])
      setError(e instanceof ApiError ? e.message : '这一栏暂时看不了。')
    }
  }

  useEffect(() => {
    void load(tab)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function act(item: CardOperatorTicket, kind: 'approve' | 'reject' | 'uphold' | 'overturn') {
    if (busyId) return
    setBusyId(item.moderationId)
    setError(null)
    try {
      if (kind === 'uphold' || kind === 'overturn') {
        await api.handleCardAppeal(item.moderationId, kind)
      } else {
        await api.handleCardModeration(item.moderationId, kind, kind === 'reject' ? 'policy' : undefined)
      }
      await load(tab, true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '没能处理完，刷新看看？')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="ops-queue">
      <div className="ops-tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={tab === item.id ? 'ops-tab on' : 'ops-tab'}
            onClick={() => {
              setItems(null)
              setTab(item.id)
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {error && <p className="wk-moderation-error ops-error">{error}</p>}
      {items == null ? (
        <p className="plaza-loading">正在把队列取过来…</p>
      ) : items.length === 0 ? (
        <div className="works-empty">
          <p className="works-empty-title">这一栏现在是空的。</p>
          <p className="works-empty-sub">有卡送来之后会排在这里。</p>
        </div>
      ) : (
        <ul className="ops-list">
          {items.map((item) => (
            <li key={item.moderationId} className="ops-item">
              <p className="wk-title">{item.cardSnapshot?.title || '没有标题'}</p>
              <p className="wk-excerpt">{item.cardSnapshot?.body || ''}</p>
              <p className="ops-meta">
                {item.cardStatus === 'appealing' ? '申诉中' : item.cardStatus === 'public' ? '已公开' : '已提交'}
                {item.originType === 'official' ? ' · 官方号' : ''}
                {item.appeal?.appealAt ? ' · 已申诉' : ''}
                {' · '}{item.submitBy}
              </p>
              {item.appeal?.text && <p className="ops-appeal">{item.appeal.text}</p>}
              {tab !== 'handled' && (
                <div className="ops-actions">
                  {tab === 'pending' ? (
                    <>
                      <button type="button" className="ops-btn primary" disabled={busyId === item.moderationId} onClick={() => void act(item, 'approve')}>通过</button>
                      <button type="button" className="ops-btn" disabled={busyId === item.moderationId} onClick={() => void act(item, 'reject')}>先不公开</button>
                    </>
                  ) : (
                    <>
                      <button type="button" className="ops-btn" disabled={busyId === item.moderationId} onClick={() => void act(item, 'uphold')}>维持原判</button>
                      <button type="button" className="ops-btn primary" disabled={busyId === item.moderationId} onClick={() => void act(item, 'overturn')}>回到待审</button>
                    </>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
