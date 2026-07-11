/**
 * RMMZ Plugin Comment Parser — PluginDescLoader
 *
 * Extracts translatable text from RPG Maker MZ plugin comment blocks.
 * Supports @text synthesis, @parent tracking, multi-language struct blocks,
 * and safe export that only touches comment regions.
 *
 * Usage:
 *   const parser = new RMMZParser();
 *   const { blocks, items } = parser.parse(pluginCode);
 *   // ... user translates items ...
 *   const exported = parser.exportBlocks(filteredBlocks, translations);
 */

// ─── Data Classes ───────────────────────────────────────────────────────────

class RMMZCommentBlock {
  constructor({ type, name, lang, raw, inner, start, end }) {
    this.type = type;          // 'plugin' | 'struct'
    this.name = name || '';    // struct type name, '' for plugin
    this.lang = lang || '';    // language code: 'zh', 'ja', '' (default)
    this.raw = raw;            // original block text
    this.inner = inner;        // content between /*: and */
    this.start = start;        // position in source
    this.end = end;
    this.items = [];           // TranslatableItem[]
  }
}

class TranslatableItem {
  constructor({
    id, type, original, context, blockIndex,
    isMultiLine, lineIndex, lineRange,
    prefix, prefixLines,
    isSynthetic, insertAfterLine,
    parentKey,  // @parent value, if any
    tagKey,     // the @param/@arg/@command value this item belongs to
  }) {
    this.id = id;
    this.type = type;          // help | plugindesc | author | text | desc
                               // | option | value | on | off | default
    this.original = original;
    this.translation = '';
    this.context = context || '';     // 'param: XXX' | 'command: XXX' | 'arg: XXX'
    this.blockIndex = blockIndex;
    this.isMultiLine = isMultiLine || false;
    this.lineIndex = lineIndex;       // single-line items
    this.lineRange = lineRange;       // [start, end] for multi-line items
    this.prefix = prefix;             // e.g. ' * @text '
    this.prefixLines = prefixLines || [];
    this.isSynthetic = isSynthetic || false;
    this.insertAfterLine = insertAfterLine !== undefined ? insertAfterLine : -1;
    this.parentKey = parentKey || ''; // @parent value
    this.tagKey = tagKey || '';       // the param/arg/command name
    this.structRef = '';              // struct type name if @type struct<Name>
  }

  get groupLabel() {
    if (this.isSynthetic && this.type === 'value') return '追加 @value';
    if (this.isSynthetic) return '追加 @text';
    const labels = {
      help: '帮助文本 (@help)',
      plugindesc: '插件描述 (@plugindesc)',
      author: '作者 (@author)',
      text: '显示名 (@text)',
      desc: '描述 (@desc)',
      option: '选项 (@option)',
      value: '选项值 (@value)',
      default: '默认值 (@default)',
      on: '开启文字 (@on)',
      off: '关闭文字 (@off)',
    };
    return labels[this.type] || this.type;
  }
}

// ─── Parser ─────────────────────────────────────────────────────────────────

class RMMZParser {
  /**
   * Parse RMMZ plugin source code.
   * @param {string} code - Full plugin .js source
   * @returns {{ blocks: RMMZCommentBlock[], items: TranslatableItem[] }}
   */
  parse(code) {
    // Normalize line endings
    code = code.replace(/\r\n?/g, '\n');

    const blocks = this._findBlocks(code);
    const items = [];
    blocks.forEach((block, bi) => {
      block.items = this._parseBlock(block, bi, code);
      items.push(...block.items);
    });
    return { blocks, items };
  }

  // ─── Block Detection ──────────────────────────────────────────────────

