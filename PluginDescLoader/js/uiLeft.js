// ─── Left Panel — 参数导航树 ──────────────────────────────────────────────

const LeftPanel = {
  /** Render the navigation tree in the left panel. */
  render() {
    const body = document.getElementById('panelLeftBody');
    if (!body) return;

    if (App.items.length === 0) {
      body.innerHTML = '<div class="tree-empty">请先加载插件文件</div>';
      return;
    }

    const langItems = App.filterItemsByLanguage(App.items);
    const tree = buildTreeData(langItems, App.blocks);
    let html = '';

    // ── Info section ──
    if (tree.infoItems.length > 0) {
      html += `<div class="tree-section">`;
      html += `<div class="tree-section-header" onclick="LeftPanel.toggleSection(this)">
        <span class="tree-arrow">▼</span>
        <span class="tree-section-title">插件信息</span>
        <span class="tree-section-count">${tree.infoItems.length}</span>
      </div>`;
      html += `<div class="tree-section-body">`;
      tree.infoItems.forEach(item => {
        html += LeftPanel._renderLeaf(item);
      });
      html += `</div></div>`;
    }

    // ── Help section ──
    if (tree.helpItems.length > 0) {
      html += `<div class="tree-section">`;
      html += `<div class="tree-section-header" onclick="LeftPanel.toggleSection(this)">
        <span class="tree-arrow">▼</span>
        <span class="tree-section-title">帮助文本 (@help)</span>
        <span class="tree-section-count">${tree.helpItems.length}</span>
      </div>`;
      html += `<div class="tree-section-body">`;
      tree.helpItems.forEach(item => {
        html += LeftPanel._renderLeaf(item);
      });
      html += `</div></div>`;
    }

    // ── Params section ──
    if (tree.paramNodes.length > 0) {
      html += `<div class="tree-section">`;
      html += `<div class="tree-section-header" onclick="LeftPanel.toggleSection(this)">
        <span class="tree-arrow">▼</span>
        <span class="tree-section-title">插件参数</span>
        <span class="tree-section-count">${tree.paramNodes.length}</span>
      </div>`;
      html += `<div class="tree-section-body">`;
      tree.paramNodes.forEach(node => {
        html += LeftPanel._renderTreeNode(node, 0);
      });
      html += `</div></div>`;
    }

    // ── Commands section ──
    if (tree.commandNodes.length > 0) {
      html += `<div class="tree-section">`;
      html += `<div class="tree-section-header" onclick="LeftPanel.toggleSection(this)">
        <span class="tree-arrow">▼</span>
        <span class="tree-section-title">插件命令</span>
        <span class="tree-section-count">${tree.commandNodes.length}</span>
      </div>`;
      html += `<div class="tree-section-body">`;
      tree.commandNodes.forEach(node => {
        html += LeftPanel._renderTreeNode(node, 0);
      });
      html += `</div></div>`;
    }

    // ── Structs section ──
    if (tree.structNodes.length > 0) {
      html += `<div class="tree-section">`;
      html += `<div class="tree-section-header" onclick="LeftPanel.toggleSection(this)">
        <span class="tree-arrow">▼</span>
        <span class="tree-section-title">结构体</span>
        <span class="tree-section-count">${tree.structNodes.length}</span>
      </div>`;
      html += `<div class="tree-section-body">`;
      tree.structNodes.forEach(node => {
        html += LeftPanel._renderTreeNode(node, 0);
      });
      html += `</div></div>`;
    }

    // ── Orphans ──
    if (tree.orphanItems.length > 0) {
      html += `<div class="tree-section">`;
      html += `<div class="tree-section-header" onclick="LeftPanel.toggleSection(this)">
        <span class="tree-arrow">▼</span>
        <span class="tree-section-title">其他</span>
        <span class="tree-section-count">${tree.orphanItems.length}</span>
      </div>`;
      html += `<div class="tree-section-body">`;
      tree.orphanItems.forEach(item => {
        html += LeftPanel._renderLeaf(item);
      });
      html += `</div></div>`;
    }

    body.innerHTML = html || '<div class="tree-empty">没有可显示的参数</div>';
  },

  /** Render a tree node (param/command/struct with optional children). */
  _renderTreeNode(node, depth) {
    if (!node.items.length && !node.children.length) return '';
    const depthClass = `tree-depth-${Math.min(depth, 4)}`;
    const hasChildren = node.children.length > 0;
    const hasItems = node.items.length > 0;
    const hasExpandable = hasChildren || hasItems;
    const isExpanded = App.isExpanded(node.tagKey);
    const arrow = hasExpandable ? (isExpanded ? '▼' : '▶') : '';

    const parentInfo = node.parentKey ? ` ← ${escapeHtml(node.parentKey)}` : '';

    let html = `<div class="tree-node ${depthClass}">`;
    html += `<div class="tree-node-header"
                data-tag-key="${escapeHtml(node.tagKey)}"
                data-has-children="${hasChildren}"
                data-has-items="${hasItems}"
                onclick="LeftPanel._onNodeClick(this)"
                ondblclick="LeftPanel._onNodeDblClick(this)">`;
    html += `<span class="tree-node-arrow">${arrow}</span>`;
    html += `<span class="tree-node-label">${escapeHtml(node.label)}</span>`;
    if (node.type === 'command') html += `<span class="tree-node-badge cmd-badge">命令</span>`;
    if (node.type === 'struct') html += `<span class="tree-node-badge struct-badge">struct</span>`;
    if (node.type === 'struct-field') html += `<span class="tree-node-badge field-badge">字段</span>`;
    if (node.type === 'arg') html += `<span class="tree-node-badge arg-badge">arg</span>`;
    if (parentInfo) html += `<span class="tree-node-parent">${parentInfo}</span>`;
    if (node.structRef) html += `<span class="tree-node-struct-ref">→ struct&lt;${escapeHtml(node.structRef)}&gt;</span>`;

    const allItems = collectAllItems(node);
    const translated = countTranslated(App.translations, allItems);
    if (allItems.length > 0) {
      html += `<span class="tree-node-count">${translated}/${allItems.length}</span>`;
    }
    html += `</div>`;

    if (hasChildren && isExpanded) {
      html += `<div class="tree-node-children">`;
      node.children.forEach(child => {
        html += LeftPanel._renderTreeNode(child, depth + 1);
      });
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  /** Render a leaf item (single translatable item without children). */
  _renderLeaf(item) {
    const isTranslated = (App.translations.get(item.id) || '').trim() !== '';
    const badgeClass = getBadgeClass(item);
    const statusClass = isTranslated ? ' leaf-translated' : '';
    const label = item.type === 'help' ? '帮助文本' : item.groupLabel;

    return `<div class="tree-leaf${statusClass}" data-item-id="${escapeHtml(item.id)}"
                onclick="LeftPanel._onLeafClick(this)"
                title="${escapeHtml(item.original)}">
      <span class="tree-leaf-badge ${badgeClass}">${escapeHtml(label)}</span>
      <span class="tree-leaf-text">${escapeHtml(item.original.substring(0, 40))}</span>
    </div>`;
  },

  // ─── Event Handlers ────────────────────────────────────────────────────

  toggleSection(headerEl) {
    headerEl.classList.toggle('collapsed');
    const body = headerEl.nextElementSibling;
    if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
    const arrow = headerEl.querySelector('.tree-arrow');
    if (arrow) arrow.textContent = arrow.textContent === '▶' ? '▼' : '▶';
  },

  _onNodeClick(el) {
    const tagKey = el.getAttribute('data-tag-key');
    const hasChildren = el.getAttribute('data-has-children') === 'true';
    const hasItems = el.getAttribute('data-has-items') === 'true';
    if (hasChildren || hasItems) {
      App.toggleExpanded(tagKey);
      LeftPanel.render();
    }
    RightPanel.render(tagKey);
  },

  _onNodeDblClick(el) {
    const tagKey = el.getAttribute('data-tag-key');
    RightPanel.render(tagKey);
  },

  _onLeafClick(el) {
    const itemId = el.getAttribute('data-item-id');
    const item = App.items.find(i => i.id === itemId);
    if (item && item.tagKey) {
      RightPanel.render(item.tagKey);
    }
  },
};
