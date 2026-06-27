/**
 * RMMZ Plugin Translation Editor - Application Logic
 */

const App = {
  parser: new RMMZParser(),
  blocks: [],
  items: [],
  translations: new Map(),
  fileName: '',
  currentFilter: 'all',
  currentSearch: '',
  selectedLang: '',
};

// ============== File Operations ==============

function loadFile(file) {
  App.fileName = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    const code = e.target.result;
    const result = App.parser.parse(code);
    App.blocks = result.blocks;
    App.items = result.items;
    App.translations = new Map();

    App.items.forEach(item => { App.translations.set(item.id, ''); });

    // Detect languages and set default
    App.selectedLang = getDefaultLanguage();
    updateLanguageSelect();
    updateUI();
    showStatus(`已加载: ${file.name} (${App.items.length} 个可翻译项)`);
  };
  reader.readAsText(file, 'UTF-8');
}

function loadTranslationState() {
  if (App.items.length === 0) { showStatus('请先加载一个插件文件', 'warning'); return; }
  const input = document.createElement('input');
  input.type = 'file'; input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const state = JSON.parse(e.target.result);
        const loadedTranslations = state.translations || {};
        let count = 0;
        App.items.forEach(item => {
          if (loadedTranslations[item.id] !== undefined) {
            App.translations.set(item.id, loadedTranslations[item.id]);
            item.translation = loadedTranslations[item.id]; count++;
          }
        });
        if (state.selectedLang !== undefined) App.selectedLang = state.selectedLang;
        updateLanguageSelect();
        updateUI();
        showStatus(`已载入翻译进度: ${count} 项`);
      } catch (err) { showStatus('载入失败: 无效的JSON文件', 'error'); }
    };
    reader.readAsText(file, 'UTF-8');
  };
  input.click();
}

function saveTranslationState() {
  if (App.items.length === 0) { showStatus('请先加载一个插件文件', 'warning'); return; }
  const state = {
    fileName: App.fileName,
    exportedAt: new Date().toISOString(),
    selectedLang: App.selectedLang,
    translations: {},
  };
  App.items.forEach(item => {
    const trans = App.translations.get(item.id) || '';
    if (trans.trim()) { state.translations[item.id] = trans; }
  });
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = App.fileName.replace(/\.js$/i, '') + '.translation.json';
  a.click();
  URL.revokeObjectURL(url);
  showStatus('翻译进度已保存');
}

function exportTranslated() {
  if (App.items.length === 0) { showStatus('请先加载一个插件文件', 'warning'); return; }
  const translations = new Map();
  App.items.forEach(item => {
    const block = App.blocks[item.blockIndex];
    // Only export translations matching the selected language (struct items always export)
    if (block.type === 'plugin' && block.lang !== App.selectedLang) return;
    const val = App.translations.get(item.id);
    if (val && val.trim()) { translations.set(item.id, val); }
  });
  // Only export selected language plugin block + all struct blocks
  const filteredBlocks = App.blocks.filter(block => block.type === "struct" || block.lang === App.selectedLang);
  const exported = App.parser.exportBlocks(filteredBlocks, translations);
  showExportPanel(exported);
  showStatus(`已导出翻译文本，共 ${translations.size} 项`);
}

function copyExportToClipboard() {
  const pre = document.querySelector('.export-panel pre');
  if (!pre) return;
  const text = pre.textContent;
  navigator.clipboard.writeText(text).then(() => showStatus('已复制到剪贴板'))
  .catch(() => {
    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(range);
    document.execCommand('copy');
    showStatus('已复制到剪贴板');
  });
}

function downloadExport() {
  const pre = document.querySelector('.export-panel pre');
  if (!pre) return;
  const text = pre.textContent;
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = App.fileName.replace(/\.js$/i, '') + '.translated.txt';
  a.click();
  URL.revokeObjectURL(url);
}

// ============== Language Selection ==============

/** Get the default language: untagged ("") if available, otherwise first available */
function getDefaultLanguage() {
  const pluginBlocks = App.blocks.filter(b => b.type === 'plugin');
  if (pluginBlocks.length === 0) return '';
  const untagged = pluginBlocks.find(b => !b.lang);
  if (untagged) return '';
  return pluginBlocks[0].lang;
}

function getAvailableLanguages() {
  const langs = [];
  const seen = new Set();
  App.blocks.forEach(block => {
    if (block.type === 'plugin' && !seen.has(block.lang)) {
      seen.add(block.lang);
      langs.push({ lang: block.lang, items: block.items.length });
    }
  });
  return langs;
}

function selectLanguage(lang) {
  App.selectedLang = lang;
  updateLanguageSelect();
  updateUI();
  showStatus(`已切换到: ${getLangLabel(lang)}`);
}

function updateLanguageSelect() {
  const langs = getAvailableLanguages();
  const group = document.getElementById('langGroup');
  const container = document.getElementById('langBtns');
  if (!group || !container) return;

  if (langs.length <= 1) {
    group.style.display = 'none';
    return;
  }

  group.style.display = 'flex';
  let html = '';
  langs.forEach(({ lang, items }) => {
    const active = lang === App.selectedLang ? ' active' : '';
    const label = getLangLabel(lang);
    html += `<button class="lang-btn${active}" data-lang="${lang}" onclick="selectLanguage('${lang}')">${label} (${items} 项)</button>`;
  });
  container.innerHTML = html;
}

