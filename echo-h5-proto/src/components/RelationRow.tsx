import { useState } from 'react'
import type { RelationUser } from '../types'
import type { RelationsApi } from '../hooks/useRelations'

interface Props {
  api: RelationsApi
  /** 点头像：有动态圈先看动态，否则直接进主页（由 App 决定） */
  onOpenAvatar: (r: RelationUser) => void
}

/** 单个亲友头像（含光环、优先标记、在线点、"…"菜单入口） */
function Avatar({
  r,
  ring,
  onOpen,
  onMenu,
}: {
  r: RelationUser
  ring: boolean
  onOpen: () => void
  onMenu: () => void
}) {
  return (
    <div className="rel-avatar-wrap">
      <button
        className={`rel-avatar ${ring ? 'has-ring' : ''}`}
        onClick={onOpen}
        aria-label={`${r.name} 的主页`}
      >
        <span className="rel-avatar-inner" style={{ background: r.avatar }}>
          {r.priority && (
            <span className="rel-pin" title="优先展示">
              📌
            </span>
          )}
          {r.online && <span className="rel-online-dot" />}
        </span>
      </button>
      <div className="rel-name-row">
        <span className="rel-name">{r.name}</span>
        <button className="rel-more" onClick={onMenu} aria-label="更多操作">
          ⋯
        </button>
      </div>
    </div>
  )
}

export default function RelationRow({ api, onOpenAvatar }: Props) {
  const {
    visible,
    muted,
    collapsed,
    toggleCollapsed,
    mutedExpanded,
    toggleMutedExpanded,
    hasRing,
    togglePriority,
    mute,
    unmute,
  } = api

  // 当前打开菜单的亲友 id（浮层锚定行下方，避免横向滚动裁剪）
  const [menuId, setMenuId] = useState<string | null>(null)
  const menuTarget = visible.find((r) => r.id === menuId) ?? null
  const closeMenu = () => setMenuId(null)

  return (
    <section className="rel-section">
      <button className="rel-head" onClick={toggleCollapsed}>
        <span className="rel-head-title">🫂 亲友</span>
        <span className="rel-head-sub">陪它的人，也在这里</span>
        <span className={`rel-chevron ${collapsed ? 'up' : ''}`}>⌄</span>
      </button>

      {!collapsed && (
        <>
          <div className="rel-scroll">
            {visible.map((r) => (
              <Avatar
                key={r.id}
                r={r}
                ring={hasRing(r)}
                onOpen={() => {
                  closeMenu()
                  onOpenAvatar(r)
                }}
                onMenu={() => setMenuId(menuId === r.id ? null : r.id)}
              />
            ))}
            {visible.length === 0 && (
              <p className="rel-empty">暂时没有在看的亲友</p>
            )}
          </div>

          {/* 操作浮层（优先展示 / 不看三档） */}
          {menuTarget && (
            <div className="rel-menu">
              <div className="rel-menu-title">
                <span
                  className="rel-menu-avatar"
                  style={{ background: menuTarget.avatar }}
                />
                {menuTarget.name}
                <button className="rel-menu-x" onClick={closeMenu}>
                  ✕
                </button>
              </div>
              <button
                className="rel-menu-item"
                onClick={() => {
                  togglePriority(menuTarget.id)
                  closeMenu()
                }}
              >
                {menuTarget.priority ? '📌 取消优先展示' : '📌 优先展示'}
              </button>
              <div className="rel-menu-divider" />
              <div className="rel-menu-label">不看 · 温柔静一静</div>
              <div className="rel-menu-mutes">
                <button
                  className="rel-mute-chip"
                  onClick={() => {
                    mute(menuTarget.id, '7d')
                    closeMenu()
                  }}
                >
                  7 天
                </button>
                <button
                  className="rel-mute-chip"
                  onClick={() => {
                    mute(menuTarget.id, '3m')
                    closeMenu()
                  }}
                >
                  3 个月
                </button>
                <button
                  className="rel-mute-chip"
                  onClick={() => {
                    mute(menuTarget.id, 'permanent')
                    closeMenu()
                  }}
                >
                  永久
                </button>
              </div>
            </div>
          )}

          {/* 不看的亲友折叠组 */}
          {muted.length > 0 && (
            <div className="rel-muted">
              <button className="rel-muted-head" onClick={toggleMutedExpanded}>
                <span>🤍 不看的亲友 · {muted.length}</span>
                <span className={`rel-chevron ${mutedExpanded ? 'up' : ''}`}>
                  ⌄
                </span>
              </button>
              {mutedExpanded && (
                <div className="rel-muted-list">
                  {muted.map((r) => (
                    <div key={r.id} className="rel-muted-item">
                      <span
                        className="rel-muted-avatar"
                        style={{ background: r.avatar }}
                      />
                      <span className="rel-muted-name">{r.name}</span>
                      <button
                        className="rel-restore"
                        onClick={() => unmute(r.id)}
                      >
                        恢复
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  )
}
