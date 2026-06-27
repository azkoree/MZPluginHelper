/* ============================================================
 * RMMZ 备注标签助手 - RMMZ NoteHelper
 * Phase 1: 核心链路（基础功能骨架）
 * ============================================================ */

// ============================================================
// 状态管理
// ============================================================
const STATE = {
  plugins: [],           // { name, tags: [{ text, desc }] }
  tabs: [{ id: 0, name: '备注 1', content: '' }],
  currentTab: 0,
  clickCounts: {},       // 'pluginName::tagText' -> count
  collapsedGroups: {},   // pluginName -> bool
  tabIdCounter: 1,
};

// ============================================================
// 常量
// ============================================================
const EXCLUDED_TAGS = new Set([
  'b', 'i', 'br', 'u', 's', 'sub', 'sup', 'small', 'big',
  'left', 'center', 'right', 'ColorLock', 'WordWrap',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'div', 'span',
  'table', 'tr', 'td', 'th', 'ul', 'ol', 'li', 'a', 'img',
]);

// 匹配 <TagName ...> 标签的正则
// 规则：以 < 开头，标签名以字母或中文开头，包含字母/中文/空格/连字符，可选冒号+参数，以 > 结尾
const TAG_REGEX = /<([A-Za-z\u4e00-\u9fa5][A-Za-z\u4e00-\u9fa5\s\-_.]*?)(?::\s*([^>]*))?>/g;

// 从 @plugindesc 行提取插件描述名的正则
const PLUGIN_DESC_REGEX = /@plugindesc\s+(\S+\s+)?(.+)$/m;

// ============================================================
// DOM 缓存
// ============================================================
const DOM = {};

function cacheDom() {
  DOM.fileInput = document.getElementById('file-input');
  DOM.configInput = document.getElementById('config-input');
  DOM.btnImport = document.getElementById('btn-import');
  DOM.btnPluginInfo = document.getElementById('btn-plugin-info');
  DOM.pluginCount = document.getElementById('plugin-count');
  DOM.tagCount = document.getElementById('tag-count');
  DOM.pluginDropdown = document.getElementById('plugin-dropdown');
  DOM.pluginDropdownContent = document.getElementById('plugin-dropdown-content');
  DOM.tagSearch = document.getElementById('tag-search');
  DOM.pluginFilter = document.getElementById('plugin-filter');
  DOM.btnManualAdd = document.getElementById('btn-manual-add');
  DOM.tagList = document.getElementById('tag-list');
  DOM.emptyState = document.getElementById('empty-state');
  DOM.noteEditor = document.getElementById('note-editor');
  DOM.tabList = document.getElementById('tab-list');
  DOM.btnAddTab = document.getElementById('btn-add-tab');
  DOM.charCount = document.getElementById('char-count');
  DOM.btnCopy = document.getElementById('btn-copy');
  DOM.btnClear = document.getElementById('btn-clear');
  DOM.btnExportConfig = document.getElementById('btn-export-config');
  DOM.btnImportConfig = document.getElementById('btn-import-config');

  // Modals
  DOM.strategyModal = document.getElementById('strategy-modal');
  DOM.btnStrategyConfirm = document.getElementById('btn-strategy-confirm');
  DOM.btnStrategyCancel = document.getElementById('btn-strategy-cancel');
  DOM.manualModal = document.getElementById('manual-modal');
  DOM.manualInput = document.getElementById('manual-input');
  DOM.btnManualConfirm = document.getElementById('btn-manual-confirm');
  DOM.btnManualCancel = document.getElementById('btn-manual-cancel');
  DOM.snippetModal = document.getElementById('snippet-modal');
  DOM.snippetNameInput = document.getElementById('snippet-name-input');
  DOM.btnSnippetSave = document.getElementById('btn-snippet-save');
  DOM.btnSnippetCancel = document.getElementById('btn-snippet-cancel');
}

// ============================================================
// 标签提取引擎
// ============================================================

/**
 * 从插件文件名或 @plugindesc 中提取可读的插件名称
 */
function extractPluginName(content, fileName) {
  // 返回文件名（去掉扩展名）作为插件标识
  return fileName.replace(/\.js$/i, '');
}

/**
 * 从 JS 文件内容中提取所有备注标签
 * @param {string} content - JS 文件内容
 * @param {string} fileName - 文件名（用于提取插件名）
 * @returns {{ name: string, tags: Array<{ text: string, desc: string }> }}
 */
