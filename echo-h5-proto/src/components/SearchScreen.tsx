import { useEffect, useRef, useState } from 'react'
import type { SearchResults, SearchTopic, SearchUser, Window } from '../types'
import { api, track } from '../api'
import type { CardOrigin } from '../lib/ids'
import {
  HOT_TOPICS,
  isEmptyResults,
  normalizeQuery,
  splitHighlight,
  top3,
  truncateQuery,
  windowTitle,
} from '../api/searchLogic'
import {
  addHistory,
  clearHistoryStorage,
  loadHistory,
  removeHistory,
  saveHistory,
} from '../api/searchHistory'
import CoverPlaceholder from './CoverPlaceholder'
import OpsMark from './OpsMark'

interface Props {
  /** 返回/取消 一致：退出回广场，不丢广场滚动位置（A.1） */
  onClose: () => void
  /** 点记忆结果 → 窗口详情（A.3） */
  /** 🔴 卡片键与窗口键**成对**传，详情页两组端点各要一个。见 lib/ids.ts */
  onOpenWindow: (card: CardOrigin) => void
  /** 点用户结果 → 其主页（A.3） */
  onOpenUser: (userId: string) => void
  /** 点主题结果 → 复用广场按 category 聚合过滤（A.3） */
  onOpenTopic: (category: NonNullable<Window['category']>, term: string) => void
  /** 埋点来源（A.6 search_open{from}） */
  from?: string
}

type Status = 'idle' | 'loading' | 'ready' | 'error'
type Section = '记忆' | '用户' | '主题'
type ViewAll = 'windows' | 'users'

/** 命中关键词高亮（A.3；作用字段：标题/昵称/近况/分类） */
function Highlight({ text, q }: { text: string; q: string }) {
  return (
    <>
      {splitHighlight(text, q).map((seg, i) =>
        seg.hit ? (
          <mark key={i} className="s-hl">
            {seg.text}
          </mark>
        ) : (
          <span key={i}>{seg.text}</span>
        ),
      )}
    </>
  )
}

/**
 * 一张记忆/窗口结果卡：缩略图 + 标题 + 近况 + 作者（字段白名单，A.3）。
 *
 * 🔴 **不出暖光**（裁定 2026-08-26）。搜索结果是一个「找东西」的场景，
 * 在这里给每一行标上亮度，等于把搜索结果排成了热度榜。
 */
function WindowRow({
  w,
  q,
  onClick,
}: {
  w: Window
  q: string
  onClick: () => void
}) {
  return (
    <button className="s-win-row" onClick={onClick}>
      {/* 结果行缩略图只有 62px，AI 角标出短标，避免糊成一团 */}
      <CoverPlaceholder data={w.cover} className="s-win-thumb" aiBadge="compact" />
      <div className="s-win-info">
        <p className="s-win-title">
          <Highlight text={windowTitle(w)} q={q} />
        </p>
        <p className="s-win-recent">
          <Highlight text={w.recent} q={q} />
        </p>
        <div className="s-win-meta">
          <span className="s-win-avatar" style={{ background: w.ownerAvatar }} />
          <span className="s-win-owner">{w.ownerName}</span>
          {w.ownerAccountType === 'ops' && <OpsMark />}
        </div>
      </div>
    </button>
  )
}

/** 一行用户：头像 + 昵称 + 一句签名（A.3） */
function UserRow({
  u,
  q,
  onClick,
}: {
  u: SearchUser
  q: string
  onClick: () => void
}) {
  return (
    <button className="s-user-row" onClick={onClick}>
      <span className="s-user-avatar" style={{ background: u.avatar }} />
      <div className="s-user-info">
        <p className="s-user-name">
          <Highlight text={u.nickname} q={q} />
          {u.accountType === 'ops' && <OpsMark />}
        </p>
        <p className="s-user-persona">{u.persona}</p>
      </div>
    </button>
  )
}

