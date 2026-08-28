// 亲友「后端毫秒时间 → 前端相对时间串」映射（契约 §8 · QA M-7）。
// 后端 GET /relations 下发 reels[].createdAt 与 lastActive 皆为毫秒时间戳，
// 约定由前端映射为相对时间串（如「3 小时前」）。参考 spectrumMap.ts 的语义→视觉
// 映射层：这里是「时间语义 → 展示串」的纯函数映射层，无副作用、now 可注入，便于单测。

import type { MyPet, Placeholder, Reel, RelationUser } from '../types'

/** 后端下发的单条 reel（createdAt 为毫秒；前端映射为 time 相对串） */
export interface RawReel {
  id: string
  placeholder: Placeholder
  text: string
  /** 毫秒时间戳 */
  createdAt: number
}

/**
 * 后端下发的亲友项：lastActive 与 reels[].createdAt 为毫秒；无权查看者 pet 为 null。
 * 其余字段同 RelationUser。
 */
export interface RawRelationUser
  extends Omit<RelationUser, 'lastActive' | 'reels' | 'pet'> {
  /** 毫秒时间戳 */
  lastActive: number
  reels: RawReel[]
  /** 无权查看（viewableByMe=false）时后端下发 null */
  pet: MyPet | null
}

/**
 * 毫秒时间戳 → 相对时间串。基调与 RecordScreen/MessagesScreen 的 relTime 一致，
 * 并补上「分钟」档（类型注释示例「3 分钟前」）。未来/负 diff 收敛为「刚刚」。
 * @param now 便于单测注入的当前时刻，默认 Date.now()。
 */
export function relativeTime(ms: number, now: number = Date.now()): string {
  const diff = Math.max(0, now - ms)
  const min = Math.floor(diff / 60000)
  if (min < 1) return '刚刚'
  if (min < 60) return `${min} 分钟前`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h} 小时前`
  return `${Math.floor(h / 24)} 天前`
}

/** 单条 reel：createdAt(ms) → time(相对串)，其余原样保留。 */
export function mapReel(raw: RawReel, now: number = Date.now()): Reel {
  return {
    id: raw.id,
    placeholder: raw.placeholder,
    text: raw.text,
    time: relativeTime(raw.createdAt, now),
  }
}

/** 单个亲友：lastActive(ms) → 相对串；reels[].createdAt → time；其余字段透传。 */
export function mapRelation(
  raw: RawRelationUser,
  now: number = Date.now(),
): RelationUser {
  return {
    ...raw,
    lastActive: relativeTime(raw.lastActive, now),
    reels: (raw.reels ?? []).map((r) => mapReel(r, now)),
    pet: raw.pet as MyPet,
  }
}

/** 整份亲友列表映射（真后端 GET /relations 的 items 逐条映射）。 */
export function mapRelations(
  items: RawRelationUser[],
  now: number = Date.now(),
): RelationUser[] {
  return items.map((r) => mapRelation(r, now))
}
