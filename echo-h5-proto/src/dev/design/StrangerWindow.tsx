/**
 * 陌生人视角的窗口页 —— 重做。
 *
 * 🔴 **起点换了**：不是「把主人的私密层裁掉之后剩下什么」，而是「一个从广场点进来的人，
 * 需要拿到什么才愿意多待三十秒」。他带着对某一条具体回忆的兴趣进来，要回答的是两句话：
 * **这是谁**（封面 + 名字 + 一句引言 + 它的一生）、**它还有什么**（公开卡 + 明信片）。
 *
 * 🔴 **可见性红线一格没动**，本页对陌生人不渲染、也不接收下列字段：
 *   `TEMPERATURE`(W13) · `RECENT_ECHO_LIST`(W15) · `REMEMBER_FACES`(W3) ·
 *   `POSTCARD_LOCKED`(W12) · `VISIBILITY_SETTING`(W14) · `FLOWERS_RECEIVED`(W9) · `SEEN_COUNT`(W10)
 * 出的每一块都能在 `VisibilityMatrix` 里找到对应行：
 *   `LIFE_BOOK`(W1 三档全可见) · `WARMTH_LEVEL`(W2 三档全可见) · `ME_REMEMBERED`(W4) ·
 *   `REMEMBER_BUTTON`(W5) · `FLOWER_BUTTON`(W8) · `POSTCARD_UNLOCKED`(W11，⚠️ **需契约放开**) ·
 *   `B18` 公开卡列表（⚠️ **该块尚不存在，需新增**）。
 */

import { useState } from 'react'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import AiGeneratedBadge from '../../components/AiGeneratedBadge'
import { WarmthMark } from './WarmthMark'
import CardList, { type CardTypeKey } from './CardTypes'
import LifeBookDot from './LifeBookDot'
import {
  DESIGN_POSTCARDS,
  HEIHEI_PUBLIC_CARDS,
  LIFE_BOOK,
  type DesignPostcard,
  type PublicCard,
  type WarmthTier,
} from './designData'
import type { Placeholder } from '../../types'
import { STRANGER_PET } from '../visualCompareData'

const OWNER = { name: '念夏', avatar: 'linear-gradient(135deg,#e6d3ea,#c1a8d4)' }

// ------------------------------------------------------------
// 公共零件
// ------------------------------------------------------------

/**
 * Hero。🔴 **两条压暗带，不是一条**：名字在上、作者行在下，只压一头必然有一头读不出来
 * （`MineScreen` 今天正是只压了下面，名字压在实拍封面的亮部上）。
 */
function Hero({ tier }: { tier: WarmthTier }) {
  return (
    <div className="sw-hero">
      {/* 角标不走 CoverPlaceholder 的左下角默认位 —— 那里压着作者行，同 MineScreen 的处理 */}
      <CoverPlaceholder data={STRANGER_PET.cover} className="sw-hero-cover" sizes="100vw" aiBadge="none" />
      <span className="sw-hero-top" />
      <span className="sw-hero-bottom" />
      <div className="sw-hero-text">
        <AiGeneratedBadge variant="hero" />
        <h1 className="sw-hero-name">{STRANGER_PET.name}</h1>
        <p className="sw-hero-sign">{STRANGER_PET.signature}</p>
      </div>
      <div className="sw-hero-foot">
        <span className="sw-owner-avatar" style={{ background: OWNER.avatar }} />
        <span className="sw-owner-name">{OWNER.name} 的一只猫</span>
        <span className="sw-hero-dot" />
        <span className="sw-hero-years">2016 – 2024</span>
      </div>
      {/* W2：暖光在这一屏只出现这一次 —— 在窗自己身上，不在别人的卡上 */}
      <div className="sw-hero-warmth">
        <WarmthMark tier={tier} size="lg" />
      </div>
    </div>
  )
}

function PullQuote() {
  return (
    <div className="sw-quote">
      <span className="sw-quote-mark">“</span>
      <p className="sw-quote-text">{STRANGER_PET.recent}</p>
      <p className="sw-quote-by">{OWNER.name} 最近留在这扇窗上的一句</p>
    </div>
  )
}

