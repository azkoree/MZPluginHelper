// ============================================================================
// Text2Frame Editor — Core Logic (Phase 1)
// ============================================================================

/* ─── State ─────────────────────────────────────────────────────────── */
const STATE_KEY  = 't2f_editor_state';
const SAVE_DELAY = 500; // ms

let tabs        = [];
let activeTabId = null;
let tabIdCounter = 0;
let saveTimer   = null;
let templateDropdownOpen = false;
let activeCategoryMenu = null;
let undoCursorTimer   = null;

/* --- Undo / Redo State --- */
const MAX_UNDO = 120;
let undoStack = [];
let redoStack = [];
let undoRecordTimer = null;
let lastUndoContent = '';
let isUndoingRedoing = false;

/* ─── DOM References ───────────────────────────────────────────────── */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

const editor        = $('#editor');
const lineNumbers   = $('#line-numbers');
const tabContainer  = $('#tab-container');
const tabAdd        = $('#tab-add');
const tagList       = $('#tag-list');
const tagSearch     = $('#tag-search');
const tagFilter     = $('#tag-filter');
const fileInput     = $('#file-input');
const btnOpen       = $('#btn-open');
const btnExport     = $('#btn-export');
const btnExportAll  = $('#btn-export-all');
const statsLine     = $('#stats-line');
const statsChar     = $('#stats-char');
const statsTags     = $('#stats-tags');
const statusAutoSave= $('#status-auto-save');
const statusSaved   = $('#status-saved-time');
const toolbarStatus = $('#toolbar-status');
const btnTemplate   = $('#btn-template');
const btnSaveTemplate = $('#btn-save-template');
const templateDropdown = $('#template-dropdown');
const templateDialogOverlay = $('#template-dialog-overlay');
const templateDialogInput = $('#template-dialog-input');
const templateDialogConfirm = $('#template-dialog-confirm');
const templateDialogCancel = $('#template-dialog-cancel');
const btnExportCustom = $('#btn-export-custom');
const btnImportCustom = $('#btn-import-custom');
const importCustomInput = $('#import-custom-input');
const highlightLayer = $('#highlight-layer');
const outlinePanel = $('#outline-panel');
const outlineContent = $('#outline-content');
const outlineToggle = $('#btn-outline-toggle');
const outlineClose = $('#btn-outline-close');
const btnImportSystem = $('#btn-import-system');
const btnClearVars = $('#btn-clear-vars');
const systemJsonInput = $('#system-json-input');
const varsSearch = $('#vars-search');
const varsContent = $('#vars-content');
const panelTabs = document.querySelectorAll('.panel-tab');
const VARS_CACHE_KEY = 't2f_vars_cache';

var varsData = null;

/* --- Undo / Redo Core --- */

function recordUndoSnapshot(force) {
  if (isUndoingRedoing) return;
  const c = editor.value;
  if (!force && c === lastUndoContent) return;

  undoStack.push({
    content: c,
    start: editor.selectionStart,
    end: editor.selectionEnd,
  });
  lastUndoContent = c;

  if (undoStack.length > MAX_UNDO) undoStack.shift();
  redoStack.length = 0;
  updateUndoButtons();
  clearTimeout(undoRecordTimer);
}

function performUndo() {
  if (undoStack.length <= 1) return;

  redoStack.push({
    content: editor.value,
    start: editor.selectionStart,
    end: editor.selectionEnd,
  });

  isUndoingRedoing = true;

  undoStack.pop();
  const state = undoStack[undoStack.length - 1];
  editor.value = state.content;
  editor.setSelectionRange(state.start, state.end);
  lastUndoContent = state.content;

  editor.dispatchEvent(new Event('input'));
  updateUndoButtons();

  isUndoingRedoing = false;
  setStatus('撤销');
}

function performRedo() {
  if (redoStack.length === 0) return;

  undoStack.push({
    content: editor.value,
    start: editor.selectionStart,
    end: editor.selectionEnd,
  });
  lastUndoContent = editor.value;

  isUndoingRedoing = true;

  const state = redoStack.pop();
  editor.value = state.content;
  editor.setSelectionRange(state.start, state.end);
  lastUndoContent = state.content;

  editor.dispatchEvent(new Event('input'));
  updateUndoButtons();

  isUndoingRedoing = false;
  setStatus('重做');
}

function updateUndoButtons() {
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.disabled = undoStack.length <= 1;
  if (redoBtn) redoBtn.disabled = redoStack.length === 0;
}


/* ─── Tab Data Model ───────────────────────────────────────────────── */
function createTab(name) {
  const id = ++tabIdCounter;
  tabs.push({ id, name, content: '', savedContent: '' });
  return id;
}

function getTab(id) {
  return tabs.find(t => t.id === id);
}

function getActiveTab() {
  return getTab(activeTabId);
}

function deleteTab(id) {
  if (tabs.length <= 1) return;
  const idx = tabs.findIndex(t => t.id === id);
  if (idx === -1) return;
  tabs.splice(idx, 1);
  if (activeTabId === id) {
    const nextIdx = Math.min(idx, tabs.length - 1);
    switchTab(tabs[nextIdx].id);
  }
  renderTabs();
  scheduleSave();
}

function switchTab(id) {
  // Save current content first
  const prev = getActiveTab();
  if (prev) prev.content = editor.value;

  activeTabId = id;
  const tab = getTab(id);
  if (!tab) return;

  editor.value = tab.content;
  renderTabs();
  syncEditor();
  scheduleSave();
}

