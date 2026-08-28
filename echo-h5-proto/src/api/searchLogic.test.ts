import { describe, expect, it } from 'vitest'
import type { SearchTopic, SearchUser, Window } from '../types'
import { asCardId, asPetId } from '../lib/ids'
import {
  HOT_TOPICS,
  MAX_QUERY_LEN,
  TOP_N,
  isEmptyResults,
  matchText,
  normalizeQuery,
  runSearch,
  searchTopics,
  searchUsers,
  searchWindows,
  splitHighlight,
  top3,
  truncateQuery,
} from './searchLogic'

// 附录 A.3/A.5 纯逻辑单测：匹配规则 / 截断 / 分区 / 空态 / 高亮。

// 用例里 id 照旧写裸字符串，由 helper 统一盖成 CardId/PetId——测试读起来不该被品牌类型弄脏
const win = ({
  id = 'w-x',
  ...over
}: Partial<Omit<Window, 'id' | 'petId'>> & { id?: string } = {}): Window => ({
  id: asCardId(id),
  petId: asPetId(id),
  petName: '默认',
  ownerName: '某人',
  ownerAvatar: 'g',
  recent: '',
  signature: '',
  warmthLevel: 0.5,
  cover: { gradient: 'g', emoji: '🌿' },
  lifeBook: [],
  span: 'short',
  ...over,
})

const users: SearchUser[] = [
  { id: 'u-xiaoman', nickname: '小满', avatar: 'g', persona: '把每一只猫都放进心里的人' },
  { id: 'u-azhe', nickname: '阿哲', avatar: 'g', persona: '和柯基一起长大的男孩' },
]

describe('匹配规则（A.3：子串包含 / 大小写不敏感 / 不做拼音）', () => {
  it('子串包含即命中', () => {
    expect(matchText('末班 302', '末班')).toBe(true)
    expect(matchText('靠窗第三排的风扇', '风扇')).toBe(true)
  })
  it('大小写不敏感', () => {
    expect(matchText('ABCdef', 'abcDEF')).toBe(true)
    expect(matchText('Cassette A面', 'cassette')).toBe(true)
  })
  it('不做拼音：mao 不命中「毛球」', () => {
    expect(matchText('毛球', 'mao')).toBe(false)
  })
  it('空查询恒不命中', () => {
    expect(matchText('任意', '')).toBe(false)
  })
})

describe('输入截断与归一化（A.5：50 字截断 / 纯空格不搜）', () => {
  it('截断到 50 字', () => {
    const long = 'a'.repeat(80)
    expect(truncateQuery(long)).toHaveLength(MAX_QUERY_LEN)
  })
  it('归一化去首尾空白', () => {
    expect(normalizeQuery('  末班车  ')).toBe('末班车')
  })
  it('纯空格 / 空串 → 空（不触发搜索）', () => {
    expect(normalizeQuery('     ')).toBe('')
    expect(normalizeQuery('')).toBe('')
  })
  it('先截断再 trim：50 个空格 → 空', () => {
    expect(normalizeQuery(' '.repeat(60))).toBe('')
  })
})

describe('分区过滤', () => {
  const windows: Window[] = [
    win({ id: 'w-doudou', petName: '豆豆', category: 'pet', recent: '豆豆今天追到了一只蝴蝶' }),
    win({ id: 'w-classroom', title: '靠窗第三排的风扇', category: 'youth', recent: '闷热的下午想起那阵风' }),
    win({ id: 'w-lastbus', title: '末班 302', category: 'place', recent: '那条线早就改号了' }),
  ]

  it('记忆区：命中标题', () => {
    const r = searchWindows(windows, '风扇')
    expect(r.map((w) => w.id)).toEqual(['w-classroom'])
  })
  it('记忆区：命中近况(recent)', () => {
    const r = searchWindows(windows, '蝴蝶')
    expect(r.map((w) => w.id)).toEqual(['w-doudou'])
  })
  it('记忆区：命中分类中文标签（宠物 → category=pet）', () => {
    const r = searchWindows(windows, '宠物')
    expect(r.map((w) => w.id)).toEqual(['w-doudou'])
  })
  it('用户区：仅匹配昵称，不匹配签名 persona', () => {
    expect(searchUsers(users, '阿哲').map((u) => u.id)).toEqual(['u-azhe'])
    // 「猫」只在 persona 里 → 不命中（签名不参与匹配）
    expect(searchUsers(users, '猫')).toEqual([])
  })
  it('主题区：匹配题材 chip 的 term', () => {
    const topics: SearchTopic[] = [
      { term: '宠物', category: 'pet' },
      { term: '末班车', category: 'place' },
    ]
    expect(searchTopics(topics, '末班').map((t) => t.term)).toEqual(['末班车'])
  })
  it('主题区：排除与查询完全相同的自反命中（缺陷复盘定案）', () => {
    const topics: SearchTopic[] = [{ term: '教室', category: 'youth' }]
    // 查「教室」= 题材同名 → 不自反回显（否则会吞掉「没有找到」空态）
    expect(searchTopics(topics, '教室')).toEqual([])
  })
})

