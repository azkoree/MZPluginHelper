//=============================================================================
// tags.js
// SceneGlossary 标签定义与快速插入逻辑
// 排除 <SGCategory:xxx> 和 <SGType:xxx>（已在编辑器上方单独处理）
//=============================================================================

const TagInserter = (() => {
    "use strict";

    // ==========================================================================
    // 标签分类定义
    // ==========================================================================

    /**
     * 每个组：
     *   name    - 组名
     *   items[] - 标签列表
     *     label    - 下拉菜单显示文本
     *     tagName  - 标签名（不含尖括号）
     *     params[] - 参数描述数组 { label, placeholder }
     *     pageSuffix - 是否带页码后缀（SGDescription2~99）
     *     dynamicIndex - 动态索引（SG追加1~99ピクチャ）
     *     multi       - 复合参数（如 SGTextColorChange:a,b）
     *     noValue     - 无值标签（如 SGManual）
     */
    const tagGroups = [
        {
            name: "文本说明",
            items: [
                { tagName: "SGDescription",           label: "说明文",                params: [{ label: "说明内容", placeholder: "输入说明文...", skipPrompt: true }] },
                { tagName: "SGDescription",           label: "第N页说明文",            params: [
                    { label: "页码", placeholder: "2~99" },
                    { label: "说明内容", placeholder: "输入说明文...", skipPrompt: true }
                ], pageSuffix: true },
                { tagName: "SG共通説明",                label: "共用说明文（日）",       params: [{ label: "说明内容", placeholder: "所有页面通用" }] },
                { tagName: "SGCommonDescription",      label: "共用说明文（英）",       params: [{ label: "说明内容", placeholder: "所有页面通用" }] },
                { tagName: "SG未入手説明",              label: "未入手说明文（日）",     params: [{ label: "说明内容", placeholder: "未获取时的显示文本" }] },
                { tagName: "SGNoItemText",             label: "未入手说明文（英）",     params: [{ label: "说明内容", placeholder: "未获取时的显示文本" }] },
                { tagName: "SGEnemy",                  label: "敌人数据ID（英）",      params: [{ label: "敌人ID", placeholder: "数据库中的敌人编号" }] },
                { tagName: "SG敵キャラ",                 label: "敌人数据ID（日）",      params: [{ label: "敌人ID", placeholder: "数据库中的敌人编号" }] },
            ]
        },
        {
            name: "图片设置",
            items: [
                { tagName: "SGPicture",                label: "图片文件名",            params: [{ label: "文件名（不含路径）", placeholder: "例: monster001" }] },
                { tagName: "SGPicturePosition",        label: "图片显示位置",          params: [{ label: "位置", placeholder: "top / bottom / text" }] },
                { tagName: "SGPictureAlign",           label: "图片对齐",              params: [{ label: "对齐方式", placeholder: "left / center / right" }] },
                { tagName: "SGPicturePriority",        label: "图片优先级",            params: [{ label: "优先级", placeholder: "top（文本上方）或 bottom" }] },
                { tagName: "SGPictureScale",           label: "图片放大率",            params: [{ label: "放大率", placeholder: "0.5 ~ 1.0" }] },
                { tagName: "SGTextPosition",           label: "文本Y坐标",             params: [{ label: "Y坐标", placeholder: "数值，0=自动" }] },
                { tagName: "SGPictureX",               label: "图片X偏移",             params: [{ label: "X偏移", placeholder: "像素值" }] },
                { tagName: "SGPictureY",               label: "图片Y偏移",             params: [{ label: "Y偏移", placeholder: "像素值" }] },
                { tagName: "SG追加1ピクチャ",            label: "附加图片(日)",          params: [
                    { label: "图片文件名", placeholder: "例: item002" },
                    { label: "X坐标", placeholder: "0" },
                    { label: "Y坐标", placeholder: "0" }
                ], dynamicIndex: { name: "SG追加", suffix: "ピクチャ", min: 1, max: 99 } },
                { tagName: "SGPlus1Picture",           label: "附加图片(英)",          params: [
                    { label: "图片文件名", placeholder: "例: item002" },
                    { label: "X坐标", placeholder: "0" },
                    { label: "Y坐标", placeholder: "0" }
                ], dynamicIndex: { name: "SGPlus", suffix: "Picture", min: 1, max: 99 } },
            ]
        },
        {
            name: "控制开关",
            items: [
                { tagName: "SG表示順",                  label: "显示顺序（日）",        params: [{ label: "顺序", placeholder: "数值，越小越靠前" }] },
                { tagName: "SGDisplayOrder",           label: "显示顺序（英）",        params: [{ label: "顺序", placeholder: "数值，越小越靠前" }] },
                { tagName: "SG用語閲覧スイッチ",        label: "浏览时开关（日）",     params: [{ label: "开关ID", placeholder: "打开此条目时 ON" }] },
                { tagName: "SGViewingSwitch",          label: "浏览时开关（英）",     params: [{ label: "开关ID", placeholder: "打开此条目时 ON" }] },
                { tagName: "SG表示スイッチ2",           label: "第2页开关（日）",      params: [{ label: "开关ID", placeholder: "指定开关ON时才显示第2页" }] },
                { tagName: "SGVisibleSwitch",           label: "第2页开关（英）",      params: [{ label: "开关ID", placeholder: "指定开关ON时才显示第2页" }] },
                { tagName: "SGTextColorChange",         label: "文字颜色变化",         params: [
                    { label: "开关ID", placeholder: "控制颜色的开关" },
                    { label: "颜色ID", placeholder: "系统颜色索引号" }
                ], multi: true },
            ]
        }
    ];

    /**
     * 无值开关标签（点击即插入/删除，自动切换）
     */
    const switchTags = [
        { tagName: "SGManual",         label: "Manual",      tooltip: "排除自动注册" },
        { tagName: "SGNoCollect",      label: "NoCollect",   tooltip: "不计入收集率" },
        { tagName: "SGページ番号不要",  label: "无页码(日)",  tooltip: "不显示页码" },
        { tagName: "SGNoPageNum",      label: "NoPageNum",   tooltip: "不显示页码" },
    ];

    // ==========================================================================
    // 工具函数
    // ==========================================================================

    function insertAtCursor(textarea, text) {
        // 处理光标占位符 \x00
        const cursorIdx = text.indexOf("\x00");
        const cleanText = text.replace(/\x00/g, "");

        const start = textarea.selectionStart;
        const end   = textarea.selectionEnd;
        const before = textarea.value.substring(0, start);
        const after  = textarea.value.substring(end);
        textarea.value = before + cleanText + after;
        const pos = (cursorIdx !== -1 ? start + cursorIdx : start + cleanText.length);
        textarea.selectionStart = pos;
        textarea.selectionEnd   = pos;
        textarea.focus();
        textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    function buildTag(tagDef) {
        const name = tagDef.tagName;
        if (tagDef.noValue) {
            return "<" + name + ">\n";
        }

        // 动态索引（SG追加1~99ピクチャ）
        let finalName = name;
        if (tagDef.dynamicIndex) {
            const di = tagDef.dynamicIndex;
            const idx = prompt("序号 (" + di.min + "~" + di.max + ")", String(di.min));
            if (idx === null) return null;
            const n = parseInt(idx) || di.min;
            if (n < di.min || n > di.max) {
                alert("序号超出范围（" + di.min + "~" + di.max + "）");
                return null;
            }
            finalName = di.name + n + di.suffix;
        }

        // 页码后缀（SGDescription2~99）
        if (tagDef.pageSuffix && tagDef.params && tagDef.params.length >= 2) {
            const page = prompt(tagDef.params[0].label, tagDef.params[0].placeholder);
            if (page === null) return null;
            const n = parseInt(page) || 2;
            if (n < 2 || n > 99) {
                alert("页码范围：2~99");
                return null;
            }
            finalName = name + n;
            const hasSkip = tagDef.params[1] && tagDef.params[1].skipPrompt;
            let content;
            if (hasSkip) {
                content = "\x00";  // 光标占位符
            } else {
                content = prompt(tagDef.params[1].label, "");
                if (content === null) return null;
            }
            return "<" + finalName + ":" + content + ">\n";
        }

        // 普通参数
        if (tagDef.params && tagDef.params.length > 0) {
            const values = [];
            for (const p of tagDef.params) {
                if (p.skipPrompt) {
                    values.push("\x00");  // 光标占位符
                } else {
                    const val = prompt(p.label, "");
                    if (val === null) return null;
                    values.push(val);
                }
            }
            const paramStr = tagDef.multi
                ? values.join(",")
                : values.join(":");
            return "<" + finalName + ":" + paramStr + ">\n";
        }

        return "<" + finalName + ">\n";
    }

    function toggleSwitchTag(tagName) {
        const textarea = document.getElementById("field-note");
        if (!textarea) return;
        const fullTag = "<" + tagName + ">";
        if (textarea.value.includes(fullTag)) {
            // 移除标签及周围换行
            const escaped = fullTag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp("\\n?" + escaped + "\\n?", "g");
            textarea.value = textarea.value.replace(regex, "\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
            textarea.dispatchEvent(new Event("input", { bubbles: true }));
        } else {
            insertAtCursor(textarea, fullTag + "\n");
        }
    }

    // ==========================================================================
    // 构建下拉选项 HTML
    // ==========================================================================

    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
    }

    function buildOptionsHtml() {
        let html = "";
        tagGroups.forEach(group => {
            html += '<optgroup label="' + escapeHtml(group.name) + '">';
            group.items.forEach(item => {
                const text = item.label + " <" + item.tagName + (item.params ? ":...>" : ">");
                const value = group.name + "|" + item.label;
                html += '<option value="' + escapeHtml(value) + '">' + escapeHtml(text) + "</option>";
            });
            html += "</optgroup>";
        });
        return html;
    }

    function findTagByOption(value) {
        const parts = value.split("|");
        if (parts.length !== 2) return null;
        const groupName = parts[0];
        const itemLabel = parts[1];
        for (const group of tagGroups) {
            if (group.name === groupName) {
                return group.items.find(item => item.label === itemLabel) || null;
            }
        }
        return null;
    }

    // ==========================================================================
    // 公开 API
    // ==========================================================================

    return {
        getGroups:       () => tagGroups,
        getSwitches:     () => switchTags,
        getOptionsHtml:  () => buildOptionsHtml(),

        insertFromDropdown(optionValue) {
            const tagDef = findTagByOption(optionValue);
            if (!tagDef) return false;
            const textarea = document.getElementById("field-note");
            if (!textarea) return false;
            const tagText = buildTag(tagDef);
            if (tagText === null) return false;
            insertAtCursor(textarea, tagText);
            return true;
        },

        toggleSwitch(tagName) {
            toggleSwitchTag(tagName);
        },

        isSwitchActive(tagName) {
            const textarea = document.getElementById("field-note");
            if (!textarea) return false;
            return textarea.value.includes("<" + tagName + ">");
        }
    };
})();
