// 搜索历史（A.2「你搜过的」）：仅本地存储（localStorage），换设备不同步、可随时清。
// 纯数组逻辑（add/remove/cap）抽出便于单测；localStorage 读写做 try/catch 兜底。

/** 历史上限：达 10 条后挤出最旧一条（A.2） */
export const MAX_HISTORY = 10

const KEY = 'echo.search.history'

/**
 * 写入一条历史：去重 + 置顶 + 上限 10 + 挤出最旧（A.3 提交写历史）。
 * 空/纯空格串忽略。纯函数，返回新数组。
 */
export function addHistory(list: string[], termRaw: string): string[] {
  const term = termRaw.trim()
  if (!term) return list
  const deduped = list.filter((t) => t !== term)
  return [term, ...deduped].slice(0, MAX_HISTORY)
}

/** 单条删除（A.2 右侧 ×） */
export function removeHistory(list: string[], term: string): string[] {
  return list.filter((t) => t !== term)
}

/** 从 localStorage 读历史（仅本地私域，A.7） */
export function loadHistory(): string[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_HISTORY)
    }
  } catch {
    // ignore：localStorage 不可用/损坏则视作无历史
  }
  return []
}

/** 落盘（上限截断） */
export function saveHistory(list: string[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_HISTORY)))
  } catch {
    // ignore
  }
}

/** 清空历史（A.2 二次确认后调用） */
export function clearHistoryStorage(): void {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // ignore
  }
}
