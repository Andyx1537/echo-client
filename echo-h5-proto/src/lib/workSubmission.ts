import type { SubmissionCapability, Work } from '../types'

export function canSubmitWork(capability?: SubmissionCapability | null): boolean {
  return capability?.canSubmitWork === true
}

export function submissionWaitCopy(capability?: SubmissionCapability | null): string | null {
  if (!capability || capability.canSubmitWork === true) return null
  return '还有一条作品正在处理，先等它走完再发新的。'
}

export function canReviseWork(work?: Work | null): boolean {
  return work?.status === 'rejected'
}

export function reviseActionCopy(work?: Work | null): string | null {
  if (!canReviseWork(work)) return null
  return work?.nextAction === 'resubmit' ? '改好了，再提一次' : '改一改再提'
}
