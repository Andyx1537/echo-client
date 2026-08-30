import { useEffect, useState } from 'react'
import type React from 'react'
import { api } from '../api'
import type { Work } from '../types'
import { WORK_STATUS_LABELS } from '../types'
import AiGeneratedBadge from './AiGeneratedBadge'

/**
 * 作品瀑布 / 个人作品页。同一个组件两种用法，由 `authorId` 区分。
 *
 * 🔴 **不复用广场页那条链路。** `GET /plaza` 服务端发的是回忆卡（`CardView`），
 * 前端却按「窗」（`Window`）解析，两边只有四个字段对得上——因为前端默认跑 mock，
 * 这个不一致至今没暴露（见 `PRODUCT-IMPLEMENTATION-AUDIT §0b`）。
 * 作品这条链路的字段是照着服务端 `WorkView` 抄下来的，别反过来。
 */

interface Props {
  /** 传了就是个人作品页；不传是全站瀑布 */
  authorId?: string
  /** 个人作品页且是本人时为 true：会渲染审核状态与发布入口 */
  self?: boolean
  onOpenPublish?: () => void
  title?: string
  /** 作为浮层打开时必须给，否则这一屏是个死胡同 */
  onBack?: () => void
}

export default function WorksFeedScreen({
  authorId,
  self = false,
  onOpenPublish,
  title,
  onBack,
}: Props) {
  // 「广场」看全站公开作品，「我的」看自己的（含审核中）。同一个组件，只是取数不同。
  const [scope, setScope] = useState<'feed' | 'mine'>(self ? 'mine' : 'feed')
  const [items, setItems] = useState<Work[] | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)

  const mine = scope === 'mine' && Boolean(authorId)

  useEffect(() => {
    let alive = true
    setItems(null)
    const load = mine ? api.userWorks(authorId as string) : api.works()
    load.then((p) => {
      if (!alive) return
      setItems(p.items)
      setCursor(p.nextCursor)
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
        : await api.works(cursor)
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
          {mine && onOpenPublish && (
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
        {self && onOpenPublish && (
          <button className="works-new" onClick={onOpenPublish}>
            ＋ 发布
          </button>
        )}
      </Head>
      {scopeTabs}
      <div className="works-grid">
        {cols.map((col, ci) => (
          <div className="works-col" key={ci}>
            {col.map((w) => (
              <WorkCard key={w.id} work={w} self={mine} />
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

function WorkCard({ work, self }: { work: Work; self: boolean }) {
  const ratio = work.width > 0 && work.height > 0 ? work.height / work.width : 1.25
  const cover = work.mediaType === 'video' ? work.posterUrl || work.mediaUrl : work.mediaUrl
  // 审核中/未通过只在作者本人视角出现——🔴 陌生人不该知道谁的作品在审核里
  const badge = self && work.status && work.status !== 'public' ? WORK_STATUS_LABELS[work.status] : null

  return (
    <button className="wk-card">
      <div className="wk-cover" style={{ paddingTop: `${Math.min(180, ratio * 100)}%` }}>
        <img className="wk-img" src={cover} alt="" loading="lazy" />
        {work.mediaType === 'video' && (
          <span className="wk-play" aria-label="视频">
            ▶
          </span>
        )}
        {/* S-8 显式标识：列表每一条上都要有，不是只在详情页 */}
        {work.aiGenerated && <AiGeneratedBadge variant="compact" className="wk-ai" />}
        {badge && <span className="wk-status">{badge}</span>}
      </div>
      <div className="wk-body">
        {work.title && <p className="wk-title">{work.title}</p>}
        {work.excerpt && <p className="wk-excerpt">{work.excerpt}</p>}
      </div>
    </button>
  )
}
