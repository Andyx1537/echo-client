import { useCallback, useEffect, useRef, useState } from 'react'
import { asPetId, petIdOfCard, type CardId, type CardOrigin, type PetId } from './lib/ids'
import PhoneFrame from './components/PhoneFrame'
import BottomNav, { type TabKey } from './components/BottomNav'
import PlazaScreen from './components/PlazaScreen'
import MineScreen from './components/MineScreen'
import DetailScreen from './components/DetailScreen'
import RecordScreen from './components/RecordScreen'
import MessagesScreen from './components/MessagesScreen'
import MeScreen from './components/MeScreen'
import RelationRow from './components/RelationRow'
import ReelViewer from './components/ReelViewer'
import SpectrumScreen from './components/SpectrumScreen'
import OnboardingScreen from './components/OnboardingScreen'
import SearchScreen from './components/SearchScreen'
import UserProfileScreen from './components/UserProfileScreen'
import PublishScreen from './components/PublishScreen'
import WorksFeedScreen from './components/WorksFeedScreen'
import type { FeedOpenContext } from './components/PlazaScreen'
import { api, bootstrap, hasUnread, IS_MOCK, loadInbox, track } from './api'
import {
  EMPTY_FEED,
  appendPage,
  hasNext,
  hasPrev,
  indexOf,
  isFeedNavigable,
  localNextCard,
  localPrevCard,
  shouldLoadMore,
  singleFeed,
  type FeedState,
} from './api/feedLogic'
import { myWindowPetId } from './lib/myWindow'
import { useRelations } from './hooks/useRelations'
import type { Me, Message, MyPet, Window } from './types'
import './styles/app.css'

type Phase = 'loading' | 'onboarding' | 'app'

/**
 * 正在打开的那扇窗。
 *
 * 🔴 **`petId` 必有，`cardId` 可缺**——这不是图省事，是三个入口本来就不一样：
 *  · 广场 / 搜索 / 作品墙 —— 从**一张卡**进来，两个键都有；
 *  · 消息中心的到达 —— 后端 `/messages/arrivals` 按**窗**折叠，
 *    ⚠️ 出参那个叫 `cardId` 的键里装的其实是 petId（后端已注明是**永久错名**），
 *    所以这一路只有窗口键；
 *  · 「我的它」—— 自己那扇窗，也不是卡。
 *
 * 🔴 缺卡片键时留言那一组**整块不呈现**，不拿窗口键顶替。
 */
interface OpenTarget {
  petId: PetId
  cardId?: CardId
}