function SectionHead({ title, note, action }: { title: string; note?: string; action?: string }) {
  return (
    <div className="sw-sec-head">
      <h2 className="sw-sec-title">{title}</h2>
      {note && <span className="sw-sec-note">{note}</span>}
      {action && <span className="sw-sec-action">{action} ›</span>}
    </div>
  )
}

/** 卡没有封面时的兜底（只给旧卡型用；新卡型走 `CardTypes` 的便签形态） */
const NO_COVER: Placeholder = { gradient: 'linear-gradient(150deg,#fffaf0,#efe3cd)', emoji: '✎', aiGenerated: false }

/**
 * `B18` 的卡片形态 · 大卡版。
 *
 * 取舍：**封面 + 标题 + 两行摘要 + 日期**，主题标签只出第一个。
 * 🔴 不出互动数、不出「被记得」——那是窗级的信号，落到每一张卡上就变成了逐条比数量。
 */
export function PublicCardBig({
  card,
  slot,
}: {
  card: PublicCard
  /** 作者视角往右上角塞可见性控件用；陌生人视角传空 */
  slot?: React.ReactNode
}) {
  return (
    <article className="sw-card">
      <div className="sw-card-cover-wrap">
        <CoverPlaceholder data={card.cover ?? NO_COVER} className="sw-card-cover" />
        {slot && <div className="sw-card-slot">{slot}</div>}
      </div>
      <div className="sw-card-body">
        <h3 className="sw-card-title">{card.title}</h3>
        <p className="sw-card-excerpt">{card.excerpt}</p>
        <p className="sw-card-date">{card.date}</p>
      </div>
    </article>
  )
}

/** `B18` 的卡片形态 · 紧凑行版（v1 用） */
function PublicCardRow({ card }: { card: PublicCard }) {
  return (
    <article className="sw-row">
      <CoverPlaceholder data={card.cover ?? NO_COVER} className="sw-row-cover" aiBadge="compact" />
      <div className="sw-row-body">
        <h3 className="sw-row-title">{card.title}</h3>
        <p className="sw-row-excerpt">{card.excerpt}</p>
        <p className="sw-row-date">
          {card.date}
        </p>
      </div>
    </article>
  )
}

function PostcardTile({ p }: { p: DesignPostcard }) {
  return (
    <div className="sw-pc">
      <CoverPlaceholder data={p.placeholder} className="sw-pc-cover" aiBadge="compact" />
      <p className="sw-pc-cap">{p.caption}</p>
      <p className="sw-pc-date">{p.date}</p>
    </div>
  )
}

/**
 * `B18` 空态。
 * 🔴 **不画一个假的空框架**：这只它还没往外发过卡，这一屏就该老实说，
 * 并把出口指向唯一还成立的动作（记得它），而不是「敬请期待」。
 */
function CardsEmpty() {
  return (
    <div className="sw-empty">
      <span className="sw-empty-glow" />
      <p className="sw-empty-title">它还没有公开的回忆卡</p>
      <p className="sw-empty-sub">主人把这些留在了更里面一层。你看到的这扇窗，就是它此刻愿意让世界记住的样子。</p>
    </div>
  )
}

function ActionBar() {
  return (
    <div className="sw-actions">
      <button className="sw-act sw-act-main">🌿 我记得它</button>
      <button className="sw-act sw-act-sub">🌸 留一束心意</button>
    </div>
  )
}

// ------------------------------------------------------------
// v1「一条线读下来」：全纵向、无横滑
// ------------------------------------------------------------

