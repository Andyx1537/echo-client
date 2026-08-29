# Echo 客户端 · Unity 工程骨架（已冻结）

> **这个工程已冻结**，自版本控制基线起没有一次实质改动。Echo 当前在开发的前端是
> 同仓的 `echo-h5-proto/`。本目录 2026-08-29 之前叫 `echo-client/`，与仓库同名，
> 改名是为了不让人照名字找错地方。下文保留原样，仅把路径改到新位置。

回响 (Echo) 的客户端工程，**先面向 H5 / WebGL**，后续可出移动 App、未来 AR。
本仓库是一个**结构正确、可被 Unity Hub 直接打开**的工程：内含可运行的
**连接 / 封包编解码 / 登录闭环**网络层，以及 **FE-2/FE-3 初版可交互界面**——
用纯代码在运行时构建 uGUI（无需手搓 .prefab/.unity 资产），单场景多面板跑通
**登录 → 提交偏好 → 进入意识空间 → 看共鸣**，与服务端 `echo-server`（基于 Aengine）严格对齐。

> **Unity 版本：6000.0.78f1**（已与本机安装对齐，见 `ProjectSettings/ProjectVersion.txt`）。

> 配套文档：`../docs/PRD.md`（§1.4 美术基调）、`../docs/TECH-P1.md`（§3 协议、§4 流程）。
> 服务端工程：`../echo-server`，默认 WebSocket 端口 **9001**，握手路径 **`/`**。

---

## 1. 环境要求

| 项 | 要求 |
|---|---|
| Unity | **Unity 6 LTS（6000.0.x）**。`ProjectSettings/ProjectVersion.txt` 当前写 `6000.0.23f1`。**请改为你本机实际安装的 6000.0.x 版本**，或用 Unity Hub 选择相近版本打开（Hub 会提示版本不一致，可继续）。 |
| 平台模块 | 安装 **WebGL Build Support** 模块（H5 目标）。 |
| 包管理 | UPM（Package Manager），见下方 §3。 |

> 本机当前**尚未安装 Unity**，因此本骨架未经过 Unity 实际打开/构建验证。
> 首次打开时 Unity 会自动拉取 UPM 依赖、重新生成 `Library/` 与缺失的 `.meta`，属正常现象。

---

## 2. 用 Unity Hub 打开

1. 打开 **Unity Hub** → `Add` → `Add project from disk`。
2. 选择本目录 `echo-client` 仓的 `unity-legacy/`。
3. 若提示 Unity 版本不匹配，安装/选择一个 **6000.0.x** 版本打开。
4. 首次打开 Unity 会联网拉取 `NativeWebSocket`（git UPM 包，见 §3）并编译脚本，请保持联网。
5. 打开场景 `Assets/Scenes/Bootstrap.unity`，点 **Play** 即开始连接并登录。

---

## 3. UPM 依赖（已在 `Packages/manifest.json` 声明）

| 包 | 来源 | 用途 |
|---|---|---|
| `com.endel.nativewebsocket` | `https://github.com/endel/NativeWebSocket.git#upm` | **WebSocket 客户端，WebGL 兼容**（WebGL 下走浏览器原生 WebSocket via jslib；编辑器/Standalone 走 .NET 实现）。 |
| `com.unity.ugui` / TextMeshPro / 内置 modules | Unity 官方 | UI 与基础模块（后续 FE-2/3/6 的登录、偏好录入、资料卡 UI）。 |

> NativeWebSocket 通过 git URL 安装，**首次需联网**。若公司网络无法访问 GitHub，
> 可改为本地路径或 `.tgz`：把仓库下到本地后将 manifest 改为 `"file:..."`。

---

## 4. 连接本地 echo-server（9001）

1. 先启动服务端（见 `../echo-server`）：
   ```bash
   # 在 echo-server 工程下
   java -Decho.port=9001 com.echo.bootstrap.EchoServer
   # 或将端口作为首个程序参数
   ```
2. 客户端默认连接 `ws://127.0.0.1:9001/`（界面登录面板里可改，或 `EchoUiApp` 常量）。
3. 打开场景 `Assets/Scenes/Bootstrap.unity`，点 **Play**：界面会自动构建（见 §11 初版流程）。
   在「登录」面板点「连接并登录」后，Console 期望输出：
   ```
   [EchoUiApp] -> LoginReq(1001) openId=dev-tester-001
   [EchoUiApp] <- LoginResp(1002) 成功 accountId=...
   [EchoUiApp] -> Heartbeat(9001)            # 之后每 15s 一次
   [EchoUiApp] <- HeartbeatAck(9002) serverTime=...
   ```

