// API 客户层统一出口。
export { api, bootstrap, IS_MOCK } from './client'
export { hasUnread, loadInbox } from './inbox'
export { cardIdOfArrival, isArrivalId, mergeArrivals } from './arrivals'
export { track } from './track'
export type { TrackEvent } from './track'
export { reportPlazaSeen, reportWorkOpened } from './phase0'
export { getSession, setSession, patchSession, clearSession } from './session'
export { ApiError } from './backend'
export type {
  EchoBackend,
  FlowerPayload,
  FlowerResult,
  FollowResult,
  OnboardingStartPayload,
  OnboardingConfirmPayload,
  WindowDetail,
} from './backend'
