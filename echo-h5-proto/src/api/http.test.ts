import { afterEach, describe, expect, it, vi } from 'vitest'
import { httpBackend } from './http'

// M-1/M-2：真后端所有列表接口统一返 { code:0, data:{ items, nextCursor } }。
// 这里保障 http 适配器正确解析信封——绝不把响应当数组。
// M-4：/spectrum 只下发语义 DTO，http 层负责映射为视觉 VM。

function mockFetchOnce(data: unknown) {
  const fn = vi.fn().mockResolvedValue({
    json: async () => ({ code: 0, data }),
  } as Response)
  vi.stubGlobal('fetch', fn)
  return fn
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('http 分页信封解析', () => {
  it('messages() 返回 Paged<Message>（.items + nextCursor）', async () => {
    mockFetchOnce({
      items: [
        {
          id: 'm-1',
          kind: 'pet',
          title: 't',
          preview: 'p',
          createdAt: 1,
          read: false,
          routeTo: { type: 'window', id: 'w-1' },
        },
      ],
      nextCursor: null,
    })
    const res = await httpBackend.messages()
    expect(Array.isArray(res)).toBe(false)
    expect(res.items).toHaveLength(1)
    expect(res.nextCursor).toBeNull()
    expect(res.items.some((m) => !m.read)).toBe(true)
  })

  it('records() 返回 Paged<RecordItem>', async () => {
    mockFetchOnce({
      items: [{ id: 'r-1', scope: 'self', text: 'x', createdAt: 2 }],
      nextCursor: 'r-1',
    })
    const res = await httpBackend.records('self')
    expect(res.items[0].scope).toBe('self')
    expect(res.nextCursor).toBe('r-1')
  })

  it('relations() 解析信封后返回数组（取 .items）', async () => {
    mockFetchOnce({ items: [{ id: 'rel-1' }, { id: 'rel-2' }], nextCursor: null })
    const list = await httpBackend.relations()
    expect(Array.isArray(list)).toBe(true)
    expect(list).toHaveLength(2)
  })

  // M-7：后端 lastActive、reels[].createdAt 为毫秒，http 层映射为前端约定的相对时间串。
  it('relations() 把 ms 时间字段映射为相对时间串', async () => {
    const now = Date.now()
    mockFetchOnce({
      items: [
        {
          id: 'rel-1',
          name: '远山',
          avatar: 'g',
          online: true,
          priority: false,
          mutedUntil: 0,
          lastActive: now - 5 * 60 * 1000,
          hasUnseenReel: true,
          viewableByMe: true,
          reels: [
            {
              id: 're-1',
              text: '团子今天遇到了同款柴柴',
              createdAt: now - 3 * 3600 * 1000,
              placeholder: { gradient: 'g', emoji: '🐕' },
            },
          ],
          pet: null,
        },
      ],
      nextCursor: null,
    })
    const list = await httpBackend.relations()
    expect(list).toHaveLength(1)
    // ms → 相对串（不再是 undefined，修复真后端下时间空白）
    expect(list[0].lastActive).toBe('5 分钟前')
    expect(list[0].reels[0].time).toBe('3 小时前')
  })
})

// §14.1 铁律：新增/改动列表接口必须补一条前端解析单测。
// plaza 是「进窗后连续下翻」（D21/TC-13）的同一条流来源，游标必须原样带上。
describe('http 广场游标续拉（TC-13 同一条流）', () => {
  it('plaza(cursor) 把游标带进 query 并解析 {items,nextCursor}', async () => {
    const fn = mockFetchOnce({ items: [{ id: 'w-2' }], nextCursor: 'c3' })
    const res = await httpBackend.plaza('c2')
    const [url] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/plaza?cursor=c2')
    expect(res.items).toHaveLength(1)
    expect(res.nextCursor).toBe('c3')
  })

  it('plaza() 无游标时不带 query（首页）', async () => {
    const fn = mockFetchOnce({ items: [], nextCursor: null })
    await httpBackend.plaza()
    const [url] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toMatch(/\/plaza$/)
  })
})

// B7/TC-23：换一批换的是口吻，走 {items,nextCursor} 信封；端点不可用时按 AI 既有降级回落。
describe('http 回声换一批（B7）', () => {
  it('echoReroll() POST /pet/me/echoes/reroll 并解析信封', async () => {
    const fn = mockFetchOnce({ items: [{ echoId: 'e-1', text: '换了个说法', createdAt: 1 }], nextCursor: null })
    const res = await httpBackend.echoReroll()
    const [url, init] = fn.mock.calls[0] as [string, RequestInit]
    expect(url).toContain('/pet/me/echoes/reroll')
    expect(init.method).toBe('POST')
    expect(res.items[0].echoId).toBe('e-1')
  })

  it('端点不可用/生成失败 → 降级回落重取近况流，不抛技术错误', async () => {
    const fn = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => ({ code: 5001, msg: '这会儿说不出更多了' }) } as Response)
      .mockResolvedValueOnce({
        json: async () => ({ code: 0, data: { items: [{ echoId: 'e-1', text: '原来的样子', createdAt: 1 }], nextCursor: null } }),
      } as Response)
    vi.stubGlobal('fetch', fn)

    const res = await httpBackend.echoReroll()
    // 第二次落到 GET /pet/me/echoes（既有降级：不阻断、原样陪着）
    const [secondUrl, secondInit] = fn.mock.calls[1] as [string, RequestInit]
    expect(secondUrl).toContain('/pet/me/echoes')
    expect(secondInit.method).toBe('GET')
    expect(res.items[0].echoId).toBe('e-1')
  })
})

