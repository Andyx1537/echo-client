import type { DetectSubject } from '../api/backend'

/**
 * 建档流程里的「主体指认」（规格 `SR-6`，制作人 2026-08-25 裁定形态）。
 *
 * ─────────────────────────────────────────────────────────────
 * 🔴 **同名陷阱，先读这一段再动代码。**
 *
 * `subjectType` 这个名字在项目里指了**三件不同的事**（`DECISIONS MOD5`）：
 *
 *  ① `PRD-echo-pet §3.3` —— 用户声明的对象类别（`pet`/`person`），约等于项目通用的 `objectKind`；
 *  ② 🔴 **本文件这一个** —— `API-CONTRACT` 建档识别出参 / `/start` 入参（`animal`/`person`/`other`），
 *     **已实现的线上契约字段**，是**用户随手就能改的预填值**；
 *  ③ `SPEC-subject-recognition-and-degradation` 的 `assetSubjectType`
 *     （`pet`/`person`/`object`/`unknown`）—— 素材侧机器判定，**生成门控的真正判据**。
 *
 * 🔴 **本文件产出的是 ②，不是 ③。绝不能拿它当生成门控的判据。**
 * 理由不是洁癖：这个值**用户点两下就能改**，拿它当门控 = 让用户自助关掉门控。
 * 契约 `§6A` 的辨异说明专门为防这一个具体的错误实现而写。
 *
 * 🔴 **同样不得回写 `objectKind` / `objectStatus`**（`SR-5`：三者不得复用、不得互推）。
 * 注意这条在**两个方向上**都要守：用户选「一个人」不该让前端自作主张收缩，
 * 用户选「一只小动物」更不该让前端把门放开。前端在这件事上**没有裁量权**。
 * ─────────────────────────────────────────────────────────────
 */

/** 契约既有取值域（`animal`/`person`/`other`）。🔴 不改名、不扩值，它是线上字段 */
export type SubjectType = DetectSubject['subjectType']

/**
 * 🔴 **低置信度那条路径的兜底值**，同时是那一屏的**预填值**。
 *
 * 🔴 **两处必须是同一个常量，不许各写一个字面量。** 界面预填「我也说不清」而提交
 * 却落别的值，是这一屏最容易出、又最难看出来的错——屏幕上写着一件事，库里存着另一件。
 *
 * ⚠️ **为什么是 `other` 而不是 `animal`**（2026-08-26 制作人裁定，`SR-D1`）：
 * 旧实现回落 `animal`，即「素材认不出 + 用户不答 → 悄悄判成**能力最宽**的类别」，
 * 与 `SR-D1`「不答则默认落 `L1`（最保守）」**方向完全相反**。
 * `other` 是三个取值里最保守的一个，这才是那条兜底想要的终点。
 */
export const SUBJECT_LOW_CONFIDENCE_FALLBACK: SubjectType = 'other'

/** 用户主动指认的来源标记。沿用规格 `assetSubjectSource` 的词表，保持全库一个说法 */
export type SubjectSource = 'machine' | 'user' | 'default'

/**
 * 一次主体指认的完整留痕。
 *
 * 🔴 **裁定第 3 条要求机器原判与用户改动<u>两个值都留库</u>，不能只存最终值。**
 * 所以这里是三个字段并存，而不是一个被覆盖掉的 `subjectType`：
 * 只存最终值的话，「机器判成人、用户改成动物」与「机器就判的动物」在库里长得一模一样，
 * 事后既查不出误判率，也无从执行第 4 条。
 */