> **WebGL 注意**：浏览器只能连 `ws://`（同源/非 HTTPS）或 `wss://`（HTTPS 页面）。
> 本地用 `ws://127.0.0.1:9001/` 调试，线上 H5 若走 HTTPS 必须给服务端配 `wss://`。

---

## 5. 封包格式（与 Aengine 严格对齐）

客户端 `PacketCodec` 完全对齐 Aengine `com.aengine.network.netty.websocket.Encoder/Decoder`
的**无 checksum 通道**。每个 WebSocket **二进制帧 = 一个完整 Packet**：

```
+---------+-------------------+-----------------+----------------------+
| head: 1 | length: 2 (int16) | cmd: 4 (int32)  | body: (length - 4)   |
+---------+-------------------+-----------------+----------------------+
大端 / 网络字节序（Netty ByteBuf 默认大端）
length = body.Length + 4   （length 把后面 4 字节 cmd 一并计入）
整帧长度 = 7 + body.Length
```

**包头（head, 1 字节）位定义**（见 `PacketHead.cs`）：

| 位 | 含义 | 客户端取值 |
|---|---|---|
| bit7 | TCP=1 / UDP=0 | 1（WebSocket 承载 → `HEAD_TCP=0x80`） |
| bit6 | NEED_ACK | 0 |
| bit5 | ACK | 0 |
| bit4 | CLOSE | 0 |
| bit1-bit0 | 协议类型（`HEAD_PROTOCOL_MASK=0x03`） | `01`=JSON（P1 起步） |

故客户端发包 head = `HEAD_TCP | PROTOCOL_JSON = 0x81`。

> **重要对齐点（务必知道）**：服务端 `PlayerSession.send(...)` 回包时，包头**固定写
> `HEAD_TCP=0x80`（协议位为 0）**，但 body 实际按"收到请求时的 `session.protocol`"编码。
> 也就是说：**我们发 JSON，服务端就回 JSON，但回包包头的协议位不可信**。
> 因此客户端解析下行 body 时，**不依赖回包包头协议位**，直接按"我方发的协议（JSON）"解析。
> （见 `EchoClient.HandleLoginResp` 注释。）

---

## 6. JSON 起步 与 后续切 protobuf

P1 协议体**起步用 JSON**（Aengine `Packet` 支持 `PROTOCOL_JSON`），以规避 Unity 接 protobuf
代码生成的复杂度。两端 JSON 约定（见 `MessageJson.cs`）：

- **字段名 lowerCamelCase**：proto `open_id` → JSON `openId`；C# DTO 字段直接用 camelCase。
- **默认值省略**：服务端 `JsonFormat.printer()` 默认不输出默认值字段（`code=0`、`false`、空串），
  C# `JsonUtility` 对缺失字段保持默认值，天然兼容。
- **未知字段忽略**：服务端 `ignoringUnknownFields()`，`JsonUtility` 也忽略多余字段，双向安全。
- **int64 是字符串**：proto3 JSON 把 `int64`（如 `account_id`）编码为带引号字符串，
  故 DTO 用 `string` 承载、再 `long.Parse`（见 `LoginResp.AccountId`）。

**后续切 protobuf 的设计预留**：传输/包头层与业务层已解耦——
切换时仅需 ① 把发包包头协议位改成 `PacketHead.ProtocolProtobuf`，
② 把 `MessageJson.ToBody/FromBody` 换成 protobuf 运行时的 `ToByteArray()/ParseFrom()`，
③ 引入 C# protobuf 运行时与 `.proto` 生成代码。`PacketCodec`、`EchoWebSocketClient`、包头结构**无需改动**。

---

## 7. 目录结构

