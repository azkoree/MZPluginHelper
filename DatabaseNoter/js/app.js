/**
 * RMMZ 数据库备注编辑器 — 核心逻辑
 *
 * 支持的数据库文件：Actors, Armors, Classes, Enemies, Items, Skills, States, Tilesets, Weapons
 * RMMZ JSON 格式：[null, {单行对象}, {单行对象}, ...]
 * note 字段拆分/合并格式：
 *   【属性配置】属性文本
 *   ---------
 *   【物品描述】描述文本
 */

// ==================== 常量 ====================

/** 有效的 RMMZ 数据库文件名（不含扩展名） */
const VALID_NAMES = new Set([
  'Actors', 'Armors', 'Classes', 'Enemies', 'Items',
  'Skills', 'States', 'Tilesets', 'Weapons'
]);

/** note 字段分隔符 */
const NOTE_SEPARATOR = '\n---------\n';

/** note 解析正则 */
const NOTE_RE = /^【属性配置】\n([\s\S]*?)\n---------\n【物品描述】\n([\s\S]*)$/;

// ==================== 全局状态 ====================

/** { fileName: { entries: [{id, name, original, configNote, descNote, importHint}], count: number } } */
const state = {
  files: {},
  currentFile: null      // 当前编辑区显示的文件名
};

// ==================== DOM 引用 ====================

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const btnImport   = $('#btnImport');
const btnExport   = $('#btnExport');
const btnExportZip = $('#btnExportZip');
const fileInput   = $('#fileInput');
const sidebarNav = $('#sidebarNav');
const editorArea = $('#editorArea');
const dialogOver = $('#confirmDialog');
const dialogMsg  = $('#confirmMessage');
const dialogYes  = $('#confirmYes');
const dialogNo   = $('#confirmNo');

// ==================== 工具函数 ====================

/** 从文件名提取不带扩展名的名称（如 "Actors.json" → "Actors"） */
function extractBaseName(filename) {
  // 处理 "Actors.json" 或 "Actors" 或路径
  const name = filename.replace(/^.*[\\/]/, '');  // 去掉路径
  const dotIdx = name.lastIndexOf('.');
  return dotIdx > 0 ? name.slice(0, dotIdx) : name;
}

/** 判断文件名是否有效 */
function isValidFile(filename) {
  return VALID_NAMES.has(extractBaseName(filename));
}

/** 从原始 note 字段解析出 configNote 和 descNote */
function parseNote(rawNote) {
  if (!rawNote) return { configNote: '', descNote: '', importHint: false };

  const match = rawNote.match(NOTE_RE);
  if (match) {
    return {
      configNote: match[1],
      descNote: match[2],
      importHint: false
    };
  }

  // 不符合格式 → 全部放入描述框
  return {
    configNote: '',
    descNote: rawNote,
    importHint: true
  };
}

/** 将 configNote 和 descNote 合并为 note 字段 */
function buildNote(configNote, descNote) {
  const cfg = configNote || '';
  const desc = descNote || '';

  if (!cfg && !desc) return '';

  return `【属性配置】\n${cfg}\n---------\n【物品描述】\n${desc}`;
}

/** 转义 HTML 特殊字符 */
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(str).replace(/[&<>"']/g, c => map[c]);
}

// ==================== 确认对话框 ====================

/**
 * 显示确认对话框，返回 Promise<boolean>
 */
function confirmDialog(message) {
  return new Promise((resolve) => {
    dialogMsg.textContent = message;
    dialogOver.hidden = false;

    function cleanup(result) {
      dialogOver.hidden = true;
      dialogYes.removeEventListener('click', onYes);
      dialogNo.removeEventListener('click', onNo);
      resolve(result);
    }

    function onYes() { cleanup(true); }
    function onNo()  { cleanup(false); }

    dialogYes.addEventListener('click', onYes);
    dialogNo.addEventListener('click', onNo);
  });
}

// ==================== 导入逻辑 ====================

/**
 * 处理文件导入（批量）
 */
async function importFiles(files) {
  const accepted = [];
  const rejected = [];

  for (const file of files) {
    if (!isValidFile(file.name)) {
      rejected.push(file.name);
      continue;
    }

    const baseName = extractBaseName(file.name);

    // 检查是否已存在，弹出确认框
    if (state.files[baseName]) {
      const ok = await confirmDialog(`文件「${baseName}.json」已经导入，是否替换？`);
      if (!ok) continue;
    }

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      accepted.push({ baseName, json });
    } catch (err) {
      console.error(`解析 ${file.name} 失败:`, err);
      rejected.push(file.name + '（格式错误）');
    }
  }

  // 将数据存入 state
  for (const { baseName, json } of accepted) {
    const entries = [];

    if (Array.isArray(json)) {
      for (const item of json) {
        // 跳过 null / 非对象元素（如 RMMZ 的首个 null 占位）
        if (item === null || typeof item !== 'object') continue;

        const { configNote, descNote, importHint } = parseNote(item.note || '');
        entries.push({
          id: item.id,
          name: item.name || '',
          original: item,
          configNote,
          descNote,
          importHint
        });
      }
    }

    // 按 id 排序
    entries.sort((a, b) => a.id - b.id);

    state.files[baseName] = { entries };
  }

  // 如果接受了文件且没有当前文件，切换到第一个
  if (accepted.length > 0 && !state.currentFile) {
    state.currentFile = accepted[0].baseName;
  }

  // 刷新 UI
  renderSidebar();
  renderEditor();
  updateExportButton();

  // 提示
  if (rejected.length > 0) {
    alert('以下文件无法导入：\n' + rejected.join('\n'));
  }
}