export interface SubjectDeclaration {
  /** 生效值 = 既有契约字段 `subjectType`，照原样发给 `/pet/onboarding/start` */
  subjectType: SubjectType
  /** 机器原判。识别不出主体时为 `null`——🔴 不要用 `'animal'` 冒充「没认出来」 */
  machineSubjectType: SubjectType | null
  /**
   * 用户指认。🔴 `null` = **未作答**（没碰过预填值就走过去了），不是「选了动物」。
   *
   * ⚠️ 🔴 **「未作答」现在是一个有明确含义的状态，不是缺失值**（`SR-D1` 2026-08-26 改判）：
   * 那一屏是**预填 + 可改**，所以「用户没动预填值就提交」本身就是一次表态 ——
   * 它是 `SR-D1` 兜底分支（落 `L1`）的**触发条件**，判据就是下面的
   * `subjectSource !== 'user'`。🔴 **不要把它当成「数据没收集到」去补齐。**
   */
  userSubjectType: SubjectType | null
  /**
   * 🔴 **裁定第 4 条的载体**：`'user'` 表示这个值是用户**主动填写**的。
   * 裁定原文——「用户主动填过这个事实本身就是偏向他的理由，不只是留个痕」，
   * 所以这不是一个统计字段，🔴 **生成侧要真的读它并偏向用户的意愿**。
   */
  subjectSource: SubjectSource
}

/**
 * 合成留痕。纯函数，规则集中在这里，免得三个字段在组件里各写各的而对不上。
 *
 * ⚠️ 生效值的优先级：用户答了就听用户的 → 否则用机器的 → 都没有才落保守兜底。
 * 🔴 最后那档是 `'default'` 而不是 `'machine'`：没有机器判定却记成机器判的，
 * 会让日后统计误判率时把一批「根本没判过」算进分母。
 *
 * 🔄 🔴 **2026-08-26 改判**：最后那档从 `'animal'` 改为
 * `SUBJECT_LOW_CONFIDENCE_FALLBACK`（`'other'`），依据见该常量。
 */
export function buildSubjectDeclaration(
  machineSubjectType: SubjectType | null,
  userSubjectType: SubjectType | null,
): SubjectDeclaration {
  if (userSubjectType) {
    return { subjectType: userSubjectType, machineSubjectType, userSubjectType, subjectSource: 'user' }
  }
  if (machineSubjectType) {
    return { subjectType: machineSubjectType, machineSubjectType, userSubjectType: null, subjectSource: 'machine' }
  }
  return {
    subjectType: SUBJECT_LOW_CONFIDENCE_FALLBACK,
    machineSubjectType: null,
    userSubjectType: null,
    subjectSource: 'default',
  }
}

/** 用户是否改动了机器原判（供埋点与后端统计误判率；🔴 不参与任何门控） */
export function userOverrodeMachine(d: SubjectDeclaration): boolean {
  return d.userSubjectType !== null && d.machineSubjectType !== null
    && d.userSubjectType !== d.machineSubjectType
}

/**
 * 用户**没有**主动填过——即 `SR-D1` 兜底（默认落 `L1`）触发条件的**后半句**。
 *
 * 🔴 **前半句「素材置信度低」不在前端，也不该在前端。** 它比的是素材侧的
 * `assetSubjectConfidence`（服务端，规格 `SR-8`），⚠️ **与 `/detect` 出参里那个
 * `confidence` 不是同一个量** —— 后者是肖像种类识别的置信度。两者混用会让
 * 「前端自己算出一个 `L1`」，那是把门控搬到了用户点得到的地方。
 *
 * 🔴 **所以这个函数只是把「有没有主动填」读得出来，它不判 `L1`、不判任何档位。**
 * 落档在服务端，判据是两半句合取。
 */
export function userAnswered(d: SubjectDeclaration): boolean {
  return d.subjectSource === 'user'
}

/**
 * 🔴 文案是红线的一部分，所以和逻辑放在一起、由用例钉住，不散落在 JSX 里。
 *
 * 规格 `SR-6-COPY` 原文。**绝对禁止**改成下面这类写法（任一出现即打回）：
 *  ❌「检测到你上传的可能是人类」
 *  ❌「你上传的内容涉及真人肖像，请确认」
 *  ❌「为符合相关法规，请说明主体类型」
 *
 * 🔴 **禁的理由**：这三种写法都把**系统的判断结果**摊给用户看，等于当面告诉他
 * 「你可能在违规」。这一问要读起来像**产品在了解用户**，不是**系统在核查用户**。
 * 🔴 也**不得有任何选项暗示「选了某个答案会被限制」**——用户选完得到的是
 * 「一个更合适的窗口」，不是一次放行或拒绝。
 */
