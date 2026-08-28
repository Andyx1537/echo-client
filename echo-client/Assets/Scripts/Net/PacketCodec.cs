using System;

namespace Echo.Net
{
    /// <summary>
    /// 严格对齐 Aengine WebSocket 封包格式的编解码器（无 checksum 通道）。
    ///
    /// <para>线上字节布局（大端 / 网络字节序，对应 Netty <c>ByteBuf</c> 默认大端）：</para>
    /// <code>
    /// +---------+------------------+----------------+--------------------+
    /// | head: 1 | length: 2 (int16)| cmd: 4 (int32) | body: (length - 4) |
    /// +---------+------------------+----------------+--------------------+
    /// 其中 length = body.Length + 4   （即 length 把后面 4 字节的 cmd 一并计入）
    /// 整帧总长 = 7 + body.Length
    /// </code>
    ///
    /// <para>实现依据（务必与服务端逐字段对齐）：</para>
    /// <list type="bullet">
    ///   <item><c>Encoder.write</c>（checkSum==null 分支）：
    ///     <c>writeByte(head); writeShort(body.length + 4); writeInt(cmd); writeBytes(body);</c></item>
    ///   <item><c>Decoder.channelRead</c>（checkSum==null 分支）：
    ///     <c>head=readByte(); length=readShort(); cmd=readInt(); body=readBytes(length-4);</c></item>
    /// </list>
    ///
    /// <para>每个 WebSocket 二进制帧（<c>BinaryWebSocketFrame</c>）恰好承载一个完整 Packet，
    /// 故无需跨帧粘包拆包处理：一帧 = 一包。</para>
    ///
    /// <para>注意：<c>length</c> 在服务端是有符号 <c>short</c>，单帧 body 上限约 32KB。
    /// 登录等小包远未触及，超大消息需走分页/分包协议（P1 不涉及）。</para>
    /// </summary>
    public static class PacketCodec
    {
        /// <summary>包头(1) + 长度(2) + cmd(4) 固定头部字节数。</summary>
        public const int HeaderSize = 7;

        /// <summary>
        /// 编码为一个可直接通过 WebSocket 二进制帧发送的字节数组。
        /// </summary>
        public static byte[] Encode(byte head, int cmd, byte[] body)
        {
            body ??= Array.Empty<byte>();
            int frameLen = HeaderSize + body.Length;
            var buf = new byte[frameLen];

            buf[0] = head;

            // length = body.Length + 4，大端写入 2 字节
            int lengthField = body.Length + 4;
            buf[1] = (byte)((lengthField >> 8) & 0xFF);
            buf[2] = (byte)(lengthField & 0xFF);

            // cmd，大端写入 4 字节
            buf[3] = (byte)((cmd >> 24) & 0xFF);
            buf[4] = (byte)((cmd >> 16) & 0xFF);
            buf[5] = (byte)((cmd >> 8) & 0xFF);
            buf[6] = (byte)(cmd & 0xFF);

            if (body.Length > 0)
            {
                Buffer.BlockCopy(body, 0, buf, HeaderSize, body.Length);
            }
            return buf;
        }

        /// <summary>
        /// 从单个 WebSocket 二进制帧的负载解码出一个 <see cref="Packet"/>。
        /// </summary>
        /// <param name="frame">收到的二进制帧完整字节。</param>
        /// <param name="packet">解码结果。</param>
        /// <returns>解码成功返回 true；帧不完整或非法返回 false。</returns>
        public static bool TryDecode(byte[] frame, out Packet packet)
        {
            packet = null;
            if (frame == null || frame.Length < HeaderSize)
            {
                return false;
            }

            byte head = frame[0];

            // 大端读取 length（有符号 short，与服务端一致）
            short lengthField = (short)((frame[1] << 8) | frame[2]);
            if (lengthField <= 0)
            {
                return false;
            }

            int cmd = (frame[3] << 24) | (frame[4] << 16) | (frame[5] << 8) | frame[6];

            int bodyLen = lengthField - 4;
            if (bodyLen < 0 || HeaderSize + bodyLen > frame.Length)
            {
                return false;
            }

            var body = new byte[bodyLen];
            if (bodyLen > 0)
            {
                Buffer.BlockCopy(frame, HeaderSize, body, 0, bodyLen);
            }

            packet = new Packet(head, cmd, body);
            return true;
        }
    }
}
