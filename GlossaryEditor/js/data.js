//=============================================================================
// data.js
// GlossaryData 编辑器 - 数据管理层
//=============================================================================

const DataStore = (() => {
    "use strict";

    let entries = [];

    // ==========================================================================
    // 工具函数
    // ==========================================================================

    function extractMetaTags(note) {
        let category = "";
        let glossaryType = "";
        let cleanNote = note;

        const catRegex = /<SGCategory:([^>]+)>|<SGカテゴリ:([^>]+)>/;
        const catMatch = note.match(catRegex);
        if (catMatch) {
            category = catMatch[1] || catMatch[2] || "";
            cleanNote = note
                .replace(/\n?<SGCategory:[^>]+>\n?/g, "\n")
                .replace(/\n?<SGカテゴリ:[^>]+>\n?/g, "\n");
        }

        const typeRegex = /<SGType:([^>]+)>/i;
        const typeMatch = cleanNote.match(typeRegex);
        if (typeMatch) {
            glossaryType = typeMatch[1];
            cleanNote = cleanNote.replace(/\n?<SGType:[^>]+>\n?/gi, "\n");
        }

        cleanNote = cleanNote.replace(/\n{3,}/g, "\n\n").trim();
        return { category, glossaryType, cleanNote };
    }

    function injectMetaTags(note, category, glossaryType) {
        let result = note || "";
        result = result
            .replace(/<SGCategory:[^>]*>/gi, "")
            .replace(/<SGカテゴリ:[^>]*>/gi, "")
            .replace(/<SGType:[^>]*>/gi, "")
            .trim();
        let suffix = "";
        if (category) {
            suffix += "<SGCategory:" + category + ">";
        }
        if (glossaryType) {
            suffix += "<SGType:" + glossaryType + ">";
        }
        if (suffix) {
            result += "\n" + suffix;
        }
        return result;
    }

    // ==========================================================================
    // 公开 API
    // ==========================================================================

    return {

        import(jsonText) {
            const raw = JSON.parse(jsonText);
            if (!Array.isArray(raw)) {
                throw new Error("JSON 文件内容必须是一个数组");
            }

            entries = raw.map((item, index) => {
                if (typeof item !== "object" || item === null) {
                    throw new Error("第 " + (index + 1) + " 项不是有效的对象");
                }
                const note = String(item.note || "");
                const { category, glossaryType, cleanNote } = extractMetaTags(note);

                return {
                    id: Number(item.id) || (10001 + index),
                    name: String(item.name || ""),
                    iconIndex: Number(item.iconIndex) || 0,
                    itypeId: Number(item.itypeId) || 4,
                    note: cleanNote,
                    category: category,
                    glossaryType: glossaryType
                };
            });

            entries.sort((a, b) => a.id - b.id);
            return entries.length;
        },

        export() {
            const output = entries.map(entry => {
                const note = injectMetaTags(entry.note, entry.category, entry.glossaryType);
                return {
                    id: entry.id,
                    name: entry.name,
                    iconIndex: entry.iconIndex,
                    itypeId: 4,
                    note: note
                };
            });
            return JSON.stringify(output, null, 2) + "\n";
        },

        getAll() {
            return entries.map(e => ({ ...e }));
        },

        getById(id) {
            const found = entries.find(e => e.id === id);
            return found ? { ...found } : null;
        },

        getCategories() {
            const cats = new Set(entries.map(e => e.category).filter(Boolean));
            return [...cats].sort((a, b) => a.localeCompare(b, "zh-CN"));
        },

        getGlossaryTypes() {
            const types = new Set(entries.map(e => String(e.glossaryType)).filter(Boolean));
            return [...types].sort((a, b) => parseInt(a) - parseInt(b) || a.localeCompare(b));
        },

        getNextId() {
            if (entries.length === 0) return 10001;
            return Math.max(...entries.map(e => e.id)) + 1;
        },

        isIdTaken(id) {
            return entries.some(e => e.id === id);
        },

        add(entry) {
            entries.push({ ...entry });
            entries.sort((a, b) => a.id - b.id);
        },

        update(oldId, data) {
            const idx = entries.findIndex(e => e.id === oldId);
            if (idx === -1) return false;
            entries[idx] = { ...entries[idx], ...data };
            entries.sort((a, b) => a.id - b.id);
            return true;
        },

        remove(id) {
            const len = entries.length;
            entries = entries.filter(e => e.id !== id);
            return entries.length !== len;
        },

        count() {
            return entries.length;
        }
    };
})();
