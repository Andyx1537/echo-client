import { useEffect, useRef, useState, type CSSProperties, type TouchEvent } from 'react'
import type { FlowerQuota, RememberWall } from '../types'
import { api, ApiError, track } from '../api'
import type { WindowDetail } from '../api'
import { FLOWER_TOPUP_SKU } from '../api/backend'
import CoverPlaceholder from './CoverPlaceholder'
import AiGeneratedBadge from './AiGeneratedBadge'
import AiImagineNote from './AiImagineNote'
import OpsMark from './OpsMark'
import LeaveMessage from './LeaveMessage'
import MessageTriage from './MessageTriage'
import { isAiGenerated } from '../lib/aiGenerated'
import type { CardId, PetId } from '../lib/ids'
import { useFeatureFlags } from '../hooks/useFeatureFlags'

/**
 * 面孔墙最多出几张脸；超过这个数就不出可数的一排，只留光晕（裁定 `H-8`，2026-08-27）。
 *
 * 🔴 **5 这个数是出图定的，不是推理定的。** 取样图在
 * `docs/visual/facewall-threshold-2to11.png`（2/3/5/8/11）与
 * `facewall-threshold-4to8.png`（分界处加密），同一位置、同一份数据、光晕锁定，只有脸数不同。
 *
 * 图上读出来的分界在 **5 与 6 之间**：
 * - ≤5 张时整排能一眼把握，读到的是「几个人」，不需要点数；
 * - 从 6 张起头像开始互相挤压、整排的**宽度**成了主要视觉信号，
 *   要说出到底几张就得挨个点过去 —— 🔴 **「点数」这个动作本身就是把它当分数在读。**
 * - 8 张已经是一条链，11 张只剩长度。
 *
 * 外部依据：人一眼能把握的数量上限（subitizing）通常是 4–5，超过就转成逐个计数。
 * 所以 5 是有依据的那一档；6 只有「看着还行」。产品若要更宽松，改这一个常量即可。
 */
const FACE_WALL_MAX = 5

/** 暖光墙首次说明是否已看过（CR6：仅首次出现给一句短说明） */
const WARM_HINT_KEY = 'echo.warmwall.hintSeen'
function readWarmHintSeen(): boolean {
  try {
    return localStorage.getItem(WARM_HINT_KEY) === '1'
  } catch {
    return false
  }
}
function markWarmHintSeen(): void {
  try {
    localStorage.setItem(WARM_HINT_KEY, '1')
  } catch {
    /* localStorage 不可用则每次都提示，不影响功能 */
  }
}

/**
 * 进窗后连续下翻的导航句柄（定案 D21 / 验收 TC-13）。
 * 由 App 提供：顺序沿用进入时那份列表，续拉走 `{items,nextCursor}`。
 * 只有「顺着一条流进来」的入口才会拿到它；单条上下文（搜索/消息/我的它）为 undefined。
 */
export interface DetailFeedNav {
  hasPrev: boolean
  hasNext: boolean
  /** 正在续拉下一页 */
  loadingMore: boolean
  onPrev: () => void
  onNext: () => void
}

interface Props {
  /**
   * 🔴 **窗口键**：`/windows/:petId/detail|seen|flower|remember` 那一组全部用它。
   * 由调用方从卡上取（`petIdOfCard()`），本组件不再自己换算——
   * 因为有些入口（消息中心的到达、「我的它」）根本不是从卡进来的，手上没有卡。
   */
  petId: PetId
  /**
   * 🔴 **卡片键**，`/cards/:cardId/messages` 那一组用它。
   * ⚠️ **可缺**：只有「从一张卡进来」的入口（广场 / 搜索 / 作品墙）才有。
   * 消息中心的到达按窗折叠、「我的它」是自己的窗，这两个入口没有卡片键——
   * 🔴 缺的时候留言那一组**整块不呈现**，而不是拿窗口键顶替（那是另一个静默 404）。
   */
  cardId?: CardId
  onBack: () => void
  onBuildOwn: () => void
  feed?: DetailFeedNav
  /** 点作者 → ta 的他人主页（SPEC §2.4）；窗口没带 ownerId 时作者行退化为纯文本 */
  onOpenUser?: (userId: string) => void
}

/** 判定为「翻页」的最小纵向位移(px) */
const SWIPE_MIN_Y = 56
/** 轴锁比例：纵向位移要明显压过横向，才算上下翻——横滑（返回手势/页内横滑组件）一概不接 */
const SWIPE_AXIS_RATIO = 1.4
/** 贴边容差(px)：滚动到顶/底附近才允许翻页，正常阅读滚动不被打断 */
const EDGE_TOLERANCE = 24

