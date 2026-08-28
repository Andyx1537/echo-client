import { describe, expect, it } from 'vitest'
import {
  SUBJECT_COPY,
  SUBJECT_LOW_CONFIDENCE_FALLBACK,
  SUBJECT_OPTIONS,
  SUBJECT_UNSURE,
  buildSubjectDeclaration,
  subjectChoiceKeyOf,
  subjectChoiceValue,
  subjectChoices,
  userAnswered,
  userOverrodeMachine,
} from './subjectDeclaration'

/**
 * 建档「主体指认」（`SR-6`）。钉的是两类东西：
 *  · 裁定第 3/4 条——两个值都要留库、且「用户主动填过」要能被读出来；
 *  · 🔴 文案红线——这一问必须像产品在了解用户，不像系统在核查用户。
 */

describe('裁定 3 · 机器原判与用户改动两个值都留库，不能只存最终值', () => {
  it('用户改动时，机器原判仍然留着', () => {
    const d = buildSubjectDeclaration('person', 'animal')
    expect(d.subjectType).toBe('animal') // 生效值听用户的
    expect(d.machineSubjectType).toBe('person') // 🔴 机器原判没有被覆盖掉
    expect(d.userSubjectType).toBe('animal')
  })

  it('🔴「机器判人、用户改成动物」与「机器本来就判动物」在库里必须能区分开', () => {
    const overridden = buildSubjectDeclaration('person', 'animal')
    const native = buildSubjectDeclaration('animal', null)
    expect(overridden.subjectType).toBe(native.subjectType) // 生效值相同
    expect(overridden).not.toEqual(native) // 🔴 但留痕不同，否则事后查不出误判率
  })

  it('用户未作答时，机器原判即生效值，且不伪造用户答案', () => {
    const d = buildSubjectDeclaration('animal', null)
    expect(d.subjectType).toBe('animal')
    expect(d.userSubjectType).toBeNull()
    expect(d.subjectSource).toBe('machine')
  })

  it('🔴 没碰过预填值就走过去，记成未作答（null），不是「选了动物」', () => {
    const d = buildSubjectDeclaration('person', null)
    expect(d.userSubjectType).toBeNull()
    expect(d.subjectType).toBe('person') // 生效值仍是机器判的，前端不替用户改口径
  })

  it('机器也没认出来时落保守兜底，但来源记 default 而不是 machine', () => {
    const d = buildSubjectDeclaration(null, null)
    expect(d.subjectType).toBe(SUBJECT_LOW_CONFIDENCE_FALLBACK)
    expect(d.machineSubjectType).toBeNull()
    // 🔴 记成 machine 会把「根本没判过」算进日后误判率的分母
    expect(d.subjectSource).toBe('default')
  })
})

describe('🔴 SR-D1 · 兜底必须落最保守的值，不能落能力最宽的值', () => {
  it('🔴 兜底值是 other，不是 animal', () => {
    // 旧实现回落 animal = 「认不出 + 用户不答 → 悄悄判成能力最宽的类别」，
    // 与 SR-D1「不答则默认落 L1（最保守）」方向完全相反。2026-08-26 改判。
    expect(SUBJECT_LOW_CONFIDENCE_FALLBACK).toBe('other')
    expect(buildSubjectDeclaration(null, null).subjectType).not.toBe('animal')
  })

  it('🔴 屏幕上预填的那一项与兜底提交的值必须是同一个', () => {
    // 界面写着「我也说不清」而库里落别的值，是这一屏最难看出来的错
    expect(SUBJECT_UNSURE.value).toBe(buildSubjectDeclaration(null, null).subjectType)
  })

  it('兜底触发条件的后半句：没主动填过就读得出来', () => {
    expect(userAnswered(buildSubjectDeclaration(null, null))).toBe(false)
    expect(userAnswered(buildSubjectDeclaration('animal', null))).toBe(false)
    expect(userAnswered(buildSubjectDeclaration(null, 'other'))).toBe(true)
  })

  it('🔴 主动点「我也说不清」算主动填过，与「没碰过」必须分得开', () => {
    const tapped = buildSubjectDeclaration(null, SUBJECT_UNSURE.value)
    const untouched = buildSubjectDeclaration(null, null)
    expect(tapped.subjectType).toBe(untouched.subjectType) // 生效值相同
    expect(userAnswered(tapped)).toBe(true)
    expect(userAnswered(untouched)).toBe(false) // 🔴 但兜底只对后者触发
  })
})