function getLangLabel(lang) {
  if (!lang) return '默认 (English)';
  const map = { ja: '日本語', en: 'English', zh: '中文(简体)', 'zh-CN': '中文(简体)', 'zh-TW': '中文(繁體)' };
  return map[lang] || lang;
}

/** Filter items to show only those matching selected language (+ structs always visible) */
function filterItemsByLanguage(items) {
  return items.filter(item => {
    const block = App.blocks[item.blockIndex];
    if (block.type === 'struct') return true;
    return block.lang === App.selectedLang;
  });
}

// ============== UI Rendering ==============

function updateUI() {
  const container = document.getElementById('itemsContainer');
  const emptyState = document.getElementById('emptyState');

  if (App.items.length === 0) {
    emptyState.style.display = 'flex';
    container.innerHTML = '';
    document.getElementById('toolbar').style.display = 'none';
    updateProgress();
    return;
  }

  emptyState.style.display = 'none';
  document.getElementById('toolbar').style.display = 'flex';

  // Filter by active language
  const langItems = filterItemsByLanguage(App.items);
  if (langItems.length === 0) {
    container.innerHTML = `<div class="empty-state" style="display:flex;">
      <p>当前语言「${getLangLabel(App.selectedLang)}」没有可翻译的项</p>
    </div>`;
    updateProgress();
    return;
  }

  const groups = groupItems(langItems);
  let html = '';

  for (const [groupName, groupItems] of Object.entries(groups)) {
    const visibleItems = groupItems.filter(i => shouldShowItem(i));
    if (visibleItems.length === 0) continue;

    const translated = visibleItems.filter(i => (App.translations.get(i.id) || '').trim());
    const encName = escapeHtml(groupName).replace(/\s+/g, '-');

    html += `<div class="group" data-group="${encName}">
      <div class="group-header" onclick="toggleGroup(this)">
        <span class="collapse-icon">▼</span>
        <span>${escapeHtml(groupName)}</span>
        <span class="group-count">${translated.length}/${visibleItems.length}</span>
      </div>`;

    for (const item of visibleItems) {
      const trans = App.translations.get(item.id) || '';
      const isTranslated = trans.trim() !== '';
      const badgeClass = `badge-${item.type}`;

      const isHiddenValue = item.type === 'value';
      if (isHiddenValue) {
        html += `<div class="item-row hidden-value" data-id="${item.id}">
        <div class="source-cell">
          <span class="item-type-badge ${badgeClass}">${escapeHtml(item.groupLabel)}</span>
          <div class="source-text">${escapeHtml(item.original)}</div>
        </div>
        <div class="trans-cell">
          <span class="value-display">${escapeHtml(item.original)}</span>
        </div>
      </div>`;
      } else {
        html += `<div class="item-row ${isTranslated ? 'translated' : ''}" data-id="${item.id}">
        <div class="source-cell">
          <span class="item-type-badge ${badgeClass}">${escapeHtml(item.groupLabel)}</span>
          <div class="source-text">${escapeHtml(item.original)}</div>
        </div>
        <div class="trans-cell">
          <textarea rows="${Math.min(Math.max(item.original.split('\n').length, 1), 8)}"
            data-id="${item.id}" placeholder="在此输入翻译..."
            oninput="onTranslationChange(this)">${escapeHtml(trans)}</textarea>
        </div>
      </div>`;
      }
    }
    html += '</div>';
  }

  container.innerHTML = html;

  App.items.forEach(item => {
    const ta = container.querySelector(`textarea[data-id="${item.id}"]`);
    if (ta) ta.value = App.translations.get(item.id) || '';
  });

  updateProgress();
  updateFilterCounts();
}

function groupItems(items) {
  const groups = {};
  const blocks = App.blocks;

  const infoItems = items.filter(i => i.type === 'plugindesc' || i.type === 'author');
  if (infoItems.length > 0) groups['插件信息'] = infoItems;

  const helpItems = items.filter(i => i.type === 'help');
  if (helpItems.length > 0) groups['帮助文本 (@help)'] = helpItems;

  const remaining = items.filter(i => i.type !== 'plugindesc' && i.type !== 'author' && i.type !== 'help');
  const ctxMap = {};

  remaining.forEach(item => {
    const block = blocks[item.blockIndex];
    const ctx = item.context || '';
    let key, label;

    if (block.type === 'struct') {
      const clean = ctx.replace(/^(param|command|arg):\s*/, '');
      key = `struct|${block.name}|${ctx || '__main__'}`;
      label = `${clean || block.name} [结构体: ${block.name}]`;
    } else {
      key = `plugin|${ctx || '__noctx__'}`;
      if (ctx.startsWith('param: ')) label = ctx.substring(7);
      else if (ctx.startsWith('command: ')) label = '命令: ' + ctx.substring(9);
      else if (ctx.startsWith('arg: ')) label = '参数: ' + ctx.substring(5);
      else if (ctx === '') label = '其他';
      else label = ctx;
    }
    if (!ctxMap[key]) ctxMap[key] = { label, items: [] };
    ctxMap[key].items.push(item);
  });

  const sortedKeys = Object.keys(ctxMap).sort((a, b) => {
    const posA = getEarliestPos(ctxMap[a].items);
    const posB = getEarliestPos(ctxMap[b].items);
    return (posA.blockIndex * 100000 + posA.linePos) - (posB.blockIndex * 100000 + posB.linePos);
  });

  for (const key of sortedKeys) {
    const { label, items: gItems } = ctxMap[key];
    gItems.sort((a, b) => {
      return (a.isMultiLine ? a.lineRange[0] : a.lineIndex) - (b.isMultiLine ? b.lineRange[0] : b.lineIndex);
    });
    groups[label] = gItems;
  }
  return groups;
}

