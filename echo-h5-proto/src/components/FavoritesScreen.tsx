import { useEffect, useState } from 'react'
import { api } from '../api'
import type { Work } from '../types'

interface Props {
  onBack: () => void
  onOpenWork: (workId: string) => void
}

export default function FavoritesScreen({ onBack, onOpenWork }: Props) {
  const [items, setItems] = useState<Work[] | null>(null)

  useEffect(() => {
    let alive = true
    api.myFavorites().then((page) => {
      if (alive) setItems(page.items)
    }).catch(() => {
      if (alive) setItems([])
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="works">
      <div className="works-head">
        <span className="works-head-left">
          <button className="back-btn small" onClick={onBack} aria-label="返回">
            ‹
          </button>
          我的收藏
        </span>
      </div>
      {items === null ? (
        <p className="plaza-loading">正在把收藏轻轻取出来…</p>
      ) : items.length === 0 ? (
        <div className="works-empty">
          <p className="works-empty-title">还没有收下什么</p>
          <p className="works-empty-sub">在广场里遇见想再看的，可以悄悄留下来。</p>
        </div>
      ) : (
        <div className="works-grid">
          <div className="works-col">
            {items.filter((_, i) => i % 2 === 0).map((w) => (
              <button key={w.id} className="wk-card" onClick={() => onOpenWork(w.id)}>
                <div className="wk-cover" style={{ paddingTop: '130%' }}>
                  <img className="wk-img" src={w.mediaType === 'video' ? w.posterUrl || w.mediaUrl : w.mediaUrl} alt="" />
                </div>
                <div className="wk-body">
                  {w.title && <p className="wk-title">{w.title}</p>}
                  {w.excerpt && <p className="wk-excerpt">{w.excerpt}</p>}
                </div>
              </button>
            ))}
          </div>
          <div className="works-col">
            {items.filter((_, i) => i % 2 === 1).map((w) => (
              <button key={w.id} className="wk-card" onClick={() => onOpenWork(w.id)}>
                <div className="wk-cover" style={{ paddingTop: '130%' }}>
                  <img className="wk-img" src={w.mediaType === 'video' ? w.posterUrl || w.mediaUrl : w.mediaUrl} alt="" />
                </div>
                <div className="wk-body">
                  {w.title && <p className="wk-title">{w.title}</p>}
                  {w.excerpt && <p className="wk-excerpt">{w.excerpt}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
