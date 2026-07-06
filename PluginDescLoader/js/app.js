/**
 * PluginDescLoader — Application Logic
 * RPG Maker MZ 插件注释翻译工具
 */

// ═══════════════════════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════════════════════

const App = {
  parser: new RMMZParser(),
  blocks: [],
  items: [],
  translations: new Map(),   // item.id → translated text
  fileName: '',
  currentFilter: 'all',       // 'all' | 'untranslated' | 'translated'
  currentSearch: '',
  selectedLang: '',
};

// ═══════════════════════════════════════════════════════════════════
//  File Operations
// ═══════════════════════════════════════════════════════════════════

function loadFile(file) {
  App.fileName = file.name;
  const reader = new FileReader();
  reader.onload = (e) => {
    let code = e.target.result;
    // Strip BOM if present
    if (code.charCodeAt(0) === 0xFEFF) code = code.slice(1);

    const result = App.parser.parse(code);
    App.blocks = result.blocks;
    App.items = result.items;
    App.translations = new Map();
    App.items.forEach(item => { App.translations.set(item.id, ''); });

    App.selectedLang = getDefaultLanguage();
    updateLanguageSelect();
    updateUI();
    showStatus(`已加载: ${file.name} (${App.items.length} 个可翻译项)`);
  };
  reader.readAsText(file, 'UTF-8');
}

function triggerLoad() {
  document.getElementById('fileInput').click();
}

function onFileSelected(e) {
  const file = e.target.files[0];
  if (file) loadFile(file);
}

// ═══════════════════════════════════════════════════════════════════
//  Language
// ═══════════════════════════════════════════════════════════════════

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
      langs.push({ lang: block.lang, count: block.items.length });
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
  if (!group) return;

  if (langs.length <= 1) {
    group.innerHTML = '';
    return;
  }

  let html = '';
  langs.forEach(({ lang, count }) => {
    const active = lang === App.selectedLang ? ' active' : '';
    html += `<button class="lang-btn${active}" data-lang="${lang}" onclick="selectLanguage('${lang}')">${getLangLabel(lang)}</button>`;
  });
  group.innerHTML = html;
}

function getLangLabel(lang) {
  if (!lang) return '默认';
  const map = { ja: '日本語', en: 'English', zh: '中文', 'zh-CN': '中文', 'zh-TW': '繁體' };
  return map[lang] || lang;
}

/** Find a block with the same index but different language (for reference display). */
function getReferenceBlock(currentBlockIndex) {
  const currentBlock = App.blocks[currentBlockIndex];
  if (!currentBlock) return null;
  // Find the default-language block (lang='') of the same type and name
  return App.blocks.find(b =>
    b.type === currentBlock.type &&
    b.name === currentBlock.name &&
    b.lang === '' &&
    b !== currentBlock
  );
}

/** Get the reference (default-language) item corresponding to an item. */
function getReferenceItem(item) {
  const refBlock = getReferenceBlock(item.blockIndex);
  if (!refBlock) return null;
  // Match by type + lineIndex (for non-synthetic) or type + context (for synthetic)
  return refBlock.items.find(ri =>
    ri.type === item.type &&
    ri.tagKey === item.tagKey &&
    ri.context === item.context
  );
}

// ═══════════════════════════════════════════════════════════════════
//  UI Rendering
// ═══════════════════════════════════════════════════════════════════

function updateUI() {
  const container = document.getElementById('itemsContainer');
  const emptyState = document.getElementById('emptyState');
  const toolbar = document.getElementById('toolbar');
  const mainContent = document.getElementById('mainContent');

  if (App.items.length === 0) {
    emptyState.style.display = 'flex';
    container.style.display = 'none';
    toolbar.classList.add('hidden');
    updateProgress();
    return;
  }

  emptyState.style.display = 'none';
  container.style.display = 'block';
  toolbar.classList.remove('hidden');

  // Filter by selected language
  const langItems = filterItemsByLanguage(App.items);
  if (langItems.length === 0) {
    container.innerHTML = `<div class="empty-state" style="display:flex;height:200px;">
      <p>当前语言「${getLangLabel(App.selectedLang)}」没有可翻译的项</p>
    </div>`;
    updateProgress();
    return;
  }

  // Build groups
  const groups = buildGroups(langItems);
  let html = '';

  for (const group of groups) {
    const visibleItems = group.items.filter(i => shouldShowItem(i));
    if (visibleItems.length === 0 && group.children.length === 0) continue;

    const translatedCount = countTranslated(visibleItems);
    const totalCount = visibleItems.length;
    const collapsible = totalCount > 1 || group.children.length > 0;

    html += `<div class="group" data-group="${escapeHtml(group.key)}">`;
    html += `<div class="group-header" onclick="toggleGroup(this)">
      <span class="collapse-arrow">${collapsible ? '▼' : ''}</span>
      <span class="group-title">${escapeHtml(group.label)}</span>
      ${group.badge ? `<span class="group-badge">${escapeHtml(group.badge)}</span>` : ''}
      <span class="group-count">${translatedCount}/${totalCount}</span>
    </div>`;

    // Render tree
    html += renderTreeNodes(group.children, visibleItems, group.treeLevel || 0);
    html += '</div>';
  }

  container.innerHTML = html;
  updateProgress();
  updateFilterCounts();
  updateStatusMessage();
}

