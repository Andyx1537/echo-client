import { describe, expect, it } from 'vitest'
import { asCardId, asPetId, petIdOfCard } from './ids'

/**
 * 「窗口键 / 卡片键」解耦。
 *
 * 背景：`GET /plaza` 已改发回忆卡（`EchoApi.PLAZA_FEED_KIND = KIND_CARD`），
 * `item.id` 的含义从 petId 变成了 cardId，而 `/windows/:petId/*` 收的仍是 petId——
 * 🔴 **拿错了是运行时静默 404，不是编译错。**
 *
 * ─────────────────────────────────────────────────────────────
 * 🔴 **这组用例的判据：把 `petIdOfCard()` 改回恒等转换（`return card.id`），
 * 下面第一条必须变红。** 上一版不满足这个判据——它断言的是
 * `petIdOfCard(x) === petIdOfCard(x)`（纯函数同入同出），而**纯函数这条性质
 * 与「取的是哪个字段」无关**，所以恒等实现照样绿。
 *
 * ⚠️ 那一版还自带一句「后端切过去之后上面那条会失败」：切换真的发生了，
 * 它仍然全绿。**断言插在了一个不会受该条件影响的地方**——
 * 写「守着某件事」的用例时，先问一句：那件事变了，这条断言会不会动？
 * ─────────────────────────────────────────────────────────────
 */

describe('卡片键 → 窗口键的唯一换算处', () => {
  /**
   * 🔴 两个键**取值不同**是这条用例的全部力气所在。
   * 取值相同的卡分不出「取了 petId」还是「取了 id」，那正是上一版失效的原因。
   */
  const card = { id: asCardId('card-77'), petId: asPetId('pet-doudou') }

  it('🔴 取的是卡自带的 petId，不是卡片键本身', () => {
    expect(petIdOfCard(card)).toBe('pet-doudou')
    // 显式钉住反面：一旦有人改回恒等，这一条会先红
    expect(petIdOfCard(card)).not.toBe('card-77')
  })

  it('换算只看 petId 字段——卡片键怎么变都不影响结果', () => {
    expect(petIdOfCard({ ...card, id: asCardId('card-99') })).toBe('pet-doudou')
  })

  it('petId 变了，换算结果跟着变（没有把某个值写死在实现里）', () => {
    expect(petIdOfCard({ ...card, petId: asPetId('pet-maimai') })).toBe('pet-maimai')
  })
})

describe('两个键在类型上互不相容（编译期约束，这里只做说明性断言）', () => {
  it('运行时都是字符串，所以拦不住的那部分必须由 tsc 拦', () => {
    // 🔴 品牌类型在运行时**完全不存在**，编译后就是裸字符串。
    // 所以「别把卡片键喂给窗口端点」这条只有 tsc 拦得住，用例拦不住——
    // 这也是为什么值得为它付类型层的成本。
    expect(typeof asPetId('pet-1')).toBe('string')
    expect(typeof asCardId('card-1')).toBe('string')
  })
})
