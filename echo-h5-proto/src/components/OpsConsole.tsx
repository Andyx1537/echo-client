import { useMemo, useState } from 'react'
import WorkOperatorScreen from './WorkOperatorScreen'
import CardOperatorScreen from './CardOperatorScreen'
import OpsSettingsScreen from './OpsSettingsScreen'

export type OpsPanel = 'works' | 'cards' | 'settings' | 'reports'

const PANELS: { id: OpsPanel; label: string }[] = [
  { id: 'works', label: '作品' },
  { id: 'cards', label: '回忆卡' },
  { id: 'settings', label: '先审开关' },
  { id: 'reports', label: '举报' },
]

function panelFromSearch(): OpsPanel {
  const params = new URLSearchParams(location.search)
  const raw = params.get('panel') || params.get('ops')
  if (raw === 'cards' || raw === 'settings' || raw === 'reports') return raw
  return 'works'
}

/** 内容运营台。后台是后台，不套 C 端手机壳。 */
export default function OpsConsole() {
  const initial = useMemo(panelFromSearch, [])
  const [panel, setPanel] = useState<OpsPanel>(initial)

  function open(next: OpsPanel) {
    setPanel(next)
    const url = new URL(location.href)
    url.searchParams.set('ops', next === 'works' ? 'works' : next)
    url.searchParams.delete('panel')
    history.replaceState(null, '', url)
  }

  return (
    <div className="ops-desk">
      <header className="ops-desk-head">
        <p className="ops-desk-kicker">内容运营</p>
        <h1>审核台</h1>
        <p className="ops-desk-sub">作品和回忆卡分栏处置。举报提交还没定，先不装。</p>
      </header>
      <nav className="ops-desk-nav" aria-label="运营台栏目">
        {PANELS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={panel === item.id ? 'ops-tab on' : 'ops-tab'}
            aria-current={panel === item.id ? 'page' : undefined}
            onClick={() => open(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>
      {panel === 'works' && <WorkOperatorScreen embedded />}
      {panel === 'cards' && <CardOperatorScreen />}
      {panel === 'settings' && <OpsSettingsScreen />}
      {panel === 'reports' && (
        <div className="works-empty">
          <p className="works-empty-title">举报还没开。</p>
          <p className="works-empty-sub">运营侧只能读列表，作者怎么提交还没有规格，这里不装假处置。</p>
        </div>
      )}
    </div>
  )
}