// ═══════════════════════════════════════════════════════════════════
//  Tree Building
// ═══════════════════════════════════════════════════════════════════

/**
 * Build a hierarchical group structure from items.
 * Returns an array of group objects with nested children.
 */
function buildGroups(langItems) {
  const groups = [];

  // 1. Plugin info (plugindesc, author)
  const infoItems = langItems.filter(i => i.type === 'plugindesc' || i.type === 'author');
  if (infoItems.length > 0) {
    groups.push({
      key: '_info',
      label: '插件信息',
      badge: '',
      treeLevel: 0,
      items: infoItems,
      children: [],
    });
  }

  // 2. Help text
  const helpItems = langItems.filter(i => i.type === 'help');
  if (helpItems.length > 0) {
    groups.push({
      key: '_help',
      label: '帮助文本 (@help)',
      badge: '',
      treeLevel: 0,
      items: helpItems,
      children: [],
    });
  }

  // 3. Build param/command tree
  // Separate plugin items from struct items
  const pluginItems = langItems.filter(i => App.blocks[i.blockIndex].type !== 'struct');
  const structItems = langItems.filter(i => App.blocks[i.blockIndex].type === 'struct');

  // Organize by tagKey (param/command/arg name)
  const nodes = {};  // tagKey → { tagKey, label, type, parentKey, items, children: [], isStructField }
  const orphans = []; // items without a tagKey

  pluginItems.forEach(item => {
    const key = item.tagKey;
    if (!key) { orphans.push(item); return; }

    if (!nodes[key]) {
      // Determine if this is a param, command, or arg node
      let nodeType = 'param';
      let label = key;
      if (item.context.startsWith('command:')) { nodeType = 'command'; label = `⚡ ${key}`; }
      else if (item.context.startsWith('arg:')) { nodeType = 'arg'; label = `  ${key}`; }

      nodes[key] = {
        tagKey: key,
        label: label,
        type: nodeType,
        parentKey: item.parentKey || '',
        items: [],
        children: [],
      };
    }
    nodes[key].items.push(item);
  });

  // Build tree: add children to parents, collect roots
  const nodeValues = Object.values(nodes);
  const roots = [];

  nodeValues.forEach(node => {
    if (node.parentKey && nodes[node.parentKey]) {
      nodes[node.parentKey].children.push(node);
    } else if (node.type !== 'arg') {
      // Args without a command context go to orphans
      if (node.type === 'arg') {
        node.items.forEach(it => orphans.push(it));
      } else {
        roots.push(node);
      }
    }
  });

  // Sort roots by earliest item position
  roots.sort((a, b) => compareItemPosition(a.items[0], b.items[0]));

  // ── Link struct blocks to referencing params ──
  // For each node that has a structRef (e.g. @type struct<GlossaryData>),
  // find the matching struct block and add its fields as children.
  const linkedStructNames = new Set(); // track which struct blocks are linked

  nodeValues.forEach(node => {
    const structRef = node.items.find(i => i.structRef)?.structRef;
    if (!structRef) return;

    // Find matching struct block (same language first, fallback to default)
    const structBlock = App.blocks.find(b =>
      b.type === 'struct' && b.name === structRef && b.lang === App.selectedLang
    ) || App.blocks.find(b =>
      b.type === 'struct' && b.name === structRef && b.lang === ''
    );
    if (!structBlock) return;

    linkedStructNames.add(structBlock.name + '|' + structBlock.lang);

    // Group struct block items by tagKey and add as children
    const structFieldNodes = {};
    structBlock.items.forEach(item => {
      const key = item.tagKey;
      if (!key) return;
      if (!structFieldNodes[key]) {
        structFieldNodes[key] = {
          tagKey: key,
          label: key,
          type: 'struct-field',
          parentKey: '',
          items: [],
          children: [],
        };
      }
      structFieldNodes[key].items.push(item);
    });

    const structChildren = Object.values(structFieldNodes);
    structChildren.sort((a, b) => compareItemPosition(a.items[0], b.items[0]));
    node.children.push(...structChildren);
  });

  // Render roots as groups
  roots.forEach(root => {
    const allItems = collectAllItems(root);
    const visibleItems = allItems.filter(i => shouldShowItem(i));
    if (visibleItems.length === 0 && !hasVisibleChildren(root)) return;

    const translated = countTranslated(visibleItems);
    const total = visibleItems.length;

    groups.push({
      key: `node-${root.tagKey}`,
      label: root.label,
      badge: root.type === 'command' ? '命令' : '参数',
      treeLevel: 0,
      items: [],
      children: [root],  // root is the top of the tree
      countOverride: `${translated}/${total}`,
    });
  });

  // Orphans (items without tagKey or unmatched args)
  if (orphans.length > 0) {
    const visibleOrphans = orphans.filter(i => shouldShowItem(i));
    if (visibleOrphans.length > 0) {
      groups.push({
        key: '_orphans',
        label: '其他',
        badge: '',
        treeLevel: 0,
        items: visibleOrphans,
        children: [],
      });
    }
  }

  // ── Orphan struct blocks (not referenced by any param) ──
  const allStructBlocks = App.blocks.filter(b =>
    b.type === 'struct' &&
    (!b.lang || b.lang === App.selectedLang || b.lang === '')
  );
  const seenStructGroups = new Set();
  allStructBlocks.forEach(block => {
    const key = block.name + '|' + block.lang;
    if (linkedStructNames.has(key) || seenStructGroups.has(block.name)) return;
    seenStructGroups.add(block.name);

    const structItems = block.items.filter(i => shouldShowItem(i));
    if (structItems.length === 0) return;

    // Group struct items by tagKey to create child nodes
    const childNodes = {};
    structItems.forEach(item => {
      const tk = item.tagKey;
      if (!tk) return;
      if (!childNodes[tk]) {
        childNodes[tk] = {
          tagKey: tk,
          label: tk,
          type: 'struct-field',
          parentKey: '',
          items: [],
          children: [],
        };
      }
      childNodes[tk].items.push(item);
    });

    const children = Object.values(childNodes);
    children.sort((a, b) => compareItemPosition(a.items[0], b.items[0]));

    const translated = countTranslated(structItems);
    groups.push({
      key: `struct-${block.name}`,
      label: `📦 结构体: ${block.name}`,
      badge: 'struct',
      treeLevel: 0,
      items: [],
      children: children,
    });
  });

  return groups;
}

