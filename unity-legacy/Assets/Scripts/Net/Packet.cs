namespace Echo.Net
{
    /// <summary>
    /// 与 Aengine <c>com.aengine.network.netty.Packet</c> 对应的客户端结构（精简版）。
    ///
    /// <para>一个 Packet = 包头(head) + 消息号(cmd) + 消息体(body)。
    /// body 的编码方式由 head 的协议位决定（P1 为 JSON 文本的 UTF-8 字节）。</para>
    /// </summary>
    public sealed class Packet
    {
        /// <summary>包头标志字节，见 <see cref="PacketHead"/>。</summary>
        public byte Head { get; }

        /// <summary>消息号（cmd），即协议号，如登录请求 1001 / 响应 1002。</summary>
        public int Cmd { get; }

        /// <summary>消息体原始字节（JSON 起步时为 UTF-8 编码的 JSON 文本）。</summary>
        public byte[] Body { get; }

        public Packet(byte head, int cmd, byte[] body)
        {
            Head = head;
            Cmd = cmd;
            Body = body ?? System.Array.Empty<byte>();
        }

        /// <summary>当前 Packet 的协议类型（取包头低 2 位）。</summary>
        public byte Protocol => PacketHead.ProtocolOf(Head);

        public override string ToString()
        {
            return $"Packet{{head=0x{Head:X2}, cmd={Cmd}, bodyLen={Body.Length}}}";
        }
    }
}
