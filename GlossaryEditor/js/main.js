//=============================================================================
// main.js
// GlossaryData 编辑器 - 入口与协调层
//=============================================================================

(() => {
    "use strict";

    document.addEventListener("DOMContentLoaded", () => {

        UI.init({
            onImport(jsonText) {
                const count = DataStore.import(jsonText);
                UI.refreshList();
                const entries = DataStore.getAll();
                if (entries.length > 0) {
                    const entry = DataStore.getById(entries[0].id);
                    UI.refreshEditor(entry, DataStore.getCategories());
                    UI.selectItem(entry.id);
                } else {
                    UI.clearEditor();
                }
                return count;
            },

            onExport() {
                if (DataStore.count() === 0) {
                    throw new Error("没有数据可导出，请先导入 JSON 文件");
                }
                if (UI.isDirty()) {
                    const sid = UI.getSelectedId();
                    if (sid !== null) {
                        const formData = readCurrentFormData();
                        if (formData) DataStore.update(sid, formData);
                    }
                }
                return DataStore.export();
            },

            onSelect(id) {
                if (UI.isDirty()) {
                    const sid = UI.getSelectedId();
                    if (sid !== null) {
                        const formData = readCurrentFormData();
                        if (formData && formData.id !== id) {
                            DataStore.update(sid, formData);
                        }
                    }
                }
                const entry = DataStore.getById(id);
                if (entry) {
                    UI.refreshEditor(entry, DataStore.getCategories());
                    UI.selectItem(id);
                }
            },

            onSave(oldId, data) {
                if (data.id !== oldId && DataStore.isIdTaken(data.id)) {
                    return "ID " + data.id + " 已被占用，请使用其他 ID";
                }
                DataStore.update(oldId, data);
                UI.refreshList();
                UI.selectItem(data.id);
                UI.refreshEditor(DataStore.getById(data.id), DataStore.getCategories());
                return true;
            },

            onDelete(id) {
                DataStore.remove(id);
                UI.refreshList();
                const entries = DataStore.getAll();
                if (entries.length > 0) {
                    const first = entries[0];
                    UI.refreshEditor(DataStore.getById(first.id), DataStore.getCategories());
                    UI.selectItem(first.id);
                } else {
                    UI.clearEditor();
                }
            },

            onNew() {
                const nextId = DataStore.getNextId();
                const categories = DataStore.getCategories();

                // 弹窗输入词典id，防止忘记
                const existingTypes = DataStore.getGlossaryTypes();
                const defaultType = existingTypes.length > 0 ? existingTypes[0] : "";
                const glossaryType = prompt("请输入词典id (SGType)", defaultType);
                if (glossaryType === null) return; // 用户取消

                const emptyEntry = {
                    id: nextId, name: "", iconIndex: 0, itypeId: 4,
                    category: categories.length > 0 ? categories[0] : "",
                    glossaryType: glossaryType, note: "<SGDescription:>"
                };
                DataStore.add(emptyEntry);

                UI.refreshList();
                UI.selectItem(nextId);
                UI.refreshEditor(DataStore.getById(nextId), DataStore.getCategories());

                setTimeout(() => {
                    const nameInput = document.getElementById("field-name");
                    if (nameInput) nameInput.focus();
                }, 50);

                UI.setStatus("已创建新条目，请在右侧编辑");
            }
        });

        // 自动恢复 localStorage 中的数据
        const savedCount = DataStore.loadFromStorage();
        if (savedCount > 0) {
            UI.refreshList();
            const entries = DataStore.getAll();
            const entry = DataStore.getById(entries[0].id);
            UI.refreshEditor(entry, DataStore.getCategories());
            UI.selectItem(entry.id);
            UI.setStatus("已从本地存储恢复 " + savedCount + " 条数据");
        }
    });

    function readCurrentFormData() {
        const id = parseInt(document.getElementById("field-id").value) || 0;
        if (!id) return null;
        return {
            id, name: document.getElementById("field-name").value.trim(),
            iconIndex: parseInt(document.getElementById("field-icon").value) || 0,
            itypeId: parseInt(document.getElementById("field-itypeid").value) || 4,
            category: document.getElementById("field-category").value.trim(),
            glossaryType: document.getElementById("field-glossary-type").value.trim(),
            note: document.getElementById("field-note").value
        };
    }
})();
