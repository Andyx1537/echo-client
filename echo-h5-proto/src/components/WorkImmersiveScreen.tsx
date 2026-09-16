import { useRef, type TouchEvent } from 'react'
import type { Work } from '../types'
import AiGeneratedBadge from './AiGeneratedBadge'
import { isWorkFeedNavigable, localNextWork, localPrevWork } from '../lib/workFeed'

const SWIPE_MIN = 56
const SWIPE_AXIS = 1.2

interface Props {
  work: Work
  items: Work[]
  onBack: () => void
  onChange: (work: Work) => void
  onOpenComments: (work: Work) => void
}

/** 广场点进去的全屏单卡。上下翻沿用进入时那份列表，不另起推荐。 */
export default function WorkImmersiveScreen({ work, items, onBack, onChange, onOpenComments }: Props) {
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
    const dx = t.clientX - from.x
    const dy = t.clientY - from.y
    if (dx > SWIPE_MIN && Math.abs(dx) > Math.abs(dy) * SWIPE_AXIS) {
      onBack()
      return
    }
    if (!navigable || Math.abs(dy) < SWIPE_MIN || Math.abs(dy) < Math.abs(dx) * SWIPE_AXIS) return
    if (dy < 0 && next) onChange(next)
    if (dy > 0 && prev) onChange(prev)
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
        <button type="button" className="wk-immersive-talk" onClick={() => onOpenComments(work)}>
          想说的话
        </button>
      </div>
    </div>
  )
}