function renameTab(id, newName) {
  const tab = getTab(id);
  if (!tab) return;
  tab.name = newName.replace(/[\/\\:*?"<>|]/g, '').trim() || 'Untitled';
  renderTabs();
  scheduleSave();
}

function addTab(name) {
  const id = createTab(name || `Scene ${tabIdCounter}`);
  switchTab(id);
  return id;
}

/* ─── Tab Rendering ────────────────────────────────────────────────── */
function renderTabs() {
  tabContainer.innerHTML = '';
  tabs.forEach(tab => {
    const el = document.createElement('div');
    el.className = 'tab-item' + (tab.id === activeTabId ? ' active' : '');
    el.dataset.tabId = tab.id;

    const label = document.createElement('span');
    label.className = 'tab-label';
    label.textContent = tab.name;
    label.title = tab.name;

    // Double-click to rename
    label.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      label.contentEditable = 'true';
      label.focus();
      // Select all text
      const range = document.createRange();
      range.selectNodeContents(label);
      const sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    });
    label.addEventListener('blur', () => {
      label.contentEditable = 'false';
      renameTab(tab.id, label.textContent);
    });
    label.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); label.blur(); }
      if (e.key === 'Escape') { label.textContent = tab.name; label.blur(); }
    });

    el.appendChild(label);

    // Close button
    const closeBtn = document.createElement('button');
    closeBtn.className = 'tab-close';
    closeBtn.textContent = '×';
    closeBtn.title = 'Close Tab (Ctrl+W)';
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteTab(tab.id);
    });
    el.appendChild(closeBtn);

    el.addEventListener('click', () => {
      if (tab.id !== activeTabId) switchTab(tab.id);
    });

    tabContainer.appendChild(el);
  });
}

/* ─── Editor Sync (line numbers + stats) ───────────────────────────── */
function syncEditor() {
  updateLineNumbers();
  updateStats();
  updateHighlight();
}

function updateLineNumbers() {
  const lines = editor.value.split('\n');
  const lineCount = lines.length;
  let html = '';
  for (let i = 1; i <= lineCount; i++) {
    html += i + '\n';
  }
  // always show at least 20 lines for padding
  const minLines = Math.max(lineCount, 20);
  if (lineCount < minLines) {
    for (let i = lineCount + 1; i <= minLines; i++) {
      html += i + '\n';
    }
  }
  lineNumbers.textContent = html;
}

function updateStats() {
  const text = editor.value;
  const lines = text.split('\n');
  const cursorPos = editor.selectionStart;
  const currentLine = text.substring(0, cursorPos).split('\n').length;

  statsLine.textContent = `行: ${currentLine}`;
  statsChar.textContent = `字符: ${text.length}`;

  // Count tags
  const tagMatches = text.match(/<\/?[\w]+[^>]*>/g);
  const tagCount = tagMatches ? tagMatches.length : 0;
  statsTags.textContent = `标签: ${tagCount}`;
}

/* ─── Tag Insertion ─────────────────────────────────────────────────── */
function insertTag(tag) {
  recordUndoSnapshot(true);
  const ta = editor;
  // Ensure textarea has focus before reading/writing selection state
  ta.focus();
  // Collapse selection to end to avoid replacing placeholder text.
  let cursorPos = ta.selectionEnd;
  ta.setSelectionRange(cursorPos, cursorPos);
  // If the cursor is just before a closing > (because the placeholder
  // selection ended inside a tag), skip past it.
  const fullText = ta.value;
  if (cursorPos < fullText.length && fullText[cursorPos] === '>') {
    cursorPos++;
  }
  const before = fullText.substring(0, cursorPos);
  const after  = fullText.substring(cursorPos);
  let insertStr, selectOffset, selectLen;

  if (tag.paired) {
    if (tag.insertText) {
      insertStr = tag.insertText;
    } else {
      insertStr = `${tag.name}\n\t\n${tag.closeTag}`;
    }
    const openEnd = insertStr.indexOf('\n\t');
    if (openEnd !== -1) {
      selectOffset = cursorPos + openEnd + 2;
      selectLen = 0;
    } else {
      const midPoint = insertStr.indexOf(tag.closeTag || `</${tag.name}>`);
      selectOffset = cursorPos + midPoint;
      selectLen = 0;
    }
  } else if (tag.params && tag.params.length > 0) {
    insertStr = tag.name;
    const paramText = tag.params[0];
    const paramIdx = tag.name.indexOf(`: ${paramText}`);
    if (paramIdx !== -1) {
      selectOffset = cursorPos + paramIdx + 2;
      selectLen = paramText.length;
    } else {
      selectOffset = cursorPos + tag.name.length;
      selectLen = 0;
    }
  } else {
    insertStr = tag.name;
    selectOffset = cursorPos + tag.name.length;
    selectLen = 0;
  }

  ta.value = before + insertStr + after;
  ta.focus();
  ta.setSelectionRange(selectOffset, selectOffset + selectLen);
  ta.dispatchEvent(new Event('input'));
  syncEditor();
  scheduleSave();
}

