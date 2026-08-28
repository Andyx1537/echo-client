using System;

namespace Echo.Net.Dto
{
    /// <summary>
    /// 账号号段（10xx）消息 DTO，与
    /// <c>echo-server/src/main/proto/echo_account.proto</c> 一一对应。
    ///
    /// <para>字段命名采用 proto3 JSON 的 lowerCamelCase（<c>open_id</c> -&gt; <c>openId</c>），
    /// 直接与服务端 <c>JsonFormat</c> 对齐。所有 int64 字段在 proto3 JSON 中是字符串，
    /// 故用 <c>string</c> 承载，详见 <see cref="MessageJson"/> 注释。</para>
    /// </summary>
    public static class AccountMessages
    {
        /// <summary>账号消息号常量（与 proto 类名后缀一致）。</summary>
        public static class Cmd
        {
            public const int LoginReq = 1001;
            public const int LoginResp = 1002;
        }
    }

    /// <summary>C-&gt;S 登录请求，对应 <c>LoginReq_1001</c>。</summary>
    [Serializable]
    public class LoginReq
    {
        /// <summary>外部登录态唯一标识（proto: open_id）。</summary>
        public string openId;

        /// <summary>客户端版本，便于灰度（proto: client_version）。</summary>
        public string clientVersion;
    }

    /// <summary>S-&gt;C 登录响应，对应 <c>LoginResp_1002</c>。</summary>
    [Serializable]
    public class LoginResp
    {
        /// <summary>0=成功，非0=失败码（proto: code）。服务端默认值省略，缺失即 0。</summary>
        public int code;

        /// <summary>
        /// 账号ID（雪花，proto int64: account_id）。proto3 JSON 把 int64 编码为字符串，
        /// 故此处用 string，取值见 <see cref="AccountId"/>。
        /// </summary>
        public string accountId;

        /// <summary>是否本次新建账号（proto: new_account）。默认 false 时服务端省略。</summary>
        public bool newAccount;

        /// <summary>提示信息（proto: message）。</summary>
        public string message;

        /// <summary>把字符串形式的 accountId 解析为 long（解析失败返回 0）。</summary>
        public long AccountId => long.TryParse(accountId, out var v) ? v : 0L;
    }
}
