/**
 * 🔴 **短命比稿板：不保证复现，撤除时直接删。**
 *
 * 这里的每一块都是为「让产品在某一次会上能并排看两版」搭的，图一旦交出去，
 * **交付物就是那张 PNG，不是这段代码**。它复用生产组件与生产 CSS 类名做保真，
 * 也就意味着**生产侧任何一次正常改动都可能让它静默变样**——不报错、不挂测试，
 * 只是长得不对了。所以：
 *
 *  · **不要**把这里的任何一块当成「还能再跑一次」的设施；
 *  · **不要**为了保住它而拦下生产侧该做的改动；
 *  · 已交付的图在 `docs/visual/`，那才是留痕。板子随时可删。
 *
 * 长命的那批（会被反复调回来改参数再出图的）在 `src/dev/design/`，规矩相反：
 * **自持样式，不 `@import` 生产样式表、不蹭生产类名**，这样它才不会被正式改动带塌。
 *
 * ------------------------------------------------------------------
 * 🔴 **出图前必读：这个工作区的 Vite HMR 会拿旧模块，而且不报任何错。**
 *
 * 症状是**源码已经改对了，页面却还是老样子**——改动可能是删了一个元素、换了一句文案、
 * 改了一条样式。页面上没有报错，控制台干净，overlay 也不出。
 *
 * 🔴 **这比听起来严重得多：出图是拿来拍板的。** HMR 拿旧模块，意味着
 * **一张用来做决策的图可能根本不对应当前代码**——而且没有任何东西会告诉你。
 * 2026-08-27 这一轮里它出现了两次：一次让「chip 已删」的页面上仍然显示着 chip
 * （源码搜过是干净的），一次让删掉的比稿板链接仍然留在索引页上。
 * 第一次如果信了浏览器，就会去「修」一处根本没问题的代码。
 *
 * **怎么识别：** 拿 `rg` 在源码里搜一遍你改的那个字符串/类名。
 * 🔴 **源码干净但页面上还在 = HMR 拿了旧模块，不是你的代码有问题。**
 * 反过来，源码里还搜得到，那才是真没改干净。**先搜源码，再信页面。**
 *
 * **怎么处理：** 重启 dev server 再出一次图，别在浏览器里反复刷新——
 * 整页刷新一样会拿到旧模块（这是 `S-3`，本工作区的文件监听问题，不是代码问题）。
 *
 *     lsof -ti:5173 | xargs -r kill -9 && rm -rf node_modules/.vite && npm run dev
 *
 * 🔴 **凡是要交出去当依据的图，都在重启后的那一次里截。**
 * ------------------------------------------------------------------
 *
 * 入口：`main.tsx` 里一段 `import.meta.env.DEV && ?visual=` 的 gate。
 * 生产构建里 `import.meta.env.DEV === false`，这一整棵树会被 Rollup 静态摇掉。
 *
 * 现存一组对比（详见 docs/visual/README.md）：
 *  · `?visual=stranger&plan=A|B`                  —— 陌生人视角的明信片墙：A 案 vs B 案
 *
 * 🔄 **`?visual=warmth`（广场暖光 连续 vs 三档）已于 2026-08-27 删除。**
 * 它要回答的是「广场上怎么发光才不吵」，而 2026-08-26 已裁定广场根本不发光，
 * 这块板没有问题可答了。已交付的图 `warmth-continuous.png` / `warmth-tiered.png` /
 * `warmth-side-by-side-screen*.png` 原样保留在 `docs/visual/`，那是当时的决策依据。
 */

import PhoneFrame from '../components/PhoneFrame'
import MineScreen from '../components/MineScreen'
import { STRANGER_PET, UNLOCKED_POSTCARDS } from './visualCompareData'
import DesignBoard from './design/DesignBoard'
import './visualCompare.css'

// ============================================================
// 陌生人视角：明信片墙 A 案 vs B 案
// ============================================================

/**
 * B 案下明信片墙那一块的温柔空态（`D20`：不留冷白；`SPEC-interaction-flow §10.3` 末尾要求「需要一个温柔空态」）。
 *
 * ⚠️ **文案与形态是本次对比自己拟的**，规格只写了「需要一个温柔空态」，没定长什么样。
 * 已记进卡点信箱，产品拍板前不要当成定稿。
 */
function GentleEmpty() {
  return (
    <div className="vc-gentle-empty">
      <span className="vc-gentle-glow" />
      <p className="vc-gentle-title">这扇窗，还留着更里面的一层</p>
      <p className="vc-gentle-sub">有些回忆它只想留给最亲近的人。你能看到的，是它愿意让世界记住的样子。</p>
    </div>
  )
}

