//=============================================================================
// ui.js
// GlossaryData 编辑器 - UI 渲染与事件管理
//=============================================================================

const UI = (() => {
    "use strict";

    let els = {};
    let selectedId = null;
    let onSave = null;
    let onDelete = null;
    let onNew = null;
    let onImport = null;
    let onExport = null;
    let onSelect = null;
    let isDirty = false;

    // ==========================================================================
    // 开关标签状态更新
    // ==========================================================================

    function refreshSwitchChips() {
        if (!els.tagChips) return;
        els.tagChips.forEach(chip => {
            const tagName = chip.dataset.tag;
            if (TagInserter.isSwitchActive(tagName)) {
                chip.classList.add("active");
            } else {
                chip.classList.remove("active");
            }
        });
    }

    // ==========================================================================
    // DOM 引用
    // ==========================================================================

    function cacheElements() {
        els = {
            app:            document.getElementById("app"),
            importBtn:      document.getElementById("btn-import"),
            exportBtn:      document.getElementById("btn-export"),
            importInput:    document.getElementById("import-input"),
            dropOverlay:    document.getElementById("drop-overlay"),
            listPanel:      document.getElementById("list-panel"),
            listBody:       document.getElementById("list-body"),
            listCount:      document.getElementById("list-count"),
            listFilters:    document.getElementById("list-filters"),
            filterCategory: document.getElementById("filter-category"),
            filterGlossaryType: document.getElementById("filter-glossary-type"),
            listActions:    document.getElementById("list-actions"),
            editorPanel:    document.getElementById("editor-panel"),
            emptyMsg:       document.getElementById("empty-message"),
            form:           document.getElementById("editor-form"),
            fieldId:        document.getElementById("field-id"),
            fieldName:      document.getElementById("field-name"),
            fieldIcon:      document.getElementById("field-icon"),
            fieldItypeId:   document.getElementById("field-itypeid"),
            fieldCategory:  document.getElementById("field-category"),
            categoryList:   document.getElementById("category-list"),
            fieldGlossaryType: document.getElementById("field-glossary-type"),
            fieldNote:      document.getElementById("field-note"),
            btnSave:        document.getElementById("btn-save"),
            btnDelete:      document.getElementById("btn-delete"),
            btnNew:         document.getElementById("btn-new"),
            statusBar:      document.getElementById("status-bar"),
            tagSelect:      document.getElementById("tag-select"),
            btnInsertTag:   document.getElementById("btn-insert-tag"),
            tagChips:       null,
        };
    }

    // ==========================================================================
    // 状态栏
    // ==========================================================================

    function setStatus(msg, isError) {
        els.statusBar.textContent = msg;
        els.statusBar.className = "status-bar" + (isError ? " status-error" : "");
        if (isError) {
            setTimeout(() => { els.statusBar.className = "status-bar"; }, 4000);
        }
    }

    // ==========================================================================
    // 筛选器管理
    // ==========================================================================

    /** 刷新筛选下拉选项（保留当前筛选值） */
    function refreshFilters() {
        const categories = DataStore.getCategories();
        const types = DataStore.getGlossaryTypes();

        const curCat = els.filterCategory.value;
        const curType = els.filterGlossaryType.value;

        // 重建分类选项
        els.filterCategory.innerHTML = '<option value="">分类：全部</option>';
        categories.forEach(c => {
            const opt = document.createElement("option");
            opt.value = c;
            opt.textContent = c;
            els.filterCategory.appendChild(opt);
        });
        if (categories.includes(curCat)) els.filterCategory.value = curCat;
        else els.filterCategory.value = "";

        // 重建词典id选项
        els.filterGlossaryType.innerHTML = '<option value="">词典id：全部</option>';
        types.forEach(t => {
            const opt = document.createElement("option");
            opt.value = t;
            opt.textContent = t;
            els.filterGlossaryType.appendChild(opt);
        });
        if (types.includes(curType)) els.filterGlossaryType.value = curType;
        else els.filterGlossaryType.value = "";
    }

    /** 对条目数组应用当前筛选条件 */
    function applyFilters(entries) {
        const cat = els.filterCategory.value;
        const type = els.filterGlossaryType.value;
        return entries.filter(e => {
            if (cat && e.category !== cat) return false;
            if (type && String(e.glossaryType) !== type) return false;
            return true;
        });
    }

    // ==========================================================================
    // 列表渲染
    // ==========================================================================

    function renderList(entries) {
        // 数据存在但筛选无匹配
        if (entries.length === 0 && DataStore.count() > 0) {
            els.listBody.innerHTML =
                '<div class="list-empty">没有匹配的条目<br><span style="font-size:11px;color:#9ca3af;">请调整筛选条件</span></div>';
            els.listCount.textContent = "共 " + DataStore.count() + " 条";
            return;
        }

        const frag = document.createDocumentFragment();
        entries.forEach(entry => {
            const div = document.createElement("div");
            div.className = "list-item" + (entry.id === selectedId ? " selected" : "");
            div.dataset.id = entry.id;
            div.draggable = true;

            // 拖拽把手
            const handle = document.createElement("span");
            handle.className = "drag-handle";
            handle.textContent = "\u2804";  // ⠄ 小把手图标
            handle.title = "拖拽排序";
            div.appendChild(handle);

            const idSpan = document.createElement("span");
            idSpan.className = "list-item-id";
            idSpan.textContent = entry.id;

            const nameSpan = document.createElement("span");
            nameSpan.className = "list-item-name";
            nameSpan.textContent = entry.name || "(未命名)";

            const catSpan = document.createElement("span");
            catSpan.className = "list-item-category";
            catSpan.textContent = entry.category || "";

            div.appendChild(idSpan);
            div.appendChild(nameSpan);
            div.appendChild(catSpan);

            div.addEventListener("click", () => {
                if (onSelect) onSelect(entry.id);
            });

            frag.appendChild(div);
        });

        els.listBody.innerHTML = "";
        els.listBody.appendChild(frag);

        // 显示条数（含筛选信息）
        const total = DataStore.count();
        if (entries.length === total) {
            els.listCount.textContent = total + " 条";
        } else {
            els.listCount.textContent = entries.length + " / " + total + " 条";
        }
    }

    // ==========================================================================
    // 刷新视图（筛选 + 列表 + 选中状态维护）
    // ==========================================================================

    function refreshView() {
        const allEntries = DataStore.getAll();
        refreshFilters();
        const filtered = applyFilters(allEntries);
        renderList(filtered);

        // 如果当前选中项不在筛选结果中，自动跳到第一项
        if (selectedId !== null && !filtered.some(e => e.id === selectedId)) {
            if (filtered.length > 0 && onSelect) {
                onSelect(filtered[0].id);
            } else {
                clearEditor();
            }
        }
    }

    // ==========================================================================
    // 编辑器渲染
    // ==========================================================================

    function renderEditor(entry, categories) {
        if (!entry) {
            els.editorPanel.classList.add("hidden");
            els.emptyMsg.classList.remove("hidden");
            return;
        }

        els.editorPanel.classList.remove("hidden");
        els.emptyMsg.classList.add("hidden");

        els.fieldId.value = entry.id;
        els.fieldName.value = entry.name;
        els.fieldIcon.value = entry.iconIndex;
        els.fieldItypeId.value = entry.itypeId || 4;
        els.fieldCategory.value = entry.category || "";
        els.fieldGlossaryType.value = entry.glossaryType || "";
        els.fieldNote.value = entry.note || "";

        updateCategoryDatalist(categories);
        refreshSwitchChips();

        selectedId = entry.id;
        isDirty = false;
    }

    function updateCategoryDatalist(categories) {
        els.categoryList.innerHTML = "";
        categories.forEach(cat => {
            const opt = document.createElement("option");
            opt.value = cat;
            els.categoryList.appendChild(opt);
        });
    }

    // ==========================================================================
    // 读取表单
    // ==========================================================================

    function readFormData() {
        return {
            id:           parseInt(els.fieldId.value) || 0,
            name:         els.fieldName.value.trim(),
            iconIndex:    parseInt(els.fieldIcon.value) || 0,
            itypeId:      parseInt(els.fieldItypeId.value) || 4,
            category:     els.fieldCategory.value.trim(),
            glossaryType: els.fieldGlossaryType.value.trim(),
            note:         els.fieldNote.value
        };
    }

    function validateForm(data) {
        if (!data.id || data.id < 1) {
            setStatus("请输入有效的条目 ID", true);
            els.fieldId.focus();
            return false;
        }
        if (!data.name) {
            setStatus("条目名称不能为空", true);
            els.fieldName.focus();
            return false;
        }
        return true;
    }

    // ==========================================================================
    // 清空编辑器
    // ==========================================================================

    function clearEditor() {
        selectedId = null;
        isDirty = false;
        els.editorPanel.classList.add("hidden");
        els.emptyMsg.classList.remove("hidden");
        els.listBody.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
        els.listActions.classList.remove("hidden");
    }

    // ==========================================================================
    // 空状态
    // ==========================================================================

    function showEmptyState() {
        els.listBody.innerHTML =
            '<div class="list-empty">请先导入 GlossaryData.json</div>';
        els.listCount.textContent = "0 条";
        els.listActions.classList.remove("hidden");
        // 清空筛选
        els.filterCategory.innerHTML = '<option value="">分类：全部</option>';
        els.filterGlossaryType.innerHTML = '<option value="">词典id：全部</option>';
        clearEditor();
    }

    // ==========================================================================
    // 标签工具栏初始化
    // ==========================================================================

    function initTagToolbar() {
        els.tagSelect.innerHTML =
            '<option value="">— 选择标签插入 —</option>' +
            TagInserter.getOptionsHtml();

        const container = document.getElementById("tag-switches");
        if (container) {
            container.innerHTML = "";
            TagInserter.getSwitches().forEach(t => {
                const btn = document.createElement("button");
                btn.type = "button";
                btn.className = "tag-chip";
                btn.dataset.tag = t.tagName;
                btn.title = t.tooltip || "";
                btn.textContent = t.label;
                container.appendChild(btn);
            });
            els.tagChips = container.querySelectorAll(".tag-chip");
        }

        els.btnInsertTag.addEventListener("click", () => {
            const value = els.tagSelect.value;
            if (!value) { setStatus("请先选择一个标签", true); return; }
            if (TagInserter.insertFromDropdown(value)) {
                refreshSwitchChips();
                setStatus("标签已插入");
            }
        });

        document.getElementById("tag-toolbar").addEventListener("click", e => {
            const chip = e.target.closest(".tag-chip");
            if (!chip) return;
            TagInserter.toggleSwitch(chip.dataset.tag);
            refreshSwitchChips();
            setStatus("已切换 " + chip.dataset.tag);
        });
    }

    // ==========================================================================
    // 拖拽导入
    // ==========================================================================

    function setupDragAndDrop() {
        const overlay = els.dropOverlay;
        ["dragenter", "dragover", "dragleave", "drop"].forEach(evt => {
            document.addEventListener(evt, e => { e.preventDefault(); e.stopPropagation(); });
        });
        document.addEventListener("dragenter", e => {
            // 仅文件拖入时显示覆盖层，忽略内部元素拖拽
            if (e.dataTransfer.types && e.dataTransfer.types.includes("Files")) {
                overlay.classList.add("active");
            }
        });
        document.addEventListener("dragleave", e => {
            if (e.relatedTarget === null || e.relatedTarget === document.body) overlay.classList.remove("active");
        });
        document.addEventListener("drop", e => {
            overlay.classList.remove("active");
            if (e.dataTransfer.files.length > 0) handleFile(e.dataTransfer.files[0]);
        });

        els.importBtn.addEventListener("click", () => els.importInput.click());
        els.importInput.addEventListener("change", e => {
            if (e.target.files.length > 0) { handleFile(e.target.files[0]); e.target.value = ""; }
        });
    }

    function handleFile(file) {
        const name = file.name.toLowerCase();
        if (!name.endsWith(".json") && !name.endsWith(".txt")) {
            setStatus("请选择 JSON 文件", true); return;
        }
        const reader = new FileReader();
        reader.onload = e => {
            try { setStatus("成功导入 " + onImport(e.target.result) + " 条条目"); }
            catch (err) { setStatus("导入失败：" + err.message, true); }
        };
        reader.onerror = () => setStatus("文件读取失败", true);
        reader.readAsText(file, "UTF-8");
    }

    // ==========================================================================
    // 快捷键
    // ==========================================================================

    function setupKeyboardShortcuts() {
        document.addEventListener("keydown", e => {
            if ((e.ctrlKey || e.metaKey) && e.key === "s") {
                e.preventDefault();
                if (!els.btnSave.disabled) els.btnSave.click();
            }
        });
    }

    // ==========================================================================
    // 列表拖拽排序
    // ==========================================================================

    function setupListDragDrop() {
        const listBody = els.listBody;
        let draggedId = null;
        let dragFromHandle = false;

        // 用 mousedown 标记是否从把手发起（dragstart 的 target 始终是 draggable 父元素）
        listBody.addEventListener("mousedown", e => {
            dragFromHandle = !!e.target.closest(".drag-handle");
        });

        listBody.addEventListener("dragstart", e => {
            if (!dragFromHandle) {
                e.preventDefault();
                return;
            }
            const item = e.target.closest(".list-item");
            if (!item) return;
            draggedId = parseInt(item.dataset.id);
            item.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", String(draggedId));
        });

        listBody.addEventListener("dragend", () => {
            const dragItem = listBody.querySelector(".list-item.dragging");
            if (dragItem) dragItem.classList.remove("dragging");
            listBody.querySelectorAll(".drop-before, .drop-after").forEach(el =>
                el.classList.remove("drop-before", "drop-after"));
            draggedId = null;
            dragFromHandle = false;
        });

        listBody.addEventListener("dragover", e => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
            const item = e.target.closest(".list-item");
            if (!item || !draggedId || parseInt(item.dataset.id) === draggedId) return;

            // 清除其他项的指示器
            listBody.querySelectorAll(".drop-before, .drop-after").forEach(el => {
                if (el !== item) el.classList.remove("drop-before", "drop-after");
            });

            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            item.classList.remove("drop-before", "drop-after");
            item.classList.add(e.clientY < mid ? "drop-before" : "drop-after");
        });

        listBody.addEventListener("dragleave", e => {
            const item = e.target.closest(".list-item");
            if (item && !item.contains(e.relatedTarget)) {
                item.classList.remove("drop-before", "drop-after");
            }
        });

        listBody.addEventListener("drop", e => {
            e.preventDefault();
            const item = e.target.closest(".list-item");
            if (!item || !draggedId || parseInt(item.dataset.id) === draggedId) return;

            const targetId = parseInt(item.dataset.id);
            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const after = e.clientY >= mid;

            // 计算在完整 entries 数组中的目标索引
            const entries = DataStore.getAll();
            let targetIndex = entries.findIndex(en => en.id === targetId);
            if (targetIndex === -1) return;
            if (after) targetIndex++;

            // 拖拽前自动保存当前编辑内容（避免 ID 变更后数据丢失）
            if (isDirty && selectedId !== null) {
                const data = readFormData();
                if (data.id && data.id === selectedId) {
                    DataStore.update(selectedId, data);
                }
                isDirty = false;
            }

            // 移动 + 重新编号
            DataStore.moveEntry(draggedId, targetIndex);
            const oldToNew = DataStore.renumberAll(10001, 1);
            const newId = oldToNew.get(draggedId);

            // 清除拖拽状态
            listBody.querySelectorAll(".drop-before, .drop-after").forEach(el =>
                el.classList.remove("drop-before", "drop-after"));

            // 刷新视图并重新选中
            refreshView();
            if (newId !== undefined && onSelect) {
                onSelect(newId);
            }
            setStatus("已排序并重新编号");
        });
    }

    // ==========================================================================
    // 公开 API
    // ==========================================================================

    return {

        init(callbacks) {
            onImport = callbacks.onImport;
            onExport = callbacks.onExport;
            onSelect = callbacks.onSelect;
            onSave   = callbacks.onSave;
            onDelete = callbacks.onDelete;
            onNew    = callbacks.onNew;

            cacheElements();
            setupDragAndDrop();
            setupKeyboardShortcuts();
            setupListDragDrop();

            // 导出
            els.exportBtn.addEventListener("click", () => {
                try { downloadFile(onExport(), "GlossaryData.json", "application/json"); setStatus("导出成功"); }
                catch (err) { setStatus("导出失败：" + err.message, true); }
            });

            // 新建
            els.btnNew.addEventListener("click", () => { if (onNew) onNew(); });

            // 删除
            els.btnDelete.addEventListener("click", () => {
                if (!selectedId) { setStatus("请先选择一个条目", true); return; }
                if (!confirm("确定要删除条目 " + selectedId + " 吗？")) return;
                onDelete(selectedId);
                setStatus("已删除条目 " + selectedId);
            });

            // 保存
            els.btnSave.addEventListener("click", () => {
                const data = readFormData();
                if (!validateForm(data)) return;
                const result = onSave(selectedId, data);
                if (result === true) { setStatus("已保存"); isDirty = false; }
                else if (typeof result === "string") setStatus(result, true);
            });

            // 筛选变更事件
            els.filterCategory.addEventListener("change", () => refreshView());
            els.filterGlossaryType.addEventListener("change", () => refreshView());

            // 脏标记
            els.form.addEventListener("input", () => { isDirty = true; });

            initTagToolbar();
            showEmptyState();
        },

        /** 刷新列表 + 筛选 + 选中状态 */
        refreshList() {
            refreshView();
        },

        refreshEditor(entry, categories) {
            renderEditor(entry, categories);
        },

        selectItem(id) {
            selectedId = id;
            els.listBody.querySelectorAll(".selected").forEach(el => el.classList.remove("selected"));
            const item = els.listBody.querySelector(`[data-id="${id}"]`);
            if (item) item.classList.add("selected");
        },

        clearEditor() { clearEditor(); },
        showEmptyState() { showEmptyState(); },
        updateCategoryList(categories) { updateCategoryDatalist(categories); },
        getSelectedId() { return selectedId; },
        isDirty() { return isDirty; },
        setStatus(msg, isError) { setStatus(msg, isError); }
    };
})();

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}