function collectAllItems(node) {
  let items = [...node.items];
  node.children.forEach(child => {
    items = items.concat(collectAllItems(child));
  });
  return items;
}

function hasVisibleChildren(node) {
  return node.children.some(child => {
    return child.items.some(i => shouldShowItem(i)) || hasVisibleChildren(child);
  });
}

/**
 * Render tree nodes recursively.
 * @param {Array} nodes - Tree node objects with .items and .children
 * @param {Array} extraItems - Items to render at this level alongside nodes
 * @param {number} level - Indentation level
 */
function renderTreeNodes(nodes, extraItems, level) {
  let html = '';
  const depthClass = `tree-lvl-${Math.min(level, 4)}`;

  // Render extra items (items without children, at this level)
  extraItems.forEach(item => {
    if (!shouldShowItem(item)) return;
    html += renderItem(item, depthClass);
  });

  // Render tree nodes
  nodes.forEach((node, idx) => {
    const allItems = node.items;
    const hasChildren = node.children.length > 0;

    html += `<div class="item-wrap ${depthClass}">`;

    // Node header (shows the param/command name with its parent reference)
    if (hasChildren || allItems.length > 0) {
      const parentInfo = node.parentKey ? `← ${escapeHtml(node.parentKey)}` : '';
      html += `<div class="tree-param-header">
        <span class="param-name">${escapeHtml(node.label)}</span>
        ${parentInfo ? `<span class="param-parent">${parentInfo}</span>` : ''}
        <span class="param-type">${node.type}</span>
      </div>`;
    }

    // Render items of this node
    allItems.forEach(item => {
      if (!shouldShowItem(item)) return;
      html += renderItem(item, '');
    });

    // Render children recursively
    if (hasChildren) {
      html += renderTreeNodes(node.children, [], level + 1);
    }

    html += '</div>';
  });

  return html;
}

