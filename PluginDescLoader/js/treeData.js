// ─── Tree Data Builder ─────────────────────────────────────────────────────
// Builds a hierarchical tree structure from parser items and blocks.
// This is shared by both the left navigation tree and the right editor panel.

function buildTreeData(items, blocks) {
  const tree = {
    infoItems: [],    // @plugindesc, @author
    helpItems: [],    // @help
    paramNodes: [],   // tree nodes for @param
    commandNodes: [], // tree nodes for @command
    structNodes: [],  // tree nodes for struct blocks
    orphanItems: [],  // items without tagKey
  };

  // 1. Categorize top-level items
  const infoItems = items.filter(i => i.type === 'plugindesc' || i.type === 'author');
  const helpItems = items.filter(i => i.type === 'help');
  const pluginItems = items.filter(i => blocks[i.blockIndex].type !== 'struct');
  const structItems = items.filter(i => blocks[i.blockIndex].type === 'struct');

  tree.infoItems = infoItems.sort(compareItemPosition);
  tree.helpItems = helpItems;

  // 2. Build param/command/arg nodes
  const nodes = {};  // tagKey → TreeNode
  const orphans = [];

  pluginItems.forEach(item => {
    const key = item.tagKey;
    if (!key) {
      if (item.type === 'help' || item.type === 'plugindesc' || item.type === 'author') return;
      orphans.push(item);
      return;
    }

    if (!nodes[key]) {
      let nodeType = 'param';
      let label = key;
      if (item.context.startsWith('command:')) { nodeType = 'command'; label = `⚡ ${key}`; }
      else if (item.context.startsWith('arg:')) { nodeType = 'arg'; label = `  ${key}`; }

      nodes[key] = {
        tagKey: key,
        label: label,
        type: nodeType,
        parentKey: item.parentKey || '',
        items: [],
        children: [],
        structRef: '',
      };
    }
    nodes[key].items.push(item);
    if (item.structRef) {
      nodes[key].structRef = item.structRef;
    }
  });

  // Track which struct blocks are linked to params
  const linkedStructKeys = new Set();

  // 3. Build tree: attach children to parents
  const nodeValues = Object.values(nodes);
  const paramRoots = [];
  const cmdRoots = [];

  // Sort nodes by source position for sequence-based relationship detection
  const sortedNodes = [...nodeValues].sort((a, b) => compareItemPosition(a.items[0], b.items[0]));

  let lastCmd = null;
  sortedNodes.forEach(node => {
    // Check for explicit parentKey relationship first
    if (node.parentKey && nodes[node.parentKey]) {
      nodes[node.parentKey].children.push(node);
      return;
    }

    // Attach @arg nodes to preceding @command if available
    if (node.type === 'arg') {
      if (lastCmd) {
        lastCmd.children.push(node);
        return;
      }
      node.items.forEach(it => orphans.push(it));
      return;
    }

    // Track command nodes
    if (node.type === 'command') {
      lastCmd = node;
      cmdRoots.push(node);
      return;
    }

    // All other root-level nodes
    paramRoots.push(node);
  });

  // 4. Link struct blocks to referencing params
  nodeValues.forEach(node => {
    if (!node.structRef) return;

    const structBlock = blocks.find(b =>
      b.type === 'struct' && b.name === node.structRef
    );
    if (!structBlock) return;

    linkedStructKeys.add(structBlock.name);

    const structFieldNodes = {};
    structBlock.items.forEach(item => {
      const key = item.tagKey;
      if (!key) return;
      if (!structFieldNodes[key]) {
        structFieldNodes[key] = {
          tagKey: key,
          label: key,
          type: 'struct-field',
          parentKey: '',
          items: [],
          children: [],
        };
      }
      structFieldNodes[key].items.push(item);
    });

    const structChildren = Object.values(structFieldNodes);
    structChildren.sort((a, b) => compareItemPosition(a.items[0], b.items[0]));
    node.children.push(...structChildren);
  });

  // 5. Orphan struct blocks (not referenced by any param)
  const allStructBlocks = blocks.filter(b => b.type === 'struct');
  const seenStructNames = new Set();

  allStructBlocks.forEach(block => {
    if (linkedStructKeys.has(block.name) || seenStructNames.has(block.name)) return;
    seenStructNames.add(block.name);

    const structItems2 = block.items;
    if (structItems2.length === 0) return;

    const childNodes = {};
    structItems2.forEach(item => {
      const tk = item.tagKey;
      if (!tk) return;
      if (!childNodes[tk]) {
        childNodes[tk] = {
          tagKey: tk,
          label: tk,
          type: 'struct-field',
          parentKey: '',
          items: [],
          children: [],
        };
      }
      childNodes[tk].items.push(item);
    });

    const children = Object.values(childNodes);
    children.sort((a, b) => compareItemPosition(a.items[0], b.items[0]));

    tree.structNodes.push({
      tagKey: `__struct__${block.name}`,
      label: `📦 ${block.name}`,
      type: 'struct',
      parentKey: '',
      items: [],
      children: children,
      structName: block.name,
    });
  });

  // Sort roots
  paramRoots.sort((a, b) => compareItemPosition(a.items[0], b.items[0]));
  cmdRoots.sort((a, b) => compareItemPosition(a.items[0], b.items[0]));

  tree.paramNodes = paramRoots;
  tree.commandNodes = cmdRoots;
  tree.orphanItems = orphans;

  return tree;
}

/** Check if a tree node has any visible children (recursive). */
function hasVisibleChildren(node) {
  return (node.children || []).some(child => {
    return child.items.length > 0 || hasVisibleChildren(child);
  });
}
