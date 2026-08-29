using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;

namespace Echo.Ui
{
    /// <summary>
    /// 运行时 uGUI 构建工具：用纯代码创建 <see cref="Canvas"/> / <see cref="EventSystem"/>
    /// 与各类控件（面板、文本、按钮、输入框、滚动列表）。
    ///
    /// <para>设计动机：避免手搓易碎的 <c>.prefab</c>/<c>.unity</c> 资产与脆弱的脚本-GUID 绑定，
    /// 让工程"打开即 Play 出界面"。一律使用 <b>Legacy UI</b>（<c>UnityEngine.UI.Text</c> 等），
    /// 不用 TextMeshPro——TMP 首次使用需导入 "TMP Essentials"，新工程缺失会运行时报错；
    /// Legacy UI 仅依赖已声明的 <c>com.unity.ugui</c>，开箱即用。</para>
    ///
    /// <para>字体用内置 <c>LegacyRuntime.ttf</c>（Unity 6 中 Arial.ttf 的替代内置字体）。</para>
    /// </summary>
    public static class UiFactory
    {
        public static readonly Color PanelBg = new Color(0.12f, 0.12f, 0.14f, 0.92f);
        public static readonly Color FieldBg = new Color(0.18f, 0.18f, 0.21f, 1f);
        public static readonly Color ButtonBg = new Color(0.20f, 0.34f, 0.52f, 1f);
        public static readonly Color ButtonBgActive = new Color(0.30f, 0.52f, 0.78f, 1f);
        public static readonly Color TextColor = new Color(0.92f, 0.92f, 0.94f, 1f);
        public static readonly Color SubTextColor = new Color(0.70f, 0.72f, 0.78f, 1f);

        private static Font _font;

        /// <summary>内置字体（懒加载）。</summary>
        public static Font Font
        {
            get
            {
                if (_font == null)
                {
                    _font = Resources.GetBuiltinResource<Font>("LegacyRuntime.ttf");
                }
                return _font;
            }
        }

        /// <summary>创建一个全屏 ScreenSpaceOverlay 画布（含 CanvasScaler / Raycaster）。</summary>
        public static Canvas CreateCanvas(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(Canvas), typeof(CanvasScaler), typeof(GraphicRaycaster));
            if (parent != null)
            {
                go.transform.SetParent(parent, false);
            }

            var canvas = go.GetComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;

            var scaler = go.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.matchWidthOrHeight = 0.5f;

            return canvas;
        }

        /// <summary>确保场景里有一个 EventSystem（Legacy StandaloneInputModule）。</summary>
        public static void EnsureEventSystem(Transform parent)
        {
            if (Object.FindAnyObjectByType<EventSystem>() != null)
            {
                return;
            }
            var go = new GameObject("EventSystem", typeof(EventSystem), typeof(StandaloneInputModule));
            if (parent != null)
            {
                go.transform.SetParent(parent, false);
            }
        }

