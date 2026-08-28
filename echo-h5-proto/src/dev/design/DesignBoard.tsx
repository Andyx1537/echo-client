/**
 * 设计稿出图脚手架。`?design=<key>` 走这里，每个 key 对应一张要交的图。
 * 🔴 全部是真实 React 组件 + 真实 CSS 渲染，没有一张是画的或拼的。
 */

import PhoneFrame from '../../components/PhoneFrame'
import MineScreen from '../../components/MineScreen'
import { STRANGER_PET } from '../visualCompareData'
import StrangerWindow from './StrangerWindow'
import { WARMTH_PHRASE } from '../../lib/warmth'
import AuthorCardVisibility from './AuthorCardVisibility'
import CardList, { CARD_TYPE_META, type CardTypeKey } from './CardTypes'
import LifeBookDot from './LifeBookDot'
import {
  CARD_EDGE_CASES,
  CARD_SAMPLES,
  MANY_CARDS,
  ONE_CARD,
  type PublicCard,
} from './designData'
import './design.css'

/** 🔴 推荐卡型。理由写在 docs/visual/README-cards.md */
const REC: CardTypeKey = 'A'
const TYPES: CardTypeKey[] = ['A', 'B', 'C', 'D']

function Framed({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="dz-wrap">
      <p className="dz-label">{label}</p>
      {sub && <p className="dz-sub">{sub}</p>}
      <PhoneFrame>{children}</PhoneFrame>
    </div>
  )
}

/**
 * 卡型比稿位。
 *
 * 🔴 **四种卡型比的是同一个位置**：都放在「它的一生」那一行之下、章节头之后 ——
 * 也就是它们上线后真正会待的地方。不截 hero 只是为了把有限的一屏全部留给被比较的那一项，
 * 上下文（收起的一生 + 章节头）一格没少。
 */
function CardsBoard({
  type,
  cards = CARD_SAMPLES,
  note,
  sub,
  label,
}: {
  type: CardTypeKey
  cards?: PublicCard[]
  note?: string
  sub?: string
  label?: string
}) {
  const meta = CARD_TYPE_META[type]
  return (
    <Framed
      label={label ?? `${meta.name} · ${meta.ratio}${type === REC ? '（推荐）' : ''}`}
      sub={sub ?? meta.note}
    >
      <div className="screen-scroll sw sw-v2">
        <div className="sw-body dz-cards-only">
          <LifeBookDot />
          <div className="sw-sec-head">
            <h2 className="sw-sec-title">它公开的回忆卡</h2>
            <span className="sw-sec-note">{note ?? `${cards.length} 张`}</span>
          </div>
          <CardList type={type} cards={cards} />
        </div>
      </div>
    </Framed>
  )
}

