using System;
using System.Collections;
using System.Collections.Generic;
using Echo.Net;
using Echo.Net.Dto;
using NativeWebSocket;
using UnityEngine;
using UnityEngine.UI;

namespace Echo.Ui
{
    /// <summary>
    /// Echo 初版可交互界面（FE-2 / FE-3）：用纯代码在运行时构建 uGUI，
    /// 单场景多面板跑通"登录 → 提交偏好 → 进入意识空间 → 看共鸣"。
    ///
    /// <para>职责：① 运行时建 <c>Canvas</c>/<c>EventSystem</c> 与四个面板；
    /// ② 持有 <see cref="EchoWebSocketClient"/>，按消息号路由下行包到对应面板；
    /// ③ 后台每 15s 发心跳 9001。严格对齐服务端端口 9001、封包格式、消息号与 JSON 约定。</para>
    ///
    /// <para>启动：靠 <see cref="AutoBootstrap"/> 的 <c>[RuntimeInitializeOnLoadMethod]</c> 在进入
    /// 播放模式时自动创建常驻实例，无需手动搭场景或绑定脚本 GUID。</para>
    /// </summary>
    public sealed class EchoUiApp : MonoBehaviour
    {
        private const string DefaultServerUrl = "ws://127.0.0.1:9001/";
        private const string DefaultOpenId = "dev-tester-001";
        private const float HeartbeatIntervalSec = 15f;

        private enum PanelId { Login, Prefs, Space, Resonance }

        private static EchoUiApp _instance;

        private EchoWebSocketClient _net;
        private bool _loggedIn;
        private long _accountId;
        private long _spaceId;
        private Coroutine _heartbeatLoop;

        // UI 引用
        private Image _background;
        private Text _statusText;
        private readonly Dictionary<PanelId, RectTransform> _panels = new();
        private readonly Dictionary<PanelId, Button> _navButtons = new();
        private RectTransform _panelContainer;

        // 登录面板
        private InputField _serverInput;
        private InputField _openIdInput;
        private Text _loginResult;

        // 偏好面板
        private readonly List<InputField> _prefInputs = new();
        private Text _prefsResult;

        // 空间面板
        private Text _spaceTitle;
        private Text _spaceAmbiance;
        private Text _spaceDetail;

        // 共鸣面板
        private RectTransform _resonanceList;
        private RectTransform _echoList;
        private Text _resonanceResult;

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        private static void AutoBootstrap()
        {
            if (_instance != null || FindAnyObjectByType<EchoUiApp>() != null)
            {
                return;
            }
            var go = new GameObject("EchoUiApp");
            go.AddComponent<EchoUiApp>();
        }

        private void Awake()
        {
            if (_instance != null && _instance != this)
            {
                Destroy(gameObject);
                return;
            }
            _instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Start()
        {
            BuildUi();
            ShowPanel(PanelId.Login);
            SetStatus("未连接");
        }

        private void Update()
        {
            // 非 WebGL 平台需每帧把网络回调泵到主线程，UI 更新才安全。
            _net?.DispatchMessageQueue();
        }

        private async void OnApplicationQuit()
        {
            if (_net != null)
            {
                await _net.Close();
            }
        }

        // ---------------------------------------------------------------- UI 构建

        private void BuildUi()
        {
            var canvas = UiFactory.CreateCanvas("EchoCanvas", transform);
            UiFactory.EnsureEventSystem(transform);

            _background = UiFactory.CreateRect("Background", canvas.transform,
                new Color(0.09f, 0.09f, 0.11f, 1f)).GetComponent<Image>();
            UiFactory.Stretch((RectTransform)_background.transform);

            BuildStatusBar(canvas.transform);
            BuildNavBar(canvas.transform);

            _panelContainer = UiFactory.CreateRect("PanelContainer", canvas.transform);
            UiFactory.Stretch(_panelContainer, 8f, 8f, 104f, 8f);

            BuildLoginPanel();
            BuildPrefsPanel();
            BuildSpacePanel();
            BuildResonancePanel();
        }

        private void BuildStatusBar(Transform parent)
        {
            var bar = UiFactory.CreateRect("StatusBar", parent, new Color(0.06f, 0.06f, 0.08f, 1f));
            UiFactory.Anchor(bar, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -8f), new Vector2(-16f, 44f));
            _statusText = UiFactory.CreateText("StatusText", bar, "未连接", 18, TextAnchor.MiddleLeft);
            UiFactory.Stretch((RectTransform)_statusText.transform, 12f, 12f, 0f, 0f);
        }