function getEarliestPos(items) {
  let minBi = Infinity, minPos = Infinity;
  for (const item of items) {
    const bi = item.blockIndex;
    const pos = item.isMultiLine ? item.lineRange[0] : item.lineIndex;
    if (bi < minBi || (bi === minBi && pos < minPos)) { minBi = bi; minPos = pos; }
  }
  return { blockIndex: minBi, linePos: minPos };
}

function shouldShowItem(item) {
  const trans = App.translations.get(item.id) || '';
  const isTranslated = trans.trim() !== '';
  if (App.currentFilter === 'untranslated' && isTranslated) return false;
  if (App.currentFilter === 'translated' && !isTranslated) return false;
  if (App.currentSearch) {
    const q = App.currentSearch.toLowerCase();
    const matches = item.original.toLowerCase().includes(q) || (App.translations.get(item.id) || '').toLowerCase().includes(q);
    if (!matches) return false;
  }
  return true;
}

function updateProgress() {
  const total = App.items.length;
  const translated = App.items.filter(i => (App.translations.get(i.id) || '').trim()).length;
  const pct = total > 0 ? Math.round(translated / total * 100) : 0;
  document.getElementById('progressText').textContent = `${translated}/${total}`;
  document.getElementById('progressFill').style.width = `${pct}%`;
  document.getElementById('fileNameDisplay').textContent = App.fileName || '(未加载)';
}

function updateFilterCounts() {
  const total = App.items.length;
  const translated = App.items.filter(i => (App.translations.get(i.id) || '').trim()).length;
  const allBtn = document.querySelector('.filter-btn[data-filter="all"]');
  const transBtn = document.querySelector('.filter-btn[data-filter="translated"]');
  const untransBtn = document.querySelector('.filter-btn[data-filter="untranslated"]');
  if (allBtn) allBtn.querySelector('.count').textContent = total;
  if (transBtn) transBtn.querySelector('.count').textContent = translated;
  if (untransBtn) untransBtn.querySelector('.count').textContent = total - translated;
}

function showStatus(msg, type = 'info') {
  const el = document.getElementById('statusMessage');
  el.textContent = msg;
  el.style.color = type === 'error' ? 'var(--danger)' : type === 'warning' ? 'var(--warning)' : 'inherit';
  clearTimeout(el._timeout);
  el._timeout = setTimeout(() => { if (el.textContent === msg) el.textContent = ''; }, 4000);
}

// ============== Event Handlers ==============

function onTranslationChange(textarea) {
  const id = textarea.dataset.id;
  App.translations.set(id, textarea.value);
  const item = App.items.find(i => i.id === id);
  if (item) item.translation = textarea.value;
  const row = textarea.closest('.item-row');
  if (textarea.value.trim()) row.classList.add('translated');
  else row.classList.remove('translated');
  updateProgress();
  updateFilterCounts();
}

function triggerLoad() { document.getElementById('fileInput').click(); }
function onFileSelected(e) { const file = e.target.files[0]; if (file) loadFile(file); }

function setFilter(filter) {
  App.currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.filter === filter));
  updateUI();
}

function onSearch(e) { App.currentSearch = e.target.value; updateUI(); }

function toggleGroup(header) { header.closest('.group').classList.toggle('collapsed'); }

function showExportPanel(text) {
  const panel = document.getElementById('exportPanel');
  panel.querySelector('pre').textContent = text;
  panel.classList.add('visible');
  panel.querySelector('pre').scrollTop = 0;
}

function hideExportPanel() { document.getElementById('exportPanel').classList.remove('visible'); }

function onDragOver(e) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }

function onDrop(e) {
  e.preventDefault();
  const file = e.dataTransfer.files[0];
  if (file && file.name.endsWith('.js')) loadFile(file);
  else showStatus('请拖入 .js 格式的RMMZ插件文件', 'warning');
}

// ============== Utility ==============

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============== Init ==============

document.addEventListener('DOMContentLoaded', () => {
  updateUI();
  document.addEventListener('dragover', onDragOver);
  document.addEventListener('drop', onDrop);
});
