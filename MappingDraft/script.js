/* ==========================================================
   RMMZ Map Draft — 纯前端 RMMZ 地图规划工具
   ========================================================== */

// ==========================================================
// 1. 预设颜色
// ==========================================================
const PRESET_COLORS = [
  { id: 'ground',  label: '地面', color: '#D4C5A9' },
  { id: 'building',label: '房屋', color: '#C0392B' },
  { id: 'object',  label: '物件', color: '#2980B9' },
  { id: 'event',   label: '事件', color: '#E67E22' },
  { id: 'water',   label: '水域', color: '#1ABC9C' },
  { id: 'tree',    label: '树木', color: '#27AE60' },
  { id: 'wall',    label: '墙壁', color: '#7F8C8D' },
  { id: 'road',    label: '道路', color: '#D5A06A' },
];

// ==========================================================
// 2. 状态
// ==========================================================
const state = {
  // 地图数据
  map: null,        // { width, height, tileSize, data: string[][] }
  // 选区列表
  selections: [],   // [{ x, y, w, h, name, note }]
  // 当前选中的选区索引（-1 表示无）
  selectedSelectionIdx: -1,
  // 当前工具
  activeTool: 'pencil',
  // 当前激活的颜色（色值字符串）
  activeColor: PRESET_COLORS[0].color,
  // 鼠标拖拽状态
  isDragging: false,
  dragStart: null,  // { gridX, gridY }
  dragEnd: null,    // { gridX, gridY }
  // Ctrl 是否按下
  ctrlHeld: false,
  // 空格是否按下（画布平移）
  spaceHeld: false,
  // Alt 是否按下（吸管）
  altHeld: false,
  // 空格拖拽平移状态
  isSpaceDragging: false,
  spaceDragStart: null, // { clientX, clientY, scrollLeft, scrollTop }
  // 铅笔拖拽的上一格位置（用于连续绘制插值）
  lastPainted: null,
  // DOM 缓存
  els: {},
};

// ==========================================================
// 3. DOM 引用 & 初始化
// ==========================================================
function cacheElements() {
  const $ = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => [...p.querySelectorAll(s)];
  const els = state.els;
  els.header = $('#header');
  els.main = $('#main');
  els.canvas = $('#map-canvas');
  els.ctx = els.canvas.getContext('2d');
  els.container = $('#canvas-container');
  els.emptyHint = $('#empty-hint');
  els.toolGroup = $('#tool-group');
  els.colorGroup = $('#color-group');
  els.selectionSection = $('#selection-section');
  els.selectionInfo = $('#selection-info');
  els.mapInfo = $('#map-info');
  els.modalOverlay = $('#modal-overlay');
  els.mapWidth = $('#map-width');
  els.mapHeight = $('#map-height');
  els.mapTile = $('#map-tile');
  els.modalConfirm = $('#modal-confirm');
  els.modalCancel = $('#modal-cancel');

  els.btnNew = $('#btn-new');
  els.btnExportJson = $('#btn-export-json');
  els.btnImportJson = $('#btn-import-json');
  els.btnExportPng = $('#btn-export-png');

  els.resizeW = $('#resize-w');
  els.resizeH = $('#resize-h');
  els.btnResize = $('#btn-resize');
  els.shiftDir = $('#shift-dir');
  els.shiftAmount = $('#shift-amount');
  els.btnShift = $('#btn-shift');

  // 隐藏的 file input 用于导入
  els.fileInput = document.createElement('input');
  els.fileInput.type = 'file';
  els.fileInput.accept = '.json';
  els.fileInput.id = 'file-input';
  els.fileInput.style.display = 'none';
  document.body.appendChild(els.fileInput);
}

// ==========================================================
// 4. 渲染颜色面板
// ==========================================================
function renderColorPalette() {
  const container = state.els.colorGroup;
  container.innerHTML = '';
  PRESET_COLORS.forEach((c) => {
    const btn = document.createElement('div');
    btn.className = 'color-swatch' + (c.color === state.activeColor ? ' active' : '');
    btn.dataset.color = c.color;
    btn.innerHTML = `<span class="color-dot" style="background:${c.color}"></span>${c.label}`;
    btn.addEventListener('click', () => {
      state.activeColor = c.color;
      renderColorPalette();
    });
    container.appendChild(btn);
  });
}

