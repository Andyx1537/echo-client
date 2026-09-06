import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import PhoneFrame from './components/PhoneFrame'
import PrivateOnboardingScreen from './components/PrivateOnboardingScreen'
import './styles/global.css'

// 🔴 临时：视觉选型对比页（`src/dev/`）。只在开发模式且带 `?visual=` 时生效，
// 生产构建里 `import.meta.env.DEV` 恒为 false，整棵 dev 树会被摇掉。撤除方式见 docs/visual/README.md。
const devVisual = import.meta.env.DEV ? new URLSearchParams(location.search) : null
const VisualCompare = React.lazy(() => import('./dev/VisualCompare'))

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {devVisual?.has('onboarding') ? (
      <PhoneFrame>
        <PrivateOnboardingScreen onComplete={() => {}} onSkip={() => {}} />
      </PhoneFrame>
    ) : devVisual?.has('visual') || devVisual?.has('design') ? (
      <React.Suspense fallback={null}>
        <VisualCompare params={devVisual} />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>,
)
