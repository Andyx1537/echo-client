using System;
using System.Collections.Generic;

namespace Echo.Net.Dto
{
    /// <summary>
    /// 回声号段（15xx）消息 DTO，对应
    /// <c>echo-server/src/main/proto/echo_echo.proto</c>（TECH-P1 §4.3，P1 异步）。
    /// </summary>
    public static class EchoMessages
    {
        public static class Cmd
        {
            public const int PullEchoesReq = 1501;
            public const int EchoListResp = 1502;
            public const int LeaveTraceReq = 1503;
            public const int LeaveTraceResp = 1504;
        }
    }

    /// <summary>C-&gt;S 拉取某空间下的回声，对应 <c>PullEchoesReq_1501</c>。</summary>
    [Serializable]
    public class PullEchoesReq
    {
        /// <summary>
        /// 目标空间ID（proto int64: owner_space_id；JSON 字符串）。
        /// 默认 "0"，避免空串导致服务端 int64 解析失败；调用前应填入真实 spaceId。
        /// </summary>
        public string ownerSpaceId = "0";
    }

    /// <summary>回声快照，对应 <c>EchoSnapshot</c>。</summary>
    [Serializable]
    public class EchoSnapshot
    {
        public string echoId;

        /// <summary>留痕来源账号（proto int64: from_account_id；JSON 字符串）。</summary>
        public string fromAccountId;

        /// <summary>回声内容 JSON 文本：痕迹/手势/信物（proto: payload）。</summary>
        public string payload;

        /// <summary>过期时间，毫秒（proto int64: expire_at；JSON 字符串）。</summary>
        public string expireAt;

        public long EchoId => long.TryParse(echoId, out var v) ? v : 0L;
        public long FromAccountId => long.TryParse(fromAccountId, out var v) ? v : 0L;
        public long ExpireAt => long.TryParse(expireAt, out var v) ? v : 0L;
    }

    /// <summary>S-&gt;C 回声列表，对应 <c>EchoListResp_1502</c>。</summary>
    [Serializable]
    public class EchoListResp
    {
        public int code;

        /// <summary>回声（proto: echoes, repeated）。为空时 proto3 JSON 省略，反序列化后可能为 null。</summary>
        public List<EchoSnapshot> echoes;

        public string message;
    }

    /// <summary>C-&gt;S 留痕/手势信物，对应 <c>LeaveTraceReq_1503</c>（在某空间留下回声）。</summary>
    [Serializable]
    public class LeaveTraceReq
    {
        /// <summary>目标空间ID（proto int64: owner_space_id；JSON 字符串）。默认 "0" 防空串解析失败。</summary>
        public string ownerSpaceId = "0";

        /// <summary>回声内容 JSON 文本（proto: payload）。</summary>
        public string payload;

        /// <summary>存活时长，毫秒（proto int64: ttl_millis；&lt;=0 用默认）。默认 "0" 防空串解析失败。</summary>
        public string ttlMillis = "0";
    }

    /// <summary>S-&gt;C 留痕响应，对应 <c>LeaveTraceResp_1504</c>。</summary>
    [Serializable]
    public class LeaveTraceResp
    {
        public int code;
        public string echoId;
        public string expireAt;
        public string message;

        public long EchoId => long.TryParse(echoId, out var v) ? v : 0L;
        public long ExpireAt => long.TryParse(expireAt, out var v) ? v : 0L;
    }
}