// ==================== 侧边导航栏渲染 ====================

/** 侧边栏中每个文件是否收起（记忆状态） */
const sidebarCollapsed = {};

function renderSidebar() {
  const fileNames = Object.keys(state.files).sort();

  if (fileNames.length === 0) {
    sidebarNav.innerHTML = '<div class="sidebar-empty">暂无导入文件<br>请点击上方「导入 JSON」</div>';
    return;
  }

  let html = '';

  for (const fileName of fileNames) {
    const collapsed = sidebarCollapsed[fileName] || false;
    const arrow = collapsed ? '▶' : '▼';
    const fileData = state.files[fileName];
    const isActive = fileName === state.currentFile;

    html += `<div class="sidebar-file${collapsed ? ' collapsed' : ''}" data-file="${escapeHtml(fileName)}">`;
    html += `<div class="sidebar-file-header" data-action="toggle-file" data-file="${escapeHtml(fileName)}">`;
    html += `<span class="arrow">${arrow}</span>`;
    html += `<span>${escapeHtml(fileName)}.json</span>`;
    html += `</div>`;

    html += `<div class="sidebar-file-entries">`;
    for (const entry of fileData.entries) {
      const label = entry.name || `#${String(entry.id).padStart(3, '0')}`;
      const entryClass = (isActive && entry.id === (activeEntryId || null)) ? ' active' : '';
      html += `<a class="sidebar-file-entry${entryClass}" data-action="go-entry" data-file="${escapeHtml(fileName)}" data-id="${entry.id}">`;
      html += `${String(entry.id).padStart(3, '0')}: ${escapeHtml(label)}`;
      html += `</a>`;
    }
    html += `</div></div>`;
  }

  sidebarNav.innerHTML = html;
}

// ==================== 编辑区域渲染 ====================

/** 当前高亮的条目 id（用于导航高亮） */
let activeEntryId = null;

/**
 * 渲染标签页栏 + 所有文件面板（一次性渲染，之后切换标签页只改 CSS 不重建 DOM）
 */
