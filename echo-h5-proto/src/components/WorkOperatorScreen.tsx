import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { WorkOperatorAction, WorkOperatorTab, WorkOperatorTicket } from '../types'

const TABS: { id: WorkOperatorTab; label: string }[] = [
  { id: 'pending', label: '待审' },
  { id: 'appealing', label: '申诉' },
  { id: 'public', label: '已公开' },
  { id: 'takendown', label: '已下架' },
]

interface Props {
  embedded?: boolean
}

/** 作品栏。单独打开或嵌在运营台里。 */
export default function WorkOperatorScreen({ embedded = false }: Props) {
  const [tab, setTab] = useState<WorkOperatorTab>('pending')
  const [items, setItems] = useState<WorkOperatorTicket[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  async function load(nextTab = tab, keep = false) {
    setError(null)
    if (!keep) setItems(null)
    try {
      setItems((await api.workOperatorQueue(nextTab)).items)
    } catch (e) {
      setItems([])
      setError(e instanceof ApiError ? e.message : '这一栏暂时看不了。')
    }
  }

  useEffect(() => {
    void load(tab)
    // 切 tab 才重拉；处置后自己再 load。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  async function act(
    item: WorkOperatorTicket,
    kind: WorkOperatorAction | 'uphold' | 'overturn',
  ) {
    if (busyId) return
    setBusyId(item.moderationId)
    setError(null)
    try {
      if (kind === 'uphold' || kind === 'overturn') {
        await api.handleWorkAppeal(item.moderationId, {
          action: kind,
          expectedStateVersion: item.stateVersion,
        })
      } else {
        await api.handleWorkModeration(item.moderationId, {
          action: kind,
          expectedStateVersion: item.stateVersion,
          reasonCode: kind === 'reject' || kind === 'takedown' ? 'policy' : undefined,
        })
      }
      await load(tab, true)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '没能处理完，刷新看看？')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className={embedded ? 'ops-queue' : 'works ops-queue'}>
      {!embedded && <div className="works-head">作品审核</div>}
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
          <p className="works-empty-sub">有人送来之后会排在这里。</p>
        </div>
      ) : (
        <ul className="ops-list">
          {items.map((item) => (
            <li key={item.moderationId} className="ops-item">
              <p className="wk-title">{item.workSnapshot?.title || '没有标题'}</p>
              <p className="wk-excerpt">{item.workSnapshot?.body || ''}</p>
              <p className="ops-meta">
                {statusLabel(item)} · {item.submitBy}
              </p>
              {item.appeal?.text && <p className="ops-appeal">{item.appeal.text}</p>}
              <div className="ops-actions">{actions(tab, item, busyId, act)}</div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function statusLabel(item: WorkOperatorTicket): string {
  if (item.workStatus === 'appealing') return '申诉中'
  if (item.workStatus === 'public' || item.state === 'approved') return '广场上'
  if (item.workStatus === 'takendown' || item.state === 'takendown') return '已下架'
  return '已提交'
}

function actions(
  tab: WorkOperatorTab,
  item: WorkOperatorTicket,
  busyId: string | null,
  act: (item: WorkOperatorTicket, kind: WorkOperatorAction | 'uphold' | 'overturn') => void,
) {
  const busy = busyId === item.moderationId
  if (tab === 'public') {
    return (
      <button type="button" className="ops-btn" disabled={busy} onClick={() => void act(item, 'takedown')}>
        先收起来
      </button>
    )
  }
  if (tab === 'takendown') {
    return (
      <button type="button" className="ops-btn primary" disabled={busy} onClick={() => void act(item, 'restore')}>
        再放回广场
      </button>
    )
  }
  if (tab === 'appealing') {
    return (
      <>
        <button type="button" className="ops-btn" disabled={busy} onClick={() => void act(item, 'uphold')}>
          维持原判
        </button>
        <button type="button" className="ops-btn primary" disabled={busy} onClick={() => void act(item, 'overturn')}>
          回到待审
        </button>
      </>
    )
  }
  return (
    <>
      <button type="button" className="ops-btn primary" disabled={busy} onClick={() => void act(item, 'approve')}>
        通过
      </button>
      <button type="button" className="ops-btn" disabled={busy} onClick={() => void act(item, 'reject')}>
        先不公开
      </button>
    </>
  )
}