function extractTagsFromJS(content, fileName) {
  let name = extractPluginName(content, fileName);
  const tags = [];

  // 1. 定位 /*: ... */ 注释块
  const commentMatch = content.match(/\/\*:([\s\S]*?)\*\//);
  if (!commentMatch) return { name, tags: [] };

  const block = commentMatch[1];

  // 2. 从 @plugindesc 提取插件描述（用于展示在展开区域顶部）
  let displayName = '';
  const descMatch = block.match(/@plugindesc\s+(\S+\s+)?(.+)$/m);
  if (descMatch) {
    let desc = (descMatch[1] || '') + descMatch[2];
    desc = desc.replace(/\[[\d.]+\]\s*/, '').trim();
    if (desc) displayName = desc;
  }

  // 3. 定位 @help 区域 - 放宽边界，取从 @help 到注释块结束的所有内容
  const helpIdx = block.indexOf('@help');
  if (helpIdx === -1) return { name, tags: [] };

  let helpText = block.substring(helpIdx + 5); // 跳过 '@help' 关键字

  // 去掉尾部可能残留的 */
  const closeIdx = helpText.lastIndexOf('*/');
  if (closeIdx !== -1) {
    helpText = helpText.substring(0, closeIdx);
  }

  // 4. 逐行扫描，提取标签
  const lines = helpText.split('\n');
  const seen = new Set();
  const MAX_DESC_LINES = 5;
  let skipUntil = -1;

  for (let i = 0; i < lines.length; i++) {
    if (i <= skipUntil) continue;
    let rawLine = lines[i].replace(/\r$/, '');          // 去掉 Windows 换行符
    const cleaned = rawLine.replace(/^\s*\*+\s*/, '').trim(); // 去掉行首的 * 前缀

    // 跳过空行、@ 元数据行、struct< 行
    if (!cleaned || cleaned.startsWith('@') || cleaned.includes('struct<')) continue;

    // 跳过转义码说明行（如 \Copy<text,x>、\HoriFlip<text>、\< 等）
    if (cleaned.startsWith('\\')) continue;
    if (/^\\[A-Z]/.test(cleaned)) continue;

    // 匹配标签
    TAG_REGEX.lastIndex = 0;
    let match;

    while ((match = TAG_REGEX.exec(cleaned)) !== null) {
      const tagName = match[1].trim();
      const tagValue = match[2] ? match[2].trim() : '';
      const fullTag = match[0]; // 包括 < 和 >

      // 排除 HTML 标签
      if (EXCLUDED_TAGS.has(tagName)) continue;

      // 排除过短的内嵌参数名（来自转义码的参数，如 <x>, <id>, <text>）
      if (tagName.length <= 3 && (tagName === 'x' || tagName === 'y' || tagName === 'id' || tagName === 'text' || tagName === 'arg')) continue;

      // 检查是否为成对标签（无 : 参数的标签，且后面有 </同名> 闭合）
      if (!tagValue && !EXCLUDED_TAGS.has(tagName)) {
        const closeStr = "</" + tagName + ">";
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          const nl = lines[j].replace(/^\s*\*+\s*/, "").trim();
          if (nl.includes(closeStr)) {
            const blockLines = [];
            for (let k = i; k <= j; k++) {
              blockLines.push(lines[k].replace(/^\s*\*+\s*/, "").trimEnd());
            }
            const blockText = blockLines.join("\n");
            seen.add(fullTag);
            let blockDesc = "";
            for (let d = j + 1; d < Math.min(j + MAX_DESC_LINES, lines.length); d++) {
              const dl = lines[d].replace(/^\s*\*+\s*/, "").trim();
              if (!dl || dl.startsWith("=") || dl.startsWith("@") || dl.startsWith("<")) break;
              if (dl.startsWith("-") || /[\u4e00-\u9fa5]/.test(dl)) {
                blockDesc += (blockDesc ? " " : "") + dl.replace(/^-\s*/, "");
              } else break;
            }
            tags.push({
              text: blockText,
              displayText: "<" + tagName + ">...</" + tagName + ">",
              desc: blockDesc,
              hasValue: false,
              valuePart: "",
              isBlock: true,
            });
            skipUntil = j;
            break;
          }
        }
        if (i <= skipUntil) break;
      }

      // 检查匹配位置前是否有转义码模式（\Name 在 < 之前）
      const tagPos = cleaned.indexOf(fullTag);
      if (tagPos > 0) {
        const textBefore = cleaned.substring(Math.max(0, tagPos - 30), tagPos);
        // 检查是否有 \Name 或 \n 等转义标记
        if (/\\[A-Za-z]+$/.test(textBefore) || /\\[A-Za-z]+,\s*$/.test(textBefore)) continue;
        if (/\\[\s\S]*$/.test(textBefore) && /\\/.test(textBefore)) {
          // 查找最近的反斜杠
          const lastBS = textBefore.lastIndexOf('\\');
          const afterBS = textBefore.substring(lastBS + 1).trim();
          // 如果反斜杠和 < 之间只有一个单词，则是转义码
          if (/^[A-Za-z]+$/.test(afterBS)) continue;
        }
      }

      // 去重
      if (seen.has(fullTag)) continue;
      seen.add(fullTag);

      // 提取描述（查看后续行）
      let desc = '';
      for (let j = i + 1; j < Math.min(i + MAX_DESC_LINES, lines.length); j++) {
        const nextLine = lines[j].replace(/^\s*\*+\s*/, '').trim();
        if (!nextLine || nextLine.startsWith('=') || nextLine.startsWith('@')) break;
        if (nextLine.startsWith('<')) break;
        if (nextLine.startsWith('-') || /[\u4e00-\u9fa5]/.test(nextLine)) {
          desc += (desc ? ' ' : '') + nextLine.replace(/^-\s*/, '');
        } else {
          break;
        }
      }

      tags.push({
        text: fullTag,
        desc: desc,
        hasValue: !!tagValue,
        valuePart: tagValue,
      });
    }
  }

  // 5. 双语别名配对处理：检测同值不同语种的标签对
  for (let ti = tags.length - 1; ti >= 0; ti--) {
    const tag = tags[ti];
    if (!tag.hasValue || !tag.valuePart) continue;
    const matchIdx = tags.findIndex((t, idx) =>
      idx !== ti && t.hasValue && t.valuePart === tag.valuePart && t.text !== tag.text
    );
    if (matchIdx === -1) continue;
    const matchTag = tags[matchIdx];
    const aHasCN = /[一-龥]/.test(tag.text);
    const bHasCN = /[一-龥]/.test(matchTag.text);
    if (aHasCN !== bHasCN) {
      const primary = aHasCN ? matchTag : tag;
      const cnTag = aHasCN ? tag : matchTag;
      primary.alias = cnTag.text;
      primary.paired = true;
      const rmIdx = tags.indexOf(cnTag);
      if (rmIdx > -1) tags.splice(rmIdx, 1);
      if (rmIdx < ti) ti--;
    }
  }

  return { name, displayName, tags };
}