        private void BuildNavBar(Transform parent)
        {
            var bar = UiFactory.CreateRect("NavBar", parent);
            UiFactory.Anchor(bar, new Vector2(0f, 1f), new Vector2(1f, 1f), new Vector2(0.5f, 1f),
                new Vector2(0f, -56f), new Vector2(-16f, 44f));
            var row = bar.gameObject.AddComponent<HorizontalLayoutGroup>();
            row.spacing = 8f;
            row.childControlWidth = true;
            row.childControlHeight = true;
            row.childForceExpandWidth = true;
            row.childForceExpandHeight = true;

            _navButtons[PanelId.Login] = MakeNavButton(bar.transform, "1·登录", PanelId.Login);
            _navButtons[PanelId.Prefs] = MakeNavButton(bar.transform, "2·偏好录入", PanelId.Prefs);
            _navButtons[PanelId.Space] = MakeNavButton(bar.transform, "3·意识空间", PanelId.Space);
            _navButtons[PanelId.Resonance] = MakeNavButton(bar.transform, "4·共鸣", PanelId.Resonance);
        }

        private Button MakeNavButton(Transform parent, string label, PanelId target)
        {
            var btn = UiFactory.CreateButton("Nav_" + target, parent, label, 18);
            btn.onClick.AddListener(() => ShowPanel(target));
            return btn;
        }

        private RectTransform CreatePanel(string name)
        {
            var p = UiFactory.CreateRect(name, _panelContainer, UiFactory.PanelBg);
            UiFactory.Stretch(p);
            var vlg = p.gameObject.AddComponent<VerticalLayoutGroup>();
            vlg.padding = new RectOffset(18, 18, 18, 18);
            vlg.spacing = 10f;
            vlg.childControlWidth = true;
            vlg.childControlHeight = true;
            vlg.childForceExpandWidth = true;
            vlg.childForceExpandHeight = false;
            return p;
        }

        private static Text AddHeading(Transform parent, string text)
        {
            var t = UiFactory.CreateText("Heading", parent, text, 26, TextAnchor.MiddleLeft);
            UiFactory.WithHeight((RectTransform)t.transform, 36f);
            return t;
        }

        private static Text AddHint(Transform parent, string text)
        {
            var t = UiFactory.CreateText("Hint", parent, text, 15, TextAnchor.UpperLeft, UiFactory.SubTextColor);
            UiFactory.WithHeight((RectTransform)t.transform, 24f);
            return t;
        }

        private static InputField AddLabeledInput(Transform parent, string label, string placeholder, string initial = "")
        {
            AddHint(parent, label);
            var input = UiFactory.CreateInputField("Input_" + label, parent, placeholder, initial);
            UiFactory.WithHeight((RectTransform)input.transform, 40f);
            return input;
        }

        private static RectTransform AddButtonRow(Transform parent, float height = 44f)
        {
            var row = UiFactory.CreateRect("ButtonRow", parent);
            UiFactory.WithHeight(row, height);
            var hlg = row.gameObject.AddComponent<HorizontalLayoutGroup>();
            hlg.spacing = 8f;
            hlg.childControlWidth = true;
            hlg.childControlHeight = true;
            hlg.childForceExpandWidth = true;
            hlg.childForceExpandHeight = true;
            return row;
        }

        private static Text AddResultText(Transform parent, string initial)
        {
            var t = UiFactory.CreateText("Result", parent, initial, 16, TextAnchor.UpperLeft, UiFactory.SubTextColor);
            var le = t.gameObject.AddComponent<LayoutElement>();
            le.flexibleHeight = 1f;
            return t;
        }

        // ---------------------------------------------------------------- 登录面板

