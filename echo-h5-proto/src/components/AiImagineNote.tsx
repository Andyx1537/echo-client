/**
 * AI 生成内容「诚实标识」（CR2）：凡展示 AI 生成的宠物近况/回声处，
 * 都附一句克制的小字，说明这是想象而非事实——不施压、不把想象说成真。
 * 文案以 COPY-GUIDE §2.4 为准。
 */
export default function AiImagineNote({ className = '' }: { className?: string }) {
  return (
    <p className={`ai-imagine-note ${className}`.trim()}>
      <span className="ai-imagine-dot" aria-hidden>
        ✨
      </span>
      这是基于你记忆的温柔想象
    </p>
  )
}
