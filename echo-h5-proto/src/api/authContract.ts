import type { Session } from '../types'
import {
  retainAnonymousRecoveryCredential,
  setActiveDeviceCredential,
} from './authCredentialStore'
import { getSession, setSession } from './session'

export type Continuation =
  | { intent: 'none' }
  | { intent: 'private_onboarding_generation'; resourceId: string; schemaVersion: 'v1' }

export type PhoneResolutionKind = 'bind_current' | 'switch_existing'
export type PhoneNextAction =
  | 'none'
  | 'resume_private_onboarding'
  | 'restart_in_existing_account'
  | 'open_private_onboarding'

export interface PhoneChallenge {
  challengeId: string
  expiresAt: number
  resendAvailableAt: number
}

export interface PhoneResolution {
  resolution: PhoneResolutionKind
  resolutionToken: string
  resolutionExpiresAt: number
}

export interface PhoneResolutionResult {
  accountId: string
  phoneBound: true
  sessionToken: string
  deviceCredential: null
  returnToAllowed: boolean
  nextAction: PhoneNextAction
  previousAnonymousCredentialDisposition: 'revoked' | 'retained_as_recovery'
  anonymousRecovery?: { recoveryCredential: string }
}

export interface DeviceSessionResult {
  accountId: string
  phoneBound: false
  sessionToken: string
  deviceCredential: string
  deviceCredentialAction: 'restored' | 'issued' | 'rotated_after_bind'
}

export interface AuthErrorData {
  retryAfterSeconds?: number
}

export class AuthApiError extends Error {
  constructor(
    public readonly code: string | number,
    message: string,
    public readonly detail?: string,
    public readonly data?: AuthErrorData,
  ) {
    super(message)
    this.name = 'AuthApiError'
  }
}

export interface AuthApi {
  deviceSession(input: { deviceCredential?: string; bootstrapNonce?: string }, idempotencyKey: string): Promise<DeviceSessionResult>
  createPhoneChallenge(phone: string, continuation: Continuation, idempotencyKey: string): Promise<PhoneChallenge>
  verifyPhoneChallenge(challengeId: string, code: string, idempotencyKey: string): Promise<PhoneResolution>
  confirmPhoneResolution(resolutionToken: string, idempotencyKey: string): Promise<PhoneResolutionResult>
}

interface Envelope<T> {
  code: number | string
  msg?: string
  detail?: string
  data?: T & AuthErrorData
}

const API_BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? ''
const ROOT = `${API_BASE.replace(/\/$/, '')}/api/v1`

async function request<T>(path: string, body: unknown, idempotencyKey: string, authenticated: boolean): Promise<T> {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Idempotency-Key': idempotencyKey,
  })
  const token = authenticated ? getSession()?.token : null
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${ROOT}${path}`, { method: 'POST', headers, body: JSON.stringify(body) })
  } catch {
    throw new AuthApiError('network_unavailable', '网络暂时没有连上，当前资料和账号仍在', undefined, { retryAfterSeconds: 0 })
  }

  let envelope: Envelope<T>
  try {
    envelope = (await response.json()) as Envelope<T>
  } catch {
    throw new AuthApiError('invalid_response', '暂时没能读懂返回内容，请稍后再试')
  }
  if (response.ok && (envelope.code === 0 || envelope.code === '0') && envelope.data) return envelope.data
  throw new AuthApiError(envelope.code, envelope.msg || '这一步暂时没完成，当前会话没有变化', envelope.detail, envelope.data)
}

export const httpAuthApi: AuthApi = {
  deviceSession: (input, key) => request('/auth/device/session', input, key, false),
  createPhoneChallenge: (phone, continuation, key) =>
    request('/auth/phone/challenges', { phone, purpose: 'login_or_bind', continuation }, key, true),
  verifyPhoneChallenge: (challengeId, code, key) =>
    request(`/auth/phone/challenges/${encodeURIComponent(challengeId)}/verify`, { code }, key, true),
  confirmPhoneResolution: (token, key) =>
    request(`/auth/phone/resolutions/${encodeURIComponent(token)}/confirm`, {}, key, true),
}

export function applyDeviceSession(result: DeviceSessionResult): Session {
  const session: Session = { token: result.sessionToken, accountId: result.accountId, isGuest: true, hasPet: false }
  setActiveDeviceCredential(result.deviceCredential)
  setSession(session)
  return session
}

export function applyPhoneResolution(result: PhoneResolutionResult): Session {
  const validNextActions: PhoneNextAction[] = [
    'none',
    'resume_private_onboarding',
    'restart_in_existing_account',
    'open_private_onboarding',
  ]
  const valid = Boolean(
    result
    && result.accountId
    && result.phoneBound === true
    && result.sessionToken
    && result.deviceCredential === null
    && typeof result.returnToAllowed === 'boolean'
    && validNextActions.includes(result.nextAction)
    && ['revoked', 'retained_as_recovery'].includes(result.previousAnonymousCredentialDisposition),
  )
  const recoveryCredential = result.anonymousRecovery?.recoveryCredential
  if (!valid || (result.previousAnonymousCredentialDisposition === 'retained_as_recovery' && !recoveryCredential)) {
    throw new AuthApiError('invalid_response', '账号确认结果不完整，当前账号没有变化')
  }

  if (result.previousAnonymousCredentialDisposition === 'revoked') {
    setActiveDeviceCredential(null)
  } else {
    retainAnonymousRecoveryCredential(recoveryCredential!)
    setActiveDeviceCredential(null)
  }
  const session: Session = { token: result.sessionToken, accountId: result.accountId, isGuest: false, hasPet: false }
  setSession(session)
  return session
}
