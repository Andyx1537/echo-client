import { useCallback, useEffect, useRef, useState } from 'react'
import type { Work } from '../types'
import { api } from '../api'
import { reportPlazaSeen } from '../api/phase0'
import AiGeneratedBadge from './AiGeneratedBadge'

interface Props {
  onOpen: (work: Work, feed: Work[], fromReqId: string) => void
  onOpenSearch: () => void
  guest?: boolean
}

/**
 * 共鸣厅：公开作品瀑布。点进去进全屏单卡，不是一扇窗。
 */
export default function PlazaScreen({ onOpen, onOpenSearch, guest = false }: Props) {
  const [works, setWorks] = useState<Work[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [reqIdByWork, setReqIdByWork] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const pullingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  function rememberReqIds(items: Work[], reqId?: string) {
    if (!reqId) return
    setReqIdByWork((cur) => {
      const next = { ...cur }
      for (const item of items) next[item.id] = reqId
      return next
    })
  }

  useEffect(() => {
    let alive = true
    api
      .plaza()
      .then((res) => {
        if (!alive) return
        setWorks(res.items)
        setCursor(res.nextCursor)
        rememberReqIds(res.items, res.reqId)
        reportPlazaSeen(res.items)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  const loadMore = useCallback(async () => {
    if (pullingRef.current || !cursor) return
    pullingRef.current = true
    setLoadingMore(true)
    try {
      const res = await api.plaza(cursor)
      setWorks((cur) => {
        const seen = new Set(cur.map((w) => w.id))
        return [...cur, ...res.items.filter((w) => !seen.has(w.id))]
      })
      rememberReqIds(res.items, res.reqId)
      setCursor(res.nextCursor)
    } catch {
      /* 续拉失败静默：保留已看到的内容 */
    } finally {
      pullingRef.current = false
      setLoadingMore(false)
    }
  }, [cursor])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || !cursor || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void loadMore()
      },
      { rootMargin: '240px' },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [cursor, loadMore])

  const cols: Work[][] = [[], []]
  const heights = [0, 0]
  for (const w of works) {
    const ratio = w.width > 0 && w.height > 0 ? w.height / w.width : 1.25
    const i = heights[0] <= heights[1] ? 0 : 1
    cols[i].push(w)
    heights[i] += ratio
  }

  return (
    <div className="plaza">
      <button className="search-bar search-bar-btn" onClick={onOpenSearch}>
        <span className="search-ico">🔍</span>
        <span className="search-ph">搜故事、记忆、或某个人</span>
      </button>

      {loading ? (
        <p className="plaza-loading">正在把大家的作品，轻轻摆出来…</p>
      ) : (
        <>
          <div className="works-grid">
            {cols.map((col, ci) => (
              <div className="works-col" key={ci}>
                {col.map((w) => (
                  <PlazaWorkCard key={w.id} work={w} onOpen={() => onOpen(w, works, reqIdByWork[w.id] ?? '')} />
                ))}
              </div>
            ))}
          </div>
          <div ref={sentinelRef} className="plaza-more">
            {loadingMore
              ? '还在把更多作品轻轻摆出来…'
              : cursor
                ? ''
                : guest
                  ? '这两小时先看到这里。过一会儿会再换一批。'
                  : '这些作品，先看到这里吧 🌿'}
          </div>
        </>
      )}
    </div>
  )
}

function PlazaWorkCard({ work, onOpen }: { work: Work; onOpen: (work: Work) => void }) {
  const ratio = work.width > 0 && work.height > 0 ? work.height / work.width : 1.25
  const cover = work.mediaType === 'video' ? work.posterUrl || work.mediaUrl : work.mediaUrl
  return (
    <button className="wk-card" onClick={() => onOpen(work)}>
      <div className="wk-cover" style={{ paddingTop: `${Math.min(180, ratio * 100)}%` }}>
        <img className="wk-img" src={cover} alt="" loading="lazy" />
        {work.mediaType === 'video' && (
          <span className="wk-play" aria-label="视频">
            ▶
          </span>
        )}
        {work.aiGenerated && <AiGeneratedBadge variant="compact" className="wk-ai" />}
      </div>
      <div className="wk-body">
        {work.title && <p className="wk-title">{work.title}</p>}
        {work.excerpt && <p className="wk-excerpt">{work.excerpt}</p>}
      </div>
    </button>
  )
}
