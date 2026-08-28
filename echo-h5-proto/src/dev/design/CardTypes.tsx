/**
 * `B18` 回忆卡的四种卡型。
 *
 * 🔴 **这一屏的版面预算几乎全部给回忆卡**，所以四种卡型比的不是「好不好看」，是**图占了多少**：
 * 甲 82% · 丙 83% · 乙 100% · 丁 100%（后两种文字压在图上，不额外吃高度）。
 *
 * 三条硬约束，四种卡型一视同仁：
 * 1. **一行文字**，超出用省略号；取值链 `title → 正文首句`（见 {@link cardLine}），
 *    ⚠️ 不能只取 `title` —— AI 回声与手写 record 都没有标题。
 * 2. **日期在同一行**，`flex:none` 永不被挤走，文字先让位。
 * 3. **无图的卡换形态，不留空图位**：退成「便签」，见 {@link NoteCard}。
 */

import CoverPlaceholder from '../../components/CoverPlaceholder'
import AiGeneratedBadge from '../../components/AiGeneratedBadge'
import { isAiGenerated } from '../../lib/aiGenerated'
import { cardLine, type PublicCard } from './designData'

export type CardTypeKey = 'A' | 'B' | 'C' | 'D'

/**
 * ⚠️ **「图占比」这个数会骗人**：四种卡型的图**一样宽**（都是 354），
 * 甲和丁的图连高度都一样（236）。所谓 84% 与 100% 的差别不是「图更大」，
 * 是**那 46px 的说明文字落在纸上还是压在图上**。
 * 真正让图变大的只有乙（300 高的竖构图），代价是强裁剪。
 */
export const CARD_TYPE_META: Record<CardTypeKey, { name: string; ratio: string; note: string }> = {
  A: { name: '甲 · 图下一行', ratio: '图 84%', note: '3:2 大图 + 图外一行；字不压图，最好读' },
  B: { name: '乙 · 全图压字', ratio: '图 100%', note: '5:6 竖构图，图最大；代价是强裁剪 + 字压在图上' },
  C: { name: '丙 · 双列相册', ratio: '图 83%', note: '1:1 双列，一屏六张；一行只剩十来个字' },
  D: { name: '丁 · 大图浮层', ratio: '图 100%', note: '与甲同一张 3:2 大图，一行改成毛玻璃胶囊浮在图内' },
}

// ------------------------------------------------------------
// 零件
// ------------------------------------------------------------

/**
 * 那一行。
 * 🔴 文字 `min-width:0` 才会真的省略 —— flex 子项默认 `min-width:auto`，
 * 不改的话它会把日期顶出容器而不是自己收省略号。
 */
function Line({ card, className }: { card: PublicCard; className?: string }) {
  return (
    <div className={`ct-line ${className ?? ''}`}>
      <span className="ct-line-text">{cardLine(card)}</span>
      <time className="ct-line-date">{card.date}</time>
    </div>
  )
}

/** 图上角标：AI 标挪到左上，把左下让给那一行文字 */
function Cover({
  card,
  className,
  overlay,
}: {
  card: PublicCard
  className: string
  /** 文字要压在图上时，加一条底部压暗带并把 AI 标顶到左上 */
  overlay?: boolean
}) {
  return (
    <div className={`ct-cover ${className}`}>
      <CoverPlaceholder
        data={card.cover!}
        className="ct-cover-img"
        sizes="100vw"
        aiBadge={overlay ? 'none' : 'compact'}
      />
      {overlay && isAiGenerated(card.cover!) && <AiGeneratedBadge variant="compact" className="ct-ai-top" />}
      {overlay && <span className="ct-scrim" />}
    </div>
  )
}

/**
 * 无图的卡。
 *
 * 🔴 **不是「图位留空」，是换一种东西**。手写 `record` 本来就是一段话，
 * 给它配一个灰框等于承认排版失败；退成便签之后，它在列表里反而成了节奏上的换气 ——
 * 一列大图里夹一张纸，比一列大图里夹一个空框好看得多，也诚实得多。
 *
 * 便签把「一行」的约束放宽到正文三行：**没有图的时候，字就是内容本身**，
 * 这不违反第 1 条 —— 第 1 条约束的是「图旁边的那行说明」。
 */
function NoteCard({ card, square }: { card: PublicCard; square?: boolean }) {
  return (
    <article className={`ct-note ${square ? 'ct-note-sq' : ''}`}>
      <span className="ct-note-edge" />
      <div className="ct-note-body">
        {card.title && <p className="ct-note-title">{card.title}</p>}
        <p className="ct-note-text">{card.excerpt}</p>
        <div className="ct-note-foot">
          <time className="ct-line-date">{card.date}</time>
        </div>
      </div>
    </article>
  )
}

// ------------------------------------------------------------
// 四种卡型
// ------------------------------------------------------------

interface CardProps {
  card: PublicCard
}

/** 甲：3:2 大图 + 图外一行。文字落在米色纸上，是四种里最好读的一种 */
function CardA({ card }: CardProps) {
  if (!card.cover) return <NoteCard card={card} />
  return (
    <article className="ct-a">
      <Cover card={card} className="ct-a-cover" />
      <Line card={card} className="ct-a-line" />
    </article>
  )
}

/** 乙：5:6 竖构图，一行压在图底。图占满，代价是文字读性依赖压暗带 */
function CardB({ card }: CardProps) {
  if (!card.cover) return <NoteCard card={card} />
  return (
    <article className="ct-b">
      <Cover card={card} className="ct-b-cover" overlay />
      <Line card={card} className="ct-b-line" />
    </article>
  )
}

/** 丙：1:1 双列。密度最高，代价是一行只剩十来个字，日期得缩到年月 */
function CardC({ card }: CardProps) {
  if (!card.cover) return <NoteCard card={card} square />
  return (
    <article className="ct-c">
      <Cover card={card} className="ct-c-cover" />
      <div className="ct-line ct-c-line">
        <span className="ct-line-text">{cardLine(card)}</span>
        <time className="ct-line-date">{card.date.slice(0, 7)}</time>
      </div>
    </article>
  )
}

/** 丁：3:2 大图 + 毛玻璃胶囊浮在图内。图仍占满，但文字有自己的底，不靠压暗带 */
function CardD({ card }: CardProps) {
  if (!card.cover) return <NoteCard card={card} />
  return (
    <article className="ct-d">
      <Cover card={card} className="ct-d-cover" overlay />
      <Line card={card} className="ct-d-line" />
    </article>
  )
}

const RENDER: Record<CardTypeKey, (p: CardProps) => React.ReactElement> = {
  A: CardA,
  B: CardB,
  C: CardC,
  D: CardD,
}

/** 一整段 `B18` 列表。丙是双列，其余单列 */
export default function CardList({ type, cards }: { type: CardTypeKey; cards: PublicCard[] }) {
  const One = RENDER[type]
  return (
    <div className={`ct-list ct-list-${type.toLowerCase()}`}>
      {cards.map((c) => (
        <One key={c.id} card={c} />
      ))}
    </div>
  )
}