function renderEditor() {
  const fileNames = Object.keys(state.files).sort();

  if (fileNames.length === 0) {
    editorArea.innerHTML = `
      <div class="editor-placeholder">
        <p>请先导入数据库 JSON 文件</p>
        <p class="hint">支持：Actors、Armors、Classes、Enemies、Items、Skills、States、Tilesets、Weapons</p>
      </div>`;
    return;
  }

  // 确保 currentFile 有效
  if (!state.currentFile || !state.files[state.currentFile]) {
    state.currentFile = fileNames[0];
  }

  let html = '';

  // 标签页栏
  html += '<div class="tab-bar">';
  for (const fileName of fileNames) {
    const activeClass = fileName === state.currentFile ? ' active' : '';
    html += `<button class="tab${activeClass}" data-action="switch-tab" data-file="${escapeHtml(fileName)}">${escapeHtml(fileName)}.json</button>`;
  }
  html += '</div>';

  // 文件面板
  for (const fileName of fileNames) {
    const fileData = state.files[fileName];
    const hidden = fileName !== state.currentFile ? ' hidden' : '';

    html += `<div class="file-panel${hidden}" data-panel="${escapeHtml(fileName)}">`;

    for (const entry of fileData.entries) {
      const idStr = String(entry.id).padStart(3, '0');
      const name = entry.name || '（无名称）';
      const collapsed = collapsedEntries[fileName] && collapsedEntries[fileName].has(entry.id);

      html += `<div class="entry-card${collapsed ? ' collapsed' : ''}" id="entry-${escapeHtml(fileName)}-${entry.id}" data-file="${escapeHtml(fileName)}" data-id="${entry.id}">`;

      // 标题栏
      html += `<div class="entry-header" data-action="toggle-entry" data-file="${escapeHtml(fileName)}" data-id="${entry.id}">`;
      html += `<span class="collapse-icon">${collapsed ? '▶' : '▼'}</span>`;
      html += `<span class="entry-id">${idStr}</span>`;
      html += `<span class="entry-name">${escapeHtml(name)}</span>`;
      if (entry.importHint) {
        html += `<span class="import-hint" title="导入时未能识别格式，原备注内容已全部放入描述框">⚠ 旧格式</span>`;
      }
      html += `</div>`;

      // 正文
      html += `<div class="entry-body">`;
      html += `<div class="note-group">`;
      html += `<label>属性配置</label>`;
      html += `<textarea data-field="configNote" data-file="${escapeHtml(fileName)}" data-id="${entry.id}" placeholder="在此输入属性配置...">${escapeHtml(entry.configNote)}</textarea>`;
      html += `</div>`;
      html += `<div class="note-group">`;
      html += `<label>物品描述</label>`;
      html += `<textarea data-field="descNote" data-file="${escapeHtml(fileName)}" data-id="${entry.id}" placeholder="在此输入物品描述...">${escapeHtml(entry.descNote)}</textarea>`;
      html += `</div>`;
      html += `</div>`;

      html += `</div>`;
    }

    html += '</div>';
  }

  editorArea.innerHTML = html;
}

/**
 * 切换到指定标签页（不改建 DOM，只切换 CSS 状态）
 */
function switchTab(fileName) {
  if (!state.files[fileName]) return;
  if (state.currentFile === fileName) return;  // 已经是当前页

  state.currentFile = fileName;

  // 更新标签页样式
  const tabs = editorArea.querySelectorAll('.tab');
  for (const tab of tabs) {
    tab.classList.toggle('active', tab.dataset.file === fileName);
  }

  // 切换面板显示
  const panels = editorArea.querySelectorAll('.file-panel');
  for (const panel of panels) {
    panel.hidden = panel.dataset.panel !== fileName;
  }

  // 更新侧边栏高亮和按钮状态
  renderSidebar();
  updateExportButton();
}

/** 条目折叠状态：{ fileName: Set<entryId> } */
const collapsedEntries = {};

function toggleEntry(fileName, entryId) {
  if (!collapsedEntries[fileName]) {
    collapsedEntries[fileName] = new Set();
  }
  const set = collapsedEntries[fileName];
  if (set.has(entryId)) {
    set.delete(entryId);
  } else {
    set.add(entryId);
  }

  // 局部刷新该条目的 DOM
  const card = document.querySelector(`.entry-card[data-file="${CSS.escape(fileName)}"][data-id="${entryId}"]`);
  if (!card) return;

  const collapsed = set.has(entryId);
  card.classList.toggle('collapsed', collapsed);

  const icon = card.querySelector('.collapse-icon');
  if (icon) icon.textContent = collapsed ? '▶' : '▼';
}

// ==================== 事件代理 ====================