/* ─── Template Insertion ────────────────────────────────────────────── */
function insertTemplate(content) {
  recordUndoSnapshot(true);
  const ta = editor;
  ta.focus();
  const cursorPos = ta.selectionEnd;
  const before = ta.value.substring(0, cursorPos);
  const after  = ta.value.substring(cursorPos);

  // Ensure newline before if cursor is not at start and preceding char is not newline
  let prefix = '';
  if (cursorPos > 0 && before[cursorPos - 1] !== '\n') {
    prefix = '\n';
  }

  ta.value = before + prefix + content + after;
  const newCursor = cursorPos + prefix.length + content.length;
  ta.setSelectionRange(newCursor, newCursor);
  ta.dispatchEvent(new Event('input'));
  syncEditor();
  scheduleSave();
}

function escapeHtml(str) {
  var div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}



var TAG_DESC_MAP = {};
(function() {
  for (var i = 0; i < TAGS.length; i++) {
    var t = TAGS[i];
    var key = t.name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    TAG_DESC_MAP[key] = t.desc;
  }
})();

function highlightText(text) {
  if (!text) return '\n';
  var r = text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  var lines = r.split('\n');
  for (var i=0; i<lines.length; i++) {
    var t = lines[i].trim();
    if (t.indexOf('%') === 0) { lines[i] = '<span class="hl-comment">'+lines[i]+'</span>'; }
  }
  r = lines.join('\n');
  r = r.replace(/(&lt;)(\/?)([\w]+)([^&]*?)(&gt;)/g, function(m,lt,sl,n,p,gt) {
    var c = sl ? 'hl-close-tag' : 'hl-tag';
    var inner;
    if (p) inner = '<span class="'+c+'">'+lt+sl+n+'</span><span class="hl-param">'+p+'</span><span class="'+c+'">'+gt+'</span>';
    else inner = '<span class="'+c+'">'+lt+sl+n+gt+'</span>';
    var title = m.replace(/"/g, '&quot;');
    var desc = TAG_DESC_MAP[m];
    if (desc) title += ' - ' + desc.replace(/"/g, '&quot;');
    return '<span class="hl-pill" title="' + title + '">' + inner + '</span>';
  });
  return r;
}

function updateHighlight() {
  if (!highlightLayer) return;
  highlightLayer.innerHTML = highlightText(editor.value) || '\n';
}

var _OL_OPN = ['ShowChoices','If','Loop','BattleProcessing'];
var _OL_MID = ['When','Else','IfWin','IfLose'];
var _OL_CLS = ['End','RepeatAbove','BreakLoop'];
var _OL_FLT = ['Name','Face','FadeOut','FadeIn','TransferPlayer','Label','JumpToLabel','CommonEvent','OpenSaveScreen','PluginCommand','script','comment'];
var _OL_ALL = {};
_OL_OPN.concat(_OL_MID).concat(_OL_CLS).concat(_OL_FLT).forEach(function(t){_OL_ALL[t]=1});

function parseOutline(text) {
  var lines = text.split('\n'), items = [], depth = 0, ps = [];
  for (var i=0; i<lines.length; i++) {
    var t = lines[i].trim();
    if (!t) continue;
    var m = t.match(/^<\s*(\/?)([\w]+)/i);
    if (!m) continue;
    var cl = !!m[1], tn = m[2];
    if (!_OL_ALL[tn]) continue;
    if (cl) { if(ps.length&&ps[ps.length-1]===tn){ps.pop();depth--;if(depth<0)depth=0;} continue; }
    var ed = depth;
    if (_OL_OPN.indexOf(tn)+1) { ed = depth; depth++; }
    else if (_OL_MID.indexOf(tn)+1) { ed = Math.max(0,depth-1); }
    else if (_OL_CLS.indexOf(tn)+1) { depth = Math.max(0,depth-1); ed = depth; }
    else if (tn==='script'||tn==='comment') { ed = depth; ps.push(tn); depth++; }
    else { ed = depth; }
    if (tn==='End') continue;
    items.push({line:i+1, tag:tn, text:t, depth:Math.min(ed,5)});
  }
  return items;
}

function renderOutline() {
  if (!outlineContent) return;
  var items = parseOutline(editor.value);
  if (!items.length) { outlineContent.innerHTML='<div class="outline-empty">暂无结构标签</div>'; return; }
  var cl = editor.value.substring(0,editor.selectionStart).split('\n').length;
  var h = '';
  for (var i=0; i<items.length; i++) {
    var it = items[i], ia = (it.line===cl), ind = '';
    for (var d=0; d<it.depth; d++) ind += '<span class="outline-indent outline-indent-1"></span>';
    var dt = it.text; if (dt.length>40) dt = dt.slice(0,37)+'...';
    h += '<div class="outline-item'+(ia?' active':'')+'" data-line="'+it.line+'">'+ind+'<span class="outline-item-text">'+escapeHtml(dt)+'</span><span class="outline-item-ln">'+it.line+'</span></div>';
  }
  outlineContent.innerHTML = h;
  Array.from(outlineContent.querySelectorAll('.outline-item')).forEach(function(el){
    el.addEventListener('click',function(){var ln=parseInt(el.dataset.line);if(ln)jumpToOutlineLine(ln);});
  });
}

function jumpToOutlineLine(ln) {
  if (!ln||ln<1) return;
  var l=editor.value.split('\n'); if (ln>l.length) return;
  var p=0; for (var i=0; i<ln-1; i++) p+=l[i].length+1;
  editor.focus(); editor.setSelectionRange(p,p);
  editor.scrollTop = Math.max(0, (ln-1)*(parseFloat(getComputedStyle(editor).lineHeight)||21)-40);
}

var _olTimer = null;
function scheduleOutlineUpdate() { if(_olTimer)clearTimeout(_olTimer); _olTimer=setTimeout(function(){renderOutline();},400); }
function syncHighlightScroll() { if(highlightLayer) highlightLayer.scrollTop = editor.scrollTop; }

/* --- Variables / Switches Viewer --- */

var VARS_GROUP_SIZE = 50;

function switchPanel(tab) {
  document.querySelectorAll('.panel-tab').forEach(function(t){t.classList.remove('active');});
  document.querySelectorAll('.panel-content').forEach(function(t){t.classList.remove('active');});
  var b2 = document.querySelector('.panel-tab[data-tab="'+tab+'"]');
  if (b2) b2.classList.add('active');
  var p = document.getElementById(tab==='tags'?'tag-panel-content':'vars-panel');
  if (p) p.classList.add('active');
  if (tab==='vars') renderVarsPanel();
}
function importSystemJson() { systemJsonInput.click(); }
function clearVarsCache() {
  try{localStorage.removeItem(VARS_CACHE_KEY);}catch(e){}
  varsData=null; renderVarsPanel(); setStatus('已清除变量/开关缓存');
}
function saveVarsCache(data) {
  try{
    localStorage.setItem(VARS_CACHE_KEY,JSON.stringify({switches:data.switches,variables:data.variables,importedAt:Date.now(),sourceFile:data.sourceFile||''}));
    varsData=data;
  }catch(e){console.warn('Cache save fail:',e);}
}
function loadVarsCache() {
  try{
    var raw=localStorage.getItem(VARS_CACHE_KEY);
    if(!raw)return null;
    var d=JSON.parse(raw);
    if(d&&d.switches&&d.variables){varsData=d;return d;}
  }catch(e){}
  return null;
}
function parseSystemJson(text,fn) {
  try{
    var d=JSON.parse(text);
    var sw=d.switches||[], sv=d.variables||[];
    if(!Array.isArray(sw)||!Array.isArray(sv)){setStatus('导入失败：JSON 格式不正确');return false;}
    saveVarsCache({switches:sw,variables:sv,sourceFile:fn});
    setStatus('已导入 '+sw.length+' 个开关, '+sv.length+' 个变量');
    renderVarsPanel(); return true;
  }catch(e){setStatus('导入失败：JSON 解析错误');return false;}
}
function renderVarsSection(label,items,search) {
  var h='', maxId=items.length-1, totalGroups=Math.ceil(maxId/VARS_GROUP_SIZE);
  if(totalGroups===0)return '';
  h+='<div class="vars-section-label">'+label+' ('+maxId+' 个)</div>';
  for(var g=0;g<totalGroups;g++){
    var start=g*VARS_GROUP_SIZE+1, end=Math.min((g+1)*VARS_GROUP_SIZE,maxId);
    var rows='', count=0;
    for(var i=start;i<=end;i++){
      var nm=items[i]||'', match=true;
      if(search){var si=String(i).indexOf(search)>=0,sn=nm.toLowerCase().indexOf(search)>=0;match=si||sn;}
      if(match){
        var nc=nm?'vars-row-name':'vars-row-name vars-row-name-empty', dn=nm||'(未命名)';
        rows+='<div class="vars-row"><span class="vars-row-id">'+i+'</span><span class="'+nc+'">'+escapeHtml(dn)+'</span></div>';
        count++;
      }
    }
    if(search&&count===0)continue;
    var collapsed=g>0;
    h+='<div class="vars-group"><div class="vars-group-header'+(collapsed?' collapsed':'')+'"><span class="vars-group-arrow">\u25BC</span><span>'+start+' - '+end+'</span><span class="vars-group-count">'+count+'</span></div><div class="vars-table">'+rows+'</div></div>';
  }
  return h;
}
function renderVarsPanel() {
  if(!varsContent)return;
  var data=varsData, search=(varsSearch?varsSearch.value.toLowerCase().trim():'');
  if(!data){varsContent.innerHTML='<div class="vars-empty">尚未导入 System.json，请先点击上方按钮导入。</div>';return;}
  var h='';
  if(data.sourceFile)h+='<div class="vars-status">'+escapeHtml(data.sourceFile)+'</div>';
  h+=renderVarsSection('开关 (Switches)',data.switches,search);
  h+=renderVarsSection('变量 (Variables)',data.variables,search);
  if(!h)h='<div class="vars-no-results">无匹配结果</div>';
  varsContent.innerHTML=h;
  varsContent.querySelectorAll('.vars-group-header').forEach(function(el){el.addEventListener('click',function(){el.classList.toggle('collapsed');});});
}

/* ─── Template Helpers ──────────────────────────────────────────────── */
function getAllTemplates() {
  const custom = loadCustomTemplates();
  return { presets: PRESET_TEMPLATES, custom: custom };
}

function getTemplatesForCategory(catId) {
  const all = getAllTemplates();
  const presets = all.presets.filter(t => t.category === catId);
  const custom = all.custom.filter(t => t.category === catId || t.category === 'all');
  return { presets, custom };
}

/* ─── Template Dropdown ─────────────────────────────────────────────── */
function buildTemplateDropdownHTML(filterCategory) {
  let html = '';
  const all = getAllTemplates();

  let presets = all.presets;
  let custom = all.custom;

  if (filterCategory) {
    presets = presets.filter(t => t.category === filterCategory);
  }

  if (presets.length > 0) {
    html += '<div class="dropdown-section-label">预置模板</div>';
    presets.forEach(t => {
      const preview = t.content.replace(/\n/g, ' ↵ ').substring(0, 50);
      html += `<div class="dropdown-item template-item" data-template-id="${t.id}" data-template-content="${escapeHtml(t.content)}">`;
      html += `<span class="template-item-name">${escapeHtml(t.name)}</span>`;
      html += `<span class="template-item-preview">${escapeHtml(preview)}</span>`;
      html += '</div>';
    });
  }

  if (custom.length > 0) {
    if (presets.length > 0) html += '<div class="dropdown-divider"></div>';
    html += '<div class="dropdown-section-label">自定义模板</div>';
    custom.forEach(t => {
      const preview = t.content.replace(/\n/g, ' ↵ ').substring(0, 50);
      html += `<div class="dropdown-item template-item" data-template-id="${t.id}" data-template-content="${escapeHtml(t.content)}">`;
      html += `<span class="template-item-name">${escapeHtml(t.name)}</span>`;
      html += `<span class="template-item-preview">${escapeHtml(preview)}</span>`;
      html += `<button class="template-item-del" data-custom-id="${t.id}" title="删除自定义模板">&times;</button>`;
      html += '</div>';
    });
  }

  if (!html) {
    html = '<div class="dropdown-item dropdown-empty">暂无模板</div>';
  }

  return html;
}

/* ─── Category Template Menu ────────────────────────────────────────── */
function buildCategoryTemplateMenuHTML(catId) {
  const templates = getTemplatesForCategory(catId);
  let html = '';

  templates.presets.forEach(t => {
    const preview = t.content.replace(/\n/g, ' ↵ ').substring(0, 40);
    html += `<div class="cat-template-item" data-content="${escapeHtml(t.content)}">`;
    html += `<span class="cat-template-name">${escapeHtml(t.name)}</span>`;
    html += `<span class="cat-template-preview">${escapeHtml(preview)}</span>`;
    html += '</div>';
  });

  templates.custom.forEach(t => {
    const preview = t.content.replace(/\n/g, ' ↵ ').substring(0, 40);
    html += `<div class="cat-template-item" data-content="${escapeHtml(t.content)}">`;
    html += `<span class="cat-template-name">${escapeHtml(t.name)} <span class="cat-template-custom-badge">自定义</span></span>`;
    html += `<span class="cat-template-preview">${escapeHtml(preview)}</span>`;
    html += '</div>';
  });

  if (!html) {
    html = '<div class="cat-template-empty">该分类暂无模板</div>';
  }

  return html;
}

function attachCategoryMenuEvents(menu, catId) {
  menu.querySelectorAll('.cat-template-item').forEach(item => {
    item.addEventListener('click', () => {
      insertTemplate(item.dataset.content);
      closeCategoryTemplateMenu();
    });
  });
}

function showCategoryTemplateMenu(catId, btnEl) {
  closeCategoryTemplateMenu();
  const menu = document.createElement('div');
  menu.className = 'cat-template-menu';
  menu.dataset.catId = catId;
  menu.innerHTML = buildCategoryTemplateMenuHTML(catId);
  attachCategoryMenuEvents(menu, catId);
  btnEl.parentNode.appendChild(menu);
  activeCategoryMenu = menu;
}

function closeCategoryTemplateMenu() {
  if (activeCategoryMenu) {
    activeCategoryMenu.remove();
    activeCategoryMenu = null;
  }
}

/* ─── Tag Panel Rendering (with template 📋 buttons) ────────────────── */
function renderTagPanel(tags, categories) {
  tagList.innerHTML = '';

  // Determine filter
  const filterVal = tagFilter.value;
  const searchVal = tagSearch.value.toLowerCase().trim();

  categories.forEach(cat => {
    let catTags = tags.filter(t => t.category === cat.id);
    if (filterVal !== 'all' && cat.id !== filterVal) {
      // If filtering to a specific category, only show that one
      if (filterVal !== cat.id) return;
    }
    // Search filter
    if (searchVal) {
      catTags = catTags.filter(t =>
        t.name.toLowerCase().includes(searchVal) ||
        t.desc.toLowerCase().includes(searchVal)
      );
    }
    if (catTags.length === 0 && !searchVal) return;
    if (catTags.length === 0 && searchVal) return; // hide empty categories during search

    const group = document.createElement('div');
    group.className = 'tag-category';

    const header = document.createElement('div');
    header.className = 'tag-category-header';
    header.innerHTML = `
      <span class="cat-arrow">▼</span>
      <span class="cat-icon">${cat.icon}</span>
      <span class="cat-label">${cat.label}</span>
      <span class="cat-count">${catTags.length}</span>
      <button class="cat-template-btn" title="该分类的模板片段" data-cat-id="${cat.id}">📋</button>
    `;

    // Restore collapse state
    const collapseKey = `t2f_collapse_${cat.id}`;
    if (localStorage.getItem(collapseKey) === 'true') {
      header.classList.add('collapsed');
    }
    header.addEventListener('click', (e) => {
      if (e.target.closest('.cat-template-btn')) return;
      header.classList.toggle('collapsed');
      localStorage.setItem(collapseKey, header.classList.contains('collapsed'));
    });
    group.appendChild(header);

    // Template button click
    const tmplBtn = header.querySelector('.cat-template-btn');
    tmplBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      showCategoryTemplateMenu(cat.id, tmplBtn);
    });

    const body = document.createElement('div');
    body.className = 'tag-category-body';

    catTags.forEach(tag => {
      const pill = document.createElement('span');
      pill.className = 'tag-pill';
      pill.textContent = tag.name;
      pill.title = tag.desc + (tag.example ? `\n示例: ${tag.example}` : '');
      pill.addEventListener('click', () => insertTag(tag));
      body.appendChild(pill);
    });
    group.appendChild(body);
    tagList.appendChild(group);
  });
}

