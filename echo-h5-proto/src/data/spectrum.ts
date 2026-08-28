import type { ShadowAreaView, SpectrumNodeView } from '../types'

// —— 「我的光谱」内置假数据（mock 持布局，直接用视觉 VM）——
// 暖色光点占绝大多数（8~12 个），冷色暗区仅 1~2 处（面积小、弱于光面）。
// 位置以星云容器内的百分比表示；delay 让呼吸/闪烁彼此错开、显得自然。

/** 初始光点：用户过往回溯汇成的各个侧面（暖色为主） */
export const initialNodes: SpectrumNodeView[] = [
  { id: 'n-1', x: 30, y: 26, size: 20, tone: 'amber', delay: 0.0, label: '给陌生猫留了一碗粮的傍晚' },
  { id: 'n-2', x: 62, y: 20, size: 15, tone: 'blossom', delay: 1.4, label: '忍住没回那句气话' },
  { id: 'n-3', x: 47, y: 40, size: 26, tone: 'amber', delay: 0.7, label: '陪它走完最后一程，我没有逃开' },
  { id: 'n-4', x: 20, y: 52, size: 14, tone: 'green', delay: 2.1, label: '把攒了很久的话，慢慢说给妈妈听' },
  { id: 'n-5', x: 73, y: 46, size: 18, tone: 'blossom', delay: 0.4, label: '哭过之后还是准时起床了' },
  { id: 'n-6', x: 38, y: 62, size: 16, tone: 'amber', delay: 1.8, label: '原谅了那个迟到的自己' },
  { id: 'n-7', x: 60, y: 66, size: 13, tone: 'green', delay: 2.6, label: '独自吃饭那天，也认真做了顿饭' },
  { id: 'n-8', x: 82, y: 62, size: 12, tone: 'amber', delay: 1.1, label: '把窗台留给了午后的阳光' },
  { id: 'n-9', x: 28, y: 74, size: 15, tone: 'blossom', delay: 0.9, label: '第一次说出"我需要帮忙"' },
  { id: 'n-10', x: 52, y: 80, size: 17, tone: 'amber', delay: 2.3, label: '睡前谢过了今天的自己' },
]

/** 内在阴影区：由系统从纹理里悄悄涌现，可被整合回暖（1~2 处，克制） */
export const initialShadows: ShadowAreaView[] = [
  {
    id: 's-1',
    x: 68,
    y: 34,
    size: 60,
    delay: 0.5,
    whisper: '这段回忆里，其实也藏着你没说出口的一点怅然。',
  },
  {
    id: 's-2',
    x: 24,
    y: 40,
    size: 48,
    delay: 1.6,
    whisper: '有些日子，你对自己太严厉了一点。',
  },
]

/** 整合成功后的一句温柔反馈（随机取用，避免机械重复） */
export const integrateFeedback: string[] = [
  '你看见了它，它就成了你的一部分。',
  '被温柔接住的部分，也会开始发光。',
  '不必赶走它，让它留在光里就好。',
]
