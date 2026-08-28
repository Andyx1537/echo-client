import { describe, expect, it } from 'vitest'
import { mapSpectrum, toShadowAreaView, toSpectrumNodeView } from './spectrumMap'
import type { ShadowArea, SpectrumNode } from '../types'

// M-4：前端持布局——后端只下发语义值，坐标/尺寸/色相/延迟由前端映射。
// 这里保障映射的确定性（同 id 稳定）、值域，以及 intensity/depth → 尺寸的单调性。

const node = (id: string, intensity: number): SpectrumNode => ({
  id,
  label: '记下自己的一面',
  intensity,
  createdAt: 1_700_000_000_000,
})

const shadow = (id: string, depth: number): ShadowArea => ({
  id,
  whisper: '有些日子，你对自己太严厉了一点。',
  depth,
})

describe('toSpectrumNodeView', () => {
  it('维持语义字段并补齐视觉字段', () => {
    const vm = toSpectrumNodeView(node('n-1', 0.5))
    expect(vm.id).toBe('n-1')
    expect(vm.label).toBe('记下自己的一面')
    expect(['amber', 'blossom', 'green']).toContain(vm.tone)
  })

  it('对同一 id 稳定（layout 不随刷新漂移）', () => {
    const a = toSpectrumNodeView(node('n-42', 0.7))
    const b = toSpectrumNodeView(node('n-42', 0.7))
    expect(a).toEqual(b)
  })

  it('坐标落在 20%~80% 星云内', () => {
    for (const id of ['a', 'bb', 'ccc', 'n-xyz', 'anchor-1']) {
      const vm = toSpectrumNodeView(node(id, 0.5))
      expect(vm.x).toBeGreaterThanOrEqual(20)
      expect(vm.x).toBeLessThanOrEqual(80)
      expect(vm.y).toBeGreaterThanOrEqual(20)
      expect(vm.y).toBeLessThanOrEqual(80)
    }
  })

  it('intensity 越大光点越大（12~28px），并对越界值收敛', () => {
    const low = toSpectrumNodeView(node('same', 0))
    const high = toSpectrumNodeView(node('same', 1))
    expect(low.size).toBe(12)
    expect(high.size).toBe(28)
    expect(high.size).toBeGreaterThan(low.size)
    // 越界 intensity 收敛到 [0,1]
    expect(toSpectrumNodeView(node('same', 5)).size).toBe(28)
    expect(toSpectrumNodeView(node('same', -3)).size).toBe(12)
  })
})

describe('toShadowAreaView', () => {
  it('depth 越深暗区越大（40~70px），仍弱于光面地板范围之上', () => {
    const shallow = toShadowAreaView(shadow('s-1', 0))
    const deep = toShadowAreaView(shadow('s-1', 1))
    expect(shallow.size).toBe(40)
    expect(deep.size).toBe(70)
    expect(shallow.whisper).toContain('严厉')
  })
})

describe('mapSpectrum', () => {
  it('整份语义 → 视觉 VM，长度与顺序保持', () => {
    const dto = {
      nodes: [node('n-1', 0.3), node('n-2', 0.9)],
      shadows: [shadow('s-1', 0.4)],
    }
    const vm = mapSpectrum(dto)
    expect(vm.nodes).toHaveLength(2)
    expect(vm.shadows).toHaveLength(1)
    expect(vm.nodes[0].id).toBe('n-1')
    // VM 不再暴露 intensity/createdAt（纯视觉）
    expect(vm.nodes[0]).not.toHaveProperty('intensity')
    expect(vm.nodes[0]).not.toHaveProperty('createdAt')
  })
})