        private void BuildLoginPanel()
        {
            var p = CreatePanel("LoginPanel");
            _panels[PanelId.Login] = p;

            AddHeading(p.transform, "登录 · 连接意识网络");
            AddHint(p.transform, "连接本地 echo-server（默认 ws://127.0.0.1:9001/），用 openId 直登（P1 不带 token）。");

            _serverInput = AddLabeledInput(p.transform, "服务器地址", DefaultServerUrl, DefaultServerUrl);
            _openIdInput = AddLabeledInput(p.transform, "openId（外部登录态唯一标识）", DefaultOpenId, DefaultOpenId);

            var row = AddButtonRow(p.transform);
            var connectBtn = UiFactory.CreateButton("ConnectBtn", row.transform, "连接并登录 (1001)", 18);
            connectBtn.onClick.AddListener(OnConnectClicked);

            _loginResult = AddResultText(p.transform, "尚未连接。");
        }

        private void OnConnectClicked()
        {
            if (_net != null && _net.State == WebSocketState.Open)
            {
                _loginResult.text = "已连接，重发登录请求 ...";
                SendLogin();
                return;
            }

            string url = string.IsNullOrWhiteSpace(_serverInput.text) ? DefaultServerUrl : _serverInput.text.Trim();
            _loginResult.text = $"正在连接 {url} ...";
            SetStatus($"连接中 {url}");
            Connect(url);
        }

        private void Connect(string url)
        {
            _net = new EchoWebSocketClient();
            _net.OnConnected += HandleConnected;
            _net.OnPacket += HandlePacket;
            _net.OnError += (e) =>
            {
                Debug.LogError($"[EchoUiApp] 网络错误: {e}");
                _loginResult.text = $"<color=#ff8080>网络错误：{e}</color>";
                SetStatus("网络错误");
            };
            _net.OnClosed += (code) =>
            {
                Debug.Log($"[EchoUiApp] 连接关闭: {code}");
                _loggedIn = false;
                SetStatus($"连接关闭：{code}");
            };

            // NativeWebSocket 的 Connect 在连接关闭前不返回，故即发即忘（不 await）。
            _ = _net.Connect(url);
        }

        private void HandleConnected()
        {
            SetStatus("已连接，登录中 ...");
            SendLogin();
            if (_heartbeatLoop == null)
            {
                _heartbeatLoop = StartCoroutine(HeartbeatLoop());
            }
        }

        private void SendLogin()
        {
            string openId = string.IsNullOrWhiteSpace(_openIdInput.text) ? DefaultOpenId : _openIdInput.text.Trim();
            var req = new LoginReq { openId = openId, clientVersion = "0.1.0" };
            Debug.Log($"[EchoUiApp] -> LoginReq(1001) openId={openId}");
            _ = _net.SendJson(AccountMessages.Cmd.LoginReq, req);
        }

        // ---------------------------------------------------------------- 偏好面板

        private void BuildPrefsPanel()
        {
            var p = CreatePanel("PrefsPanel");
            _panels[PanelId.Prefs] = p;

            AddHeading(p.transform, "偏好录入 · 投射你的意识");
            AddHint(p.transform, "自拟少量偏好碎片，服务端经 LLM 补全并编码为个人向量（非空项才提交）。");

            _prefInputs.Clear();
            _prefInputs.Add(AddLabeledInput(p.transform, "年代 / 记忆时段", "如：90 年代、午后", "90年代"));
            _prefInputs.Add(AddLabeledInput(p.transform, "色调 / 光线", "如：暖橘黄昏、泛黄", "暖橘黄昏"));
            _prefInputs.Add(AddLabeledInput(p.transform, "意象 / 场景", "如：老楼道、旧书房", "老楼道"));
            _prefInputs.Add(AddLabeledInput(p.transform, "音乐 / 声音", "如：磁带、蝉鸣", "磁带"));
            _prefInputs.Add(AddLabeledInput(p.transform, "情绪关键词", "如：怀旧、安静", "怀旧"));

            var row = AddButtonRow(p.transform);
            var submitBtn = UiFactory.CreateButton("SubmitPrefsBtn", row.transform, "提交偏好 (1201)", 18);
            submitBtn.onClick.AddListener(OnSubmitPrefs);

            _prefsResult = AddResultText(p.transform, "尚未提交偏好。");
        }