export default function SearchScreen({
  onClose,
  onOpenWindow,
  onOpenUser,
  onOpenTopic,
  from = 'plaza',
}: Props) {
  const [raw, setRaw] = useState('')
  const [status, setStatus] = useState<Status>('idle')
  const [results, setResults] = useState<SearchResults | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [confirmClear, setConfirmClear] = useState(false)
  const [viewAll, setViewAll] = useState<ViewAll | null>(null)
  const [retryTick, setRetryTick] = useState(0)

  const inputRef = useRef<HTMLInputElement>(null)
  /** 竞态守卫：只渲染最新一次查询的响应，丢弃过期响应（A.3） */
  const seqRef = useRef(0)

  const q = normalizeQuery(raw)

  // 进入：自动聚焦拉起键盘 + 载入本地历史 + 埋点 search_open{from}（A.1/A.6）
  useEffect(() => {
    inputRef.current?.focus()
    setHistory(loadHistory())
    track('search_open', { from })
  }, [from])

  // 输入即联想（debounce ~200ms）；竞态丢弃过期响应；温柔失败可重试（A.3）
  useEffect(() => {
    setViewAll(null)
    if (!q) {
      setStatus('idle')
      setResults(null)
      return
    }
    setStatus('loading')
    const seq = ++seqRef.current
    const timer = setTimeout(() => {
      api
        .search(q)
        .then((r) => {
          if (seq !== seqRef.current) return // 过期响应，丢弃
          setResults(r)
          setStatus('ready')
          track('search_query', { q_len: q.length, has_result: !isEmptyResults(r) })
        })
        .catch(() => {
          if (seq !== seqRef.current) return
          setStatus('error')
        })
    }, 200)
    return () => clearTimeout(timer)
  }, [q, retryTick])

  function writeHistory(term: string) {
    const next = addHistory(history, term)
    setHistory(next)
    saveHistory(next)
  }

  function clearInput() {
    setRaw('') // → q 为空 → 立即回未输入态（A.5）
    inputRef.current?.focus()
  }

  function onSubmit() {
    if (q) writeHistory(q) // 回车提交写历史（A.3）
  }

  function onHotClick(t: SearchTopic) {
    track('search_hot_click', { term: t.term })
    // 热门=策展题材：直接进该题材聚合（复用广场 category 过滤），保证有真内容，
    // 而非拿字面词去搜（题材词与窗口 category 标签常不同字，字面搜会空）（A.2/A.3 定案）
    onOpenTopic(t.category, t.term)
  }

  function onHistoryClick(term: string) {
    track('search_history_click', { term })
    setRaw(term)
  }

  function onHistoryDelete(term: string) {
    const next = removeHistory(history, term)
    setHistory(next)
    saveHistory(next)
    track('search_history_delete_single', { term })
  }

  function doClearHistory() {
    const count = history.length
    setHistory([])
    clearHistoryStorage()
    track('search_history_clear', { count })
    setConfirmClear(false)
  }

  function onWindowClick(w: Window, position: number) {
    track('search_result_click', { section: '记忆', item_id: w.id, position })
    if (q) writeHistory(q)
    onOpenWindow({ id: w.id, petId: w.petId })
  }

  function onUserClick(u: SearchUser, position: number) {
    track('search_result_click', { section: '用户', item_id: u.id, position })
    if (q) writeHistory(q)
    onOpenUser(u.id)
  }

  function onTopicClick(t: SearchTopic, position: number) {
    track('search_result_click', { section: '主题', item_id: t.term, position })
    if (q) writeHistory(q)
    onOpenTopic(t.category, t.term)
  }

  function onViewAll(section: Section, target: ViewAll) {
    track('search_view_all', { section })
    setViewAll(target)
  }

  // —— 未输入态：热门 +（可选）历史；双空给兜底屏（A.2）——
  function renderIdle() {
    const hasHot = HOT_TOPICS.length > 0
    const hasHistory = history.length > 0
    if (!hasHot && !hasHistory) {
      return (
        <div className="s-empty-fallback">
          <span className="s-empty-glow" />
          <p className="s-empty-line">输入几个字，找找那段回忆</p>
        </div>
      )
    }
    return (
      <div className="s-idle">
        {hasHot && (
          <section className="s-block">
            <h3 className="s-block-title">大家在记得的</h3>
            <div className="s-chips">
              {HOT_TOPICS.map((t) => (
                <button
                  key={t.term}
                  className="s-chip"
                  onClick={() => onHotClick(t)}
                >
                  {t.term}
                </button>
              ))}
            </div>
          </section>
        )}
        {hasHistory && (
          <section className="s-block">
            <h3 className="s-block-title">你搜过的</h3>
            <div className="s-chips">
              {history.map((term) => (
                <span key={term} className="s-chip s-chip-history">
                  <button
                    className="s-chip-text"
                    onClick={() => onHistoryClick(term)}
                  >
                    {term}
                  </button>
                  <button
                    className="s-chip-del"
                    aria-label="删除这条历史"
                    onClick={() => onHistoryDelete(term)}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            <button className="s-clear-history" onClick={() => setConfirmClear(true)}>
              清空历史
            </button>
          </section>
        )}
      </div>
    )
  }

  /** 热门推荐（空结果态下也保留，给出路；A.4） */
  function renderHotBlock() {
    if (HOT_TOPICS.length === 0) return null
    return (
      <section className="s-block">
        <h3 className="s-block-title">大家在记得的</h3>
        <div className="s-chips">
          {HOT_TOPICS.map((t) => (
            <button key={t.term} className="s-chip" onClick={() => onHotClick(t)}>
              {t.term}
            </button>
          ))}
        </div>
      </section>
    )
  }

  // —— 查看全部：某分区当前 q 的全量结果（A.3；真接口 ?q=&type= 去向标 TODO）——
  function renderViewAll() {
    if (!results) return null
    if (viewAll === 'windows') {
      return (
        <div className="s-viewall">
          <button className="s-viewall-back" onClick={() => setViewAll(null)}>
            ← 记忆 / 窗口 · 「{q}」
          </button>
          <div className="s-list">
            {results.windows.items.map((w, i) => (
              <WindowRow key={w.id} w={w} q={q} onClick={() => onWindowClick(w, i)} />
            ))}
          </div>
        </div>
      )
    }
    return (
      <div className="s-viewall">
        <button className="s-viewall-back" onClick={() => setViewAll(null)}>
          ← 用户 · 「{q}」
        </button>
        <div className="s-list">
          {results.users.items.map((u, i) => (
            <UserRow key={u.id} u={u} q={q} onClick={() => onUserClick(u, i)} />
          ))}
        </div>
      </div>
    )
  }

  // —— 输入态：分区结果 / 加载 / 失败 / 空结果（A.3/A.4）——
  function renderResults() {
    if (status === 'loading') {
      return (
        <div className="s-loading">
          <span className="s-skeleton" />
          <span className="s-skeleton" />
          <span className="s-skeleton" />
          <p className="s-loading-text">正在找…</p>
        </div>
      )
    }
    if (status === 'error') {
      return (
        <div className="s-error">
          <p className="s-error-text">
            网络有点慢，
            <button className="s-retry" onClick={() => setRetryTick((t) => t + 1)}>
              点一下再试试
            </button>
          </p>
        </div>
      )
    }
    if (!results) return null

    if (isEmptyResults(results)) {
      return (
        <div className="s-noresult">
          <p className="s-noresult-text">没有找到「{q}」，换个词看看？</p>
          {renderHotBlock()}
        </div>
      )
    }

    const wins = results.windows.items
    const users = results.users.items
    const topics = results.topics.items

    return (
      <div className="s-sections">
        {wins.length > 0 && (
          <section className="s-section">
            <div className="s-section-head">
              <h3 className="s-section-title">记忆 / 窗口</h3>
              {wins.length > top3(wins).length && (
                <button
                  className="s-viewall-link"
                  onClick={() => onViewAll('记忆', 'windows')}
                >
                  查看全部 →
                </button>
              )}
            </div>
            <div className="s-list">
              {top3(wins).map((w, i) => (
                <WindowRow key={w.id} w={w} q={q} onClick={() => onWindowClick(w, i)} />
              ))}
            </div>
          </section>
        )}

        {users.length > 0 && (
          <section className="s-section">
            <div className="s-section-head">
              <h3 className="s-section-title">用户</h3>
              {users.length > top3(users).length && (
                <button
                  className="s-viewall-link"
                  onClick={() => onViewAll('用户', 'users')}
                >
                  查看全部 →
                </button>
              )}
            </div>
            <div className="s-list">
              {top3(users).map((u, i) => (
                <UserRow key={u.id} u={u} q={q} onClick={() => onUserClick(u, i)} />
              ))}
            </div>
          </section>
        )}

        {topics.length > 0 && (
          <section className="s-section">
            <div className="s-section-head">
              <h3 className="s-section-title">主题</h3>
            </div>
            <div className="s-chips">
              {top3(topics).map((t, i) => (
                <button
                  key={t.term}
                  className="s-chip"
                  onClick={() => onTopicClick(t, i)}
                >
                  <Highlight text={t.term} q={q} />
                </button>
              ))}
            </div>
          </section>
        )}
      </div>
    )
  }

  return (
    <div className="search-screen">
      <div className="search-topbar">
        <button className="search-back" aria-label="返回" onClick={onClose}>
          ←
        </button>
        <div className="search-input-wrap">
          <span className="search-input-ico">🔍</span>
          <input
            ref={inputRef}
            className="search-input"
            value={raw}
            maxLength={50}
            placeholder="搜故事、记忆、或某个人"
            onChange={(e) => setRaw(truncateQuery(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit()
            }}
          />
          {raw && (
            <button className="search-clear" aria-label="清空输入" onClick={clearInput}>
              ×
            </button>
          )}
        </div>
        <button className="search-cancel" onClick={onClose}>
          取消
        </button>
      </div>

      <div className="search-body">
        {viewAll ? renderViewAll() : q === '' ? renderIdle() : renderResults()}
      </div>

      {confirmClear && (
        <div className="s-confirm-mask" onClick={() => setConfirmClear(false)}>
          <div className="s-confirm" onClick={(e) => e.stopPropagation()}>
            <p className="s-confirm-title">确定清空搜索历史吗？</p>
            <div className="s-confirm-btns">
              <button className="s-confirm-cancel" onClick={() => setConfirmClear(false)}>
                再想想
              </button>
              <button className="s-confirm-ok" onClick={doClearHistory}>
                清空
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
