import { useRef, useState } from 'react'
import { api } from '../api'
import type { PublishWorkInput, Visibility, Work, WorkMediaType } from '../types'
import { VISIBILITY_LABELS } from '../types'
import AiGeneratedBadge from './AiGeneratedBadge'

/**
 * 作品发布页。补的是主线第 10 步——此前服务端与前端都没有任何发布入口。
 *
 * 🔴 **「发布」不等于「公开」**。提交后作品落 `pending` 先进审核，广场上还看不到它
 * （`OM3`：生成/发布/过审是三个时刻，不得合并）。所以这一屏的成功态文案是
 * 「已提交」而不是「已发布」——写成后者，作者会立刻去广场找，找不到就以为坏了。
 *
 * 三态：`pick`（还没选素材）→ `edit`（填写）→ `done`（已提交）。
 */

interface Props {
  onClose: () => void
  /** 从一张回忆卡发布时带上。它决定这次是「把回忆发出去」还是「自制上传」 */
  sourceCardId?: string
  /** 来路是 AI 生成的内容。🔴 决定要不要打 S-8 显式标识，不要按"是不是种子数据"猜 */
  sourceAiGenerated?: boolean
  onPublished?: (work: Work) => void
}

type Phase = 'pick' | 'edit' | 'done'

interface Picked {
  resourceId: string
  url: string
  mediaType: WorkMediaType
  width: number
  height: number
  durationMs: number
}

const MAX_TITLE = 30
const MAX_BODY = 500