        private void OnSubmitPrefs()
        {
            if (!RequireLoggedIn(_prefsResult))
            {
                return;
            }

            var prefs = new List<string>();
            foreach (var input in _prefInputs)
            {
                if (!string.IsNullOrWhiteSpace(input.text))
                {
                    prefs.Add(input.text.Trim());
                }
            }
            if (prefs.Count == 0)
            {
                _prefsResult.text = "<color=#ffcc66>请至少填写一个偏好。</color>";
                return;
            }

            var req = new SubmitPrefsReq { rawPrefs = prefs.ToArray() };
            _prefsResult.text = $"已提交 {prefs.Count} 个偏好，等待 LLM 补全 + 向量生成 ...";
            Debug.Log($"[EchoUiApp] -> SubmitPrefsReq(1201) prefs=[{string.Join(", ", prefs)}]");
            _ = _net.SendJson(MindMessages.Cmd.SubmitPrefsReq, req);
        }

        // ---------------------------------------------------------------- 空间面板

        private void BuildSpacePanel()
        {
            var p = CreatePanel("SpacePanel");
            _panels[PanelId.Space] = p;

            AddHeading(p.transform, "意识空间");
            AddHint(p.transform, "进入后服务端按个人向量选定势组合（presetSetId）+ 动态参数，客户端本地占位渲染。");

            var row = AddButtonRow(p.transform);
            var enterBtn = UiFactory.CreateButton("EnterSpaceBtn", row.transform, "进入意识空间 (1301)", 18);
            enterBtn.onClick.AddListener(OnEnterSpace);

            _spaceTitle = UiFactory.CreateText("SpaceTitle", p.transform, "（尚未进入）", 30, TextAnchor.MiddleCenter);
            UiFactory.WithHeight((RectTransform)_spaceTitle.transform, 48f);

            _spaceAmbiance = UiFactory.CreateText("SpaceAmbiance", p.transform,
                "进入你的意识空间后，这里会显示氛围文案与定势可视化。", 18, TextAnchor.MiddleCenter);
            UiFactory.WithHeight((RectTransform)_spaceAmbiance.transform, 60f);

            _spaceDetail = AddResultText(p.transform, "spaceId / presetSetId / dynamicParams / hostConfig 将在进入后展示。");
        }

        private void OnEnterSpace()
        {
            if (!RequireLoggedIn(_spaceDetail))
            {
                return;
            }
            _spaceDetail.text = "正在进入意识空间 ...";
            Debug.Log("[EchoUiApp] -> EnterSpaceReq(1301)");
            _ = _net.SendJson(SpaceMessages.Cmd.EnterSpaceReq, new EnterSpaceReq());
        }

        // ---------------------------------------------------------------- 共鸣面板

        private void BuildResonancePanel()
        {
            var p = CreatePanel("ResonancePanel");
            _panels[PanelId.Resonance] = p;

            AddHeading(p.transform, "共鸣 · 被渲染进你世界的灵魂");
            AddHint(p.transform, "查询共鸣候选（共鸣度 0~1，越大越近）；可在自己空间留痕，并拉取空间里的回声。");

            var row = AddButtonRow(p.transform);
            var queryBtn = UiFactory.CreateButton("QueryResonanceBtn", row.transform, "查询共鸣 (1401)", 17);
            queryBtn.onClick.AddListener(OnQueryResonance);
            var traceBtn = UiFactory.CreateButton("LeaveTraceBtn", row.transform, "留痕 (1503)", 17);
            traceBtn.onClick.AddListener(OnLeaveTrace);
            var pullBtn = UiFactory.CreateButton("PullEchoesBtn", row.transform, "拉回声 (1501)", 17);
            pullBtn.onClick.AddListener(OnPullEchoes);

            _resonanceResult = UiFactory.CreateText("ResonanceResult", p.transform, "尚未查询。",
                16, TextAnchor.UpperLeft, UiFactory.SubTextColor);
            UiFactory.WithHeight((RectTransform)_resonanceResult.transform, 24f);

            AddHint(p.transform, "共鸣候选：");
            _resonanceList = UiFactory.CreateScrollList("ResonanceList", p.transform);
            var rle = _resonanceList.transform.parent.gameObject.AddComponent<LayoutElement>();
            rle.flexibleHeight = 1f;

            AddHint(p.transform, "我空间里的回声：");
            _echoList = UiFactory.CreateScrollList("EchoList", p.transform);
            var ele = _echoList.transform.parent.gameObject.AddComponent<LayoutElement>();
            ele.flexibleHeight = 1f;
        }

