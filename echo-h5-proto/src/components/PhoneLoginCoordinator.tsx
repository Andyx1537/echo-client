import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { authApi } from '../api/auth'
import { AuthApiError, applyPhoneResolution, normalizeMobilePhone, type Continuation, type PhoneChallenge, type PhoneResolutionResult } from '../api/authContract'
import { newIdempotencyKey } from '../api/authCredentialStore'

type Outcome = { result: PhoneResolutionResult }
type Pending = { continuation: Continuation; resolve: (value: Outcome | null) => void }
const Context = createContext<{ login: (continuation: Continuation) => Promise<Outcome | null> } | null>(null)

export function usePhoneLogin() {
  const value = useContext(Context)
  if (!value) throw new Error('PhoneLoginCoordinator is missing')
  return value
}

export default function PhoneLoginCoordinator({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const login = (continuation: Continuation) => new Promise<Outcome | null>((resolve) => setPending({ continuation, resolve }))
  const finish = (value: Outcome | null) => { pending?.resolve(value); setPending(null) }
  return <Context.Provider value={{ login }}>{children}{pending && <Dialog continuation={pending.continuation} finish={finish} />}</Context.Provider>
}

function Dialog({ continuation, finish }: { continuation: Continuation; finish: (value: Outcome | null) => void }) {
  const [phone, setPhone] = useState('')
  const [code, setCode] = useState('')
  const [challenge, setChallenge] = useState<PhoneChallenge | null>(null)
  const [resolution, setResolution] = useState<{ kind: 'bind_current' | 'switch_existing'; token: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsResend, setNeedsResend] = useState(false)
  const [now, setNow] = useState(Date.now())
  const keys = useRef(new Map<string, string>())
  const key = (slot: string) => {
    if (!keys.current.has(slot)) keys.current.set(slot, newIdempotencyKey())
    return keys.current.get(slot)!
  }
  const normalized = normalizeMobilePhone(phone)
  useEffect(() => {
    if (!challenge || resolution) return
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [challenge, resolution])
  const run = async (task: () => Promise<void>, onError?: (cause: unknown) => void) => {
    setBusy(true); setError(null)
    try { await task() } catch (cause) { onError?.(cause); setError(cause instanceof Error ? cause.message : '这一步暂时没有完成') }
    finally { setBusy(false) }
  }
  const requestChallenge = async () => {
    const slot = `send:${normalized}`
    const value = await authApi.createPhoneChallenge(normalized!, continuation, key(slot))
    setChallenge(value); setCode(''); setNeedsResend(false); keys.current.delete(slot)
  }
  const expiresIn = challenge ? Math.max(0, Math.ceil((challenge.expiresAt - now) / 1000)) : 0
  const resendIn = challenge ? Math.max(0, Math.ceil((challenge.resendAvailableAt - now) / 1000)) : 0
  const challengeUnavailable = Boolean(challenge && (needsResend || expiresIn === 0))
  return <div className="phone-login-backdrop"><section className="phone-login-dialog" role="dialog" aria-modal="true" aria-labelledby="phone-login-title">
    <button className="phone-login-close" aria-label="取消手机号登录" disabled={busy} onClick={() => finish(null)}>×</button><h2 id="phone-login-title">手机号登录</h2>
    {!challenge && <><p>验证前不会显示这个手机号是否已有账号。</p><input aria-label="手机号" autoFocus inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+86 138 0000 0000" /><button disabled={busy || !normalized} onClick={() => void run(requestChallenge)}>获取验证码</button></>}
    {challenge && !resolution && challengeUnavailable && <><p>{needsResend ? '这次验证码不能继续使用，请重新获取。' : '验证码已过期，请重新获取。'}</p><button disabled={busy || resendIn > 0} onClick={() => void run(requestChallenge)}>{resendIn > 0 ? `${resendIn} 秒后可重新获取` : '重新获取验证码'}</button></>}
    {challenge && !resolution && !challengeUnavailable && <><p>确认完成前，当前匿名账号和资料不会变化。验证码 {expiresIn} 秒后失效。</p><input aria-label="短信验证码" autoFocus inputMode="numeric" autoComplete="one-time-code" value={code} maxLength={6} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} /><button disabled={busy || ![4, 6].includes(code.length)} onClick={() => void run(async () => { const value = await authApi.verifyPhoneChallenge(challenge.challengeId, code, key(`verify:${challenge.challengeId}:${code}`)); setResolution({ kind: value.resolution, token: value.resolutionToken }) }, (cause) => { if (cause instanceof AuthApiError && ['challenge_expired', 'challenge_locked'].includes(cause.detail ?? String(cause.code))) setNeedsResend(true) })}>验证手机号</button>{resendIn > 0 ? <p>{resendIn} 秒后可重新获取</p> : <button disabled={busy} onClick={() => void run(requestChallenge)}>重新获取验证码</button>}</>}
    {resolution && <><strong>{resolution.kind === 'bind_current' ? '绑定当前账号' : '切换到已有账号'}</strong><p>{resolution.kind === 'bind_current' ? '刚才填写的内容会保留。' : '当前匿名资料不会迁移，需要重新填写；资料仍保留供后续受控找回。'}</p><button disabled={busy} onClick={() => void run(async () => { const result = await authApi.confirmPhoneResolution(resolution.token, key('confirm')); applyPhoneResolution(result); finish({ result }) })}>{resolution.kind === 'bind_current' ? '绑定并继续' : '确认切换'}</button></>}
    {error && <p role="alert">{error}</p>}
  </section></div>
}