  /**
   * Find all comment blocks in the source code.
   * Supports:
   *   /*:lang ... * /      — plugin blocks (with optional language code)
   *   /*~struct~Name:lang ... * / — struct blocks (with optional language code)
   */
  _findBlocks(code) {
    const blocks = [];
    let match;

    // Plugin blocks: /*:lang ... */
    const pluginRe = /\/\*:(\w*)\s*([\s\S]*?)\*\//g;
    while ((match = pluginRe.exec(code)) !== null) {
      blocks.push(new RMMZCommentBlock({
        type: 'plugin',
        name: '',
        lang: match[1] || '',
        raw: match[0],
        inner: '\n' + (match[2] || ''),
        start: match.index,
        end: match.index + match[0].length,
      }));
    }

    // Struct blocks: /*~struct~Name:lang ... */
    // Group 1 = struct name, Group 2 = optional language code, Group 3 = inner
    const structRe = /\/\*~struct~(\w+)(?::(\w*))?\s*([\s\S]*?)\*\//g;
    while ((match = structRe.exec(code)) !== null) {
      blocks.push(new RMMZCommentBlock({
        type: 'struct',
        name: match[1],
        lang: match[2] !== undefined ? (match[2] || '') : '',
        raw: match[0],
        inner: match[3] || '',
        start: match.index,
        end: match.index + match[0].length,
      }));
    }

    blocks.sort((a, b) => a.start - b.start);
    return blocks;
  }

  // ─── Line Helpers ─────────────────────────────────────────────────────

  /** Strip the leading ' * ' comment prefix. */
  _stripPrefix(line) {
    return line.replace(/^\s*\*\s?/, '');
  }

  /** Extract the comment prefix from a line, e.g. ' * ' or ' *'. */
  _getPrefix(line) {
    const m = line.match(/^(\s*\*\s?)/);
    return m ? m[1] : ' * ';
  }

  // ─── Block Parsing ────────────────────────────────────────────────────

  /**
   * Parse the inner content of a single block into TranslatableItem[].
   */
  _parseBlock(block, bi) {
    const lines = block.inner.split('\n');
    const items = [];

    // Context tracking
    let currentParam = '';
    let currentCmd  = '';
    let currentArg  = '';

    // Whether @param/@arg/@command have a following @text
    const seenParams   = {};  // name -> { lineIndex, hadText, hadParent }
    const seenArgs     = {};  // name -> { lineIndex, hadText }
    const seenCommands = {};  // name -> { lineIndex, hadText }

    // @parent relationships: childKey -> parentKey
    const parentRelations = {};  // e.g. { 'スワイプキー': 'スワイプモード' }

    // @type struct references: paramName -> structTypeName
    // e.g. { 'GlossaryInfo': 'GlossaryData' }
    const structRefs = {};

    // @option entries for synthetic @value detection
    const seenOptions = [];      // { text, lineIndex, hadValue, paramName }

    // Multi-line accumulation
    let inHelp = false;
    let inDescFor = { name: '', contextPrefix: '' };
    let hLines = [];
    let hStart = -1;
    let dLines = [];
    let dStart = -1;

    const paramAtLine = (paramName) => {
      const p = seenParams[paramName];
      return p ? p.lineIndex : -1;
    };

    const flushHelp = () => {
      if (hLines.length > 0 && hStart >= 0) {
        while (hLines.length > 0 && hLines[hLines.length - 1].trim() === '') hLines.pop();
        const cleaned = hLines.map(l => this._stripPrefix(l)).join('\n').replace(/\n+$/, '');
        if (cleaned.trim()) {
          items.push(new TranslatableItem({
            id: `b${bi}-help`,
            type: 'help',
            original: cleaned,
            context: '',
            blockIndex: bi,
            isMultiLine: true,
            lineRange: [hStart, hStart + hLines.length - 1],
            prefixLines: hLines.map(l => this._getPrefix(l)),
          }));
        }
        hLines = [];
        hStart = -1;
      }
    };

    const flushDesc = () => {
      if (dLines.length > 0 && dStart >= 0) {
        while (dLines.length > 0 && dLines[dLines.length - 1].trim() === '') dLines.pop();
        const cleaned = dLines.map(l => this._stripPrefix(l)).join('\n').replace(/\n+$/, '');
        if (cleaned.trim()) {
          const ctx = inDescFor.contextPrefix || '';
          items.push(new TranslatableItem({
            id: `b${bi}-desc-${dStart}`,
            type: 'desc',
            original: cleaned,
            context: ctx,
            blockIndex: bi,
            isMultiLine: true,
            lineRange: [dStart, dStart + dLines.length - 1],
            prefixLines: dLines.map(l => this._getPrefix(l)),
            tagKey: inDescFor.name,
          }));
        }
        dLines = [];
        dStart = -1;
        inDescFor = { name: '', contextPrefix: '' };
      }
    };

    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li];
      const str = this._stripPrefix(raw).trimEnd();
      const strTrim = str.trim();

