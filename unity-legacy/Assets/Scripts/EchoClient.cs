using System.Threading.Tasks;
using Echo.Net;
using Echo.Net.Dto;
using NativeWebSocket;
using UnityEngine;

namespace Echo
{
    /// <summary>
    /// Echo 客户端登录闭环骨架（FE-1）。
    ///
    /// <para>职责：连接本地 echo-server（<c>ws://127.0.0.1:9001/</c>），握手成功后发送
    /// <c>LoginReq(1001)</c> 的 JSON 包，接收并解析 <c>LoginResp(1002)</c>，打印结果。
    /// 演示真实可用的"连接 → 编解码 → 登录"链路，为后续形象/偏好/空间协议打底。</para>
    ///
    /// <para>定位：这是 FE-1 的最小登录闭环 <b>demo</b>。初版可交互界面已由
    /// <see cref="Echo.Ui.EchoUiApp"/>（运行时构建 uGUI、自动引导）接管完整流程，
    /// 它才是 Play 后默认启动的入口。为避免两者各开一条 WebSocket 连接，本类
    /// <b>不再自动引导</b>，仅在你手动把它挂到场景 GameObject 上时才运行（便于单独验证登录链路）。</para>
    /// </summary>
    public sealed class EchoClient : MonoBehaviour
    {
        [Header("连接配置")]
        [Tooltip("echo-server WebSocket 地址；Aengine 握手路径为根路径 '/'")]
        [SerializeField] private string serverUrl = "ws://127.0.0.1:9001/";

        [Tooltip("外部登录态唯一标识，登录请求里的 openId")]
        [SerializeField] private string openId = "dev-tester-001";

        [Tooltip("客户端版本号，随登录请求上报")]
        [SerializeField] private string clientVersion = "0.1.0";

        [Tooltip("进入播放模式后自动连接并登录")]
        [SerializeField] private bool autoConnectOnStart = true;

        private static EchoClient _instance;
        private EchoWebSocketClient _net;

        // 说明：自动引导已移交给 Echo.Ui.EchoUiApp（初版可交互界面）。本 demo 不再
        // 用 [RuntimeInitializeOnLoadMethod] 自启，避免与 EchoUiApp 重复建连；
        // 需要单独验证登录链路时，手动把本组件挂到场景里的 GameObject 即可。

        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }
            _instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private async void Start()
        {
            if (autoConnectOnStart)
            {
                await Connect();
            }
        }

        private void Update()
        {
            // 非 WebGL 平台需每帧泵消息队列到主线程
            _net?.DispatchMessageQueue();
        }

        private async void OnDestroy()
        {
            if (_instance == this && _net != null)
            {
                await _net.Close();
            }
        }

        private async void OnApplicationQuit()
        {
            if (_net != null)
            {
                await _net.Close();
            }
        }

        /// <summary>建立连接并挂事件；连接成功后自动发送登录。</summary>
        public async Task Connect()
        {
            _net = new EchoWebSocketClient();
            _net.OnConnected += HandleConnected;
            _net.OnPacket += HandlePacket;
            _net.OnError += (e) => Debug.LogError($"[EchoClient] 网络错误: {e}");
            _net.OnClosed += (code) => Debug.Log($"[EchoClient] 连接关闭: {code}");

            Debug.Log($"[EchoClient] 正在连接 {serverUrl} ...");
            // NativeWebSocket 的 Connect 在连接关闭前不会返回，作为长任务 await。
            await _net.Connect(serverUrl);
        }

        private void HandleConnected()
        {
            Debug.Log("[EchoClient] WebSocket 握手成功，发送登录请求 ...");
            _ = SendLogin();
        }

        /// <summary>发送 LoginReq(1001) 的 JSON 包。</summary>
        public Task SendLogin()
        {
            var req = new LoginReq
            {
                openId = openId,
                clientVersion = clientVersion
            };
            Debug.Log($"[EchoClient] -> LoginReq(1001) openId={req.openId}, ver={req.clientVersion}");
            return _net.SendJson(AccountMessages.Cmd.LoginReq, req);
        }

        /// <summary>按消息号分发服务端下行包。</summary>
        private void HandlePacket(Packet packet)
        {
            switch (packet.Cmd)
            {
                case AccountMessages.Cmd.LoginResp:
                    HandleLoginResp(packet);
                    break;
                default:
                    Debug.Log($"[EchoClient] <- 收到未处理消息 cmd={packet.Cmd}, body={MessageJson.ToText(packet.Body)}");
                    break;
            }
        }

        private void HandleLoginResp(Packet packet)
        {
            // 重要：服务端回包的包头固定为 HEAD_TCP(0x80)，协议位为 0，
            // 但 body 实际是 JSON（服务端按收到请求时的 session.protocol 编码）。
            // 因此这里不能依赖回包包头的协议位来判定，直接按"我方发的是 JSON"解析。
            var resp = MessageJson.FromBody<LoginResp>(packet.Body);
            if (resp.code == 0)
            {
                Debug.Log($"[EchoClient] <- LoginResp(1002) 登录成功! accountId={resp.AccountId}, " +
                          $"newAccount={resp.newAccount}, message={resp.message}");
            }
            else
            {
                Debug.LogWarning($"[EchoClient] <- LoginResp(1002) 登录失败 code={resp.code}, message={resp.message}");
            }
        }
    }
}
