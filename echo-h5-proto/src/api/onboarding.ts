import { httpOnboardingApi } from './onboardingContract'
import { mockOnboardingApi } from './onboardingMock'

const isMock = !((import.meta.env.VITE_API_BASE as string | undefined)?.trim())

export const onboardingApi = isMock ? mockOnboardingApi : httpOnboardingApi
export * from './onboardingContract'