/**
 * 批量提取多个插件的标签
 */
function extractTagsFromFiles(files) {
  return Promise.all(Array.from(files).map(file => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target.result;
        const result = extractTagsFromJS(content, file.name);
        resolve(result);
      };
      reader.onerror = reject;
      reader.readAsText(file, 'UTF-8');
    });
  }));
}

// ============================================================
// 导入逻辑
// ============================================================

/**
 * 处理导入策略弹窗
 */
let pendingImportFiles = null;
let _strategyCallback = null;

function showStrategyDialog(files) {
  pendingImportFiles = files;
  _strategyCallback = null;
  DOM.strategyModal.classList.remove('hidden');
}

function hideStrategyDialog() {
  DOM.strategyModal.classList.add('hidden');
  pendingImportFiles = null;
  _strategyCallback = null;
}

/**
 * 确认导入（策略选择后调用）
 */
async function confirmImport(strategy) {
  const files = pendingImportFiles;
  if (!files) return;
  hideStrategyDialog();

  try {
    const results = await extractTagsFromFiles(files);
    // 过滤掉没有标签的插件
    const validResults = results.filter(r => r.tags.length > 0);

    if (validResults.length === 0) {
      showToast('未在这些文件中找到任何备注标签');
      return;
    }

    applyPluginResults(validResults, strategy);
    renderAll();
        showToast('已导入 ' + validResults.length + ' 个插件的 ' + getTotalTagCount(validResults) + ' 个标签');
  } catch (err) {
    showToast('导入失败: ' + err.message);
  }

  pendingImportFiles = null;
}

/**
 * 将提取结果应用到状态中
 */
function applyPluginResults(results, strategy) {
  if (strategy === 'overwrite') {
    STATE.plugins = results;
    STATE.clickCounts = {};
    STATE.collapsedGroups = {};
    for (const p of results) {
      STATE.collapsedGroups[p.name] = true;
    }
  } else {
    // append: 合并，已有插件则追加新标签
    for (const result of results) {
      const existing = STATE.plugins.find(p => p.name === result.name);
      if (existing) {
        const existingTexts = new Set(existing.tags.map(t => t.text));
        for (const tag of result.tags) {
          if (!existingTexts.has(tag.text)) {
            existing.tags.push(tag);
          }
        }
      } else {
        STATE.plugins.push(result);
        STATE.collapsedGroups[result.name] = true;
      }
    }
  }
}

