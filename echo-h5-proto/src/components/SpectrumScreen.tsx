import { useEffect, useMemo, useState } from 'react'
import type { ShadowAreaView, SpectrumNodeView, SpectrumTone } from '../types'
import { api, track } from '../api'
import { integrateFeedback } from '../data/spectrum'

interface Props {
  onBack: () => void
}

const toneGradient: Record<SpectrumTone, string> = {
  amber: 'radial-gradient(circle at 35% 30%, #ffe6b0, #f0c27a 45%, rgba(227,161,60,0))',
  blossom: 'radial-gradient(circle at 35% 30%, #ffd9e0, #e79aa6 45%, rgba(231,154,166,0))',
  green: 'radial-gradient(circle at 35% 30%, #dfeac2, #9cb27e 45%, rgba(156,178,126,0))',
}

/**
 * 「我的光谱」v-α —— 一面照见自己的温柔镜子。
 * solo、暖色为主；冷色暗区=自己的内在阴影，可被"整合"回暖。
 * 心理安全底座：暗面可一键关闭、永远有光的地板、外界进不来。
 * 数据经 API 客户层（mock 回退持久化）；锚点/整合走契约 §11 埋点。
 */
export default function SpectrumScreen({ onBack }: Props) {
  const [nodes, setNodes] = useState<SpectrumNodeView[]>([])
  const [shadows, setShadows] = useState<ShadowAreaView[]>([])
  const [showShadows, setShowShadows] = useState(true)
  const [popIds, setPopIds] = useState<Set<string>>(new Set())

  const [anchor, setAnchor] = useState('')
  const [active, setActive] = useState<ShadowAreaView | null>(null)
  const [responding, setResponding] = useState(false)
  const [response, setResponse] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    api
      .spectrum()
      .then((res) => {
        if (!alive) return
        setNodes(res.nodes)
        setShadows(res.shadows)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  const nextFeedback = useMemo(
    () => () => integrateFeedback[Math.floor(Math.random() * integrateFeedback.length)],
    [],
  )

  function flashToast(msg: string) {
    setToast(msg)
    window.setTimeout(() => setToast(null), 2600)
  }

  function markPop(id: string) {
    setPopIds((s) => new Set(s).add(id))
    window.setTimeout(
      () =>
        setPopIds((s) => {
          const n = new Set(s)
          n.delete(id)
          return n
        }),
      900,
    )
  }

  async function addAnchor() {
    const label = anchor.trim()
    if (!label) return
    setAnchor('')
    try {
      const node = await api.spectrumAnchor(label)
      track('spectrum_anchor', {})
      setNodes((n) => [...n, node])
      markPop(node.id)
      flashToast('这一面，被你轻轻记下了。')
    } catch {
      flashToast('待会儿再记一次吧。')
    }
  }

  /** 整合：暗区回暖 → 融入星云成为一个光点 */
  async function integrate(shadow: ShadowAreaView) {
    try {
      const { node } = await api.spectrumIntegrate(shadow.id)
      track('spectrum_integrate', {})
      setShadows((s) => s.filter((x) => x.id !== shadow.id))
      setNodes((n) => [...n, node])
      markPop(node.id)
      flashToast(nextFeedback())
    } catch {
      flashToast('先放着也没关系。')
    } finally {
      setActive(null)
      setResponding(false)
      setResponse('')
    }
  }

  return (
    <div className="spectrum-screen">
      <div className="spec-topbar">
        <button className="back-btn small light" onClick={onBack} aria-label="返回">
          ←
        </button>
        <span className="spec-title">我的光谱</span>
        <button
          className={`shadow-toggle ${showShadows ? 'on' : ''}`}
          onClick={() => setShowShadows((v) => !v)}
        >
          暗面 {showShadows ? '开' : '关'}
        </button>
      </div>

      <div className="spec-nebula">
        <div className="aurora a1" />
        <div className="aurora a2" />
        <div className="aurora a3" />

        {nodes.map((n) => (
          <div
            key={n.id}
            className={`spec-node ${popIds.has(n.id) ? 'pop' : ''}`}
            style={{
              left: `${n.x}%`,
              top: `${n.y}%`,
              width: n.size,
              height: n.size,
              background: toneGradient[n.tone],
              animationDelay: `${n.delay}s`,
            }}
            title={n.label}
          />
        ))}

        {showShadows &&
          shadows.map((s) => (
            <button
              key={s.id}
              className="spec-shadow"
              style={{
                left: `${s.x}%`,
                top: `${s.y}%`,
                width: s.size,
                height: s.size,
                animationDelay: `${s.delay}s`,
              }}
              onClick={() => {
                setActive(s)
                setResponding(false)
                setResponse('')
              }}
              aria-label="一处内在阴影"
            />
          ))}

        {/* 这句：已按 COPY-GUIDE C-1 判定为情感表达（描述光谱的私密体感，不承担告知义务），
            豁免绝对化限制，勿做合规改写 */}
        <p className="spec-caption">这里只照见你自己，外面的声音进不来。</p>
      </div>

      <div className="spec-input-bar">
        <input
          className="spec-input"
          value={anchor}
          onChange={(e) => setAnchor(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addAnchor()}
          placeholder="此刻，你想记下自己的哪一面？"
          maxLength={40}
        />
        <button className="spec-add" onClick={addAnchor}>
          留下
        </button>
      </div>

      {active && (
        <div className="spec-overlay" onClick={() => setActive(null)}>
          <div className="spec-card" onClick={(e) => e.stopPropagation()}>
            <div className="spec-card-glow" />
            <p className="spec-whisper">{active.whisper}</p>

            {responding ? (
              <>
                <input
                  className="spec-resp-input"
                  value={response}
                  onChange={(e) => setResponse(e.target.value)}
                  placeholder="想对这一面的自己说点什么…"
                  maxLength={40}
                  autoFocus
                />
                <div className="spec-actions">
                  <button className="spec-btn ghost" onClick={() => setResponding(false)}>
                    返回
                  </button>
                  <button className="spec-btn primary" onClick={() => integrate(active)}>
                    收下这句话
                  </button>
                </div>
              </>
            ) : (
              <div className="spec-actions">
                <button className="spec-btn primary" onClick={() => integrate(active)}>
                  接纳
                </button>
                <button className="spec-btn" onClick={() => setResponding(true)}>
                  回应
                </button>
                <button className="spec-btn ghost" onClick={() => setActive(null)}>
                  先放着
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && <div className="spec-toast">{toast}</div>}
    </div>
  )
}
