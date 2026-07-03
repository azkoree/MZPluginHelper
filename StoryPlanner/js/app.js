// ==================== DATA MODEL ====================
const DEFAULT_PROJECT = {
  title: '未命名项目',
  chapters: [
    {
      id: 'ch1',
      name: '第一章',
      collapsed: false,
      scenes: [
        {
          id: 'sc1', name: '开场 — 觉醒之日',
          meta: { map:'', bgm:'', characters:[], tags:['主线','开场'], note:'' },
          commands: [
            { id:'c1', type:'fadein', params:{duration:'60帧'} },
            { id:'c2', type:'dialogue', params:{speaker:'???',text:'你终于醒来了。'} },
            { id:'c3', type:'expression', params:{target:'???',expression:'微笑'} },
            { id:'c4', type:'dialogue', params:{speaker:'???',text:'欢迎来到这个世界。'} },
            { id:'c5', type:'fadeout', params:{duration:'30帧'} },
          ]
        }
      ]
    }
  ]
};

// ==================== STATE ====================
const App = {
  project: null,
  activeSceneId: null,
  activeChapterId: null,
  editingCmdId: null,
  _saveTimer: null,
  // system reference
  activeMetaTab: 'meta',
  systemSwitches: [],
  systemVariables: [],
  activeSysTab: 'switches',
  sysPage: 0,

  init() {
    this.load();
    this.renderAll();
    this.bindTitle();
    this.restorePanelState();
    document.addEventListener('keydown', (e) => this.onKeydown(e));
  },

  restorePanelState() {
    if (localStorage.getItem('storyplanner_panel_collapsed') === '1') {
      const panel = document.querySelector('.scene-panel');
      const toggle = document.querySelector('.panel-toggle');
      panel.classList.add('collapsed');
      if (toggle) { toggle.textContent = '▶'; toggle.title = '展开场景列表'; }
    }
  },

  // ---- persistence ----
  storageKey: 'storyplanner_project',

  load() {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        this.project = JSON.parse(raw);
        // ensure data integrity
        if (!this.project.chapters) this.project = DEFAULT_PROJECT;
      } else {
        this.project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
      }
    } catch(e) {
      this.project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    }
  },

  save() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => {
      localStorage.setItem(this.storageKey, JSON.stringify(this.project));
    }, 200);
  },

  saveNow() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.project));
  },

  // ---- helpers ----
  findScene(id) {
    for (const ch of this.project.chapters) {
      for (const sc of ch.scenes) {
        if (sc.id === id) return { chapter:ch, scene:sc };
      }
    }
    return null;
  },

  findChapter(id) {
    return this.project.chapters.find(ch => ch.id === id) || null;
  },

  uid() {
    return 'id_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2,7);
  },

  // ---- rendering ----
  renderAll() {
    this.renderSceneList();
    this.renderMeta();
    this.renderCommandList();
  },

  renderSceneList() {
    const el = document.getElementById('sceneList');
    let html = '';
    for (const ch of this.project.chapters) {
      const chevron = ch.collapsed ? '▸' : '▾';
      html += `<div class="scene-node" data-chapter="${ch.id}">`;
      html += `<div class="scene-chapter${ch.collapsed?' collapsed':''}" data-chapter="${ch.id}" onclick="App.toggleChapter('${ch.id}')" ondragover="App.onChapterDragOver(event)" ondragleave="App.onChapterDragLeave(event)" ondrop="App.onChapterDrop(event)">`;
      html += `<span class="chevron">${chevron}</span>`;
      html += `<span class="ch-name">${this.esc(ch.name)}</span>`;
      html += `<span class="ch-count">${ch.scenes.length}场</span>`;
      html += `<span class="s-del" style="opacity:0.6;font-size:0.65rem;" onclick="event.stopPropagation();App.deleteChapter('${ch.id}')" title="删除章节">×</span>`;
      html += `</div>`;
      if (!ch.collapsed) {
        for (const sc of ch.scenes) {
          const activeClass = sc.id === this.activeSceneId ? ' active' : '';
          html += `<div class="scene-item${activeClass}" draggable="true" data-scene="${sc.id}" data-chapter="${ch.id}" onclick="App.selectScene('${ch.id}','${sc.id}')" ondragstart="App.onSceneDragStart(event)" ondragover="App.onSceneDragOver(event)" ondragenter="App.onSceneDragEnter(event)" ondragleave="App.onSceneDragLeave(event)" ondrop="App.onSceneDrop(event)" ondragend="App.onSceneDragEnd(event)">`;
          html += `<span class="s-name">${this.esc(sc.name) || '未命名场景'}</span>`;
          html += `<span class="s-del" onclick="event.stopPropagation();App.deleteScene('${ch.id}','${sc.id}')" title="删除场景">×</span>`;
          html += `</div>`;
        }
      }
      html += `<div class="scene-add" onclick="App.addScene('${ch.id}')" ondragover="App.onChapterDragOver(event)" ondragleave="App.onChapterDragLeave(event)" ondrop="App.onChapterDrop(event)">+ 添加场景</div>`;
      html += `</div>`;
    }
    if (this.project.chapters.length === 0) {
      html += `<div style="padding:20px;text-align:center;color:var(--text-muted);font-size:0.8125rem;">暂无章节<br><br><button class="btn" onclick="App.addChapter()">+ 创建第一章</button></div>`;
    }
    el.innerHTML = html;
  },

  renderMeta() {
    const tabMeta = document.getElementById('tabMeta');
    if (!this.activeSceneId) {
      tabMeta.style.opacity = '0.4';
      document.getElementById('metaName').value = '';
      document.getElementById('metaMap').value = '';
      document.getElementById('metaBGM').value = '';
      document.getElementById('metaNote').value = '';
      document.getElementById('metaChars').innerHTML = '';
      document.getElementById('metaTags').innerHTML = '';
      return;
    }
    tabMeta.style.opacity = '1';
    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    const meta = found.scene.meta || {};
    document.getElementById('metaName').value = meta._nameOverride || found.scene.name || '';
    document.getElementById('metaMap').value = meta.map || '';
    document.getElementById('metaBGM').value = meta.bgm || '';
    document.getElementById('metaNote').value = meta.note || '';

    this.renderTags('metaChars', meta.characters || [], 'chars');
    this.renderTags('metaTags', meta.tags || [], 'tags');
  },

  renderTags(containerId, items, kind) {
    const el = document.getElementById(containerId);
    let html = items.map((t,i) =>
      `<span class="tag">${this.esc(t)}<span class="tag-x" onclick="App.removeTag('${kind}',${i})">×</span></span>`
    ).join('');
    html += `<input class="tag-input" placeholder="+添加" onkeydown="App.onTagKey(event,'${kind}','${containerId}')">`;
    el.innerHTML = html;
  },

  renderCommandList() {
    const el = document.getElementById('cmdList');
    const titleEl = document.getElementById('sceneTitleDisplay');
    const countEl = document.getElementById('cmdCount');
    const noHint = document.getElementById('noSceneHint');

    if (!this.activeSceneId) {
      titleEl.textContent = '未选择场景';
      countEl.textContent = '';
      el.innerHTML = `<div class="no-scene" id="noSceneHint">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>
        <p>👈 从左侧选择一个场景<br>然后在指令面板中点击插入演出指令</p>
      </div>`;
      return;
    }

    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    const scene = found.scene;
    titleEl.textContent = scene.name || '未命名场景';
    countEl.textContent = `${scene.commands.length} 条指令`;

    if (scene.commands.length === 0) {
      el.innerHTML = `<div class="cmd-empty">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
        <p>暂无演出指令<br>从左侧指令面板点击添加</p>
      </div>`;
      return;
    }

    let html = '';
    scene.commands.forEach((cmd, idx) => {
      html += this.renderCommandItem(cmd, idx, scene.commands.length);
    });
    el.innerHTML = html;
  },

  renderCommandItem(cmd, idx, total) {
    const typeLabel = {
      dialogue: '显示文字', expression: '更改表情', move: '移动路线',
      fadein: '淡入画面', fadeout: '淡出画面', wait: '等待',
      bgm: '播放BGM', se: '播放SE', comment: '注释', branch: '条件分支', cg: 'CG演出'
    }[cmd.type] || cmd.type;

    let contentHtml = '';
    switch(cmd.type) {
      case 'dialogue':
        contentHtml = `<span class="speaker">${this.esc(cmd.params.speaker||'???')}</span>：「${this.esc(cmd.params.text||'')}」`;
        break;
      case 'expression':
        contentHtml = `<span class="speaker">${this.esc(cmd.params.target||'')}</span> 的表情变为 <span class="expr">${this.esc(cmd.params.expression||'')}</span>`;
        break;
      case 'move':
        contentHtml = `<span class="speaker">${this.esc(cmd.params.target||'')}</span> ${this.esc(cmd.params.route||'')}`;
        break;
      case 'fadein':
        contentHtml = `画面淡入 <span class="expr">${this.esc(cmd.params.duration||'60帧')}</span>`;
        break;
      case 'fadeout':
        contentHtml = `画面淡出 <span class="expr">${this.esc(cmd.params.duration||'60帧')}</span>`;
        break;
      case 'wait':
        contentHtml = `等待 <span class="expr">${this.esc(cmd.params.duration||'60帧')}</span>`;
        break;
      case 'bgm':
        contentHtml = `BGM：<span class="bgm">${this.esc(cmd.params.name||'')}</span>${cmd.params.volume ? ` 音量:${cmd.params.volume}` : ''}`;
        break;
      case 'se':
        contentHtml = `SE：<span class="bgm">${this.esc(cmd.params.name||'')}</span>`;
        break;
      case 'comment':
        contentHtml = `<span class="comment-text">${this.esc(cmd.params.text||'')}</span>`;
        break;
      case 'cg':
        contentHtml = `<span class="cg-image">CG：${this.esc(cmd.params.file||'')}</span>${cmd.params.text ? `｜${this.esc(cmd.params.text)}` : ''} ${cmd.params.transition ? `<span class="expr">[${this.esc(cmd.params.transition)}]</span>` : ''}`;
        break;
      case 'branch':
        contentHtml = this._branchContentHtml(cmd.params);
        break;
      default:
        contentHtml = this.esc(JSON.stringify(cmd.params));
    }

    return `<div class="cmd-item type--${cmd.type}" draggable="true" data-cmd-id="${cmd.id}" onclick="App.editCommand('${cmd.id}')" ondragstart="App.onCmdDragStart(event)" ondragover="App.onCmdDragOver(event)" ondragenter="App.onCmdDragEnter(event)" ondragleave="App.onCmdDragLeave(event)" ondrop="App.onCmdDrop(event)" ondragend="App.onCmdDragEnd(event)">
      <span class="cmd-marker">◆</span>
      <div class="cmd-body">
        <div class="cmd-type-label">${typeLabel}</div>
        <div class="cmd-content">${contentHtml}</div>
      </div>
      <div class="cmd-actions">
        <button title="上移" onclick="event.stopPropagation();App.moveCommand('${cmd.id}',-1)">▲</button>
        <button title="下移" onclick="event.stopPropagation();App.moveCommand('${cmd.id}',1)">▼</button>
        <button class="del" title="删除" onclick="event.stopPropagation();App.deleteCommand('${cmd.id}')">×</button>
      </div>
    </div>`;
  },

  // ---- chapter/scene management ----
  toggleScenePanel() {
    const panel = document.querySelector('.scene-panel');
    const toggle = document.querySelector('.panel-toggle');
    const collapsed = panel.classList.toggle('collapsed');
    if (toggle) {
      toggle.textContent = collapsed ? '▶' : '◀';
      toggle.title = collapsed ? '展开场景列表' : '折叠场景列表';
    }
    localStorage.setItem('storyplanner_panel_collapsed', collapsed ? '1' : '0');
  },

  addChapter() {
    const ch = {
      id: this.uid(),
      name: `第${this.project.chapters.length + 1}章`,
      collapsed: false,
      scenes: []
    };
    this.project.chapters.push(ch);
    this.save();
    this.renderSceneList();
    this.toast('已添加章节');
  },

  deleteChapter(chId) {
    if (!confirm('删除该章节及其所有场景？此操作不可恢复。')) return;
    this.project.chapters = this.project.chapters.filter(ch => ch.id !== chId);
    if (this.activeChapterId === chId) {
      this.activeChapterId = null;
      this.activeSceneId = null;
    }
    this.save();
    this.renderAll();
    this.toast('已删除章节');
  },

  toggleChapter(chId) {
    const ch = this.findChapter(chId);
    if (ch) {
      ch.collapsed = !ch.collapsed;
      this.save();
      this.renderSceneList();
    }
  },

  addScene(chapterId) {
    const ch = chapterId ? this.findChapter(chapterId) : this.project.chapters[0];
    if (!ch) return;
    const sc = {
      id: this.uid(),
      name: `场景 ${ch.scenes.length + 1}`,
      meta: { map:'', bgm:'', characters:[], tags:[], note:'' },
      commands: []
    };
    ch.scenes.push(sc);
    this.activeSceneId = sc.id;
    this.activeChapterId = ch.id;
    this.save();
    this.renderAll();
    this.toast('已添加场景');
  },

  selectScene(chId, scId) {
    this.activeChapterId = chId;
    this.activeSceneId = scId;
    this.renderAll();
  },

  deleteScene(chId, scId) {
    if (!confirm('删除该场景及其所有指令？此操作不可恢复。')) return;
    const ch = this.findChapter(chId);
    if (!ch) return;
    ch.scenes = ch.scenes.filter(sc => sc.id !== scId);
    if (this.activeSceneId === scId) {
      this.activeSceneId = null;
      this.activeChapterId = null;
    }
    this.save();
    this.renderAll();
    this.toast('已删除场景');
  },

  // ---- drag state ----
  dragData: null,

  // ---- scene drag & drop ----
  onSceneDragStart(e) {
    const item = e.target.closest('.scene-item');
    if (!item) return;
    const scId = item.dataset.scene;
    const chId = item.dataset.chapter;
    this.dragData = { type: 'scene', chapterId: chId, sceneId: scId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', scId);
    // visual feedback after next microtask
    setTimeout(() => item.classList.add('dragging'), 0);
  },

  onSceneDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.target.closest('.scene-item');
    if (!item || !this.dragData) return;
    const rect = item.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    item.classList.remove('drag-over-top', 'drag-over-bottom');
    item.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
  },

  onSceneDragEnter(e) {
    e.preventDefault();
  },

  onSceneDragLeave(e) {
    const item = e.target.closest('.scene-item');
    if (item) {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    }
    const chapter = e.target.closest('.scene-chapter, .scene-add');
    if (chapter) {
      chapter.classList.remove('drag-over');
    }
  },

  onSceneDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    if (!this.dragData || this.dragData.type !== 'scene') return;
    this._finishSceneDrag(e);
    this._clearDragVisuals();
    this.dragData = null;
    this.save();
    this.renderAll();
    this.toast('已重排场景');
  },

  _finishSceneDrag(e) {
    const data = this.dragData;
    const srcCh = this.findChapter(data.chapterId);
    if (!srcCh) return;
    const srcIdx = srcCh.scenes.findIndex(s => s.id === data.sceneId);
    if (srcIdx < 0) return;

    // Determine target
    let targetCh, targetIdx;
    const dropItem = e.target.closest('.scene-item');
    const dropChapter = e.target.closest('.scene-chapter, .scene-add');

    if (dropItem) {
      const tChId = dropItem.dataset.chapter;
      targetCh = this.findChapter(tChId);
      if (!targetCh) return;
      let tIdx = targetCh.scenes.findIndex(s => s.id === dropItem.dataset.scene);
      if (tIdx < 0) return;

      const rect = dropItem.getBoundingClientRect();
      const mid = rect.top + rect.height / 2;
      const insertAfter = e.clientY >= mid;

      // Remove source first
      const [scene] = srcCh.scenes.splice(srcIdx, 1);
      // Recalculate target index if moving within same chapter
      if (data.chapterId === tChId) {
        tIdx = targetCh.scenes.findIndex(s => s.id === dropItem.dataset.scene);
        if (tIdx < 0) return;
      }
      targetCh.scenes.splice(insertAfter ? tIdx + 1 : tIdx, 0, scene);
    } else if (dropChapter) {
      const chId = dropChapter.dataset.chapter ||
                   dropChapter.closest('[data-chapter]')?.dataset.chapter;
      targetCh = this.findChapter(chId);
      if (!targetCh) return;
      const [scene] = srcCh.scenes.splice(srcIdx, 1);
      targetCh.scenes.push(scene);
    }
  },

  onSceneDragEnd(e) {
    this._clearDragVisuals();
    this.dragData = null;
  },

  _clearDragVisuals() {
    document.querySelectorAll('.scene-item.dragging, .scene-item.drag-over-top, .scene-item.drag-over-bottom').forEach(el => {
      el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
    document.querySelectorAll('.scene-chapter.drag-over, .scene-add.drag-over').forEach(el => {
      el.classList.remove('drag-over');
    });
  },

  // chapter-level drop (append to chapter)
  onChapterDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const target = e.currentTarget;
    target.classList.add('drag-over');
  },

  onChapterDragLeave(e) {
    const target = e.currentTarget;
    target.classList.remove('drag-over');
  },

  onChapterDrop(e) {
    e.preventDefault();
    const target = e.currentTarget;
    target.classList.remove('drag-over');
    if (!this.dragData || this.dragData.type !== 'scene') return;

    const chId = target.dataset.chapter ||
                 target.closest('[data-chapter]')?.dataset.chapter;
    if (!chId) return;
    const data = this.dragData;
    const srcCh = this.findChapter(data.chapterId);
    if (!srcCh) return;
    const srcIdx = srcCh.scenes.findIndex(s => s.id === data.sceneId);
    if (srcIdx < 0) return;

    targetCh = this.findChapter(chId);
    if (!targetCh) return;
    const [scene] = srcCh.scenes.splice(srcIdx, 1);
    targetCh.scenes.push(scene);

    this._clearDragVisuals();
    this.dragData = null;
    this.save();
    this.renderAll();
    this.toast('已移动场景');
  },

  // ---- metadata ----
  onMetaChange() {
    if (!this.activeSceneId) return;
    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    const meta = found.scene.meta || {};
    const nameVal = document.getElementById('metaName').value.trim();
    if (nameVal && nameVal !== found.scene.name) {
      found.scene.name = nameVal;
      meta._nameOverride = nameVal; // keep sync
    }
    meta.map = document.getElementById('metaMap').value.trim();
    meta.bgm = document.getElementById('metaBGM').value.trim();
    meta.note = document.getElementById('metaNote').value.trim();
    found.scene.meta = meta;
    this.save();
    // re-render scene list to show updated name
    this.renderSceneList();
    document.getElementById('sceneTitleDisplay').textContent = found.scene.name || '未命名场景';
  },

  onTagKey(e, kind, containerId) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = e.target.value.trim();
      if (!val || !this.activeSceneId) return;
      const found = this.findScene(this.activeSceneId);
      if (!found) return;
      const meta = found.scene.meta || {};
      const key = kind === 'chars' ? 'characters' : 'tags';
      const arr = meta[key] || [];
      if (!arr.includes(val)) {
        arr.push(val);
        meta[key] = arr;
        found.scene.meta = meta;
        this.save();
        this.renderMeta();
      }
    }
  },

  removeTag(kind, idx) {
    if (!this.activeSceneId) return;
    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    const meta = found.scene.meta || {};
    const key = kind === 'chars' ? 'characters' : 'tags';
    const arr = meta[key] || [];
    arr.splice(idx, 1);
    meta[key] = arr;
    found.scene.meta = meta;
    this.save();
    this.renderMeta();
  },

  // ---- system reference (switches/variables browser) ----
  switchMetaTab(tab) {
    this.activeMetaTab = tab;
    document.querySelectorAll('.meta-tab').forEach(t => t.classList.toggle('active', t.textContent.includes(tab === 'meta' ? '元数据' : '开关')));
    document.getElementById('tabMeta').style.display = tab === 'meta' ? '' : 'none';
    document.getElementById('tabSystem').style.display = tab === 'system' ? '' : 'none';
    // If switching to system tab, re-render
    if (tab === 'system' && (this.systemSwitches.length || this.systemVariables.length)) {
      this.sysPage = 0;
      this.renderSystemList();
    }
  },

  // ---- system file handling ----
  onSysDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    document.getElementById('systemDropZone').classList.add('drag-over');
  },
  onSysDragLeave(e) {
    document.getElementById('systemDropZone').classList.remove('drag-over');
  },
  onSysDrop(e) {
    e.preventDefault();
    document.getElementById('systemDropZone').classList.remove('drag-over');
    const files = e.dataTransfer.files;
    if (files.length > 0) this._loadSysFile(files[0]);
  },
  onSysClick() {
    document.getElementById('systemFileInput').click();
  },
  handleSysFile(e) {
    const file = e.target.files[0];
    if (file) this._loadSysFile(file);
    e.target.value = '';
  },

  _loadSysFile(file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!Array.isArray(data.switches) || !Array.isArray(data.variables)) {
          this.toast('该文件不包含开关和变量数据');
          return;
        }
        this.systemSwitches = data.switches;
        this.systemVariables = data.variables;
        this.activeSysTab = 'switches';
        this.sysPage = 0;
        this.renderSystemList();
        document.getElementById('systemDropZone').style.display = 'none';
        document.getElementById('systemContent').style.display = '';
        this.toast('已加载 ' + file.name);
      } catch(err) {
        this.toast('解析失败：无效的 JSON 文件');
      }
    };
    reader.readAsText(file);
  },

  // ---- sys tab switching ----
  switchSysTab(tab) {
    this.activeSysTab = tab;
    this.sysPage = 0;
    document.querySelectorAll('.sys-tab').forEach(t => t.classList.remove('active'));
    // find the right tab by onclick text content
    document.querySelectorAll('.sys-tab').forEach(t => {
      if ((tab === 'switches' && t.textContent.includes('开关')) ||
          (tab === 'variables' && t.textContent.includes('变量'))) {
        t.classList.add('active');
      }
    });
    this.renderSystemList();
  },

  // ---- sys list rendering ----
  renderSystemList() {
    const list = document.getElementById('sysList');
    const pag = document.getElementById('sysPagination');
    const stats = document.getElementById('sysStats');
    const data = this.activeSysTab === 'switches' ? this.systemSwitches : this.systemVariables;
    if (!data || data.length === 0) {
      list.innerHTML = '<div class="sys-empty">暂无数据</div>';
      pag.innerHTML = '';
      stats.textContent = '';
      return;
    }

    const perPage = 20;
    const total = data.length - 1; // exclude index 0 (empty)
    const maxPage = Math.ceil(total / perPage);
    const page = Math.min(this.sysPage, maxPage - 1);
    this.sysPage = Math.max(0, page);

    const typeLabel = this.activeSysTab === 'switches' ? '开关' : '变量';
    stats.textContent = `${typeLabel}总数：${total}`;

    // Build list
    let html = '';
    const start = page * perPage + 1; // start from index 1 (skip empty index 0)
    const end = Math.min(start + perPage - 1, data.length - 1);
    for (let i = start; i <= end; i++) {
      const name = data[i] || '';
      if (name) {
        html += `<div class="sys-item"><span class="sys-idx">#${i}</span><span class="sys-name">${this.esc(name)}</span></div>`;
      } else {
        html += `<div class="sys-item sys-item--empty"><span class="sys-idx">#${i}</span><span class="sys-name" style="color:var(--text-muted);font-style:italic;">（未命名）</span></div>`;
      }
    }
    list.innerHTML = html;

    // Pagination
    let pagHtml = '';
    if (maxPage <= 1) { pag.innerHTML = ''; return; }
    pagHtml += `<button class="btn btn--sm" onclick="App.goSysPage(${page - 1})" ${page <= 0 ? 'disabled' : ''}>‹ 上一页</button>`;
    pagHtml += `<span class="sys-page-info">第 <input class="sys-page-input" id="sysPageInput" type="number" min="1" max="${maxPage}" value="${page + 1}" onkeydown="App.onSysPageKey(event, ${maxPage})"> / ${maxPage} 页</span>`;
    pagHtml += `<button class="btn btn--sm" onclick="App.goSysPage(${page + 1})" ${page >= maxPage - 1 ? 'disabled' : ''}>下一页 ›</button>`;
    pag.innerHTML = pagHtml;
  },

  goSysPage(p) {
    this.sysPage = p;
    this.renderSystemList();
  },

  onSysPageKey(e, maxPage) {
    if (e.key === 'Enter') {
      e.preventDefault();
      let val = parseInt(e.target.value, 10);
      if (isNaN(val) || val < 1) val = 1;
      if (val > maxPage) val = maxPage;
      this.goSysPage(val - 1);
    }
  },

  // ---- commands ----
  insertCommand(type) {
    if (!this.activeSceneId) {
      this.toast('请先选择一个场景');
      return;
    }
    const found = this.findScene(this.activeSceneId);
    if (!found) return;

    const defaults = {
      dialogue:   { speaker:'', text:'' },
      expression: { target:'', expression:'' },
      move:       { target:'', route:'' },
      fadein:     { duration:'60帧' },
      fadeout:    { duration:'60帧' },
      wait:       { duration:'60帧' },
      bgm:        { name:'', volume:'', pan:'' },
      se:         { name:'', volume:'', pan:'' },
      comment:    { text:'TODO: ' },
      branch:     { conditionType:'switch', switchId:'', switchState:'ON', variableId:'', compareOp:'==', compareValue:'0', actorId:'', itemId:'', itemCount:'1', probability:'50%', customCondition:'', trueNote:'', falseNote:'' },
      cg:         { file:'', transition:'淡入', text:'', duration:'60帧' },
    };

    const cmd = {
      id: this.uid(),
      type: type,
      params: JSON.parse(JSON.stringify(defaults[type] || {}))
    };
    found.scene.commands.push(cmd);
    this.save();
    this.renderCommandList();
    // auto-open editor for the new command
    this.editCommand(cmd.id);
  },

  editCommand(cmdId) {
    if (!this.activeSceneId) return;
    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    const cmd = found.scene.commands.find(c => c.id === cmdId);
    if (!cmd) return;
    this.editingCmdId = cmdId;
    this.showEditor(cmd);
  },

  showEditor(cmd) {
    const overlay = document.getElementById('cmdEditorOverlay');
    const editor = document.getElementById('cmdEditor');

    const typeOptions = [
      {v:'dialogue',l:'显示文字'},{v:'expression',l:'更改表情'},{v:'move',l:'移动路线'},
      {v:'fadein',l:'淡入画面'},{v:'fadeout',l:'淡出画面'},{v:'wait',l:'等待'},
      {v:'bgm',l:'播放BGM'},{v:'se',l:'播放SE'},{v:'comment',l:'注释'},{v:'branch',l:'条件分支'},{v:'cg',l:'CG演出'},
    ];

    let fieldsHtml = `<div class="field"><label>指令类型</label><select id="editType">`;
    fieldsHtml += typeOptions.map(o => `<option value="${o.v}" ${cmd.type===o.v?'selected':''}>${o.l}</option>`).join('');
    fieldsHtml += `</select></div>`;

    const p = cmd.params || {};
    switch(cmd.type) {
      case 'dialogue':
        fieldsHtml += `<div class="field"><label>说话者</label><input id="editSpeaker" value="${this.escAttr(p.speaker||'')}" placeholder="角色名"></div>`;
        fieldsHtml += `<div class="field"><label>对话内容</label><textarea id="editText" placeholder="对话文本…">${this.esc(p.text||'')}</textarea></div>`;
        break;
      case 'expression':
        fieldsHtml += `<div class="field"><label>目标角色</label><input id="editTarget" value="${this.escAttr(p.target||'')}"></div>`;
        fieldsHtml += `<div class="field"><label>表情</label><input id="editExpr" value="${this.escAttr(p.expression||'')}" placeholder="例：悲伤、微笑、愤怒"></div>`;
        break;
      case 'move':
        fieldsHtml += `<div class="field"><label>目标角色</label><input id="editTarget" value="${this.escAttr(p.target||'')}"></div>`;
        fieldsHtml += `<div class="field"><label>移动描述</label><input id="editRoute" value="${this.escAttr(p.route||'')}" placeholder="例：靠近主角"></div>`;
        break;
      case 'fadein': case 'fadeout': case 'wait':
        fieldsHtml += `<div class="field"><label>持续时间</label><input id="editDuration" value="${this.escAttr(p.duration||'60帧')}" placeholder="例：60帧"></div>`;
        break;
      case 'bgm': case 'se':
        fieldsHtml += `<div class="field"><label>音频名称</label><input id="editName" value="${this.escAttr(p.name||'')}" placeholder="例：Battle1"></div>`;
        fieldsHtml += `<div class="field"><label>音量</label><input id="editVolume" value="${this.escAttr(p.volume||'')}" placeholder="0-100"></div>`;
        break;
      case 'comment':
        fieldsHtml += `<div class="field"><label>注释 / TODO</label><textarea id="editText" placeholder="备注内容…">${this.esc(p.text||'')}</textarea></div>`;
        break;
      case 'cg':
        fieldsHtml += `<div class="field"><label>CG 图片文件</label><input id="editCgFile" value="${this.escAttr(p.file||'')}" placeholder="例：cg_awakening"></div>`;
        fieldsHtml += `<div class="field"><label>过渡效果</label><input id="editCgTransition" value="${this.escAttr(p.transition||'')}" placeholder="淡入 / 溶解 / 切出…"></div>`;
        fieldsHtml += `<div class="field"><label>旁白 / 字幕</label><textarea id="editCgText" placeholder="画面显示的文本…">${this.esc(p.text||'')}</textarea></div>`;
        fieldsHtml += `<div class="field"><label>停留时间</label><input id="editCgDuration" value="${this.escAttr(p.duration||'60帧')}" placeholder="例：120帧"></div>`;
        break;
      case 'branch':
        fieldsHtml += `<div class="field"><label>条件类型</label><select id="editBrType" onchange="App._onBrTypeChange()"><option value="switch" ${(p.conditionType||'switch')==='switch'?'selected':''}>开关</option><option value="variable" ${p.conditionType==='variable'?'selected':''}>变量</option><option value="affection" ${p.conditionType==='affection'?'selected':''}>好感度</option><option value="item" ${p.conditionType==='item'?'selected':''}>持有物品</option><option value="random" ${p.conditionType==='random'?'selected':''}>随机</option><option value="custom" ${p.conditionType==='custom'?'selected':''}>自定义</option></select></div>`;
        fieldsHtml += `<div class="br-fields" id="brFields">`;
        fieldsHtml += this._branchEditFields(p);
        fieldsHtml += `</div>`;
        fieldsHtml += `<div class="field"><label>✔ 成立时说明</label><textarea id="editBrTrue" placeholder="条件成立时的剧情走向或执行内容…">${this.esc(p.trueNote||'')}</textarea></div>`;
        fieldsHtml += `<div class="field"><label>✘ 不成立时说明</label><textarea id="editBrFalse" placeholder="条件不成立时的剧情走向或执行内容…">${this.esc(p.falseNote||'')}</textarea></div>`;
        break;
    }

    editor.innerHTML = `
      <h4>编辑指令</h4>
      ${fieldsHtml}
      <div class="cmd-editor-actions">
        <button class="btn" onclick="App.closeEditor()">取消</button>
        <button class="btn btn--primary" onclick="App.saveEditor()">保存</button>
      </div>
    `;
    overlay.style.display = 'flex';

    // show current branch field group if applicable
    if (document.getElementById('editBrType')) this._onBrTypeChange();

    // focus first input
    setTimeout(() => {
      const first = editor.querySelector('input, textarea, select');
      if (first) first.focus();
    }, 50);
  },

  saveEditor() {
    if (!this.activeSceneId || !this.editingCmdId) return;
    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    const cmd = found.scene.commands.find(c => c.id === this.editingCmdId);
    if (!cmd) return;

    const newType = document.getElementById('editType')?.value;
    if (newType) cmd.type = newType;

    const p = cmd.params || {};
    switch(cmd.type) {
      case 'dialogue':
        p.speaker = document.getElementById('editSpeaker')?.value || '';
        p.text = document.getElementById('editText')?.value || '';
        break;
      case 'expression':
        p.target = document.getElementById('editTarget')?.value || '';
        p.expression = document.getElementById('editExpr')?.value || '';
        break;
      case 'move':
        p.target = document.getElementById('editTarget')?.value || '';
        p.route = document.getElementById('editRoute')?.value || '';
        break;
      case 'fadein': case 'fadeout': case 'wait':
        p.duration = document.getElementById('editDuration')?.value || '60帧';
        break;
      case 'bgm': case 'se':
        p.name = document.getElementById('editName')?.value || '';
        p.volume = document.getElementById('editVolume')?.value || '';
        break;
      case 'comment':
        p.text = document.getElementById('editText')?.value || '';
        break;
      case 'cg':
        p.file = document.getElementById('editCgFile')?.value || '';
        p.transition = document.getElementById('editCgTransition')?.value || '淡入';
        p.text = document.getElementById('editCgText')?.value || '';
        p.duration = document.getElementById('editCgDuration')?.value || '60帧';
        break;
      case 'branch':
        p.conditionType = document.getElementById('editBrType')?.value || 'switch';
        this._saveBranchFields(p);
        p.trueNote = document.getElementById('editBrTrue')?.value || '';
        p.falseNote = document.getElementById('editBrFalse')?.value || '';
        break;
    }
    cmd.params = p;

    this.closeEditor();
    this.save();
    this.renderCommandList();
  },

  closeEditor() {
    document.getElementById('cmdEditorOverlay').style.display = 'none';
    this.editingCmdId = null;
  },

  moveCommand(cmdId, delta) {
    if (!this.activeSceneId) return;
    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    const cmds = found.scene.commands;
    const idx = cmds.findIndex(c => c.id === cmdId);
    if (idx < 0) return;
    const newIdx = idx + delta;
    if (newIdx < 0 || newIdx >= cmds.length) return;
    [cmds[idx], cmds[newIdx]] = [cmds[newIdx], cmds[idx]];
    this.save();
    this.renderCommandList();
  },

  deleteCommand(cmdId) {
    if (!this.activeSceneId) return;
    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    found.scene.commands = found.scene.commands.filter(c => c.id !== cmdId);
    this.save();
    this.renderCommandList();
    this.toast('已删除指令');
  },

  // ---- cmd drag & drop ----
  onCmdDragStart(e) {
    const item = e.target.closest('.cmd-item');
    if (!item) return;
    const cmdId = item.dataset.cmdId;
    this.dragData = { type: 'cmd', cmdId };
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', cmdId);
    setTimeout(() => item.classList.add('dragging'), 0);
  },

  onCmdDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const item = e.target.closest('.cmd-item');
    if (!item || !this.dragData) return;
    const rect = item.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    item.classList.remove('drag-over-top', 'drag-over-bottom');
    item.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
  },

  onCmdDragEnter(e) {
    e.preventDefault();
  },

  onCmdDragLeave(e) {
    const item = e.target.closest('.cmd-item');
    if (item) {
      item.classList.remove('drag-over-top', 'drag-over-bottom');
    }
  },

  onCmdDrop(e) {
    e.preventDefault();
    if (!this.dragData || this.dragData.type !== 'cmd') return;
    if (!this.activeSceneId) return;
    const found = this.findScene(this.activeSceneId);
    if (!found) return;
    const cmds = found.scene.commands;

    const srcIdx = cmds.findIndex(c => c.id === this.dragData.cmdId);
    if (srcIdx < 0) return;

    const dropItem = e.target.closest('.cmd-item');
    if (!dropItem) return;
    const tId = dropItem.dataset.cmdId;
    let tIdx = cmds.findIndex(c => c.id === tId);
    if (tIdx < 0) return;

    const rect = dropItem.getBoundingClientRect();
    const mid = rect.top + rect.height / 2;
    const insertAfter = e.clientY >= mid;

    const [cmd] = cmds.splice(srcIdx, 1);
    // Recalculate target index after splice
    tIdx = cmds.findIndex(c => c.id === tId);
    cmds.splice(insertAfter ? tIdx + 1 : tIdx, 0, cmd);

    this._clearCmdDragVisuals();
    this.dragData = null;
    this.save();
    this.renderCommandList();
    this.toast('已重排指令');
  },

  onCmdDragEnd(e) {
    this._clearCmdDragVisuals();
    this.dragData = null;
  },

  _clearCmdDragVisuals() {
    document.querySelectorAll('.cmd-item.dragging, .cmd-item.drag-over-top, .cmd-item.drag-over-bottom').forEach(el => {
      el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom');
    });
  },

  // ---- project-level ----
  bindTitle() {
    const input = document.getElementById('projectTitle');
    input.value = this.project.title || '未命名项目';
    input.addEventListener('input', () => {
      this.project.title = input.value.trim() || '未命名项目';
      this.save();
    });
  },

  exportProject() {
    this.project.title = document.getElementById('projectTitle').value.trim() || '未命名项目';
    this.saveNow();
    const blob = new Blob([JSON.stringify(this.project, null, 2)], {type:'application/json'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.project.title||'storyplanner') + '.json';
    a.click();
    URL.revokeObjectURL(url);
    this.toast('已导出项目');
  },

  importProject() {
    document.getElementById('importFile').click();
  },

  handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = JSON.parse(ev.target.result);
        if (!data.chapters) throw new Error('无效的项目文件');
        this.project = data;
        this.activeSceneId = null;
        this.activeChapterId = null;
        this.saveNow();
        this.renderAll();
        document.getElementById('projectTitle').value = this.project.title || '';
        this.toast('已导入项目');
      } catch(err) {
        this.toast('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  },

  exportOutline() {
    this.project.title = document.getElementById('projectTitle').value.trim() || '未命名项目';
    let text = `═══════════════════════════════\n`;
    text += `  ${this.project.title}\n`;
    text += `  剧情大纲\n`;
    text += `═══════════════════════════════\n\n`;

    for (const ch of this.project.chapters) {
      text += `▌${ch.name}\n\n`;
      for (const sc of ch.scenes) {
        text += `  ▸ ${sc.name}\n`;
        const meta = sc.meta || {};
        if (meta.map) text += `    地图：${meta.map}\n`;
        if (meta.bgm) text += `    BGM：${meta.bgm}\n`;
        if (meta.characters && meta.characters.length) text += `    角色：[${meta.characters.join(', ')}]\n`;
        if (meta.tags && meta.tags.length) text += `    标签：[${meta.tags.join(', ')}]\n`;
        if (meta.note) text += `    备注：${meta.note}\n`;
        if (sc.commands.length > 0) {
          text += `    演出：\n`;
          for (const cmd of sc.commands) {
            text += `      ◆ ${this.formatCmdText(cmd)}\n`;
          }
        }
        text += `\n`;
      }
    }

    const blob = new Blob([text], {type:'text/plain;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = (this.project.title||'storyplanner') + '_大纲.txt';
    a.click();
    URL.revokeObjectURL(url);
    this.toast('已导出大纲文本');
  },

  formatCmdText(cmd) {
    const p = cmd.params || {};
    switch(cmd.type) {
      case 'dialogue':   return `${p.speaker||'???'}：「${p.text||''}」`;
      case 'expression': return `${p.target||''} 表情 → ${p.expression||''}`;
      case 'move':       return `${p.target||''} 移动：${p.route||''}`;
      case 'fadein':     return `淡入画面 (${p.duration||'60帧'})`;
      case 'fadeout':    return `淡出画面 (${p.duration||'60帧'})`;
      case 'wait':       return `等待 ${p.duration||'60帧'}`;
      case 'bgm':        return `BGM：${p.name||''}`;
      case 'se':         return `SE：${p.name||''}`;
      case 'comment':    return `// ${p.text||''}`;
      case 'cg':         return `CG：${p.file||''} ${p.transition||''}${p.text ? '「'+p.text+'」':''} (${p.duration||'60帧'})`;
      case 'branch':     return `${this._branchSummary(p)}`;      
      default:           return JSON.stringify(p);
    }
  },

  // ---- branch helpers ----
  _branchSummary(p) {
    const t = p.conditionType || 'custom';
    switch(t) {
      case 'switch':   return `开关 ${p.switchId||'???'} 为 ${p.switchState||'ON'}`;
      case 'variable': return `变量 ${p.variableId||'???'} ${p.compareOp||'=='} ${p.compareValue||'0'}`;
      case 'affection':return `${p.actorId||'???'} 好感度 ${p.compareOp||'>='} ${p.compareValue||'0'}`;
      case 'item':     return `持有 ${p.itemId||'???'} ×${p.itemCount||'1'}`;
      case 'random':   return `随机 (${p.probability||'50%'})`;
      default:         return p.customCondition || p.condition || '';
    }
  },

  _branchContentHtml(p) {
    const summary = this._branchSummary(p);
    let html = `<span class="branch-summary">如果 ${this.esc(summary)}</span>`;
    if (p.trueNote)  html += `<div class="branch-true">✔ 成立时：${this.esc(p.trueNote)}</div>`;
    if (p.falseNote) html += `<div class="branch-false">✘ 不成立时：${this.esc(p.falseNote)}</div>`;
    if (!p.trueNote && !p.falseNote) html += `<span class="branch-hint">点击编辑分支说明</span>`;
    return html;
  },

  _branchEditFields(p) {
    const t = p.conditionType || 'switch';
    // Hide all fields initially via JS event; render all for current type
    let html = '';
    html += `<div class="br-field-group" data-br-type="switch">
      <label>开关 ID</label><input id="editBrSwitchId" value="${this.escAttr(p.switchId||'')}" placeholder="例：0001">
      <label>状态</label><select id="editBrSwitchState"><option value="ON" ${(p.switchState||'ON')==='ON'?'selected':''}>ON</option><option value="OFF" ${p.switchState==='OFF'?'selected':''}>OFF</option></select>
    </div>`;
    html += `<div class="br-field-group" data-br-type="variable">
      <label>变量 ID</label><input id="editBrVarId" value="${this.escAttr(p.variableId||'')}" placeholder="例：0001">
      <label>比较</label><select id="editBrVarOp"><option value="==" ${(p.compareOp||'==')==='=='?'selected':''}>==</option><option value="!=" ${p.compareOp==='!='?'selected':''}>!=</option><option value=">" ${p.compareOp==='>'?'selected':''}>&gt;</option><option value="<" ${p.compareOp==='<'?'selected':''}>&lt;</option><option value=">=" ${p.compareOp==='>='?'selected':''}>&gt;=</option><option value="<=" ${p.compareOp==='<='?'selected':''}>&lt;=</option></select>
      <label>值</label><input id="editBrVarVal" value="${this.escAttr(p.compareValue||'0')}">
    </div>`;
    html += `<div class="br-field-group" data-br-type="affection">
      <label>角色</label><input id="editBrActId" value="${this.escAttr(p.actorId||'')}" placeholder="例：王子">
      <label>比较</label><select id="editBrAffOp"><option value=">=" ${(p.compareOp||'>=')==='>='?'selected':''}>&gt;=</option><option value="<=" ${p.compareOp==='<='?'selected':''}>&lt;=</option><option value="==" ${p.compareOp==='=='?'selected':''}>==</option></select>
      <label>值</label><input id="editBrAffVal" value="${this.escAttr(p.compareValue||'0')}">
    </div>`;
    html += `<div class="br-field-group" data-br-type="item">
      <label>物品名称</label><input id="editBrItemId" value="${this.escAttr(p.itemId||'')}" placeholder="例：秘银剑">
      <label>数量</label><input id="editBrItemCnt" value="${this.escAttr(p.itemCount||'1')}">
    </div>`;
    html += `<div class="br-field-group" data-br-type="random">
      <label>概率</label><input id="editBrProb" value="${this.escAttr(p.probability||'50%')}" placeholder="例：50%">
    </div>`;
    html += `<div class="br-field-group" data-br-type="custom">
      <label>自定义条件</label><input id="editBrCustom" value="${this.escAttr(p.customCondition||p.condition||'')}" placeholder="例：开关 #0001 为 ON">
    </div>`;
    return html;
  },

  _saveBranchFields(p) {
    p.switchId = document.getElementById('editBrSwitchId')?.value || '';
    p.switchState = document.getElementById('editBrSwitchState')?.value || 'ON';
    p.variableId = document.getElementById('editBrVarId')?.value || '';
    p.compareOp = document.getElementById('editBrVarOp')?.value || '==';
    p.compareValue = document.getElementById('editBrVarVal')?.value || '0';
    p.actorId = document.getElementById('editBrActId')?.value || '';
    p.itemId = document.getElementById('editBrItemId')?.value || '';
    p.itemCount = document.getElementById('editBrItemCnt')?.value || '1';
    p.probability = document.getElementById('editBrProb')?.value || '50%';
    p.customCondition = document.getElementById('editBrCustom')?.value || '';
  },

  _onBrTypeChange() {
    const type = document.getElementById('editBrType')?.value || 'switch';
    document.querySelectorAll('.br-field-group').forEach(g => {
      g.style.display = g.dataset.brType === type ? '' : 'none';
    });
  },

  resetAll() {
    if (!confirm('确定要清空所有数据吗？此操作不可恢复！\n\n建议先导出备份。')) return;
    this.project = JSON.parse(JSON.stringify(DEFAULT_PROJECT));
    this.activeSceneId = null;
    this.activeChapterId = null;
    this.saveNow();
    this.renderAll();
    document.getElementById('projectTitle').value = this.project.title;
    this.toast('已重置为初始数据');
  },

  // ---- keyboard shortcuts ----
  onKeydown(e) {
    if (document.getElementById('cmdEditorOverlay').style.display === 'flex') {
      if (e.key === 'Escape') { this.closeEditor(); e.preventDefault(); }
      if (e.key === 'Enter' && e.ctrlKey) { this.saveEditor(); e.preventDefault(); }
      return;
    }
    // Don't capture when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    if (e.key === 'n' && e.ctrlKey) { e.preventDefault(); this.addScene(this.activeChapterId); }
    if (e.key === 's' && e.ctrlKey) { e.preventDefault(); this.saveNow(); this.toast('已保存'); }
  },

  // ---- utilities ----
  esc(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },
  escAttr(s) {
    if (!s) return '';
    return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  },
  toast(msg) {
    const el = document.getElementById('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => el.classList.remove('show'), 1800);
  },
};

// ==================== BOOT ====================
document.addEventListener('DOMContentLoaded', () => App.init());
