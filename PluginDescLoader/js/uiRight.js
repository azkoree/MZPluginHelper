// ─── Right Panel — 对照翻译编辑器 ──────────────────────────────────────────

const RightPanel = {
  /** Render the right panel editor. Optionally scroll to a specific tagKey after render. */
  render(scrollToTagKey) {
    const body = document.getElementById('panelRightBody');
    if (!body) return;

    if (App.items.length === 0) {
      body.innerHTML = '<div class="editor-empty">请先加载插件文件</div>';
      return;
    }

    const langItems = App.filterItemsByLanguage(App.items);
    const tree = buildTreeData(langItems, App.blocks);
    const search = App.currentSearch.toLowerCase();
    const isRefMode = App.isReferenceMode();

    const matchSearch = (item) => {
      if (!search) return true;
      const orig = item.original.toLowerCase();
      const trans = (App.translations.get(item.id) || '').toLowerCase();
      return orig.includes(search) || trans.includes(search);
    };

    let html = '';

    // ── Reference mode banner ──
    if (isRefMode) {
      html += `<div class="ref-banner">
        <span class="ref-banner-icon">📖</span>
        <span class="ref-banner-text">
          参考模式 — 正在查看 <strong>${getLangLabel(App.selectedLang)}</strong>。切换回
          <strong>${getLangLabel(App.mainLang)}</strong> 进行编辑。
        </span>
        <button class="ref-banner-btn" onclick="App.selectLanguage('${escapeHtml(App.mainLang)}')">
          切换到编辑模式
        </button>
      </div>`;
    }

    // ── Info Section ──
    if (tree.infoItems.length > 0) {
      const visible = tree.infoItems.filter(i => matchSearch(i));
      if (visible.length > 0) {
        html += RightPanel._renderSection('editor-info', '插件信息', () => {
          return visible.map(item => RightPanel._renderItemRow(item)).join('');
        });
      }
    }

    // ── Help Section ──
    if (tree.helpItems.length > 0) {
      const visible = tree.helpItems.filter(i => matchSearch(i));
      if (visible.length > 0) {
        html += RightPanel._renderSection('editor-help', '帮助文本 (@help)', () => {
          return visible.map(item => RightPanel._renderItemRow(item)).join('');
        });
      }
    }

    // ── Param Nodes Section ──
    if (tree.paramNodes.length > 0) {
      html += RightPanel._renderSection('editor-params', '插件参数', () => {
        return tree.paramNodes.map(node =>
          RightPanel._renderParamEditor(node, 0, matchSearch, scrollToTagKey)
        ).join('');
      });
    }

    // ── Command Nodes Section ──
    if (tree.commandNodes.length > 0) {
      html += RightPanel._renderSection('editor-commands', '插件命令', () => {
        return tree.commandNodes.map(node =>
          RightPanel._renderParamEditor(node, 0, matchSearch, scrollToTagKey)
        ).join('');
      });
    }

    // ── Struct Nodes Section ──
    if (tree.structNodes.length > 0) {
      html += RightPanel._renderSection('editor-structs', '结构体', () => {
        return tree.structNodes.map(node =>
          RightPanel._renderParamEditor(node, 0, matchSearch, scrollToTagKey)
        ).join('');
      });
    }

    // ── Orphans ──
    if (tree.orphanItems.length > 0) {
      const visible = tree.orphanItems.filter(i => matchSearch(i));
      if (visible.length > 0) {
        html += RightPanel._renderSection('editor-orphans', '其他', () => {
          return visible.map(item => RightPanel._renderItemRow(item)).join('');
        });
      }
    }

    body.innerHTML = html || '<div class="editor-empty">没有匹配的项目</div>';

    if (scrollToTagKey) {
      setTimeout(() => {
        const target = body.querySelector(`[data-editor-key="${escapeHtml(scrollToTagKey)}"]`);
        if (target) {
          target.scrollIntoView({ behavior: 'smooth', block: 'start' });
          target.classList.add('editor-highlight');
          setTimeout(() => target.classList.remove('editor-highlight'), 1500);
        }
      }, 50);
    }
  },

  _renderSection(id, title, contentFn) {
    const isExpanded = App.isSectionExpanded(id);
    return `<div class="editor-section">
      <div class="editor-section-header" onclick="App.toggleSectionExpanded('${id}'); RightPanel._toggleSection(this);">
        <span class="editor-arrow">${isExpanded ? '▼' : '▶'}</span>
        <span class="editor-section-title">${escapeHtml(title)}</span>
      </div>
      <div class="editor-section-body" style="display:${isExpanded ? '' : 'none'}">
        ${contentFn()}
      </div>
    </div>`;
  },

  _toggleSection(headerEl) {
    const body = headerEl.nextElementSibling;
    if (body) body.style.display = body.style.display === 'none' ? '' : 'none';
    const arrow = headerEl.querySelector('.editor-arrow');
    if (arrow) arrow.textContent = arrow.textContent === '▶' ? '▼' : '▶';
  },

  _renderParamEditor(node, depth, matchSearch, highlightKey) {
    const depthClass = `editor-depth-${Math.min(depth, 4)}`;
    const hasChildren = node.children.length > 0;
    const hasItems = node.items.length > 0;
    const hasExpandable = hasChildren || hasItems;
    const isHighlight = node.tagKey === highlightKey;

    if (!hasItems && !hasChildren) return '';

    const visibleItems = node.items.filter(i => matchSearch(i));
    if (visibleItems.length === 0 && !hasChildren) return '';

    const parentInfo = node.parentKey ? `← ${escapeHtml(node.parentKey)}` : '';
    const isExpanded = App.isExpanded(node.tagKey);

    const allItems = collectAllItems(node);
    const translated = countTranslated(App.translations, allItems);

    let html = `<div class="editor-param ${depthClass}${isHighlight ? ' editor-highlight' : ''}"
                    data-editor-key="${escapeHtml(node.tagKey)}">`;

    html += `<div class="editor-param-header"
                data-tag-key="${escapeHtml(node.tagKey)}"
                data-has-children="${hasChildren}"
                data-has-items="${hasItems}"
                onclick="RightPanel._onParamHeaderClick(this)">`;
    html += `<span class="editor-param-arrow">${isExpanded || !hasExpandable ? '▼' : '▶'}</span>`;
    html += `<span class="editor-param-name">${escapeHtml(node.label)}</span>`;
    if (node.type === 'command') html += `<span class="editor-param-badge cmd-badge">命令</span>`;
    if (node.type === 'struct') html += `<span class="editor-param-badge struct-badge">struct</span>`;
    if (node.type === 'struct-field') html += `<span class="editor-param-badge field-badge">字段</span>`;
    if (parentInfo) html += `<span class="editor-param-parent">${parentInfo}</span>`;
    if (node.structRef) html += `<span class="editor-param-struct-ref">→ struct&lt;${escapeHtml(node.structRef)}&gt;</span>`;
    html += `<span class="editor-param-count">${translated}/${allItems.length}</span>`;
    html += `</div>`;

    if (hasExpandable) {
      html += `<div class="editor-param-body" style="display:${isExpanded ? '' : 'none'}">`;
      visibleItems.forEach(item => {
        html += RightPanel._renderItemRow(item);
      });
      if (hasChildren) {
        node.children.forEach(child => {
          html += RightPanel._renderParamEditor(child, depth + 1, matchSearch, highlightKey);
        });
      }
      html += `</div>`;
    }

    html += `</div>`;
    return html;
  },

  _onParamHeaderClick(el) {
    const tagKey = el.getAttribute('data-tag-key');
    const hasChildren = el.getAttribute('data-has-children') === 'true';
    const hasItems = el.getAttribute('data-has-items') === 'true';
    if (hasChildren || hasItems) {
      App.toggleExpanded(tagKey);
    }
    const body = el.nextElementSibling;
    if (body && body.classList.contains('editor-param-body')) {
      body.style.display = body.style.display === 'none' ? '' : 'none';
    }
    const arrow = el.querySelector('.editor-param-arrow');
    if (arrow) arrow.textContent = arrow.textContent === '▶' ? '▼' : '▶';
  },

  /** Render a single translatable item row. Supports read-only reference mode. */
  _renderItemRow(item) {
    const isRefMode = App.isReferenceMode();
    const trans = App.translations.get(item.id) || '';
    const isTranslated = trans.trim() !== '';
    const transClass = isTranslated ? ' translated' : '';

    // Reference text: show main language version for comparison
    let refHtml = '';
    const mainText = App.getMainLangText(item);
    if (mainText && mainText !== item.original) {
      refHtml = `<div class="editor-ref">📖 ${escapeHtml(mainText)}</div>`;
    }

    const rowCount = Math.min(Math.max((item.original || '').split('\n').length, 1), 8);

    // ── Synthetic value (always read-only) ──
    if (item.isSynthetic && item.type === 'value') {
      return `<div class="editor-row${transClass}" data-item-id="${item.id}">
        <div class="editor-source">
          <span class="editor-badge ${getBadgeClass(item)}">${escapeHtml(item.groupLabel)}</span>
          <div class="editor-source-text">${escapeHtml(item.original)}</div>
        </div>
        <div class="editor-target">
          <span class="editor-syn-text">${escapeHtml(item.original)}</span>
        </div>
      </div>`;
    }

    // If in reference mode, show a read-only row with the main language text
    if (isRefMode) {
      return `<div class="editor-row ref-row" data-item-id="${item.id}">
        <div class="editor-source">
          <span class="editor-badge ${getBadgeClass(item)}">${escapeHtml(item.groupLabel)}</span>
          <div class="editor-source-text">${escapeHtml(item.original)}</div>
        </div>
        <div class="editor-target">
          <div class="editor-ref-text">${mainText ? escapeHtml(mainText) : '<span class="ref-empty">（无对应项）</span>'}</div>
        </div>
      </div>`;
    }

    // ── Synthetic text (editable, pre-filled placeholder) ──
    if (item.isSynthetic && !trans.trim()) {
      return `<div class="editor-row${transClass}" data-item-id="${item.id}">
        <div class="editor-source">
          <span class="editor-badge ${getBadgeClass(item)}">${escapeHtml(item.groupLabel)}</span>
          <div class="editor-source-text">${escapeHtml(item.original)}</div>
        </div>
        <div class="editor-target">
          <textarea class="editor-textarea synth-textarea" rows="${rowCount}"
            data-item-id="${item.id}"
            placeholder="留空则使用«​​»作为默认值"
            oninput="App.onTranslationChange(this)">${escapeHtml(trans)}</textarea>
        </div>
      </div>`;
    }

    // ── Normal editable row ──
    return `<div class="editor-row${transClass}" data-item-id="${item.id}">
      <div class="editor-source">
        <span class="editor-badge ${getBadgeClass(item)}">${escapeHtml(item.groupLabel)}</span>
        <div class="editor-source-text">${escapeHtml(item.original)}</div>
        ${refHtml}
      </div>
      <div class="editor-target">
        <textarea class="editor-textarea" rows="${rowCount}"
          data-item-id="${item.id}"
          placeholder="${item.isSynthetic ? '输入翻译…' : '在此输入翻译…'}"
          oninput="App.onTranslationChange(this)">${escapeHtml(trans)}</textarea>
      </div>
    </div>`;
  },
};