// ==========================================================
// 5. 工具切换
// ==========================================================
function renderToolbar() {
  const btns = state.els.toolGroup.querySelectorAll('.tool-btn');
  btns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tool === state.activeTool);
  });
}

function setupToolbar() {
  state.els.toolGroup.addEventListener('click', (e) => {
    const btn = e.target.closest('.tool-btn');
    if (!btn) return;
    state.activeTool = btn.dataset.tool;
    renderToolbar();
    // 如果切换到选框工具，清空选区选中
    if (state.activeTool !== 'selection') {
      // 但不取消选区选中，方便 Ctrl+click
    }
  });
}

// ==========================================================
// 6. 地图创建
// ==========================================================
function createMap(width, height, tileSize) {
  const data = [];
  for (let y = 0; y < height; y++) {
    const row = [];
    for (let x = 0; x < width; x++) {
      row.push(null);
    }
    data.push(row);
  }
  state.map = { width, height, tileSize, data };
  state.selections = [];
  state.selectedSelectionIdx = -1;

  // 设置 canvas 尺寸
  const canvas = state.els.canvas;
  canvas.width = width * tileSize;
  canvas.height = height * tileSize;
  canvas.style.width = width * tileSize + 'px';
  canvas.style.height = height * tileSize + 'px';

  state.els.emptyHint.style.display = 'none';
  state.els.canvas.style.display = 'block';

  render();
  renderSelectionPanel();
  renderMapInfo();
}

// ==========================================================
// 7. Canvas 主渲染
// ==========================================================
function render() {
  const map = state.map;
  if (!map) return;

  const ctx = state.els.ctx;
  const { width, height, tileSize, data } = map;
  const w = width * tileSize;
  const h = height * tileSize;

  // --- 清空 ---
  ctx.clearRect(0, 0, w, h);

  // --- 绘制背景棋盘格（区分空与非空） ---
  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const color = data[gy][gx];
      const px = gx * tileSize;
      const py = gy * tileSize;
      if (color) {
        ctx.fillStyle = color;
        ctx.fillRect(px, py, tileSize, tileSize);
      } else {
        // 空格用浅色棋盘格表示
        const shade = (gx + gy) % 2 === 0 ? '#f0eeea' : '#e8e6e0';
        ctx.fillStyle = shade;
        ctx.fillRect(px, py, tileSize, tileSize);
      }
    }
  }

  // --- 网格线 (白天模式更明显) ---
  ctx.strokeStyle = 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  for (let gx = 1; gx < width; gx++) {
    const px = gx * tileSize;
    ctx.beginPath();
    ctx.moveTo(px, 0);
    ctx.lineTo(px, h);
    ctx.stroke();
  }
  for (let gy = 1; gy < height; gy++) {
    const py = gy * tileSize;
    ctx.beginPath();
    ctx.moveTo(0, py);
    ctx.lineTo(w, py);
    ctx.stroke();
  }

  // --- 外层边框 ---
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, w, h);

  // --- 选区 ---
  renderSelectionsOnCanvas(ctx, width, height, tileSize);

  // --- 拖拽预览 ---
  if (state.isDragging && state.dragStart && state.dragEnd) {
    renderDragPreview(ctx, tileSize);
  }
}

// ==========================================================
// 7b. 选区 Canvas 渲染
// ==========================================================
function renderSelectionsOnCanvas(ctx, width, height, tileSize) {
  state.selections.forEach((sel, idx) => {
    const px = sel.x * tileSize;
    const py = sel.y * tileSize;
    const pw = sel.w * tileSize;
    const ph = sel.h * tileSize;

    // 半透明填充
    ctx.fillStyle = 'rgba(255,180,0,0.08)';
    ctx.fillRect(px, py, pw, ph);

    // 虚线边框
    ctx.setLineDash([4, 4]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = idx === state.selectedSelectionIdx
      ? 'rgba(220,120,0,0.85)'
      : 'rgba(200,150,0,0.5)';
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);

    // 显示名称（如果存在）
    if (sel.name) {
      ctx.font = `bold ${Math.max(10, tileSize * 0.45)}px sans-serif`;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      const pad = 2;
      const txt = sel.name.length > 8 ? sel.name.slice(0, 8) + '…' : sel.name;
      const metrics = ctx.measureText(txt);
      const tw = metrics.width;
      const th = parseInt(ctx.font, 10);
      // 背景
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(px + pad, py + pad, tw + 4, th + 2);
      ctx.fillStyle = '#fff';
      ctx.fillText(txt, px + pad + 2, py + pad + 1);
    }
  });
}