        private void OnQueryResonance()
        {
            if (!RequireLoggedIn(_resonanceResult))
            {
                return;
            }
            _resonanceResult.text = "正在查询共鸣候选 ...";
            Debug.Log("[EchoUiApp] -> QueryResonanceReq(1401) topN=10");
            _ = _net.SendJson(ResonanceMessages.Cmd.QueryResonanceReq, new QueryResonanceReq { topN = 10, threshold = 0d });
        }

        private void OnLeaveTrace()
        {
            if (!RequireLoggedIn(_resonanceResult))
            {
                return;
            }
            if (_spaceId == 0)
            {
                _resonanceResult.text = "<color=#ffcc66>请先到「意识空间」面板进入空间，获得 spaceId 后再留痕。</color>";
                return;
            }
            var req = new LeaveTraceReq
            {
                ownerSpaceId = _spaceId.ToString(),
                payload = "{\"gesture\":\"wave\",\"note\":\"路过你的世界\"}",
                ttlMillis = "0"
            };
            _resonanceResult.text = $"正在向空间 {_spaceId} 留痕 ...";
            Debug.Log($"[EchoUiApp] -> LeaveTraceReq(1503) ownerSpaceId={_spaceId}");
            _ = _net.SendJson(EchoMessages.Cmd.LeaveTraceReq, req);
        }

        private void OnPullEchoes()
        {
            if (!RequireLoggedIn(_resonanceResult))
            {
                return;
            }
            if (_spaceId == 0)
            {
                _resonanceResult.text = "<color=#ffcc66>请先到「意识空间」面板进入空间，获得 spaceId 后再拉回声。</color>";
                return;
            }
            _resonanceResult.text = $"正在拉取空间 {_spaceId} 的回声 ...";
            Debug.Log($"[EchoUiApp] -> PullEchoesReq(1501) ownerSpaceId={_spaceId}");
            _ = _net.SendJson(EchoMessages.Cmd.PullEchoesReq, new PullEchoesReq { ownerSpaceId = _spaceId.ToString() });
        }

        // ---------------------------------------------------------------- 心跳

        private IEnumerator HeartbeatLoop()
        {
            var wait = new WaitForSeconds(HeartbeatIntervalSec);
            while (true)
            {
                yield return wait;
                if (_net != null && _net.State == WebSocketState.Open)
                {
                    var hb = new Heartbeat { clientTime = NowMillis().ToString() };
                    _ = _net.SendJson(SystemMessages.Cmd.Heartbeat, hb);
                    Debug.Log("[EchoUiApp] -> Heartbeat(9001)");
                }
            }
        }

        // ---------------------------------------------------------------- 路由

        private void HandlePacket(Packet packet)
        {
            switch (packet.Cmd)
            {
                case AccountMessages.Cmd.LoginResp:
                    HandleLoginResp(packet);
                    break;
                case MindMessages.Cmd.MindProfileResp:
                    HandleMindProfileResp(packet);
                    break;
                case SpaceMessages.Cmd.SpaceSnapshotResp:
                    HandleSpaceSnapshotResp(packet);
                    break;
                case SpaceMessages.Cmd.UpdateHostConfigResp:
                    Debug.Log($"[EchoUiApp] <- UpdateHostConfigResp(1304) {MessageJson.ToText(packet.Body)}");
                    break;
                case ResonanceMessages.Cmd.ResonanceListResp:
                    HandleResonanceListResp(packet);
                    break;
                case EchoMessages.Cmd.EchoListResp:
                    HandleEchoListResp(packet);
                    break;
                case EchoMessages.Cmd.LeaveTraceResp:
                    HandleLeaveTraceResp(packet);
                    break;
                case SystemMessages.Cmd.HeartbeatAck:
                    var ack = MessageJson.FromBody<HeartbeatAck>(packet.Body);
                    Debug.Log($"[EchoUiApp] <- HeartbeatAck(9002) serverTime={ack.ServerTime}");
                    break;
                default:
                    Debug.Log($"[EchoUiApp] <- 未处理 cmd={packet.Cmd}, body={MessageJson.ToText(packet.Body)}");
                    break;
            }
        }

