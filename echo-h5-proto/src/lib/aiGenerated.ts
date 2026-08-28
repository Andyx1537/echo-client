import type { Placeholder } from '../types'

/**
 * 这份视觉素材是否要叠「该内容由 AI 生成」角标。
 *
 * 🔴 缺省按 **true** 处理：没有标志位时一律当作含 AI 生成成分。
 * 漏标是合规风险，误标只是多一行小字——两者代价不对等，所以把不确定的一侧倒向标注。
 * 想让某份素材不带角标，必须由数据侧**显式**写 `aiGenerated: false`（真实拍摄的用户原图），
 * 或由调用方传 `aiBadge="none"` 自行安放/豁免（见 CoverPlaceholder）。
 */
export function isAiGenerated(data: Pick<Placeholder, 'aiGenerated'> | undefined): boolean {
  return data?.aiGenerated !== false
}