// ==========================================================
// 7c. 拖拽预览
// ==========================================================
function renderDragPreview(ctx, tileSize) {
  const start = normalizeCoords(state.dragStart, state.dragEnd).start;
  const end = normalizeCoords(state.dragStart, state.dragEnd).end;
  const px = start.gridX * tileSize;
  const py = start.gridY * tileSize;
  const pw = (end.gridX - start.gridX + 1) * tileSize;
  const ph = (end.gridY - start.gridY + 1) * tileSize;

  if (state.activeTool === 'rect-fill') {
    // 预览要填充的颜色
    ctx.fillStyle = state.activeColor + '60'; // 半透明
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = state.activeColor;
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
  } else if (state.activeTool === 'rect-eraser') {
    // 预览要擦除的区域
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
  } else if (state.activeTool === 'selection') {
    ctx.fillStyle = 'rgba(255,180,0,0.08)';
    ctx.fillRect(px, py, pw, ph);
    ctx.strokeStyle = 'rgba(200,150,0,0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(px, py, pw, ph);
    ctx.setLineDash([]);
  }
}

// ==========================================================
// 8. 坐标工具
// ==========================================================
function getGridPos(e) {
  const rect = state.els.canvas.getBoundingClientRect();
  const tileSize = state.map.tileSize;
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  const gx = Math.floor(mx / tileSize);
  const gy = Math.floor(my / tileSize);
  const map = state.map;
  if (gx < 0 || gy < 0 || gx >= map.width || gy >= map.height) return null;
  return { gridX: gx, gridY: gy };
}

function normalizeCoords(a, b) {
  const start = {
    gridX: Math.min(a.gridX, b.gridX),
    gridY: Math.min(a.gridY, b.gridY),
  };
  const end = {
    gridX: Math.max(a.gridX, b.gridX),
    gridY: Math.max(a.gridY, b.gridY),
  };
  return { start, end };
}

function getSelectionRectFromDrag(start, end) {
  const n = normalizeCoords(start, end);
  return {
    x: n.start.gridX,
    y: n.start.gridY,
    w: n.end.gridX - n.start.gridX + 1,
    h: n.end.gridY - n.start.gridY + 1,
    name: '',
    note: '',
  };
}

