import type { ObjectKind, ObjectStatus } from '../types'

/** 带对象品类/状态的东西：窗口、宠物档案，都能直接传进来 */
type HasObjectIdentity = {
  objectKind?: ObjectKind
  objectStatus?: ObjectStatus
}

/**
 * 这个对象要不要呈现**生成类入口**（定妆 / 换装 / 动态化 / 唤醒视频 / 声音克隆 / 换一批近况）。
 *
 * 🔴 裁定 `DECISIONS A7`：`objectKind=person` 且 `objectStatus ∈ {living, unknown}` 时
 * **不予呈现（隐藏）**，🔴 **不得报错**。两条理由照抄裁定：
 *  ① 报错的原因在产品层无法解释——要解释就得跟用户讲人格权与授权基础；
 *  ② 冷硬报错与「界面宽泛易接受」的原则直接相悖。
 *
 * 所以调用方的正确用法是 `{allowsGenerativeEntry(x) && <按钮/>}`，
 * 🔴 **不是** `disabled` + 一句提示，也**不是**点了之后弹「暂不支持」——那两种都是报错的变体。
 *
 * 缺省口径（两个方向刻意不同，别当成笔误）：
 *  · `objectKind` 缺省 → 按 `pet`。P0 只做宠物，档案里根本没有这个字段，
 *    缺省当 `person` 会把唯一上线的品类整个关掉。
 *  · `objectStatus` 缺省 → 按 `unknown`（`SPEC-security §4.3.1` 明写默认值），
 *    而 `unknown` 本身就在隐藏区间里，所以一旦品类是「人」，没给状态就一律隐藏。
 *    🔴 状态**不许由前端猜、不许从文案反推**。
 *
 * ⚠️ P0 只做宠物、「人」品类未立项，本函数当前恒返回 true。这是**预留正确行为**，
 * 不是死代码：等「人」品类立项，行为已经对了，不用回头再找一遍所有生成入口。
 */
export function allowsGenerativeEntry(target: HasObjectIdentity | null | undefined): boolean {
  const kind: ObjectKind = target?.objectKind ?? 'pet'
  if (kind !== 'person') return true
  const status: ObjectStatus = target?.objectStatus ?? 'unknown'
  return status === 'deceased'
}
