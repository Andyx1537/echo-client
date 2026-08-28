# 回声 · 往宠 — H5 完整落地版

私密优先、社交可选的往宠陪伴/共鸣 H5 产品。五个底部页签全通、建档 onboarding、六项产品定案落地、接入真后端 API（带本地 mock 回退，后端未就绪也能独立完整跑通与部署）。

- 唯一真源：`../docs/API-CONTRACT.md`（v1）、`../docs/PRD-echo-social.md`（v0.9）、`../docs/COPY-GUIDE.md`。
- 设计语言：低饱和暖调（米 / 奶油 / 琥珀 / 柔绿），留白、圆角、弱 UI、温柔沉浸；社交货币仅「献花 / 记得」，**无点赞数、无排行榜；粉丝数仅个体页可见、不排名**。

## 快速开始（本地 · mock 模式）

```bash
npm install
npm run dev
```

默认地址：`http://localhost:5178`（自动打开浏览器）。`VITE_API_BASE` 为空时走**本地 mock**（localStorage 持久化），无需后端即可跑通完整闭环：

> 领游客 → 建档 → 进「我的它」→ 回访看近况 → 逛共鸣厅 → 献花（走额度）→ 记得（暖光面孔墙）→ 记录留一笔 → 看消息 → 进光谱。

首次进入 `hasPet=false`，会引导进入**建档 onboarding**（也可「先随便看看」以游客态浏览）。

## 切换真后端

在项目根新建 `.env.local`（参考 `.env.example`）：

```bash
VITE_API_BASE=https://api.echo.example.com
```

- 前端会请求 `${VITE_API_BASE}/api/v1/...`，首次 `POST /auth/guest` 领游客 token（存 localStorage），后续带 `Authorization: Bearer <token>`；`deviceId` 为前端生成的稳定设备指纹。
- 所有端点/字段严格对齐 `API-CONTRACT.md`（v1）。为空则自动回退 mock，互不影响。

## 构建与部署（纯静态）

```bash
npm run build      # tsc -b && vite build，产出纯静态 dist/
npm run preview    # 本地预览 dist/
```

`dist/` 可直接静态托管（Nginx / OSS / COS / CDN）。子路径部署时设置 `VITE_BASE`：

```bash
# 部署到 https://cdn.example.com/echo/
VITE_BASE=/echo/ npm run build
```

### 环境变量一览

| 变量 | 作用 | 默认 |
|---|---|---|
| `VITE_API_BASE` | 真后端 Base URL；空=本地 mock 回退 | 空（mock） |
| `VITE_BASE` | 静态部署子路径 | `/` |
| `VITE_TRACK_ENDPOINT` | 埋点上报端点；空=仅 console | 空 |

## 五个底部页签

| 页签 | 内容 |
|---|---|
| **共鸣厅**（首页） | 公开窗口瀑布流（`GET /plaza`），记得以**暖光浓度**呈现，不显数字 |
| **我的它** | 主卡 + 羁绊温度 + 回访看近况 + 光谱入口 + 亲友列表 + 明信片墙（里程碑/虚线空位解锁） |
| **记录** | 双向（给它 / 给自己）freeform 留一笔 + 可选温柔提问；**无连续天数、无红点催促** |
| **消息** | 克制集散地，三类（亲友/系统/宠物更新），点击按 `routeTo` 跳统一互动 |
| **我** | 个人主页 / 向前的光谱入口 / 可见性默认三档 / 订阅 / 账号（游客→绑定）/「被记得」私密回响 |

## 六项定案落地（契约 §12）

1. **可见性直白三档**：私密（默认）/ 挚友可见 / 公开（「我」页设置，逐项显式）。
2. **明信片付费只加速/款式**：内容永远靠陪伴里程碑解锁；订阅文案诚实说明「只加速/款式」。
3. **献花 · 走额度**：每日 5 朵免费、可购买、**不加温度、无排名**；额度用尽温柔提示可补充。
4. **记得 · 暖光面孔墙**：一人一次的开关状态，呈现为**暖光浓度 + 面孔墙**，**不显数字、不排名**。
5. **外部献花不加温度**：温度只由主人 1v1「回访」陪伴驱动（地板 60），与献花接口完全解耦。
6. **文案过词表**：对外文案（含 mock 生成/错误）过 `COPY-GUIDE` 禁用词过滤（`src/api/copy.ts`）。

> 关键修正：此前原型把「献花」当成 `rememberCount++` 是错的。本版**彻底拆开**——献花走额度、记得走开关状态与暖光面孔墙。

## 目录结构

```
src/
  App.tsx                 启动引导 + 五签导航 + 全屏浮层路由
  types.ts                数据模型（严格对齐 API-CONTRACT v1）
  api/
    client.ts             API 入口：按 env 选真后端 / mock；bootstrap 领游客
    backend.ts            EchoBackend 接口（真/假两实现共用）
    http.ts               真实 HTTP/JSON 后端
    mock.ts               本地 mock 后端（localStorage 持久化，六项定案同样强制）
    session.ts            游客 token / 会话存储
    deviceId.ts           稳定设备指纹
    track.ts              轻量埋点（契约 §13 事件清单）
    copy.ts               COPY-GUIDE 禁用词兜底过滤
  components/             五屏 + 建档 + 详情 + 光谱 + 亲友/动态圈 + 占位图
  data/                   mock.ts（假数据）/ spectrum.ts（光谱种子）
  styles/                 global.css（设计令牌）+ app.css（组件样式）
```

## 技术说明

- React 18 + Vite + TypeScript，纯 CSS（无 UI 库），瀑布流用 CSS `columns`。
- 图片均为 CSS 渐变 + emoji 占位，不依赖外网。
- 埋点覆盖漏斗关键事件：`guest_created → onboarding_confirm → pet_visit → flower/remember → share/bind`。
