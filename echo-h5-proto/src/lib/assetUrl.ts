/**
 * 静态物料的统一取址口。
 *
 * 物料（运营封面、设计稿、示例图等）不入代码库，存放在仓库外的资源根：
 *   <资源根>/static/seed-covers/xxx.jpg  →  assetUrl('seed-covers/xxx.jpg')
 *
 * 开发/预览期由 vite.config.ts 的 externalAssets 中间件从磁盘读取；
 * 生产期设 VITE_ASSET_BASE_URL 指向 CDN/OSS/Nginx 的静态目录。
 *
 * 组件里不要再手写 '/assets/...' 字面量，否则换存储时会漏改。
 */
const BASE = (import.meta.env.VITE_ASSET_BASE_URL ?? '').replace(/\/+$/, '')

export function assetUrl(relativePath: string): string {
  const clean = relativePath.replace(/^\/+/, '')
  return BASE ? `${BASE}/${clean}` : `/assets/${clean}`
}

// 出图按固定高度缩放（缩略 560 / 详情 1000），封面长宽比在 2:3~4:5 之间浮动，
// 这里取中间比例折算成 srcSet 需要的宽度描述符——浏览器只用它做相对挑选，不必精确。
const THUMB_WIDTH = 420
const FULL_WIDTH = 750

/**
 * 封面出两档：详情页要清晰，瀑布流要能连续快滑。
 * 出图时缩略档落在同名的 thumb/ 子目录下，这里据此推导 srcSet，
 * 由浏览器结合 sizes 自己挑，调用点不必各自记住两个路径。
 * 非 seed-covers 的图（渐变占位、用户上传）没有缩略档，原样返回。
 */
export function coverSrcSet(imageUrl: string): string | undefined {
  const i = imageUrl.lastIndexOf('/')
  if (i < 0) return undefined
  const dir = imageUrl.slice(0, i)
  if (!dir.endsWith('/seed-covers')) return undefined
  const file = imageUrl.slice(i + 1)
  return `${dir}/thumb/${file} ${THUMB_WIDTH}w, ${imageUrl} ${FULL_WIDTH}w`
}