/**
 * 从已保存的配置对象中恢复标签
 */
function importFromConfig(config, strategy) {
  if (!config || !config.plugins || !Array.isArray(config.plugins)) {
    showToast('配置格式无效');
    return;
  }

  // 验证格式
  for (const p of config.plugins) {
    if (!p.name || !Array.isArray(p.tags)) {
      showToast('配置格式无效');
      return;
    }
  }

  if (strategy === 'overwrite') {
    STATE.plugins = config.plugins;
    STATE.clickCounts = config.clickCounts || {};
    STATE.collapsedGroups = {};
  } else {
    for (const result of config.plugins) {
      const existing = STATE.plugins.find(p => p.name === result.name);
      if (existing) {
        const existingTexts = new Set(existing.tags.map(t => t.text));
        for (const tag of result.tags) {
          if (!existingTexts.has(tag.text)) {
            existing.tags.push(tag);
          }
        }
      } else {
        STATE.plugins.push(result);
      }
    }
    // 合并点击次数
    if (config.clickCounts) {
      for (const [key, count] of Object.entries(config.clickCounts)) {
        STATE.clickCounts[key] = (STATE.clickCounts[key] || 0) + count;
      }
    }
  }

  renderAll();
  showToast('已导入  个插件的标签配置');
}

/**
 * 获取标签总数
 */
function getTotalTagCount(plugins) {
  return plugins.reduce((sum, p) => sum + p.tags.length, 0);
}

// ============================================================
// 渲染
// ============================================================

function renderAll() {
  renderStats();
  renderPluginFilter();
  renderTagList();
  renderPluginDropdown();
  renderTabs();
  updateCharCount();
}

function renderStats() {
  DOM.pluginCount.textContent = STATE.plugins.length;
  DOM.tagCount.textContent = getTotalTagCount(STATE.plugins);
  DOM.emptyState.classList.toggle('hidden', STATE.plugins.length > 0);
}

function renderPluginFilter() {
  const select = DOM.pluginFilter;
  const currentVal = select.value;

  select.innerHTML = '<option value="__all__">全部插件</option>';
  for (const plugin of STATE.plugins) {
    const opt = document.createElement('option');
    opt.value = plugin.name;
    opt.textContent = plugin.name;
    select.appendChild(opt);
  }

  select.value = currentVal;
  if (currentVal !== '__all__' && !STATE.plugins.some(p => p.name === currentVal)) {
    select.value = '__all__';
  }
}

function renderPluginDropdown() {
  const container = DOM.pluginDropdownContent;
  container.innerHTML = '';

  for (const plugin of STATE.plugins) {
    const item = document.createElement('div');
    item.className = 'plugin-info-item';
    const displayName = plugin.displayName || plugin.name;
    item.innerHTML = '<span class="plugin-info-name">' + escapeHtml(plugin.name) + '<br><span style="font-size:11px;color:#888;">' + escapeHtml(displayName) + '</span></span>' +
      '<span class="plugin-info-count">' + plugin.tags.length + ' 标签</span>';
    container.appendChild(item);
  }

  if (STATE.plugins.length === 0) {
    container.innerHTML = '<div class="plugin-info-item" style="color:#999;">尚未导入插件</div>';
  }
}

/**
 * 渲染标签列表（支持搜索过滤 + 插件过滤 + 按点击频率排序）
 */
