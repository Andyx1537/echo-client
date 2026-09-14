import type { SubmissionCapability } from '../types'

export function canSubmitWork(capability?: SubmissionCapability | null): boolean {
  return capability?.canSubmitWork === true
}

export function submissionWaitCopy(capability?: SubmissionCapability | null): string | null {
  if (!capability || capability.canSubmitWork === true) return null
  return '还有一条作品正在处理，先等它走完再发新的。'
}