describe('runSearch 三分区信封 + 空态（A.4/A.5）', () => {
  const windows: Window[] = [
    win({ id: 'w-doudou', petName: '豆豆', category: 'pet', recent: '追蝴蝶' }),
  ]

  it('返回三分区各自 {items,nextCursor} 信封', () => {
    const r = runSearch('宠物', { windows, users })
    expect(r.windows.nextCursor).toBeNull()
    expect(r.users.nextCursor).toBeNull()
    expect(r.topics.nextCursor).toBeNull()
    expect(Array.isArray(r.windows.items)).toBe(true)
    expect(r.windows.items.map((w) => w.id)).toEqual(['w-doudou'])
    // 主题排除「与查询完全相同」的自反命中（缺陷复盘定案）：查「宠物」→ 题材「宠物」不回显；
    // 内容仍由窗口分区承载（w-doudou）。
    expect(r.topics.items.some((t) => t.term === '宠物')).toBe(false)
  })

  it('三区全空 → isEmptyResults 为真', () => {
    const r = runSearch('不存在的词xyz', { windows, users })
    expect(isEmptyResults(r)).toBe(true)
  })

  it('热门题材词字面搜不到内容时 → 空态成立（不被主题自反命中吞掉）', () => {
    // 「教室」题材词在窗口标题/近况/分类标签(校园)里无字面命中，用户也不含 →
    // 主题自反已排除 → 三区全空 → 应展示「没有找到」（缺陷复盘定案）
    const r = runSearch('教室', { windows, users })
    expect(isEmptyResults(r)).toBe(true)
  })

  it('任一区有结果 → isEmptyResults 为假', () => {
    const r = runSearch('宠物', { windows, users })
    expect(isEmptyResults(r)).toBe(false)
  })
})

describe('top3（各分区≤3）', () => {
  it('截断到 TOP_N 条', () => {
    const arr = [1, 2, 3, 4, 5]
    expect(top3(arr)).toEqual([1, 2, 3])
    expect(TOP_N).toBe(3)
  })
})

describe('splitHighlight（关键词高亮切片）', () => {
  it('命中片段 hit=true，其余 false', () => {
    const segs = splitHighlight('末班 302', '末班')
    expect(segs).toEqual([
      { text: '末班', hit: true },
      { text: ' 302', hit: false },
    ])
  })
  it('大小写不敏感高亮，保留原文大小写', () => {
    const segs = splitHighlight('Cassette', 'cass')
    expect(segs[0]).toEqual({ text: 'Cass', hit: true })
    expect(segs[1]).toEqual({ text: 'ette', hit: false })
  })
  it('未命中 → 单个非高亮片段', () => {
    expect(splitHighlight('abc', 'z')).toEqual([{ text: 'abc', hit: false }])
  })
})

describe('HOT_TOPICS 配置（A.2 运营可配、过词表）', () => {
  it('每个热门题材都带可聚合的 category', () => {
    expect(HOT_TOPICS.length).toBeGreaterThan(0)
    for (const t of HOT_TOPICS) {
      expect(typeof t.term).toBe('string')
      expect(t.category).toBeTruthy()
    }
  })
})
