namespace Echo.Net
{
    /// <summary>
    /// 与 Aengine <c>com.aengine.network.netty.Packet</c> 完全对齐的包头标志位常量。
    ///
    /// <para>包头是 1 个字节，按位定义（高位 -> 低位）：</para>
    /// <code>
    ///  bit7 bit6 bit5 bit4 bit3 bit2 bit1 bit0
    ///   |    |    |    |    |    |    +----+--- 协议类型 (PROTOCOL_*)
    ///   |    |    |    |    |    |               (低 2 位, HEAD_PROTOCOL_MASK)
    ///   |    |    |    +----+----+------------- 保留位
    ///   |    |    +-------------------------- ACK（回应）
    ///   |    +------------------------------- NEED_ACK（需要确认）
    ///   +------------------------------------ TCP=1 / UDP=0
    /// </code>
    ///
    /// <para>WebSocket(H5) 走 TCP，故客户端发包固定带 <see cref="HeadTcp"/>。
    /// 协议类型 P1 起步用 <see cref="ProtocolJson"/>，后续可平滑切到
    /// <see cref="ProtocolProtobuf"/>（仅需改协议位 + body 编解码，包头结构不变）。</para>
    /// </summary>
    public static class PacketHead
    {
        /// <summary>TCP 标志位（bit7）。WebSocket 承载，置位。</summary>
        public const byte HeadTcp = unchecked((byte)0x80);

        /// <summary>UDP 标志位（=0）。</summary>
        public const byte HeadUdp = 0x00;

        /// <summary>需要确认（bit6）。P1 登录链路不使用。</summary>
        public const byte HeadNeedAck = 0x40;

        /// <summary>回应 ACK（bit5）。</summary>
        public const byte HeadAck = 0x20;

        /// <summary>关闭（bit4）。</summary>
        public const byte HeadClose = 0x10;

        /// <summary>协议类型掩码（低 2 位 bit1-bit0）。</summary>
        public const byte HeadProtocolMask = 0x03;

        /// <summary>协议类型：protobuf（=0）。</summary>
        public const byte ProtocolProtobuf = 0;

        /// <summary>协议类型：JSON（=1）。</summary>
        public const byte ProtocolJson = 1;

        /// <summary>
        /// 客户端发送 JSON 包时使用的默认包头：TCP + JSON。
        /// 服务端 <c>PacketHandlerManager.forward</c> 用
        /// <c>head &amp; HEAD_PROTOCOL_MASK</c> 取出协议位，从而把 body 当 JSON 解析。
        /// </summary>
        public const byte DefaultJsonHead = unchecked((byte)(HeadTcp | ProtocolJson));

        /// <summary>从包头中取出协议类型（低 2 位）。</summary>
        public static byte ProtocolOf(byte head)
        {
            return (byte)(head & HeadProtocolMask);
        }
    }
}
