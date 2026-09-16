import { useRef, type TouchEvent } from 'react'
import type { Work } from '../types'
import AiGeneratedBadge from './AiGeneratedBadge'
import { isWorkFeedNavigable, localNextWork, localPrevWork, workImmersiveSwipe } from '../lib/workFeed'

interface Props {
  work: Work
  items: Work[]
  onBack: () => void
  onChange: (work: Work) => void
  onOpenComments: (work: Work) => void
  onOpenAuthor: (work: Work) => void
}

/** 广场点进去的全屏单卡。上下翻沿用进入时那份列表；左滑进作者主页。 */
export default function WorkImmersiveScreen({
  work,
  items,
  onBack,
  onChange,
  onOpenComments,
  onOpenAuthor,
}: Props) {
  const feed = { items }
  const index = items.findIndex((item) => item.id === work.id)
  const prev = localPrevWork(feed, index)
  const next = localNextWork(feed, index)
  const navigable = isWorkFeedNavigable(feed)
  const cover = work.mediaType === 'video' ? work.posterUrl || work.mediaUrl : work.mediaUrl
  const start = useRef<{ x: number; y: number } | null>(null)

  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    const t = e.touches[0]
    start.current = { x: t.clientX, y: t.clientY }
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const from = start.current
    start.current = null
    if (!from) return
    const t = e.changedTouches[0]
    const gesture = workImmersiveSwipe(t.clientX - from.x, t.clientY - from.y, navigable)
    if (gesture === 'back') onBack()
    if (gesture === 'author') onOpenAuthor(work)
    if (gesture === 'next' && next) onChange(next)
    if (gesture === 'prev' && prev) onChange(prev)
  }

  return (
    <div
      className="wk-immersive"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="wk-immersive-media">
        {work.mediaType === 'video' ? (
          <video src={work.mediaUrl} poster={work.posterUrl || undefined} controls playsInline />
        ) : (
          <img src={cover} alt="" />
        )}
        {work.aiGenerated && <AiGeneratedBadge variant="compact" className="wk-ai" />}
      </div>
      <button className="back-btn floating" onClick={onBack} aria-label="返回">
        ‹
      </button>
      {prev && (
        <button className="wk-immersive-nav prev" onClick={() => onChange(prev)}>
          ︿ 上一条
        </button>
      )}
      {next && (
        <button className="wk-immersive-nav next" onClick={() => onChange(next)}>
          下一条 ﹀
        </button>
      )}
      <div className="wk-immersive-copy">
        {work.title && <h1>{work.title}</h1>}
        {work.excerpt && <p>{work.excerpt}</p>}
        <div className="wk-immersive-actions">
          <button type="button" className="wk-immersive-talk" onClick={() => onOpenComments(work)}>
            想说的话
          </button>
          <button type="button" className="wk-immersive-home" onClick={() => onOpenAuthor(work)}>
            主页
          </button>
        </div>
      </div>
    </div>
  )
}