interface Petal {
  id: number
  left: number
  delay: number
  emoji: string
}

const PETALS = ['🌸', '🌼', '🌷', '💮']

/**
 * 窗口 / 纪念详情页：生命之书 + 献花（走额度、不加温度）+ 记得（暖光面孔墙）。
 * 六项定案落点：献花与记得彻底拆开（§0.7 #3/#4/#5）——
 *  · 献花：每日 5 朵额度 / 可购买 / 不加温度 / 无排名；
 *  · 记得：一人一次的开关状态，呈现为"暖光浓度 + 面孔墙"，不显数字、不排名。
 */
export default function DetailScreen({ petId, cardId, onBack, onBuildOwn, feed, onOpenUser }: Props) {
  const [detail, setDetail] = useState<WindowDetail | null>(null)
  const [quota, setQuota] = useState<FlowerQuota | null>(null)
  const [wall, setWall] = useState<RememberWall | null>(null)
  const [loading, setLoading] = useState(true)
  /** 作者「收下公开」一条留言后 +1，逼详情重取，让那句话出现在温柔的回声里 */
  const [reloadTick, setReloadTick] = useState(0)

  // 服务端功能开关（DECISIONS S13）：留一句话 P0 默认关闭。
  // 🔴 关闭（以及还没拿到开关）时，访客侧输入框与作者侧三选一**整块都不呈现**，
  // 不留任何「功能暂未开放」的占位。
  const flags = useFeatureFlags()

  const [petals, setPetals] = useState<Petal[]>([])
  const [pulse, setPulse] = useState(false)
  const [bondMark, setBondMark] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  // CR6：暖光墙首次出现时给一句短说明，之后不再打扰
  const [showWarmHint] = useState(() => !readWarmHintSeen())

  const scrollRef = useRef<HTMLDivElement | null>(null)
  const touchRef = useRef<{ x: number; y: number; top: number } | null>(null)

  useEffect(() => {
    let alive = true
    setLoading(true)
    // 换到另一扇窗时，上一条的私域痕迹（羁绊心意、花瓣、提示）一律清空，
    // 献花额度/记得状态/明信片都随这一条重取——不串台（App 侧另有 key 重挂兜底）
    setBondMark(null)
    setPetals([])
    setToast(null)
    Promise.all([api.windowDetail(petId), api.flowerQuota()])
      .then(([d, q]) => {
        if (!alive) return
        setDetail(d)
        setWall(d.rememberWall)
        setQuota(q)
      })
      .finally(() => alive && setLoading(false))
    // 被动脚印 + 埋点（看过数只 owner 内部可见）
    track('window_open', { windowId: petId })
    api.windowSeen(petId).then(() => track('window_seen', { windowId: petId })).catch(() => {})
    return () => {
      alive = false
    }
  }, [petId, reloadTick])

  // 暖光墙一旦在本次浏览中出现，就记下"已说明过"，下次不再重复提示
  useEffect(() => {
    if (wall && showWarmHint) markWarmHintSeen()
  }, [wall, showWarmHint])

  function flashToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2400)
  }

  // —— 上下滑切上一条/下一条（D21/TC-13）——
  // 三重门槛，避免误触与手势打架：
  //  ① 轴锁：纵向必须明显压过横向 → 左右滑（返回手势、扇形候选等页内横滑）一概不接管；
  //  ② 贴边：手势起点与终点都要在内容顶/底附近 → 正常阅读时的上下滚动不会被抢走；
  //  ③ 只认用户手势：没有任何定时器/自动播放会替用户翻页。
  function handleTouchStart(e: TouchEvent<HTMLDivElement>) {
    if (!feed) return
    const t = e.touches[0]
    touchRef.current = { x: t.clientX, y: t.clientY, top: scrollRef.current?.scrollTop ?? 0 }
  }

  function handleTouchEnd(e: TouchEvent<HTMLDivElement>) {
    const start = touchRef.current
    touchRef.current = null
    const el = scrollRef.current
    if (!start || !feed || !el) return

    const t = e.changedTouches[0]
    const dy = t.clientY - start.y
    const dx = t.clientX - start.x
    if (Math.abs(dy) < SWIPE_MIN_Y || Math.abs(dy) < Math.abs(dx) * SWIPE_AXIS_RATIO) return

    const bottomEdge = el.scrollHeight - el.clientHeight - EDGE_TOLERANCE
    if (dy < 0) {
      // 上滑 = 看下一扇：读到底了才接管
      if (start.top >= bottomEdge && el.scrollTop >= bottomEdge) feed.onNext()
    } else if (start.top <= EDGE_TOLERANCE && el.scrollTop <= EDGE_TOLERANCE) {
      // 下滑 = 回上一扇：停在顶部才接管
      if (feed.hasPrev) feed.onPrev()
    }
  }

  async function handleOffer() {
    if (busy || !quota) return
    const available = quota.remaining + quota.purchasedBalance
    if (available <= 0) {
      flashToast('今天的心意先到这里啦，想多留一点可以补充一些')
      return
    }
    setBusy(true)
    try {
      const res = await api.flower(petId, { count: 1, type: 'daily', anonymous: false })
      track('flower_offer', { windowId: petId })
      setQuota(res.quota)
      setBondMark(res.bondMark)
      setPulse(true)
      setTimeout(() => setPulse(false), 420)
      const burst: Petal[] = Array.from({ length: 7 }).map((_, i) => ({
        id: Date.now() + i,
        left: 12 + Math.random() * 76,
        delay: Math.random() * 0.25,
        emoji: PETALS[Math.floor(Math.random() * PETALS.length)],
      }))
      setPetals((p) => [...p, ...burst])
      setTimeout(() => setPetals((p) => p.filter((x) => !burst.some((b) => b.id === x.id))), 1600)
      flashToast('你为这段回忆留下一束心意')
    } catch (e) {
      flashToast(e instanceof ApiError ? e.message : '这束心意没能送出去，待会儿再试试')
    } finally {
      setBusy(false)
    }
  }

  async function purchase() {
    if (busy) return
    setBusy(true)
    try {
      // 补充心意：走款式商店同一购买入口（契约 §0.7 #3「献花可买」，POST /shop/purchase）
      // 护栏：属增值心意，不影响任何解锁进度（affectsUnlock:false）
      await api.purchase(FLOWER_TOPUP_SKU)
      track('shop_purchase', { skinId: FLOWER_TOPUP_SKU })
      const fresh = await api.flowerQuota()
      setQuota(fresh)
      flashToast('补充了一些心意，慢慢留给想记挂的它')
    } catch (e) {
      flashToast(e instanceof ApiError ? e.message : '这份心意还没能收下，待会儿再试试')
    } finally {
      setBusy(false)
    }
  }

  async function toggleRemember() {
    if (busy || !wall) return
    const next = !wall.meRemembered
    setBusy(true)
    try {
      await api.setRemember(petId, next)
      track('remember_toggle', { windowId: petId, remembered: next })
      const fresh = await api.rememberWall(petId)
      setWall(fresh)
      if (next) flashToast('你的暖光落在这里 · 你也记住了这个瞬间')
    } catch (e) {
      flashToast(e instanceof ApiError ? e.message : '待会儿再试一次吧')
    } finally {
      setBusy(false)
    }
  }

  if (loading || !detail) {
    return (
      <div className="detail">
        <div className="detail-loading">
          <button className="back-btn floating" onClick={onBack}>
            ←
          </button>
          <p>正在推开这扇窗…</p>
        </div>
      </div>
    )
  }

  const w = detail
  const canFlower = w.flowerAllowed
  const totalAvailable = quota ? quota.remaining + quota.purchasedBalance : 0

  return (
    <div className="detail">
      <div
        className="detail-scroll"
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="detail-hero">
          {/* 头图的 AI 角标不走 CoverPlaceholder 的默认位置：那里正压着大标题，
              改由 hero 文案块自己安放（仍在封面左下角一带，标题上方一行） */}
          <CoverPlaceholder data={w.cover} className="detail-cover" sizes="100vw" aiBadge="none" />
          <button className="back-btn" onClick={onBack}>
            ←
          </button>
          {/* 上一扇：手势之外留一个同等入口（桌面/无障碍也能翻） */}
          {feed?.hasPrev && (
            <button className="feed-prev" onClick={feed.onPrev}>
              ︿ 上一扇
            </button>
          )}
          <div className="detail-hero-text">
            {isAiGenerated(w.cover) && <AiGeneratedBadge variant="hero" />}
            <h1 className="detail-name">
              {w.title ?? w.petName} <span className="leaf">🌿</span>
            </h1>
            <p className="detail-sign">{w.signature}</p>
          </div>
        </div>

        <div className="detail-body">
          {/* 作者行（SPEC §2.4 的入口之一）：可点进 ta 的他人主页。
              🔴 这里只出昵称与官方标记，**不带粉丝数**——精确粉丝数只在个体主页出现。 */}
          {w.ownerId && onOpenUser ? (
            <button className="detail-author" onClick={() => onOpenUser(w.ownerId!)}>
              <span className="detail-author-avatar" style={{ background: w.ownerAvatar }} />
              <span className="detail-author-name">{w.ownerName}</span>
              {w.ownerAccountType === 'ops' && <OpsMark />}
              <span className="detail-author-arrow">→</span>
            </button>
          ) : (
            <div className="detail-author static">
              <span className="detail-author-avatar" style={{ background: w.ownerAvatar }} />
              <span className="detail-author-name">{w.ownerName}</span>
              {w.ownerAccountType === 'ops' && <OpsMark />}
            </div>
          )}

          <h2 className="section-title">🌿 回忆片段</h2>
          <div className="timeline">
            {w.lifeBook.map((m, i) => (
              <div key={i} className="tl-item">
                <div className="tl-dot" />
                {/* 生命之书缩略图只有 52px，角标出短标，否则整句会把小图糊满 */}
                <CoverPlaceholder data={m.placeholder} className="tl-thumb" aiBadge="compact" />
                <div className="tl-text">
                  <p className="tl-title">
                    {m.title} <span className="tl-year">· {m.year}</span>
                  </p>
                  <p className="tl-desc">{m.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="recent-chip">🌱 最近留下的一段：{w.recent}</div>
          {w.category === 'pet' && <AiImagineNote className="recent-note" />}

          {/* —— 记忆明信片墙（广场态只读：已解锁 + 虚线空位；不触发解锁动作） —— */}
          {w.postcards && w.postcards.length > 0 && (
            <div className="win-postcards-block">
              <h2 className="section-title">🌿 记忆明信片</h2>
              <div className="postcards">
                {w.postcards.map((pc) =>
                  pc.locked ? (
                    <div key={pc.id} className="postcard locked readonly">
                      <span className="lock-plus">＋</span>
                      <span className="lock-text">🔒 {pc.unlockHint ?? '慢慢会来'}</span>
                    </div>
                  ) : (
                    <div key={pc.id} className="postcard">
                      {pc.placeholder && (
                        <CoverPlaceholder data={pc.placeholder} className="pc-cover" badge={pc.date} />
                      )}
                      <div className="pc-body">
                        <p className="pc-caption">{pc.caption}</p>
                        <span className="pc-heart">🤍</span>
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          )}

          {/* —— 记得：暖光浓度 + 面孔墙 ——
              ⚠️ **这里原来的注释是「不显数字、不排名」**。那句话是真话，但它
              🔴 **描述的是实现（这段代码里没有 `{count}`），不是后果** ——
              而那一排头像是**可数的**，主人一眼就能数出有几个人记得它。
              结果是：这一处连着两轮的「哪里还在给主人发精确数字」都被跳过了，
              因为看见那行注释的人（包括我自己）会以为它已经检查过了。
              通则见 `docs/COPY-GUARD-CROSSWALK.md` §3。

              🔴 **裁定（2026-08-27）：面孔数超过一定数量就不出可数的一排，少量照常出。**
              产品的判断是「人少的时候，几张脸本身就是安慰」——「有三个人记得它」和
              「一团光」给人的东西不一样，前者是具体的人。**变成分数是规模造成的，不是头像造成的。**

              🔴 **代价，如实登记、不要当成已解决**：低于阈值时主人**仍然能数出精确人数**。
              产品是知情接受的，理由是小数目不构成可追的分数。但它是**接受**，不是**消除**。 */}
          {wall && (
            <div className="remember-block">
              <div
                className="warm-wall"
                style={{ '--warmth': wall.warmthLevel } as CSSProperties}
              >
                <div className="warm-halo" />
                {wall.faces.length <= FACE_WALL_MAX && (
                  <div className="warm-faces">
                    {wall.faces.map((f, i) => (
                      <span
                        key={f.accountId}
                        className={`warm-face ${f.accountId === 'me' ? 'me' : ''}`}
                        style={{ background: f.avatar, zIndex: wall.faces.length - i }}
                      />
                    ))}
                  </div>
                )}
              </div>
              <p className="warm-caption">
                {wall.meRemembered ? '你也在这片暖光里' : '记得它的人，聚成了一片暖光'}
              </p>
              {showWarmHint && (
                <p className="warm-hint">这片暖光代表有人也记得</p>
              )}
              <button
                className={`remember-btn ${wall.meRemembered ? 'on' : ''}`}
                onClick={toggleRemember}
                disabled={busy}
              >
                {wall.meRemembered ? '我记得它 ✓' : '我记得它'}
              </button>
            </div>
          )}

          {/* —— 温柔的回声：他人共鸣留言（真实用户，非 AI/非替宠物代言，故不加想象标识） —— */}
          {w.echoes && w.echoes.length > 0 && (
            <div className="win-echoes-block">
              <h2 className="section-title">🍃 温柔的回声</h2>
              <div className="win-echo-list">
                {w.echoes.map((ec) => (
                  <div key={ec.id} className="win-echo">
                    <span className="win-echo-avatar" style={{ background: ec.authorAvatar }} />
                    <div className="win-echo-body">
                      <div className="win-echo-top">
                        <span className="win-echo-name">{ec.authorName}</span>
                        <span className="win-echo-time">{ec.time}</span>
                      </div>
                      <p className="win-echo-text">{ec.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* —— C1 留一句话（DECISIONS S13）：整组由服务端开关 flags.leaveMessage 控制 ——
              🔴 开关关闭 / 开关还没拿到 → 下面两块**一个都不渲染**，页面上不留任何痕迹。
              🔴 这里是唯一的判定处：两个子组件内部都不再自己判一次，也都不读环境变量。
              自己的窗看到的是「处理别人留的话」，别人的窗看到的是「留一句话」——
              两者互斥，靠 isMine 分流（不复用 flowerAllowed，理由见 WindowDetail.isMine）。 */}
          {/* 🔴 留言这两处传的是 cardId 而不是 petId：后端挂的是
              `/cards/:cardId/messages`，与 `/windows/:petId/flower` 不是一套键。
              🔴 `cardId` 缺失（非从卡进来的入口）时整块不出——没有卡片键就没有留言对象。 */}
          {flags.leaveMessage &&
            cardId &&
            (w.isMine ? (
              <MessageTriage cardId={cardId} onPublished={() => setReloadTick((t) => t + 1)} />
            ) : (
              <LeaveMessage cardId={cardId} />
            ))}

          {/* —— 献花：走额度、不加温度、无排名 —— */}
          {canFlower && (
            <div className="flower-block">
              <div className="flower-wrap">
                {petals.map((p) => (
                  <span
                    key={p.id}
                    className="petal"
                    style={{ left: `${p.left}%`, animationDelay: `${p.delay}s` }}
                  >
                    {p.emoji}
                  </span>
                ))}
                <button
                  className={`flower-btn ${pulse ? 'pulse' : ''}`}
                  onClick={handleOffer}
                  disabled={busy}
                >
                  留一束心意 <span className="fb-flower">🌸</span>
                </button>
              </div>
              <div className="flower-meta">
                {quota && (
                  <span className="flower-quota">
                    今天还剩 {quota.remaining} 朵
                    {quota.purchasedBalance > 0 && ` · 另有 ${quota.purchasedBalance} 朵`}
                  </span>
                )}
                {totalAvailable <= 0 && (
                  <button className="flower-buy" onClick={purchase} disabled={busy}>
                    补充一些心意
                  </button>
                )}
              </div>
              {bondMark && <p className="bond-mark">🌸 {bondMark}</p>}
              <p className="flower-note">这是留给这段回忆的一点心意，不会改变它的温度。</p>
            </div>
          )}

          <button className="build-own" onClick={onBuildOwn}>
            为你的它，也建立我的回忆集 →
          </button>

          {/* —— 连续下翻的落脚处（D21/TC-13）：邀请式、不催促；到底给温柔收尾，不空白不报错 —— */}
          {feed && (
            <div className="feed-foot">
              {feed.loadingMore ? (
                <p className="feed-foot-hint">正在轻轻推开下一扇…</p>
              ) : feed.hasNext ? (
                <button className="feed-next" onClick={feed.onNext}>
                  <span className="feed-next-arrow">︿</span>
                  <span className="feed-next-text">上滑，看看下一扇窗</span>
                </button>
              ) : (
                <div className="feed-end">
                  <span className="feed-end-glow" />
                  <p className="feed-end-title">先看到这里吧</p>
                  <p className="feed-end-sub">
                    这些窗一直都在，想它们的时候，随时回来坐一会儿。
                  </p>
                  <button className="feed-end-back" onClick={onBack}>
                    回到广场
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {toast && <div className="detail-toast">{toast}</div>}
    </div>
  )
}
