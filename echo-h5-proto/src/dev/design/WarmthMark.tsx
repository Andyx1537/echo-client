/**
 * 暖光的新视觉语言。
 *
 * 🔴 **三档的形态差在「有没有晕」，不在「透明度是多少」。**
 * 现状是同一个图形调 opacity（`0.4 + w * 0.6`），在 390px 宽的卡上人眼分不出 0.52 和 0.64，
 * 第一轮的连续/三档对比图已经证明了这一点。改成**加圈层**之后，三档是三个可数的形状，
 * 缩到 12px 也能一眼分辨。
 *
 * 🔴 **不做刻度、不做进度条、不做第四档。** 圈层只有 0/1/2 三种，看不出「离下一档还差多少」，
 * 也就没有可追的目标（`D5` 不排名、不比数量）。
 */

import type { WarmthTier } from './designData'
import { TIER_LABEL_VISITOR } from './designData'

/** 暖光标记本体：一枚会呼吸的小光点，档位决定它有几层晕。 */
export function WarmthMark({
  tier,
  size = 'sm',
  withText = true,
  label,
}: {
  tier: WarmthTier
  size?: 'sm' | 'lg'
  withText?: boolean
  label?: string
}) {
  return (
    <span className={`wm wm-${tier} wm-${size}`}>
      <span className="wm-glyph" aria-hidden />
      {withText && <span className="wm-text">{label ?? TIER_LABEL_VISITOR[tier]}</span>}
    </span>
  )
}
