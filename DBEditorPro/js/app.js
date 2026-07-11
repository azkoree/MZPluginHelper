/**
 * RMMZ 数据库编辑器 Pro
 * =====================
 * 整合 DatabaseNoter（卡片式备注编辑）和 DBManager（表格字段编辑）
 *
 * 视图模式：
 *   卡片视图 (card) — 传统卡片式，双栏编辑 note（属性配置 / 物品描述）
 *   表格视图 (table) — 数据表格，可编辑除 note 外的所有字段，双行表头含中文注释
 *
 * 导入方式：
 *   1. 选择 .json 文件导入
 *   2. 选择游戏项目的 data/ 文件夹批量导入
 *
 * 支持的数据库：Actors, Armors, Classes, Enemies, Items, Skills, States, Tilesets, Weapons
 */

(function () {
  'use strict';

  // ==================================================================
  // 1. 常量
  // ==================================================================

  /** 有效的 RMMZ 数据库文件名 */
  var VALID_NAMES = new Set([
    'Actors', 'Armors', 'Classes', 'Enemies', 'Items',
    'Skills', 'States', 'Tilesets', 'Weapons'
  ]);

  /** note 字段分隔符 */
  var NOTE_SEPARATOR = '\n---------\n';

  /** note 解析正则 */
  var NOTE_RE = /^【属性配置】\n([\s\S]*?)\n---------\n【物品描述】\n([\s\S]*)$/;

  /** 字段中文名映射 */
  var FIELD_LABELS = {
    id: 'ID',
    name: '名称',
    iconIndex: '图标',
    note: '备注',
    description: '描述',
    // 角色
    battlerName: '战斗图',
    characterIndex: '角色索引',
    characterName: '角色图',
    classId: '职业',
    equips: '装备',
    faceIndex: '脸图索引',
    faceName: '脸图',
    traits: '特性',
    initialLevel: '初始等级',
    maxLevel: '最大等级',
    nickname: '昵称',
    profile: '简介',
    params: '参数',
    // 物品
    animationId: '动画',
    consumable: '消耗品',
    effects: '效果',
    hitType: '命中类型',
    itypeId: '物品类型',
    occasion: '使用时机',
    price: '价格',
    repeats: '重复次数',
    scope: '范围',
    speed: '速度',
    successRate: '成功率',
    tpGain: 'TP 获取',
    // 技能
    mpCost: 'MP 消耗',
    stypeId: '技能类型',
    tpCost: 'TP 消耗',
    message1: '消息 1',
    message2: '消息 2',
    messageType: '消息类型',
    requiredWtypeId1: '武器类型 1',
    requiredWtypeId2: '武器类型 2',
    // 武器
    etypeId: '装备类型',
    wtypeId: '武器类型',
    // 护甲
    atypeId: '护甲类型',
    // 敌人
    actions: '行动',
    battlerHue: '色相',
    dropItems: '掉落物品',
    exp: '经验',
    gold: '金币',
    // 状态
    autoRemovalTiming: '自动解除',
    chanceByDamage: '受伤几率',
    maxTurns: '最大回合',
    minTurns: '最小回合',
    motion: '动作',
    overlay: '覆盖',
    priority: '优先级',
    releaseByDamage: '受伤解除',
    removeAtBattleEnd: '战斗结束解除',
    removeByDamage: '受伤解除',
    removeByRestriction: '限制解除',
    removeByWalking: '步数解除',
    restriction: '限制',
    stepsToRemove: '解除步数',
    // 职业
    expParams: '经验曲线',
    learnings: '习得技能',
    // 公共子结构
    code: '代码',
    dataId: '数据 ID',
    value1: '值 1',
    value2: '值 2',
    formula: '公式',
    variance: '方差',
    critical: '暴击',
    elementId: '元素 ID',
    conditionParam1: '条件参数 1',
    conditionParam2: '条件参数 2',
    conditionType: '条件类型',
    rating: '评级',
    skillId: '技能 ID',
    denominator: '分母',
    level: '等级',
    kind: '类型',
    damage: '伤害'
  };

  /** 标准 MZ 数据库字段白名单 */
  var TYPE_FIELDS = {
    Actors: ['id', 'name', 'nickname', 'classId', 'initialLevel', 'maxLevel',
             'faceName', 'faceIndex', 'characterName', 'characterIndex',
             'battlerName', 'traits', 'equips', 'params', 'profile',
             'note', 'description'],
    Classes: ['id', 'name', 'expParams', 'params', 'traits', 'learnings', 'note'],
    Skills: ['id', 'name', 'iconIndex', 'description', 'stypeId', 'mpCost', 'tpCost', 'tpGain',
             'speed', 'successRate', 'repeats', 'hitType', 'animationId',
             'damage', 'effects', 'scope', 'occasion', 'message1', 'message2',
             'messageType', 'requiredWtypeId1', 'requiredWtypeId2',
             'note'],
    Items: ['id', 'name', 'iconIndex', 'description', 'itypeId', 'price', 'consumable',
            'speed', 'successRate', 'repeats', 'hitType', 'animationId',
            'damage', 'effects', 'scope', 'occasion', 'tpGain',
            'note'],
    Weapons: ['id', 'name', 'iconIndex', 'description', 'wtypeId', 'etypeId', 'animationId',
              'price', 'traits', 'params',
              'note'],
    Armors: ['id', 'name', 'iconIndex', 'description', 'atypeId', 'etypeId',
             'price', 'traits', 'params',
             'note'],
    Enemies: ['id', 'name', 'battlerName', 'battlerHue', 'traits', 'params',
              'exp', 'gold', 'dropItems', 'actions',
              'note'],
    States: ['id', 'name', 'iconIndex', 'description', 'traits',
             'priority', 'restriction', 'overlay', 'motion',
             'removeAtBattleEnd', 'removeByRestriction', 'removeByDamage',
             'releaseByDamage', 'removeByWalking', 'stepsToRemove',
             'autoRemovalTiming', 'minTurns', 'maxTurns', 'chanceByDamage',
             'message1', 'message2', 'message3', 'message4', 'messageType',
             'note'],
  };

  /** 表格视图隐藏的列（不显示在表格中） */
  var HIDDEN_FIELDS = { note: true };

  // ==================================================================
  // 2. 状态
  // ==================================================================

  var state = {
    files: {},           // { fileName: { entries, rawData, rows, modified, dbType } }
    currentFile: null,   // 当前标签页文件名
    viewMode: 'card',    // 'card' | 'table'
    activeEntryId: null, // 当前高亮的条目 id
    collapsedEntries: {} // { fileName: Set<entryId> } 卡片折叠状态
  };

  // 数组编辑器状态
  var _arrayEditState = null;

  // ==================================================================
  // 3. DOM 引用
  // ==================================================================

  var $  = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return document.querySelectorAll(sel); };

  var btnImport        = $('#btnImport');
  var btnImportProject = $('#btnImportProject');
  var btnViewToggle    = $('#btnViewToggle');
  var btnExport        = $('#btnExport');
  var btnExportZip     = $('#btnExportZip');
  var fileInput        = $('#fileInput');
  var projectInput     = $('#projectInput');
  var sidebarNav       = $('#sidebarNav');
  var editorArea       = $('#editorArea');
  var dialogOver       = $('#confirmDialog');
  var dialogMsg        = $('#confirmMessage');
  var dialogYes        = $('#confirmYes');
  var dialogNo         = $('#confirmNo');

  // ==================================================================
  // 4. 工具函数
  // ==================================================================

  function extractBaseName(filename) {
    var name = filename.replace(/^.*[\\/]/, '');
    var dotIdx = name.lastIndexOf('.');
    return dotIdx > 0 ? name.slice(0, dotIdx) : name;
  }

  function isValidFile(filename) {
    return VALID_NAMES.has(extractBaseName(filename));
  }

  function detectType(name) {
    var map = {
      actors: 'Actors', items: 'Items', skills: 'Skills',
      weapons: 'Weapons', armors: 'Armors', enemies: 'Enemies',
      states: 'States', classes: 'Classes'
    };
    return map[name.replace(/\.json$/i, '').toLowerCase()] || 'Unknown';
  }

  function parseNote(rawNote) {
    if (!rawNote) return { configNote: '', descNote: '', importHint: false };
    var match = rawNote.match(NOTE_RE);
    if (match) {
      return { configNote: match[1], descNote: match[2], importHint: false };
    }
    return { configNote: '', descNote: rawNote, importHint: true };
  }

  function buildNote(configNote, descNote) {
    var cfg = configNote || '';
    var desc = descNote || '';
    if (!cfg && !desc) return '';
    return '【属性配置】\n' + cfg + '\n---------\n【物品描述】\n' + desc;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function isPrimitive(v) {
    return v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
  }

  function looseEqual(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && isNaN(a) && typeof b === 'number' && isNaN(b)) return true;
    return String(a) === String(b);
  }

  function restoreValue(raw, orig) {
    if (typeof orig === 'number') {
      var n = parseFloat(raw);
      return isNaN(n) ? (raw === '' ? 0 : raw) : n;
    }
    if (typeof orig === 'boolean') {
      if (raw.toLowerCase() === 'true') return true;
      if (raw.toLowerCase() === 'false') return false;
      return raw;
    }
    return raw;
  }

  function formatCell(val) {
    return (val === null || val === undefined) ? '' : String(val);
  }

  /**
   * 收集表格视图的字段列表（排除 HIDDEN_FIELDS）
   */
  function collectFields(data, dbType) {
    if (TYPE_FIELDS[dbType]) {
      return TYPE_FIELDS[dbType].filter(function (f) { return !HIDDEN_FIELDS[f]; });
    }
    var keySet = new Set();
    data.forEach(function (row) {
      if (row && typeof row === 'object') Object.keys(row).forEach(function (k) { keySet.add(k); });
    });
    var priority = ['id', 'name', 'iconIndex', 'description'];
    var ordered = [];
    var rest = [];
    keySet.forEach(function (k) {
      if (HIDDEN_FIELDS[k]) return;
      var idx = priority.indexOf(k);
      if (idx >= 0) ordered[idx] = k;
      else rest.push(k);
    });
    var filtered = ordered.filter(function (k) { return k !== undefined; });
    if (filtered[0] !== 'id') {
      var idIdx = filtered.indexOf('id');
      if (idIdx > 0) { filtered.splice(idIdx, 1); filtered.unshift('id'); }
    }
    return filtered.concat(rest.sort());
  }

  function uniqueFileName(baseName) {
    if (!state.files[baseName]) return baseName;
    var i = 2;
    while (state.files[baseName.replace(/\.json$/i, '') + '_' + i]) { i++; }
    return baseName.replace(/\.json$/i, '') + '_' + i;
  }

  // ==================================================================
  // 5. 确认对话框
  // ==================================================================

  function confirmDialog(message) {
    return new Promise(function (resolve) {
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

  // ==================================================================
  // 6. 导入逻辑
  // ==================================================================

  /**
   * 从 JSON 数据构建内部状态
   */
  function buildFileData(baseName, json) {
    var rawData = json;
    var rows = Array.isArray(json)
      ? json.filter(function (r) { return r !== null && typeof r === 'object'; })
      : [];
    var entries = [];

    rows.forEach(function (item) {
      var parsed = parseNote(item.note || '');
      entries.push({
        id: item.id,
        name: item.name || '',
        original: item,
        configNote: parsed.configNote,
        descNote: parsed.descNote,
        importHint: parsed.importHint
      });
    });

    entries.sort(function (a, b) { return a.id - b.id; });

    return {
      entries: entries,
      rawData: rawData,
      rows: rows,
      modified: new Map(),
      dbType: detectType(baseName)
    };
  }

  /**
   * 处理文件导入（批量）
   */
  function importFiles(files) {
    var accepted = [];
    var rejected = [];

    // 用 Promise 链处理异步
    var chain = Promise.resolve();

    [].forEach.call(files, function (file) {
      if (!isValidFile(file.name)) {
        rejected.push(file.name);
        return;
      }

      var baseName = extractBaseName(file.name);

      chain = chain.then(function () {
        if (state.files[baseName]) {
          return confirmDialog('文件「' + baseName + '.json」已经导入，是否替换？').then(function (ok) {
            if (!ok) return false;
            return readFileAsText(file).then(function (text) {
              return { baseName: baseName, text: text };
            });
          });
        }
        return readFileAsText(file).then(function (text) {
          return { baseName: baseName, text: text };
        });
      }).then(function (result) {
        if (result === false) return;
        try {
          var json = JSON.parse(result.text);
          accepted.push({ baseName: result.baseName, json: json });
        } catch (err) {
          console.error('解析 ' + file.name + ' 失败:', err);
          rejected.push(file.name + '（格式错误）');
        }
      });
    });

    return chain.then(function () {
      // 存入 state
      accepted.forEach(function (item) {
        state.files[item.baseName] = buildFileData(item.baseName, item.json);
      });

      // 设置当前文件
      if (accepted.length > 0) {
        if (!state.currentFile || !state.files[state.currentFile]) {
          state.currentFile = accepted[0].baseName;
        }
      }

      // 刷新 UI
      updateUI();
      updateExportButton();

      // 提示被拒绝的文件
      if (rejected.length > 0) {
        alert('以下文件无法导入：\n' + rejected.join('\n'));
      }
    });
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function (e) { resolve(e.target.result); };
      reader.onerror = function () { reject(new Error('读取失败')); };
      reader.readAsText(file, 'UTF-8');
    });
  }

  /**
   * 导入项目（通过 webkitdirectory 选择 data/ 文件夹）
   */
  function importProject(files) {
    var matched = [];
    [].forEach.call(files, function (file) {
      if (isValidFile(file.name)) {
        matched.push(file);
      }
    });

    if (matched.length === 0) {
      alert('所选文件夹中没有找到有效的数据库文件。\n\n支持的数据库：\n' +
        Array.from(VALID_NAMES).join('、'));
      return;
    }

    return importFiles(matched);
  }

  // ==================================================================
  // 7. 侧边栏渲染
  // ==================================================================

  function renderSidebar() {
    if (!state.currentFile || !state.files[state.currentFile]) {
      sidebarNav.innerHTML = '<div class="sidebar-empty">暂无导入文件<br>请点击上方「导入 JSON」或「导入项目」</div>';
      var headerEl = document.querySelector('.sidebar-header');
      if (headerEl) headerEl.textContent = '已导入的文件';
      return;
    }

    var fileName = state.currentFile;
    var fileData = state.files[fileName];
    var headerEl = document.querySelector('.sidebar-header');
    if (headerEl) {
      headerEl.textContent = fileName + '.json（' + fileData.entries.length + ' 条）';
    }

    var html = '';
    fileData.entries.forEach(function (entry) {
      var label = entry.name || '#' + String(entry.id).padStart(3, '0');
      var isActive = entry.id === state.activeEntryId;
      html += '<a class="sidebar-file-entry' + (isActive ? ' active' : '') + '" data-action="go-entry" data-file="' + escapeHtml(fileName) + '" data-id="' + entry.id + '">';
      html += String(entry.id).padStart(3, '0') + ': ' + escapeHtml(label);
      html += '</a>';
    });

    sidebarNav.innerHTML = html;
  }

  // ==================================================================
  // 8. 视图切换
  // ==================================================================

  function toggleViewMode() {
    // 没有数据时不允许切换
    if (Object.keys(state.files).length === 0) return;

    // 从表格切到卡片前，同步 name 修改
    if (state.viewMode === 'table') {
      syncNameFromTableToEntries();
    }

    state.viewMode = (state.viewMode === 'card') ? 'table' : 'card';
    btnViewToggle.textContent = (state.viewMode === 'card') ? '🔄 表格视图' : '🔄 卡片视图';
    btnViewToggle.title = (state.viewMode === 'card') ? '切换到表格视图' : '切换到卡片视图';

    renderEditor();
  }

  /**
   * 表格视图 → 卡片视图时，将 modified 中的 name 变更同步到 entries
   */
  function syncNameFromTableToEntries() {
    var fileName = state.currentFile;
    if (!fileName || !state.files[fileName]) return;
    var fileData = state.files[fileName];

    fileData.modified.forEach(function (val, key) {
      var dot = key.indexOf('.');
      var id = parseInt(key.slice(0, dot), 10);
      var field = key.slice(dot + 1);
      if (field === 'name') {
        var entry = fileData.entries.find(function (e) { return e.id === id; });
        if (entry) entry.name = val;
      }
    });
  }

  // ==================================================================
  // 9. 编辑区渲染（入口）
  // ==================================================================

  function renderEditor() {
    var fileNames = Object.keys(state.files);

    if (fileNames.length === 0) {
      editorArea.innerHTML =
        '<div class="editor-placeholder">' +
          '<p>请先导入数据库 JSON 文件</p>' +
          '<p class="hint">支持：Actors、Armors、Classes、Enemies、Items、Skills、States、Tilesets、Weapons</p>' +
        '</div>';
      return;
    }

    if (!state.currentFile || !state.files[state.currentFile]) {
      state.currentFile = fileNames[0];
    }

    if (state.viewMode === 'card') {
      renderCardView();
    } else {
      renderTableView();
    }
  }

  /** 整体刷新 UI（侧边栏 + 编辑区） */
  function updateUI() {
    renderSidebar();
    renderEditor();
  }

  // ==================================================================
  // 10. 卡片视图（来自 DatabaseNoter）
  // ==================================================================

  function renderCardView() {
    var fileNames = Object.keys(state.files).sort();
    if (fileNames.length === 0) return;

    if (!state.currentFile || !state.files[state.currentFile]) {
      state.currentFile = fileNames[0];
    }

    var html = '';

    // 标签页栏
    html += '<div class="tab-bar">';
    fileNames.forEach(function (fileName) {
      var activeClass = fileName === state.currentFile ? ' active' : '';
      html += '<button class="tab' + activeClass + '" data-action="switch-tab" data-file="' + escapeHtml(fileName) + '">' + escapeHtml(fileName) + '.json</button>';
    });
    html += '</div>';

    // 文件面板
    fileNames.forEach(function (fileName) {
      var fileData = state.files[fileName];
      var hiddenAttr = fileName !== state.currentFile ? 'hidden' : '';

      html += '<div class="file-panel"' + (hiddenAttr ? ' hidden' : '') + ' data-panel="' + escapeHtml(fileName) + '">';

      fileData.entries.forEach(function (entry) {
        var idStr = String(entry.id).padStart(3, '0');
        var collapsed = state.collapsedEntries[fileName] && state.collapsedEntries[fileName].has(entry.id);

        html += '<div class="entry-card' + (collapsed ? ' collapsed' : '') + '" id="entry-' + escapeHtml(fileName) + '-' + entry.id + '" data-file="' + escapeHtml(fileName) + '" data-id="' + entry.id + '">';

        // 标题栏
        html += '<div class="entry-header" data-action="toggle-entry" data-file="' + escapeHtml(fileName) + '" data-id="' + entry.id + '">';
        html += '<span class="collapse-icon">' + (collapsed ? '▶' : '▼') + '</span>';
        html += '<span class="entry-id">' + idStr + '</span>';
        html += '<input class="entry-name" type="text" data-field="name" data-file="' + escapeHtml(fileName) + '" data-id="' + entry.id + '" value="' + escapeHtml(entry.name) + '" placeholder="（无名称）" spellcheck="false">';
        if (entry.importHint) {
          html += '<span class="import-hint" title="导入时未能识别格式，原备注内容已全部放入描述框">⚠ 旧格式</span>';
        }
        html += '</div>';

        // 正文
        html += '<div class="entry-body">';
        html += '<div class="note-group">';
        html += '<label>属性配置</label>';
        html += '<textarea data-field="configNote" data-file="' + escapeHtml(fileName) + '" data-id="' + entry.id + '" placeholder="在此输入属性配置...">' + escapeHtml(entry.configNote) + '</textarea>';
        html += '</div>';
        html += '<div class="note-group">';
        html += '<label>物品描述</label>';
        html += '<textarea data-field="descNote" data-file="' + escapeHtml(fileName) + '" data-id="' + entry.id + '" placeholder="在此输入物品描述...">' + escapeHtml(entry.descNote) + '</textarea>';
        html += '</div>';
        html += '</div>';

        html += '</div>';
      });

      html += '</div>';
    });

    editorArea.innerHTML = html;
  }

  function switchTab(fileName) {
    if (!state.files[fileName]) return;
    if (state.currentFile === fileName) return;

    state.currentFile = fileName;
    state.activeEntryId = null;

    // 更新标签页样式
    var tabs = editorArea.querySelectorAll('.tab');
    [].forEach.call(tabs, function (tab) {
      tab.classList.toggle('active', tab.dataset.file === fileName);
    });

    if (state.viewMode === 'card') {
      // 切换面板显示
      var panels = editorArea.querySelectorAll('.file-panel');
      [].forEach.call(panels, function (panel) {
        panel.hidden = panel.dataset.panel !== fileName;
      });
    } else {
      // 表格视图：重新渲染表格
      renderTableView();
    }

    renderSidebar();
    updateExportButton();
  }

  function toggleEntry(fileName, entryId) {
    if (!state.collapsedEntries[fileName]) {
      state.collapsedEntries[fileName] = new Set();
    }
    var set = state.collapsedEntries[fileName];
    if (set.has(entryId)) {
      set.delete(entryId);
    } else {
      set.add(entryId);
    }

    // 局部刷新卡片
    var card = document.querySelector('.entry-card[data-file="' + CSS.escape(fileName) + '"][data-id="' + entryId + '"]');
    if (!card) return;

    var collapsed = set.has(entryId);
    card.classList.toggle('collapsed', collapsed);
    var icon = card.querySelector('.collapse-icon');
    if (icon) icon.textContent = collapsed ? '▶' : '▼';
  }

  // ==================================================================
  // 11. 表格视图（来自 DBManager）
  // ==================================================================

 function renderTableView() {
   var fileName = state.currentFile;
   if (!fileName || !state.files[fileName]) return;

   var db = state.files[fileName];

   var html = '';

    // 标签页栏
    var fileNames = Object.keys(state.files).sort();
    html += '<div class="tab-bar">';
    fileNames.forEach(function (fn) {
      var activeClass = fn === fileName ? ' active' : '';
      html += '<button class="tab' + activeClass + '" data-action="switch-tab" data-file="' + escapeHtml(fn) + '">' + escapeHtml(fn) + '.json</button>';
    });
    html += '</div>';

   // 提示信息
   html += '<div class="view-info-bar">💡 表格视图 — 点击单元格直接编辑 | 数组/对象字段点击编辑 | 📝 note 编辑请切换到卡片视图</div>';

   // 表格容器
   html += '<div class="table-view-container">';
   html += '<div class="table-wrapper">';
   html += '<div class="scrollbar-top-wrap" id="scrollbarTop"><div class="scrollbar-top-track" id="scrollTrack"></div></div>';
   html += '<div class="table-scroll" id="tableScroll"></div>';
   html += '</div>';
   html += '<div class="table-info-bar" id="tableInfoBar"></div>';
   html += '</div>';

   editorArea.innerHTML = html;

   buildTableContent(db);
 }

  function buildTableContent(db) {
    var tableScroll = document.getElementById('tableScroll');
    if (!tableScroll) return;
    tableScroll.innerHTML = '';

    if (!db || !db.rows.length) return;

    var fields = collectFields(db.rows, db.dbType);
    db.fields = fields;

    // ---- 创建表格 ----
    var table = document.createElement('table');
    table.id = 'dataTable';

    // 表头
    var thead = document.createElement('thead');

    // 第1行：英文字段名
    var trHead = document.createElement('tr');
    var thNum = document.createElement('th');
    thNum.textContent = '#';
    thNum.classList.add('id-col');
    trHead.appendChild(thNum);

    fields.forEach(function (f) {
      var th = document.createElement('th');
      th.textContent = f;
      if (f === 'id') th.classList.add('id-col');
      trHead.appendChild(th);
    });
    var thAct = document.createElement('th');
    thAct.textContent = '操作';
    thAct.style.width = '60px';
    trHead.appendChild(thAct);
    thead.appendChild(trHead);

    // 第2行：中文注释
    var trLabel = document.createElement('tr');
    var thNum2 = document.createElement('th');
    thNum2.classList.add('label-row', 'id-col');
    trLabel.appendChild(thNum2);

    fields.forEach(function (f) {
      var th = document.createElement('th');
      th.textContent = FIELD_LABELS[f] || f;
      th.classList.add('label-row');
      if (f === 'id') th.classList.add('id-col');
      trLabel.appendChild(th);
    });
    var thAct2 = document.createElement('th');
    thAct2.classList.add('label-row');
    thAct2.textContent = '';
    thAct2.style.width = '60px';
    trLabel.appendChild(thAct2);
    thead.appendChild(trLabel);

    table.appendChild(thead);

    // ---- 数据体 ----
    var tbody = document.createElement('tbody');

    db.rows.forEach(function (row, i) {
      if (!row || typeof row !== 'object') return;
      var tr = document.createElement('tr');
      tr.dataset.entryId = row.id;

      // 行号
      var tdNum = document.createElement('td');
      tdNum.textContent = i + 1;
      tdNum.classList.add('id-col');
      tr.appendChild(tdNum);

      // 字段
      fields.forEach(function (f) {
        var td = document.createElement('td');
        var val = row[f];
        var modKey = row.id + '.' + f;
        var modVal = db.modified.has(modKey) ? db.modified.get(modKey) : undefined;

        // 当表格视图中有 name 修改时，同步到 entries 用于显示
        if (f === 'name' && modVal !== undefined) {
          var entry = db.entries.find(function (e) { return e.id === row.id; });
          if (entry) entry.name = modVal;
        }

        var displayVal = modVal !== undefined ? modVal : val;

        if (f === 'id') {
          td.textContent = row.id;
          td.classList.add('id-col');
        } else if (Array.isArray(displayVal)) {
          var isObjArr = displayVal.length > 0 && typeof displayVal[0] === 'object';
          if (isObjArr) {
            td.textContent = '[' + displayVal.length + ']';
            td.classList.add('cell-array', 'cell-tip');
            td.setAttribute('data-tip', JSON.stringify(displayVal).slice(0, 300));
            td.style.cursor = 'pointer';
            td.title = '点击编辑';
            (function (_db, _id, _f, _val) {
              td.addEventListener('click', function (e) {
                e.stopPropagation();
                openArrayEditor(_db, _id, _f, _val);
              });
            })(db, row.id, f, displayVal);
          } else {
            td.textContent = JSON.stringify(displayVal);
            td.contentEditable = true;
            td.classList.add('cell-array-json');
            (function (_db, _key, _orig) {
              td.addEventListener('blur', function () {
                var raw = this.textContent.trim();
                try {
                  var parsed = JSON.parse(raw);
                  if (!Array.isArray(parsed)) throw new Error('not array');
                  var changed = !looseEqual(parsed, _orig);
                  if (changed) {
                    _db.modified.set(_key, parsed);
                    this.classList.add('cell-modified');
                  } else {
                    _db.modified.delete(_key);
                    this.classList.remove('cell-modified');
                  }
                } catch (e) {
                  this.textContent = JSON.stringify(_orig);
                }
                updateTabFileInfo(_db);
              });
              td.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
                if (e.key === 'Escape') { this.textContent = JSON.stringify(_orig); this.blur(); }
              });
            })(db, modKey, displayVal);
          }
        } else if (displayVal !== null && typeof displayVal === 'object') {
          td.textContent = '{' + Object.keys(displayVal).length + '}';
          td.classList.add('cell-object', 'cell-tip');
          td.setAttribute('data-tip', JSON.stringify(displayVal, null, 1).slice(0, 500));
        } else {
          var strVal = displayVal === null || displayVal === undefined ? '' : String(displayVal);
          td.textContent = strVal;
          if (isPrimitive(displayVal)) {
            makeEditable(td, db, modKey, displayVal);
          }
        }

        if (f === 'name' && td.textContent) td.classList.add('name-col');
        if (db.modified.has(modKey)) td.classList.add('cell-modified');
        tr.appendChild(td);
      });

      // 操作按钮（上移/下移/重置）
      var tdAct = document.createElement('td');
      tdAct.classList.add('row-actions');

      if (i > 0) {
        var upBtn = document.createElement('button');
        upBtn.textContent = '\u2191';
        upBtn.title = '上移';
        (function (idx) {
          upBtn.addEventListener('click', function () { swapRows(db, db.rows[idx].id, db.rows[idx - 1].id); });
        })(i);
        tdAct.appendChild(upBtn);
      }

      if (i < db.rows.length - 1) {
        var downBtn = document.createElement('button');
        downBtn.textContent = '\u2193';
        downBtn.title = '下移';
        (function (idx) {
          downBtn.addEventListener('click', function () { swapRows(db, db.rows[idx].id, db.rows[idx + 1].id); });
        })(i);
        tdAct.appendChild(downBtn);
      }

      // 重置按钮
      var resetBtn = document.createElement('button');
      resetBtn.textContent = '\u21BA';
      resetBtn.title = '重置该行修改';
      (function (_db, _id) {
        resetBtn.addEventListener('click', function () { resetRow(_db, _id); });
      })(db, row.id);
      tdAct.appendChild(resetBtn);

      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    // 替换内容
    tableScroll.appendChild(table);

    // 更新信息栏
    updateTabFileInfo(db);

    // 同步滚动条
    syncScrollbars();
  }

  function makeEditable(td, db, modKey, origVal) {
    td.contentEditable = true;

    td.addEventListener('blur', function () {
      var raw = this.textContent.trim();
      var restored = restoreValue(raw, origVal);
      var changed = !looseEqual(restored, origVal);
      if (changed) {
        db.modified.set(modKey, restored);
        this.classList.add('cell-modified');

        // 如果是 name 字段，同步到 entries
        var dot = modKey.indexOf('.');
        var id = parseInt(modKey.slice(0, dot), 10);
        var field = modKey.slice(dot + 1);
        if (field === 'name') {
          var entry = db.entries.find(function (e) { return e.id === id; });
          if (entry) entry.name = restored;
          // 刷新侧边栏
          renderSidebar();
        }
      } else {
        db.modified.delete(modKey);
        this.classList.remove('cell-modified');
      }
      updateTabFileInfo(db);
    });

    td.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
      if (e.key === 'Escape') {
        this.textContent = formatCell(origVal);
        this.blur();
      }
    });
  }

  function resetRow(db, id) {
    var keys = Array.from(db.modified.keys());
    keys.forEach(function (key) {
      if (key.startsWith(id + '.')) db.modified.delete(key);
    });

    // 如果是当前文件，重新渲染
    if (state.files[db.dbType] === db || Object.values(state.files).indexOf(db) >= 0) {
      buildTableContent(db);
      updateTabFileInfo(db);
    }
  }

  function swapRows(db, idA, idB) {
    if (idA === idB) return;
    var rowA = db.rows.find(function (r) { return r.id === idA; });
    var rowB = db.rows.find(function (r) { return r.id === idB; });
    if (!rowA || !rowB) return;

    var fields = Object.keys(rowA);
    fields.forEach(function (f) {
      if (f === 'id') return;
      var keyA = idA + '.' + f;
      var keyB = idB + '.' + f;
      var valA = db.modified.has(keyA) ? db.modified.get(keyA) : rowA[f];
      var valB = db.modified.has(keyB) ? db.modified.get(keyB) : rowB[f];
      var origA = rowA[f];
      var origB = rowB[f];
      if (looseEqual(valB, origA)) { db.modified.delete(keyA); }
      else { db.modified.set(keyA, valB); }
      if (looseEqual(valA, origB)) { db.modified.delete(keyB); }
      else { db.modified.set(keyB, valA); }
    });

    // 刷新表格
    buildTableContent(db);
  }

  function syncScrollbars() {
    var scrollTop = document.getElementById('scrollbarTop');
    var tableScroll = document.getElementById('tableScroll');
    if (!scrollTop || !tableScroll) return;

    tableScroll.removeEventListener('scroll', syncTopHandler);
    scrollTop.removeEventListener('scroll', syncTableHandler);

    tableScroll.addEventListener('scroll', syncTopHandler);
    scrollTop.addEventListener('scroll', syncTableHandler);

    // 更新顶部滚动轨道的宽度
    var table = tableScroll.querySelector('#dataTable');
    var scrollTrack = document.getElementById('scrollTrack');
    if (table && scrollTrack) {
      scrollTrack.style.width = table.scrollWidth + 'px';
    }
  }

  function syncTopHandler() {
    var scrollTop = document.getElementById('scrollbarTop');
    if (scrollTop) scrollTop.scrollLeft = this.scrollLeft;
  }

  function syncTableHandler() {
    var tableScroll = document.getElementById('tableScroll');
    if (tableScroll) tableScroll.scrollLeft = this.scrollLeft;
  }

  function updateTabFileInfo(db) {
    var infoBar = document.getElementById('tableInfoBar');
    if (!infoBar) return;
    var namedCount = db.rows.filter(function (r) {
      return r && r.name && r.name.toString().trim() !== '';
    }).length;
    infoBar.textContent = db.rows.length + ' 条数据（含 ' + namedCount + ' 条有名称） · 已修改 ' + db.modified.size + ' 处';
  }

  // ==================================================================
  // 12. 数组子表编辑器（来自 DBManager）
  // ==================================================================

  function openArrayEditor(db, rowId, fieldName, arr) {
    var fields = arr.length > 0 ? Object.keys(arr[0]) : [];
    var types = {};
    if (arr.length > 0) {
      Object.keys(arr[0]).forEach(function (k) { types[k] = typeof arr[0][k]; });
    }
    var workingArr = arr.map(function (item) { return JSON.parse(JSON.stringify(item)); });

    _arrayEditState = {
      db: db,
      rowId: rowId,
      fieldName: fieldName,
      fields: fields,
      types: types,
      workingArr: workingArr
    };

    rebuildArrayModal();
    document.getElementById('arrayModal').classList.add('show');
  }

  function rebuildArrayModal() {
    var modal = document.getElementById('arrayModal');
    if (!_arrayEditState) return;
    modal.querySelector('.modal-title').textContent =
      '编辑 ' + _arrayEditState.fieldName + ' (ID: ' + _arrayEditState.rowId + ')';
    var body = modal.querySelector('.modal-body');
    body.innerHTML = '';

    var arr = _arrayEditState.workingArr;
    var fields = _arrayEditState.fields;

    if (arr.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'modal-empty';
      emptyDiv.textContent = '数组为空，点击「+ 添加行」增加行';
      body.appendChild(emptyDiv);
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'modal-table-wrap';
    var table = document.createElement('table');
    table.className = 'modal-table';

    // thead
    var thead = document.createElement('thead');
    var trHead = document.createElement('tr');
    var thNum = document.createElement('th');
    thNum.textContent = '#';
    thNum.classList.add('id-col');
    trHead.appendChild(thNum);
    fields.forEach(function (f) {
      var th = document.createElement('th');
      th.textContent = f;
      trHead.appendChild(th);
    });
    var thAct = document.createElement('th');
    thAct.textContent = '操作';
    trHead.appendChild(thAct);
    thead.appendChild(trHead);

    // 中文注释行
    var trLabel = document.createElement('tr');
    var thNum2 = document.createElement('th');
    thNum2.classList.add('label-row', 'id-col');
    trLabel.appendChild(thNum2);
    fields.forEach(function (f) {
      var th = document.createElement('th');
      th.textContent = FIELD_LABELS[f] || f;
      th.classList.add('label-row');
      trLabel.appendChild(th);
    });
    var thAct2 = document.createElement('th');
    thAct2.classList.add('label-row');
    trLabel.appendChild(thAct2);
    thead.appendChild(trLabel);
    table.appendChild(thead);

    // tbody
    var tbody = document.createElement('tbody');
    arr.forEach(function (item, idx) {
      var tr = document.createElement('tr');

      var tdNum = document.createElement('td');
      tdNum.textContent = idx + 1;
      tdNum.classList.add('id-col');
      tr.appendChild(tdNum);

      fields.forEach(function (f) {
        var td = document.createElement('td');
        var val = item[f];
        td.textContent = (val === null || val === undefined) ? '' : String(val);
        td.contentEditable = true;
        td.dataset.field = f;

        (function (rowIdx, fieldName, origType) {
          td.addEventListener('blur', function () {
            var raw = this.textContent.trim();
            var orig = origType === 'number' ? 0 : (origType === 'boolean' ? false : '');
            var restored = restoreValue(raw, orig);
            _arrayEditState.workingArr[rowIdx][fieldName] = restored;
          });
        })(idx, f, _arrayEditState.types[f]);

        td.addEventListener('keydown', function (e) {
          if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
        });
        tr.appendChild(td);
      });

      // 删除按钮
      var tdAct = document.createElement('td');
      tdAct.classList.add('row-actions');
      var delBtn = document.createElement('button');
      delBtn.textContent = '删除';
      delBtn.title = '删除此行';
      (function (index) {
        delBtn.addEventListener('click', function () { deleteArrayRow(index); });
      })(idx);
      tdAct.appendChild(delBtn);
      tr.appendChild(tdAct);

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
  }

  function addArrayRow() {
    if (!_arrayEditState) return;
    var newRow = {};
    var types = _arrayEditState.types;
    if (Object.keys(types).length > 0) {
      Object.keys(types).forEach(function (k) {
        switch (types[k]) {
          case 'number':  newRow[k] = 0; break;
          case 'boolean': newRow[k] = false; break;
          default:        newRow[k] = '';
        }
      });
    } else {
      newRow = { kind: 0, dataId: 0, denominator: 1 };
      _arrayEditState.fields = Object.keys(newRow);
      _arrayEditState.types = { kind: 'number', dataId: 'number', denominator: 'number' };
    }
    _arrayEditState.workingArr.push(newRow);
    rebuildArrayModal();
  }

  function deleteArrayRow(index) {
    if (!_arrayEditState) return;
    _arrayEditState.workingArr.splice(index, 1);
    rebuildArrayModal();
  }

  function confirmArrayEdit() {
    if (!_arrayEditState) return;
    var state2 = _arrayEditState;
    var modKey = state2.rowId + '.' + state2.fieldName;
    state2.db.modified.set(modKey, JSON.parse(JSON.stringify(state2.workingArr)));
    _arrayEditState = null;
    document.getElementById('arrayModal').classList.remove('show');

    // 刷新表格
    if (state.viewMode === 'table') {
      var db = state.files[state.currentFile];
      if (db) buildTableContent(db);
    }
  }

  function cancelArrayEdit() {
    _arrayEditState = null;
    document.getElementById('arrayModal').classList.remove('show');
  }

  // ==================================================================
  // 13. 导出逻辑
  // ==================================================================

  function exportCurrentFile() {
    var fileName = state.currentFile;
    if (!fileName || !state.files[fileName]) {
      alert('没有可导出的文件，请先导入 JSON。');
      return;
    }

    var fileData = state.files[fileName];

    // 如果在卡片视图，同步 textarea
    if (state.viewMode === 'card') {
      syncAllTextareas();
    }

    // 如果在表格视图，同步 name 到 entries
    if (state.viewMode === 'table') {
      syncNameFromTableToEntries();
    }

    // 构建输出数组
    var output = [null];

    fileData.entries.forEach(function (entry) {
      var newNote = buildNote(entry.configNote, entry.descNote);

      // 从 rawData 中找到原始对象，然后合并修改
      var orig = fileData.rawData.find(function (r) { return r && r.id === entry.id; });
      if (!orig) return;

      var obj = JSON.parse(JSON.stringify(orig));
      obj.name = entry.name;
      obj.note = newNote;

      // 应用表格视图中的其他字段修改
      fileData.modified.forEach(function (val, key) {
        var dot = key.indexOf('.');
        var id = parseInt(key.slice(0, dot), 10);
        var field = key.slice(dot + 1);
        if (id === entry.id && field !== 'name') {  // name 已由 entries 提供
          obj[field] = val;
        }
      });

      output.push(obj);
    });

    // 生成 RMMZ 格式的 JSON
    var jsonText = '[\nnull';
    for (var i = 1; i < output.length; i++) {
      jsonText += ',\n' + JSON.stringify(output[i]);
    }
    jsonText += '\n]';

    var blob = new Blob([jsonText], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportZip() {
    var fileNames = Object.keys(state.files);
    if (fileNames.length === 0) {
      alert('没有可导出的文件，请先导入 JSON。');
      return;
    }

    // 如果在卡片视图，同步 textarea
    if (state.viewMode === 'card') {
      syncAllTextareas();
    }

    var zip = new JSZip();

    fileNames.forEach(function (fileName) {
      var fileData = state.files[fileName];
      var output = [null];

      fileData.entries.forEach(function (entry) {
        var newNote = buildNote(entry.configNote, entry.descNote);
        var orig = fileData.rawData.find(function (r) { return r && r.id === entry.id; });
        if (!orig) return;

        var obj = JSON.parse(JSON.stringify(orig));
        obj.name = entry.name;
        obj.note = newNote;

        // 应用表格视图中的其他字段修改
        fileData.modified.forEach(function (val, key) {
          var dot = key.indexOf('.');
          var id = parseInt(key.slice(0, dot), 10);
          var field = key.slice(dot + 1);
          if (id === entry.id && field !== 'name') {
            obj[field] = val;
          }
        });

        output.push(obj);
      });

      var jsonText = '[\nnull';
      for (var i = 1; i < output.length; i++) {
        jsonText += ',\n' + JSON.stringify(output[i]);
      }
      jsonText += '\n]';

      zip.file(fileName + '.json', jsonText);
    });

    zip.generateAsync({ type: 'blob' }).then(function (blob) {
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'RMMZ_DB_Pro_export.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function syncAllTextareas() {
    var inputs = editorArea.querySelectorAll('textarea[data-field], input[data-field]');
    [].forEach.call(inputs, function (el) {
      var fileName = el.dataset.file;
      var entryId = Number(el.dataset.id);
      var field = el.dataset.field;
      var fileData = state.files[fileName];
      if (!fileData) return;
      var entry = fileData.entries.find(function (en) { return en.id === entryId; });
      if (entry) {
        entry[field] = el.value;
      }
    });
  }

  function updateExportButton() {
    var hasFiles = Object.keys(state.files).length > 0;
    btnExport.disabled = !state.currentFile || !state.files[state.currentFile];
    btnExportZip.disabled = !hasFiles;
    btnViewToggle.hidden = !hasFiles;
  }

  // ==================================================================
  // 14. 事件代理与绑定
  // ==================================================================

  /** 侧边栏点击事件 */
  sidebarNav.addEventListener('click', function (e) {
    var target = e.target.closest('[data-action]');
    if (!target) return;

    var action = target.dataset.action;
    var fileName = target.dataset.file;
    var entryId = target.dataset.id ? Number(target.dataset.id) : null;

    switch (action) {
      case 'go-entry': {
        state.activeEntryId = entryId;
        renderSidebar();

        if (state.viewMode === 'card') {
          // 滚动到卡片
          requestAnimationFrame(function () {
            var el = document.getElementById('entry-' + fileName + '-' + entryId);
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'start' });
              el.style.boxShadow = '0 0 0 3px rgba(79,110,247,0.2)';
              setTimeout(function () { el.style.boxShadow = ''; }, 1500);
            }
          });
        } else {
          // 表格视图：滚动到表格行
          requestAnimationFrame(function () {
            var table = document.querySelector('#dataTable');
            if (!table) return;
            var rows = table.querySelectorAll('tbody tr');
            [].forEach.call(rows, function (row) {
              if (Number(row.dataset.entryId) === entryId) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                row.classList.add('row-highlight');
                setTimeout(function () { row.classList.remove('row-highlight'); }, 2000);
              }
            });
          });
        }
        break;
      }
    }
  });

 /** 编辑区点击事件 */
 editorArea.addEventListener('click', function (e) {
    if (state.viewMode === 'card' || state.viewMode === 'table') {
      // 卡片视图下，点击输入控件时不触发
      if (state.viewMode === 'card' && e.target.closest('input, textarea')) return;
     var target = e.target.closest('[data-action]');
     if (!target) return;

     var action = target.dataset.action;
     var fileName = target.dataset.file;
     var entryId = target.dataset.id ? Number(target.dataset.id) : null;

      if (action === 'toggle-entry' && state.viewMode === 'card') {
       toggleEntry(fileName, entryId);
     } else if (action === 'switch-tab') {
       switchTab(fileName);
     }
   }
 });

  /** 编辑区输入事件（卡片视图） */
  editorArea.addEventListener('input', function (e) {
    if (state.viewMode !== 'card') return;
    var ta = e.target.closest('textarea[data-field], input[data-field]');
    if (!ta) return;

    var fileName = ta.dataset.file;
    var entryId = Number(ta.dataset.id);
    var field = ta.dataset.field;
    var fileData = state.files[fileName];
    if (!fileData) return;

    var entry = fileData.entries.find(function (en) { return en.id === entryId; });
    if (!entry) return;

    entry[field] = ta.value;

    // 修改 name 时同步刷新侧边栏和表格视图的数据
    if (field === 'name') {
      renderSidebar();
      // 同步到表格视图的 modified map
      if (state.files[fileName]) {
        var modKey = entryId + '.name';
        state.files[fileName].modified.set(modKey, ta.value);
      }
    }
  });

  // ==================================================================
  // 15. 初始化事件绑定
  // ==================================================================

  /** 导入 JSON 文件 */
  btnImport.addEventListener('click', function () {
    fileInput.click();
  });

  fileInput.addEventListener('change', function () {
    if (fileInput.files.length > 0) {
      importFiles(fileInput.files).then(function () {
        fileInput.value = '';
      });
    }
  });

  /** 导入项目（选择 data/ 文件夹） */
  btnImportProject.addEventListener('click', function () {
    projectInput.click();
  });

  projectInput.addEventListener('change', function () {
    if (projectInput.files.length > 0) {
      importProject(projectInput.files).then(function () {
        projectInput.value = '';
      });
    }
  });

  /** 视图切换 */
  btnViewToggle.addEventListener('click', function () {
    toggleViewMode();
  });

  /** 导出 */
  btnExport.addEventListener('click', function () {
    exportCurrentFile();
  });

  btnExportZip.addEventListener('click', function () {
    exportZip();
  });

  /** 拖拽导入 */
  document.addEventListener('dragover', function (e) {
    e.preventDefault();
    e.stopPropagation();
  });

  document.addEventListener('drop', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.files.length > 0) {
      importFiles(e.dataTransfer.files);
    }
  });

  /** 键盘快捷键 */
  document.addEventListener('keydown', function (e) {
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
    // Ctrl+Shift+V / Cmd+Shift+V → 切换视图
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'v' || e.key === 'V')) {
      e.preventDefault();
      toggleViewMode();
    }
  });

  /** 数组编辑器模态框事件 */
  document.getElementById('modalOkBtn').addEventListener('click', confirmArrayEdit);
  document.getElementById('modalCancelBtn').addEventListener('click', cancelArrayEdit);
  document.getElementById('modalAddBtn').addEventListener('click', addArrayRow);
  document.querySelector('#arrayModal .modal-close').addEventListener('click', cancelArrayEdit);
  document.getElementById('arrayModal').addEventListener('click', function (e) {
    if (e.target === this) cancelArrayEdit();
  });

  // ==================================================================
  // 初始状态
  // ==================================================================

  // 视图切换按钮初始隐藏（直到有数据才显示）
  btnViewToggle.hidden = true;

})();