        private void HandleLoginResp(Packet packet)
        {
            var resp = MessageJson.FromBody<LoginResp>(packet.Body);
            if (resp.code == 0)
            {
                _loggedIn = true;
                _accountId = resp.AccountId;
                _loginResult.text = $"<color=#88dd88>登录成功！</color>\naccountId={resp.AccountId}\n" +
                                    $"newAccount={resp.newAccount}, message={resp.message}";
                SetStatus($"已登录 · accountId={_accountId}");
                Debug.Log($"[EchoUiApp] <- LoginResp(1002) 成功 accountId={resp.AccountId}");
            }
            else
            {
                _loggedIn = false;
                _loginResult.text = $"<color=#ff8080>登录失败 code={resp.code}</color>\nmessage={resp.message}";
                SetStatus($"登录失败 code={resp.code}");
            }
        }

        private void HandleMindProfileResp(Packet packet)
        {
            var resp = MessageJson.FromBody<MindProfileResp>(packet.Body);
            if (resp.code == 0)
            {
                _prefsResult.text = "<color=#88dd88>意识档案已生成。</color>\n" +
                                    $"profileId={resp.ProfileId}\nvectorId={resp.VectorId}\n" +
                                    $"enrichedPrefs={PrettyOrDash(resp.enrichedPrefs)}";
            }
            else
            {
                _prefsResult.text = $"<color=#ff8080>提交失败 code={resp.code}</color>\nmessage={resp.message}";
            }
            Debug.Log($"[EchoUiApp] <- MindProfileResp(1202) code={resp.code}");
        }

        private void HandleSpaceSnapshotResp(Packet packet)
        {
            var resp = MessageJson.FromBody<SpaceSnapshotResp>(packet.Body);
            if (resp.code != 0)
            {
                _spaceDetail.text = $"<color=#ff8080>进入失败 code={resp.code}</color>\nmessage={resp.message}";
                return;
            }

            _spaceId = resp.SpaceId;
            ApplyPresetVisual(resp.PresetSetId);

            _spaceDetail.text =
                $"<color=#88dd88>已进入你的意识空间。</color>\n" +
                $"spaceId={resp.SpaceId}\npresetSetId={resp.PresetSetId}\n" +
                $"dynamicParams={PrettyOrDash(resp.dynamicParams)}\n" +
                $"hostConfig={PrettyOrDash(resp.hostConfig)}";
            Debug.Log($"[EchoUiApp] <- SpaceSnapshotResp(1302) spaceId={resp.SpaceId}, presetSetId={resp.PresetSetId}");
        }

        /// <summary>按 presetSetId 切换占位可视化（背景色 + 标题 + 氛围文案），让人"看得出进来了"。</summary>
        private void ApplyPresetVisual(long presetSetId)
        {
            string title;
            string ambiance;
            Color bg;
            switch (presetSetId)
            {
                case 1001: // 黄昏老楼道（E2/R1/S2/M1）
                    title = "黄昏老楼道";
                    ambiance = "夕阳从楼道尽头的窗斜照进来，木门、信箱与扶手都浸在暖橘色里。";
                    bg = new Color(0.42f, 0.26f, 0.18f, 1f);
                    break;
                case 1002: // 午后旧书房（E1/R1/S1/M4）
                    title = "午后旧书房";
                    ambiance = "午后的光透过纱帘落在木书桌上，旧书与磁带泛着温吞的黄。";
                    bg = new Color(0.40f, 0.34f, 0.20f, 1f);
                    break;
                default:
                    title = $"意识空间 #{presetSetId}";
                    ambiance = "一处只属于你的、被克制呈现的世界。";
                    bg = new Color(0.16f, 0.18f, 0.26f, 1f);
                    break;
            }
            _spaceTitle.text = $"◖ {title} ◗";
            _spaceAmbiance.text = ambiance;
            if (_background != null)
            {
                _background.color = bg;
            }
            // 同时给空间面板自身染色（盖在背景上的面板更显眼），强化"进来了"的感知。
            if (_panels.TryGetValue(PanelId.Space, out var spacePanel))
            {
                var img = spacePanel.GetComponent<Image>();
                if (img != null)
                {
                    img.color = new Color(bg.r * 0.7f, bg.g * 0.7f, bg.b * 0.7f, 0.94f);
                }
            }
        }

