/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** 真后端 Base URL；空=本地 mock 回退 */
  readonly VITE_API_BASE?: string
  /** 静态部署子路径（构建期） */
  readonly VITE_BASE?: string
  /** 埋点上报端点；空=仅 console */
  readonly VITE_TRACK_ENDPOINT?: string
  /** 静态物料前缀（CDN/OSS 静态目录）；空=走开发中间件读本地资源根 */
  readonly VITE_ASSET_BASE_URL?: string
  /** 内部测试数据总闸；'0'=一次性摘掉全部测试账号与种子内容（见 data/testData.ts） */
  readonly VITE_SHOW_TEST_DATA?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