function renderTagList() {
  const container = DOM.tagList;
  const searchQuery = DOM.tagSearch.value.trim().toLowerCase();
  const pluginFilter = DOM.pluginFilter.value;

  container.innerHTML = '';

  // 过滤插件列表
  let filteredPlugins = STATE.plugins;
  if (pluginFilter !== '__all__') {
    filteredPlugins = filteredPlugins.filter(p => p.name === pluginFilter);
  }

  if (filteredPlugins.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;text-align:center;color:#999;">没有匹配的标签</div>';
    return;
  }

  for (const plugin of filteredPlugins) {
    // 搜索过滤标签
    let tags = plugin.tags;
    if (searchQuery) {
      tags = tags.filter(t =>
        t.text.toLowerCase().includes(searchQuery) ||
        t.desc.toLowerCase().includes(searchQuery)
      );
    }

    if (tags.length === 0) continue;

    // 按点击频率排序
    const sortedTags = [...tags].sort((a, b) => {
      const countA = STATE.clickCounts[plugin.name + '::' + a.text] || 0;
      const countB = STATE.clickCounts[plugin.name + '::' + b.text] || 0;
      return countB - countA;
    });

    // 分组
    const group = document.createElement('div');
    group.className = 'tag-group';

    const collapsed = STATE.collapsedGroups[plugin.name] !== undefined ? STATE.collapsedGroups[plugin.name] : true;
    const header = document.createElement('div');
    header.className = 'tag-group-header';
    header.dataset.plugin = plugin.name;
    header.innerHTML = '<span class="group-toggle' + (collapsed ? ' collapsed' : '') +
      '">&#9660;</span>' +
      '<span class="group-name">' + escapeHtml(plugin.name) + '</span>' +
      '<span class="group-count">' + tags.length + '</span>';
    header.addEventListener('click', () => {
      STATE.collapsedGroups[plugin.name] = !STATE.collapsedGroups[plugin.name];
      renderTagList();
    });
    group.appendChild(header);

    const body = document.createElement('div');
    body.className = 'tag-group-body' + (collapsed ? ' collapsed' : '');

    // 插件描述（如果有的话）显示在展开区域顶部
    if (plugin.displayName) {
      const descLine = document.createElement('div');
      descLine.style.cssText = 'font-size:11px;color:#888;padding:2px 2px 6px;border-bottom:1px solid #e0e0e0;margin-bottom:6px;';
      descLine.textContent = plugin.displayName;
      body.appendChild(descLine);
    }

    for (const tag of sortedTags) {
      const pill = document.createElement('span');
      let pillClass = 'tag-pill' + (tag.isBlock ? ' tag-block' : '');
      if (tag.paired) pillClass += ' tag-paired';
      pill.className = pillClass;

      if (tag.paired && tag.alias) {
        pill.textContent = tag.text + ' / ' + tag.alias;
      } else {
        pill.textContent = tag.displayText || tag.text;
      }

      pill.dataset.plugin = plugin.name;
      pill.dataset.tag = tag.text;
      pill.title = tag.desc || (tag.paired && tag.alias ? tag.text + '  ' + tag.alias : tag.text);

      const clickKey = plugin.name + '::' + tag.text;
      const clickCount = STATE.clickCounts[clickKey] || 0;
      if (clickCount > 0) {
        const badge = document.createElement('sup');
        badge.className = 'tag-badge';
        badge.textContent = clickCount > 99 ? '99+' : String(clickCount);
        pill.appendChild(badge);
      }

      pill.addEventListener('click', (e) => {
        if (e.target.classList.contains('tag-badge')) return;
        e.stopPropagation();
        STATE.clickCounts[clickKey] = (STATE.clickCounts[clickKey] || 0) + 1;
        insertTag(tag.text);
      });

      body.appendChild(pill);

      if (tag.desc) {
        const desc = document.createElement('div');
        desc.className = 'tag-description';
        desc.textContent = tag.desc;
        body.appendChild(desc);
      }
    }

    group.appendChild(body);
    container.appendChild(group);
  }

  // 如果没有匹配结果
  if (container.children.length === 0) {
    container.innerHTML = '<div class="empty-state" style="padding:30px;text-align:center;color:#999;">没有匹配的标签</div>';
  }
}

// ============================================================
// 标签页系统
// ============================================================

function renderTabs() {
  const container = DOM.tabList;
  container.innerHTML = '';

  for (const tab of STATE.tabs) {
    const item = document.createElement('div');
    item.className = 'tab-item' + (tab.id === STATE.currentTab ? ' active' : '');
    item.dataset.tabId = tab.id;

    const nameSpan = document.createElement('span');
    nameSpan.className = 'tab-name';
    nameSpan.textContent = tab.name;
    nameSpan.title = '双击重命名';

    // 重命名：双击或右键菜单
    function startRename() {
      if (nameSpan.isContentEditable) return;
      nameSpan.contentEditable = 'true';
      nameSpan.focus();
      const range = document.createRange();
      range.selectNodeContents(nameSpan);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    }

    nameSpan.addEventListener('dblclick', startRename);

    nameSpan.addEventListener('blur', () => {
      nameSpan.contentEditable = 'false';
      const newName = nameSpan.textContent.trim();
      if (newName) {
        tab.name = newName;
      }
      nameSpan.textContent = tab.name;
    });

    nameSpan.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        nameSpan.blur();
      }
    });

    item.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      startRename();
    });

    item.appendChild(nameSpan);

    if (STATE.tabs.length > 1) {
      const closeBtn = document.createElement('span');
      closeBtn.className = 'tab-close';
      closeBtn.textContent = '×';
      closeBtn.title = '关闭标签页';
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeTab(tab.id);
      });
      item.appendChild(closeBtn);
    }

    item.addEventListener('click', () => {
      switchTab(tab.id);
    });

    container.appendChild(item);
  }

  // 同步编辑器内容
  syncEditorWithCurrentTab();
}

