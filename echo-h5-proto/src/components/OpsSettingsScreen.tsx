import { useEffect, useState } from 'react'
import { api, ApiError } from '../api'
import type { ModerationMode, ModerationSettings } from '../types'

export default function OpsSettingsScreen() {
  const [data, setData] = useState<ModerationSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function load() {
    setError(null)
    try {
      setData(await api.moderationSettings())
    } catch (e) {
      setData(null)
      setError(e instanceof ApiError ? e.message : '这一栏暂时看不了。')
    }
  }

  useEffect(() => {
    void load()
  }, [])

  async function save(mode: ModerationMode) {
    if (busy || data?.mode === mode) return
    setBusy(true)
    setError(null)
    try {
      setData(await api.updateModerationSettings(mode))
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '没能改成，刷新看看？')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ops-queue">
      {error && <p className="wk-moderation-error ops-error">{error}</p>}
      {!data && !error ? (
        <p className="plaza-loading">正在把当前档取过来…</p>
      ) : data ? (
        <div className="ops-item" style={{ margin: '0 14px 28px' }}>
          <p className="wk-title">新内容怎么进公开层</p>
          <p className="wk-excerpt">只影响之后送来的。已经公开的不会被翻案。</p>
          <div className="ops-actions">
            <button
              type="button"
              className={data.mode === 'review_first' ? 'ops-btn primary' : 'ops-btn'}
              disabled={busy}
              onClick={() => void save('review_first')}
            >
              先审后发
            </button>
            <button
              type="button"
              className={data.mode === 'publish_first' ? 'ops-btn primary' : 'ops-btn'}
              disabled={busy}
              onClick={() => void save('publish_first')}
            >
              先发后审
            </button>
          </div>
          <p className="ops-meta">
            {data.updatedAt ? `上次改于 ${new Date(data.updatedAt).toLocaleString()}` : '还没改过，默认先审后发'}
          </p>
        </div>
      ) : null}
    </div>
  )
}