// ═══════════════════════════════════════════════════════════════════
//  Item Rendering
// ═══════════════════════════════════════════════════════════════════

function renderItem(item, extraClass) {
  const trans = App.translations.get(item.id) || '';
  const isTranslated = trans.trim() !== '';
  const badgeClass = getBadgeClass(item);
  const transClass = isTranslated ? ' translated' : '';

  // For synthetic @value items, show as read-only
  if (item.isSynthetic && item.type === 'value') {
    return `<div class="item-row${transClass} ${extraClass}" data-id="${item.id}">
      <div class="source-cell">
        <span class="item-badge ${badgeClass}">${escapeHtml(item.groupLabel)}</span>
        <div class="source-text">${escapeHtml(item.original)}</div>
      </div>
      <div class="trans-cell">
        <span class="source-text" style="color:var(--text-muted);font-style:italic;">${escapeHtml(item.original)}</span>
      </div>
    </div>`;
  }

  // Reference text from default language (for multilingual comparison)
  let refHtml = '';
  const refItem = getReferenceItem(item);
  if (refItem && refItem.original !== item.original) {
    refHtml = `<div class="source-ref">📖 ${escapeHtml(refItem.original)}</div>`;
  }

  const rowCount = Math.min(Math.max((item.original || '').split('\n').length, 1), 10);

  return `<div class="item-row${transClass} ${extraClass}" data-id="${item.id}">
    <div class="source-cell">
      <span class="item-badge ${badgeClass}">${escapeHtml(item.groupLabel)}</span>
      <div class="source-text">${escapeHtml(item.original)}</div>
      ${refHtml}
    </div>
    <div class="trans-cell">
      <textarea rows="${rowCount}"
        data-id="${item.id}"
        placeholder="在此输入翻译…"
        oninput="onTranslationChange(this)">${escapeHtml(trans)}</textarea>
    </div>
  </div>`;
}

function getBadgeClass(item) {
  if (item.isSynthetic) return 'badge-synthetic';
  const map = {
    help: 'badge-help',
    plugindesc: 'badge-plugindesc',
    author: 'badge-author',
    text: 'badge-text',
    desc: 'badge-desc',
    option: 'badge-option',
    value: 'badge-value',
    default: 'badge-default',
    on: 'badge-on',
    off: 'badge-off',
  };
  return map[item.type] || 'badge-default';
}

// ═══════════════════════════════════════════════════════════════════
//  Filtering & Search
// ═══════════════════════════════════════════════════════════════════

function shouldShowItem(item) {
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
}

function filterItemsByLanguage(items) {
  return items.filter(item => {
    const block = App.blocks[item.blockIndex];
    if (block.type === 'struct') {
      // Struct blocks are always visible (they don't participate in language switching)
      // But if we have multiple language variants of the same struct, show the one matching selectedLang
      if (block.lang && block.lang !== App.selectedLang) return false;
      return true;
    }
    return block.lang === App.selectedLang;
  });
}

function setFilter(filter) {
  App.currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === filter);
  });
  updateUI();
}

function onSearch(e) {
  App.currentSearch = e.target.value;
  updateUI();
}

// ═══════════════════════════════════════════════════════════════════
//  Translation
// ═══════════════════════════════════════════════════════════════════

function onTranslationChange(textarea) {
  const id = textarea.dataset.id;
  App.translations.set(id, textarea.value);

  const row = textarea.closest('.item-row');
  if (textarea.value.trim()) {
    row.classList.add('translated');
  } else {
    row.classList.remove('translated');
  }

  updateProgress();
  updateFilterCounts();
}

// ═══════════════════════════════════════════════════════════════════
//  Progress & Stats
// ═══════════════════════════════════════════════════════════════════

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

  document.querySelectorAll('.filter-btn').forEach(btn => {
    const filter = btn.dataset.filter;
    let count = total;
    if (filter === 'translated') count = translated;
    else if (filter === 'untranslated') count = total - translated;
    const span = btn.querySelector('.count');
    if (span) span.textContent = count;
  });
}

function countTranslated(items) {
  return items.filter(i => (App.translations.get(i.id) || '').trim()).length;
}

// ═══════════════════════════════════════════════════════════════════
//  Export
// ═══════════════════════════════════════════════════════════════════

