using System;

namespace Echo.Net.Dto
{
    /// <summary>
    /// 意识空间号段（13xx）消息 DTO，对应
    /// <c>echo-server/src/main/proto/echo_space.proto</c>（TECH-P1 §4.2）。
    /// </summary>
    public static class SpaceMessages
    {
        public static class Cmd
        {
            public const int EnterSpaceReq = 1301;
            public const int SpaceSnapshotResp = 1302;
            public const int UpdateHostConfigReq = 1303;
            public const int UpdateHostConfigResp = 1304;
        }
    }

    /// <summary>C-&gt;S 进入自己的意识空间，对应 <c>EnterSpaceReq_1301</c>（空消息体）。</summary>
    [Serializable]
    public class EnterSpaceReq
    {
    }

    /// <summary>
    /// S-&gt;C 空间快照，对应 <c>SpaceSnapshotResp_1302</c>。
    /// 客户端按 <see cref="presetSetId"/> + <see cref="dynamicParams"/> 本地拼装渲染。
    /// </summary>
    [Serializable]
    public class SpaceSnapshotResp
    {
        public int code;

        /// <summary>空间实例ID（proto int64: space_id；JSON 字符串）。留痕/拉回声以此为 ownerSpaceId。</summary>
        public string spaceId;

        /// <summary>定势组合ID（proto int64: preset_set_id；起步 1001/1002，见 ART.md §3）。</summary>
        public string presetSetId;

        /// <summary>动态参数 JSON 文本：天气/光影/点缀（proto: dynamic_params）。</summary>
        public string dynamicParams;

        /// <summary>主控配置 JSON 文本（proto: host_config）。</summary>
        public string hostConfig;

        public string message;

        public long SpaceId => long.TryParse(spaceId, out var v) ? v : 0L;
        public long PresetSetId => long.TryParse(presetSetId, out var v) ? v : 0L;
    }

    /// <summary>C-&gt;S 更新主控配置（共鸣细节），对应 <c>UpdateHostConfigReq_1303</c>。</summary>
    [Serializable]
    public class UpdateHostConfigReq
    {
        public bool broadcast;
        public bool asyncOnly;

        /// <summary>共鸣余弦距离阈值上限（越小越严格，proto: resonance_threshold）。</summary>
        public double resonanceThreshold;

        public bool allowBattle;
    }

    /// <summary>S-&gt;C 更新主控配置响应，对应 <c>UpdateHostConfigResp_1304</c>。</summary>
    [Serializable]
    public class UpdateHostConfigResp
    {
        public int code;
        public string hostConfig;
        public string message;
    }
}
