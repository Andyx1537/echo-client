import { useEffect, useState } from 'react'
import { api } from '../api'
import { reportWorkOpened } from '../api/phase0'
import { newIdempotencyKey } from '../api/authCredentialStore'
import type { Work, WorkComment, WorkCommentThread, WorkCommentsPage } from '../types'
import AiGeneratedBadge from './AiGeneratedBadge'
import { usePhoneLogin } from './PhoneLoginCoordinator'

interface Props {
  workId: string
  guest?: boolean
  onBack: () => void
  onIdentityChanged?: () => void
}

/** 从共鸣厅点进来的同一条作品。评论默认三加二；收藏不展示人数。 */
export default function WorkDetailScreen({ workId, guest = false, onBack, onIdentityChanged }: Props) {
  const [work, setWork] = useState<Work | null>(null)
  const [missing, setMissing] = useState(false)
  const [page, setPage] = useState<WorkCommentsPage | null>(null)
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const { login } = usePhoneLogin()

  async function ensureBound() {
    if (!guest) return true
    const outcome = await login({ intent: 'none' })
    if (!outcome) return false
    onIdentityChanged?.()
    return true
  }

  async function reload() {
    const [detail, comments] = await Promise.all([api.workDetail(workId), api.workComments(workId)])
    setWork(detail.work)
    setPage(comments)
  }

  useEffect(() => {
    let alive = true
    Promise.all([api.workDetail(workId), api.workComments(workId)])
      .then(([detail, comments]) => {
        if (!alive) return
        setWork(detail.work)
        setPage(comments)
        reportWorkOpened(detail.work)
      })
      .catch(() => {
        if (alive) setMissing(true)
      })
    return () => {
      alive = false
    }
  }, [workId, guest])

  async function toggleFavorite() {
    if (!(await ensureBound()) || !work) return
    const next = work.favorited ? await api.unfavoriteWork(work.id) : await api.favoriteWork(work.id)
    setWork({ ...work, favorited: next.favorited })
  }

  async function submitRoot() {
    if (!(await ensureBound()) || !draft.trim() || busy) return
    setBusy(true)
    try {
      await api.postWorkComment(workId, draft.trim(), newIdempotencyKey())
      setDraft('')
      await reload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wk-detail">
      <div className="works-head">
        <span className="works-head-left">
          <button className="back-btn small" onClick={onBack} aria-label="返回">
            ‹
          </button>
          作品
        </span>
        {work && (
          <button className="works-new" onClick={() => void toggleFavorite()}>
            {work.favorited ? '已收藏' : '收藏'}
          </button>
        )}
      </div>
      {missing ? (
        <p className="works-empty-sub">这个作品暂时看不到了。</p>
      ) : !work ? (
        <p className="plaza-loading">正在把这一件轻轻打开…</p>
      ) : (
        <article className="wk-detail-body">
          <div className="wk-detail-media">
            {work.mediaType === 'video' ? (
              <video src={work.mediaUrl} poster={work.posterUrl || undefined} controls playsInline />
            ) : (
              <img src={work.mediaUrl} alt="" />
            )}
            {work.aiGenerated && <AiGeneratedBadge variant="compact" className="wk-ai" />}
          </div>
          {work.title && <h1 className="wk-detail-title">{work.title}</h1>}
          <p className="wk-detail-text">{work.body || work.excerpt}</p>
          <section className="wk-comments">
            <h2>想说的话</h2>
            {page && <p className="wk-comments-count">{page.visibleCommentCount} 条在场</p>}
            <div className="wk-composer">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder={guest ? '绑定后可以留下一句' : '留一句给你看见的人'}
                onFocus={() => {
                  if (guest) void ensureBound()
                }}
              />
              <button disabled={busy || !draft.trim()} onClick={() => void submitRoot()}>
                送出
              </button>
            </div>
            {page?.items.map((thread) => (
              <Thread
                key={thread.comment.commentId}
                thread={thread}
                guest={guest}
                ensureBound={ensureBound}
                onChanged={reload}
              />
            ))}
          </section>
        </article>
      )}
    </div>
  )
}

function Thread({
  thread,
  guest,
  ensureBound,
  onChanged,
}: {
  thread: WorkCommentThread
  guest: boolean
  ensureBound: () => Promise<boolean>
  onChanged: () => Promise<void>
}) {
  const [replies, setReplies] = useState<WorkComment[]>(thread.previewReplies)
  const [remaining, setRemaining] = useState(thread.remainingReplyCount)
  const [replyTo, setReplyTo] = useState<WorkComment | null>(null)
  const [text, setText] = useState('')

  async function expand() {
    if (!(await ensureBound())) return
    const page = await api.commentReplies(thread.comment.commentId)
    setReplies(page.items)
    setRemaining(0)
  }

  async function send() {
    if (!(await ensureBound()) || !text.trim()) return
    await api.replyToComment((replyTo ?? thread.comment).commentId, text.trim(), newIdempotencyKey())
    setText('')
    setReplyTo(null)
    await onChanged()
  }

  return (
    <div className="wk-thread">
      <CommentLine comment={thread.comment} onReply={() => setReplyTo(thread.comment)} />
      {replies.map((item) => (
        <CommentLine key={item.commentId} comment={item} nested onReply={() => setReplyTo(item)} />
      ))}
      {remaining > 0 && (
        <button className="wk-expand" onClick={() => void expand()}>
          {guest ? `展开其余 ${remaining} 条回复` : `展开其余 ${remaining} 条回复`}
        </button>
      )}
      {replyTo && (
        <div className="wk-composer nested">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={`回复 ${replyTo.authorPublic.nickname}`}
          />
          <button onClick={() => void send()}>送出</button>
        </div>
      )}
    </div>
  )
}

function CommentLine({
  comment,
  nested,
  onReply,
}: {
  comment: WorkComment
  nested?: boolean
  onReply: () => void
}) {
  return (
    <div className={`wk-line${nested ? ' nested' : ''}`}>
      <b>{comment.authorPublic.nickname}</b>
      {comment.replyToLabel && <em>回复 {comment.replyToLabel}</em>}
      <p>{comment.body}</p>
      {comment.capabilities.canReply && (
        <button type="button" onClick={onReply}>
          回复
        </button>
      )}
    </div>
  )
}
