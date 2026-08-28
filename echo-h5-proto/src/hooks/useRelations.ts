import { useEffect, useMemo, useState } from 'react'
import type { MuteDuration, RelationUser } from '../types'
import { api, IS_MOCK } from '../api'
import { relations as seedRelations } from '../data/mock'

/** 「不看」时长 → 到期时间戳(ms)；permanent 用 Infinity */
function durationToTimestamp(d: MuteDuration): number {
  const now = Date.now()
  switch (d) {
    case '7d':
      return now + 7 * 24 * 60 * 60 * 1000
    case '3m':
      return now + 90 * 24 * 60 * 60 * 1000
    case 'permanent':
      return Infinity
  }
}

/** 是否处于"不看"中（原型不做真到期，仅按时间戳判断） */
function isMuted(r: RelationUser): boolean {
  return r.mutedUntil !== null && r.mutedUntil > Date.now()
}

/** 排序：优先置顶 → 在线 → 离线 */
function sortRelations(list: RelationUser[]): RelationUser[] {
  return [...list].sort((a, b) => {
    if (a.priority !== b.priority) return a.priority ? -1 : 1
    if (a.online !== b.online) return a.online ? -1 : 1
    return 0
  })
}

/**
 * 集中管理亲友行的可变状态：优先置顶、不看三档、动态圈已看。
 * 命名与结构贴近未来后端：priority/mutedUntil 属关系链 edge，
 * seenReels 属阅读回执。
 */
export function useRelations() {
  // 接真后端（QA M-5）：VITE_API_BASE 已设 → 调 api.relations()（真后端模式）；
  // 未设 → mock 后端返回 seed 数据，保留完整可跑的本地回退。
  // 初始值：mock 模式直接用 seed（immediate），真后端模式先空、拉取后回填。
  const [items, setItems] = useState<RelationUser[]>(() =>
    IS_MOCK ? seedRelations : [],
  )
  /** 已看过动态的亲友 id（看过后光环消失） */
  const [seenReels, setSeenReels] = useState<Record<string, boolean>>({})
  /** 亲友行整体折叠 */
  const [collapsed, setCollapsed] = useState(false)
  /** "不看的亲友"折叠组展开 */
  const [mutedExpanded, setMutedExpanded] = useState(false)

  // 拉取亲友列表：消费后端返回的 lastActive/reels/viewableByMe/pet(MyPet形状)。
  // 失败回退到 seed（保证离线/未就绪时页面不空）。
  useEffect(() => {
    let alive = true
    api
      .relations()
      .then((list) => {
        if (alive) setItems(list)
      })
      .catch(() => {
        if (alive) setItems(seedRelations)
      })
    return () => {
      alive = false
    }
  }, [])

  const visible = useMemo(
    () => sortRelations(items.filter((r) => !isMuted(r))),
    [items],
  )
  const muted = useMemo(() => items.filter(isMuted), [items])

  /** 该亲友当前是否应显示动态圈光环 */
  const hasRing = (r: RelationUser): boolean =>
    r.hasUnseenReel && r.viewableByMe && !isMuted(r) && !seenReels[r.id]

  // —— 关系链可变状态：本地乐观更新 + 调真接口 PATCH /relations/:id ——
  // mock 模式下 api.patchRelation 是无副作用回执，本地状态仍驱动 UI（行为不变）。
  const togglePriority = (id: string) => {
    let next = false
    setItems((list) =>
      list.map((r) => {
        if (r.id !== id) return r
        next = !r.priority
        return { ...r, priority: next }
      }),
    )
    api.patchRelation(id, { priority: next }).catch(() => {})
  }

  const mute = (id: string, d: MuteDuration) => {
    setItems((list) =>
      list.map((r) =>
        r.id === id ? { ...r, mutedUntil: durationToTimestamp(d) } : r,
      ),
    )
    api.patchRelation(id, { mute: d }).catch(() => {})
  }

  const unmute = (id: string) => {
    setItems((list) =>
      list.map((r) => (r.id === id ? { ...r, mutedUntil: null } : r)),
    )
    api.patchRelation(id, { mute: 'clear' }).catch(() => {})
  }

  // 标记动态已看：清光环 + 调真接口 POST /relations/:id/reel-seen
  const markReelSeen = (id: string) => {
    setSeenReels((s) => ({ ...s, [id]: true }))
    api.relationReelSeen(id).catch(() => {})
  }

  const getById = (id: string | null) =>
    id ? items.find((r) => r.id === id) ?? null : null

  return {
    visible,
    muted,
    collapsed,
    toggleCollapsed: () => setCollapsed((c) => !c),
    mutedExpanded,
    toggleMutedExpanded: () => setMutedExpanded((c) => !c),
    hasRing,
    togglePriority,
    mute,
    unmute,
    markReelSeen,
    getById,
  }
}

export type RelationsApi = ReturnType<typeof useRelations>
