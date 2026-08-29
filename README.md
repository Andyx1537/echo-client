# echo-client — 前端

## 目录

| 目录 | 是什么 | 状态 |
| --- | --- | --- |
| **`echo-h5-proto/`** | **H5 客户端，Echo 真正的前端** | 活跃开发，90 个文件 |
| `unity-legacy/` | 更早的 Unity 尝试 | **已冻结**，自版本控制基线起没有一次实质改动，71 个文件 |

要跑前端，进 `echo-h5-proto/`。

这个目录 2026-08-29 之前叫 `echo-client/`——和仓库同名，但它并不是仓库的主角。
单仓时代这个撞车被记过一笔（echo-doc 仓 `docs/PLAN-repo-split.md` §3），
当时的风险是「拆分时按名字推错仓」，两者同仓后变成「新人 clone 下来照名字找错目录」，
所以改掉了。旧路径的引用如果还有漏网的，按 `echo-client/` → `unity-legacy/` 改。

## 与协议的关系

H5 走 HTTP/JSON，**不消费 `.proto`**（proto 是服务端 WebSocket 那条链路用的）。
所以本仓不放 protocol 副本。将来前端真要用 protobuf 了，真源在 `echo-doc` 仓的 `proto/`。

接口契约看 `echo-doc` 仓的 `docs/API-CONTRACT.md`。

## 仓库边界

| 找什么 | 去哪个仓 |
| --- | --- |
| 服务端代码、建表 SQL、本地运维 | `echo` |
| 文档、规格、裁定、比稿图、协议真源、美术资源 | `echo-doc` |
| 并行工作线监控 skill | `monitor` |

## 拆分来源

从单仓 `Echo` 于 2026-08-28 按快照拆出，基准 `67a62ae1702322cc051eb240375359e06f6614f8`。
拆分前的改动历史没有带过来（产品负责人裁定），原单仓在本地完整保留。
