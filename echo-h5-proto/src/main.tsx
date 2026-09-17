import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PhoneFrame from './components/PhoneFrame'
import PrivateOnboardingScreen from './components/PrivateOnboardingScreen'
import PhoneLoginCoordinator from './components/PhoneLoginCoordinator'
import WorkOperatorScreen from './components/WorkOperatorScreen'
import './styles/global.css'

const params = new URLSearchParams(location.search)
// 🔴 临时：视觉选型对比页（`src/dev/`）。只在开发模式且带 `?visual=` 时生效，
// 生产构建里 `import.meta.env.DEV` 恒为 false，整棵 dev 树会被摇掉。撤除方式见 docs/visual/README.md。
const devVisual = import.meta.env.DEV ? params : null
const VisualCompare = React.lazy(() => import('./dev/VisualCompare'))
const opsWorks = params.get('ops') === 'works'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PhoneLoginCoordinator>{opsWorks ? (
      <PhoneFrame>
        <WorkOperatorScreen />
      </PhoneFrame>
    ) : devVisual?.has('onboarding') ? (
      <PhoneFrame>
        <PrivateOnboardingScreen onComplete={() => {}} onSkip={() => {}} onIdentityChanged={async () => {}} />
      </PhoneFrame>
    ) : devVisual?.has('visual') || devVisual?.has('design') ? (
      <React.Suspense fallback={null}>
        <VisualCompare params={devVisual} />
      </React.Suspense>
    ) : (
      <App />
    )}</PhoneLoginCoordinator>
  </React.StrictMode>,
)
