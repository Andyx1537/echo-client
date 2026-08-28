/**
 * 「窗口键」与「卡片键」——🔴 **两者取值已经不同了。**
 *
 * ─────────────────────────────────────────────────────────────
 * 🔴 **这个文件存在的唯一理由：`GET /plaza` 的 `item.id` 含义从 petId 变成了 cardId。**
 *
 * 现状（后端 `EchoApi.PLAZA_FEED_KIND = KIND_CARD`，2026-08-27 改；出参形状见
 * `CardView`）：
 *  · `/windows/:petId/flower`、`/remember`、`/seen`、`GET /windows/:petId` 收的都是 **petId**；
 *  · 广场下发的 `item.id` 是 **cardId**，拿它去调上面那几个端点是**运行时静默 404**——
 *    不是编译错、不是类型错，只有点进去才会发现；
 *  · 卡自己带一个 `petId` 字段（`CardView` 字段表：string、**不可空**，前端据此跳窗口页）。
 *
 * 于是把两者拆成两个**互不兼容**的类型，让编译器替我们看住这条边界：
 * 谁想把卡片键直接喂给窗口端点，`tsc` 当场报错，而不是等上线后 404。
 * ─────────────────────────────────────────────────────────────
 */

declare const petIdBrand: unique symbol
declare const cardIdBrand: unique symbol

/**
 * 一扇窗的键 = 一份宠物档案的 id。
 * 🔴 `/windows/:petId/*` 那一组端点收的是**这个**。
 */
export type PetId = string & { readonly [petIdBrand]: true }

/**
 * 一张回忆卡的键。广场/信息流下发的 `item.id` 归这一类。
 * 🔴 `/cards/:cardId/*`（留言那一组）收的是**这个**。
 */
export type CardId = string & { readonly [cardIdBrand]: true }

/**
 * 一张卡上的「出处」两键。🔴 **两个键都要带着走**：
 * 留言走 `id`（cardId），窗口那一组走 `petId`，少带一个就有一组端点会 404。
 */
export interface CardOrigin {
  /** 卡片键，`GET /plaza` 的 `item.id` */
  readonly id: CardId
  /** 卡所属的窗，`CardView` 出参里那个不可空的 `petId` */
  readonly petId: PetId
}

/**
 * 🔴 **卡片键 → 窗口键的唯一换算处。**
 *
 * 取的是**卡自带的 `petId` 字段**（契约里卡的出处标记），🔴 **不是 `card.id`**——
 * 那两个值从后端改发回忆卡起就不再相等，拿 `id` 去调 `/windows/:petId/*` 是静默 404。
 *
 * 🔴 **谁都不许绕过这个函数直接 `as PetId`。** 绕过去的那一处，
 * 就是唯一一个不会报错、只会 404 的地方——也就是最难找的那一处。
 */
export function petIdOfCard(card: CardOrigin): PetId {
  return card.petId
}

/**
 * 把外部来的裸字符串标记成 petId。
 * ⚠️ 只在**边界**用：mock 种子、URL 参数、后端原始响应。业务代码里不该出现。
 */
export function asPetId(raw: string): PetId {
  return raw as PetId
}

/** 同上，标记成 cardId。⚠️ 只在边界用 */
export function asCardId(raw: string): CardId {
  return raw as CardId
}