export type StrangerPlan = 'A' | 'B'

/**
 * 陌生人视角的宠物窗口页。
 *
 * 🔴 **裁剪口径（两案完全一致，唯一差别只有明信片墙本身）**：
 *  · `isFriendView` 已经替我们收掉 B6 分享按钮 / B8 主卡可点 / B9–B12 回访与近况 / B13 光谱 / B14 亲友行；
 *  · 本层再收掉 §10.3 里标着「陌生人不出」的两块：
 *      - **B5 羁绊温度**（数字 + 六颗心 + 进度条）—— `N3` 明确；
 *      - **B7 可见性行**（「🔒 当前：…」）—— 仅本人；§10.6 #2 登记「今天亲友也能看到」，陌生人更不该有；
 *  · **B18 这只它的公开卡列表**：`§10.3` 标着「🔴 缺，整块没有」，代码里确实不存在 —— 🔴 **两张图都没有它，
 *    不是被我裁掉的**。它一旦做出来，两案都会比图上厚一块。
 *  · 面孔墙 / 暖光 / 回声 / 献花 / 生命之书长在 `DetailScreen` 上（那是另一层），本页本来就没有。
 *
 * 裁剪用的是「数据不给 + 一层 dev CSS 不渲染」，不改 `MineScreen` 一个字。
 */
function StrangerScreen({ plan, showEmpty = true }: { plan: StrangerPlan; showEmpty?: boolean }) {
  const pet =
    plan === 'A'
      ? // A 案：服务端按位裁 —— 已解锁位照发，未解锁位（含 unlockHint）整条不下发
        { ...STRANGER_PET, postcards: UNLOCKED_POSTCARDS }
      : // B 案：服务端整块不下发 —— postcards 字段根本不存在
        { ...STRANGER_PET, postcards: [] }

  return (
    <div className="vc-page">
      <p className="vc-label">
        陌生人视角 ·{' '}
        {plan === 'A'
          ? 'A 案：已解锁位照常展示'
          : showEmpty
            ? 'B 案：整墙不下发 + 温柔空态'
            : 'B 案（不含空态）：整墙不下发后，实际剩下什么'}
      </p>
      <PhoneFrame>
        {/* vc-stranger-crop 只做一件事：把 B5 温度与 B7 可见性行藏掉；B 案再多藏一个墙头 */}
        <div className={`vc-stranger-crop ${plan === 'B' ? 'vc-no-wall' : ''}`}>
          <MineScreen
            pet={pet}
            onOpenWindow={() => {}}
            isFriendView
            friendName={pet.name}
            onBack={() => {}}
          />
          {plan === 'B' && showEmpty && <GentleEmpty />}
        </div>
      </PhoneFrame>
    </div>
  )
}

// ============================================================
// 入口
// ============================================================

export default function VisualCompare({ params }: { params: URLSearchParams }) {
  // 第二轮：设计稿（`?design=`）。第一轮的选型对比页原样保留，它们是决策依据。
  if (params.has('design')) return <DesignBoard params={params} />

  const which = params.get('visual')

  if (which === 'stranger') {
    const plan = params.get('plan')
    // `empty=0`：B 案连空态也不给。空态的形态与文案是本次自拟的，
    // 🔴 留这一档是为了让产品能看见「不算我编的那块，B 案实际剩下什么」。
    const showEmpty = params.get('empty') !== '0'
    if (plan === 'both') {
      return (
        <div className="vc-pair">
          <StrangerScreen plan="A" />
          <StrangerScreen plan="B" showEmpty={showEmpty} />
        </div>
      )
    }
    return <StrangerScreen plan={plan === 'B' ? 'B' : 'A'} showEmpty={showEmpty} />
  }

  return (
    <div className="vc-index">
      <h1>视觉选型对比页（仅开发模式）</h1>
      <p>🔴 短命板：不保证复现，撤除时直接删。交付物是 <code>docs/visual/</code> 里的图，不是这段代码。</p>
      <ul>
        <li><a href="?visual=stranger&plan=both">陌生人明信片墙 · A vs B（并排）</a></li>
        <li><a href="?visual=stranger&plan=A">陌生人明信片墙 · A 案</a></li>
        <li><a href="?visual=stranger&plan=B">陌生人明信片墙 · B 案</a></li>
        <li><a href="?visual=stranger&plan=B&empty=0">陌生人明信片墙 · B 案（不含空态）</a></li>
      </ul>
    </div>
  )
}
