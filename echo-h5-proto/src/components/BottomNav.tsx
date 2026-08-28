export type TabKey = 'home' | 'mine' | 'record' | 'msg' | 'me'

interface Props {
  active: TabKey
  onChange: (key: TabKey) => void
  /** 消息未读（仅弱提示一个点，绝不红点轰炸/不显数字，§2.14） */
  hasUnreadMsg?: boolean
}

const items: Array<{ key: TabKey; icon: string; label: string }> = [
  { key: 'home', icon: '🏠', label: '共鸣厅' },
  { key: 'mine', icon: '🐾', label: '我的它' },
  { key: 'record', icon: '✏️', label: '记录' },
  { key: 'msg', icon: '💬', label: '消息' },
  { key: 'me', icon: '👤', label: '我' },
]

/** 底部导航（五签全通）；弱 UI，不做红点轰炸 */
export default function BottomNav({ active, onChange, hasUnreadMsg }: Props) {
  return (
    <nav className="bottom-nav">
      {items.map((it) => (
        <button
          key={it.key}
          className={`nav-item ${active === it.key ? 'active' : ''}`}
          onClick={() => onChange(it.key)}
        >
          <span className="nav-icon">
            {it.icon}
            {it.key === 'msg' && hasUnreadMsg && <span className="nav-dot" />}
          </span>
          <span className="nav-label">{it.label}</span>
        </button>
      ))}
    </nav>
  )
}
