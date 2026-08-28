using System;
using System.Threading.Tasks;
using NativeWebSocket;
using UnityEngine;

namespace Echo.Net
{
    /// <summary>
    /// Echo 的 WebSocket 传输客户端：封装 <see cref="WebSocket"/>（NativeWebSocket，WebGL 兼容）
    /// + <see cref="PacketCodec"/>，对外暴露"按 cmd 收发 Packet / JSON DTO"的接口。
    ///
    /// <para>职责边界：只负责"连接 + 编解码 + 收发字节帧"，不关心具体业务协议。
    /// 业务逻辑（登录等）在 <c>EchoClient</c> 里按 cmd 分发处理。</para>
    ///
    /// <para>WebGL 注意：NativeWebSocket 在 WebGL 下用浏览器原生 WebSocket（jslib），
    /// 消息回调天然在主线程；非 WebGL（编辑器/Standalone）需每帧调用
    /// <see cref="DispatchMessageQueue"/> 把回调泵到主线程。</para>
    /// </summary>
    public sealed class EchoWebSocketClient
    {
        private WebSocket _socket;

        /// <summary>连接（WebSocket 握手）成功。</summary>
        public event Action OnConnected;

        /// <summary>连接关闭，参数为关闭码。</summary>
        public event Action<WebSocketCloseCode> OnClosed;

        /// <summary>发生错误，参数为错误信息。</summary>
        public event Action<string> OnError;

        /// <summary>收到一个完整 Packet（已解出 head/cmd/body）。</summary>
        public event Action<Packet> OnPacket;

        public WebSocketState State => _socket?.State ?? WebSocketState.Closed;

        /// <summary>
        /// 连接到指定地址（如 <c>ws://127.0.0.1:9001/</c>）。
        /// Aengine WebSocket 握手路径为根路径 "/"。
        /// </summary>
        public async Task Connect(string url)
        {
            _socket = new WebSocket(url);

            _socket.OnOpen += () => OnConnected?.Invoke();
            _socket.OnError += (e) => OnError?.Invoke(e);
            _socket.OnClose += (code) => OnClosed?.Invoke(code);
            _socket.OnMessage += HandleRawMessage;

            // Connect() 在连接关闭前不会返回（NativeWebSocket 的设计），
            // 故由调用方以"即发即忘"方式 await（或不 await）启动。
            await _socket.Connect();
        }

        private void HandleRawMessage(byte[] data)
        {
            if (PacketCodec.TryDecode(data, out Packet packet))
            {
                OnPacket?.Invoke(packet);
            }
            else
            {
                OnError?.Invoke($"收到无法解码的帧，长度={data?.Length ?? 0}");
            }
        }

        /// <summary>
        /// 发送一个 JSON DTO：用消息号 <paramref name="cmd"/> + JSON body 组帧后发出。
        /// 包头固定 TCP|JSON。
        /// </summary>
        public Task SendJson<T>(int cmd, T dto)
        {
            byte[] body = MessageJson.ToBody(dto);
            byte[] frame = PacketCodec.Encode(PacketHead.DefaultJsonHead, cmd, body);
            return _socket.Send(frame);
        }

        /// <summary>发送已编码好 body 的原始包（预留给后续 protobuf）。</summary>
        public Task SendRaw(byte head, int cmd, byte[] body)
        {
            byte[] frame = PacketCodec.Encode(head, cmd, body);
            return _socket.Send(frame);
        }

        /// <summary>
        /// 非 WebGL 平台需每帧调用，泵出收到的消息回调；WebGL 下为空操作。
        /// </summary>
        public void DispatchMessageQueue()
        {
#if !UNITY_WEBGL || UNITY_EDITOR
            _socket?.DispatchMessageQueue();
#endif
        }

        public async Task Close()
        {
            if (_socket != null)
            {
                await _socket.Close();
            }
        }
    }
}