// Bresenham 直线算法：返回从 (x0,y0) 到 (x1,y1) 经过的所有格子坐标
function bresenhamLine(x0, y0, x1, y1) {
  const cells = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0, y = y0;
  while (true) {
    cells.push({ gx: x, gy: y });
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
  return cells;
}

// 判断选区是否包含某格
function selectionContains(sel, gx, gy) {
  return gx >= sel.x && gx < sel.x + sel.w &&
         gy >= sel.y && gy < sel.y + sel.h;
}

// 查找位于某格的选区（从后往前，优先最新创建 / 最小的）
function findSelectionAt(gx, gy) {
  let found = null;
  let foundIdx = -1;
  let foundArea = Infinity;
  for (let i = state.selections.length - 1; i >= 0; i--) {
    const sel = state.selections[i];
    if (selectionContains(sel, gx, gy)) {
      const area = sel.w * sel.h;
      if (!found || area < foundArea) {
        found = sel;
        foundIdx = i;
        foundArea = area;
      }
    }
  }
  return { sel: found, idx: foundIdx };
}

// ==========================================================
// 9. 鼠标事件
// ==========================================================
function setupCanvasEvents() {
  const canvas = state.els.canvas;

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('mouseleave', onMouseUp); // 离开画布视为结束
}

function onMouseDown(e) {
  if (!state.map) return;

  // 空格+拖拽：平移画布视图
  if (state.spaceHeld) {
    state.isSpaceDragging = true;
    state.spaceDragStart = {
      clientX: e.clientX,
      clientY: e.clientY,
      scrollLeft: state.els.container.scrollLeft,
      scrollTop: state.els.container.scrollTop,
    };
    e.preventDefault();
    return;
  }

  // Alt+点击：吸管取色
  if (state.altHeld) {
    const pos = getGridPos(e);
    if (pos) {
      const color = state.map.data[pos.gridY][pos.gridX];
      if (color) {
        state.activeColor = color;
        renderColorPalette();
      }
    }
    return;
  }

  const pos = getGridPos(e);
  if (!pos) return;

  const { gridX, gridY } = pos;
  const tool = state.activeTool;

  // Ctrl+点击: 选中有选区
  if (state.ctrlHeld) {
    const found = findSelectionAt(gridX, gridY);
    if (found.sel) {
      state.selectedSelectionIdx = found.idx;
      render();
      renderSelectionPanel();
    } else {
      state.selectedSelectionIdx = -1;
      render();
      renderSelectionPanel();
    }
    return;
  }

  // 非 Ctrl：工具行为
  if (tool === 'pencil') {
    paintCell(gridX, gridY);
    state.isDragging = true;
    state.lastPainted = { gridX, gridY };
  } else if (tool === 'eraser') {
    eraseCell(gridX, gridY);
    state.isDragging = true;
    state.lastPainted = { gridX, gridY };
  } else if (tool === 'flood-fill') {
    floodFill(gridX, gridY);
  } else if (tool === 'rect-fill' || tool === 'rect-eraser' || tool === 'selection') {
    state.isDragging = true;
    state.dragStart = { gridX, gridY };
    state.dragEnd = { gridX, gridY };
  }
}

function onMouseMove(e) {
  if (!state.map) return;

  // 空格拖拽平移
  if (state.isSpaceDragging && state.spaceDragStart) {
    const dx = e.clientX - state.spaceDragStart.clientX;
    const dy = e.clientY - state.spaceDragStart.clientY;
    state.els.container.scrollLeft = state.spaceDragStart.scrollLeft - dx;
    state.els.container.scrollTop = state.spaceDragStart.scrollTop - dy;
    return;
  }

  if (!state.isDragging) return;
  const pos = getGridPos(e);
  if (!pos) return;
  state.dragEnd = { gridX: pos.gridX, gridY: pos.gridY };

  const tool = state.activeTool;
  if (tool === 'pencil' || tool === 'eraser') {
    // 铅笔/橡皮拖拽连续绘制：Bresenham 插值后批量修改，最后一次性重绘
    const last = state.lastPainted;
    if (last && (last.gridX !== pos.gridX || last.gridY !== pos.gridY)) {
      const cells = bresenhamLine(last.gridX, last.gridY, pos.gridX, pos.gridY);
      const color = tool === 'pencil' ? state.activeColor : null;
      let changed = false;
      for (const c of cells) {
        if (state.map.data[c.gy][c.gx] !== color) {
          state.map.data[c.gy][c.gx] = color;
          changed = true;
        }
      }
      state.lastPainted = { gridX: pos.gridX, gridY: pos.gridY };
      if (changed) {
        render();
        renderMapInfo();
      }
    }
    return;
  }

  // 矩形/选框拖拽预览
  render();
}

function onMouseUp(e) {
  // 空格拖拽结束
  if (state.isSpaceDragging) {
    state.isSpaceDragging = false;
    state.spaceDragStart = null;
    return;
  }

  if (!state.map || !state.isDragging) return;
  state.isDragging = false;

  const tool = state.activeTool;
  if (tool === 'pencil' || tool === 'eraser') {
    // 铅笔/橡皮拖拽结束，清除追踪状态
    state.lastPainted = null;
    return;
  }

  if (state.dragStart && state.dragEnd) {
    const tool = state.activeTool;
    if (tool === 'rect-fill') {
      rectFill(state.dragStart, state.dragEnd);
      renderMapInfo();
    } else if (tool === 'rect-eraser') {
      rectEraser(state.dragStart, state.dragEnd);
      renderMapInfo();
    } else if (tool === 'selection') {
      // 至少 1x1
      const rect = getSelectionRectFromDrag(state.dragStart, state.dragEnd);
      state.selections.push({ ...rect });
      state.selectedSelectionIdx = state.selections.length - 1;
      renderSelectionPanel();
    }
  }

  state.dragStart = null;
  state.dragEnd = null;
  render();
}

// ==========================================================
// 10. 工具实现
// ==========================================================

// 10a. 铅笔
function paintCell(gx, gy) {
  if (!state.map) return;
  state.map.data[gy][gx] = state.activeColor;
  render();
  renderMapInfo();
}

// 10b. 橡皮
function eraseCell(gx, gy) {
  if (!state.map) return;
  state.map.data[gy][gx] = null;
  render();
  renderMapInfo();
}

// 10c. 矩形填充
function rectFill(a, b) {
  if (!state.map) return;
  const n = normalizeCoords(a, b);
  const color = state.activeColor;
  for (let gy = n.start.gridY; gy <= n.end.gridY; gy++) {
    for (let gx = n.start.gridX; gx <= n.end.gridX; gx++) {
      state.map.data[gy][gx] = color;
    }
  }
  render();
  renderMapInfo();
}

// 10c2. 矩形橡皮
function rectEraser(a, b) {
  if (!state.map) return;
  const n = normalizeCoords(a, b);
  for (let gy = n.start.gridY; gy <= n.end.gridY; gy++) {
    for (let gx = n.start.gridX; gx <= n.end.gridX; gx++) {
      state.map.data[gy][gx] = null;
    }
  }
  render();
  renderMapInfo();
}

// 10d. 泛洪填充
function floodFill(startGX, startGY) {
  const map = state.map;
  if (!map) return;
  const targetColor = map.data[startGY][startGX];
  const fillColor = state.activeColor;
  if (targetColor === fillColor) return;

  const w = map.width;
  const h = map.height;
  const data = map.data;
  const visited = new Set();
  const stack = [{ gx: startGX, gy: startGY }];

  while (stack.length > 0) {
    const { gx, gy } = stack.pop();
    const key = `${gx},${gy}`;
    if (visited.has(key)) continue;
    visited.add(key);
    if (gx < 0 || gy < 0 || gx >= w || gy >= h) continue;
    if (data[gy][gx] !== targetColor) continue;

    data[gy][gx] = fillColor;

    stack.push({ gx: gx + 1, gy });
    stack.push({ gx: gx - 1, gy });
    stack.push({ gx, gy: gy + 1 });
    stack.push({ gx, gy: gy - 1 });
  }
  render();
}

// ==========================================================
// 10e. 调整地图尺寸
// ==========================================================
function resizeMap(newW, newH, align) {
  const map = state.map;
  if (!map) return;
  const oldW = map.width;
  const oldH = map.height;
  const oldData = map.data;

  let offX, offY;
  if (align === 'center') {
    offX = Math.floor((newW - oldW) / 2);
    offY = Math.floor((newH - oldH) / 2);
  } else {
    offX = 0;
    offY = 0;
  }

  // 创建新网格
  const newData = [];
  for (let y = 0; y < newH; y++) {
    newData.push(new Array(newW).fill(null));
  }

  // 复制旧数据到新位置（超出裁剪）
  for (let y = 0; y < oldH; y++) {
    for (let x = 0; x < oldW; x++) {
      const ny = offY + y;
      const nx = offX + x;
      if (ny >= 0 && ny < newH && nx >= 0 && nx < newW) {
        newData[ny][nx] = oldData[y][x];
      }
    }
  }

  state.map.width = newW;
  state.map.height = newH;
  state.map.data = newData;

  // 更新画布尺寸
  updateCanvasSize();
  render();
  renderMapInfo();
}

// ==========================================================
// 10f. 移动地图（循环移位）
// ==========================================================
function shiftMap(dir, amount) {
  const map = state.map;
  if (!map || amount === 0) return;
  const { width, height, data } = map;
  const maxDim = (dir === 'left' || dir === 'right') ? width : height;
  amount = ((amount % maxDim) + maxDim) % maxDim; // 归一化到 [0, maxDim)
  if (amount === 0) return;

  const newData = [];
  for (let y = 0; y < height; y++) {
    newData.push(new Array(width).fill(null));
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sx, sy;
      switch (dir) {
        case 'right':
          sx = (x - amount + width) % width;
          sy = y;
          break;
        case 'left':
          sx = (x + amount) % width;
          sy = y;
          break;
        case 'down':
          sx = x;
          sy = (y - amount + height) % height;
          break;
        case 'up':
          sx = x;
          sy = (y + amount) % height;
          break;
        default:
          sx = x; sy = y;
      }
      newData[y][x] = data[sy][sx];
    }
  }

  state.map.data = newData;
  render();
  renderMapInfo();
}

