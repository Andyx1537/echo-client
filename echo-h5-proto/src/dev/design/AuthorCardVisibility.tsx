/**
 * 作者视角：**逐张选择这只它的哪些卡对陌生人开放**。
 *
 * 核实结论（正文见 docs/visual/README-redesign.md）：
 *  · **窗级**可见性三档 —— 端到端已经做完了，`MeScreen` 就有入口（`PATCH /pet/me`）。
 *  · **卡级**可见性 —— `t_memory_card.visibility` 有列、有 `CHECK IN ('private','friends','public')`、
 *    默认 `private`；`t_card_visibility_log.changedRole` 的白名单里有 `author`。
 *    🔴 **但没有任何端点，前端也没有「卡」这个类型。**
 *    所以既不是全新功能，也不是「只缺一个入口」—— 缺的是端点那一层。
 *
 * 🔴 **一条设计上的硬约束**：卡的可见性**不得宽于窗的可见性**，实际生效值取两者的交集。
 * 否则「私密的窗 + 公开的卡」就是一条绕过窗可见性的路径，而用户在设窗为私密时以为自己已经关严了。
 */

import { useState } from 'react'
import type { Visibility } from '../../types'
import CoverPlaceholder from '../../components/CoverPlaceholder'
import { HEIHEI_CARDS, type PublicCard } from './designData'
import { STRANGER_PET } from '../visualCompareData'

const VIS_META: Record<Visibility, { icon: string; short: string; label: string; hint: string }> = {
  private: { icon: '🔒', short: '私密', label: '只有我自己', hint: '不出现在广场，也不出现在任何人的窗里。' },
  friends: { icon: '👥', short: '亲友', label: '亲友可见', hint: '只有互相添加过的亲友能看到这张卡。' },
  public: { icon: '🌏', short: '公开', label: '所有人可见', hint: '会出现在广场，陌生人点进这扇窗也能看到。' },
}

const ORDER: Visibility[] = ['public', 'friends', 'private']

/** 卡封面右上角那枚可见性 chip —— 入口就是它，不另开设置页 */
function VisChip({ v, onClick }: { v: Visibility; onClick: () => void }) {
  return (
    <button className={`av-chip av-chip-${v}`} onClick={onClick}>
      <span className="av-chip-ico">{VIS_META[v].icon}</span>
      <span className="av-chip-text">{VIS_META[v].short}</span>
    </button>
  )
}

function CardItem({ card, onPick }: { card: PublicCard; onPick: () => void }) {
  return (
    <article className={`sw-card av-card av-card-${card.visibility}`}>
      <div className="sw-card-cover-wrap">
        <CoverPlaceholder
          data={card.cover ?? { gradient: 'linear-gradient(150deg,#fffaf0,#efe3cd)', emoji: '✎', aiGenerated: false }}
          className="sw-card-cover"
        />
        <div className="sw-card-slot">
          <VisChip v={card.visibility} onClick={onPick} />
        </div>
      </div>
      <div className="sw-card-body">
        <h3 className="sw-card-title">{card.title}</h3>
        <p className="sw-card-excerpt">{card.excerpt}</p>
        <p className="sw-card-date">{card.date}</p>
      </div>
    </article>
  )
}

/** 三档选择器。⚠️ 超出窗可见性的那几档会**变灰但仍然显示**——藏起来用户会以为功能没了。 */
function VisSheet({
  card,
  windowVis,
  onClose,
}: {
  card: PublicCard
  windowVis: Visibility
  onClose: () => void
}) {
  const cap = ORDER.indexOf(windowVis)
  return (
    <>
      <div className="av-mask" onClick={onClose} />
      <div className="av-sheet">
        <div className="av-sheet-grip" />
        <p className="av-sheet-title">谁能看到这张卡</p>
        <p className="av-sheet-card">「{card.title}」</p>
        <div className="av-sheet-list">
          {ORDER.map((v, i) => {
            const blocked = i < cap
            return (
              <button key={v} className={`av-opt ${card.visibility === v ? 'on' : ''} ${blocked ? 'off' : ''}`}>
                <span className="av-opt-ico">{VIS_META[v].icon}</span>
                <span className="av-opt-main">
                  <span className="av-opt-label">{VIS_META[v].label}</span>
                  <span className="av-opt-hint">
                    {blocked
                      ? `这扇窗现在是「${VIS_META[windowVis].label}」，卡不能比窗更开放`
                      : VIS_META[v].hint}
                  </span>
                </span>
                {card.visibility === v && <span className="av-opt-tick">✓</span>}
              </button>
            )
          })}
        </div>
        <p className="av-sheet-foot">改动随时可以再改回来。已经看过的人不会收到通知。</p>
      </div>
    </>
  )
}

export default function AuthorCardVisibility({
  sheet = false,
  windowVis = 'public',
}: {
  /** 直接展开选择器，用于出图 */
  sheet?: boolean
  windowVis?: Visibility
}) {
  const [picked, setPicked] = useState<PublicCard | null>(sheet ? HEIHEI_CARDS[4] : null)
  const publicCount = HEIHEI_CARDS.filter((c) => c.visibility === 'public').length

  return (
    <div className="screen-scroll sw av">
      <div className="sw-nav">
        <span className="sw-nav-back">‹</span>
        <span className="sw-nav-title">{STRANGER_PET.name}的窗</span>
        <span className="sw-nav-right">编辑</span>
      </div>

      <div className="sw-body av-body">
        <div className="av-head">
          <h2 className="av-head-title">它的回忆卡</h2>
          <p className="av-head-sub">
            共 {HEIHEI_CARDS.length} 张 · <b>{publicCount} 张</b>对所有人公开
          </p>
        </div>

        {/* 一句能兜住整块的说明。🔴 不写成「设置」的口吻，写成「这扇窗现在长什么样」 */}
        <div className="av-banner">
          <span className="av-banner-ico">👁️</span>
          <p className="av-banner-text">
            陌生人点进这扇窗，看到的就是标着 <b>🌏 公开</b> 的这几张。
            <span className="av-banner-link">看看别人眼里的样子 ›</span>
          </p>
        </div>

        <div className="sw-cards">
          {HEIHEI_CARDS.map((c) => (
            <CardItem key={c.id} card={c} onPick={() => setPicked(c)} />
          ))}
        </div>
      </div>

      {picked && <VisSheet card={picked} windowVis={windowVis} onClose={() => setPicked(null)} />}
    </div>
  )
}