```
unity-legacy/
├── README.md                      # 本文件
├── .gitignore                     # Unity 官方模板
├── Packages/
│   └── manifest.json              # UPM 依赖（含 NativeWebSocket）
├── ProjectSettings/
│   ├── ProjectVersion.txt         # Unity 版本（需与本机安装对齐）
│   └── EditorBuildSettings.asset  # 构建场景列表（含 Bootstrap）
└── Assets/
    ├── Scenes/
    │   └── Bootstrap.unity         # 最小启动场景（相机+平行光，合法 YAML）
    ├── Scripts/
    │   ├── EchoClient.cs            # FE-1 登录闭环 demo（手动挂载用，已不自动引导）
    │   ├── Ui/
    │   │   ├── UiFactory.cs         # 运行时 uGUI 构建工具（Canvas/控件/滚动列表）
    │   │   └── EchoUiApp.cs         # 初版界面编排：四面板 + 路由 + 心跳（自动引导入口）
    │   └── Net/
    │       ├── PacketHead.cs        # 包头标志位常量（对齐 Aengine Packet）
    │       ├── Packet.cs            # Packet 结构（head/cmd/body）
    │       ├── PacketCodec.cs       # 编解码（严格对齐 Encoder/Decoder，大端）
    │       ├── MessageJson.cs       # JSON 体序列化（对齐 proto3 JSON 约定）
    │       ├── EchoWebSocketClient.cs # WebSocket 传输封装（NativeWebSocket+codec）
    │       └── Dto/
    │           ├── AccountMessages.cs   # 账号(10xx)：LoginReq/LoginResp
    │           ├── MindMessages.cs      # 意识档案(12xx)：SubmitPrefsReq/MindProfileResp
    │           ├── SpaceMessages.cs     # 空间(13xx)：EnterSpaceReq/SpaceSnapshotResp/HostConfig
    │           ├── ResonanceMessages.cs # 共鸣(14xx)：QueryResonanceReq/ResonanceListResp
    │           ├── EchoMessages.cs      # 回声(15xx)：PullEchoes/LeaveTrace/EchoListResp
    │           └── SystemMessages.cs    # 系统(90xx)：Heartbeat/HeartbeatAck
    └── Art/                          # 美术资产占位（对齐 PRD §1.4 基调）
        ├── Avatars/   (README)       # 角色：偏卡通
        ├── Pets/      (README)       # 宠物：克制的卡通
        └── Spaces/Presets/ (README)  # 空间：写实·定势组合
```

---

## 8. 启动方式（运行时构建 UI、无需手动搭场景）

初版界面的入口是 `Echo.Ui.EchoUiApp`：

- **自动引导**：`EchoUiApp.AutoBootstrap()`（`[RuntimeInitializeOnLoadMethod]`）在进入播放模式后
  自动创建一个常驻 GameObject，**用纯代码构建 `Canvas` + `EventSystem` 与四个面板**，并持有网络客户端。
- 因此 `Bootstrap.unity` **不预先挂载任何脚本、不绑定脚本 GUID**——场景文件保持干净、可被 Unity 正确解析；
  UI 全部运行时动态创建，避免手搓易碎的预制/场景资产。

> `EchoClient`（FE-1 登录闭环 demo）**已取消自动引导**，仅在你手动把它挂到场景 GameObject 时才运行，
> 以免和 `EchoUiApp` 各开一条 WebSocket 连接。日常 Play 只会启动 `EchoUiApp` 一个入口。

> UI 采用 **Legacy uGUI（`UnityEngine.UI.Text` 等）+ 内置 `LegacyRuntime.ttf` 字体**，
> 不用 TextMeshPro（TMP 首次需导入 "TMP Essentials"，新工程缺失会运行时报错）；
> 输入走 **Legacy Input Manager**（工程未引入新 Input System 包），`StandaloneInputModule` 开箱即用。

---

## 9. 装好 Unity 后仍需手动做的事

1. **装 License + WebGL 模块**：用 Unity Hub 安装/激活 license，并装 **WebGL Build Support** 模块。
2. **首次打开联网**：让 Unity 拉取 `NativeWebSocket`（git UPM）；若无法访问 GitHub，按 §3 改本地包。
3. **直接 Play 即出界面**：打开 `Assets/Scenes/Bootstrap.unity` → Play，`EchoUiApp` 自动构建 UI，
   无需手动挂脚本（如需用 FE-1 登录 demo，再手动 `Add Component → EchoClient`）。
4. **WebGL 构建**：`File → Build Settings → WebGL → Switch Platform → Build`。
   线上若走 HTTPS，需把服务端换成 `wss://` 并配置证书。

---

## 10. 初版流程：操作步骤（装好 license 后 Play）

> 前置：先启动本地 `echo-server`（监听 9001）。

