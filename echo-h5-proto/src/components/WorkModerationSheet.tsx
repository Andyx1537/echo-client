import { useEffect, useState } from 'react'
import { api } from '../api'
import { ApiError } from '../api'
import type { Work, WorkModeration } from '../types'

interface Props {
  work: Work
  onClose: () => void
  onAppealed: (workId: string) => void
}

/** 作者看驳回/下架理由，可申时才出输入。入口是否可申只信这一页的回执。 */
export default function WorkModerationSheet({ work, onClose, onAppealed }: Props) {
  const [info, setInfo] = useState<WorkModeration | null>(null)
  const [missing, setMissing] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api.workModeration(work.id)
      .then((data) => {
        if (!alive) return
        setInfo(data)
      })
      .catch(() => {
        if (alive) setMissing(true)
      })
    return () => {
      alive = false
    }
  }, [work.id])

  async function submit() {
    const trimmed = text.trim()
    if (!trimmed || busy || !info?.appealable) return
    setBusy(true)
    setError(null)
    try {
      const result = await api.appealWork(work.id, trimmed)
      setInfo({
        ...info,
        status: 'appealing',
        appealable: false,
        appealUsed: true,
        appeal: { appealId: result.appealId, text: trimmed, appealAt: result.createdAt },
      })
      onAppealed(work.id)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : '没能发出去，再试一次？')
    } finally {
      setBusy(false)
    }
  }

  const count = text.length
  const tooLong = count > 200

  return (
    <div className="works wk-moderation">
      <div className="works-head">
        <span className="works-head-left">
          <button className="back-btn small" onClick={onClose} aria-label="返回">
            ‹
          </button>
          看看为什么
        </span>
      </div>
      {missing ? (
        <p className="works-empty-sub">这条现在看不到审核说明。</p>
      ) : !info ? (
        <p className="plaza-loading">正在把说明取过来…</p>
      ) : (
        <div className="wk-moderation-body">
          {work.title && <p className="wk-title">{work.title}</p>}
          {info.reasonText && <p className="wk-moderation-reason">{info.reasonText}</p>}
          {!info.reasonText && (
            <p className="wk-moderation-reason">这一条我们看过了，暂时还不能公开。</p>
          )}
          {info.appealable ? (
            <>
              <label className="pub-field">
                <span className="pub-label">
                  想再说一句
                  <em className="pub-count">{count}/200</em>
                </span>
                <textarea
                  className="pub-textarea"
                  rows={5}
                  maxLength={200}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="我们会再看一次。一条作品只能说这一次。"
                />
              </label>
              {error && <p className="wk-moderation-error">{error}</p>}
              <button
                className="pub-submit"
                disabled={busy || !text.trim() || tooLong}
                onClick={() => void submit()}
              >
                {busy ? '正在送出…' : '说这一次'}
              </button>
            </>
          ) : info.appealUsed || work.status === 'appealing' ? (
            <p className="wk-moderation-used">
              {info.appeal?.text
                ? `你说过：${info.appeal.text}`
                : '这条已经说过一次了，我们会认真看的。'}
            </p>
          ) : null}
        </div>
      )}
    </div>
  )
}
