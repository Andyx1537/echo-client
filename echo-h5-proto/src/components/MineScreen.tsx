import { useEffect, useState, type ReactNode } from 'react'
import type { Echo, MyPet } from '../types'
import { VISIBILITY_LABELS } from '../types'
import { api, track } from '../api'
import {
  canReroll,
  consume,
  readRerollState,
  reconcile,
  remainingFree,
  resolveFreePerRound,
  roundKeyOf,
  writeRerollState,
  type RerollState,
} from '../api/rerollQuota'
import CoverPlaceholder from './CoverPlaceholder'
import AiGeneratedBadge from './AiGeneratedBadge'
import AiImagineNote from './AiImagineNote'
import WarmthGlow from './WarmthGlow'
import { isAiGenerated } from '../lib/aiGenerated'
import { allowsGenerativeEntry } from '../lib/generativeEntry'
import { myWindowPetId } from '../lib/myWindow'

interface Props {
  pet: MyPet
  /** 打开自己的窗（详情页统一渲染） */
  onOpenWindow: () => void
  /** 走进「我的光谱」（仅"我的"主页显示） */
  onOpenSpectrum?: () => void
  /** 亲友行（仅"我的"主页注入；亲友主页不显示） */
  relationRow?: ReactNode
  /** 建档/回访/解锁后请求父级刷新宠物档案 */
  onPetRefresh?: () => void
  /** 测试用：删除当前宠物，回到建档（仅"我的"主页显示） */
  onResetPet?: () => void
  /** 亲友主页模式：显示返回、隐藏分享/回访/解锁 */
  isFriendView?: boolean
  friendName?: string
  onBack?: () => void
}

/**
 * 「换一批」每轮免费几次（定案 B7：服务端配置、默认 1、后续可调）。
 * 现由构建期配置收口；真后端下发该配置后，只需把入参换成配置值。
 */
const FREE_REROLL_PER_ROUND = resolveFreePerRound(
  import.meta.env.VITE_ECHO_REROLL_FREE as string | undefined,
)

/** 换一批的淡出时长(ms)：先轻轻淡出再换内容，避免生硬闪切 */
const SWAP_FADE_MS = 240

/** 羁绊温度：6 颗心 + 进度条 */
function HeartRow({ temperature }: { temperature: number }) {
  const filled = Math.round((temperature / 100) * 6)
  return (
    <div className="hearts">
      {Array.from({ length: 6 }).map((_, i) => (
        <span key={i} className={`heart ${i < filled ? 'on' : 'off'}`}>
          {i < filled ? '❤️' : '🤍'}
        </span>
      ))}
    </div>
  )
}

