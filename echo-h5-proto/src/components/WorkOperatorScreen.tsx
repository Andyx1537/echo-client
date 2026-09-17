import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { WorkOperatorTab, WorkOperatorTicket } from '../types'

/** 运营作品台。入口 `?ops=works`，不进 C 端底栏。 */
export default function WorkOperatorScreen() {
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

  async function act(item: WorkOperatorTicket, kind: 'approve' | 'reject' | 'uphold' | 'overturn') {
    if (busyId) return
    setBusyId(item.moderationId)
    setError(null)
    try {
      if (kind === 'approve' || kind === 'reject') {
        await api.handleWorkModeration(item.moderationId, {
          action: kind,
          expectedStateVersion: item.stateVersion,
          reasonCode: kind === 'reject' ? 'policy' : undefined,
        })
      } else {
        await api.handleWorkAppeal(item.moderationId, {
          action: kind,
          expectedStateVersion: item.stateVersion,
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
    <div className="works ops-queue">
      <div className="works-head">作品审核</div>
      <div className="ops-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'pending'}
          className={tab === 'pending' ? 'ops-tab on' : 'ops-tab'}
          onClick={() => setTab('pending')}
        >
          待审
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'appealing'}
          className={tab === 'appealing' ? 'ops-tab on' : 'ops-tab'}
          onClick={() => setTab('appealing')}
        >
          申诉
        </button>
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
                {item.workStatus === 'appealing' ? '申诉中' : '已提交'} · {item.submitBy}
              </p>
              {item.appeal?.text && <p className="ops-appeal">{item.appeal.text}</p>}
              <div className="ops-actions">
                {tab === 'pending' ? (
                  <>
                    <button
                      type="button"
                      className="ops-btn primary"
                      disabled={busyId === item.moderationId}
                      onClick={() => void act(item, 'approve')}
                    >
                      通过
                    </button>
                    <button
                      type="button"
                      className="ops-btn"
                      disabled={busyId === item.moderationId}
                      onClick={() => void act(item, 'reject')}
                    >
                      先不公开
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      className="ops-btn"
                      disabled={busyId === item.moderationId}
                      onClick={() => void act(item, 'uphold')}
                    >
                      维持原判
                    </button>
                    <button
                      type="button"
                      className="ops-btn primary"
                      disabled={busyId === item.moderationId}
                      onClick={() => void act(item, 'overturn')}
                    >
                      回到待审
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
