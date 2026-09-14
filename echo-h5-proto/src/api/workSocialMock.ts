import type { Work, WorkComment, WorkCommentThread, WorkCommentsPage } from '../types'

const PREVIEW_ROOTS = 3
const PREVIEW_REPLIES = 2

export interface SocialMockState {
  comments: WorkComment[]
  favorites: Array<{ accountId: string; workId: string; createdAt: number }>
}

export function freshSocial(works: Work[]): SocialMockState {
  const now = Date.now()
  const publicWork = works.find((w) => !w.status || w.status === 'public') ?? works[0]
  if (!publicWork) return { comments: [], favorites: [] }
  const roots = ['还记得那天的光。', '我路过也停了一下。', '谢谢你把它放出来。', '像听到一声很轻的招呼。', '今天又想起它了。']
  const comments: WorkComment[] = roots.map((body, i) => rootComment(publicWork.id, `acc_lin`, '邻座', body, now - (i + 1) * 60_000, i))
  const first = comments[0]
  ;['我也在。', '窗台那一块。', '后来就没再那么晒了。'].forEach((body, i) => {
    comments.push(replyComment(publicWork.id, first.commentId, first.commentId, 'acc_zhou', '阿周', body, now - 10_000 + i * 1000, 100 + i))
  })
  return { comments, favorites: [] }
}

export function mockCommentPage(
  state: SocialMockState,
  workId: string,
  guest: boolean,
  sort: 'hot' | 'latest',
  cursor?: string,
): WorkCommentsPage {
  if (guest && cursor) {
    throw Object.assign(new Error('先绑定一下手机号吧。'), { code: 1002, detail: 'phone_binding_required' })
  }
  const roots = state.comments
    .filter((c) => c.workId === workId && !c.rootCommentId && c.displayState === 'visible')
    .sort(sort === 'latest'
      ? (a, b) => b.createdAt - a.createdAt
      : (a, b) => visibleReplies(state, b.commentId).length - visibleReplies(state, a.commentId).length || b.createdAt - a.createdAt)
  const start = guest ? 0 : Math.max(0, Number(cursor ?? 0) || 0)
  const limit = guest ? PREVIEW_ROOTS : 20
  const slice = roots.slice(start, start + limit)
  const items = slice.map((root) => threadOf(state, root, guest))
  return {
    sort,
    visibleCommentCount: state.comments.filter((c) => c.workId === workId && c.displayState === 'visible').length,
    items,
    nextCursor: guest || start + slice.length >= roots.length ? null : String(start + slice.length),
  }
}

export function mockPostComment(state: SocialMockState, workId: string, accountId: string, nickname: string, body: string): WorkComment {
  const comment = rootComment(workId, accountId, nickname, body, Date.now(), state.comments.length + 1)
  state.comments = [...state.comments, comment]
  return comment
}

export function mockReplyComment(
  state: SocialMockState,
  targetId: string,
  accountId: string,
  nickname: string,
  body: string,
): WorkComment {
  const target = state.comments.find((c) => c.commentId === targetId && c.displayState === 'visible')
  if (!target) throw Object.assign(new Error('这条内容暂时看不到了。'), { code: 2004, detail: 'comment_unavailable' })
  const rootId = target.rootCommentId ?? target.commentId
  const comment = replyComment(target.workId, rootId, target.commentId, accountId, nickname, body, Date.now(), state.comments.length + 1)
  if (target.rootCommentId) comment.replyToLabel = target.authorPublic.nickname
  state.comments = [...state.comments, comment]
  return comment
}

export function mockDeleteComment(state: SocialMockState, commentId: string, accountId: string) {
  const current = state.comments.find((c) => c.commentId === commentId)
  if (!current) throw Object.assign(new Error('这条内容暂时看不到了。'), { code: 2004, detail: 'comment_unavailable' })
  const tree = !current.rootCommentId
    ? state.comments.filter((c) => c.commentId === commentId || c.rootCommentId === commentId)
    : [current]
  const ids = new Set(tree.map((c) => c.commentId))
  state.comments = state.comments.map((c) => ids.has(c.commentId) ? { ...c, displayState: 'hidden' as const } : c)
  return {
    commentId,
    displayState: 'hidden',
    cascadedReplyCount: Math.max(0, tree.length - 1),
    visibleCommentCount: state.comments.filter((c) => c.workId === current.workId && c.displayState === 'visible').length,
    accountId,
  }
}

function visibleReplies(state: SocialMockState, rootId: string): WorkComment[] {
  return state.comments
    .filter((c) => c.rootCommentId === rootId && c.displayState === 'visible')
    .sort((a, b) => a.createdAt - b.createdAt)
}

function threadOf(state: SocialMockState, root: WorkComment, guest: boolean): WorkCommentThread {
  const replies = visibleReplies(state, root.commentId)
  const preview = replies.slice(0, PREVIEW_REPLIES)
  const remaining = Math.max(0, replies.length - preview.length)
  return {
    comment: root,
    previewReplies: preview,
    visibleReplyCount: replies.length,
    remainingReplyCount: remaining,
    repliesCursor: guest || remaining === 0 ? null : String(preview.length),
    capabilities: { ...root.capabilities, canExpandReplies: remaining > 0 },
  }
}

function caps(canWrite: boolean): WorkComment['capabilities'] {
  return {
    canReply: canWrite,
    canDelete: canWrite,
    canHide: false,
    canReport: canWrite,
    canExpandReplies: false,
  }
}

function rootComment(workId: string, accountId: string, nickname: string, body: string, createdAt: number, n: number): WorkComment {
  return {
    commentId: `cm_${n}`,
    workId,
    rootCommentId: null,
    replyToCommentId: null,
    authorPublic: { accountId, nickname },
    body,
    createdAt,
    displayState: 'visible',
    stateVersion: 1,
    capabilities: caps(true),
  }
}

function replyComment(
  workId: string,
  rootId: string,
  replyTo: string,
  accountId: string,
  nickname: string,
  body: string,
  createdAt: number,
  n: number,
): WorkComment {
  return {
    commentId: `cm_${n}`,
    workId,
    rootCommentId: rootId,
    replyToCommentId: replyTo,
    authorPublic: { accountId, nickname },
    body,
    createdAt,
    displayState: 'visible',
    stateVersion: 1,
    capabilities: caps(true),
  }
}
