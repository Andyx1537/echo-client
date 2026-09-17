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

  async function act(item: CardOperatorTicket, kind: 'approve' | 'reject' | 'uphold' | 'overturn' | 'takedown') {
    if (busyId) return
    setBusyId(item.moderationId)
    setError(null)
    try {
      if (kind === 'uphold' || kind === 'overturn') {
        await api.handleCardAppeal(item.moderationId, kind)
      } else {
        await api.handleCardModeration(
          item.moderationId,
          kind,
          kind === 'reject' || kind === 'takedown' ? 'policy' : undefined,
        )
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
                {cardStatusLabel(item)}
                {item.originType === 'official' ? ' · 官方号' : ''}
                {item.appeal?.appealAt ? ' · 已申诉' : ''}
                {' · '}{item.submitBy}
              </p>
              {item.appeal?.text && <p className="ops-appeal">{item.appeal.text}</p>}
              <CardActions tab={tab} item={item} busyId={busyId} onAct={act} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function cardStatusLabel(item: CardOperatorTicket): string {
  if (item.cardStatus === 'appealing') return '申诉中'
  if (item.cardStatus === 'public') return '已公开'
  if (item.cardStatus === 'takendown') return '已下架'
  if (item.cardStatus === 'rejected') return '未公开'
  return '已提交'
}

function CardActions({
  tab,
  item,
  busyId,
  onAct,
}: {
  tab: CardOperatorTab
  item: CardOperatorTicket
  busyId: string | null
  onAct: (item: CardOperatorTicket, kind: 'approve' | 'reject' | 'uphold' | 'overturn' | 'takedown') => void
}) {
  const busy = busyId === item.moderationId
  if (tab === 'handled') {
    if (item.cardStatus !== 'public') return null
    return (
      <div className="ops-actions">
        <button type="button" className="ops-btn" disabled={busy} onClick={() => void onAct(item, 'takedown')}>
          先收起来
        </button>
      </div>
    )
  }
  if (tab === 'appealing') {
    return (
      <div className="ops-actions">
        <button type="button" className="ops-btn" disabled={busy} onClick={() => void onAct(item, 'uphold')}>
          维持原判
        </button>
        <button type="button" className="ops-btn primary" disabled={busy} onClick={() => void onAct(item, 'overturn')}>
          回到待审
        </button>
      </div>
    )
  }
  return (
    <div className="ops-actions">
      <button type="button" className="ops-btn primary" disabled={busy} onClick={() => void onAct(item, 'approve')}>
        通过
      </button>
      <button type="button" className="ops-btn" disabled={busy} onClick={() => void onAct(item, 'reject')}>
        先不公开
      </button>
    </div>
  )
}
