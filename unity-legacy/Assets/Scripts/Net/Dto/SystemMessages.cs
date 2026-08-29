using System;

namespace Echo.Net.Dto
{
    /// <summary>
    /// 系统/心跳号段（90xx）消息 DTO，对应
    /// <c>echo-server/src/main/proto/echo_system.proto</c>（TECH-P1 §3.1）。
    ///
    /// <para>9001 在服务端入 <c>noNeedCheckMessage</c> 白名单，登录前后均可发送；
    /// 客户端默认每 15s 发一次保活（服务端 idle 上调至 40s）。</para>
    /// </summary>
    public static class SystemMessages
    {
        public static class Cmd
        {
            public const int Heartbeat = 9001;
            public const int HeartbeatAck = 9002;
        }
    }

    /// <summary>C-&gt;S 心跳，对应 <c>Heartbeat_9001</c>。</summary>
    [Serializable]
    public class Heartbeat
    {
        /// <summary>客户端时间戳，毫秒（proto int64: client_time；JSON 字符串）。默认 "0"。</summary>
        public string clientTime = "0";
    }

    /// <summary>S-&gt;C 心跳应答，对应 <c>HeartbeatAck_9002</c>。</summary>
    [Serializable]
    public class HeartbeatAck
    {
        /// <summary>服务端时间戳，毫秒（proto int64: server_time；JSON 字符串）。</summary>
        public string serverTime;

        public long ServerTime => long.TryParse(serverTime, out var v) ? v : 0L;
    }
}
