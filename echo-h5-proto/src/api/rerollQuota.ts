// 回声「换一批」的免费次数（定案 B7 / 验收 TC-23）纯逻辑 + 本地留痕。
//
// B7 口径：**服务端配置，默认每轮免费 1 次，后续可调**。
//  · 默认值与「可调」由 resolveFreePerRound 统一收口（当前从构建期配置读，真后端下发后改为读配置即可）；
//  · 「一轮」= 当前这批近况。它下次捎来新的近况（最新一条 echoId 变了）就是新一轮，免费次数自然回满；
//  · 换一批只换表达口吻/呈现，**不动已有回忆**，所以计数只跟「轮」绑定，不跟内容条数绑定。
//
// 提示语一律温柔（COPY-GUIDE §1/§3C）：用完不报错、不诱导付费，只说「等它下次捎来新的近况」。

/** B7 默认：每轮免费 1 次 */
export const DEFAULT_FREE_REROLL_PER_ROUND = 1

/** 免费次数的合法上界（防配置写错把额度放飞） */
const MAX_FREE_REROLL_PER_ROUND = 9

/** 「换一批」计数状态：绑在某一轮近况上 */
export interface RerollState {
  /** 这一轮的标识（当前批最新一条 echoId） */
  roundKey: string
  /** 本轮已用掉的免费次数 */
  usedFree: number
}

/**
 * 解析「每轮免费几次」的配置（B7「服务端配置、后续可调」的落点）。
 * 非法/缺省一律回落默认 1，绝不因配置脏值把额度放开或归零。
 */
export function resolveFreePerRound(raw: string | number | undefined | null): number {
  if (raw === undefined || raw === null) return DEFAULT_FREE_REROLL_PER_ROUND
  const text = raw.toString().trim()
  if (text === '') return DEFAULT_FREE_REROLL_PER_ROUND
  const n = Number(text)
  if (!Number.isInteger(n) || n < 0) return DEFAULT_FREE_REROLL_PER_ROUND
  return Math.min(n, MAX_FREE_REROLL_PER_ROUND)
}

/** 取「这一轮」的标识：近况流按新→旧排，最新一条即当轮锚点 */
export function roundKeyOf(echoes: Array<{ echoId: string }>): string {
  return echoes.length > 0 ? echoes[0].echoId : ''
}

/**
 * 对齐存档与当前轮：同一轮沿用已用次数（**原样返回入参对象**，便于 setState 判等免重渲染）；
 * 换了轮 / 没有存档 → 从 0 开始，免费次数回满。
 */
export function reconcile(stored: RerollState | null, roundKey: string): RerollState {
  if (stored && stored.roundKey === roundKey) return stored
  return { roundKey, usedFree: 0 }
}

/** 本轮还剩几次免费 */
export function remainingFree(
  state: RerollState,
  freePerRound: number = DEFAULT_FREE_REROLL_PER_ROUND,
): number {
  return Math.max(0, freePerRound - state.usedFree)
}

/** 本轮还能不能换 */
export function canReroll(
  state: RerollState,
  freePerRound: number = DEFAULT_FREE_REROLL_PER_ROUND,
): boolean {
  return remainingFree(state, freePerRound) > 0
}

/** 用掉一次（只在换成功后调用；失败不扣） */
export function consume(state: RerollState): RerollState {
  return { roundKey: state.roundKey, usedFree: state.usedFree + 1 }
}

// —— 本地留痕（刷新后仍守住「本轮已换过」，localStorage 不可用则退化为仅本次会话） ——

const STORE_KEY = 'echo.echo.reroll'

export function readRerollState(): RerollState | null {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<RerollState>
    if (typeof parsed?.roundKey !== 'string' || typeof parsed?.usedFree !== 'number') return null
    return { roundKey: parsed.roundKey, usedFree: Math.max(0, Math.floor(parsed.usedFree)) }
  } catch {
    return null
  }
}

export function writeRerollState(state: RerollState): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(state))
  } catch {
    /* 存不下也不影响主流程，只是刷新后本轮额度会回满 */
  }
}