      // If we're inside a multi-line block, check if we hit a new tag
      if (inHelp && strTrim.startsWith('@')) { flushHelp(); inHelp = false; }
      if (inDescFor.name && strTrim.startsWith('@')) { flushDesc(); }

      if (inHelp) { hLines.push(raw); continue; }
      if (inDescFor.name) { dLines.push(raw); continue; }
      if (!strTrim.startsWith('@')) continue;

      const tagM = str.match(/^@(\w+)\s*(.*)/s);
      if (!tagM) continue;
      const tag = tagM[1];
      const val = tagM[2];

      switch (tag) {
        case 'plugindesc':
          if (val.trim()) {
            const idx = raw.indexOf('@plugindesc');
            items.push(new TranslatableItem({
              id: `b${bi}-plugindesc`,
              type: 'plugindesc',
              original: val.trim(),
              context: '',
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@plugindesc ',
            }));
          }
          break;

        case 'author':
          if (val.trim()) {
            const idx = raw.indexOf('@author');
            items.push(new TranslatableItem({
              id: `b${bi}-author`,
              type: 'author',
              original: val.trim(),
              context: '',
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@author ',
            }));
          }
          break;

        case 'help':
          inHelp = true;
          hLines = [];
          hStart = li + 1;  // content starts on the NEXT line
          if (val.trim()) {
            // Inline @help text (rare but valid)
            const idx = raw.indexOf('@help');
            items.push(new TranslatableItem({
              id: `b${bi}-help-inline`,
              type: 'help',
              original: val.trim(),
              context: '',
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@help ',
            }));
          }
          break;

        // ── @param / @command / @arg ──

        case 'param':
          currentParam = val.trim();
          currentCmd = '';
          currentArg = '';
          seenParams[currentParam] = {
            lineIndex: li,
            hadText: false,
            hadParent: false,
          };
          break;

        case 'command':
          currentCmd = val.trim();
          currentParam = '';
          currentArg = '';
          seenCommands[currentCmd] = {
            lineIndex: li,
            hadText: false,
          };
          break;

        case 'arg':
          currentArg = val.trim();
          seenArgs[currentArg] = {
            lineIndex: li,
            hadText: false,
          };
          break;

        // ── @parent ──

        case 'parent':
          if (val.trim() && currentParam) {
            parentRelations[currentParam] = val.trim();
            if (seenParams[currentParam]) {
              seenParams[currentParam].hadParent = true;
            }
          }
          break;

        // ── @type (struct reference tracking) ──

        case 'type': {
          const trimmed = val.trim();
          // Match struct<TypeName> or struct<TypeName>[]
          const structMatch = trimmed.match(/^struct<(\w+)>(?:\s*\[\])?$/);
          if (structMatch && currentParam) {
            structRefs[currentParam] = structMatch[1];
          }
          break;
        }

        // ── @text ──

        case 'text': {
          // Mark parent as having @text
          if (currentParam && seenParams[currentParam] !== undefined)
            seenParams[currentParam].hadText = true;
          if (currentArg && seenArgs[currentArg] !== undefined)
            seenArgs[currentArg].hadText = true;
          if (currentCmd && seenCommands[currentCmd] !== undefined)
            seenCommands[currentCmd].hadText = true;

          if (val.trim()) {
            let ctx = '';
            let tk = '';
            if (currentCmd) { ctx = `command: ${currentCmd}`; tk = currentCmd; }
            else if (currentArg) { ctx = `arg: ${currentArg}`; tk = currentArg; }
            else if (currentParam) { ctx = `param: ${currentParam}`; tk = currentParam; }

            const idx = raw.indexOf('@text');
            items.push(new TranslatableItem({
              id: `b${bi}-text-l${li}`,
              type: 'text',
              original: val.trim(),
              context: ctx,
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@text ',
              parentKey: currentParam ? (parentRelations[currentParam] || '') : '',
              tagKey: tk,
            }));
          }
          break;
        }

        // ── @desc ──

        case 'desc': {
          const trimVal = val.trim();
          const ctxFor = currentCmd ? `command: ${currentCmd}`
            : currentParam ? `param: ${currentParam}`
            : '';
          if (trimVal) {
            // Check if the next line starts a new tag — if so, this is single-line
            const nextLine = li + 1 < lines.length ? this._stripPrefix(lines[li + 1]).trim() : '';
            if (nextLine && nextLine.startsWith('@')) {
              const idx = raw.indexOf('@desc');
              items.push(new TranslatableItem({
                id: `b${bi}-desc-l${li}`,
                type: 'desc',
                original: trimVal,
                context: ctxFor,
                blockIndex: bi,
                isMultiLine: false,
                lineIndex: li,
                prefix: raw.substring(0, idx) + '@desc ',
                tagKey: currentParam || currentCmd,
                parentKey: currentParam ? (parentRelations[currentParam] || '') : '',
              }));
            } else {
              inDescFor = { name: currentParam || currentCmd, contextPrefix: ctxFor };
              dLines = [];
              dStart = li + 1;
              // Include the text on the @desc line
              dLines.push(raw.substring(0, raw.indexOf('@desc')) + trimVal);
            }
          } else {
            inDescFor = { name: currentParam || currentCmd, contextPrefix: ctxFor };
            dLines = [];
            dStart = li + 1;
          }
          break;
        }

        // ── @option / @value ──

        case 'option':
          if (val.trim()) {
            seenOptions.push({
              text: val.trim(),
              lineIndex: li,
              hadValue: false,
              paramName: currentParam,
            });
            const idx = raw.indexOf('@option');
            items.push(new TranslatableItem({
              id: `b${bi}-option-l${li}`,
              type: 'option',
              original: val.trim(),
              context: currentParam ? `param: ${currentParam}` : '',
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@option ',
              tagKey: currentParam,
              parentKey: currentParam ? (parentRelations[currentParam] || '') : '',
            }));
          }
          break;

        case 'value':
          if (val.trim()) {
            // Mark the most recent option without a value
            for (let vi = seenOptions.length - 1; vi >= 0; vi--) {
              if (!seenOptions[vi].hadValue) {
                seenOptions[vi].hadValue = true;
                break;
              }
            }
            const idx = raw.indexOf('@value');
            items.push(new TranslatableItem({
              id: `b${bi}-value-l${li}`,
              type: 'value',
              original: val.trim(),
              context: currentParam ? `param: ${currentParam}` : '',
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@value ',
              tagKey: currentParam,
              parentKey: currentParam ? (parentRelations[currentParam] || '') : '',
            }));
          }
          break;

        // ── @on / @off ──

        case 'on':
          if (val.trim()) {
            const idx = raw.indexOf('@on');
            items.push(new TranslatableItem({
              id: `b${bi}-on-l${li}`,
              type: 'on',
              original: val.trim(),
              context: currentParam ? `param: ${currentParam}` : '',
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@on ',
              tagKey: currentParam,
              parentKey: currentParam ? (parentRelations[currentParam] || '') : '',
            }));
          }
          break;

        case 'off':
          if (val.trim()) {
            const idx = raw.indexOf('@off');
            items.push(new TranslatableItem({
              id: `b${bi}-off-l${li}`,
              type: 'off',
              original: val.trim(),
              context: currentParam ? `param: ${currentParam}` : '',
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@off ',
              tagKey: currentParam,
              parentKey: currentParam ? (parentRelations[currentParam] || '') : '',
            }));
          }
          break;

        case 'default':
          if (val.trim()) {
            let ctx = '';
            if (currentCmd) ctx = `command: ${currentCmd}`;
            else if (currentArg) ctx = `arg: ${currentArg}`;
            else if (currentParam) ctx = `param: ${currentParam}`;
            const idx = raw.indexOf('@default');
            items.push(new TranslatableItem({
              id: `b${bi}-default-l${li}`,
              type: 'default',
              original: val.trim(),
              context: ctx,
              blockIndex: bi,
              isMultiLine: false,
              lineIndex: li,
              prefix: raw.substring(0, idx) + '@default ',
              tagKey: currentParam || currentCmd || currentArg,
              parentKey: currentParam ? (parentRelations[currentParam] || '') : '',
            }));
          }
          break;
      }
    }

    flushHelp();
    flushDesc();

    // ── Synthetic @text for @param without @text ──
    for (const [pname, info] of Object.entries(seenParams)) {
      if (!info.hadText && pname) {
        items.push(new TranslatableItem({
          id: `b${bi}-synparam-${pname}`,
          type: 'text',
          original: pname,
          context: `param: ${pname}`,
          blockIndex: bi,
          isMultiLine: false,
          isSynthetic: true,
          insertAfterLine: info.lineIndex,
          lineIndex: info.lineIndex + 0.5,
          prefix: null,
          tagKey: pname,
          parentKey: parentRelations[pname] || '',
        }));
      }
    }

    // ── Synthetic @text for @arg without @text ──
    for (const [aname, info] of Object.entries(seenArgs)) {
      if (!info.hadText && aname) {
        items.push(new TranslatableItem({
          id: `b${bi}-synarg-${aname}`,
          type: 'text',
          original: aname,
          context: `arg: ${aname}`,
          blockIndex: bi,
          isMultiLine: false,
          isSynthetic: true,
          insertAfterLine: info.lineIndex,
          lineIndex: info.lineIndex + 0.5,
          prefix: null,
          tagKey: aname,
        }));
      }
    }

    // ── Synthetic @text for @command without @text ──
    for (const [cname, info] of Object.entries(seenCommands)) {
      if (!info.hadText && cname) {
        items.push(new TranslatableItem({
          id: `b${bi}-syncmd-${cname}`,
          type: 'text',
          original: cname,
          context: `command: ${cname}`,
          blockIndex: bi,
          isMultiLine: false,
          isSynthetic: true,
          insertAfterLine: info.lineIndex,
          lineIndex: info.lineIndex + 0.5,
          prefix: null,
          tagKey: cname,
        }));
      }
    }

    // ── Synthetic @value for @option without @value ──
    for (const opt of seenOptions) {
      if (!opt.hadValue && opt.text) {
        items.push(new TranslatableItem({
          id: `b${bi}-synvalue-${opt.text}`,
          type: 'value',
          original: opt.text,
          context: opt.paramName ? `param: ${opt.paramName}` : '',
          blockIndex: bi,
          isMultiLine: false,
          isSynthetic: true,
          insertAfterLine: opt.lineIndex,
          lineIndex: opt.lineIndex + 0.5,
          prefix: null,
          tagKey: opt.paramName,
          parentKey: opt.paramName ? (parentRelations[opt.paramName] || '') : '',
        }));
      }
    }

    // Store struct reference map on the block for app.js to use
    block.structRefs = structRefs;

    // Propagate structRef to all items belonging to a param with struct<> type
    if (Object.keys(structRefs).length > 0) {
      for (const item of items) {
        const refType = structRefs[item.tagKey];
        if (refType) {
          item.structRef = refType;
        }
      }
    }

    return items;
  }

  // ─── Export ────────────────────────────────────────────────────────────

  /**
   * Export one or more blocks with translations applied.
   * @param {RMMZCommentBlock[]} blocks - Blocks to export
   * @param {Map<string, string>} translations - item.id -> translated text
   * @returns {string} Reconstructed comment block text
   */
  exportBlocks(blocks, translations) {
    const parts = blocks.map(b => this._exportBlock(b, translations));
    return parts.join('\n\n');
  }

  /**
   * Export a single block with translations applied.
   * Reconstructs the original block's raw text, replacing translated items
   * and inserting synthetic items.
   */
  _exportBlock(block, translations) {
    if (!block.items || block.items.length === 0) return block.raw;

    const rawLines = block.raw.split('\n');

    // Separate synthetic items from regular items
    const synItems = [];
    const regItems = [];

    for (const item of block.items) {
      if (item.isSynthetic) {
        // Synthetic @value always exported (uses original if no translation)
        synItems.push(item);
      } else if (translations.has(item.id) && translations.get(item.id).trim()) {
        regItems.push(item);
      }
    }

    // ── Apply regular item translations (reverse order to preserve line numbers) ──
    regItems.sort((a, b) => {
      const ap = a.isMultiLine ? a.lineRange[0] : a.lineIndex;
      const bp = b.isMultiLine ? b.lineRange[0] : b.lineIndex;
      return bp - ap;
    });

    for (const item of regItems) {
      const trans = translations.get(item.id);
      if (item.isMultiLine) {
        const [s, e] = item.lineRange;
        const tLines = trans.split('\n');
        const newL = tLines.map((l, i) => {
          const p = (item.prefixLines && item.prefixLines[i]) || ' * ';
          return p + l;
        });
        rawLines.splice(s, e - s + 1, ...newL);
        const delta = newL.length - (e - s + 1);
        this._adjustItemLines(regItems, s, e, delta);
        this._adjustInsertLines(synItems, s, e, delta);
      } else {
        rawLines[item.lineIndex] = (item.prefix || ' * @text ') + trans;
      }
    }

    // ── Insert synthetic items (reverse insertAfterLine order) ──
    // Only insert if there's a translation (or for @value, always use original)
    const insertItems = synItems.filter(item => {
      if (item.type === 'value') return true; // always include synthetic @value
      return translations.has(item.id) && translations.get(item.id).trim();
    });

    insertItems.sort((a, b) => b.insertAfterLine - a.insertAfterLine);

    for (const item of insertItems) {
      const trans = translations.get(item.id) || item.original;
      const prefix = this._getInsertPrefix(rawLines, item.insertAfterLine);
      const tag = item.type === 'value' ? '@value' : '@text';
      const newLine = `${prefix}${tag} ${trans}`;
      rawLines.splice(item.insertAfterLine + 1, 0, newLine);
    }

    return rawLines.join('\n');
  }

  /** Derive a suitable comment prefix for a newly inserted line. */
  _getInsertPrefix(lines, lineIndex) {
    if (lineIndex + 1 < lines.length) {
      const m = lines[lineIndex + 1].match(/^(\s*\*\s?)/);
      if (m) return m[1];
    }
    if (lineIndex >= 0 && lineIndex < lines.length) {
      const m = lines[lineIndex].match(/^(\s*\*\s?)/);
      if (m) return m[1];
    }
    return ' * ';
  }

  /** Adjust insertAfterLine offsets after a multi-line splice. */
  _adjustInsertLines(items, start, end, delta) {
    for (const item of items) {
      if (item.insertAfterLine > end) {
        item.insertAfterLine += delta;
      }
    }
  }

  /** Adjust line indices after a multi-line splice. */
  _adjustItemLines(items, start, end, delta) {
    for (const item of items) {
      if (item.isMultiLine) {
        if (item.lineRange[0] > end) {
          item.lineRange[0] += delta;
          item.lineRange[1] += delta;
        }
      } else {
        if (item.lineIndex > end) item.lineIndex += delta;
      }
    }
  }
}

// ─── Exports ───────────────────────────────────────────────────────────────

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { RMMZParser, RMMZCommentBlock, TranslatableItem };
}
