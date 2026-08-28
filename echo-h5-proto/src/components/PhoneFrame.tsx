import type { ReactNode } from 'react'

/** 把整个原型放进 390×844 的手机画框，居中漂浮，方便桌面浏览 */
export default function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="phone-stage">
      <div className="phone-frame">
        <div className="phone-notch" />
        <div className="phone-screen">{children}</div>
      </div>
      <p className="stage-caption">回声 · 往宠 —「一扇窗」交互原型 · 移动端预览</p>
    </div>
  )
}