1. **启动**：打开 `Assets/Scenes/Bootstrap.unity` → 点 **Play**。界面自动出现，顶部为状态栏 + 四个导航按钮
   （1·登录 / 2·偏好录入 / 3·意识空间 / 4·共鸣）。
2. **登录**：在「登录」面板确认地址 `ws://127.0.0.1:9001/` 与 `openId`，点 **连接并登录 (1001)**。
   登录成功后状态栏显示 `accountId`。
3. **提交偏好**：切到「偏好录入」，填写若干偏好（年代/色调/意象/音乐/情绪，已预填示例），
   点 **提交偏好 (1201)**；面板显示返回的 `profileId / vectorId / enrichedPrefs`。
4. **进入意识空间**：切到「意识空间」，点 **进入意识空间 (1301)**。
   面板按 `presetSetId` 切换**背景色 + 标题 + 氛围文案**做占位可视化
   （`1001`=黄昏老楼道·暖橘；`1002`=午后旧书房·泛黄），并展示 `spaceId / dynamicParams / hostConfig`。
5. **看共鸣 / 留痕 / 回声**：切到「共鸣」，点 **查询共鸣 (1401)** 列出候选（`accountId` + 共鸣度%）；
   点 **留痕 (1503)** 在自己空间留下一个回声；点 **拉回声 (1501)** 拉取空间里的回声列表。
   > 留痕/拉回声需先在第 4 步进入空间拿到 `spaceId`。
6. **心跳**：登录后后台每 **15s** 自动发 `Heartbeat (9001)`，Console 可见 `HeartbeatAck (9002)`（连接级保活）。

### 各面板收发一览

| 面板 | 发送 | 接收 / 表现 |
|---|---|---|
| 登录 | `LoginReq(1001)` | `LoginResp(1002)`：accountId / newAccount / message |
| 偏好录入 | `SubmitPrefsReq(1201)`（rawPrefs[]） | `MindProfileResp(1202)`：profileId / vectorId / enrichedPrefs |
| 意识空间 | `EnterSpaceReq(1301)` | `SpaceSnapshotResp(1302)`：presetSetId 切换背景/标题/氛围，展示参数 |
| 共鸣 | `QueryResonanceReq(1401)` / `LeaveTraceReq(1503)` / `PullEchoesReq(1501)` | `ResonanceListResp(1402)` 候选列表 / `LeaveTraceResp(1504)` / `EchoListResp(1502)` |
| 全局 | `Heartbeat(9001)` 每 15s | `HeartbeatAck(9002)` |

---

## 11. 与服务端协议的对齐点 / 仍存疑处

**已对齐**：
- **端口 / 握手**：`ws://127.0.0.1:9001/`，根路径握手。
- **封包格式**：`head(1)+length(2,int16,大端)+cmd(4,int32)+body`，`length=body+4`，一帧一包（见 §5）。
- **消息号**：登录 1001/1002、意识档案 1201/1202、空间 1301/1302（+主控 1303/1304）、
  共鸣 1401/1402、回声 1501/1502/1503/1504、心跳 9001/9002。
- **JSON 约定**：lowerCamelCase；默认值省略；未知字段忽略；**int64 用 string 承载**
  （accountId/profileId/vectorId/spaceId/presetSetId/ownerSpaceId/ttlMillis/clientTime 等）。
- **共鸣分值口径**：服务端 `ResonanceHandler` 已把内部余弦距离转换为**共鸣度 = 1 − 距离（0~1，越大越近）**，
  客户端按"共鸣度"直接展示百分比。
- **错误码**：各响应 `code` 非 0 时，界面显示返回的 `message`。

**仍存疑 / 待协调**：
- **回包包头协议位恒为 0**（见 §5）：客户端按"我方发 JSON"解析下行，不依赖回包头协议位。
  若将来要"请求 JSON / 回包 protobuf"混合，需后端在回包头正确置位。
- **错误码表**：目前仅约定 `0=成功`、登录 openId 空=1 等少量；完整错误码表（1xxx/2xxx）待后端补齐并据此细化提示文案。
- **鉴权**：P1 openId 直登、不带 token；上线前的鉴权方式（URL query / 首包鉴权）待定。
- **偏好字段语义**：客户端把若干非空输入作为 `rawPrefs[]` 直接上送；是否需要结构化标签（年代/地区/场景/氛围轴）
  由前端拆分还是后端 LLM 推断，待与 BE 对齐（ART.md §3.4 提到四轴权重）。
