//=============================================================================
// main.js - GF_3_ItemInfoWindow 备注编辑器
//=============================================================================

const App = (() => {
    "use strict";

    // ==========================================================================
    // Layer definitions
    // ==========================================================================

    const LAYER_DEFAULTS = [
        { id: 1,  defaultTitle: "顶部信息",     subtitle: "包括帮助插入信息" },
        { id: 2,  defaultTitle: "装备/物品信息", subtitle: "参数·特性·常规用语" },
        { id: 3,  defaultTitle: "效果信息",     subtitle: "伤害·回复·状态"  },
        { id: 4,  defaultTitle: "底部信息",     subtitle: "包括帮助插入信息" },
        { id: 5,  defaultTitle: "条件消耗",     subtitle: "技能消耗·装备条件" }
    ];

    // ==========================================================================
    // State
    // ==========================================================================

    const state = {
        infoTextTop: "",
        preInfo: [],      // [{ text, level }]
        afterInfo: [],    // [{ text, level }]
        infoTextBottom: "",
        preHelp: false,
        afterHelp: false,
        infoEval: "",
        layerTitles: {},
        currentLeftTab: "setup"
    };

    // ==========================================================================
    // DOM refs
    // ==========================================================================

    const els = {};

    function cacheDom() {
        els.infoTextTop    = document.getElementById("info-text-top");
        els.infoTextBottom = document.getElementById("info-text-bottom");
        els.preHelpChip    = document.getElementById("chip-prehelp");
        els.afterHelpChip  = document.getElementById("chip-afterhelp");
        els.infoEval       = document.getElementById("info-eval");
        els.preview        = document.getElementById("preview-text");
        els.visualPreview  = document.getElementById("visual-preview");
        els.tabSource      = document.getElementById("tab-source");
        els.tabVisual      = document.getElementById("tab-visual");
        els.tabParse       = document.getElementById("tab-parse");
        els.panelSource    = document.getElementById("panel-source");
        els.panelParse     = document.getElementById("panel-parse");
        els.panelVisual    = document.getElementById("panel-visual");
        els.statusBar      = document.getElementById("status-bar");
        els.copyBtn        = document.getElementById("btn-copy");
        els.parseBtn       = document.getElementById("btn-parse");
        els.parseInput     = document.getElementById("parse-input");
        els.clearBtn       = document.getElementById("btn-clear");
        els.itemNameInput  = document.getElementById("item-name");
        els.layerConfig    = document.getElementById("layer-config");
        els.leftTabs       = document.querySelectorAll(".left-tab");
        els.leftContents   = document.querySelectorAll(".left-tab-content");
        els.formBody       = document.getElementById("form-body");
    }

    // ==========================================================================
    // Left panel tab switching
    // ==========================================================================

    function switchLeftTab(tabId) {
        state.currentLeftTab = tabId;
        els.leftTabs.forEach(t => t.classList.toggle("active", t.dataset.tab === tabId));
        els.leftContents.forEach(c => c.classList.toggle("active", c.dataset.tab === tabId));
    }

    // ==========================================================================
    // Generate tags
    // ==========================================================================

    function generateOutput() {
        const lines = [];

        const topText = state.infoTextTop.trim();
        if (topText) {
            lines.push("<Info Text Top>");
            topText.split("\n").forEach(line => {
                if (line.trim()) lines.push(line.trimEnd());
            });
            lines.push("</Info Text Top>");
            lines.push("");
        }

        if (state.preHelp) {
            lines.push("<PreHelp>");
            lines.push("");
        }

        for (const item of state.preInfo) {
            const text = item.text.trim();
            if (!text) continue;
            const level = item.level.trim();
            if (level) {
                lines.push(`<PreInfo ${level}: ${text}>`);
            } else {
                lines.push(`<PreInfo 2: ${text}>`);
            }
        }

        for (const item of state.afterInfo) {
            const text = item.text.trim();
            if (!text) continue;
            const level = item.level.trim();
            if (level) {
                lines.push(`<AfterInfo ${level}: ${text}>`);
            } else {
                lines.push(`<AfterInfo 2: ${text}>`);
            }
        }

        if (state.preInfo.some(i => i.text.trim()) || state.afterInfo.some(i => i.text.trim())) {
            lines.push("");
        }

        if (state.afterHelp) {
            lines.push("<AfterHelp>");
            lines.push("");
        }

        const bottomText = state.infoTextBottom.trim();
        if (bottomText) {
            lines.push("<Info Text Bottom>");
            bottomText.split("\n").forEach(line => {
                if (line.trim()) lines.push(line.trimEnd());
            });
            lines.push("</Info Text Bottom>");
            lines.push("");
        }

        const evalText = state.infoEval.trim();
        if (evalText) {
            lines.push("<Info Eval>");
            evalText.split("\n").forEach(line => {
                lines.push(line.trimEnd());
            });
            lines.push("</Info Eval>");
            lines.push("");
        }

        while (lines.length > 0 && lines[lines.length - 1] === "") {
            lines.pop();
        }

        return lines.join("\n") + "\n";
    }

    // ==========================================================================
    // Layer content builders
    // ==========================================================================

    function getItemsForLayer(layerId, allItems) {
        return allItems.map((item, idx) => ({ ...item, _idx: idx }))
            .filter(item => {
                const lv = item.level ? parseInt(item.level) : NaN;
                if (layerId === 2) {
                    return !item.level || lv === 2;
                }
                return lv === layerId;
            });
    }

    function buildLayerContent() {
        const layers = {};

        for (const def of LAYER_DEFAULTS) {
            layers[def.id] = {
                title: state.layerTitles[def.id] || def.defaultTitle,
                defaultTitle: def.defaultTitle,
                subtitle: def.subtitle,
                userContent: [],
                autoContent: []
            };
        }

        // Layer 1: Top info + PreHelp
        if (state.infoTextTop.trim()) {
            const lines = state.infoTextTop.split("\n").filter(l => l.trim());
            for (const line of lines) {
                layers[1].userContent.push({ type: "text", value: line.trimEnd() });
            }
        }
        if (state.preHelp) {
            layers[1].userContent.push({ type: "tag", value: "PreHelp — 在此插入帮助信息内容" });
        }

        // PreInfo: group by level
        for (const item of state.preInfo) {
            const text = item.text.trim();
            if (!text) continue;
            const level = item.level ? (parseInt(item.level) || 2) : 2;
            const label = item.level ? `<PreInfo ${item.level}>` : "<PreInfo>";
            if (!layers[level]) {
                if (!layers[level]) {
                    layers[level] = {
                        title: state.layerTitles[level] || `自定义层 ${level}`,
                        defaultTitle: `自定义层 ${level}`,
                        subtitle: "",
                        userContent: [],
                        autoContent: []
                    };
                }
            }
            layers[level].userContent.push({ type: "preinfo", value: text, tag: label });
        }

        // AfterInfo: group by level
        for (const item of state.afterInfo) {
            const text = item.text.trim();
            if (!text) continue;
            const level = item.level ? (parseInt(item.level) || 2) : 2;
            const label = item.level ? `<AfterInfo ${item.level}>` : "<AfterInfo>";
            if (!layers[level]) {
                layers[level] = {
                    title: state.layerTitles[level] || `自定义层 ${level}`,
                    defaultTitle: `自定义层 ${level}`,
                    subtitle: "",
                    userContent: [],
                    autoContent: []
                };
            }
            layers[level].userContent.push({ type: "afterinfo", value: text, tag: label });
        }

        // Layer 4: Bottom info + AfterHelp
        if (state.infoTextBottom.trim()) {
            const lines = state.infoTextBottom.split("\n").filter(l => l.trim());
            for (const line of lines) {
                layers[4].userContent.push({ type: "text", value: line.trimEnd() });
            }
        }
        if (state.afterHelp) {
            layers[4].userContent.push({ type: "tag", value: "AfterHelp — 在此插入帮助信息内容" });
        }

        // Auto-generated placeholders
        layers[2].autoContent.push({ type: "auto", value: "基本参数: ATK+15 DEF+10" });
        layers[2].autoContent.push({ type: "auto", value: "特性: 攻击附加火焰属性" });
        layers[2].autoContent.push({ type: "auto", value: "装备类型: 单手剑" });
        layers[3].autoContent.push({ type: "auto", value: "伤害类型: 物理伤害" });
        layers[3].autoContent.push({ type: "auto", value: "公式: a.atk * 4 - b.def * 2" });
        layers[3].autoContent.push({ type: "auto", value: "效果: 攻击力+30% 3回合" });
        layers[5].autoContent.push({ type: "auto", value: "消费: MP 15" });
        layers[5].autoContent.push({ type: "auto", value: "装备条件: 剑装备可能" });

        return layers;
    }

    // ==========================================================================
    // Render visual preview
    // ==========================================================================

    function renderVisualPreview() {
        const container = els.visualPreview;
        const itemName = (els.itemNameInput && els.itemNameInput.value.trim()) || "物品名称";
        const layers = buildLayerContent();

        const hasUserText = state.infoTextTop.trim() ||
            state.preInfo.some(i => i.text.trim()) ||
            state.afterInfo.some(i => i.text.trim()) ||
            state.infoTextBottom.trim() ||
            state.preHelp || state.afterHelp ||
            state.infoEval.trim();

        if (!hasUserText) {
            container.innerHTML = `<div class="visual-empty">
                <div>
                    <div style="font-size:32px;margin-bottom:8px;opacity:0.3;">⬡</div>
                    <div>编辑左侧内容即可预览显示效果</div>
                    <div style="font-size:12px;margin-top:4px;color:var(--text-muted);">
                        在左侧「预览信息」页中可以自定义各层标题
                    </div>
                </div>
            </div>`;
            return;
        }

        let html = `<div class="rm-window">`;
        html += `<div class="rm-title">
            <div class="rm-title-icon">⬡</div>
            <div class="rm-title-text">${escapeHtml(itemName)}</div>
        </div>`;

        const sortedIds = Object.keys(layers).sort((a, b) => parseInt(a) - parseInt(b));
        for (let idx = 0; idx < sortedIds.length; idx++) {
            const lid = parseInt(sortedIds[idx]);
            const layer = layers[lid];
            if (!layer) continue;
            const hasContent = layer.userContent.length > 0 || layer.autoContent.length > 0;
            if (!hasContent) continue;
            if (idx > 0) html += `<hr class="rm-separator">`;

            const def = LAYER_DEFAULTS.find(d => d.id === lid);
            const badgeClass = `l${lid}`;
            html += `<div class="rm-layer">`;
            html += `<div class="rm-layer-header">
                <span class="rm-layer-badge ${badgeClass}">Lv${lid}</span>
                <span class="rm-layer-title">${escapeHtml(layer.title)}</span>
                ${def ? `<span style="font-size:10px;color:rgba(255,255,255,0.3);margin-left:4px;">${escapeHtml(def.subtitle)}</span>` : ""}
            </div>`;
            html += `<div class="rm-layer-body">`;

            for (const item of layer.userContent) {
                if (item.type === "text") {
                    html += `<div class="rm-text">${escapeHtml(item.value)}</div>`;
                } else if (item.type === "tag") {
                    html += `<div class="rm-text-muted">${escapeHtml(item.value)}</div>`;
                } else {
                    html += `<div class="rm-text"><span class="rm-tag">${escapeHtml(item.tag)}</span> ${escapeHtml(item.value)}</div>`;
                }
            }

            for (const item of layer.autoContent) {
                html += `<div class="rm-text-auto">${escapeHtml(item.value)}</div>`;
            }

            html += `</div></div>`;
        }

        html += `<hr class="rm-separator">`;
        html += `<div class="rm-last-info">
            <div class="rm-last-row">
                <span><span class="rm-last-label">品质:</span> ★★★ 稀有</span>
                <span><span class="rm-last-label">价格:</span> 2500 G</span>
            </div>
            <div class="rm-last-row" style="margin-top:2px;">
                <span><span class="rm-last-label">贩卖:</span> 1250 G</span>
                <span><span class="rm-last-label">分类:</span> 剑/武器</span>
            </div>
        </div>`;

        if (state.infoEval.trim()) {
            html += `<hr class="rm-separator">`;
            html += `<div class="rm-text-code">${tabTag("Info Eval")} 预处理代码已注册</div>`;
            const evalLines = state.infoEval.split("\n").filter(l => l.trim());
            for (const line of evalLines.slice(0, 2)) {
                html += `<div class="rm-text-code">${escapeHtml(line.trimEnd())}</div>`;
            }
            if (evalLines.length > 2) {
                html += `<div class="rm-text-code" style="opacity:0.5;">...还有 ${evalLines.length - 2} 行</div>`;
            }
        }

        html += `</div>`;
        container.innerHTML = html;
    }

    function escapeHtml(str) {
        return String(str).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
    }

    function tabTag(name) {
        return `<span class="rm-tag">&lt;${escapeHtml(name)}&gt;</span>`;
    }

    // ==========================================================================
    // Render layer title config
    // ==========================================================================

    function renderLayerConfig() {
        els.layerConfig.innerHTML = "";
        for (const def of LAYER_DEFAULTS) {
            const row = document.createElement("div");
            row.className = "layer-config-row";
            const badge = document.createElement("span");
            badge.className = `layer-config-badge l${def.id}`;
            badge.textContent = `Lv${def.id}`;
            const input = document.createElement("input");
            input.type = "text";
            input.className = "layer-config-input";
            input.placeholder = def.defaultTitle;
            input.value = state.layerTitles[def.id] || "";
            input.dataset.layerId = def.id;
            const dflt = document.createElement("span");
            dflt.className = "layer-config-default";
            dflt.textContent = `默认: ${def.defaultTitle}`;
            input.addEventListener("input", () => {
                const val = input.value.trim();
                const id = parseInt(input.dataset.layerId);
                if (val) state.layerTitles[id] = val;
                else delete state.layerTitles[id];
                renderVisualPreview();
            });
            row.appendChild(badge);
            row.appendChild(input);
            row.appendChild(dflt);
            els.layerConfig.appendChild(row);
        }
        const note = document.createElement("div");
        note.style.cssText = "font-size:11px;color:var(--text-muted);margin-top:4px;padding-left:36px;";
        note.textContent = "最底部的品质/价格信息由插件自动生成，不受层级标题控制。";
        els.layerConfig.appendChild(note);
    }

    // ==========================================================================
    // Render layer row lists (filtered by level)
    // ==========================================================================

    function renderLayerRows() {
    // Each layer has separate PreInfo and AfterInfo containers
    for (let lid = 1; lid <= 5; lid++) {
        renderFilteredRows("layer" + lid + "-preinfo-rows", state.preInfo, null, lid);
        renderFilteredRows("layer" + lid + "-afterinfo-rows", null, state.afterInfo, lid);
    }
}

    function renderFilteredRows(containerId, preInfoArr, afterInfoArr, layerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = "";

        let items = [];

        // Collect PreInfo items for this layer
        if (preInfoArr) {
            const filtered = getItemsForLayer(layerId, preInfoArr);
            for (const item of filtered) {
                items.push({ text: item.text, level: item.level || "", globalIdx: item._idx, type: "preinfo" });
            }
        }

        // Collect AfterInfo items for this layer
        if (afterInfoArr) {
            const filtered = getItemsForLayer(layerId, afterInfoArr);
            for (const item of filtered) {
                items.push({ text: item.text, level: item.level || "", globalIdx: item._idx, type: "afterinfo" });
            }
        }

        if (items.length === 0) {
            const empty = document.createElement("div");
            empty.className = "row-empty";
            if (layerId === 3 || layerId === 5) {
                empty.textContent = "暂无自定义行，点击上方按钮添加";
            } else {
                empty.textContent = "暂无内容";
            }
            container.appendChild(empty);
            return;
        }

        for (const item of items) {
            const row = document.createElement("div");
            row.className = "row-item";

            const typeLabel = document.createElement("span");
            typeLabel.style.cssText = "font-size:10px;color:var(--text-muted);font-family:var(--mono-font);flex-shrink:0;min-width:50px;";
            typeLabel.textContent = item.type === "preinfo" ? "<PreInfo>" : "<AfterInfo>";

            const textInput = document.createElement("input");
            textInput.type = "text";
            textInput.className = "row-text";
            textInput.placeholder = "输入描述文本...";
            textInput.value = item.text;

            const levelInput = document.createElement("input");
            levelInput.type = "text";
            levelInput.className = "row-level";
            levelInput.placeholder = "层级";
            levelInput.title = "显示层级";
            levelInput.value = item.level;

            const delBtn = document.createElement("button");
            delBtn.type = "button";
            delBtn.className = "btn btn-danger btn-icon";
            delBtn.innerHTML = "✕";
            delBtn.title = "删除此行";

            row.appendChild(typeLabel);
            row.appendChild(textInput);
            row.appendChild(levelInput);
            row.appendChild(delBtn);

            delBtn.addEventListener("click", () => {
                const arr = item.type === "preinfo" ? state.preInfo : state.afterInfo;
                if (item.globalIdx >= 0 && item.globalIdx < arr.length) {
                    arr.splice(item.globalIdx, 1);
                }
                renderLayerRows();
                syncState();
            });

            textInput.addEventListener("input", () => {
                const arr = item.type === "preinfo" ? state.preInfo : state.afterInfo;
                if (item.globalIdx >= 0 && item.globalIdx < arr.length) {
                    arr[item.globalIdx].text = textInput.value;
                }
                syncState();
            });

            levelInput.addEventListener("input", () => {
                const arr = item.type === "preinfo" ? state.preInfo : state.afterInfo;
                if (item.globalIdx >= 0 && item.globalIdx < arr.length) {
                    arr[item.globalIdx].level = levelInput.value;
                }
                renderLayerRows();
                syncState();
            });

            container.appendChild(row);
        }
    }

    // ==========================================================================
    // Add a row for a specific layer
    // ==========================================================================

    function addLayerRow(layerId, type) {
        const arr = type === "preinfo" ? state.preInfo : state.afterInfo;
        const level = layerId === 2 ? "" : String(layerId);
        arr.push({ text: "", level: level });
        renderLayerRows();
        syncState();
        // No focus since tab might be different from current
    }

    // ==========================================================================
    // Render previews
    // ==========================================================================

    function renderPreview() {
        const output = generateOutput();
        els.preview.value = output;
        renderVisualPreview();
        updateStatus(output);
    }

    function updateStatus(output) {
        const lines = output.trim() ? output.split("\n").filter(l => l.trim()).length : 0;
        els.statusBar.textContent = `共 ${lines} 行有效标签`;
    }

    // ==========================================================================
    // Sync state from DOM
    // ==========================================================================

    function syncState() {
        state.infoTextTop = els.infoTextTop.value;
        state.infoTextBottom = els.infoTextBottom.value;
        state.preHelp = els.preHelpChip.classList.contains("active");
        state.afterHelp = els.afterHelpChip.classList.contains("active");
        state.infoEval = els.infoEval.value;

        // PreInfo/AfterInfo are already stored in state via input handlers
        // Just re-render preview
        renderPreview();
    }

    // ==========================================================================
    // ==========================================================================
    // Parse note text back to editor
    // ==========================================================================

    function parseToEditor() {
        const text = els.parseInput.value;
        if (!text.trim()) { showToast("预览框中没有内容可解析"); return; }

        state.infoTextTop = "";
        state.preInfo = [];
        state.afterInfo = [];
        state.infoTextBottom = "";
        state.preHelp = false;
        state.afterHelp = false;
        state.infoEval = "";

        const notedata = text.split("\n");
        let evalMode = "none";

        for (const line of notedata) {
            if (line.match(/<\/(?:Info Text Top|顶部信息)>/i)) { evalMode = "none"; continue; }
            if (line.match(/<\/(?:Info Text Bottom|底部信息)>/i)) { evalMode = "none"; continue; }
            if (line.match(/<\/(?:Info Eval|信息预处理)>/i)) { evalMode = "none"; continue; }

            if (evalMode === "top") {
                const trimmed = line.trimEnd();
                if (trimmed) state.infoTextTop += (state.infoTextTop ? "\n" : "") + trimmed;
                continue;
            }
            if (evalMode === "bottom") {
                const trimmed = line.trimEnd();
                if (trimmed) state.infoTextBottom += (state.infoTextBottom ? "\n" : "") + trimmed;
                continue;
            }
            if (evalMode === "eval") {
                state.infoEval += (state.infoEval ? "\n" : "") + line.trimEnd();
                continue;
            }

            if (line.match(/<(?:Info Text Top|顶部信息)>/i)) { evalMode = "top"; continue; }
            if (line.match(/<(?:Info Text Bottom|底部信息)>/i)) { evalMode = "bottom"; continue; }
            if (line.match(/<(?:Info Eval|信息预处理)>/i)) { evalMode = "eval"; continue; }

            if (line.match(/<(?:PreHelp|帮助插入[：:]前)>/i)) { state.preHelp = true; continue; }
            if (line.match(/<(?:AfterHelp|帮助插入[：:]后)>/i)) { state.afterHelp = true; continue; }

            const preInfoMatch = line.match(/<(?:PreInfo|描述前)\s+(\d+)\s*[：:]\s*([^<>]*)>/i);
            if (preInfoMatch) { state.preInfo.push({ text: preInfoMatch[2].trim(), level: preInfoMatch[1] }); continue; }

            const preInfoNoLevel = line.match(/<(?:PreInfo|描述前)\s*[：:]\s*([^<>]*)>/i);
            if (preInfoNoLevel) { state.preInfo.push({ text: preInfoNoLevel[1].trim(), level: "" }); continue; }

            const afterInfoMatch = line.match(/<(?:AfterInfo|描述后)\s+(\d+)\s*[：:]\s*([^<>]*)>/i);
            if (afterInfoMatch) { state.afterInfo.push({ text: afterInfoMatch[2].trim(), level: afterInfoMatch[1] }); continue; }

            const afterInfoNoLevel = line.match(/<(?:AfterInfo|描述后)\s*[：:]\s*([^<>]*)>/i);
            if (afterInfoNoLevel) { state.afterInfo.push({ text: afterInfoNoLevel[1].trim(), level: "" }); continue; }
        }

        els.infoTextTop.value = state.infoTextTop;
        els.infoTextBottom.value = state.infoTextBottom;
        els.infoEval.value = state.infoEval;
        els.preHelpChip.classList.toggle("active", state.preHelp);
        els.afterHelpChip.classList.toggle("active", state.afterHelp);

        renderLayerConfig();
        renderLayerRows();
        renderPreview();
        switchLeftTab("setup");
        showToast("已解析到编辑器！");
    }

    // ==========================================================================
    // Copy to clipboard
    // ==========================================================================

    function copyToClipboard() {
        const text = els.preview.value;
        if (!text.trim()) { showToast("没有内容可复制"); return; }
        // Try clipboard API first
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(() => {
                showToast("已复制到剪贴板！");
            }).catch(() => {
                fallbackCopy(text);
            });
        } else {
            fallbackCopy(text);
        }
    }

    function fallbackCopy(text) {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        try {
            const success = document.execCommand("copy");
            if (success) {
                showToast("已复制到剪贴板！");
            } else {
                showToast("复制失败，请手动选择文本复制");
            }
        } catch (e) {
            showToast("复制失败，请手动选择文本复制");
        }
        document.body.removeChild(textarea);
    }

    // ==========================================================================
    // Tab switching (right panel)
    // ==========================================================================

    function switchRightTab(tab) {
        els.tabSource.classList.toggle("active", tab === "source");
        els.tabParse.classList.toggle("active", tab === "parse");
        els.tabVisual.classList.toggle("active", tab === "visual");
        els.panelSource.classList.toggle("active", tab === "source");
        els.panelParse.classList.toggle("active", tab === "parse");
        els.panelVisual.classList.toggle("active", tab === "visual");
    }

    // ==========================================================================
    // Clear all
    // ==========================================================================

    function clearAll() {
        if (els.preview.value.trim() && !confirm("确定要清空所有内容吗？")) return;
        state.infoTextTop = "";
        state.preInfo = [];
        state.afterInfo = [];
        state.infoTextBottom = "";
        state.preHelp = false;
        state.afterHelp = false;
        state.infoEval = "";
        state.layerTitles = {};
        els.infoTextTop.value = "";
        els.infoTextBottom.value = "";
        els.infoEval.value = "";
        els.preHelpChip.classList.remove("active");
        els.afterHelpChip.classList.remove("active");
        if (els.itemNameInput) els.itemNameInput.value = "";
        renderLayerConfig();
        renderLayerRows();
        syncState();
        showToast("已清空");
    }

    // ==========================================================================
    // Toast
    // ==========================================================================

    let toastTimer = null;
    function showToast(msg) {
        let toast = document.querySelector(".toast");
        if (!toast) {
            toast = document.createElement("div");
            toast.className = "toast";
            document.body.appendChild(toast);
        }
        toast.textContent = msg;
        toast.classList.add("show");
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { toast.classList.remove("show"); }, 2000);
    }

    // ==========================================================================
    // Init
    // ==========================================================================

    function init() {
        cacheDom();

        renderLayerConfig();
        renderLayerRows();
        renderPreview();
        switchRightTab("source");
        switchLeftTab("setup");

        // Left tabs
        els.leftTabs.forEach(tab => {
            tab.addEventListener("click", () => {
                switchLeftTab(tab.dataset.tab);
                // Re-render rows when switching to layer tabs (in case levels changed)
                if (tab.dataset.tab.startsWith("layer")) {
                    renderLayerRows();
                }
            });
        });

        // Input sync
        els.infoTextTop.addEventListener("input", syncState);
        els.infoTextBottom.addEventListener("input", syncState);
        els.infoEval.addEventListener("input", syncState);
        if (els.itemNameInput) els.itemNameInput.addEventListener("input", syncState);

        // Toggle chips
        els.preHelpChip.addEventListener("click", () => { els.preHelpChip.classList.toggle("active"); syncState(); });
        els.afterHelpChip.addEventListener("click", () => { els.afterHelpChip.classList.toggle("active"); syncState(); });

        // Add layer row buttons (delegated event)
        document.querySelectorAll(".add-layer-row").forEach(btn => {
            btn.addEventListener("click", () => {
                const layer = parseInt(btn.dataset.layer);
                const type = btn.dataset.type;
                addLayerRow(layer, type);
            });
        });

        // Right tabs
        els.tabSource.addEventListener("click", () => switchRightTab("source"));
        els.tabVisual.addEventListener("click", () => switchRightTab("visual"));
        els.tabParse.addEventListener("click", () => switchRightTab("parse"));

        // Copy / Clear
        els.copyBtn.addEventListener("click", copyToClipboard);
        els.parseBtn.addEventListener("click", parseToEditor);
        els.clearBtn.addEventListener("click", clearAll);

        // Keyboard
        document.addEventListener("keydown", (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                copyToClipboard();
            }
        });
    }

    document.addEventListener("DOMContentLoaded", init);
    if (document.readyState === "complete" || document.readyState === "interactive") {
        init();
    }

    return { generateOutput, showToast };
})();






