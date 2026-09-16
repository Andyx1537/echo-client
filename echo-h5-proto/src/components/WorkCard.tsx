import type { Work } from '../types'
import { WORK_STATUS_LABELS } from '../types'
import {
  appealingHintCopy,
  canReviseWork,
  moderationEntryCopy,
  reviseActionCopy,
} from '../lib/workSubmission'
import AiGeneratedBadge from './AiGeneratedBadge'

interface Props {
  work: Work
  self?: boolean
  onRevise?: (work: Work) => void
  onOpen?: (work: Work) => void
  onLookWhy?: (work: Work) => void
}

/** 瀑布里的一张。审核态和「看看为什么」只在作者本人视角出现。 */
export default function WorkCard({ work, self = false, onRevise, onOpen, onLookWhy }: Props) {
  const ratio = work.width > 0 && work.height > 0 ? work.height / work.width : 1.25
  const cover = work.mediaType === 'video' ? work.posterUrl || work.mediaUrl : work.mediaUrl
  const badge = self && work.status && work.status !== 'public' ? WORK_STATUS_LABELS[work.status] : null
  const reviseCopy = self ? reviseActionCopy(work) : null
  const whyCopy = self && onLookWhy ? moderationEntryCopy(work) : null
  const appealingCopy = self ? appealingHintCopy(work) : null

  return (
    <article className="wk-card">
      <button
        type="button"
        className="wk-card-hit"
        onClick={() => {
          if (canReviseWork(work)) onRevise?.(work)
          else onOpen?.(work)
        }}
      >
        <div className="wk-cover" style={{ paddingTop: `${Math.min(180, ratio * 100)}%` }}>
          <img className="wk-img" src={cover} alt="" loading="lazy" />
          {work.mediaType === 'video' && (
            <span className="wk-play" aria-label="视频">
              ▶
            </span>
          )}
          {work.aiGenerated && <AiGeneratedBadge variant="compact" className="wk-ai" />}
          {badge && <span className="wk-status">{badge}</span>}
        </div>
        <div className="wk-body">
          {work.title && <p className="wk-title">{work.title}</p>}
          {work.excerpt && <p className="wk-excerpt">{work.excerpt}</p>}
          {reviseCopy && <p className="wk-excerpt">{reviseCopy}</p>}
          {appealingCopy && <p className="wk-excerpt">{appealingCopy}</p>}
        </div>
      </button>
      {whyCopy && (
        <button type="button" className="wk-why" onClick={() => onLookWhy?.(work)}>
          {whyCopy}
        </button>
      )}
    </article>
  )
}
