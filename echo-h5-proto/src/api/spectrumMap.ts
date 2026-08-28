// 光谱「后端语义 DTO → 前端视觉 VM」映射（契约 §11 · QA M-4：前端持布局）。
// 后端只下发语义值（intensity/depth/whisper/label），坐标/尺寸/色相/延迟全部由此处派生。
// 映射对 id 稳定（同一节点每次刷新落在同一位置），纯函数、无副作用，便于单测。

import type {
  ShadowArea,
  ShadowAreaView,
  SpectrumNode,
  SpectrumNodeView,
  SpectrumTone,
} from '../types'

const TONES: SpectrumTone[] = ['amber', 'blossom', 'green']

/** 稳定字符串哈希（与 mock 侧同一风格），返回非负整数 */
function hash(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

/** 由 id + salt 派生的 0~1 伪随机数（稳定） */
function unit(id: string, salt: number): number {
  return (hash(`${id}#${salt}`) % 1000) / 1000
}

const clamp = (v: number, lo: number, hi: number): number =>
  Math.min(hi, Math.max(lo, v))

/** 语义光点 → 视觉 VM：强度→尺寸，id→位置/色相/延迟（稳定） */
export function toSpectrumNodeView(dto: SpectrumNode): SpectrumNodeView {
  const intensity = clamp(dto.intensity, 0, 1)
  return {
    id: dto.id,
    label: dto.label,
    // 稳定散布在星云内 20%~80%，避免贴边
    x: Math.round(20 + unit(dto.id, 1) * 60),
    y: Math.round(20 + unit(dto.id, 2) * 60),
    // 强度越高越亮越大（12~28px）
    size: Math.round(12 + intensity * 16),
    // 由 id 稳定取一档暖色
    tone: TONES[hash(dto.id) % TONES.length],
    // 呼吸错相延迟 0~2.6s
    delay: Number((unit(dto.id, 3) * 2.6).toFixed(2)),
  }
}

/** 语义暗区 → 视觉 VM：depth→尺寸（面积小、弱于光面），id→位置/延迟（稳定） */
export function toShadowAreaView(dto: ShadowArea): ShadowAreaView {
  const depth = clamp(dto.depth, 0, 1)
  return {
    id: dto.id,
    whisper: dto.whisper,
    x: Math.round(20 + unit(dto.id, 1) * 60),
    y: Math.round(20 + unit(dto.id, 2) * 60),
    // 暗区 40~70px：明显小于/弱于光面地板
    size: Math.round(40 + depth * 30),
    delay: Number((unit(dto.id, 3) * 2.6).toFixed(2)),
  }
}

/** 整份光谱语义 → 视觉 VM */
export function mapSpectrum(dto: {
  nodes: SpectrumNode[]
  shadows: ShadowArea[]
}): { nodes: SpectrumNodeView[]; shadows: ShadowAreaView[] } {
  return {
    nodes: dto.nodes.map(toSpectrumNodeView),
    shadows: dto.shadows.map(toShadowAreaView),
  }
}