describe('http 款式商店（装扮·增值，不锁内容）', () => {
  it('postcardSkins() 解析 {items} 信封后取 .items（§14.1）', async () => {
    mockFetchOnce({
      items: [
        { id: 'skin_dusk', name: '暮色', kind: 'gradient', price: 0 },
        { id: 'skin_gold_frame', name: '暖金边框', kind: 'frame', price: 6 },
      ],
    })
    const skins = await httpBackend.postcardSkins()
    expect(Array.isArray(skins)).toBe(true)
    expect(skins).toHaveLength(2)
    expect(skins[0].kind).toBe('gradient')
    // 只款式，kind 恒在 {gradient,frame,material}
    for (const s of skins) {
      expect(['gradient', 'frame', 'material']).toContain(s.kind)
    }
  })

  it('purchase() POST /shop/purchase 携 skinId，护栏 affectsUnlock:false', async () => {
    const fn = mockFetchOnce({ ok: true, skinId: 'skin_gold_frame', affectsUnlock: false })
    const res = await httpBackend.purchase('skin_gold_frame')
    expect(res.ok).toBe(true)
    expect(res.skinId).toBe('skin_gold_frame')
    // 定案 D2/CR-M：购买绝不影响任何解锁进度
    expect(res.affectsUnlock).toBe(false)
    const [, init] = fn.mock.calls[0] as [string, RequestInit]
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body as string)).toEqual({ skinId: 'skin_gold_frame' })
  })
})

describe('http 光谱语义 → 视觉映射', () => {
  it('spectrum() 把后端语义 DTO 映射为视觉 VM', async () => {
    mockFetchOnce({
      nodes: [{ id: 'n-1', label: 'a', intensity: 0.8, createdAt: 1 }],
      shadows: [{ id: 's-1', whisper: 'w', depth: 0.5 }],
    })
    const res = await httpBackend.spectrum()
    const n = res.nodes[0]
    expect(n).toHaveProperty('x')
    expect(n).toHaveProperty('size')
    expect(['amber', 'blossom', 'green']).toContain(n.tone)
    // VM 不含后端语义字段
    expect(n).not.toHaveProperty('intensity')
    expect(res.shadows[0]).toHaveProperty('size')
  })
})