function switchTab(tabId) {
  // 先保存当前标签页的内容
  const currentTab = STATE.tabs.find(t => t.id === STATE.currentTab);
  if (currentTab) {
    currentTab.content = DOM.noteEditor.value;
  }

  STATE.currentTab = tabId;
  renderTabs();
}

function closeTab(tabId) {
  if (STATE.tabs.length <= 1) return;

  const idx = STATE.tabs.findIndex(t => t.id === tabId);
  if (idx === -1) return;

  const tab = STATE.tabs.find(t => t.id === tabId);
  if (tab && tab.content.trim()) {
    if (!confirm('"' + tab.name + '" 中有未保存的内容，确定关闭吗？')) return;
  }

  STATE.tabs.splice(idx, 1);

  // 如果当前关闭的是当前标签页，切换到另一个
  if (STATE.currentTab === tabId) {
    STATE.currentTab = STATE.tabs[Math.min(idx, STATE.tabs.length - 1)].id;
  }

  renderTabs();
}

function addTab() {
  const id = STATE.tabIdCounter++;
  STATE.tabs.push({ id, name: '备注 ' + id, content: '' });
  STATE.currentTab = id;
  renderTabs();
  DOM.noteEditor.focus();
}

function syncEditorWithCurrentTab() {
  const tab = STATE.tabs.find(t => t.id === STATE.currentTab);
  if (tab) {
    DOM.noteEditor.value = tab.content;
    updateCharCount();
  }
}

function saveCurrentTabContent() {
  const tab = STATE.tabs.find(t => t.id === STATE.currentTab);
  if (tab) {
    tab.content = DOM.noteEditor.value;
  }
}

// ============================================================
// 标签插入
// ============================================================

function insertTag(tagText) {
  const textarea = DOM.noteEditor;
  textarea.focus();

  // 如果当前有选区（可能是从上一个标签自动选中的占位符）
  let start = textarea.selectionStart;
  let end = textarea.selectionEnd;
  if (start !== end) {
    // 找到选区后面最近的 >（即当前标签的闭合括号），插入到它后面
    const textAfter = textarea.value.substring(end);
    const closeBracket = textAfter.indexOf('>');
    if (closeBracket !== -1) {
      start = end + closeBracket + 1;
    } else {
      start = textarea.value.length;
    }
    end = start;
  }

  // 添加空格前缀（如果不是行首且前面没有空格）
  let insertText = tagText;
  const charBefore = textarea.value.substring(start - 1, start);
  if (start > 0 && charBefore !== ' ' && charBefore !== '\n' && charBefore !== '\t') {
    insertText = ' ' + tagText;
  }

  // 添加空格后缀（如果后面有非空格字符）
  const charAfter = textarea.value.substring(start, start + 1);
  if (charAfter && charAfter !== ' ' && charAfter !== '\n' && charAfter !== '\t') {
    insertText = insertText + ' ';
  }

  // 插入
  const newPos = start + insertText.length;
  textarea.value = textarea.value.substring(0, start) + insertText + textarea.value.substring(end); // 用 end 而非 selectionEnd

  // 保存内容
  saveCurrentTabContent();

  // 多行块标签：不选中占位符
  if (tagText.includes('\n') || tagText.includes('\r')) {
    textarea.setSelectionRange(newPos, newPos);
  } else {
  // 检测并选中占位符
  const placeholderMatch = tagText.match(/:\s*(.+?)>/);
  if (placeholderMatch) {
    const placeholder = placeholderMatch[1];
    const insertPlaceholderMatch = insertText.match(/:\s*(.+?)>/);
    if (insertPlaceholderMatch) {
      const placeholderStart = start + insertText.indexOf(insertPlaceholderMatch[0]) +
        insertPlaceholderMatch[0].indexOf(placeholderMatch[1]);
      const placeholderEnd = placeholderStart + placeholder.length;
      textarea.setSelectionRange(placeholderStart, placeholderEnd);
    } else {
      textarea.setSelectionRange(newPos, newPos);
    }
  } else {
    textarea.setSelectionRange(newPos, newPos);
  }
  }

  updateCharCount();
}