function StrangerV1({ tier, empty }: { tier: WarmthTier; empty: boolean }) {
  const cards = empty ? [] : HEIHEI_PUBLIC_CARDS
  return (
    <div className="screen-scroll sw">
      <div className="sw-nav">
        <span className="sw-nav-back">‹</span>
        <span className="sw-nav-title">{STRANGER_PET.name}的一扇窗</span>
      </div>
      <Hero tier={tier} />
      <div className="sw-body">
        <PullQuote />

        <SectionHead title="它公开的回忆卡" note={cards.length ? `${cards.length} 张` : undefined} />
        {cards.length ? (
          <div className="sw-rows">
            {cards.map((c) => (
              <PublicCardRow key={c.id} card={c} />
            ))}
          </div>
        ) : (
          <CardsEmpty />
        )}

        <SectionHead title="它的一生" />
        <div className="sw-life-list">
          {LIFE_BOOK.map((it) => (
            <div key={it.title} className="sw-life-row">
              <CoverPlaceholder data={it.placeholder} className="sw-life-row-cover" aiBadge="compact" />
              <div>
                <p className="sw-life-row-year">{it.year}</p>
                <p className="sw-life-row-title">{it.title}</p>
                <p className="sw-life-row-desc">{it.desc}</p>
              </div>
            </div>
          ))}
        </div>

        <SectionHead title="它收到的明信片" />
        <div className="sw-pc-grid">
          {DESIGN_POSTCARDS.map((p) => (
            <PostcardTile key={p.id} p={p} />
          ))}
        </div>

        <ActionBar />
        <p className="sw-owner-link">看看 {OWNER.name} 的其他窗 ›</p>
      </div>
    </div>
  )
}

// ------------------------------------------------------------
// v2「章节 + 横滑」：推荐
// ------------------------------------------------------------

function StrangerV2({
  tier,
  empty,
  cardType = 'A',
  cards,
  lifeOpen,
  limit = 3,
}: {
  tier: WarmthTier
  empty: boolean
  cardType?: CardTypeKey
  /** 出边界图 / 密度图时换一批卡；缺省就是这只它的公开卡 */
  cards?: PublicCard[]
  lifeOpen?: boolean
  limit?: number
}) {
  const all = empty ? [] : cards ?? HEIHEI_PUBLIC_CARDS
  // 🔴 折叠阈值 = 3。理由写在 README：3 张刚好占满一屏之下的一屏，
  //   再多就变成「无限往下刷」，而这一屏的目的是让人看完然后决定要不要记得它。
  const [expanded, setExpanded] = useState(false)
  const shown = expanded ? all : all.slice(0, limit)
  const rest = all.length - shown.length

  return (
    <div className="screen-scroll sw sw-v2">
      <div className="sw-nav sw-nav-float">
        <span className="sw-nav-back">‹</span>
      </div>
      <Hero tier={tier} />
      <div className="sw-body">
        <PullQuote />

        {/* 🔴 「这是谁」收成一行 44px 的点，把这一屏的版面预算全部让给回忆卡 */}
        <LifeBookDot open={lifeOpen} />

        {/* 「它还有什么」：这一屏真正的主体 */}
        <SectionHead
          title="它公开的回忆卡"
          note={all.length ? `${all.length} 张` : undefined}
        />
        {all.length ? (
          <>
            <CardList type={cardType} cards={shown} />
            {rest > 0 && (
              <button className="sw-more" onClick={() => setExpanded(true)}>
                还有 {rest} 张 · 看全部
              </button>
            )}
          </>
        ) : (
          <CardsEmpty />
        )}

        <SectionHead title="它收到的明信片" note="来自这扇窗的春夏秋冬" />
        <div className="sw-hscroll sw-pc-scroll">
          {DESIGN_POSTCARDS.map((p) => (
            <PostcardTile key={p.id} p={p} />
          ))}
        </div>

        <ActionBar />
        <p className="sw-owner-link">看看 {OWNER.name} 的其他窗 ›</p>
      </div>
    </div>
  )
}

export default function StrangerWindow({
  variant,
  tier = 'high',
  empty = false,
  cardType,
  cards,
  lifeOpen,
  limit,
}: {
  variant: 'v1' | 'v2'
  tier?: WarmthTier
  empty?: boolean
  cardType?: CardTypeKey
  cards?: PublicCard[]
  lifeOpen?: boolean
  limit?: number
}) {
  if (variant === 'v1') return <StrangerV1 tier={tier} empty={empty} />
  return (
    <StrangerV2 tier={tier} empty={empty} cardType={cardType} cards={cards} lifeOpen={lifeOpen} limit={limit} />
  )
}