// ==========================================================
// 10g. 辅助：更新 canvas 尺寸
// ==========================================================
function updateCanvasSize() {
  const map = state.map;
  if (!map) return;
  const canvas = state.els.canvas;
  canvas.width = map.width * map.tileSize;
  canvas.height = map.height * map.tileSize;
  canvas.style.width = canvas.width + 'px';
  canvas.style.height = canvas.height + 'px';
}
// ==========================================================
function renderSelectionPanel() {
  const el = state.els.selectionInfo;
  const idx = state.selectedSelectionIdx;

  if (idx < 0 || idx >= state.selections.length) {
    el.innerHTML = `<p class="hint">请使用选框工具拖拽创建选区<br>或在任意工具下按住 Ctrl 点击选中已有选区</p>`;
    return;
  }

  const sel = state.selections[idx];
  const html = `
    <div id="selection-editor">
      <div class="selection-info-row">
        位置: (${sel.x}, ${sel.y}) · 大小: ${sel.w}×${sel.h}
      </div>
      <label>
        显示名
        <input type="text" id="sel-name" value="${escapeHtml(sel.name)}" placeholder="例: 城镇广场">
      </label>
      <label>
        备注
        <textarea id="sel-note" placeholder="描述这块区域的用途或规划…">${escapeHtml(sel.note)}</textarea>
      </label>
      <button class="btn-remove" id="sel-remove">删除选区</button>
    </div>
  `;
  el.innerHTML = html;

  // 绑定事件
  const nameInput = document.getElementById('sel-name');
  const noteInput = document.getElementById('sel-note');
  const removeBtn = document.getElementById('sel-remove');

  nameInput.addEventListener('input', () => {
    state.selections[idx].name = nameInput.value;
    render();
  });
  noteInput.addEventListener('input', () => {
    state.selections[idx].note = noteInput.value;
  });
  removeBtn.addEventListener('click', () => {
    state.selections.splice(idx, 1);
    state.selectedSelectionIdx = -1;
    render();
    renderSelectionPanel();
  });
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

// ==========================================================
// 12. 地图信息面板
// ==========================================================
function renderMapInfo() {
  const el = state.els.mapInfo;
  if (!state.map) {
    el.innerHTML = `<p class="hint">暂无地图</p>`;
    return;
  }
  const m = state.map;
  // 统计已绘制的格子数
  let filled = 0;
  for (let y = 0; y < m.height; y++) {
    for (let x = 0; x < m.width; x++) {
      if (m.data[y][x]) filled++;
    }
  }
  const total = m.width * m.height;
  el.innerHTML = `
    <div id="map-info-content">
      <div class="info-row"><span class="info-label">尺寸</span><span>${m.width} × ${m.height}</span></div>
      <div class="info-row"><span class="info-label">Tile 大小</span><span>${m.tileSize}px</span></div>
      <div class="info-row"><span class="info-label">总格数</span><span>${total}</span></div>
      <div class="info-row"><span class="info-label">已绘制</span><span>${filled} (${Math.round(filled/total*100)}%)</span></div>
      <div class="info-row"><span class="info-label">选区数</span><span>${state.selections.length}</span></div>
    </div>
  `;

  // 预填调整尺寸的输入框
  state.els.resizeW.value = m.width;
  state.els.resizeH.value = m.height;
}

// ==========================================================
// 13. 键盘事件（Ctrl 检测）
// ==========================================================
function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') {
      state.ctrlHeld = true;
    }
    if (e.key === ' ') {
      state.spaceHeld = true;
      e.preventDefault(); // 阻止空格触发页面滚动
    }
    if (e.key === 'Alt') {
      state.altHeld = true;
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control') {
      state.ctrlHeld = false;
    }
    if (e.key === ' ') {
      state.spaceHeld = false;
      // 如果正在空格拖拽中松开空格，强制结束拖拽
      if (state.isSpaceDragging) {
        state.isSpaceDragging = false;
        state.spaceDragStart = null;
      }
    }
    if (e.key === 'Alt') {
      state.altHeld = false;
    }
  });
  // 窗口失焦时重置，防止按键卡住
  window.addEventListener('blur', () => {
    state.ctrlHeld = false;
    state.spaceHeld = false;
    state.altHeld = false;
    if (state.isSpaceDragging) {
      state.isSpaceDragging = false;
      state.spaceDragStart = null;
    }
  });
}