/* ─── Filter / Search ──────────────────────────────────────────────── */
function applyFilterAndSearch() {
  renderTagPanel(TAGS, CATEGORIES);
}

/* ─── Export .txt ──────────────────────────────────────────────────── */
function exportTxt(content, filename) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function generateZip(files) {
  var enc = new TextEncoder();
  var locs = [], cents = [], entries = [];
  var now = new Date();
  var DOS_TIME = ((now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >>> 1));
  var DOS_DATE = (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
  function w16(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255;}
  function w32(a,o,v){a[o]=v&255;a[o+1]=(v>>>8)&255;a[o+2]=(v>>>16)&255;a[o+3]=(v>>>24)&255;}
  var crcTab = new Uint32Array(256);
  for(var i=0;i<256;i++){var c=i;for(var j=0;j<8;j++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;crcTab[i]=c;}
  function crc32(d){var crc=0xffffffff;for(var i=0;i<d.length;i++)crc=crcTab[(crc^d[i])&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
  var localOffset = 0;
  for(var i=0;i<files.length;i++){
    var nU=enc.encode(files[i].name), dU=enc.encode(files[i].content);
    var crc=crc32(dU), nL=nU.length, dL=dU.length;
    var local=new Uint8Array(30+nL+dL);
    local[0]=0x50;local[1]=0x4b;local[2]=0x03;local[3]=0x04;
    w16(local,4,20);w16(local,6,2048);w16(local,8,0);
    w16(local,10,DOS_TIME);w16(local,12,DOS_DATE);
    w32(local,14,crc);w32(local,18,dL);w32(local,22,dL);
    w16(local,26,nL);w16(local,28,0);
    local.set(nU,30);local.set(dU,30+nL);
    locs.push(local);
    entries.push({name:nU, crc:crc, offset:localOffset, size:dL});
    localOffset += 30+nL+dL;
  }
  var centralSize = 0;
  for(var i=0;i<entries.length;i++){
    var e=entries[i], nL=e.name.length;
    var cent=new Uint8Array(46+nL);
    cent[0]=0x50;cent[1]=0x4b;cent[2]=0x01;cent[3]=0x02;
    w16(cent,4,20);w16(cent,6,20);w16(cent,8,2048);w16(cent,10,0);
    w16(cent,12,DOS_TIME);w16(cent,14,DOS_DATE);
    w32(cent,16,e.crc);w32(cent,20,e.size);w32(cent,24,e.size);
    w16(cent,28,nL);w16(cent,30,0);w16(cent,32,0);
    w16(cent,34,0);w16(cent,36,0);w32(cent,38,0);
    w32(cent,42,e.offset);cent.set(e.name,46);
    cents.push(cent);
    centralSize += 46+nL;
  }
  var allParts = locs.concat(cents);
  var eocd=new Uint8Array(22);
  eocd[0]=0x50;eocd[1]=0x4b;eocd[2]=0x05;eocd[3]=0x06;
  w16(eocd,4,0);w16(eocd,6,0);
  w16(eocd,8,files.length);w16(eocd,10,files.length);
  w32(eocd,12,centralSize);w32(eocd,16,localOffset);
  w16(eocd,20,0);
  allParts.push(eocd);
  return new Blob(allParts,{type:"application/zip"});
}

function exportAllAsZip() {
  var active = getActiveTab();
  if (active) active.content = editor.value;
  if (tabs.length === 0) { setStatus('没有可导出的标签页'); return; }
  var now = new Date();
  var dateStr = now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0')+'-'+String(now.getDate()).padStart(2,'0');
  var files = tabs.map(function(t){return{name:(t.name||'untitled').replace(/[\/:*?"<>|]/g,'_')+'.txt',content:t.content||''};});
  var blob = generateZip(files);
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'Text2Frame_剧本_' + dateStr + '.zip';
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setStatus('已导出 ' + tabs.length + ' 个文件为 ZIP');
}

function exportCurrentTab() {
  const tab = getActiveTab();
  if (!tab) return;
  tab.content = editor.value;
  exportTxt(tab.content, `${tab.name}.txt`);
  setStatus(`已导出 "${tab.name}.txt"`);
}

/* ─── Export / Import Custom Templates ──────────────────────────────── */
function exportCustomTemplates() {
  const custom = loadCustomTemplates();
  if (custom.length === 0) {
    setStatus('暂无自定义模板可导出');
    return;
  }
  const json = JSON.stringify(custom, null, 2);
  const blob = new Blob([json], { type: 'application/json;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'Text2Frame-自定义模板.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  setStatus(`已导出 ${custom.length} 个自定义模板`);
}

function importCustomTemplates(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const imported = JSON.parse(e.target.result);
      if (!Array.isArray(imported)) {
        setStatus('导入失败：文件格式不正确');
        return;
      }
      // Validate each item has required fields
      const valid = imported.filter(t => t.name && t.content);
      if (valid.length === 0) {
        setStatus('导入失败：未找到有效的模板数据');
        return;
      }
      // Merge with existing (imported items get new IDs to avoid conflicts)
      const existing = loadCustomTemplates();
      valid.forEach(t => {
        const newId = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
        existing.push({ id: newId, name: t.name, category: 'custom', content: t.content });
      });
      saveCustomTemplates(existing);
      setStatus(`已导入 ${valid.length} 个自定义模板`);
      // Refresh template dropdown if open
      if (templateDropdownOpen) {
        renderTemplateDropdown(null);
      }
      // Refresh any open category menus
      document.querySelectorAll('.cat-template-menu').forEach(menu => {
        const catId = menu.dataset.catId;
        menu.innerHTML = buildCategoryTemplateMenuHTML(catId);
        attachCategoryMenuEvents(menu, catId);
      });
    } catch (err) {
      setStatus('导入失败：JSON 解析错误');
    }
  };
  reader.readAsText(file, 'UTF-8');
}

/* ─── Open .txt ────────────────────────────────────────────────────── */
function openTxt() {
  fileInput.click();
}

/* ─── Auto-Save ────────────────────────────────────────────────────── */
function scheduleSave() {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(saveState, SAVE_DELAY);
  // Debounced undo snapshot for continuous typing
  if (!isUndoingRedoing) {
    clearTimeout(undoRecordTimer);
    undoRecordTimer = setTimeout(() => recordUndoSnapshot(false), 600);
  }
}

function saveState() {
  // Save current tab content
  const tab = getActiveTab();
  if (tab) tab.content = editor.value;

  // Build state object
  const state = {
    version: 1,
    tabs: tabs.map(t => ({
      id: t.id,
      name: t.name,
      content: t.content,
    })),
    activeTabId: activeTabId,
    tabIdCounter: tabIdCounter,
  };

  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
    const now = new Date();
    statusSaved.textContent = `上次保存: ${now.toLocaleTimeString()}`;
    statusAutoSave.textContent = '已自动保存';
  } catch (e) {
    console.warn('Auto-save failed:', e);
    statusAutoSave.textContent = '自动保存失败';
  }
}

function loadState() {
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return false;
    const state = JSON.parse(raw);
    if (!state || !state.tabs || state.tabs.length === 0) return false;

    tabs = state.tabs;
    tabIdCounter = state.tabIdCounter || tabs.length;
    activeTabId = state.activeTabId;

    // Restore content to editor
    const tab = getActiveTab();
    if (tab) editor.value = tab.content;

    renderTabs();
    syncEditor();
    statusAutoSave.textContent = '已恢复自动保存';
    return true;
  } catch (e) {
    console.warn('Failed to load state:', e);
    return false;
  }
}

/* ─── Status helpers ────────────────────────────────────────────────── */
function setStatus(msg) {
  toolbarStatus.textContent = msg;
  if (statusClearTimer) clearTimeout(statusClearTimer);
  statusClearTimer = setTimeout(() => {
    toolbarStatus.textContent = '就绪';
  }, 3000);
}
let statusClearTimer = null;

/* ─── Keyboard Shortcuts ───────────────────────────────────────────── */
function handleKeyboard(e) {
  const isCtrl = e.ctrlKey || e.metaKey;

  // Close dropdowns on Escape
  if (e.key === 'Escape') {
    if (templateDropdownOpen) { closeTemplateDropdown(); e.preventDefault(); return; }
    if (activeCategoryMenu) { closeCategoryTemplateMenu(); e.preventDefault(); return; }
      if (outlinePanel && outlinePanel.classList.contains('outline-open')) {
        outlinePanel.classList.remove('outline-open');
        if (outlineToggle) outlineToggle.classList.remove('outline-active');
        e.preventDefault(); return;
      }
  }

  if (isCtrl && e.key === 'z') {
    e.preventDefault();
    e.shiftKey ? performRedo() : performUndo();
    return;
  }

  if (isCtrl && e.key === 's') {
    e.preventDefault();
    if (e.shiftKey) {
      // Export all as ZIP
      exportAllAsZip();
    } else {
      exportCurrentTab();
    }
    return;
  }

  if (isCtrl && e.key === 'o') {
    e.preventDefault();
    openTxt();
    return;
  }

  if (isCtrl && e.key === 'n') {
    e.preventDefault();
    addTab();
    setStatus('已创建新标签页');
    return;
  }

  if (isCtrl && e.key === 'w') {
    e.preventDefault();
    const tab = getActiveTab();
    if (tab) deleteTab(tab.id);
    return;
  }

  if (isCtrl && e.key === 'f') {
    e.preventDefault();
    tagSearch.focus();
    tagSearch.select();
    return;
  }
}

/* ─── Custom Template Dialog ────────────────────────────────────────── */
function openTemplateDialog() {
  const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
  if (!selected || selected.trim().length === 0) {
    setStatus('请先在编辑器中选中要保存的文本');
    return;
  }
  templateDialogOverlay.classList.remove('hidden');
  templateDialogInput.value = '';
  templateDialogInput.focus();
}

function closeTemplateDialog() {
  templateDialogOverlay.classList.add('hidden');
  templateDialogInput.value = '';
}

function confirmTemplateDialog() {
  const name = templateDialogInput.value.trim();
  if (!name) {
    templateDialogInput.focus();
    templateDialogInput.style.borderColor = 'var(--danger)';
    return;
  }
  const selected = editor.value.substring(editor.selectionStart, editor.selectionEnd);
  if (!selected) {
    closeTemplateDialog();
    setStatus('保存失败：未选中文本');
    return;
  }
  addCustomTemplate(name, selected);
  templateDialogInput.style.borderColor = '';
  closeTemplateDialog();
  setStatus(`已保存自定义模板 "${name}"`);
}

/* ─── Event Binding ────────────────────────────────────────────────── */
function initEvents() {
  // Editor input
    editor.addEventListener('input', function() {
    syncEditor();
    scheduleSave();
    scheduleOutlineUpdate();
  });;
  editor.addEventListener('scroll', () => {
    lineNumbers.scrollTop = editor.scrollTop;
    syncHighlightScroll();
  });

  // Tab management
  tabAdd.addEventListener('click', () => addTab());

  // File operations
  btnOpen.addEventListener('click', openTxt);
  btnExport.addEventListener('click', exportCurrentTab);
    btnExportAll.addEventListener('click', exportAllAsZip);
  // File input
  fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const content = ev.target.result;
      const tabName = file.name.replace(/\.txt$/i, '');
      const id = addTab(tabName);
      const tab = getTab(id);
      tab.content = content;
      editor.value = content;
      syncEditor();
      scheduleSave();
      setStatus(`已打开 "${file.name}"`);
    };
    reader.readAsText(file, 'UTF-8');
    fileInput.value = '';
  });

  // Tag search / filter
  tagSearch.addEventListener('input', applyFilterAndSearch);
  tagFilter.addEventListener('change', applyFilterAndSearch);

  // Undo / Redo buttons
  const undoBtn = document.getElementById('btn-undo');
  const redoBtn = document.getElementById('btn-redo');
  if (undoBtn) undoBtn.addEventListener('click', performUndo);
  if (redoBtn) redoBtn.addEventListener('click', performRedo);
  updateUndoButtons();

  // Panel tab switching
  panelTabs.forEach(function(tab) {
    tab.addEventListener('click', function() {
      switchPanel(this.dataset.tab);
    });
  });
  if (btnImportSystem) btnImportSystem.addEventListener('click', importSystemJson);
  if (btnClearVars) btnClearVars.addEventListener('click', clearVarsCache);
  if (systemJsonInput) {
    systemJsonInput.addEventListener('change', function(e) {
      var file = e.target.files[0]; if (!file) return;
      var reader = new FileReader();
      reader.onload = function(ev) { parseSystemJson(ev.target.result, file.name); };
      reader.readAsText(file, 'UTF-8');
      systemJsonInput.value = '';
    });
  }
  if (varsSearch) {
    varsSearch.addEventListener('input', function() { renderVarsPanel(); });
  }

  // Outline toggle
  if (outlineToggle) {
    outlineToggle.addEventListener('click', function() {
      var isOpen = outlinePanel.classList.contains('outline-open');
      if (isOpen) {
        outlinePanel.classList.remove('outline-open');
        outlineToggle.classList.remove('outline-active');
      } else {
        outlinePanel.classList.add('outline-open');
        outlineToggle.classList.add('outline-active');
        renderOutline();
      }
    });
  }
  if (outlineClose) {
    outlineClose.addEventListener('click', function() {
      outlinePanel.classList.remove('outline-open');
      if (outlineToggle) outlineToggle.classList.remove('outline-active');
    });
  }

  // Template button
  btnTemplate.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleTemplateDropdown();
  });

  // Save template button
  btnSaveTemplate.addEventListener('click', openTemplateDialog);
  // Export / Import custom templates
  btnExportCustom.addEventListener('click', exportCustomTemplates);
  btnImportCustom.addEventListener('click', () => importCustomInput.click());
  importCustomInput.addEventListener('change', (e) => {
    importCustomTemplates(e.target.files[0]);
    importCustomInput.value = '';
  });

  // Template dialog
  templateDialogConfirm.addEventListener('click', confirmTemplateDialog);
  templateDialogCancel.addEventListener('click', closeTemplateDialog);
  templateDialogInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); confirmTemplateDialog(); }
    if (e.key === 'Escape') { closeTemplateDialog(); }
  });
  templateDialogOverlay.addEventListener('click', (e) => {
    if (e.target === templateDialogOverlay) closeTemplateDialog();
  });

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    if (templateDropdownOpen && !e.target.closest('.tag-panel-template-wrap')) {
      closeTemplateDropdown();
    }
    if (activeCategoryMenu && !e.target.closest('.cat-template-menu') && !e.target.closest('.cat-template-btn')) {
      closeCategoryTemplateMenu();
    }
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);

  // Record snapshot on paste
  editor.addEventListener('paste', () => {
    setTimeout(() => recordUndoSnapshot(true), 0);
  });

  // Save before unload
  window.addEventListener('beforeunload', () => {
    const tab = getActiveTab();
    if (tab) tab.content = editor.value;
    saveState();
  });
}

/* ─── Init ─────────────────────────────────────────────────────────── */
function init() {
  // Populate filter dropdown
  CATEGORIES.forEach(cat => {
    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.label;
    tagFilter.appendChild(opt);
  });

  // Try to restore from localStorage
  const restored = loadState();

  if (!restored) {
    addTab('场景 1');
  }

  // Render tag panel
  renderTagPanel(TAGS, CATEGORIES);

  // Record initial state for undo
  recordUndoSnapshot(true);

  // Restore vars from cache
  loadVarsCache();

  // Initial highlight and outline
  updateHighlight();
  scheduleOutlineUpdate();

  // Bind events
  initEvents();

  // Sync editor display
  syncEditor();
}

// Start
document.addEventListener('DOMContentLoaded', init);
