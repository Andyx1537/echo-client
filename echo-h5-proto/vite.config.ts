import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, loadEnv, type Connect, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

const MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
}

/**
 * 静态物料（运营封面、设计稿等）存放在仓库之外，不随代码入库。
 * 开发/预览期由这个中间件把 `/assets/**` 映射到资源根的 `static/`；
 * 生产环境改由 CDN/OSS 直供，见 VITE_ASSET_BASE_URL 与 src/lib/assetUrl.ts。
 */
function externalAssets(assetsRoot: string): Plugin {
  const staticDir = path.resolve(assetsRoot, 'static')

  const serve: Connect.NextHandleFunction = (req, res, next) => {
    const url = (req.url ?? '').split('?')[0]
    if (!url.startsWith('/assets/')) return next()

    const file = path.resolve(staticDir, decodeURIComponent(url.slice('/assets/'.length)))
    // 防目录穿越：解析后必须仍落在 static/ 之内
    if (!file.startsWith(staticDir + path.sep)) return next()
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next()

    res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream')
    res.setHeader('Cache-Control', 'no-cache')
    fs.createReadStream(file).pipe(res)
  }

  return {
    name: 'echo-external-assets',
    configureServer(server) {
      if (!fs.existsSync(staticDir)) {
        server.config.logger.warn(
          `[assets] 资源目录不存在: ${staticDir}\n` +
            `         封面图会全部裂开。设置 ECHO_ASSETS_DIR 指向资源根，或执行 scripts/assets-check.sh 查看说明。`,
        )
      }
      server.middlewares.use(serve)
    },
    configurePreviewServer(server) {
      server.middlewares.use(serve)
    },
  }
}

// H5 静态构建：
// - base 可配（部署到 OSS/COS 子路径时设 VITE_BASE，如 "/echo/"）。
// - VITE_API_BASE 空 → 走本地 mock；非空 → 走真后端（见 src/api）。
// - ECHO_ASSETS_DIR 指向资源根；缺省取并排克隆的 echo-doc 仓里那份。
//   2026-08-29 拆仓前缺省是 ../../Echo-assets（单仓时代资源根在代码仓同级）。
//   拆仓后资源根随 echo-doc 入库，旧缺省会指到工作区里那份遗留副本——
//   它多半还在，所以不会裂、只会读到过期物料，比直接裂开更难发现。
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '')
  const assetsRoot = env.ECHO_ASSETS_DIR || path.resolve(process.cwd(), '../../echo-doc/Echo-assets')

  return {
    base: env.VITE_BASE || '/',
    plugins: [react(), externalAssets(assetsRoot)],
    server: {
      port: 5178,
      open: true,
    },
    preview: {
      port: 5178,
    },
  }
})