// ==========================================================
// 14. 导出 / 导入
// ==========================================================

// 14a. 导出 JSON
function exportJSON() {
  if (!state.map) {
    alert('请先创建地图');
    return;
  }
  const data = {
    version: 1,
    map: state.map,
    selections: state.selections,
  };
  const json = JSON.stringify(data, null, 2);
  downloadBlob(json, 'rmmz-map-draft.json', 'application/json');
}

// 14b. 导入 JSON
function importJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.map || !data.map.data) {
        alert('无效的地图文件');
        return;
      }
      state.map = data.map;
      state.selections = data.selections || [];
      state.selectedSelectionIdx = -1;

      // 更新 canvas
      const canvas = state.els.canvas;
      canvas.width = state.map.width * state.map.tileSize;
      canvas.height = state.map.height * state.map.tileSize;
      canvas.style.width = canvas.width + 'px';
      canvas.style.height = canvas.height + 'px';
      state.els.emptyHint.style.display = 'none';
      state.els.canvas.style.display = 'block';

      render();
      renderSelectionPanel();
      renderMapInfo();
    } catch (err) {
      alert('文件解析失败: ' + err.message);
    }
  };
  reader.readAsText(file);
}

// 14c. 导出 PNG
function exportPNG() {
  if (!state.map) {
    alert('请先创建地图');
    return;
  }
  // 先渲染到 canvas（已有），直接导出
  const canvas = state.els.canvas;
  canvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'rmmz-map-draft.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

function downloadBlob(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ==========================================================
// 15. 模态框
// ==========================================================
function showModal() {
  state.els.modalOverlay.classList.remove('hidden');
  // 用当前地图设置预填值（如有）
  if (state.map) {
    state.els.mapWidth.value = state.map.width;
    state.els.mapHeight.value = state.map.height;
    state.els.mapTile.value = state.map.tileSize;
  }
  state.els.mapWidth.focus();
}

function hideModal() {
  state.els.modalOverlay.classList.add('hidden');
}

function setupModal() {
  state.els.modalConfirm.addEventListener('click', () => {
    const w = parseInt(state.els.mapWidth.value, 10);
    const h = parseInt(state.els.mapHeight.value, 10);
    const t = parseInt(state.els.mapTile.value, 10);
    if (!w || !h || !t || w < 1 || h < 1 || t < 8) {
      alert('请填写有效的地图参数（宽/高 ≥ 1，格大小 ≥ 8px）');
      return;
    }
    createMap(w, h, t);
    hideModal();
  });

  state.els.modalCancel.addEventListener('click', hideModal);

  // 点击遮罩关闭
  state.els.modalOverlay.addEventListener('click', (e) => {
    if (e.target === state.els.modalOverlay) hideModal();
  });

  // 回车提交
  state.els.modalOverlay.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') state.els.modalConfirm.click();
    if (e.key === 'Escape') hideModal();
  });
}

