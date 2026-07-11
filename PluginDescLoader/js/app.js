// ═══════════════════════════════════════════════════════════════════════════
//  App — Main Controller & State Management
// ═══════════════════════════════════════════════════════════════════════════

const App = {
  // ─── State ───────────────────────────────────────────────────────────
  parser: new RMMZParser(),
  blocks: [],
  items: [],
  translations: new Map(),   // item.id → translated text
  fileName: '',
  selectedLang: '',          // currently displayed language
  mainLang: '',              // primary editing language (only this is editable)
  currentSearch: '',
  currentFilter: 'all',      // 'all' | 'untranslated' | 'translated'
  expandedKeys: new Set(),   // tagKeys that are expanded
  expandedSections: new Set(['editor-info', 'editor-help', 'editor-params', 'editor-commands', 'editor-structs']),
  scrollTarget: null,        // tagKey to scroll to in right panel

  // ─── Helpers ─────────────────────────────────────────────────────────

  isMainEditingLang() {
    return App.selectedLang === App.mainLang;
  },

  isReferenceMode() {
    return !App.isMainEditingLang();
  },

  // ─── File Operations ─────────────────────────────────────────────────

  loadFile(file) {
    App.fileName = file.name;
    const reader = new FileReader();
    reader.onload = (e) => {
      let code = e.target.result;
      if (code.charCodeAt(0) === 0xFEFF) code = code.slice(1);

      const result = App.parser.parse(code);
      App.blocks = result.blocks;
      App.items = result.items;
      App.translations = new Map();
      App.items.forEach(item => { App.translations.set(item.id, ''); });

      App._resetExpanded();

      // Handle language selection
      const langs = App.getAvailableLanguages();
      if (langs.length <= 1) {
        App.mainLang = langs.length === 1 ? langs[0].lang : '';
        App.selectedLang = App.mainLang;
        App._completeLoad(file.name);
      } else {
        App._showLanguageModal();
      }
    };
    reader.readAsText(file, 'UTF-8');
  },

  _completeLoad(name) {
    App._updateLanguageSelect();
    App._updateUI();
    App._showStatus(`已加载: ${name} (${App.items.length} 个可翻译项)`);
  },

  triggerLoad() {
    document.getElementById('fileInput').click();
  },

  onFileSelected(e) {
    const file = e.target.files[0];
    if (file) App.loadFile(file);
  },

  // ─── Language Selection Modal ───────────────────────────────────────

  _showLanguageModal() {
    const langs = App.getAvailableLanguages();
    const modal = document.getElementById('langModal');
    const list = document.getElementById('langModalList');
    if (!modal || !list) return;

    list.innerHTML = langs.map(({ lang, count }) =>
      `<button class="lang-option" data-lang="${lang}" onclick="App._confirmMainLang('${lang}')">
        <span class="lang-option-label">${getLangLabel(lang)}</span>
        <span class="lang-option-desc">${lang ? `语言代码: ${lang}` : '默认（无语言代码）'}</span>
        <span class="lang-option-count">${count} 个可翻译项</span>
      </button>`
    ).join('');
    modal.classList.add('visible');
  },

  _confirmMainLang(lang) {
    App.mainLang = lang;
    App.selectedLang = lang;
    document.getElementById('langModal').classList.remove('visible');
    App._completeLoad(App.fileName);
  },

  // ─── Language ───────────────────────────────────────────────────────

  getAvailableLanguages() {
    const langs = [];
    const seen = new Set();
    App.blocks.forEach(block => {
      if (block.type === 'plugin' && !seen.has(block.lang)) {
        seen.add(block.lang);
        langs.push({ lang: block.lang, count: block.items.length });
      }
    });
    langs.sort((a, b) => {
      if (a.lang === '') return -1;
      if (b.lang === '') return 1;
      return a.lang.localeCompare(b.lang);
    });
    return langs;
  },

  selectLanguage(lang) {
    App.selectedLang = lang;
    App._updateLanguageSelect();
    App._updateUI();
    if (App.isReferenceMode()) {
      App._showStatus(`📖 参考模式: ${getLangLabel(lang)}（只读）`);
    } else {
      App._showStatus(`✏️ 编辑模式: ${getLangLabel(lang)}`);
    }
  },

  _updateLanguageSelect() {
    const langs = App.getAvailableLanguages();
    const group = document.getElementById('langGroup');
    if (!group) return;

    if (langs.length <= 1) {
      group.innerHTML = '';
      return;
    }

    group.innerHTML = langs.map(({ lang, count }) => {
      const active = lang === App.selectedLang ? ' active' : '';
      const isMain = lang === App.mainLang ? ' is-main' : '';
      const label = lang === App.mainLang ? `✏️ ${getLangLabel(lang)}` : `📖 ${getLangLabel(lang)}`;
      return `<button class="lang-btn${active}${isMain}" data-lang="${escapeHtml(lang)}"
                      onclick="App.selectLanguage('${escapeHtml(lang)}')"
                      title="${isMain ? '主语言（可编辑）' : '参考语言（只读）'}">
        ${label} <span class="lang-count">${count}</span>
      </button>`;
    }).join('');
  },

  /** Find the corresponding item from the main language for reference. */
  getReferenceItem(item) {
    const currBlock = App.blocks[item.blockIndex];
    const refBlock = App.blocks.find(b =>
      b.type === currBlock.type &&
      b.name === currBlock.name &&
      b.lang === App.mainLang
    );
    if (!refBlock) return null;
    return refBlock.items.find(ri =>
      ri.type === item.type &&
      ri.tagKey === item.tagKey &&
      ri.context === item.context
    );
  },

  /** Find the main language text for a given item (for reference display). */
  getMainLangText(item) {
    const refItem = App.getReferenceItem(item);
    return refItem ? refItem.original : null;
  },

  // ─── Filtering ──────────────────────────────────────────────────────

  filterItemsByLanguage(items) {
    return items.filter(item => {
      const block = App.blocks[item.blockIndex];
      if (block.type === 'struct') return true;
      return block.lang === App.selectedLang;
    });
  },

  shouldShowItem(item) {
    const trans = App.translations.get(item.id) || '';
    const isTranslated = trans.trim() !== '';

    if (App.currentFilter === 'untranslated' && isTranslated) return false;
    if (App.currentFilter === 'translated' && !isTranslated) return false;

    if (App.currentSearch) {
      const q = App.currentSearch.toLowerCase();
      const matchesOriginal = item.original.toLowerCase().includes(q);
      const matchesTranslation = (App.translations.get(item.id) || '').toLowerCase().includes(q);
      if (!matchesOriginal && !matchesTranslation) return false;
    }

    return true;
  },

  setFilter(filter) {
    App.currentFilter = filter;
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.filter === filter);
    });
    App._updateUI();
  },

  onSearch(e) {
    App.currentSearch = e.target.value;
    App._updateUI();
  },

  // ─── Translation ───────────────────────────────────────────────────

  onTranslationChange(textarea) {
    const id = textarea.dataset.itemId;
    App.translations.set(id, textarea.value);

    const row = textarea.closest('.editor-row');
    if (row) {
      row.classList.toggle('translated', textarea.value.trim() !== '');
    }

    App._updateProgress();
    App._updateFilterCounts();
    LeftPanel.render();
  },

  // ─── Expand/Collapse ────────────────────────────────────────────────

  isExpanded(key) {
    return App.expandedKeys.has(key);
  },

  toggleExpanded(key) {
    if (App.expandedKeys.has(key)) {
      App.expandedKeys.delete(key);
    } else {
      App.expandedKeys.add(key);
    }
  },

  isSectionExpanded(id) {
    return App.expandedSections.has(id);
  },

  toggleSectionExpanded(id) {
    if (App.expandedSections.has(id)) {
      App.expandedSections.delete(id);
    } else {
      App.expandedSections.add(id);
    }
  },

  _resetExpanded() {
    App.expandedKeys = new Set();
    App.expandedSections = new Set(['editor-info', 'editor-help', 'editor-params', 'editor-commands', 'editor-structs']);
  },

  // ─── UI Update ─────────────────────────────────────────────────────

  _updateUI() {
    LeftPanel.render();
    RightPanel.render();
    App._updateProgress();
    App._updateFilterCounts();

    const emptyState = document.getElementById('emptyState');
    const dualPanel = document.getElementById('dualPanel');
    const toolbar = document.getElementById('toolbar');

    if (App.items.length === 0) {
      emptyState.style.display = 'flex';
      dualPanel.style.display = 'none';
      toolbar.classList.add('hidden');
    } else {
      emptyState.style.display = 'none';
      dualPanel.style.display = 'flex';
      toolbar.classList.remove('hidden');
    }
  },

  // ─── Progress & Stats ─────────────────────────────────────────────

  _updateProgress() {
    const total = App.items.length;
    const translated = App.items.filter(i => (App.translations.get(i.id) || '').trim()).length;
    const pct = total > 0 ? Math.round(translated / total * 100) : 0;

    document.getElementById('progressText').textContent = `${translated}/${total}`;
    document.getElementById('progressFill').style.width = `${pct}%`;
    document.getElementById('fileNameDisplay').textContent = App.fileName || '(未加载)';
  },

  _updateFilterCounts() {
    const total = App.items.length;
    const translated = App.items.filter(i => (App.translations.get(i.id) || '').trim()).length;

    document.querySelectorAll('.filter-btn').forEach(btn => {
      const filter = btn.dataset.filter;
      let count = total;
      if (filter === 'translated') count = translated;
      else if (filter === 'untranslated') count = total - translated;
      const span = btn.querySelector('.count');
      if (span) span.textContent = count;
    });
  },

  // ─── Export (always uses mainLang) ─────────────────────────────────

  exportTranslated() {
    if (App.items.length === 0) {
      App._showStatus('请先加载一个插件文件', 'warning');
      return;
    }

    const translations = new Map();
    App.items.forEach(item => {
      const block = App.blocks[item.blockIndex];
      // Only export translations for the main language
      if (block.type === 'plugin' && block.lang !== App.mainLang) return;
      const val = App.translations.get(item.id);
      if (val && val.trim()) translations.set(item.id, val);
    });

    const filteredBlocks = App.blocks.filter(block =>
      block.type === 'struct' || block.lang === App.mainLang
    );

    const exported = App.parser.exportBlocks(filteredBlocks, translations);
    App._showExportPanel(exported);
    App._showStatus(`已导出翻译文本（主语言: ${getLangLabel(App.mainLang)}），共 ${translations.size} 项`);
  },

  copyExportToClipboard() {
    const pre = document.getElementById('exportContent');
    if (!pre) return;
    const text = pre.textContent;

    navigator.clipboard.writeText(text).then(() => {
      App._showStatus('已复制到剪贴板');
    }).catch(() => {
      const range = document.createRange();
      range.selectNodeContents(pre);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
      document.execCommand('copy');
      App._showStatus('已复制到剪贴板');
    });
  },

  downloadExport() {
    const pre = document.getElementById('exportContent');
    if (!pre) return;
    const text = pre.textContent;
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (App.fileName || 'plugin').replace(/\.js$/i, '') + '.translated.txt';
    a.click();
    URL.revokeObjectURL(url);
  },

  _showExportPanel(text) {
    const panel = document.getElementById('exportPanel');
    const pre = document.getElementById('exportContent');
    pre.textContent = text;
    panel.classList.add('visible');
    pre.scrollTop = 0;
  },

  hideExportPanel() {
    document.getElementById('exportPanel').classList.remove('visible');
  },

  // ─── Save / Load Translation State ─────────────────────────────────

  saveTranslationState() {
    if (App.items.length === 0) {
      App._showStatus('请先加载一个插件文件', 'warning');
      return;
    }

    const state = {
      fileName: App.fileName,
      exportedAt: new Date().toISOString(),
      mainLang: App.mainLang,
      selectedLang: App.selectedLang,
      translations: {},
    };

    App.items.forEach(item => {
      const trans = App.translations.get(item.id) || '';
      if (trans.trim()) {
        state.translations[item.id] = trans;
      }
    });

    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (App.fileName || 'plugin').replace(/\.js$/i, '') + '.translation.json';
    a.click();
    URL.revokeObjectURL(url);
    App._showStatus('翻译进度已保存');
  },

  loadTranslationState() {
    if (App.items.length === 0) {
      App._showStatus('请先加载一个插件文件', 'warning');
      return;
    }

    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const state = JSON.parse(e.target.result);
          const loadedTranslations = state.translations || {};
          let count = 0;

          App.items.forEach(item => {
            if (loadedTranslations[item.id] !== undefined) {
              App.translations.set(item.id, loadedTranslations[item.id]);
              count++;
            }
          });

          if (state.mainLang !== undefined) App.mainLang = state.mainLang;
          if (state.selectedLang !== undefined) App.selectedLang = state.selectedLang;

          App._resetExpanded();
          App._updateUI();
          App._showStatus(`已载入翻译进度: ${count} 项`);
        } catch (err) {
          App._showStatus('载入失败: 无效的 JSON 文件', 'error');
        }
      };
      reader.readAsText(file, 'UTF-8');
    };
    input.click();
  },

  // ─── Status Messages ────────────────────────────────────────────────

  _showStatus(msg, type) {
    const el = document.getElementById('statusMessage');
    el.textContent = msg;
    el.className = 'status-msg' + (type ? ' ' + type : '');
    clearTimeout(el._timeout);
    if (!type) {
      el._timeout = setTimeout(() => {
        if (el.textContent === msg) el.textContent = '';
      }, 4000);
    }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  App._updateUI();

  // ├─ Panel divider drag ├─
  const divider = document.getElementById("panelDivider");
  const leftPanel = document.getElementById("panelLeft");
  let _isDragging = false;

  if (divider) {
    divider.addEventListener("mousedown", (e) => {
      _isDragging = true;
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      e.preventDefault();
    });
  }

  document.addEventListener("mousemove", (e) => {
    if (!_isDragging) return;
    const container = document.querySelector(".dual-panel");
    const rect = container.getBoundingClientRect();
    const pct = ((e.clientX - rect.left) / rect.width) * 100;
    leftPanel.style.width = Math.max(15, Math.min(55, pct)) + "%";
    leftPanel.style.minWidth = "0";
    leftPanel.style.maxWidth = "none";
  });

  document.addEventListener("mouseup", () => {
    if (_isDragging) {
      _isDragging = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }
  });


  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.js')) {
      App.loadFile(file);
    } else {
      App._showStatus('请拖入 .js 格式的 RMMZ 插件文件', 'warning');
    }
  });
});