// ============================================================
// 剪贴板操作
// ============================================================

async function copyEditorContent() {
  const text = DOM.noteEditor.value;
  if (!text) {
    showToast('没有可复制的内容');
    return;
  }

  try {
    await navigator.clipboard.writeText(text);
    showToast('已复制到剪贴板');
  } catch (err) {
    // 降级方案
    try {
      textarea.select();
      document.execCommand('copy');
      showToast('已复制到剪贴板');
    } catch (err2) {
      showToast('复制失败: ' + err2.message);
    }
  }
}

function clearEditor() {
  if (DOM.noteEditor.value && !confirm('确定清空当前标签页的内容吗？')) return;
  DOM.noteEditor.value = '';
  saveCurrentTabContent();
  updateCharCount();
  showToast('已清空');
  DOM.noteEditor.focus();
}

function updateCharCount() {
  DOM.charCount.textContent = DOM.noteEditor.value.length + ' 字符';
}

// ============================================================
// 导出/导入配置
// ============================================================

function exportConfig() {
  if (STATE.plugins.length === 0) {
    showToast('没有可导出的标签配置');
    return;
  }

  const config = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    plugins: STATE.plugins,
    clickCounts: STATE.clickCounts,
  };

  const blob = new Blob([JSON.stringify(config, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'rmmz_note_tags_' + new Date().toISOString().slice(0, 10) + '.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('配置已导出');
}

function showImportConfigDialog() {
  DOM.configInput.click();
}

function handleConfigFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const config = JSON.parse(e.target.result);
      if (STATE.plugins.length > 0) {
        showConfigStrategyDialog(config);
      } else {
        importFromConfig(config, 'overwrite');
      }
    } catch (err) {
      showToast('配置文件解析失败: ' + err.message);
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function showConfigStrategyDialog(config) {
  _strategyCallback = (strategy) => {
    importFromConfig(config, strategy);
    _strategyCallback = null;
  };
  DOM.strategyModal.classList.remove('hidden');
}

// ============================================================
// 手动添加标签
// ============================================================

function showManualDialog() {
  DOM.manualInput.value = '';
  DOM.manualModal.classList.remove('hidden');
  setTimeout(() => DOM.manualInput.focus(), 100);
}

function hideManualDialog() {
  DOM.manualModal.classList.add('hidden');
}

function addManualTag() {
  const input = DOM.manualInput.value.trim();
  if (!input) return;

  // 验证标签格式
  if (!/^<[^>]+>$/.test(input)) {
    showToast('标签格式无效，应为 <TagName: x> 形式');
    return;
  }

  // 提取标签名判断是否 HTML 标签
  const nameMatch = input.match(/<([A-Za-z\u4e00-\u9fa5][^>:]*)/);
  if (nameMatch && EXCLUDED_TAGS.has(nameMatch[1].trim())) {
    showToast('"' + nameMatch[1].trim() + '" 是系统保留标签名');
    return;
  }

  // 添加到"自定义标签"插件组
  const customPluginName = '自定义标签';
  let customPlugin = STATE.plugins.find(p => p.name === customPluginName);
  if (!customPlugin) {
    customPlugin = { name: customPluginName, tags: [] };
    STATE.plugins.push(customPlugin);
  }

  // 去重
  if (customPlugin.tags.some(t => t.text === input)) {
    showToast('该标签已存在');
    hideManualDialog();
    return;
  }

  customPlugin.tags.push({ text: input, desc: '', hasValue: input.includes(':'), valuePart: '' });

  hideManualDialog();
  renderAll();
  showToast('已添加标签: ' + input);
}

// ============================================================
// Toast 通知
// ============================================================

function showToast(message) {
  // 移除已有 toast
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ============================================================
// 工具函数
// ============================================================

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ============================================================
// 拖拽导入
// ============================================================

function setupDragDrop() {
  let dragCounter = 0;

  document.addEventListener('dragenter', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter++;
  });

  document.addEventListener('dragleave', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter--;
    if (dragCounter === 0) {
      // 移除拖拽高亮
    }
  });

  document.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('drop', (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter = 0;

    const files = e.dataTransfer.files;
    if (files.length === 0) return;

    const jsFiles = Array.from(files).filter(f => f.name.endsWith('.js'));
    if (jsFiles.length === 0) {
      showToast('请拖入 .js 文件');
      return;
    }

      if (STATE.plugins.length > 0) {
        showStrategyDialog(jsFiles);
      } else {
        pendingImportFiles = jsFiles;
        confirmImport('append');
      }
  });
}

// ============================================================
// 快捷键
// ============================================================

function setupShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+F: 聚焦搜索框（仅当不在编辑器中时或按 Ctrl+F 在任何位置）
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      DOM.tagSearch.focus();
      DOM.tagSearch.select();
      return;
    }

    // Ctrl+S: 复制（仅当在编辑器中）
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
      e.preventDefault();
      copyEditorContent();
      return;
    }

    // Ctrl+Shift+S 已移除（与系统快捷键冲突）

    // 弹窗中的 Enter 确认
    if (e.key === 'Enter') {
      if (!DOM.manualModal.classList.contains('hidden')) {
        e.preventDefault();
        addManualTag();
        return;
      }
      if (!DOM.strategyModal.classList.contains('hidden')) {
        e.preventDefault();
        const selected = document.querySelector('input[name="strategy"]:checked');
        confirmImport(selected.value);
        return;
      }
    }

    // ESC 取消弹窗
    if (e.key === 'Escape') {
      if (!DOM.manualModal.classList.contains('hidden')) {
        hideManualDialog();
        return;
      }
      if (!DOM.strategyModal.classList.contains('hidden')) {
        hideStrategyDialog();
        return;
      }
      if (!DOM.snippetModal.classList.contains('hidden')) {
        DOM.snippetModal.classList.add('hidden');
        return;
      }
    }
  });
}

