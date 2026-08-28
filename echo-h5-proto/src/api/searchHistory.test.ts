import { describe, expect, it } from 'vitest'
import { MAX_HISTORY, addHistory, removeHistory } from './searchHistory'

// 附录 A.2/A.3 历史纯逻辑单测：去重置顶 / 上限挤旧 / 单删 / 空串忽略。

describe('addHistory（去重 + 置顶 + 上限挤旧）', () => {
  it('新词置顶', () => {
    expect(addHistory(['b', 'a'], 'c')).toEqual(['c', 'b', 'a'])
  })

  it('已存在则去重并置顶（不产生重复）', () => {
    expect(addHistory(['b', 'a', 'c'], 'a')).toEqual(['a', 'b', 'c'])
  })

  it('达上限 10 后挤出最旧一条', () => {
    const ten = Array.from({ length: MAX_HISTORY }, (_, i) => `t${i}`) // t0..t9（t0 最新）
    const next = addHistory(ten, 'new')
    expect(next).toHaveLength(MAX_HISTORY)
    expect(next[0]).toBe('new')
    // 最旧的 t9 被挤出
    expect(next).not.toContain('t9')
    expect(next[MAX_HISTORY - 1]).toBe('t8')
  })

  it('首尾空白被裁剪后入库', () => {
    expect(addHistory([], '  末班车  ')).toEqual(['末班车'])
  })

  it('空 / 纯空格串忽略，不入库', () => {
    expect(addHistory(['a'], '')).toEqual(['a'])
    expect(addHistory(['a'], '   ')).toEqual(['a'])
  })
})

describe('removeHistory（单条删除）', () => {
  it('删除指定词', () => {
    expect(removeHistory(['a', 'b', 'c'], 'b')).toEqual(['a', 'c'])
  })
  it('删除不存在的词 → 原样返回', () => {
    expect(removeHistory(['a', 'b'], 'z')).toEqual(['a', 'b'])
  })
})