export default function PublishScreen({
  onClose,
  sourceCardId,
  sourceAiGenerated = false,
  onPublished,
}: Props) {
  const [phase, setPhase] = useState<Phase>('pick')
  const [picked, setPicked] = useState<Picked | null>(null)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('public')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const fromCard = Boolean(sourceCardId)

  async function onPick(files: FileList | null) {
    const f = files?.[0]
    if (!f) return
    setErr(null)
    setBusy(true)
    try {
      const mediaType: WorkMediaType = f.type.startsWith('video/') ? 'video' : 'image'
      const { resourceId, url } = await api.upload(f)
      // 🔴 宽高在客户端读，服务端不解码素材。列表页的瀑布错落全靠这两个数，
      //    读不出来就退 0，服务端会按 0 存——那时瀑布会退化成等高网格，但不会裂
      const dim = await readDimensions(url, mediaType)
      setPicked({ resourceId, url, mediaType, ...dim })
      setPhase('edit')
    } catch {
      setErr('这份素材没能读进来，换一个试试？')
    } finally {
      setBusy(false)
    }
  }

  async function submit() {
    if (!picked) return
    setErr(null)
    setBusy(true)
    try {
      const input: PublishWorkInput = {
        mediaType: picked.mediaType,
        mediaKey: picked.resourceId,
        // 视频首帧：真实实现要抽帧另传一份，这里先用素材本身占位
        posterKey: picked.mediaType === 'video' ? picked.resourceId : undefined,
        durationMs: picked.durationMs,
        width: picked.width,
        height: picked.height,
        title: title.trim(),
        body: body.trim(),
        visibility,
        sourceCardId,
        aiGenerated: sourceAiGenerated,
      }
      const { work } = await api.publishWork(input)
      onPublished?.(work)
      setPhase('done')
    } catch (e) {
      setErr(e instanceof Error ? e.message : '没能发出去，再试一次？')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="publish">
      <div className="friend-topbar">
        <button className="back-btn small" onClick={onClose} aria-label="返回">
          ‹
        </button>
        <span className="friend-topbar-title">
          {fromCard ? '把这份回忆发出去' : '发布作品'}
        </span>
      </div>

      {phase === 'pick' && (
        <div className="pub-pick">
          <button
            className="pub-dropzone"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <span className="pub-dz-glyph" aria-hidden>
              ＋
            </span>
            <span className="pub-dz-title">{busy ? '正在读进来…' : '选一张照片，或一段视频'}</span>
            <span className="pub-dz-sub">视频 5 分钟以内</span>
          </button>
          <input
            ref={fileRef}
            className="sr-only"
            type="file"
            accept="image/*,video/*"
            onChange={(e) => onPick(e.target.files)}
          />
          <p className="pub-hint">
            发出去的作品会出现在广场上。你随时可以把它收回来。
          </p>
          {err && <p className="pub-err">{err}</p>}
        </div>
      )}

      {phase === 'edit' && picked && (
        <>
        <div className="pub-edit">
          <div className="pub-preview">
            {picked.mediaType === 'video' ? (
              <video className="pub-media" src={picked.url} muted playsInline />
            ) : (
              <img className="pub-media" src={picked.url} alt="" />
            )}
            {picked.mediaType === 'video' && (
              <span className="pub-duration">{formatDuration(picked.durationMs)}</span>
            )}
            {sourceAiGenerated && <AiGeneratedBadge variant="full" className="pub-ai" />}
            <button className="pub-repick" onClick={() => setPhase('pick')}>
              换一个
            </button>
          </div>

          <label className="pub-field">
            <span className="pub-label">
              标题
              <em className="pub-count">
                {title.length}/{MAX_TITLE}
              </em>
            </span>
            <input
              className="pub-input"
              value={title}
              maxLength={MAX_TITLE}
              placeholder="想给它起个名字吗？不起也行。"
              onChange={(e) => setTitle(e.target.value)}
            />
          </label>

          <label className="pub-field">
            <span className="pub-label">
              说点什么
              <em className="pub-count">
                {body.length}/{MAX_BODY}
              </em>
            </span>
            <textarea
              className="pub-textarea"
              value={body}
              maxLength={MAX_BODY}
              rows={4}
              placeholder="这一刻发生了什么？"
              onChange={(e) => setBody(e.target.value)}
            />
          </label>

          <div className="pub-field">
            <span className="pub-label">谁能看见</span>
            <div className="pub-vis">
              {(['public', 'friends', 'private'] as Visibility[]).map((v) => (
                <button
                  key={v}
                  className={`pub-vis-item ${visibility === v ? 'on' : ''}`}
                  onClick={() => setVisibility(v)}
                >
                  {VISIBILITY_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          {err && <p className="pub-err">{err}</p>}
        </div>
        {/* 🔴 页脚在滚动区**之外**，不是 sticky 的最后一个子元素。
            用 sticky 时它会压住「谁能看见」那一栏——实测第一版就是这样，
            那一栏的标题被切掉半行，看起来像渲染坏了。 */}
        <div className="pub-actions">
          <button className="pub-submit" onClick={submit} disabled={busy}>
            {busy ? '正在提交…' : '发布'}
          </button>
          {/* 🔴 这句不能省：不说清楚会先进审核，作者提交后会立刻去广场找它 */}
          <p className="pub-hint center">发布后会先经过审核，通过了才会出现在广场上。</p>
        </div>
        </>
      )}

      {phase === 'done' && (
        <div className="pub-done">
          <span className="pub-done-glow" />
          <p className="pub-done-title">已提交</p>
          <p className="pub-done-sub">
            过一会儿就能在广场看到它了。在「我的作品」里可以看到它现在的状态。
          </p>
          <button className="pub-submit ghost" onClick={onClose}>
            知道了
          </button>
        </div>
      )}
    </div>
  )
}

/** 读素材原始宽高与时长。读不出来就退 0——服务端按 0 存，瀑布退化成等高但不会裂。 */
function readDimensions(
  url: string,
  kind: WorkMediaType,
): Promise<{ width: number; height: number; durationMs: number }> {
  return new Promise((resolve) => {
    const fallback = { width: 0, height: 0, durationMs: 0 }
    if (!url) return resolve(fallback)
    if (kind === 'video') {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () =>
        resolve({
          width: v.videoWidth,
          height: v.videoHeight,
          durationMs: Math.round((v.duration || 0) * 1000),
        })
      v.onerror = () => resolve(fallback)
      v.src = url
    } else {
      const img = new Image()
      img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight, durationMs: 0 })
      img.onerror = () => resolve(fallback)
      img.src = url
    }
  })
}

function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000)
  const m = Math.floor(total / 60)
  const s = total % 60
  return `${m}:${String(s).padStart(2, '0')}`
}