function exportTranslated() {
  if (App.items.length === 0) {
    showStatus('请先加载一个插件文件', 'warning');
    return;
  }

  // Collect translations
  const translations = new Map();
  App.items.forEach(item => {
    // Only export translations for the selected language
    const block = App.blocks[item.blockIndex];
    if (block.type === 'plugin' && block.lang !== App.selectedLang) return;
    const val = App.translations.get(item.id);
    if (val && val.trim()) translations.set(item.id, val);
  });

  // Filter blocks: only selected language plugin blocks + struct blocks
  const filteredBlocks = App.blocks.filter(block =>
    block.type === 'struct' || block.lang === App.selectedLang
  );

  const exported = App.parser.exportBlocks(filteredBlocks, translations);
  showExportPanel(exported);
  showStatus(`已导出翻译文本，共 ${translations.size} 项`);
}

function copyExportToClipboard() {
  const pre = document.getElementById('exportContent');
  if (!pre) return;
  const text = pre.textContent;

  navigator.clipboard.writeText(text).then(() => {
    showStatus('已复制到剪贴板');
  }).catch(() => {
    // Fallback for older browsers
    const range = document.createRange();
    range.selectNodeContents(pre);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    document.execCommand('copy');
    showStatus('已复制到剪贴板');
  });
}

function downloadExport() {
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
}

function showExportPanel(text) {
  const panel = document.getElementById('exportPanel');
  const pre = document.getElementById('exportContent');
  pre.textContent = text;
  panel.classList.add('visible');
  pre.scrollTop = 0;
}

function hideExportPanel() {
  document.getElementById('exportPanel').classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════════════
//  Save / Load Translation State
// ═══════════════════════════════════════════════════════════════════

function saveTranslationState() {
  if (App.items.length === 0) {
    showStatus('请先加载一个插件文件', 'warning');
    return;
  }

  const state = {
    fileName: App.fileName,
    exportedAt: new Date().toISOString(),
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
  showStatus('翻译进度已保存');
}

function loadTranslationState() {
  if (App.items.length === 0) {
    showStatus('请先加载一个插件文件', 'warning');
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

        if (state.selectedLang !== undefined) {
          App.selectedLang = state.selectedLang;
        }

        updateLanguageSelect();
        updateUI();
        showStatus(`已载入翻译进度: ${count} 项`);
      } catch (err) {
        showStatus('载入失败: 无效的 JSON 文件', 'error');
      }
    };
    reader.readAsText(file, 'UTF-8');
  };
  input.click();
}

// ═══════════════════════════════════════════════════════════════════
//  UI Helpers
// ═══════════════════════════════════════════════════════════════════

function toggleGroup(header) {
  header.closest('.group').classList.toggle('collapsed');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function showStatus(msg, type) {
  const el = document.getElementById('statusMessage');
  el.textContent = msg;
  el.className = 'status-msg' + (type ? ' ' + type : '');
  clearTimeout(el._timeout);
  if (!type) {
    el._timeout = setTimeout(() => {
      if (el.textContent === msg) el.textContent = '';
    }, 4000);
  }
}

function updateStatusMessage() {
  const el = document.getElementById('statusMessage');
  if (el.textContent && !el.classList.contains('error') && !el.classList.contains('warning')) {
    // Keep success messages for a bit, then clear
  }
}

function compareItemPosition(a, b) {
  if (!a || !b) return 0;
  const biA = a.blockIndex, biB = b.blockIndex;
  const posA = a.isMultiLine ? a.lineRange[0] : a.lineIndex;
  const posB = b.isMultiLine ? b.lineRange[0] : b.lineIndex;
  if (biA !== biB) return biA - biB;
  return posA - posB;
}

// ═══════════════════════════════════════════════════════════════════
//  Drag & Drop
// ═══════════════════════════════════════════════════════════════════

function onDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'copy';
}

function onDrop(e) {
  e.preventDefault();
  const file = e.target.files ? e.target.files[0] : e.dataTransfer.files[0];
  if (file && file.name.endsWith('.js')) {
    loadFile(file);
  } else {
    showStatus('请拖入 .js 格式的 RMMZ 插件文件', 'warning');
  }
}

// ═══════════════════════════════════════════════════════════════════
//  Init
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => {
  updateUI();

  // Drag and drop on the whole page
  document.addEventListener('dragover', onDragOver);

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.name.endsWith('.js')) {
      loadFile(file);
    } else {
      showStatus('请拖入 .js 格式的 RMMZ 插件文件', 'warning');
    }
  });
});
