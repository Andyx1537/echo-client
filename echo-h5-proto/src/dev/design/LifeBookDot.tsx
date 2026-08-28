/**
 * 「它的一生」（`W1` `LIFE_BOOK`）· 收成一个点。
 *
 * 🔴 **为什么再收一档**：这一屏的版面预算要几乎全部给回忆卡。v2 把里程碑压成横滑一整行，
 * 看着是省了，其实没省 —— 横滑片仍然吃掉一个 120px 的带子，而且**带图**，
 * 在视觉上和下面的回忆卡是同一个量级，等于给它保留了一块和主内容抢注意力的位置。
 *
 * 收起态只留**一行 44px 的文字条**，展开也不给图 ——
 * 里程碑本来就常常没有对应的照片（「相遇那天」谁也没来得及拍），
 * 之前那三张抽象封面是排版凑出来的，不是内容。
 *
 * ⚠️ **就地展开，不用 bottom sheet**：这一段是「顺手看一眼」的性质，
 * 弹层会把它升格成一次独立的浏览，反而比横滑更重。
 */

import { useState } from 'react'
import { LIFE_BOOK } from './designData'

export default function LifeBookDot({ open: forced }: { open?: boolean }) {
  const [open, setOpen] = useState(false)
  const expanded = forced ?? open
  const years = `${LIFE_BOOK[0].year} – ${LIFE_BOOK[LIFE_BOOK.length - 1].year}`

  return (
    <section className={`lb ${expanded ? 'lb-open' : ''}`}>
      <button className="lb-bar" onClick={() => setOpen((v) => !v)}>
        <span className="lb-dot" />
        <span className="lb-label">它的一生</span>
        <span className="lb-years">{years}</span>
        <span className="lb-count">{LIFE_BOOK.length} 个节点</span>
        <span className="lb-chev">{expanded ? '⌃' : '⌄'}</span>
      </button>
      {expanded && (
        <ol className="lb-line">
          {LIFE_BOOK.map((it) => (
            <li key={it.title} className="lb-item">
              <span className="lb-node" />
              <span className="lb-year">{it.year}</span>
              <div className="lb-text">
                <p className="lb-title">{it.title}</p>
                <p className="lb-desc">{it.desc}</p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
