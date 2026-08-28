import { useRef, useState } from 'react'
import type { OnboardingCandidate } from '../types'
import CoverPlaceholder from './CoverPlaceholder'

/** 定妆推荐形象：以肖像为底，三种不同色调/质感模拟「多张定妆」（真实实现由后端图像生成替换） */
const CAND_FILTERS = [
  'saturate(1.08) contrast(1.04) brightness(1.02)',
  'sepia(.28) saturate(1.15) hue-rotate(-10deg) contrast(1.02)',
  'saturate(.9) contrast(.98) brightness(1.06) hue-rotate(6deg)',
]

interface Props {
  candidates: OnboardingCandidate[]
  /** 上传的肖像 URL：作为定妆底图 */
  portraitUrl?: string
  /** 第几轮：1=细化前，2=定稿前，决定确认按钮文案与含义 */
  round: 1 | 2
  busy?: boolean
  /** 满意某张 → 继续（round1=细化下一轮，round2=选定进入场景） */
  onConfirm: (candidateId: string) => void
  /** 不满意 → 重新导出/定妆（重新生成这一轮的推荐形象） */
  onRedo: () => void
}

/**
 * 扇形排布 + 左右滑动切换 + 点选播放一小段动态预览 + 决策（重新定妆 / 采用）
 *
 * 定案：这里**不叠 AI 角标**（AiGeneratedBadge）。扇形是旋转错位排布，每张再压一枚角标会很脏，
 * 且这一屏的标题与副文案已明确说明「以 ta 的肖像为底生成」，告知义务已经履行。
 * 数据模型（Placeholder.aiGenerated）支持随时打开，改主意时在 CoverPlaceholder 传入即可。
 */
export default function CandidateFan({
  candidates,
  portraitUrl,
  round,
  busy,
  onConfirm,
  onRedo,
}: Props) {
  const [focus, setFocus] = useState(Math.floor(candidates.length / 2))
  const [stage, setStage] = useState<'browse' | 'preview'>('browse')
  const dragX = useRef<number | null>(null)

  const clamp = (n: number) => Math.max(0, Math.min(candidates.length - 1, n))
  const focused = candidates[focus]

  function onStart(x: number) {
    dragX.current = x
  }
  function onEnd(x: number) {
    if (dragX.current == null) return
    const dx = x - dragX.current
    dragX.current = null
    if (Math.abs(dx) > 40) setFocus((f) => clamp(f + (dx < 0 ? 1 : -1)))
  }

  const coverOf = (c: OnboardingCandidate, i: number, cls: string, style?: React.CSSProperties) =>
    portraitUrl ? (
      <div className={`${cls} fan-photo`}>
        <img
          className="fan-img"
          src={portraitUrl}
          alt="定妆"
          style={{ filter: CAND_FILTERS[i % CAND_FILTERS.length], ...style }}
        />
        <div className="fan-tint" style={{ background: c.cover.gradient }} />
      </div>
    ) : (
      <CoverPlaceholder data={c.cover} className={cls} aiBadge="none" />
    )

  if (stage === 'preview' && focused) {
    return (
      <div className="fan-wrap">
        <div className="fan-preview">
          <div className="fan-preview-frame" key={focused.id}>
            {coverOf(focused, focus, 'fan-preview-cover')}
            <div className="fan-preview-shine" />
          </div>
          <p className="fan-sign">{focused.signature}</p>
          <p className="fan-hint">动起来，像记忆里的 ta 吗？</p>
        </div>
        <div className="fan-actions">
          <button className="fan-back" onClick={() => setStage('browse')} disabled={busy}>
            ← 换一张
          </button>
          <button className="fan-redo" onClick={onRedo} disabled={busy}>
            {busy ? '重新定妆中…' : '不太像，重新定妆'}
          </button>
          <button className="onb-confirm" onClick={() => onConfirm(focused.id)} disabled={busy}>
            {round === 1 ? '就细化这张 →' : '就选它，留下 →'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fan-wrap">
      <div
        className="fan-stage"
        onTouchStart={(e) => onStart(e.touches[0].clientX)}
        onTouchEnd={(e) => onEnd(e.changedTouches[0].clientX)}
        onMouseDown={(e) => onStart(e.clientX)}
        onMouseUp={(e) => onEnd(e.clientX)}
      >
        {candidates.map((c, i) => {
          const off = i - focus
          const abs = Math.abs(off)
          const style: React.CSSProperties = {
            transform: `translateX(${off * 46}%) rotate(${off * 9}deg) scale(${i === focus ? 1 : 0.8})`,
            zIndex: 20 - abs,
            opacity: abs > 2 ? 0 : 1 - abs * 0.16,
            pointerEvents: abs > 2 ? 'none' : 'auto',
          }
          return (
            <button
              key={c.id}
              className={`fan-card ${i === focus ? 'on' : ''}`}
              style={style}
              onClick={() => (i === focus ? setStage('preview') : setFocus(i))}
            >
              {coverOf(c, i, 'fan-card-cover')}
            </button>
          )
        })}
      </div>

      <div className="fan-dots">
        {candidates.map((_, i) => (
          <span
            key={i}
            className={`fan-dot ${i === focus ? 'on' : ''}`}
            onClick={() => setFocus(i)}
          />
        ))}
      </div>

      <p className="fan-sign">{focused?.signature}</p>
      <p className="fan-hint">左右滑动切换，轻触中间这张看 ta 动起来</p>
    </div>
  )
}
