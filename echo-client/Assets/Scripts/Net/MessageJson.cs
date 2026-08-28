using System.Text;
using UnityEngine;

namespace Echo.Net
{
    /// <summary>
    /// 消息体 JSON 序列化工具（P1 起步协议）。
    ///
    /// <para>服务端用 protobuf 官方 <c>JsonFormat</c>（<c>protobuf-java-util</c>）做 JSON 编解码，
    /// 客户端这里用 Unity 内置 <see cref="JsonUtility"/>。两端需在以下约定上对齐：</para>
    /// <list type="bullet">
    ///   <item><b>字段名 = lowerCamelCase</b>：proto 字段 <c>open_id</c> 在 JSON 里是
    ///     <c>openId</c>。故 C# DTO 字段直接用 camelCase 命名（如 <c>openId</c>），
    ///     <see cref="JsonUtility"/> 按字段名原样输出即可匹配。</item>
    ///   <item><b>默认值省略</b>：服务端 <c>JsonFormat.printer()</c> 默认不输出默认值字段
    ///     （如 <c>code=0</c>、<c>false</c>、空串不出现）。<see cref="JsonUtility"/> 对缺失字段
    ///     保持类型默认值，天然兼容。</item>
    ///   <item><b>未知字段忽略</b>：服务端解析 <c>ignoringUnknownFields()</c>；
    ///     <see cref="JsonUtility"/> 也会忽略 JSON 里多出的字段，双向安全。</item>
    ///   <item><b>int64 在 proto3 JSON 中是字符串</b>：如 <c>accountId</c> 会序列化为
    ///     <c>"123456"</c>（带引号）。因此 DTO 里 64 位整型字段需用 <c>string</c> 承载，
    ///     再自行 <c>long.Parse</c>，避免 <see cref="JsonUtility"/> 类型不匹配。</item>
    /// </list>
    ///
    /// <para>后续若切 protobuf：仅需把包头协议位改为 <see cref="PacketHead.ProtocolProtobuf"/>，
    /// 并把这里替换为 protobuf 运行时的 <c>ToByteArray()/ParseFrom()</c>，
    /// 包头与传输层无需改动。</para>
    /// </summary>
    public static class MessageJson
    {
        private static readonly UTF8Encoding Utf8 = new UTF8Encoding(false);

        /// <summary>把 DTO 序列化为 JSON 文本的 UTF-8 字节（用作 Packet body）。</summary>
        public static byte[] ToBody<T>(T dto)
        {
            string json = JsonUtility.ToJson(dto);
            return Utf8.GetBytes(json);
        }

        /// <summary>把 Packet body（UTF-8 JSON）反序列化为 DTO。</summary>
        public static T FromBody<T>(byte[] body)
        {
            string json = Utf8.GetString(body);
            return JsonUtility.FromJson<T>(json);
        }

        /// <summary>调试用：把 body 还原为 JSON 文本。</summary>
        public static string ToText(byte[] body)
        {
            return Utf8.GetString(body);
        }
    }
}