/** 点击侧边栏 */
sidebarNav.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const fileName = target.dataset.file;
  const entryId = target.dataset.id ? Number(target.dataset.id) : null;

  switch (action) {
    case 'toggle-file': {
      sidebarCollapsed[fileName] = !sidebarCollapsed[fileName];
      renderSidebar();
      break;
    }
    case 'go-entry': {
      // 切换到对应标签页
      if (state.currentFile !== fileName) {
        switchTab(fileName);
      }
      // 滚动到对应条目
      activeEntryId = entryId;
      renderSidebar();  // 更新高亮
      requestAnimationFrame(() => {
        const el = document.getElementById(`entry-${fileName}-${entryId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'start' });
          // 短暂高亮
          el.style.boxShadow = '0 0 0 2px rgba(74,144,217,0.4)';
          setTimeout(() => { el.style.boxShadow = ''; }, 1500);
        }
      });
      break;
    }
  }
});

/** 点击编辑区域（标签页 / 条目折叠） */
editorArea.addEventListener('click', (e) => {
  const target = e.target.closest('[data-action]');
  if (!target) return;

  const action = target.dataset.action;
  const fileName = target.dataset.file;
  const entryId = target.dataset.id ? Number(target.dataset.id) : null;

  if (action === 'toggle-entry') {
    toggleEntry(fileName, entryId);
  } else if (action === 'switch-tab') {
    switchTab(fileName);
  }
});

/** textarea 内容变更 → 实时写入 state */
editorArea.addEventListener('input', (e) => {
  const ta = e.target.closest('textarea[data-field]');
  if (!ta) return;

  const fileName = ta.dataset.file;
  const entryId = Number(ta.dataset.id);
  const field = ta.dataset.field;

  const fileData = state.files[fileName];
  if (!fileData) return;

  const entry = fileData.entries.find(en => en.id === entryId);
  if (!entry) return;

  entry[field] = ta.value;
});

// ==================== 导出逻辑 ====================

function exportCurrentFile() {
  const fileName = state.currentFile;
  if (!fileName || !state.files[fileName]) {
    alert('没有可导出的文件，请先导入 JSON。');
    return;
  }

  const fileData = state.files[fileName];

  // 重新从 textarea 读取最新值（以防万一 input 事件遗漏）
  syncAllTextareas();

  // 构建导出数组
  const output = [null];  // RMMZ 格式：第一个元素为 null

  for (const entry of fileData.entries) {
    const newNote = buildNote(entry.configNote, entry.descNote);
    const obj = { ...entry.original, note: newNote };
    output.push(obj);
  }

  // 生成 RMMZ 格式的 JSON：一行一个对象
  let jsonText = '[\nnull';
  for (let i = 1; i < output.length; i++) {
    jsonText += ',\n' + JSON.stringify(output[i]);
  }
  jsonText += '\n]';

  // 触发下载
  const blob = new Blob([jsonText], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 将所有已导入文件打包为 Zip 并下载 */
async function exportZip() {
  const fileNames = Object.keys(state.files);
  if (fileNames.length === 0) {
    alert('没有可导出的文件，请先导入 JSON。');
    return;
  }

  // 同步最新 textarea 内容
  syncAllTextareas();

  const zip = new JSZip();

  for (const fileName of fileNames) {
    const fileData = state.files[fileName];
    const output = [null];

    for (const entry of fileData.entries) {
      const newNote = buildNote(entry.configNote, entry.descNote);
      const obj = { ...entry.original, note: newNote };
      output.push(obj);
    }

    let jsonText = '[\nnull';
    for (let i = 1; i < output.length; i++) {
      jsonText += ',\n' + JSON.stringify(output[i]);
    }
    jsonText += '\n]';

    zip.file(`${fileName}.json`, jsonText);
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DatabaseNoter_export.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** 将页面上所有 textarea 的值同步回 state */
function syncAllTextareas() {
  const textareas = editorArea.querySelectorAll('textarea[data-field]');
  for (const ta of textareas) {
    const fileName = ta.dataset.file;
    const entryId = Number(ta.dataset.id);
    const field = ta.dataset.field;
    const fileData = state.files[fileName];
    if (!fileData) continue;
    const entry = fileData.entries.find(en => en.id === entryId);
    if (entry) {
      entry[field] = ta.value;
    }
  }
}

function updateExportButton() {
  const hasFiles = Object.keys(state.files).length > 0;
  btnExport.disabled = !state.currentFile || !state.files[state.currentFile];
  btnExportZip.disabled = !hasFiles;
}

// ==================== 初始化事件绑定 ====================

btnImport.addEventListener('click', () => {
  fileInput.click();
});

fileInput.addEventListener('change', async () => {
  if (fileInput.files.length > 0) {
    await importFiles(fileInput.files);
    fileInput.value = '';  // 清空以便重复选择同一文件
  }
});

btnExport.addEventListener('click', () => {
  exportCurrentFile();
});

btnExportZip.addEventListener('click', () => {
  exportZip();
});

// 拖拽导入支持
document.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
});

document.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  if (e.dataTransfer.files.length > 0) {
    await importFiles(e.dataTransfer.files);
  }
});

// ==================== 键盘快捷键 ====================

document.addEventListener('keydown', (e) => {
  // Ctrl+S / Cmd+S → 导出当前文件
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === 's') {
    e.preventDefault();
    if (state.currentFile && state.files[state.currentFile]) {
      exportCurrentFile();
    }
  }
  // Ctrl+Shift+S / Cmd+Shift+S → 导出 Zip
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'S') {
    e.preventDefault();
    if (Object.keys(state.files).length > 0) {
      exportZip();
    }
  }
});