// ==========================================================
// 16. 在 resize 或 map 变动时更新地图信息
// ==========================================================
function updateMapInfoLater() {
  renderMapInfo();
}

// ==========================================================
// 17. 启动
// ==========================================================
function init() {
  cacheElements();

  // 初始状态
  state.els.canvas.style.display = 'none';

  // 渲染 UI
  renderColorPalette();
  renderToolbar();
  renderSelectionPanel();
  renderMapInfo();

  // 事件
  setupToolbar();
  setupCanvasEvents();
  setupKeyboard();
  setupModal();

  // 新建地图
  state.els.btnNew.addEventListener('click', showModal);

  // 导出/导入
  state.els.btnExportJson.addEventListener('click', exportJSON);
  state.els.btnImportJson.addEventListener('click', () => {
    state.els.fileInput.click();
  });
  state.els.fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      importJSON(e.target.files[0]);
    }
    e.target.value = '';
  });
  state.els.btnExportPng.addEventListener('click', exportPNG);

  // 调整尺寸
  state.els.btnResize.addEventListener('click', () => {
    if (!state.map) return alert('请先创建地图');
    const w = parseInt(state.els.resizeW.value, 10);
    const h = parseInt(state.els.resizeH.value, 10);
    if (!w || !h || w < 1 || h < 1) return alert('宽高必须 ≥ 1');
    const align = document.querySelector('input[name="resize-align"]:checked').value;
    resizeMap(w, h, align);
  });

  // 移动地图
  state.els.btnShift.addEventListener('click', () => {
    if (!state.map) return alert('请先创建地图');
    const dir = state.els.shiftDir.value;
    const amt = parseInt(state.els.shiftAmount.value, 10);
    if (!amt || amt < 1) return alert('格数必须 ≥ 1');
    shiftMap(dir, amt);
  });

  // 如果页面加载时已有模态框显示，聚焦
  if (!state.els.modalOverlay.classList.contains('hidden')) {
    state.els.mapWidth.focus();
  }
}

// DOM Ready
document.addEventListener('DOMContentLoaded', init);
