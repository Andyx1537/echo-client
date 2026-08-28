import { useEffect, useState } from 'react'
import type { Insights, Me, MyPet, Visibility } from '../types'
import { VISIBILITY_LABELS } from '../types'
import { api, track } from '../api'
import WarmthGlow from './WarmthGlow'
import { myWindowPetId } from '../lib/myWindow'

interface Props {
  me: Me
  pet: MyPet | null
  onOpenSpectrum: () => void
  /** 绑定/可见性变更后请求父级刷新会话与档案 */
  onRefresh: () => void
}

const VISIBILITY_OPTIONS: Array<{ key: Visibility; hint: string }> = [
  // private 档的说明属于告知类文案：只承诺「可见范围」，不承诺「存在范围」。
  // 平台依法承担审核义务，后台在审批与审计下具备受控可见能力，
  // 所以这里不能写「只有你能看见」这类绝对化说法（COPY-GUIDE C-1）。
  { key: 'private', hint: '仅你自己可见的窗' },
  { key: 'friends', hint: '你信任的挚友可以来看看' },
  { key: 'public', hint: '愿意让更多人记得它' },
]

/** 我：个人主页 / 光谱入口 / 设置(可见性三档) / 订阅·付费档位 / 账号(游客→绑定) / 被记得回响 */
export default function MeScreen({ me, pet, onOpenSpectrum, onRefresh }: Props) {
  // 自己那扇窗的窗口键；暖光块按它取数（`GET /windows/:petId/remember`）
  const myPetId = myWindowPetId(pet)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [visibility, setVisibility] = useState<Visibility>(pet?.visibility ?? me.visibilityDefault)
  const [toast, setToast] = useState<string | null>(null)
  const [binding, setBinding] = useState(false)

  useEffect(() => {
    let alive = true
    api.insights().then((res) => alive && setInsights(res)).catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    setVisibility(pet?.visibility ?? me.visibilityDefault)
  }, [pet?.visibility, me.visibilityDefault])

  function flashToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2200)
  }

  async function changeVisibility(v: Visibility) {
    setVisibility(v)
    if (pet) {
      try {
        await api.petPatch({ visibility: v })
        onRefresh()
        flashToast(`已设为「${VISIBILITY_LABELS[v]}」`)
      } catch {
        flashToast('待会儿再试一次吧')
      }
    }
  }

  async function bind(type: 'phone' | 'wechat') {
    setBinding(true)
    try {
      await api.bind(type, `mock-${type}`)
      track('bind_account', { type })
      onRefresh()
      flashToast('已经绑定好了 · 它会一直好好留在这里')
    } catch {
      flashToast('绑定没能完成，待会儿再来')
    } finally {
      setBinding(false)
    }
  }

  return (
    <div className="me">
      {/* —— 个人主页头 —— */}
      <div className="me-hero">
        <span className="me-avatar" style={{ background: 'linear-gradient(135deg,#f3d08a,#e79aa6)' }} />
        <div className="me-hero-text">
          <h1 className="me-name">{me.nickname}</h1>
          <span className={`me-badge ${me.isGuest ? 'guest' : 'bound'}`}>
            {me.isGuest ? '游客态 · 资产已为你留存' : '已绑定账号'}
          </span>
        </div>
      </div>

      {/* —— 光谱入口 —— */}
      <button className="spectrum-entry me-spectrum" onClick={onOpenSpectrum}>
        <span className="se-ico">✨</span>
        <span className="se-text">
          <b>向前的光谱</b>
          {/* 「只属于你」：已按 COPY-GUIDE C-1 判定为情感表达/归属描述，豁免绝对化限制，勿做合规改写 */}
          <em>照见你正在成为的样子 · 只属于你</em>
        </span>
        <span className="se-arrow">→</span>
      </button>

      {/* —— "被记得"私密回响（仅本人可见）· 按层级拆成两层 ——
          🔴 **裁定（2026-08-27，层级口径）：「记得」对应到对象身上，「看见」放在卡上面。**
          这条是**数据层面**的，不是展示口径 —— 所以原来那三个数不是「要不要换」的问题，
          是**它们根本不属于同一层**：「记得」是这只宠物被记得，「看见」是某一张卡被看了。
          把它们并排在一张卡里、同字号同颜色，等于把两个层级的东西**伪装成同一排指标**。

          于是这张卡现在有两层，🔴 **两层在视觉上必须能被一眼分开**
          （居中 / 左对齐、暖色 / 灰、大 / 小，三项一起变）——
          分不开的话，读者还是会把它们读成一排并列的成绩。

          ① 对象层（主体）：暖光 + 一句话 + 「有没有人送过花」。都不给数。
             - 「N 人记得它」已在 `H-5` 换成暖光。
             - 🔴 **「N 朵花」的数值也去掉了**：累计朵数无上限、只增不减，
               和「N 人记得它」是同一类分数。**送过花这件事保留**（那是别人做过的具体的事），
               **送了多少朵不给**。✅ **2026-08-27 已裁定：留。** 这一行是拍过板的。

          ② 卡层（附属）：你放出去的卡，哪些还没有人看过。
             - 🔴 **「N 次被看见」不是被删掉，是换了量**：从「被看了多少次」换成
               「还有几张没人看过」。理由是前者衡量的是**曝光**，而曝光是内容平台的指标，
               不是一个替人存放思念的地方的指标 —— 它**多发卡就涨**，主人有动机去刷。
               换成「还没被看过的张数」之后：有上限（自己的卡数）、越小越好、有终点，
               而且**多发一张卡只会让这个数变大**，刷不出好看的结果。
             - 🔴 **代价**：这一层仍然可数（六个点数得出来）。但数出来的是**自己有几张卡**，
               分母是自己、本来就知道；它不是别人给的量。这条区别是这一层能留数的全部理由。
             - ⚠️ 🔴 **那排点是「暂定，未经裁定」。** 产品在 2026-08-27 这一轮**没有选**，
               只说「按你的推荐留着」。所以它是本线的建议稿，**不是拍过板的东西**，
               后来的人不要把它当既定结论去引用或加固。两版对比图在
               `docs/visual/me-card-cardlayer-dots-vs-line.png`；撤掉就是删下面那个 `me-card-dots`，
               不牵动别处。（同一张卡里，「也有人给它带过花」那行**是已裁定保留的**，两者状态不同。）

          ⚠️ `cardCount / unseenCardCount` 服务端还没有这两个出参，mock 先给，见 `C-9`。 */}
      <section className="me-card">
        <h2 className="me-card-title">🤍 被记得的回响</h2>
        {/* 「只有你能看到」：已按 COPY-GUIDE C-1 判定为情感表达、豁免绝对化限制，勿做合规改写 */}
        <p className="me-card-sub">只有你能看到的一点温柔，不对外、不排名。</p>

        <div className="me-layer-obj">
          {myPetId && <WarmthGlow variant="bare" petId={myPetId} />}
          {!!insights?.flowersReceived && <p className="me-obj-extra">也有人给它带过花</p>}
        </div>

        {insights?.cardCount != null && (
          <div className="me-layer-card">
            <span className="me-layer-tag">你放出去的卡</span>
            <div className="me-card-dots" aria-hidden>
              {Array.from({ length: insights.cardCount }).map((_, i) => (
                <span
                  key={i}
                  className={`me-card-dot ${i < insights.cardCount! - (insights.unseenCardCount ?? 0) ? 'on' : ''}`}
                />
              ))}
            </div>
            <p className="me-layer-line">
              {insights.unseenCardCount
                ? `还有 ${insights.unseenCardCount} 张，还没有人看过`
                : '每一张都有人看过'}
            </p>
          </div>
        )}
      </section>

      {/* —— 设置：可见性默认三档 —— */}
      <section className="me-card">
        <h2 className="me-card-title">🔒 谁能看见它的窗</h2>
        <p className="me-card-sub">默认仅自己可见 · 逐项显式、随时可收回。</p>
        <div className="me-visibility">
          {VISIBILITY_OPTIONS.map((o) => (
            <button
              key={o.key}
              className={`me-vis-item ${visibility === o.key ? 'on' : ''}`}
              onClick={() => changeVisibility(o.key)}
              disabled={!pet && o.key !== 'private'}
            >
              <span className="me-vis-label">{VISIBILITY_LABELS[o.key]}</span>
              <span className="me-vis-hint">{o.hint}</span>
              {visibility === o.key && <span className="me-vis-tick">✓</span>}
            </button>
          ))}
        </div>
        {!pet && <p className="me-note">建了一扇窗之后，就能在这里调整可见性啦。</p>}
      </section>

      {/* —— 订阅 · 付费档位（诚实说明：只加速/款式，不锁内容）——
          术语（已拍板）：「订阅」只用于付费档位，标识符与埋点前缀走 sub_*（me-sub-list / me-sub-btn）；
          关注人、关注题材这类免费的关系行为一律叫「关注」，走 follow_*。
          这里是付费侧，不要跟着改名——两个词在产品里指两件事，改错方向比不改更麻烦。

          档位表述（DECISIONS NM1）：语义化档位名一律撤下，改用编号「一档 / 二档 / 三档」。
          作废名称：回声会员 · 家庭守护 · 回声守护 · 家族典藏 · 回声典藏——不要再写回来。
          编号 ↔ 价格 ↔ tier 枚举的唯一定义在 DECISIONS C5-T，本处只引用、不另立一套。
          这里只露出 P0 已开放的免费档与一档：二档为 P1 小范围 Beta、三档定价待定且 P0 不产生。 */}
      <section className="me-card">
        <h2 className="me-card-title">🌟 订阅 · 付费档位</h2>
        <p className="me-card-sub">目前开放：免费档（¥0）与一档（¥39 / 月）。</p>
        <ul className="me-sub-list">
          <li>更快解锁明信片进度（内容永远靠陪伴解锁，付费只加速）</li>
          <li>限定款式：节日 / 纪念日的皮肤、边框、材质</li>
          <li>为自己的沉静共鸣空间，多一点温柔的余裕</li>
        </ul>
        <button className="me-sub-btn" onClick={() => flashToast('这是原型 · 订阅入口稍后开放')}>
          了解一档
        </button>
        <p className="me-note">我们从不把某段回忆本身锁进付费墙。</p>
      </section>

      {/* —— 账号（游客 → 绑定） —— */}
      <section className="me-card">
        <h2 className="me-card-title">👤 账号</h2>
        {me.isGuest ? (
          <>
            <p className="me-card-sub">
              想永久留住它、跨设备、接收它的近况？绑定后游客态的一切都会无缝继承。
            </p>
            <div className="me-bind-row">
              <button className="me-bind phone" onClick={() => bind('phone')} disabled={binding}>
                📱 绑定手机
              </button>
              <button className="me-bind wechat" onClick={() => bind('wechat')} disabled={binding}>
                💬 绑定微信
              </button>
            </div>
          </>
        ) : (
          <p className="me-card-sub">账号已绑定，它会一直好好留在这里。</p>
        )}
      </section>

      {toast && <div className="me-toast">{toast}</div>}
    </div>
  )
}
