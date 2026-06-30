/* ================================================================
   RMMZ DB Manager — 多标签数据库 JSON 表格编辑器
   ================================================================ */

(function () {
  'use strict';

  // ==================================================================
  // 字段中文名映射 — 在这里修改或扩充中文名
  // ==================================================================
  var FIELD_LABELS = {
    // 通用
    id: 'ID',
    name: '名称',
    iconIndex: '图标',
    note: '备注',
    description: '描述',
    // 角色 (Actors)
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
    // 物品 (Items)
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
    // 技能 (Skills)
    mpCost: 'MP 消耗',
    stypeId: '技能类型',
    tpCost: 'TP 消耗',
    message1: '消息 1',
    message2: '消息 2',
    messageType: '消息类型',
    requiredWtypeId1: '武器类型 1',
    requiredWtypeId2: '武器类型 2',
    // 武器 (Weapons)
    etypeId: '装备类型',
    wtypeId: '武器类型',
    // 护甲 (Armors)
    atypeId: '护甲类型',
    // 敌人 (Enemies)
    actions: '行动',
    battlerHue: '色相',
    dropItems: '掉落物品',
    exp: '经验',
    gold: '金币',
    // 状态 (States)
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
    // 职业 (Classes)
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

  // ---------- state ----------
  var databases = new Map();   // key = fileName, value = db object
  var activeFile = '';         // current active tab key

  // DOM refs
  var dropZone    = document.getElementById('dropZone');
  var fileInput   = document.getElementById('fileInput');
  var exportBtn   = document.getElementById('exportBtn');
  var tabBar      = document.getElementById('tabBar');
  var tabList     = document.getElementById('tabList');
  var tabFileInfo = document.getElementById('tabFileInfo');
  var tableCont   = document.getElementById('tableContainer');
  var scrollTop   = document.getElementById('scrollbarTop');
  var scrollTrack = document.querySelector('.scrollbar-top-track');
  var tableScroll = document.getElementById('tableScroll');

  // ---------- helpers ----------
  function isPrimitive(v) {
    return v === null || v === undefined || typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean';
  }

  function detectType(name) {
    var map = {
      actors: 'Actors', items: 'Items', skills: 'Skills',
      weapons: 'Weapons', armors: 'Armors', enemies: 'Enemies',
      states: 'States', classes: 'Classes'};
    return map[name.replace(/\.json$/i, '').toLowerCase()] || 'Unknown';
  }


  // 标准 MZ 数据库字段白名单 — 只显示这些字段，隐藏插件添加的额外字段
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

  // 隐藏列（不显示但导出保留）
  var HIDDEN_FIELDS = { note: true };

  function collectFields(data, dbType) {
    // 如果该类型有标准字段白名单，直接使用（排除隐藏列）
    if (TYPE_FIELDS[dbType]) {
      return TYPE_FIELDS[dbType].filter(function (f) { return !HIDDEN_FIELDS[f]; });
    }
    // 未知类型回退到动态发现（排除隐藏列）
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
    if (!databases.has(baseName)) return baseName;
    var i = 2;
    while (databases.has(baseName.replace(/\.json$/i, '') + '_' + i + '.json')) { i++; }
    return baseName.replace(/\.json$/i, '') + '_' + i + '.json';
  }

  // ---------- scrollbar sync ----------
  function syncScrollbars() {
    if (!scrollTop || !tableScroll) return;
    // scroll the top bar when user scrolls the table horizontally
    tableScroll.removeEventListener('scroll', syncScrollTopHandler);
    scrollTop.removeEventListener('scroll', syncTableScrollHandler);
    tableScroll.addEventListener('scroll', syncScrollTopHandler);
    scrollTop.addEventListener('scroll', syncTableScrollHandler);
  }

  function syncScrollTopHandler() {
    scrollTop.scrollLeft = tableScroll.scrollLeft;
  }
  function syncTableScrollHandler() {
    tableScroll.scrollLeft = scrollTop.scrollLeft;
  }

  function updateScrollTrackWidth() {
    var table = tableScroll.querySelector('#dataTable');
    if (!table) return;
    scrollTrack.style.width = table.scrollWidth + 'px';
  }

  // ---------- render table for active db ----------
  function render() {
    var db = databases.get(activeFile);
    tableScroll.innerHTML = '';
    if (!db || !db.rows.length) return;

    var fields = collectFields(db.rows, db.dbType);
    db.fields = fields;

    // Build table
    var table = document.createElement('table');
    table.id = 'dataTable';

    // ---- thead ----
    var thead = document.createElement('thead');

    // Row 1: field names
    var trHead = document.createElement('tr');
    var thNum = document.createElement('th'); thNum.textContent = '#'; thNum.classList.add('id-col');
    trHead.appendChild(thNum);
    fields.forEach(function (f) {
      var th = document.createElement('th');
      th.textContent = f;
      if (f === 'id') th.classList.add('id-col');
      trHead.appendChild(th);
    });
    var thAct = document.createElement('th'); thAct.textContent = '操作'; thAct.style.width = '50px';
    trHead.appendChild(thAct);
    thead.appendChild(trHead);

    // Row 2: Chinese labels
    var trLabel = document.createElement('tr');
    var thNum2 = document.createElement('th'); thNum2.textContent = ''; thNum2.classList.add('label-row', 'id-col');
    trLabel.appendChild(thNum2);
    fields.forEach(function (f) {
      var th = document.createElement('th');
      th.textContent = FIELD_LABELS[f] || f;
      th.classList.add('label-row');
      if (f === 'id') th.classList.add('id-col');
      trLabel.appendChild(th);
    });
    var thAct2 = document.createElement('th'); thAct2.classList.add('label-row'); thAct2.textContent = ''; thAct2.style.width = '50px';
    trLabel.appendChild(thAct2);
    thead.appendChild(trLabel);

    table.appendChild(thead);

    // ---- tbody ----
    var tbody = document.createElement('tbody');
    db.rows.forEach(function (row, i) {
      if (!row || typeof row !== 'object') return;
      var tr = document.createElement('tr');

      var tdNum = document.createElement('td');
      tdNum.textContent = i + 1; tdNum.classList.add('id-col');
      tr.appendChild(tdNum);

      fields.forEach(function (f) {
        var td = document.createElement('td');
        var val = row[f];
        var modKey = row.id + '.' + f;
        var modVal = db.modified.has(modKey) ? db.modified.get(modKey) : undefined;
        var displayVal = modVal !== undefined ? modVal : val;

        if (f === 'id') {
          td.textContent = row.id; td.classList.add('id-col');
        } else if (Array.isArray(displayVal)) {
          var isObjArr = displayVal.length > 0 && typeof displayVal[0] === 'object';
          if (isObjArr) {
            td.textContent = '[' + displayVal.length + ']';
            td.classList.add('cell-array', 'cell-tip');
            td.setAttribute('data-tip', JSON.stringify(displayVal).slice(0, 300));
    td.style.cursor = 'pointer';
    td.title = '点击编辑';
    (function(_db, _id, _f, _val) {
      td.addEventListener('click', function(e) {
        e.stopPropagation();
        openArrayEditor(_db, _id, _f, _val);
      });
    })(db, row.id, f, displayVal);
          } else {
            td.textContent = JSON.stringify(displayVal);
            td.contentEditable = true;
            td.classList.add('cell-array-json');
            (function(_db, _key, _orig) {
              td.addEventListener('blur', function() {
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
                updateTabLabel(_db);
                updateInfo();
              });
              td.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
                if (e.key === 'Escape') { this.textContent = JSON.stringify(_orig); this.blur(); }
              });
            })(db, modKey, displayVal);
          }} else if (displayVal !== null && typeof displayVal === 'object') {
          td.textContent = '{' + Object.keys(displayVal).length + '}';
          td.classList.add('cell-object', 'cell-tip');
          td.setAttribute('data-tip', JSON.stringify(displayVal, null, 1).slice(0, 500));
        } else {
          var strVal = displayVal === null || displayVal === undefined ? '' : String(displayVal);
          td.textContent = strVal;
          if (isPrimitive(displayVal)) makeEditable(td, db, modKey, displayVal);
        }
        if (f === 'name' && td.textContent) td.classList.add('name-col');
        if (db.modified.has(modKey)) td.classList.add('cell-modified');
        tr.appendChild(td);
      });

      // order buttons + reset
      var tdAct = document.createElement('td'); tdAct.classList.add('row-actions');
      if (i > 0) {
        var upBtn = document.createElement('button');
        upBtn.textContent = '\u2191';
        upBtn.title = '\u4E0A\u79FB';
        (function (idx) {
          upBtn.addEventListener('click', function () { swapRows(db, db.rows[idx].id, db.rows[idx-1].id); });
        })(i);
        tdAct.appendChild(upBtn);
      }
      if (i < db.rows.length - 1) {
        var downBtn = document.createElement('button');
        downBtn.textContent = '\u2193';
        downBtn.title = '\u4E0B\u79FB';
        (function (idx) {
          downBtn.addEventListener('click', function () { swapRows(db, db.rows[idx].id, db.rows[idx+1].id); });
        })(i);
        tdAct.appendChild(downBtn);
      }
      var resetBtn = document.createElement('button');
      resetBtn.textContent = '\u91CD\u7F6E';
      resetBtn.title = '\u91CD\u7F6E\u6B64\u884C\u7684\u6240\u6709\u4FEE\u6539';
      (function (rid) {
        resetBtn.addEventListener('click', function () { resetRow(db, rid); render(); });
      })(row.id);
      tdAct.appendChild(resetBtn);
      tr.appendChild(tdAct);
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    tableScroll.appendChild(table);

    // Scrollbar sync: after render, set track width and sync
    updateScrollTrackWidth();
    syncScrollbars();

    updateInfo();
    tableCont.hidden = false;
    dropZone.hidden = true;
    exportBtn.disabled = false;
  }

  // ---------- editable cell ----------
  function makeEditable(td, db, modKey, originalVal) {
    td.contentEditable = true;
    td.addEventListener('blur', function () {
      var raw = this.textContent.trim();
      var restored = restoreValue(raw, originalVal);
      var changed = !looseEqual(restored, originalVal);
      if (changed) {
        db.modified.set(modKey, restored);
        this.classList.add('cell-modified');
      } else {
        db.modified.delete(modKey);
        this.classList.remove('cell-modified');
        this.textContent = formatCell(originalVal);
      }
      updateTabLabel(db);
      updateInfo();
    });
    td.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
      if (e.key === 'Escape') { this.textContent = formatCell(originalVal); this.blur(); }
    });
  }

  function restoreValue(raw, original) {
    if (original === null || original === undefined) return raw;
    if (typeof original === 'number') { var n = parseFloat(raw); return isNaN(n) ? raw : n; }
    if (typeof original === 'boolean') {
      if (raw.toLowerCase() === 'true') return true;
      if (raw.toLowerCase() === 'false') return false;
      return raw;
    }
    return raw;
  }
  function looseEqual(a, b) {
    if (a === b) return true;
    if (typeof a === 'number' && isNaN(a) && typeof b === 'number' && isNaN(b)) return true;
    return String(a) === String(b);
  }
  function formatCell(val) { return (val === null || val === undefined) ? '' : String(val); }

  function resetRow(db, id) {
    var keys = Array.from(db.modified.keys());
    keys.forEach(function (key) { if (key.startsWith(id + '.')) db.modified.delete(key); });
    updateTabLabel(db);
  }

  // ---------- UI updates ----------
  function updateInfo() {
    var db = databases.get(activeFile);
    if (!db) return;
    var namedCount = db.rows.filter(function (r) { return r && r.name && r.name.toString().trim() !== ''; }).length;
    tabFileInfo.textContent = db.rows.length + ' 条数据 (含 ' + namedCount + ' 条有名称)  ·  已修改 ' + db.modified.size + ' 处';
  }

  function updateTabLabel(db) {
    var tabs = tabList.querySelectorAll('.tab');
    for (var i = 0; i < tabs.length; i++) {
      if (tabs[i].dataset.file === db.fileName) {
        var num = db.modified.size;
        var label = tabs[i].querySelector('.tab-label');
        if (label) label.textContent = db.fileName + (num > 0 ? ' *' : '');
        break;
      }
    }
  }

  function updateTabBarVisibility() {
    tabBar.hidden = (databases.size === 0);
  }

  // ---------- tab management ----------
  function addTab(fileName) {
    var tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.file = fileName;
    tab.innerHTML = '<span class="tab-label">' + escapeHtml(fileName) + '</span><span class="tab-close">&times;</span>';

    tab.addEventListener('click', function (e) {
      if (e.target.classList.contains('tab-close')) return;
      switchTab(fileName);
    });
    tab.querySelector('.tab-close').addEventListener('click', function (e) {
      e.stopPropagation();
      closeTab(fileName);
    });

    tabList.appendChild(tab);
    updateTabBarVisibility();
    return tab;
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function switchTab(fileName) {
    if (activeFile === fileName) return;
    var prev = tabList.querySelector('.tab.active');
    if (prev) prev.classList.remove('active');

    activeFile = fileName;

    var curr = tabList.querySelector('.tab[data-file="' + escapeHtml(fileName) + '"]');
    if (curr) curr.classList.add('active');

    render();
  }

  function closeTab(fileName) {
    var tab = tabList.querySelector('.tab[data-file="' + escapeHtml(fileName) + '"]');
    if (tab) tab.remove();

    databases.delete(fileName);

    if (activeFile === fileName) {
      var remaining = tabList.querySelectorAll('.tab');
      if (remaining.length > 0) {
        var lastTab = remaining[remaining.length - 1];
        switchTab(lastTab.dataset.file);
      } else {
        activeFile = '';
        tableCont.hidden = true;
        dropZone.hidden = false;
        exportBtn.disabled = true;
        tabFileInfo.textContent = '';
      }
    }

    updateTabBarVisibility();
  }

  function closeTabSilent(fileName) {
    var tab = tabList.querySelector('.tab[data-file="' + escapeHtml(fileName) + '"]');
    if (tab) tab.remove();
    databases.delete(fileName);
  }

  // ---------- load ----------
  function loadFile(file) {
    var reader = new FileReader();
    reader.onload = function (e) {
      try {
        var arr = JSON.parse(e.target.result);
        if (!Array.isArray(arr)) throw new Error('数据不是数组格式');
        var rawData = arr;
        var rows = arr.filter(function (r) { return r !== null && r !== undefined && typeof r === 'object'; });
        var name = uniqueFileName(file.name);
        var type = detectType(file.name);

        if (databases.has(name)) closeTabSilent(name);

        var db = {
          rawData: rawData,
          rows: rows,
          modified: new Map(),
          fileName: name,
          dbType: type
        };
        databases.set(name, db);
        addTab(name);
        switchTab(name);
      } catch (err) {
        alert('解析 JSON 失败：' + err.message);
      }
    };
    reader.readAsText(file, 'UTF-8');
  }

  function loadFiles(files) {
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!f.name.match(/\.json$/i)) continue;
      loadFile(f);
    }
  }

  // ---------- export ----------
  function exportData() {
    var db = databases.get(activeFile);
    if (!db) return;
    var out = JSON.parse(JSON.stringify(db.rawData));
    for (var entry of db.modified.entries()) {
      var key = entry[0], val = entry[1];
      var dot = key.indexOf('.');
      var id = parseInt(key.slice(0, dot), 10);
      var field = key.slice(dot + 1);
      var found = out.find(function (r) { return r && r.id === id; });
      if (found) found[field] = val;
    }
    var jsonLines = [];
    jsonLines.push('[');
    for (var i = 0; i < out.length; i++) {
      var item = out[i];
      var line = item === null ? 'null' : JSON.stringify(item);
      if (i < out.length - 1) line += ',';
      jsonLines.push(line);
    }
    jsonLines.push(']');
    var json = jsonLines.join('\n');
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = db.fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ---------- events ----------
  fileInput.addEventListener('change', function () {
    if (fileInput.files.length) { loadFiles(fileInput.files); fileInput.value = ''; }
  });

  exportBtn.addEventListener('click', exportData);

  dropZone.addEventListener('dragover', function (e) { e.preventDefault(); dropZone.classList.add('drag-over'); });
  dropZone.addEventListener('dragleave', function () { dropZone.classList.remove('drag-over'); });
  dropZone.addEventListener('drop', function (e) {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    if (e.dataTransfer.files.length) loadFiles(e.dataTransfer.files);
  });

  // Global drop when table is visible
  document.addEventListener('dragover', function (e) { e.preventDefault(); });
  document.addEventListener('drop', function (e) {
    e.preventDefault();
    if (e.dataTransfer.files.length && !tableCont.hidden) {
      loadFiles(e.dataTransfer.files);
    }
  });

  // Ctrl+Shift+E = export current tab
  document.addEventListener('keydown', function (e) {
    if (e.ctrlKey && e.shiftKey && e.key === 'E') { e.preventDefault(); exportData(); }
  });


  // ========== Array Sub-table Editor ==========
  var _arrayEditState = null;

  function openArrayEditor(db, rowId, fieldName, arr) {
    var fields = arr.length > 0 ? Object.keys(arr[0]) : [];
    var types = {};
    if (arr.length > 0) {
      Object.keys(arr[0]).forEach(function(k) { types[k] = typeof arr[0][k]; });
    }
    var workingArr = arr.map(function(item) { return JSON.parse(JSON.stringify(item)); });

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
    modal.querySelector('.modal-title').textContent = '编辑 ' + _arrayEditState.fieldName + ' (ID: ' + _arrayEditState.rowId + ')';
    var body = modal.querySelector('.modal-body');
    body.innerHTML = '';

    var arr = _arrayEditState.workingArr;
    var fields = _arrayEditState.fields;

    if (arr.length === 0) {
      var emptyDiv = document.createElement('div');
      emptyDiv.className = 'modal-empty';
      emptyDiv.textContent = '数组为空，点击「+ 添加」增加行';
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
    var thNum = document.createElement('th'); thNum.textContent = '#'; thNum.classList.add('id-col');
    trHead.appendChild(thNum);
    fields.forEach(function(f) {
      var th = document.createElement('th');
      th.textContent = f;
      trHead.appendChild(th);
    });
    var thAct = document.createElement('th'); thAct.textContent = '操作';
    trHead.appendChild(thAct);
    thead.appendChild(trHead);

    var trLabel = document.createElement('tr');
    var thNum2 = document.createElement('th'); thNum2.classList.add('label-row', 'id-col');
    trLabel.appendChild(thNum2);
    fields.forEach(function(f) {
      var th = document.createElement('th');
      th.textContent = FIELD_LABELS[f] || f;
      th.classList.add('label-row');
      trLabel.appendChild(th);
    });
    var thAct2 = document.createElement('th'); thAct2.classList.add('label-row');
    trLabel.appendChild(thAct2);
    thead.appendChild(trLabel);
    table.appendChild(thead);

    // tbody
    var tbody = document.createElement('tbody');
    arr.forEach(function(item, idx) {
      var tr = document.createElement('tr');

      var tdNum = document.createElement('td');
      tdNum.textContent = idx + 1;
      tdNum.classList.add('id-col');
      tr.appendChild(tdNum);

      fields.forEach(function(f) {
        var td = document.createElement('td');
        var val = item[f];
        td.textContent = (val === null || val === undefined) ? '' : String(val);
        td.contentEditable = true;
        td.dataset.field = f;

        (function(rowIdx, fieldName, origType) {
          td.addEventListener('blur', function() {
            var raw = this.textContent.trim();
            var orig = origType === 'number' ? 0 : (origType === 'boolean' ? false : '');
            var restored = restoreValue(raw, orig);
            _arrayEditState.workingArr[rowIdx][fieldName] = restored;
          });
        })(idx, f, _arrayEditState.types[f]);

        td.addEventListener('keydown', function(e) {
          if (e.key === 'Enter') { e.preventDefault(); this.blur(); }
        });
        tr.appendChild(td);
      });

      // Delete button
      var tdAct = document.createElement('td');
      tdAct.classList.add('row-actions');
      var delBtn = document.createElement('button');
      delBtn.textContent = '删除';
      delBtn.title = '删除此行';
      (function(index) {
        delBtn.addEventListener('click', function() { deleteArrayRow(index); });
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
      Object.keys(types).forEach(function(k) {
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
    var state = _arrayEditState;
    var modKey = state.rowId + '.' + state.fieldName;
    state.db.modified.set(modKey, JSON.parse(JSON.stringify(state.workingArr)));
    updateTabLabel(state.db);
    _arrayEditState = null;
    document.getElementById('arrayModal').classList.remove('show');
    render();
  }

  function cancelArrayEdit() {
    _arrayEditState = null;
    document.getElementById('arrayModal').classList.remove('show');
  }

  // Modal event listeners
  document.getElementById('modalOkBtn').addEventListener('click', confirmArrayEdit);
  document.getElementById('modalCancelBtn').addEventListener('click', cancelArrayEdit);
  document.getElementById('modalAddBtn').addEventListener('click', addArrayRow);
  document.querySelector('#arrayModal .modal-close').addEventListener('click', cancelArrayEdit);
  document.getElementById('arrayModal').addEventListener('click', function(e) {
    if (e.target === this) cancelArrayEdit();
  });
  // ========== Row Swap ==========
  function swapRows(db, idA, idB) {
    if (idA === idB) return;
    var rowA = db.rows.find(function(r) { return r.id === idA; });
    var rowB = db.rows.find(function(r) { return r.id === idB; });
    if (!rowA || !rowB) return;

    var fields = Object.keys(rowA);
    fields.forEach(function(f) {
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
    updateTabLabel(db);
    render();
  }

})();












