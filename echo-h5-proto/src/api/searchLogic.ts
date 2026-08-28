// 搜索页纯逻辑（附录 A.3/A.5）。
// 抽成无副作用纯函数，便于单测覆盖：匹配规则 / 截断 / 分区 / 高亮 / 空态。
// mock 后端与真后端（TODO）都复用本模块产出三分区信封。

import type { SearchResults, SearchTopic, SearchUser, Window } from '../types'

/** 最大输入长度：超出在输入端截断（A.5） */
export const MAX_QUERY_LEN = 50
/** 每分区最多展示条数（A.3：各≤3 + 查看全部） */
export const TOP_N = 3

/**
 * 分类 → 中文题材标签：用于「分类」字段的匹配与高亮（A.3 高亮字段含「分类」）。
 * 仅题材语义，不含任何人数/排名（守 A.7 红线）。
 */
export const CATEGORY_LABELS: Record<NonNullable<Window['category']>, string> = {
  pet: '宠物',
  youth: '校园',
  family: '家人',
  place: '城市',
  relationship: '旧友',
  daily: '日常',
}

/**
 * 运营可配的热门题材 chip（A.2「大家在记得的」）。
 * 沿用广场分类语义，term 供搜索/高亮、category 供「主题聚合」复用广场过滤。
 * 无人数、无排名、不悲伤竞赛；词本身须过《温柔词表》（A.7）。
 */
export const HOT_TOPICS: SearchTopic[] = [
  { term: '教室', category: 'youth' },
  { term: '旧物', category: 'family' },
  { term: '末班车', category: 'place' },
  { term: '宠物', category: 'pet' },
  { term: '面馆', category: 'daily' },
  { term: '球赛', category: 'youth' },
]

/** 输入端截断到最大长度（含空格）；超长不触发异常（A.5） */
export function truncateQuery(raw: string): string {
  return raw.slice(0, MAX_QUERY_LEN)
}

/** 归一化查询：截断 + 去首尾空白；纯空格/空串 → ''（不触发搜索，A.5） */
export function normalizeQuery(raw: string): string {
  return truncateQuery(raw).trim()
}

/** 匹配规则：子串包含、大小写不敏感、**不做拼音**（A.3） */
export function matchText(text: string, q: string): boolean {
  if (!q) return false
  return text.toLowerCase().includes(q.toLowerCase())
}

/** 窗口的对外标题：优先 title，回退 petName */
export function windowTitle(w: Window): string {
  return w.title ?? w.petName
}

function windowCategoryLabel(w: Window): string {
  return w.category ? CATEGORY_LABELS[w.category] : ''
}

/** 记忆/窗口分区：匹配 标题 / 近况(recent) / 分类（A.3） */
export function searchWindows(windows: Window[], q: string): Window[] {
  if (!q) return []
  return windows.filter(
    (w) =>
      matchText(windowTitle(w), q) ||
      matchText(w.recent, q) ||
      matchText(windowCategoryLabel(w), q),
  )
}

/** 用户分区：仅匹配 昵称（A.3；签名 persona 只展示不参与匹配） */
export function searchUsers(users: SearchUser[], q: string): SearchUser[] {
  if (!q) return []
  return users.filter((u) => matchText(u.nickname, q))
}

/**
 * 主题分区：匹配题材 chip 的 term（A.3）。
 * 排除「与查询完全相同」的自反命中——否则打字没有真内容时，主题会自反命中一条
 * 与查询同名的 chip，使三区不为空，从而吞掉「没有找到」空态提示（缺陷复盘定案）。
 * 仍保留「部分包含」的题材建议（如查「末班」→ 建议「末班车」，可点进聚合）。
 */
export function searchTopics(topics: SearchTopic[], q: string): SearchTopic[] {
  if (!q) return []
  const ql = q.toLowerCase()
  return topics.filter((t) => {
    const tl = t.term.toLowerCase()
    return tl.includes(ql) && tl !== ql
  })
}

export interface SearchSources {
  windows: Window[]
  users: SearchUser[]
  /** 缺省时用运营配置的 HOT_TOPICS */
  topics?: SearchTopic[]
}

/**
 * 跑一次搜索，产出 A.5 三分区信封（全量匹配结果；组件内再切 top3 + 查看全部）。
 * q 应为已归一化的查询串（调用方负责 normalizeQuery）。
 */
export function runSearch(q: string, src: SearchSources): SearchResults {
  const topics = src.topics ?? HOT_TOPICS
  return {
    windows: { items: searchWindows(src.windows, q), nextCursor: null },
    users: { items: searchUsers(src.users, q), nextCursor: null },
    topics: { items: searchTopics(topics, q), nextCursor: null },
  }
}

/** 三区全空 → 进空结果态（A.3/A.4） */
export function isEmptyResults(r: SearchResults): boolean {
  return (
    r.windows.items.length === 0 &&
    r.users.items.length === 0 &&
    r.topics.items.length === 0
  )
}

/** 取分区前 N 条（A.3 各≤3） */
export function top3<T>(items: T[]): T[] {
  return items.slice(0, TOP_N)
}

/** 高亮切片：命中片段 hit=true，供 UI 包 <mark>（A.3 关键词高亮） */
export interface HlSegment {
  text: string
  hit: boolean
}

/** 把文本按 q 切成高亮/非高亮片段（大小写不敏感、不做拼音） */
export function splitHighlight(text: string, q: string): HlSegment[] {
  if (!q) return [{ text, hit: false }]
  const lower = text.toLowerCase()
  const needle = q.toLowerCase()
  const segs: HlSegment[] = []
  let i = 0
  while (i < text.length) {
    const idx = lower.indexOf(needle, i)
    if (idx === -1) {
      segs.push({ text: text.slice(i), hit: false })
      break
    }
    if (idx > i) segs.push({ text: text.slice(i, idx), hit: false })
    segs.push({ text: text.slice(idx, idx + needle.length), hit: true })
    i = idx + needle.length
  }
  return segs.length ? segs : [{ text, hit: false }]
}