describe('🔴 四个界面项落三个契约值（取值域是线上字段，不扩值）', () => {
  it('低置信度出四项，高置信度出三项', () => {
    expect(subjectChoices(true)).toHaveLength(4)
    expect(subjectChoices(false)).toHaveLength(3)
    // 🔴 高置信度不出「我也说不清」——机器认准了，没有信息状态可言
    expect(subjectChoices(false).some((c) => c.key === 'unsure')).toBe(false)
  })

  it('🔴 界面项只用到三个契约值，一个都没多', () => {
    const values = new Set(subjectChoices(true).map((c) => c.value))
    expect([...values].sort()).toEqual(['animal', 'other', 'person'])
  })

  it('「一个地方，或一件东西」与「我也说不清」提交同一个值，但是两个界面项', () => {
    expect(subjectChoiceValue('thing')).toBe(subjectChoiceValue('unsure'))
    expect(subjectChoiceValue('unsure')).toBe('other')
    // 🔴 键不同才不会互相点亮
    expect(SUBJECT_UNSURE.key).not.toBe('thing')
  })

  it('机器原判能映射回一个界面项（预填成已选中项时用）', () => {
    expect(subjectChoiceKeyOf('animal')).toBe('animal')
    expect(subjectChoiceKeyOf('person')).toBe('person')
    // 机器判 other 是一次**断言**，预填到「一个地方，或一件东西」而不是「说不清」
    expect(subjectChoiceKeyOf('other')).toBe('thing')
  })
})

describe('裁定 4 · 用户主动填写这件事本身要能被读出来', () => {
  it('用户答过就标 user，哪怕答的和机器一样', () => {
    const d = buildSubjectDeclaration('animal', 'animal')
    expect(d.subjectSource).toBe('user')
  })

  it('没有机器原判、用户自己选的，同样算主动填写', () => {
    expect(buildSubjectDeclaration(null, 'other').subjectSource).toBe('user')
  })

  it('改没改过机器原判可以单独判出来（供统计，不参与门控）', () => {
    expect(userOverrodeMachine(buildSubjectDeclaration('person', 'animal'))).toBe(true)
    expect(userOverrodeMachine(buildSubjectDeclaration('animal', 'animal'))).toBe(false)
    expect(userOverrodeMachine(buildSubjectDeclaration('animal', null))).toBe(false)
  })
})

describe('🔴 文案红线 · 像产品在了解用户，不像系统在核查用户', () => {
  const allCopy = [
    SUBJECT_COPY.title,
    SUBJECT_COPY.hint,
    SUBJECT_COPY.lowConfidenceNote,
    ...subjectChoices(true).map((o) => o.label),
  ]

  it('不出现任何暴露系统判断结果的词', () => {
    // 「检测到…」「识别…」「判定…」这类词一出现，就等于当面告诉用户「你可能在违规」
    for (const s of allCopy) {
      expect(s).not.toMatch(/检测|识别|判定|系统|疑似|可能是/)
    }
  })

  it('不出现合规核查的口吻', () => {
    for (const s of allCopy) {
      expect(s).not.toMatch(/法规|合规|规定|肖像权|真人|核实|审核|违规|请确认|请说明/)
    }
  })

  it('🔴 没有任何选项暗示「选了会被限制」', () => {
    for (const o of subjectChoices(true)) {
      expect(o.label).not.toMatch(/限制|受限|不支持|无法|不可|需审核/)
    }
  })

  it('🔴 全屏文案都不提示「这个选择影响能生成什么」（不采 V4，2026-08-26 裁定）', () => {
    // 依据不是偏好：暗示后果 = 在 SR-7 承认的那个漏洞旁边贴上收益说明，
    // 而收益方向单一（「一只小动物」能力最宽），提示只会把人往那一项推。
    for (const s of allCopy) {
      expect(s).not.toMatch(/生成|功能|能做|权限|解锁|更多效果/)
    }
  })

  it('🔴 不夹带生存状态——这一问采集主体类型，不问生死（SR-5）', () => {
    for (const s of allCopy) {
      expect(s).not.toMatch(/离开|去世|过世|还在|在世|生前|已故|走了/)
    }
  })

  it('三个实体选项与规格 SR-6-COPY 逐字一致', () => {
    expect(SUBJECT_OPTIONS.map((o) => o.label)).toEqual([
      '一只小动物',
      '一个人',
      '一个地方，或一件东西',
    ])
    expect(SUBJECT_COPY.title).toBe('这个窗口，是为谁留的？')
  })

  it('🔴 `SR-D9` 已执行：不提供「以后再说」，不想说就选「其他」', () => {
    // 裁定 2026-08-26。真实代价段同日作废——预填补上后它不再是必答题。
    expect('defer' in SUBJECT_COPY).toBe(false)
    for (const s of allCopy) {
      expect(s).not.toMatch(/以后再说|稍后|跳过|下次/)
    }
  })
})
