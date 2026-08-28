using System;
using System.Collections.Generic;

namespace Echo.Net.Dto
{
    /// <summary>
    /// 共鸣号段（14xx）消息 DTO，对应
    /// <c>echo-server/src/main/proto/echo_resonance.proto</c>（TECH-P1 §4.3）。
    /// </summary>
    public static class ResonanceMessages
    {
        public static class Cmd
        {
            public const int QueryResonanceReq = 1401;
            public const int ResonanceListResp = 1402;
        }
    }

    /// <summary>C-&gt;S 查询共鸣候选，对应 <c>QueryResonanceReq_1401</c>。topN/threshold &lt;=0 时服务端用默认。</summary>
    [Serializable]
    public class QueryResonanceReq
    {
        /// <summary>返回数量上限（proto: top_n）。</summary>
        public int topN;

        /// <summary>余弦距离阈值上限（proto: threshold）。</summary>
        public double threshold;
    }

    /// <summary>
    /// 共鸣候选项，对应 <c>ResonanceCandidate</c>。
    ///
    /// <para>注意：服务端在 <c>ResonanceHandler</c> 响应边界已把内部余弦距离转换为
    /// 直觉化"共鸣度"——<c>score = 1 - 余弦距离</c>，裁剪到 [0,1]，<b>越大越近</b>。</para>
    /// </summary>
    [Serializable]
    public class ResonanceCandidate
    {
        /// <summary>候选账号ID（proto int64: account_id；JSON 字符串）。</summary>
        public string accountId;

        /// <summary>共鸣度（0~1，越大越近，proto double: score）。</summary>
        public double score;

        public long AccountId => long.TryParse(accountId, out var v) ? v : 0L;
    }

    /// <summary>S-&gt;C 共鸣候选列表，对应 <c>ResonanceListResp_1402</c>。</summary>
    [Serializable]
    public class ResonanceListResp
    {
        public int code;

        /// <summary>共鸣候选（proto: candidates, repeated）。为空时 proto3 JSON 省略，反序列化后可能为 null。</summary>
        public List<ResonanceCandidate> candidates;

        public string message;
    }
}