// ============================================================
// 事件绑定
// ============================================================

function bindEvents() {
  // 导入按钮
  DOM.btnImport.addEventListener('click', () => DOM.fileInput.click());

      DOM.fileInput.addEventListener('change', () => {
        if (DOM.fileInput.files.length === 0) return;
        if (STATE.plugins.length > 0) {
          showStrategyDialog(DOM.fileInput.files);
        } else {
          pendingImportFiles = DOM.fileInput.files;
          confirmImport('append');
        }
        DOM.fileInput.value = '';
      });

  // 插件信息下拉
  DOM.btnPluginInfo.addEventListener('click', (e) => {
    e.stopPropagation();
    DOM.pluginDropdownContent.classList.toggle('show');
  });

  document.addEventListener('click', (e) => {
    if (!DOM.pluginDropdown.contains(e.target)) {
      DOM.pluginDropdownContent.classList.remove('show');
    }
  });

  // 搜索、过滤
  DOM.tagSearch.addEventListener('input', () => renderTagList());
  DOM.pluginFilter.addEventListener('change', () => renderTagList());

  // 手动添加
  DOM.btnManualAdd.addEventListener('click', showManualDialog);
  DOM.btnManualConfirm.addEventListener('click', addManualTag);
  DOM.btnManualCancel.addEventListener('click', hideManualDialog);

  DOM.manualInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addManualTag();
    }
  });

  // 策略弹窗
  DOM.btnStrategyConfirm.addEventListener('click', () => {
    const selected = document.querySelector('input[name="strategy"]:checked');
    if (_strategyCallback) {
      _strategyCallback(selected.value);
    } else {
      confirmImport(selected.value);
    }
  });

  DOM.btnStrategyCancel.addEventListener('click', hideStrategyDialog);

  // 编辑器
  DOM.noteEditor.addEventListener('input', () => {
    saveCurrentTabContent();
    updateCharCount();
  });

  // 复制 / 清空
  DOM.btnCopy.addEventListener('click', copyEditorContent);
  DOM.btnClear.addEventListener('click', clearEditor);

  // 标签页
  DOM.btnAddTab.addEventListener('click', addTab);

  // 导出 / 导入配置
  DOM.btnExportConfig.addEventListener('click', exportConfig);
  DOM.btnImportConfig.addEventListener('click', showImportConfigDialog);

  DOM.configInput.addEventListener('change', () => {
    if (DOM.configInput.files.length > 0) {
      handleConfigFile(DOM.configInput.files[0]);
    }
    DOM.configInput.value = '';
  });
}

// ============================================================
// 初始化
// ============================================================

function init() {
  cacheDom();
  bindEvents();
  setupDragDrop();
  setupShortcuts();
  renderAll();

  // 如果有 localStorage 缓存，可在此恢复（Phase 2 扩展）
}

document.addEventListener('DOMContentLoaded', init);