        /// <summary>创建一个 RectTransform 子节点（带可选 Image 背景）。</summary>
        public static RectTransform CreateRect(string name, Transform parent, Color? bg = null)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var rect = (RectTransform)go.transform;
            if (bg.HasValue)
            {
                var img = go.AddComponent<Image>();
                img.color = bg.Value;
            }
            return rect;
        }

        /// <summary>把 RectTransform 拉伸填满父节点（可设四边内边距）。</summary>
        public static RectTransform Stretch(RectTransform rect, float padding = 0f)
        {
            return Stretch(rect, padding, padding, padding, padding);
        }

        public static RectTransform Stretch(RectTransform rect, float left, float right, float top, float bottom)
        {
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = new Vector2(left, bottom);
            rect.offsetMax = new Vector2(-right, -top);
            return rect;
        }

        /// <summary>设置锚定到父节点某锚点 + 像素尺寸/偏移。</summary>
        public static RectTransform Anchor(RectTransform rect, Vector2 anchorMin, Vector2 anchorMax,
            Vector2 pivot, Vector2 anchoredPos, Vector2 sizeDelta)
        {
            rect.anchorMin = anchorMin;
            rect.anchorMax = anchorMax;
            rect.pivot = pivot;
            rect.anchoredPosition = anchoredPos;
            rect.sizeDelta = sizeDelta;
            return rect;
        }

        /// <summary>创建文本控件。</summary>
        public static Text CreateText(string name, Transform parent, string content,
            int fontSize = 18, TextAnchor anchor = TextAnchor.UpperLeft, Color? color = null)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            var text = go.AddComponent<Text>();
            text.font = Font;
            text.text = content;
            text.fontSize = fontSize;
            text.alignment = anchor;
            text.color = color ?? TextColor;
            text.horizontalOverflow = HorizontalWrapMode.Wrap;
            text.verticalOverflow = VerticalWrapMode.Overflow;
            text.supportRichText = true;
            return text;
        }

        /// <summary>创建按钮，返回 Button（其子节点含一个标签 Text）。</summary>
        public static Button CreateButton(string name, Transform parent, string label,
            int fontSize = 18, Color? bg = null)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(Button));
            go.transform.SetParent(parent, false);
            var img = go.GetComponent<Image>();
            img.color = bg ?? ButtonBg;

            var button = go.GetComponent<Button>();
            var colors = button.colors;
            colors.normalColor = Color.white;
            colors.highlightedColor = new Color(1f, 1f, 1f, 0.9f);
            colors.pressedColor = new Color(0.85f, 0.85f, 0.85f, 1f);
            colors.fadeDuration = 0.05f;
            button.colors = colors;

            var text = CreateText(name + "Label", go.transform, label, fontSize, TextAnchor.MiddleCenter);
            Stretch((RectTransform)text.transform, 6f);

            return button;
        }

        /// <summary>创建单行输入框，返回 InputField。</summary>
        public static InputField CreateInputField(string name, Transform parent, string placeholder,
            string initial = "", int fontSize = 18)
        {
            var go = new GameObject(name, typeof(RectTransform), typeof(Image), typeof(InputField));
            go.transform.SetParent(parent, false);
            go.GetComponent<Image>().color = FieldBg;

            var input = go.GetComponent<InputField>();

            var placeholderText = CreateText(name + "Placeholder", go.transform, placeholder, fontSize,
                TextAnchor.MiddleLeft, SubTextColor);
            placeholderText.fontStyle = FontStyle.Italic;
            Stretch((RectTransform)placeholderText.transform, 10f, 10f, 4f, 4f);

            var text = CreateText(name + "Text", go.transform, string.Empty, fontSize, TextAnchor.MiddleLeft);
            Stretch((RectTransform)text.transform, 10f, 10f, 4f, 4f);

            input.textComponent = text;
            input.placeholder = placeholderText;
            input.text = initial;
            input.lineType = InputField.LineType.SingleLine;

            return input;
        }

        /// <summary>
        /// 创建一个带垂直布局的滚动列表，返回内容容器（content）。
        /// 往返回的容器里加子节点即可形成可滚动列表。
        /// </summary>
        public static RectTransform CreateScrollList(string name, Transform parent, float spacing = 6f)
        {
            var viewport = CreateRect(name, parent, new Color(0.08f, 0.08f, 0.10f, 0.6f));
            viewport.gameObject.AddComponent<RectMask2D>();
            var scroll = viewport.gameObject.AddComponent<ScrollRect>();
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 24f;

            var content = CreateRect(name + "Content", viewport);
            content.anchorMin = new Vector2(0f, 1f);
            content.anchorMax = new Vector2(1f, 1f);
            content.pivot = new Vector2(0.5f, 1f);
            content.anchoredPosition = Vector2.zero;
            content.sizeDelta = new Vector2(0f, 0f);

            var layout = content.gameObject.AddComponent<VerticalLayoutGroup>();
            layout.childControlWidth = true;
            layout.childControlHeight = true;
            layout.childForceExpandWidth = true;
            layout.childForceExpandHeight = false;
            layout.spacing = spacing;
            layout.padding = new RectOffset(8, 8, 8, 8);

            var fitter = content.gameObject.AddComponent<ContentSizeFitter>();
            fitter.verticalFit = ContentSizeFitter.FitMode.PreferredSize;

            scroll.viewport = viewport;
            scroll.content = content;
            return content;
        }

        /// <summary>给一个 RectTransform 加 LayoutElement 指定首选高度（用于布局列表项/控件）。</summary>
        public static LayoutElement WithHeight(RectTransform rect, float height)
        {
            var le = rect.gameObject.GetComponent<LayoutElement>();
            if (le == null)
            {
                le = rect.gameObject.AddComponent<LayoutElement>();
            }
            le.preferredHeight = height;
            le.minHeight = height;
            return le;
        }
    }
}
