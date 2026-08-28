import { useEffect, useState } from 'react'
import { api } from '../api'
import type { PetId } from '../lib/ids'
import { warmthTier, WARMTH_PHRASE, type WarmthTier } from '../lib/warmth'

/**
 * 暖光块：主人自己那两页上的「它被记着」。
 *
 * 落点裁定（`H-4` / `H-5`，2026-08-27）：暖光**不上广场、不上搜索**，
 * 只在窗口详情页（面孔墙那一层）与**主人自己的两页**出现——
 * `MineScreen`（那只它的页）与 `MeScreen`（「被记得的回响」那一格）。
 *
 * 🔴 **有意不出面孔。** 详情页的暖光是「光晕 + 面孔墙」，这里只有光。
 * 理由不是省版面：**脸是可以数的，光不可以。** 给主人一排头像，
 * 等于把刚从这一格拿掉的那个精确数字换个形式发回去。
 *
 * 🔴 **档位 = 外面裹了几层晕（0 / 1 / 2），不是同一个图形调透明度。**
 * 两条理由：① 透明度在 390px 宽的屏上人眼分不出来（第一轮的连续/三档对比图已证）；
 * ② 圈层只有三种取值，**看不出「离下一档还差多少」**，也就没有一个可以每天回来追的目标。
 *
 * 🔴 **中间那一盏三档完全相同。** 低档不是「暗掉的高档」，它是完整的一盏；
 * 少的是外面裹着的东西，不是它自己。绝大多数窗长期在低档，那才是常态。
 */
export default function WarmthGlow({
  petId,
  variant = 'card',
}: {
  /**
   * 🔴 自己那扇窗的**窗口键**。`GET /windows/:petId/remember` 收的是它。
   *
   * ⚠️ 这里刻意**不过 `petIdOfCard()`**：自己的窗不是一张卡，本来就没有卡片键。
   * 原先写的 `petIdOfCard(asCardId('w-mine'))` 是把窗口键当卡片键包了一层再拆开，
   * 🔴 那是一次**类型上的假动作**——它看起来在守边界，实际两头都是同一个窗口键。
   */
  petId: PetId
  variant?: 'card' | 'bare'
}) {
  const [tier, setTier] = useState<WarmthTier | null>(null)

  useEffect(() => {
    let alive = true
    // 与详情页同一个数据源，保证主页和窗口页不会各说各的。
    // ⚠️ 这个出参**顺带带回了 faces**（见 `C-8`）：这里一格不渲染，但它仍在线上传输。
    api
      .rememberWall(petId)
      .then((w) => alive && setTier(warmthTier(w.warmthLevel)))
      .catch(() => {
        /* 拿不到就整块不出。🔴 不出比出一个假的低档好 —— 后者会被读成「没人记得它」 */
      })
    return () => {
      alive = false
    }
  }, [petId])

  if (!tier) return null

  return (
    <div className={`wglow wglow-${variant}`}>
      <div className="wglow-light">
        {tier === 'high' && <span className="wglow-ring wglow-ring-2" aria-hidden />}
        {tier !== 'low' && <span className="wglow-ring wglow-ring-1" aria-hidden />}
        <span className="wglow-core" aria-hidden />
      </div>
      <p className="wglow-line">{WARMTH_PHRASE[tier]}</p>
    </div>
  )
}
