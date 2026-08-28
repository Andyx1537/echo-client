import { useEffect, useState } from 'react'
import type { FeatureFlags } from '../types'
import { api } from '../api'

/**
 * 🔴 **兜底 = 全部关闭。** 服务端开关拿不到时用它，绝不猜「大概是开着的」。
 *
 * `S13 ②` 把留言开关的前置条件写死了：文本安全闸 + `S3` 五项治理能力（拉黑 / 举报 /
 * 关互动 / 审核队列 / 文本安全闸）全部就绪才允许打开。一次网络抖动就把自由文本入口
 * 放出来，等于绕过了那条前置条件——所以这里只能倒向关闭。
 */
const ALL_OFF: FeatureFlags = {
  leaveMessage: false,
}

/**
 * 全进程共用一次请求：开关是全局配置，每个组件各拉一遍纯属浪费。
 * 🔴 **只在内存里存**，不落 localStorage——落盘的开关会在服务端关掉之后继续生效，
 * 而且给了本地改开关的旁路，那就不再是「服务端开关」了。
 */
let inflight: Promise<FeatureFlags> | null = null

function fetchFlags(): Promise<FeatureFlags> {
  if (!inflight) {
    inflight = api.featureFlags().catch(() => {
      // 失败不缓存：下次挂载重试一次，但这一次一律按全关处理
      inflight = null
      return ALL_OFF
    })
  }
  return inflight
}

/**
 * 读服务端功能开关（`DECISIONS S13`）。
 *
 * 用法一律是 `{flags.leaveMessage && <入口/>}`：
 *  · 🔴 关闭时**整个入口不呈现**，不要出「功能暂未开放」这类占位——
 *    占位等于告诉用户这里少了点东西，而这里本来就不该有东西；
 *  · 🔴 在途（还没拿到开关）时同样**什么都不出**，避免先闪一下再消失；
 *  · 🔴 不要在组件里读环境变量或写本地开关来「方便调试」——
 *    那会让线上行为与开关脱钩，`S13` 要的就是这个东西只能由服务端控制。
 */
export function useFeatureFlags(): FeatureFlags {
  const [flags, setFlags] = useState<FeatureFlags>(ALL_OFF)

  useEffect(() => {
    let alive = true
    void fetchFlags().then((f) => {
      if (alive) setFlags(f)
    })
    return () => {
      alive = false
    }
  }, [])

  return flags
}
