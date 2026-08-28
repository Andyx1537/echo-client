/**
 * 官方运营号的身份标记：跟在昵称后面的一枚暖调小字。
 *
 * 克制口径：只做「这是回声自己的号」这一件事——不做蓝 V 式徽章，不用「官方 / 小助手」这类冷称呼，
 * 也不给它任何权重暗示。程序侧的判定始终看 accountType === 'ops'，不靠昵称字面。
 */
export default function OpsMark({ className = '' }: { className?: string }) {
  return (
    <span className={`ops-mark ${className}`.trim()} title="回声官方运营账号">
      <span className="sr-only">回声官方运营账号</span>
      <span aria-hidden>官方</span>
    </span>
  )
}