        private void HandleResonanceListResp(Packet packet)
        {
            var resp = MessageJson.FromBody<ResonanceListResp>(packet.Body);
            ClearChildren(_resonanceList);
            int count = resp.candidates?.Count ?? 0;
            if (resp.code != 0)
            {
                _resonanceResult.text = $"<color=#ff8080>查询失败 code={resp.code}</color> {resp.message}";
                return;
            }
            _resonanceResult.text = $"共鸣候选 {count} 个：";
            if (count == 0)
            {
                AddListItem(_resonanceList, "（暂无共鸣者——先提交偏好生成向量，或等待更多用户加入）");
                return;
            }
            foreach (var c in resp.candidates)
            {
                string pct = (c.score * 100d).ToString("0.0");
                AddListItem(_resonanceList, $"accountId={c.AccountId}    共鸣度 {pct}%");
            }
            Debug.Log($"[EchoUiApp] <- ResonanceListResp(1402) count={count}");
        }

        private void HandleEchoListResp(Packet packet)
        {
            var resp = MessageJson.FromBody<EchoListResp>(packet.Body);
            ClearChildren(_echoList);
            int count = resp.echoes?.Count ?? 0;
            if (resp.code != 0)
            {
                _resonanceResult.text = $"<color=#ff8080>拉回声失败 code={resp.code}</color> {resp.message}";
                return;
            }
            _resonanceResult.text = $"空间 {_spaceId} 的回声 {count} 条：";
            if (count == 0)
            {
                AddListItem(_echoList, "（空间里还没有回声——可以先点「留痕」留下一个）");
                return;
            }
            foreach (var e in resp.echoes)
            {
                AddListItem(_echoList, $"echoId={e.EchoId}  来自 {e.FromAccountId}\npayload={PrettyOrDash(e.payload)}");
            }
            Debug.Log($"[EchoUiApp] <- EchoListResp(1502) count={count}");
        }

        private void HandleLeaveTraceResp(Packet packet)
        {
            var resp = MessageJson.FromBody<LeaveTraceResp>(packet.Body);
            if (resp.code == 0)
            {
                _resonanceResult.text = $"<color=#88dd88>留痕成功</color> echoId={resp.EchoId}，可点「拉回声」查看。";
            }
            else
            {
                _resonanceResult.text = $"<color=#ff8080>留痕失败 code={resp.code}</color> {resp.message}";
            }
            Debug.Log($"[EchoUiApp] <- LeaveTraceResp(1504) code={resp.code}");
        }

        // ---------------------------------------------------------------- 工具

        private void ShowPanel(PanelId id)
        {
            foreach (var kv in _panels)
            {
                kv.Value.gameObject.SetActive(kv.Key == id);
            }
            foreach (var kv in _navButtons)
            {
                var img = kv.Value.GetComponent<Image>();
                img.color = kv.Key == id ? UiFactory.ButtonBgActive : UiFactory.ButtonBg;
            }
        }

        private void SetStatus(string text)
        {
            if (_statusText != null)
            {
                _statusText.text = $"状态：{text}";
            }
        }

        private bool RequireLoggedIn(Text target)
        {
            if (_loggedIn && _net != null && _net.State == WebSocketState.Open)
            {
                return true;
            }
            target.text = "<color=#ffcc66>请先在「登录」面板连接并登录成功。</color>";
            return false;
        }

        private static void AddListItem(RectTransform content, string text)
        {
            var t = UiFactory.CreateText("Item", content, text, 16, TextAnchor.UpperLeft);
            var le = t.gameObject.AddComponent<LayoutElement>();
            le.minHeight = 24f;
        }

        private static void ClearChildren(RectTransform content)
        {
            for (int i = content.childCount - 1; i >= 0; i--)
            {
                Destroy(content.GetChild(i).gameObject);
            }
        }

        private static string PrettyOrDash(string s)
        {
            return string.IsNullOrEmpty(s) ? "—" : s;
        }

        private static long NowMillis()
        {
            return DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        }
    }
}
