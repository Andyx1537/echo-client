import { useEffect, useState } from 'react'
import type React from 'react'
import { api } from '../api'
import type { SubmissionCapability, Work } from '../types'
import { canSubmitWork, submissionWaitCopy } from '../lib/workSubmission'
import WorkCard from './WorkCard'
import WorkModerationSheet from './WorkModerationSheet'

/**
 * 作品瀑布 / 个人作品页。同一个组件两种用法，由 `authorId` 区分。
 *
 * 全站公开流走 {@code GET /plaza}，不再走旧的 {@code GET /works} 第二套瀑布。
 */

interface Props {
  /** 传了就是个人作品页；不传是全站瀑布 */
  authorId?: string
  /** 个人作品页且是本人时为 true：会渲染审核状态与发布入口 */
  self?: boolean
  onOpenPublish?: () => void
  onReviseWork?: (work: Work) => void
  onOpenWork?: (work: Work) => void
  title?: string
  /** 作为浮层打开时必须给，否则这一屏是个死胡同 */
  onBack?: () => void
}

export default function WorksFeedScreen({
  authorId,
  self = false,
  onOpenPublish,
  onReviseWork,
  onOpenWork,
  title,
  onBack,
}: Props) {
  // 「广场」看全站公开作品，「我的」看自己的（含审核中）。同一个组件，只是取数不同。
  const [scope, setScope] = useState<'feed' | 'mine'>(self ? 'mine' : 'feed')
  const [items, setItems] = useState<Work[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [capability, setCapability] = useState<SubmissionCapability | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [lookWork, setLookWork] = useState<Work | null>(null)
  const mine = scope === 'mine' && Boolean(authorId)
  const allowPublish = canSubmitWork(capability)
  const waitCopy = mine ? submissionWaitCopy(capability) : null

  useEffect(() => {
    let alive = true
    setItems(null)
    if (mine) setCapability(null)
    const load = mine ? api.userWorks(authorId as string) : api.plaza()
    load.then((p) => {
      if (!alive) return
      setItems(p.items)
      setCursor(p.nextCursor)
      if (mine) setCapability(p.submissionCapability ?? null)
    })
    return () => {
      alive = false
    }
  }, [authorId, mine])

  async function more() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const p = mine
        ? await api.userWorks(authorId as string, cursor)
        : await api.plaza(cursor)
      setItems((cur) => [...(cur ?? []), ...p.items])
      setCursor(p.nextCursor)
    } finally {
      setLoadingMore(false)
    }
  }

  const scopeTabs = self ? (
    <div className="works-scope">
      <button className={scope === 'feed' ? 'on' : ''} onClick={() => setScope('feed')}>
        广场
      </button>
      <button className={scope === 'mine' ? 'on' : ''} onClick={() => setScope('mine')}>
        我的
      </button>
    </div>
  ) : null

  if (items === null) {
    return (
      <div className="works">
        <Head title={title} onBack={onBack} />
        {scopeTabs}
        <p className="plaza-loading">正在把作品一件件摆出来…</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="works">
        <Head title={title} onBack={onBack} />
        {scopeTabs}
        <div className="works-empty">
          <span className="empty-glow" />
          <p className="works-empty-title">{mine ? '还没有发过作品' : '这里还空着'}</p>
          <p className="works-empty-sub">
            {mine ? '把一张照片、一段视频放上来，让它被看见。' : '过一会儿再来看看吧。'}
          </p>
          {mine && waitCopy && <p className="works-empty-sub">{waitCopy}</p>}
          {mine && allowPublish && onOpenPublish && (
            <button className="pub-submit" onClick={onOpenPublish}>
              发一个
            </button>
          )}
        </div>
      </div>
    )
  }

  // 双列瀑布：按累计高度往矮的那一列放，比奇偶分列更贴近真实错落
  const cols: Work[][] = [[], []]
  const heights = [0, 0]
  for (const w of items) {
    const ratio = w.width > 0 && w.height > 0 ? w.height / w.width : 1.25
    const i = heights[0] <= heights[1] ? 0 : 1
    cols[i].push(w)
    heights[i] += ratio
  }

  return (
    <div className="works">
      <Head title={title} onBack={onBack}>
        {self && allowPublish && onOpenPublish && (
          <button className="works-new" onClick={onOpenPublish}>
            ＋ 发布
          </button>
        )}
      </Head>
      {scopeTabs}
      {mine && waitCopy && <p className="works-empty-sub" style={{ padding: '0 18px 8px' }}>{waitCopy}</p>}
      <div className="works-grid">
        {cols.map((col, ci) => (
          <div className="works-col" key={ci}>
            {col.map((w) => (
              <WorkCard
                key={w.id}
                work={w}
                self={mine}
                onRevise={onReviseWork}
                onOpen={onOpenWork}
                onLookWhy={mine ? setLookWork : undefined}
              />
            ))}
          </div>
        ))}
      </div>
      {cursor && (
        <button className="works-more" onClick={more} disabled={loadingMore}>
          {loadingMore ? '正在取…' : '看看更早的'}
        </button>
      )}
      {!cursor && <p className="works-end">到这儿就是全部了</p>}
      {lookWork && (
        <div className="wk-moderation-overlay">
          <WorkModerationSheet
            work={lookWork}
            onClose={() => setLookWork(null)}
            onAppealed={(workId) => {
              setItems((cur) =>
                (cur ?? []).map((w) =>
                  w.id === workId ? { ...w, status: 'appealing', nextAction: 'none' } : w,
                ),
              )
              setLookWork((cur) =>
                cur && cur.id === workId ? { ...cur, status: 'appealing', nextAction: 'none' } : cur,
              )
            }}
          />
        </div>
      )}
    </div>
  )
}

function Head({
  title,
  onBack,
  children,
}: {
  title?: string
  onBack?: () => void
  children?: React.ReactNode
}) {
  if (!title && !onBack) return null
  return (
    <div className="works-head">
      <span className="works-head-left">
        {onBack && (
          <button className="back-btn small" onClick={onBack} aria-label="返回">
            ‹
          </button>
        )}
        {title}
      </span>
      {children}
    </div>
  )
}