export default function DesignBoard({ params }: { params: URLSearchParams }) {
  const key = params.get('design')

  switch (key) {
    /* 🔄 `home-warmth*` 四块设计稿板已于 2026-08-27 删除：设计已经落到生产代码
       （`components/WarmthGlow.tsx`），板子的问题答完了。三档图留在 docs/visual/，
       要重出请直接跑真应用并改 mock 的 warmthByWindow['w-mine']，见
       `docs/visual/README-home-warmth.md` §六。 */

    // —— 陌生人窗口页 ——
    case 'stranger-v1':
      return (
        <Framed label="陌生人视角 · v1「一条线读下来」" sub="全纵向、无横滑；改动面最小">
          <StrangerWindow variant="v1" />
        </Framed>
      )
    case 'stranger-v2':
      return (
        <Framed label="陌生人视角 · v2「章节 + 横滑」（推荐）" sub="它的一生横滑 / 公开卡纵向大卡 / 明信片横滑">
          <StrangerWindow variant="v2" />
        </Framed>
      )
    case 'stranger-empty':
      return (
        <Framed label="陌生人视角 · v2 · 一张公开卡都没有时" sub="B18 空态，不画假框架">
          <StrangerWindow variant="v2" empty />
        </Framed>
      )
    case 'stranger-both':
      return (
        <div className="dz-row">
          <Framed label="v1「一条线读下来」">
            <StrangerWindow variant="v1" />
          </Framed>
          <Framed label="v2「章节 + 横滑」（推荐）">
            <StrangerWindow variant="v2" />
          </Framed>
        </div>
      )

    /* 一套文案在**陌生人**版面上的核对：同一句 `WARMTH_PHRASE`，换的只有档位。
       🔴 这块板存在的唯一理由是**验证「一套通吃」这个前提真的成立** ——
       低档那句「这扇窗为它留着」若在陌生人页读不通，一套就不成立，得回去重写。 */
    case 'visitor-tiers':
      return (
        <div className="dz-row">
          {(['low', 'mid', 'high'] as const).map((t) => (
            <Framed key={t} label={`陌生人看到的 · ${t} 档`} sub={WARMTH_PHRASE[t]}>
              <StrangerWindow variant="v2" tier={t} />
            </Framed>
          ))}
        </div>
      )

    // —— B18 回忆卡卡型 ——
    case 'cards-a':
    case 'cards-b':
    case 'cards-c':
    case 'cards-d':
      return <CardsBoard type={key.slice(-1).toUpperCase() as CardTypeKey} />
    case 'cards-all':
      return (
        <div className="dz-row">
          {TYPES.map((t) => (
            <CardsBoard key={t} type={t} />
          ))}
        </div>
      )

    // —— 边界：无图 / 超长标题 / 无标题 ——
    case 'cards-edge':
      return (
        <CardsBoard
          type={REC}
          cards={CARD_EDGE_CASES}
          note="4 张 · 边界"
          sub="① 正常 ② 超长标题（30 字顶格）③ 无标题（回落正文首句）④ 无图（退成便签）"
        />
      )
    case 'cards-edge-all':
      return (
        <div className="dz-row">
          {TYPES.map((t) => (
            <CardsBoard key={t} type={t} cards={CARD_EDGE_CASES} note="4 张 · 边界" />
          ))}
        </div>
      )

    // —— 密度：1 张 vs 十几张 ——
    case 'cards-one':
      return <CardsBoard type={REC} cards={ONE_CARD} note="1 张" sub="只有一张卡：不折叠、不出「看全部」" />
    case 'cards-many':
      return (
        <CardsBoard type={REC} cards={MANY_CARDS} note={`${MANY_CARDS.length} 张`} sub="十几张时的密度（此处放开折叠，看全量）" />
      )
    case 'cards-density':
      return (
        <div className="dz-row">
          <CardsBoard type={REC} cards={ONE_CARD} note="1 张" />
          <CardsBoard type={REC} cards={MANY_CARDS} note={`${MANY_CARDS.length} 张`} />
        </div>
      )

    // —— 「它的一生」收起 / 展开 ——
    case 'life-collapsed':
    case 'life-expanded': {
      const open = key === 'life-expanded'
      return (
        <Framed
          label={open ? '它的一生 · 展开态' : '它的一生 · 收起态'}
          sub={open ? '就地展开三个节点，纯文字时间线，不占图位' : '一行 44px，版面预算全部让给回忆卡'}
        >
          <div className="screen-scroll sw sw-v2">
            <div className="sw-body dz-cards-only">
              <LifeBookDot open={open} />
              <div className="sw-sec-head">
                <h2 className="sw-sec-title">它公开的回忆卡</h2>
                <span className="sw-sec-note">3 张</span>
              </div>
              <CardList type={REC} cards={CARD_SAMPLES} />
            </div>
          </div>
        </Framed>
      )
    }
    case 'life-both':
      return (
        <div className="dz-row">
          {[false, true].map((open) => (
            <Framed key={String(open)} label={open ? '展开态' : '收起态'}>
              <div className="screen-scroll sw sw-v2">
                <div className="sw-body dz-cards-only">
                  <LifeBookDot open={open} />
                  <div className="sw-sec-head">
                    <h2 className="sw-sec-title">它公开的回忆卡</h2>
                    <span className="sw-sec-note">3 张</span>
                  </div>
                  <CardList type={REC} cards={CARD_SAMPLES} />
                </div>
              </div>
            </Framed>
          ))}
        </div>
      )

    // —— 推荐卡型放回 v2 的完整上下文 ——
    case 'stranger-v2-cards':
      return (
        <Framed
          label={`陌生人视角 v2 · ${CARD_TYPE_META[REC].name}（推荐）`}
          sub="一生收成一个点 · 回忆卡吃掉整个版面 · 明信片仍在下面"
        >
          <StrangerWindow variant="v2" cardType={REC} />
        </Framed>
      )

    // —— 作者可见性 ——
    case 'author-vis':
      return (
        <Framed label="作者视角 · 逐张选择公开范围" sub="入口就是卡封面右上角那枚 chip，不另开设置页">
          <AuthorCardVisibility />
        </Framed>
      )
    case 'author-vis-sheet':
      return (
        <Framed label="作者视角 · 三档选择器" sub="超出窗可见性的档位变灰但仍显示">
          <AuthorCardVisibility sheet />
        </Framed>
      )
    case 'author-vis-capped':
      return (
        <Framed label="作者视角 · 窗是「亲友可见」时" sub="🔴 卡不得宽于窗：「所有人可见」这一档被锁住并说明原因">
          <AuthorCardVisibility sheet windowVis="friends" />
        </Framed>
      )

    // —— MineScreen 主卡对比度修复 · 前后对照 ——
    // 「前」用一层 dev CSS 把修复整个撤销（`.dz-hero-before`），保证两边只差这一处。
    case 'hero-fix':
      return (
        <div className="dz-row">
          {(['before', 'after'] as const).map((s) => (
            <div key={s} className={`dz-wrap ${s === 'before' ? 'dz-hero-before' : ''}`}>
              <p className="dz-label">{s === 'before' ? '修复前：名字压在封面亮部' : '修复后：名字上方加压暗带'}</p>
              <PhoneFrame>
                <MineScreen pet={STRANGER_PET} onOpenWindow={() => {}} />
              </PhoneFrame>
            </div>
          ))}
        </div>
      )

    default:
      return (
        <div className="vc-index">
          <h1>设计稿（仅开发模式）</h1>
          <ul>
            {[
              'cards-a', 'cards-b', 'cards-c', 'cards-d', 'cards-all',
              'cards-edge', 'cards-edge-all', 'cards-one', 'cards-many', 'cards-density',
              'life-collapsed', 'life-expanded', 'life-both', 'stranger-v2-cards',
              'visitor-tiers',
              'stranger-v1', 'stranger-v2', 'stranger-empty', 'stranger-both',
              'author-vis', 'author-vis-sheet', 'author-vis-capped', 'hero-fix',
            ].map((k) => (
              <li key={k}>
                <a href={`?design=${k}`}>{k}</a>
              </li>
            ))}
          </ul>
        </div>
      )
  }
}
