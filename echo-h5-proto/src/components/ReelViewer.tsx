import { useState } from 'react'
import type { RelationUser } from '../types'
import CoverPlaceholder from './CoverPlaceholder'

interface Props {
  relation: RelationUser
  /** 关闭动态查看（返回上一处） */
  onClose: () => void
  /** 看完 / 主动进入该亲友主页 */
  onEnterHome: () => void
}

/** 轻量"动态查看"态：全屏该亲友的 1-3 条温柔近况，可下一条 / 关闭 */
export default function ReelViewer({ relation, onClose, onEnterHome }: Props) {
  const [idx, setIdx] = useState(0)
  const reels = relation.reels
  const current = reels[idx]
  const isLast = idx >= reels.length - 1

  const next = () => {
    if (isLast) onEnterHome()
    else setIdx((i) => i + 1)
  }

  return (
    <div className="reel">
      {/* 进度分段 */}
      <div className="reel-progress">
        {reels.map((rl, i) => (
          <span
            key={rl.id}
            className={`reel-seg ${i <= idx ? 'on' : ''}`}
          />
        ))}
      </div>

      {/* 头部 */}
      <div className="reel-top">
        <span className="reel-avatar" style={{ background: relation.avatar }} />
        <div className="reel-meta">
          <span className="reel-name">{relation.name}</span>
          <span className="reel-time">{current.time}</span>
        </div>
        <button className="reel-close" onClick={onClose} aria-label="关闭">
          ✕
        </button>
      </div>

      {/* 动态卡（点右侧下一条） */}
      <button className="reel-stage" onClick={next} aria-label="下一条">
        {/* 全屏动态：角标走 CoverPlaceholder 默认的左下角整句位（这一屏没有压角的文案） */}
        <CoverPlaceholder data={current.placeholder} className="reel-cover" sizes="100vw" />
        <p className="reel-text">{current.text}</p>
      </button>

      {/* 进入主页 CTA */}
      <button className="reel-enter" onClick={onEnterHome}>
        进入 {relation.name} 的主页 →
      </button>
    </div>
  )
}
