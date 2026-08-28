import type { Placeholder } from '../types'
import { coverSrcSet } from '../lib/assetUrl'
import { isAiGenerated } from '../lib/aiGenerated'
import AiGeneratedBadge from './AiGeneratedBadge'

interface Props {
  data: Placeholder
  className?: string
  /** 右上角浮标（如明信片日期） */
  badge?: string
  /**
   * 该封面在版面里的实际占宽，交给浏览器挑缩略档还是详情档。
   * 默认按瀑布流双列卡片算，铺满整宽的大图（详情头图、Reel）传 '100vw'。
   */
  sizes?: string
  /**
   * AI 生成角标（左下角）的档位。是否含 AI 成分由 `isAiGenerated(data)` 判定
   * （🔴 缺省即 true，只有显式 `aiGenerated: false` 才不标）：
   * full 出全句 · compact 小缩略图出短标 · none 交给调用方自己安放（详情头图要避开大标题）。
   */
  aiBadge?: 'full' | 'compact' | 'none'
}

/** 有授权素材时优先显示实景；无素材时退回 CSS 场景占位。 */
export default function CoverPlaceholder({
  data,
  className,
  badge,
  sizes = '50vw',
  aiBadge = 'full',
}: Props) {
  const showAiBadge = isAiGenerated(data) && aiBadge !== 'none'
  return (
    <div
      className={`cover-ph ${className ?? ''}`}
      style={{ background: data.gradient }}
    >
      {data.imageUrl && (
        <img
          className="cover-image"
          src={data.imageUrl}
          srcSet={coverSrcSet(data.imageUrl)}
          sizes={sizes}
          alt=""
          loading="lazy"
        />
      )}
      <div className="cover-glow" />
      {!data.imageUrl && <span className="cover-emoji">{data.emoji}</span>}
      {badge && <span className="cover-badge">{badge}</span>}
      {/* 底部弱渐变：让角标在浅色/高频细节封面上也压得住，同时不挡内容主体 */}
      {showAiBadge && <div className="cover-ai-scrim" />}
      {showAiBadge && <AiGeneratedBadge variant={aiBadge} />}
    </div>
  )
}