export const SUBJECT_COPY = {
  title: '这个窗口，是为谁留的？',
  hint: '知道了这个，我们才好用对的方式陪着它。',
  /**
   * 🔴 **临时采用（2026-08-26），待「文案整体过一遍」专项重写，不要当定稿。**
   * 制作人对这一句的原话是「也墨迹和孱弱」，选它只是「目前先这样」。
   *
   * 手法是**换主语**：主语是「这一张（照片）」，不是「我们（系统没本事）」，
   * 也不是「你（没拍好）」—— 这样既没暴露判定结果（守住上面那三条禁令），
   * 又没把谁架上台。
   *
   * ⚠️ 🔴 **已知缺陷，留给文案专项**：这句话断言了素材「是逆光的」，而
   * 低置信度的成因可能是模糊、主体太小、合影等等 —— 断言错了比说得含糊更糟。
   */
  lowConfidenceNote: '这一张是逆光的，ta 的样子看得不太真切 —— 你说的，我们就听你的。',
} as const

/**
 * 🔴 **界面项的键。它不是契约值** —— `thing` 与 `unsure` **都提交 `other`**。
 *
 * ⚠️ **为什么要另立一层键**：那一屏低置信度时出四项，而契约取值域只有三个值
 * （`animal`/`person`/`other`，线上字段，🔴 **不扩值**）。选中态若直接用契约值做键，
 * 「一个地方，或一件东西」与「我也说不清」会互相点亮 —— 它们是同一个值。
 */
export type SubjectChoiceKey = 'animal' | 'person' | 'thing' | 'unsure'

export interface SubjectChoice {
  key: SubjectChoiceKey
  /** 提交给契约的值 */
  value: SubjectType
  label: string
}

/** 三个实体选项。🔴 措辞照 `SR-6-COPY`，改字前先回去读上面那段 */
export const SUBJECT_OPTIONS: readonly SubjectChoice[] = [
  { key: 'animal', value: 'animal', label: '一只小动物' },
  { key: 'person', value: 'person', label: '一个人' },
  { key: 'thing', value: 'other', label: '一个地方，或一件东西' },
]

/**
 * 🔴 **只在低置信度那条路径上出，并且它就是那条路径的预填项。**
 *
 * ⚠️ **它与「一个地方，或一件东西」不是一回事，尽管两者提交同一个值**：
 * 前者是**确定的断言**（主体是物、是地方），这一项是**未断言**（我没判断）。
 * 差别是断言 vs 未断言，不是粗细。
 * 🟢 词是从既有词表里拿的（`era` 维度的兜底叶），语气过过一遍；它描述的是
 * **信息状态**「我说不清」，不是**分类结果**「你没归好」。
 *
 * 🔴 **高置信度时不出这一项** —— 机器认准了，没有「信息状态」可言，
 * 出了反而是把系统的犹豫暴露给一个本来毫无疑问的用户。
 */
export const SUBJECT_UNSURE: SubjectChoice = {
  key: 'unsure',
  value: SUBJECT_LOW_CONFIDENCE_FALLBACK,
  label: '我也说不清',
}

/** 那一屏该出哪几项。🔴 低置信度多一项「我也说不清」，其余两条路径一致 */
export function subjectChoices(lowConfidence: boolean): readonly SubjectChoice[] {
  return lowConfidence ? [...SUBJECT_OPTIONS, SUBJECT_UNSURE] : SUBJECT_OPTIONS
}

/** 界面项键 → 契约值 */
export function subjectChoiceValue(key: SubjectChoiceKey): SubjectType {
  return key === 'unsure' ? SUBJECT_UNSURE.value : SUBJECT_OPTIONS.find((o) => o.key === key)!.value
}

/** 契约值 → 界面项键（把机器原判预填成一个已选中的选项时用） */
export function subjectChoiceKeyOf(value: SubjectType): SubjectChoiceKey {
  return SUBJECT_OPTIONS.find((o) => o.value === value)!.key
}
