using System;

namespace Echo.Net.Dto
{
    /// <summary>
    /// 意识档案号段（12xx）消息 DTO，对应
    /// <c>echo-server/src/main/proto/echo_mind.proto</c>。
    ///
    /// <para>字段命名采用 proto3 JSON 的 lowerCamelCase；int64 字段（profileId/vectorId）
    /// 在 proto3 JSON 中是字符串，故用 <c>string</c> 承载，详见 <see cref="MessageJson"/>。</para>
    /// </summary>
    public static class MindMessages
    {
        public static class Cmd
        {
            public const int SubmitPrefsReq = 1201;
            public const int MindProfileResp = 1202;
        }
    }

    /// <summary>C-&gt;S 提交偏好，对应 <c>SubmitPrefsReq_1201</c>（触发 LLM 补全 + 向量生成）。</summary>
    [Serializable]
    public class SubmitPrefsReq
    {
        /// <summary>
        /// 用户自拟偏好标签/碎片（proto: raw_prefs, repeated string）。
        /// proto3 JSON 里是字符串数组；<c>JsonUtility</c> 直接支持 <c>string[]</c>。
        /// </summary>
        public string[] rawPrefs = Array.Empty<string>();
    }

    /// <summary>S-&gt;C 意识档案响应，对应 <c>MindProfileResp_1202</c>。</summary>
    [Serializable]
    public class MindProfileResp
    {
        /// <summary>0=成功，非0=失败码（proto: code）。</summary>
        public int code;

        /// <summary>意识档案ID（proto int64: profile_id；JSON 字符串）。</summary>
        public string profileId;

        /// <summary>个人向量ID（proto int64: vector_id；JSON 字符串）。</summary>
        public string vectorId;

        /// <summary>LLM 补全偏好的 JSON 文本（proto: enriched_prefs）。</summary>
        public string enrichedPrefs;

        /// <summary>提示信息（proto: message）。</summary>
        public string message;

        public long ProfileId => long.TryParse(profileId, out var v) ? v : 0L;
        public long VectorId => long.TryParse(vectorId, out var v) ? v : 0L;
    }
}