/** 我的它态：主卡（温度）+ 回访近况 + 光谱入口 + 亲友行 + 明信片墙 */
export default function MineScreen({
  pet,
  onOpenWindow,
  onOpenSpectrum,
  relationRow,
  onPetRefresh,
  onResetPet,
  isFriendView = false,
  friendName,
  onBack,
}: Props) {
  // 自己那扇窗的窗口键；暖光块按它取数（`GET /windows/:petId/remember`）
  const myPetId = myWindowPetId(pet)
  const [echoes, setEchoes] = useState<Echo[]>([])
  const [toast, setToast] = useState<string | null>(null)
  const [visiting, setVisiting] = useState(false)
  // 「换一批」：本轮已用几次 + 换的过程中的轻微过渡
  const [reroll, setReroll] = useState<RerollState>(
    () => readRerollState() ?? { roundKey: '', usedFree: 0 },
  )
  const [swapping, setSwapping] = useState(false)

  useEffect(() => {
    if (isFriendView) return
    let alive = true
    api.echoes().then((res) => alive && setEchoes(res.items)).catch(() => {})
    return () => {
      alive = false
    }
  }, [isFriendView, pet.petId])

  // 对齐「轮」：它下次捎来新的近况（最新一条变了）就是新一轮，免费次数自然回满（B7）
  useEffect(() => {
    if (isFriendView || echoes.length === 0) return
    const key = roundKeyOf(echoes)
    setReroll((cur) => {
      const next = reconcile(cur, key)
      if (next !== cur) writeRerollState(next)
      return next
    })
  }, [echoes, isFriendView])

  function flashToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2400)
  }

  async function visit() {
    if (visiting) return
    setVisiting(true)
    try {
      const res = await api.petVisit()
      track('pet_visit', {})
      setEchoes((cur) => [...res.newEchoes, ...cur])
      onPetRefresh?.()
      flashToast('你来啦，它感觉到你了 · 温度回暖了一点')
    } catch {
      flashToast('待会儿再来陪陪它吧')
    } finally {
      setVisiting(false)
    }
  }

  /**
   * 换一批（定案 B7 / 验收 TC-23）：换的是它这一批近况的**表达口吻/呈现**。
   * 三条守则：
   *  · 每轮免费 1 次（次数由 rerollQuota 裁定，换成功才扣、失败不扣）；
   *  · 用完只温柔说明「等它下次捎来新的近况」，不报错、不提付费；
   *  · 回忆本体一条都不动 —— 反馈里明说「回忆都还在」，避免误以为被抹掉。
   */
  async function rerollEchoes() {
    if (swapping) return
    if (!canReroll(reroll, FREE_REROLL_PER_ROUND)) {
      track('echo_reroll_limit', { round: reroll.roundKey })
      flashToast('这一轮就先这样吧 · 等它下次捎来新的近况，还可以再换一次')
      return
    }
    setSwapping(true)
    track('echo_reroll', { round: reroll.roundKey })
    try {
      const res = await api.echoReroll()
      // 轻微过渡：先淡出，再把新的说法放进来
      await new Promise((r) => setTimeout(r, SWAP_FADE_MS))
      if (res.items.length > 0) setEchoes(res.items)
      const spent = consume(reroll)
      setReroll(spent)
      writeRerollState(spent)
      flashToast('换了个说法 · 回忆都还在')
    } catch {
      // AI 失败按既有降级：回落温柔兜底，不阻断、不弹技术错误，也不扣这次免费额度
      flashToast('它这会儿说不出更多了，先按原来的样子陪你')
    } finally {
      setSwapping(false)
    }
  }

  /**
   * 这个对象要不要呈现生成类入口（`DECISIONS A7`）。
   * 判定统一走 `lib/generativeEntry.ts`，🔴 不要在这里自己比对 objectKind/objectStatus。
   */
  const canGenerate = allowsGenerativeEntry(pet)

  async function unlock(id: string) {
    try {
      await api.unlockPostcard(id)
      track('postcard_unlock', { id })
      onPetRefresh?.()
      flashToast('一张新的明信片，被陪伴慢慢解锁了')
    } catch {
      flashToast('这张还要再陪它一会儿才会来')
    }
  }

  return (
    <div className={`mine ${isFriendView ? 'friend-view' : ''}`}>
      {isFriendView && (
        <div className="friend-topbar">
          <button className="back-btn small" onClick={onBack} aria-label="返回">
            ←
          </button>
          <span className="friend-topbar-title">{friendName} 的主页</span>
        </div>
      )}

      {/* —— 主卡 —— */}
      <div className="pet-hero" onClick={isFriendView ? undefined : onOpenWindow}>
        {/* 与详情头图同一处理：角标不走 CoverPlaceholder 的左下角默认位（那里压着温度条与可见性行），
            改由 hero 文案块安放在名字上方一行 */}
        <CoverPlaceholder data={pet.cover} className="hero-cover" sizes="100vw" aiBadge="none" />
        <div className="hero-overlay">
          <div className="hero-top">
            {isAiGenerated(pet.cover) && <AiGeneratedBadge variant="hero" />}
            <h1 className="hero-name">
              {pet.name} <span className="hero-heart">💛</span>
            </h1>
            <p className="hero-sign">{pet.signature}</p>
          </div>

          <div className="hero-temp">
            <div className="temp-label">
              羁绊温度 <span className="temp-num">{pet.temperature}°</span>
            </div>
            <HeartRow temperature={pet.temperature} />
            <div className="temp-bar">
              <div className="temp-bar-fill" style={{ width: `${pet.temperature}%` }} />
            </div>
          </div>

          {!isFriendView && (
            <button
              className="open-window-btn"
              onClick={(e) => {
                e.stopPropagation()
                track('share_click', {})
                onOpenWindow()
              }}
            >
              <span className="owb-ico">🪟</span> 打开一扇窗 · 分享给想它的人
            </button>
          )}

          <p className="visibility">🔒 当前：{VISIBILITY_LABELS[pet.visibility]}</p>
        </div>
      </div>

      {/* —— 暖光：它被记着（`H-4`/`H-6`，仅"我的"主页）——

          🔴 **位置是紧贴 hero、在回访之前**，这是版面判断，理由两条：
           ① hero 讲的是「羁绊温度」——**我**给它的；暖光讲的是**别人**也记得它。
              这两件事挨着才成对。顺带把一条界线画在了同一屏上：
              分母是自己的量可以给精确数（温度），分母是别人的量只给光（暖光）。
           ② 放到回访/回声之后，暖光会被夹在 AI 生成的近况中间。
              🔴 暖光是**真实发生过的事**，不该跟"温柔想象"混在一起被一起读。

          ⚠️ **亲友视角不出**：这一页在亲友视角下渲染的是 `friend.pet`（示例数据、没有真实窗口 id），
          出暖光只会出一个错的（会把"我的"暖光画到别人的页上）。裁定说的也是「用户自己的主页」。 */}
      {!isFriendView && myPetId && <WarmthGlow petId={myPetId} />}

      {/* —— 回访 · 看看它的近况（仅"我的"主页） ——
          🔴 裁定 `DECISIONS A7`：`objectKind=person` 且 `objectStatus ∈ {living, unknown}` 时，
          回访与回声（含「换一批」）这些生成类入口**不予呈现**，🔴 **不得报错**。
          所以这里是 `&& canGenerate`，不是 `disabled` 也不是点了弹提示——那两种都是报错的变体。
          ⚠️ P0 只做宠物，`canGenerate` 当前恒为 true，这一段是预留正确行为。 */}
      {!isFriendView && canGenerate && (
        <>
          <button className="visit-btn" onClick={visit} disabled={visiting}>
            {visiting ? '正在轻轻推开门…' : '🌤️ 回访 · 看看它今天的样子'}
          </button>

          {echoes.length > 0 && (
            <>
              {/* AI 诚实标识（CR2/TC-AI-03）：换一批只换说法，这个框始终在 */}
              <div className="echo-head">
                <AiImagineNote className="echo-note" />
                <button
                  className={`echo-reroll ${canReroll(reroll, FREE_REROLL_PER_ROUND) ? '' : 'spent'}`}
                  onClick={rerollEchoes}
                  disabled={swapping}
                >
                  {swapping ? '正在换个说法…' : '🍃 换一批'}
                </button>
              </div>

              <div className={`echo-list ${swapping ? 'swapping' : ''}`}>
                {echoes.slice(0, 3).map((e) => (
                  <div key={e.echoId} className="echo-item">
                    {e.placeholder && (
                      /* 近况缩略图只有 48px，角标出短标 */
                      <CoverPlaceholder data={e.placeholder} className="echo-thumb" aiBadge="compact" />
                    )}
                    <p className="echo-text">{e.text}</p>
                  </div>
                ))}
              </div>

              {/* 免费次数用完：温柔说明它换过一次了，不催、不提付费（B7 + COPY-GUIDE §3C） */}
              {remainingFree(reroll, FREE_REROLL_PER_ROUND) === 0 && (
                <p className="echo-reroll-hint">
                  这一轮已经换过一次说法了 · 等它下次捎来新的近况，还可以再换
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* —— 走进我的光谱（仅"我的"主页） —— */}
      {!isFriendView && onOpenSpectrum && (
        <button className="spectrum-entry" onClick={onOpenSpectrum}>
          <span className="se-ico">✨</span>
          <span className="se-text">
            <b>走进我的光谱</b>
            {/* 「只属于你」：已按 COPY-GUIDE C-1 判定为情感表达/归属描述，豁免绝对化限制，勿做合规改写 */}
            <em>照见自己的每一面 · 只属于你</em>
          </span>
          <span className="se-arrow">→</span>
        </button>
      )}

      {/* —— 亲友行（仅"我的"主页） —— */}
      {relationRow}

      {/* —— 明信片墙 —— */}
      <div className="wall-head">
        <h2 className="wall-title">🌿 明信片墙</h2>
        <span className="wall-sub">
          {isFriendView ? '它的温柔回忆 🤍' : '相伴解锁 · 慢慢珍藏 🤍'}
        </span>
      </div>

      <div className="postcards">
        {pet.postcards.map((pc) =>
          pc.locked ? (
            <button
              key={pc.id}
              className="postcard locked"
              onClick={isFriendView ? undefined : () => unlock(pc.id)}
              disabled={isFriendView}
            >
              <span className="lock-plus">＋</span>
              <span className="lock-text">🔒 {pc.unlockHint ?? '陪伴解锁'}</span>
            </button>
          ) : (
            <div key={pc.id} className="postcard">
              <CoverPlaceholder data={pc.placeholder!} className="pc-cover" badge={pc.date} />
              <div className="pc-body">
                <p className="pc-caption">{pc.caption}</p>
                <span className="pc-heart">🤍</span>
              </div>
            </div>
          ),
        )}
      </div>

      {/* —— 测试用：删除当前宠物，重入建档 —— */}
      {!isFriendView && onResetPet && (
        <button
          className="mine-reset-test"
          onClick={() => {
            if (window.confirm('测试用：删除当前宠物信息，回到建档流程？')) onResetPet()
          }}
        >
          🧪 测试：删除当前宠物并重新建档
        </button>
      )}

      {toast && <div className="mine-toast">{toast}</div>}
    </div>
  )
}