export default function App() {
  const [phase, setPhase] = useState<Phase>('loading')
  const [me, setMe] = useState<Me | null>(null)
  const [pet, setPet] = useState<MyPet | null>(null)

  const [tab, setTab] = useState<TabKey>('home')
  const [open, setOpen] = useState<OpenTarget | null>(null)
  const [spectrumOpen, setSpectrumOpen] = useState(false)
  const [friendId, setFriendId] = useState<string | null>(null)
  const [reelId, setReelId] = useState<string | null>(null)
  /** 打开中的通用「他人主页」（SPEC §2.4）；与亲友主页（friendId，看的是 ta 的宠物档案）是两回事 */
  const [profileUserId, setProfileUserId] = useState<string | null>(null)
  const [hasUnreadMsg, setHasUnreadMsg] = useState(false)
  // —— 搜索页（附录 A）：广场入口打开、题材聚合复用广场 category 过滤 ——
  const [searchOpen, setSearchOpen] = useState(false)
  // —— 作品域（t_work）——
  // publishOpen 为浮层；worksOpen 是「我的作品」页，也走浮层（底签已满五个，不再加）
  const [publishOpen, setPublishOpen] = useState(false)
  const [worksOpen, setWorksOpen] = useState(false)
  const [plazaCategory, setPlazaCategory] = useState<NonNullable<Window['category']> | null>(null)

  // —— 进窗后连续下翻的「流上下文」（定案 D21 / 验收 TC-13）——
  // 顺序沿用进入时那份列表（广场进顺广场、题材进顺该题材），续拉复用 {items,nextCursor}。
  // 翻页一律由用户手势/点击触发：这里只备好下一条是谁，绝不自动切换。
  const [feed, setFeed] = useState<FeedState>(EMPTY_FEED)
  const [feedLoading, setFeedLoading] = useState(false)
  // 回调里要读「当下」的流与当前窗，用 ref 规避闭包里的过期快照
  const feedRef = useRef<FeedState>(EMPTY_FEED)
  const openWindowRef = useRef<OpenTarget | null>(null)
  const feedPullingRef = useRef(false)

  const applyFeed = useCallback((next: FeedState) => {
    feedRef.current = next
    setFeed(next)
  }, [])

  /** 从一张卡进来（广场 / 搜索 / 作品墙）：两个键都有，窗口键走 `petIdOfCard()` 取。 */
  const openWindow = useCallback((card: CardOrigin, ctx?: FeedState) => {
    applyFeed(ctx ?? singleFeed(card))
    const target: OpenTarget = { petId: petIdOfCard(card), cardId: card.id }
    openWindowRef.current = target
    setOpen(target)
  }, [applyFeed])

  /**
   * 不是从卡进来的入口（消息中心的到达、「我的它」）：手上只有窗口键。
   * 🔴 不给它编一个卡片键——编出来的那个会被拿去调 `/cards/:cardId/messages`，又是一次 404。
   */
  const openWindowByPet = useCallback((petId: PetId) => {
    const target: OpenTarget = { petId }
    applyFeed(EMPTY_FEED)
    openWindowRef.current = target
    setOpen(target)
  }, [applyFeed])

  const closeWindow = useCallback(() => {
    openWindowRef.current = null
    setOpen(null)
  }, [])

  /** 续拉下一页并返回最新流；失败则原样返回（到底了用温柔收尾态呈现，不弹技术错误） */
  const loadMoreFeed = useCallback(async (): Promise<FeedState> => {
    const cur = feedRef.current
    if (feedPullingRef.current || cur.nextCursor === null) return cur
    feedPullingRef.current = true
    setFeedLoading(true)
    try {
      const page = await api.plaza(cur.nextCursor)
      const next = appendPage(feedRef.current, page)
      applyFeed(next)
      track('window_feed_page', { size: page.items.length })
      return next
    } catch {
      return feedRef.current
    } finally {
      feedPullingRef.current = false
      setFeedLoading(false)
    }
  }, [applyFeed])

  /** 下一条：本地有就直接切；本地到头且游标还在则先续拉，真到底了只记一次埋点（收尾态已在页内） */
  const goNextWindow = useCallback(async () => {
    const current = openWindowRef.current?.cardId ?? null
    let state = feedRef.current
    let card = localNextCard(state, indexOf(state, current))
    if (!card && state.nextCursor !== null) {
      state = await loadMoreFeed()
      card = localNextCard(state, indexOf(state, current))
    }
    if (!card) {
      track('window_feed_end', { windowId: current })
      return
    }
    track('window_feed_next', { from: current, to: card.id })
    const target: OpenTarget = { petId: petIdOfCard(card), cardId: card.id }
    openWindowRef.current = target
    setOpen(target)
  }, [loadMoreFeed])

  const goPrevWindow = useCallback(() => {
    const current = openWindowRef.current?.cardId ?? null
    const card = localPrevCard(feedRef.current, indexOf(feedRef.current, current))
    if (!card) return
    track('window_feed_prev', { from: current, to: card.id })
    const target: OpenTarget = { petId: petIdOfCard(card), cardId: card.id }
    openWindowRef.current = target
    setOpen(target)
  }, [])

  // 接近这条流的末尾就先把下一页备好，翻到最后一条时不用等（D21「不加间隔、流畅优先」）
  useEffect(() => {
    if (!open?.cardId) return
    if (shouldLoadMore(feed, indexOf(feed, open.cardId))) void loadMoreFeed()
  }, [open, feed, loadMoreFeed])

  const relations = useRelations()

  const refreshMe = useCallback(async () => {
    const m = await api.me()
    setMe(m)
    return m
  }, [])

  const refreshPet = useCallback(async () => {
    try {
      const p = await api.petMe()
      setPet(p)
    } catch {
      setPet(null)
    }
  }, [])

  // 启动路由（CR3 / C-01）：领游客 → /me
  //  · 已有回忆集（已建档 pet）→ 默认进「我的它」
  //  · 新游客 / 无回忆集 → 先进「广场·共鸣厅」浏览（低门槛观光→共情→再引导建档）
  useEffect(() => {
    let alive = true
    bootstrap()
      .then(async ({ me: m }) => {
        if (!alive) return
        setMe(m)
        if (m.hasPet) {
          await refreshPet()
          setPhase('app')
          setTab('mine')
        } else {
          setPhase('app')
          setTab('home')
        }
        // 柔性暖点（B23）：只问「有没有」，🔴 不数「有几条」——
        // 一旦算出条数，离把它渲染成红点上的数字就只差一步
        loadInbox()
          .then((list) => alive && setHasUnreadMsg(hasUnread(list)))
          .catch(() => {})
      })
      .catch(() => {
        if (!alive) return
        // 兜底：拿不到账号也让游客先进广场浏览，而不是被推进建档
        setPhase('app')
        setTab('home')
      })
    return () => {
      alive = false
    }
  }, [refreshPet])

  const friend = relations.getById(friendId)
  const reelFriend = relations.getById(reelId)

  const onboardingDone = useCallback(
    async () => {
      await refreshMe()
      await refreshPet()
      setPhase('app')
      setTab('mine')
    },
    [refreshMe, refreshPet],
  )

  // 测试用：删除当前宠物 → 回到建档，方便重入测试
  const resetPet = useCallback(async () => {
    try {
      await api.resetPet()
    } catch {
      /* 测试按钮：失败也强制回建档 */
    }
    setPet(null)
    await refreshMe()
    setPhase('onboarding')
  }, [refreshMe])

  /**
   * 打开某个人的通用「他人主页」（SPEC §2.4）：搜索的用户结果、窗口详情的作者行都落到这里。
   *
   * 口径（PRD-RESONANCE-PUBLISHING §4.1 / E1）：
   *  · 免费的关系行为一律叫「关注」，标识符与埋点走 follow_*（「订阅」与 sub_* 专属付费档位）；
   *  · 粉丝数公开且给精确数字，但只在个体主页出现，🔴 不上信息流卡片、不做任何全站作者榜单。
   */
  function handleOpenUser(userId: string) {
    setSearchOpen(false)
    closeWindow()
    setProfileUserId(userId)
  }

  /**
   * 「看过即散」（`DECISIONS B23`）：进过消息中心，底部导航那颗柔性暖点就散掉。
   * 🔴 这是**暖点**不是未读计数——散掉不代表每条都读过，也不需要代表。
   * 用 useCallback 是因为它会进 MessagesScreen 的 effect 依赖，每次新建函数会导致重复触发。
   */
  const markMessagesSeen = useCallback(() => setHasUnreadMsg(false), [])

  function routeTo(rt: Message['routeTo']) {
    switch (rt.type) {
      case 'window':
        // 边界：`routeTo` 是多态的（window/relation/record/echo），id 只是裸字符串。
        // 🔴 走 'window' 这一支时它是**窗口键**（petId），不是卡片键：
        //    后端 `/messages/arrivals` 按窗折叠，出参那个叫 `cardId` 的键里装的是
        //    petId（`EchoApi.reactionArrivals` 注明这是**永久错名**，不是迁移中间态）。
        //    ⚠️ 前端此前按 `asCardId` 盖章，与后端实际下发的东西反了。
        openWindowByPet(asPetId(rt.id))
        break
      case 'relation':
        setFriendId(rt.id)
        break
      case 'record':
        setTab('record')
        break
      case 'echo':
        setTab('mine')
        break
    }
  }

  // —— 启动/建档态 ——
  if (phase === 'loading') {
    return (
      <PhoneFrame>
        <div className="boot">
          <span className="boot-glow" />
          <p className="boot-text">回声一直都在，正在为你轻轻推开门…</p>
        </div>
      </PhoneFrame>
    )
  }

  if (phase === 'onboarding') {
    return (
      <PhoneFrame>
        <OnboardingScreen
          onComplete={onboardingDone}
          onSkip={() => {
            setPhase('app')
            setTab('home')
          }}
        />
      </PhoneFrame>
    )
  }

  // —— 全屏浮层（优先级从高到低） ——
  const renderOverlay = () => {
    // 🔴 发布页排在最前：它可能从「我的作品」页里点开，排在后面会被那一屏盖住
    if (publishOpen) {
      return <PublishScreen onClose={() => setPublishOpen(false)} />
    }
    if (worksOpen) {
      return (
        <WorksFeedScreen
          authorId={me?.accountId}
          self
          title="我的作品"
          onBack={() => setWorksOpen(false)}
          onOpenPublish={() => setPublishOpen(true)}
        />
      )
    }
    if (spectrumOpen) return <SpectrumScreen onBack={() => setSpectrumOpen(false)} />

    if (reelFriend) {
      return (
        <ReelViewer
          relation={reelFriend}
          onClose={() => setReelId(null)}
          onEnterHome={() => {
            setReelId(null)
            setFriendId(reelFriend.id)
          }}
        />
      )
    }

    if (friend) {
      return (
        <MineScreen
          pet={friend.pet}
          onOpenWindow={() => {}}
          isFriendView
          friendName={friend.name}
          onBack={() => setFriendId(null)}
        />
      )
    }

    if (open) {
      const index = indexOf(feed, open.cardId ?? null)
      return (
        // key=窗口键：每换一条都重挂详情页，献花额度/记得状态/明信片一律跟着当前这条重取，不串台
        <DetailScreen
          key={open.cardId ?? open.petId}
          petId={open.petId}
          cardId={open.cardId}
          onBack={closeWindow}
          onOpenUser={handleOpenUser}
          onBuildOwn={() => {
            closeWindow()
            if (pet) setTab('mine')
            else setPhase('onboarding')
          }}
          // 只有「顺着一条流进来」的入口才挂上下翻；
          // 搜索/消息/我的它这类单条上下文不挂，避免从别处进来却串进广场流
          feed={
            isFeedNavigable(feed) && index >= 0
              ? {
                  hasPrev: hasPrev(feed, index),
                  hasNext: hasNext(feed, index),
                  loadingMore: feedLoading,
                  onPrev: goPrevWindow,
                  onNext: () => void goNextWindow(),
                }
              : undefined
          }
        />
      )
    }

    // 他人主页排在窗口详情之后：从主页点进一扇窗时详情盖在上面，返回仍回到这个人的主页
    if (profileUserId) {
      return (
        <UserProfileScreen
          key={profileUserId}
          userId={profileUserId}
          onBack={() => setProfileUserId(null)}
          // nextCursor 不带出去：续拉走的是 GET /plaza，拿主页的游标去续会串成广场流。
          // 只把这份作品墙已加载的顺序交给详情页，翻到底就是温柔收尾。
          onOpenWindow={(card, cards) =>
            openWindow(card, { cards, nextCursor: null, category: null })
          }
        />
      )
    }
    return null
  }

  const overlay = renderOverlay()
  if (overlay) return <PhoneFrame>{overlay}</PhoneFrame>

  // —— 主界面：五签 —— 
  const renderTab = () => {
    switch (tab) {
      case 'home':
        return (
          <PlazaScreen
            onOpen={(w: Window, ctx: FeedOpenContext) =>
              openWindow(
                { id: w.id, petId: w.petId },
                {
                  cards: ctx.cards,
                  nextCursor: ctx.nextCursor,
                  category: plazaCategory,
                },
              )
            }
            onOpenSearch={() => setSearchOpen(true)}
            category={plazaCategory}
            onClearCategory={() => setPlazaCategory(null)}
          />
        )
      case 'mine':
        return pet ? (
          <MineScreen
            pet={pet}
            onOpenWindow={() => {
              // 自己的窗不是卡，只有窗口键（见 `myWindowPetId`）
              const mine = myWindowPetId(pet)
              if (mine) openWindowByPet(mine)
            }}
            onOpenSpectrum={() => setSpectrumOpen(true)}
            onPetRefresh={refreshPet}
            onResetPet={import.meta.env.DEV ? resetPet : undefined}
            relationRow={
              <RelationRow
                api={relations}
                onOpenAvatar={(r) => {
                  if (relations.hasRing(r)) {
                    relations.markReelSeen(r.id)
                    setReelId(r.id)
                  } else {
                    setFriendId(r.id)
                  }
                }}
              />
            }
          />
        ) : (
          <EmptyMine onBuild={() => setPhase('onboarding')} />
        )
      case 'record':
        return <RecordScreen />
      case 'msg':
        return <MessagesScreen onRoute={routeTo} onSeen={markMessagesSeen} />
      case 'me':
        return me ? (
          <MeScreen
            me={me}
            pet={pet}
            onOpenSpectrum={() => setSpectrumOpen(true)}
            onOpenWorks={() => setWorksOpen(true)}
            onRefresh={async () => {
              await refreshMe()
              await refreshPet()
            }}
          />
        ) : null
    }
  }

  return (
    <PhoneFrame>
      {IS_MOCK && <div className="mock-flag">本地体验模式</div>}
      <div className="screen-scroll">{renderTab()}</div>
      <BottomNav active={tab} onChange={setTab} hasUnreadMsg={hasUnreadMsg} />
      {/* 搜索页浮层：叠在广场之上、广场保持挂载 → 返回/取消不丢滚动位置（A.1） */}
      {searchOpen && (
        <SearchScreen
          from="plaza"
          onClose={() => setSearchOpen(false)}
          onOpenWindow={(card) => {
            setSearchOpen(false)
            openWindow(card)
          }}
          onOpenUser={handleOpenUser}
          onOpenTopic={(cat) => {
            setSearchOpen(false)
            setPlazaCategory(cat)
            setTab('home')
          }}
        />
      )}
    </PhoneFrame>
  )
}

/** 未建档时「我的它」的温柔空状态 */
function EmptyMine({ onBuild }: { onBuild: () => void }) {
  return (
    <div className="empty-mine">
      <span className="empty-glow" />
      <h2 className="empty-title">还没有它的一扇窗</h2>
      <p className="empty-sub">它一直都在，只是换了个方式陪你。要不要一起把它请回来？</p>
      <button className="empty-btn" onClick={onBuild}>
        为你的它，建立我的回忆集 →
      </button>
    </div>
  )
}
