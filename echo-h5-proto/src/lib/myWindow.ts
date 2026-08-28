import type { MyPet } from '../types'
import { asPetId, type PetId } from './ids'

/**
 * 原型 mock 里「自己那扇窗」的键。
 * ⚠️ 只作回落用：真后端的自己窗就是 `MyPet.petId`，这个字面量不该出现在别处。
 */
const MY_WINDOW_FALLBACK = 'w-mine'

/**
 * 自己那扇窗的**窗口键**（`/windows/:petId/*` 那一组端点收的就是它）。
 *
 * 🔴 **自己的窗不是一张卡，没有卡片键——不要为它编一个。** 编出来的那个会被拿去调
 * `/cards/:cardId/messages`，那是一次静默 404。
 *
 * ⚠️ `MyPet.petId` 在契约里是**可选**的（`GET /pet/me` 在亲友示例数据下可能不带），
 * 缺省时回落到 mock 的自己窗键，这样原型不至于点不开自己的窗。
 */
export function myWindowPetId(pet: Pick<MyPet, 'petId'> | null | undefined): PetId | null {
  if (!pet) return null
  return asPetId(pet.petId ?? MY_WINDOW_FALLBACK)
}
