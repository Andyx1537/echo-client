import { useEffect, useState } from 'react'
import { api } from '../api'
import { isFavoritesAuthRequired } from '../lib/favoritesAuth'
import type { Work } from '../types'
import { usePhoneLogin } from './PhoneLoginCoordinator'

interface Props {
  guest?: boolean
  onBack: () => void
  onOpenWork: (workId: string) => void
  onIdentityChanged?: () => void
}

export default function FavoritesScreen({ guest = false, onBack, onOpenWork, onIdentityChanged }: Props) {
  const [items, setItems] = useState<Work[] | null>(null)
  const [needBind, setNeedBind] = useState(guest)
  const { login } = usePhoneLogin()

  function applyFavoritesResult(pageItems: Work[]) {
    setNeedBind(false)
    setItems(pageItems)
  }

  function applyFavoritesError(error: unknown) {
    if (isFavoritesAuthRequired(error)) {
      setNeedBind(true)
      setItems([])
      return
    }
    setNeedBind(false)
    setItems([])
  }

  async function load() {
    try {
      applyFavoritesResult((await api.myFavorites()).items)
    } catch (error) {
      applyFavoritesError(error)
    }
  }

  useEffect(() => {
    let alive = true
    if (guest) setNeedBind(true)
    api.myFavorites().then((page) => {
      if (!alive) return
      applyFavoritesResult(page.items)
    }).catch((error) => {
      if (!alive) return
      applyFavoritesError(error)
    })
    return () => {
      alive = false
    }
  }, [guest])

  async function bindAndReload() {
    const outcome = await login({ intent: 'none' })
    if (!outcome) return
    onIdentityChanged?.()
    await load()
  }

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
      {needBind ? (
        <div className="works-empty">
          <p className="works-empty-title">收藏只进自己的那一叠</p>
          <p className="works-empty-sub">绑定之后就能看见。现在这一页还不属于游客。</p>
          <button className="pub-submit" onClick={() => void bindAndReload()}>绑定手机号</button>
        </div>
      ) : items === null ? (
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
