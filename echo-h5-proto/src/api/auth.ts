import { httpAuthApi } from './authContract'
import { mockAuthApi } from './authMock'

const isMock = !((import.meta.env.VITE_API_BASE as string | undefined)?.trim())

export const authApi = isMock ? mockAuthApi : httpAuthApi
export * from './authContract'
