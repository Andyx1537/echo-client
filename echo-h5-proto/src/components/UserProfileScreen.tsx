import { useCallback, useEffect, useRef, useState } from 'react'
import type { UserProfile, Work } from '../types'
import { api, ApiError, track } from '../api'
import OpsMark from './OpsMark'
import WorkCard from './WorkCard'

interface Props {
  userId: string
  onBack: () => void
  onOpenWork: (work: Work, feed: Work[]) => void
}

/**
 * 通用「他人主页」（SPEC-feature-pages §2.4）：头像/昵称/签名 + 关注 ta + 粉丝数 + 作品墙。
 *
 * 🔴 术语纪律（PRD-RESONANCE-PUBLISHING §4.1）：**「关注」= 人与人的关系，「订阅」= 付费**。
 * 这一屏从文案到标识符到埋点全部走 follow_*；出现「订阅 ta」「订阅者」即为写错方向。
 *
 * 🔴 粉丝数的三条硬约束（E1 裁定，改之前先回去读那一条）：
 *  ① **公开且精确** —— 给真数字，不做「1k+」这类模糊化；
 *  ② **只在这里出现** —— 信息流卡片、搜索结果行、回声行一律不带粉丝数；
 *  ③ **不做任何全站作者排行榜** —— 「个人页上有一个数字」与「把所有人拉出来排名次」是两件事，
 *     前者已放开，后者仍在禁止之列（DECISIONS D14 未被推翻）。
 */
export default function UserProfileScreen({ userId, onBack, onOpenWork }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [works, setWorks] = useState<Work[]>([])
  const [cursor, setCursor] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [following, setFollowing] = useState(false)
  const [toast, setToast] = useState<string | null>(null)
  const pullingRef = useRef(false)
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    setNotFound(false)
    track('user_profile_open', { userId })
    Promise.all([api.userProfile(userId), api.userWorks(userId)])
      .then(([p, page]) => {
        if (!alive) return
        setProfile(p)
        setWorks(page.items)
        setCursor(page.nextCursor)
      })
      .catch(() => alive && setNotFound(true))
      .finally(() => alive && setLoading(false))
    return () => {
      alive = false
    }
  }, [userId])

  const loadMore = useCallback(async () => {
    if (pullingRef.current || !cursor) return
    pullingRef.current = true
    setLoadingMore(true)
    try {
      const page = await api.userWorks(userId, cursor)
      setWorks((cur) => {
        const seen = new Set(cur.map((w) => w.id))
        return [...cur, ...page.items.filter((w) => !seen.has(w.id))]
      })
      setCursor(page.nextCursor)
    } catch {
      /* 续拉失败静默：保留已看到的作品，不弹技术错误脸 */
    } finally {
      pullingRef.current = false
      setLoadingMore(false)
    }
  }, [cursor, userId])

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

  function flashToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2400)
  }

  /**
   * 关注 / 取关（E1b，P0）。单向、可随时取消。
   * 粉丝数以服务端回执为准，前端不自己加减——并发下自己算会和真值飘开。
   */
  async function toggleFollow() {
    if (!profile || following) return
    const next = !profile.followedByMe
    setFollowing(true)
    try {
      const res = await api.setFollow(profile.id, next)
      track(next ? 'follow_author' : 'unfollow_author', { userId: profile.id })
      setProfile({ ...profile, followedByMe: res.followedByMe, followerCount: res.followerCount })
      if (res.followedByMe) flashToast(`以后 ${profile.nickname} 发布的，你都会看到`)
    } catch (e) {
      flashToast(e instanceof ApiError ? e.message : '待会儿再试一次吧')
    } finally {
      setFollowing(false)
    }
  }

  if (loading) {
    return (
      <div className="uprofile">
        <div className="friend-topbar">
          <button className="back-btn small" onClick={onBack} aria-label="返回">
            ←
          </button>
          <span className="friend-topbar-title">主页</span>
        </div>
        <p className="plaza-loading">正在推开 ta 的主页…</p>
      </div>
    )
  }

  if (notFound || !profile) {
    return (
      <div className="uprofile">
        <div className="friend-topbar">
          <button className="back-btn small" onClick={onBack} aria-label="返回">
            ←
          </button>
          <span className="friend-topbar-title">主页</span>
        </div>
        <div className="up-empty">
          <span className="empty-glow" />
          <p className="up-empty-title">这个人的主页暂时打不开</p>
          <p className="up-empty-sub">也许 ta 把窗轻轻掩上了，过一会儿再来看看。</p>
        </div>
      </div>
    )
  }

  const cols: Work[][] = [[], []]
  const heights = [0, 0]
  for (const w of works) {
    const ratio = w.width > 0 && w.height > 0 ? w.height / w.width : 1.25
    const i = heights[0] <= heights[1] ? 0 : 1
    cols[i].push(w)
    heights[i] += ratio
  }

  return (
    <div className="uprofile">
      <div className="friend-topbar">
        <button className="back-btn small" onClick={onBack} aria-label="返回">
          ←
        </button>
        <span className="friend-topbar-title">{profile.nickname} 的主页</span>
      </div>

      <div className="up-hero">
        <span className="up-avatar" style={{ background: profile.avatar }} />
        <div className="up-hero-text">
          <h1 className="up-name">
            {profile.nickname}
            {profile.accountType === 'ops' && <OpsMark />}
          </h1>
          <p className="up-persona">{profile.persona}</p>
        </div>
      </div>

      <div className="up-stats">
        <span className="up-stat">
          <b className="up-stat-num">{profile.followerCount}</b>
          <span className="up-stat-label">粉丝</span>
        </span>
        <span className="up-stat-sep" aria-hidden />
        <span className="up-stat">
          <b className="up-stat-num">{profile.followingCount}</b>
          <span className="up-stat-label">关注</span>
        </span>
      </div>

      {!profile.isMe && (
        <button
          className={`up-follow ${profile.followedByMe ? 'on' : ''}`}
          onClick={toggleFollow}
          disabled={following}
        >
          {profile.followedByMe ? '已关注 ✓' : `关注 ${profile.nickname}`}
        </button>
      )}

      <div className="wall-head">
        <h2 className="wall-title">🌿 ta 的作品</h2>
        <span className="wall-sub">只看得到 ta 愿意公开的那些</span>
      </div>

      {works.length === 0 ? (
        <div className="up-empty">
          <p className="up-empty-title">这里还很安静</p>
          <p className="up-empty-sub">ta 还没有公开的作品，也许正在慢慢整理。</p>
        </div>
      ) : (
        <>
          <div className="works-grid up-works">
            {cols.map((col, ci) => (
              <div className="works-col" key={ci}>
                {col.map((w) => (
                  <WorkCard key={w.id} work={w} onOpen={() => onOpenWork(w, works)} />
                ))}
              </div>
            ))}
          </div>
          <div ref={sentinelRef} className="plaza-more">
            {loadingMore ? '还在把更多作品轻轻摆出来…' : cursor ? '' : 'ta 的作品，先看到这里吧 🌿'}
          </div>
        </>
      )}

      {toast && <div className="mine-toast">{toast}</div>}
    </div>
  )
}
