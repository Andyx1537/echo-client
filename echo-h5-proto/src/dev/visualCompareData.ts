/**
 * 🔴 仅供视觉选型对比使用的临时数据，**不参与生产构建之外的任何逻辑**。
 * 整个 `src/dev/` 目录连同 `main.tsx` 里的那段 gate 一起删除即可撤销，见 docs/visual/README.md。
 */

import type { MyPet, Placeholder, Postcard } from '../types'
import { assetUrl } from '../lib/assetUrl'

function cover(file: string, gradient: string, emoji: string): Placeholder {
  return { gradient, emoji, imageUrl: assetUrl(`seed-covers/${file}`), aiGenerated: true }
}

/* 🔄 `WarmthCard` / `WARMTH_CARDS`（广场暖光对比用的那 16 张）已于 2026-08-27 删除：
   广场已裁定不发光，那块比稿板没有问题可答了。已交付的图留在 docs/visual/。 */

// ============================================================
// 陌生人视角：明信片墙
// ============================================================

function pc(id: string, date: string, caption: string, file: string, gradient: string, emoji: string): Postcard {
  return { id, date, caption, locked: false, placeholder: cover(file, gradient, emoji) }
}

export const UNLOCKED_POSTCARDS: Postcard[] = [
  pc('vc-pd-1', '2022.04.12', '春天的风里，一起追过的蝴蝶', 'cover-pet-butterfly.jpg', 'linear-gradient(150deg,#eef3df,#d7e6c0)', '🦋'),
  pc('vc-pd-2', '2022.10.27', '落叶是秋天写给我们的信', 'cover-pet-ball.jpg', 'linear-gradient(150deg,#f6e4c4,#e7c087)', '🍂'),
  pc('vc-pd-3', '2023.01.06', '第一场雪里打滚的它', 'cover-pet-snowday.jpg', 'linear-gradient(150deg,#e9eef4,#cfd9e6)', '⛄'),
]

/**
 * 未解锁位：3 个。
 * 🔴 两案都不出——`unlockHint` 已定「仅本人可见」，不在本次对比范围内。
 * 留在这里是为了说明「服务端按位裁掉的是什么」，不是为了渲染。
 */
export const LOCKED_POSTCARDS: Postcard[] = [
  { id: 'vc-pd-4', locked: true, unlockHint: '相伴满 100 天，会有一张冬天的明信片' },
  { id: 'vc-pd-5', locked: true, unlockHint: '温度到 90°，解锁一张限定款' },
  { id: 'vc-pd-6', locked: true, unlockHint: '第一个周年，会寄来一张纪念卡' },
]

/** 陌生人正在看的那只它。温度/可见性字段照常带着——由裁剪层负责不渲染，见 VisualCompare。 */
export const STRANGER_PET: MyPet = {
  petId: 'vc-pet',
  name: '小黑',
  signature: '窗边看夕阳的黑猫先生',
  temperature: 88,
  visibility: 'public',
  recent: '今天的晚霞，很像你回来的那天。',
  cover: cover('cover-pet-sunset.jpg', 'linear-gradient(150deg,#f3ddc4 0%,#e6b98f 50%,#b98a72 100%)', '🌆'),
  postcards: [...UNLOCKED_POSTCARDS, ...LOCKED_POSTCARDS],
  lifeBook: [
    { title: '雨夜相遇', year: '2016', desc: '它蜷在屋檐下，我们就这样认识了。', placeholder: { gradient: 'linear-gradient(135deg,#efe1cf,#d8bd9c)', emoji: '🌧️' } },
    { title: '窗边的习惯', year: '2020', desc: '每到黄昏，它都会去窗台等我回家。', placeholder: { gradient: 'linear-gradient(135deg,#f3ddc4,#e0b489)', emoji: '🪟' } },
    { title: '换个地方', year: '2024', desc: '它去了很远的地方，晚霞替它跟我道别。', placeholder: { gradient: 'linear-gradient(135deg,#eed9c2,#d3a988)', emoji: '✨' } },
  ],
}
