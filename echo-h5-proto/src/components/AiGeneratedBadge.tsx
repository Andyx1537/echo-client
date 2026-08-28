/**
 * 「该内容由 AI 生成」角标（定案：前端渲染叠加，绝不烧进图片）。
 *
 * 适用对象是**含 AI 生成成分的内容**：AI 生成的图像素材、唤醒视频、宠物回声/动态，
 * 以及由用户素材与互动派生出来的 AI 内容。判定统一走 `lib/aiGenerated.ts` 的 `isAiGenerated()`
 * （🔴 缺省即 true，只有显式 `aiGenerated: false` 才不标），
 * 不拿「是不是运营种子内容」当替身——将来真实用户的唤醒视频同样要带标识。
 *
 * 覆盖面（四处展示位，缺一不可）：
 *  · 瀑布卡 —— PlazaScreen 走 CoverPlaceholder 默认位；
 *  · 详情头图 —— DetailScreen 自行安放在标题上方（默认位压着 38px 大标题）；
 *  · Reel 全屏 —— ReelViewer 走 CoverPlaceholder 默认位；
 *  · 明信片墙 —— MineScreen / DetailScreen 的 .pc-cover 走默认位。
 *
 * 可读性：深色封面靠白字 + 细亮描边，浅色封面靠半透明深色底 + 底部弱渐变遮罩，
 * 两端都不用把角标做大做亮（见 app.css 的 .ai-gen-badge / .cover-ai-scrim）。
 */
interface Props {
  /**
   * full：卡片/大图，出全句；
   * compact：搜索缩略图这类小尺寸，出短标；
   * hero：详情页头图——由调用方安放位置（避开大标题），样式沿用同一枚角标。
   */
  variant?: 'full' | 'compact' | 'hero'
  className?: string
}

const FULL_TEXT = '该内容由 AI 生成'

export default function AiGeneratedBadge({ variant = 'full', className = '' }: Props) {
  const compact = variant === 'compact'
  return (
    <span
      className={`ai-gen-badge ${variant} ${className}`.trim()}
      title={compact ? FULL_TEXT : undefined}
    >
      <span className="ai-gen-glyph" aria-hidden>
        ✦
      </span>
      {/* 小缩略图放不下整句，缩到「AI」；完整说法仍留给读屏与长按提示 */}
      {compact ? <span aria-hidden>AI</span> : FULL_TEXT}
      {compact && <span className="sr-only">{FULL_TEXT}</span>}
    </span>
  )
}
