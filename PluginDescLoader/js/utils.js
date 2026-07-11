// ─── Utility Functions ─────────────────────────────────────────────────────

/** Escape HTML special characters. */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/** Compare two items by their position in the source (block then line). */
function compareItemPosition(a, b) {
  if (!a || !b) return 0;
  const biA = a.blockIndex, biB = b.blockIndex;
  const posA = a.isMultiLine ? a.lineRange[0] : a.lineIndex;
  const posB = b.isMultiLine ? b.lineRange[0] : b.lineIndex;
  if (biA !== biB) return biA - biB;
  return posA - posB;
}

/** Get label for a language code. */
function getLangLabel(lang) {
  if (!lang) return '默认';
  const map = { ja: '日本語', en: 'English', zh: '中文', 'zh-CN': '中文', 'zh-TW': '繁體' };
  return map[lang] || lang;
}

/** Get the CSS class for an item badge. */
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

/** Count translated items in a list. */
function countTranslated(translations, items) {
  return items.filter(i => (translations.get(i.id) || '').trim()).length;
}

/** Collect all items from a tree node recursively. */
function collectAllItems(node) {
  let items = [...node.items];
  (node.children || []).forEach(child => {
    items = items.concat(collectAllItems(child));
  });
  return items;
}
