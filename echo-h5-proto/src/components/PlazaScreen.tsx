import { useCallback, useEffect, useRef, useState } from 'react'
import type { Placeholder, PlazaCard, Window } from '../types'
import type { CardOrigin } from '../lib/ids'
import { api } from '../api'
import { CATEGORY_LABELS } from '../api/searchLogic'
import CoverPlaceholder from './CoverPlaceholder'
import OpsMark from './OpsMark'

/**
 * 点进一扇窗时一并交出去的「流上下文」（D21/TC-13）：
 * 用户此刻看到的那份列表顺序 + 续拉游标，详情页照着它继续往下翻，不另起一套推荐。
 */
export interface FeedOpenContext {
  /** 🔴 成对的两个键（卡片键 + 窗口键）的序列，缺一详情页就有一组端点会 404。见 lib/ids.ts */
  cards: CardOrigin[]
  nextCursor: string | null
}

interface Props {
  onOpen: (card: PlazaCard, ctx: FeedOpenContext) => void
  /** 点搜索栏 → 打开全屏搜索页（A.1） */
  onOpenSearch: () => void
  /** 主题聚合：只看某题材的窗（搜索「主题」结果点入时复用广场过滤，A.3） */
  category?: NonNullable<Window['category']> | null
  /** 清除题材过滤，回到全部 */
  onClearCategory?: () => void
}

/**
 * 广场态 = 共鸣厅：公开窗口瀑布流（GET /plaza）。
 *
 * 🔴 **这一屏不出暖光**（裁定 2026-08-26）。原来每张封面都叠一层暖色覆盖层、
 * 作者行还跟一个光点加一句文案 —— 满屏都在发光，等于没有重点，而且把一整页窗
 * 排成了「谁更亮」这根轴。暖光的落点是窗自己那一页，不是别人的瀑布流。
 *
 * ⚠️ 服务端仍会下发 `Window.warmthLevel`，本屏**读都不读**。字段要不要从 `GET /plaza`
 * 的出参里摘掉，是契约问题，见回执里的清单。
 */
export default function PlazaScreen({ onOpen, onOpenSearch, category, onClearCategory }: Props) {
  const [cards, setCards] = useState<PlazaCard[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const pullingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    api
      .plaza()
      .then((res) => {
        if (!alive) return
        setCards(res.items)
        setCursor(res.nextCursor)
      })
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [])

  // 续拉下一页（复用 {items,nextCursor} 契约 §14.1）。
  // 只在用户自己滚到接近底部时才拉 —— 不自动播放、不自动跳转，翻页始终由用户驱动。
  const loadMore = useCallback(async () => {
    if (pullingRef.current || !cursor) return
    pullingRef.current = true
    setLoadingMore(true)
    try {
      const res = await api.plaza(cursor)
      setCards((cur) => {
        const seen = new Set(cur.map((w) => w.id))
        return [...cur, ...res.items.filter((w) => !seen.has(w.id))]
      })
      setCursor(res.nextCursor)
    } catch {
      /* 续拉失败静默：保留已看到的内容，不弹技术错误脸 */
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

  const shown = category
    ? cards.filter((card) => card.presentation?.category === category)
    : cards

  return (
    <div className="plaza">
      <button className="search-bar search-bar-btn" onClick={onOpenSearch}>
        <span className="search-ico">🔍</span>
        <span className="search-ph">搜故事、记忆、或某个人</span>
      </button>

      {category && (
        <div className="plaza-filter">
          <span className="plaza-filter-chip">题材 · {CATEGORY_LABELS[category]}</span>
          <button className="plaza-filter-clear" onClick={onClearCategory}>
            看全部 ×
          </button>
        </div>
      )}

      {loading ? (
        <p className="plaza-loading">正在把大家的窗，轻轻推开…</p>
      ) : (
        <>
          <div className="masonry">
            {shown.map((card, index) => {
              const presentation = card.presentation
              const cover: Placeholder = presentation?.cover ?? {
                gradient: 'linear-gradient(150deg,#f3eadc,#d9c9b1)',
                emoji: card.hasCover ? '' : '✦',
                imageUrl: card.hasCover ? card.cover : undefined,
              }
              return (
              <button
                key={card.id}
                className="w-card"
                onClick={() =>
                  onOpen(card, {
                    cards: shown.map((x) => ({ id: x.id, petId: x.petId })),
                    nextCursor: cursor,
                  })
                }
              >
                <div className="w-cover-wrap">
                  <CoverPlaceholder
                    data={cover}
                    className={index % 3 === 1 ? 'cover-tall' : 'cover-short'}
                  />
                </div>
                <div className="w-card-body">
                  {card.title && <p className="w-title">{card.title}</p>}
                  <p className="w-recent">{card.excerpt}</p>
                  {presentation?.ownerName && (
                    <div className="w-meta">
                      <span className="w-avatar" style={{ background: presentation.ownerAvatar }} />
                      <span className="w-owner">{presentation.ownerName}</span>
                      {presentation.ownerAccountType === 'ops' && <OpsMark />}
                    </div>
                  )}
                </div>
              </button>
              )
            })}
          </div>

          {/* 续拉哨兵 + 温柔的到底提示（不空白、不「没有更多了」式冷话） */}
          <div ref={sentinelRef} className="plaza-more">
            {loadingMore
              ? '还在把更多的窗轻轻推开…'
              : cursor
                ? ''
                : '这些窗，先看到这里吧 🌿'}
          </div>
        </>
      )}
    </div>
  )
}
