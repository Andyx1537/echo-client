import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Work } from '../types'
import AiGeneratedBadge from './AiGeneratedBadge'

interface Props {
  workId: string
  onBack: () => void
}

/** 从共鸣厅点进来的同一条作品。不给私域卡入口。 */
export default function WorkDetailScreen({ workId, onBack }: Props) {
  const [work, setWork] = useState<Work | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let alive = true
    api
      .workDetail(workId)
      .then((res) => {
        if (!alive) return
        setWork(res.work)
      })
      .catch(() => {
        if (alive) setMissing(true)
      })
    return () => {
      alive = false
    }
  }, [workId])

  return (
    <div className="wk-detail">
      <div className="works-head">
        <span className="works-head-left">
          <button className="back-btn small" onClick={onBack} aria-label="返回">
            ‹
          </button>
          作品
        </span>
      </div>
      {missing ? (
        <p className="works-empty-sub">这个作品暂时看不到了。</p>
      ) : !work ? (
        <p className="plaza-loading">正在把这一件轻轻打开…</p>
      ) : (
        <article className="wk-detail-body">
          <div className="wk-detail-media">
            {work.mediaType === 'video' ? (
              <video
                src={work.mediaUrl}
                poster={work.posterUrl || undefined}
                controls
                playsInline
              />
            ) : (
              <img src={work.mediaUrl} alt="" />
            )}
            {work.aiGenerated && <AiGeneratedBadge variant="compact" className="wk-ai" />}
          </div>
          {work.title && <h1 className="wk-detail-title">{work.title}</h1>}
          <p className="wk-detail-text">{work.body || work.excerpt}</p>
        </article>
      )}
    </div>
  )
}
