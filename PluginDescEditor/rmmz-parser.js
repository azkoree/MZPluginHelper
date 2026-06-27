/**
 * RMMZ Plugin Comment Parser
 * Extracts translatable text from RPG Maker MZ plugin comment blocks.
 */

class RMMZParser {
  parse(code) {
    const blocks = this._findBlocks(code);
    const items = [];
    blocks.forEach((block, bi) => {
      block.items = this._parseBlock(block, bi);
      items.push(...block.items);
    });
    return { blocks, items };
  }

  _findBlocks(code) {
    const blocks = [];
    let match;
    const pre = /\/\*:(\w*)\s*([\s\S]*?)\*\//g;
    while ((match = pre.exec(code)) !== null) {
      blocks.push({ type: "plugin", name: "", raw: match[0], lang: (match[1]||""), inner: "\n" + (match[2] || ""), start: match.index, end: match.index + match[0].length });
    }
    const sre = /\/\*~struct~(\w+):([\s\S]*?)\*\//g;
    while ((match = sre.exec(code)) !== null) {
      blocks.push({ type: "struct", name: match[1], raw: match[0], inner: match[2], start: match.index, end: match.index + match[0].length });
    }
    blocks.sort((a, b) => a.start - b.start);
    return blocks;
  }

  _stripPrefix(line) {
    return line.replace(/^\s*\*\s?/, '');
  }

  _getPrefix(line) {
    const m = line.match(/^(\s*\*\s?)/);
    return m ? m[1] : ' * ';
  }

  _parseBlock(block, bi) {
    const lines = block.inner.split('\n');
    const items = [];

    let param = '', cmd = '', arg = '';
    let inHelp = false, inDescFor = '';
    let hLines = [], hStart = -1;
    let dLines = [], dStart = -1;

    // Track @param/@arg entries to detect missing @text
    const seenParams = {}; // name -> { lineIndex: n, hadText: bool }
    const seenArgs = {};

    // Track @option entries to detect missing @value
    /** @type {{ text: string, lineIndex: number, hadValue: boolean, paramName: string }[]} */
    const seenOptions = [];

    const flushHelp = () => {
      if (hLines.length > 0 && hStart >= 0) {
        while (hLines.length > 0 && hLines[hLines.length - 1].trim() === '') { hLines.pop(); }
        const cleaned = hLines.map(l => this._stripPrefix(l)).join('\n').replace(/\n+$/, '');
        if (cleaned.trim()) {
          items.push(new TranslatableItem({
            id: `b${bi}-help`, type: 'help', original: cleaned, context: '', blockIndex: bi,
            isMultiLine: true, lineRange: [hStart, hStart + hLines.length - 1],
            prefixLines: hLines.map(l => this._getPrefix(l)),
          }));
        }
        hLines = []; hStart = -1;
      }
    };

    const flushDesc = () => {
      if (dLines.length > 0 && dStart >= 0) {
        while (dLines.length > 0 && dLines[dLines.length - 1].trim() === '') { dLines.pop(); }
        const cleaned = dLines.map(l => this._stripPrefix(l)).join('\n').replace(/\n+$/, '');
        if (cleaned.trim()) {
          items.push(new TranslatableItem({
            id: `b${bi}-desc-${dStart}`, type: 'desc', original: cleaned,
            context: inDescFor ? `param: ${inDescFor}` : '',
            blockIndex: bi, isMultiLine: true, lineRange: [dStart, dStart + dLines.length - 1],
            prefixLines: dLines.map(l => this._getPrefix(l)),
          }));
        }
        dLines = []; dStart = -1; inDescFor = '';
      }
    };

    for (let li = 0; li < lines.length; li++) {
      const raw = lines[li];
      const str = this._stripPrefix(raw).trimEnd();
      const strTrim = str.trim();

      if (inHelp && strTrim.startsWith('@')) { flushHelp(); inHelp = false; }
      if (inDescFor && strTrim.startsWith('@')) { flushDesc(); inDescFor = ''; }

      if (inHelp) { hLines.push(raw); continue; }
      if (inDescFor) { dLines.push(raw); continue; }
      if (!strTrim.startsWith('@')) continue;

      const tagM = str.match(/^@(\w+)\s*(.*)/s);
      if (!tagM) continue;
      const tag = tagM[1], val = tagM[2];

      switch (tag) {
        case 'plugindesc':
          if (val.trim()) {
            const idx = raw.indexOf('@plugindesc');
            items.push(new TranslatableItem({
              id: `b${bi}-plugindesc`, type: 'plugindesc', original: val.trim(), context: '',
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: raw.substring(0, idx) + '@plugindesc ',
            }));
          }
          break;

        case 'author':
          if (val.trim()) {
            const idx = raw.indexOf('@author');
            items.push(new TranslatableItem({
              id: `b${bi}-author`, type: 'author', original: val.trim(), context: '',
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: raw.substring(0, idx) + '@author ',
            }));
          }
          break;

        case 'help':
          inHelp = true; hLines = []; hStart = li + 1;
          if (val.trim()) {
            // Text on the same line as @help - treat as inline help text
            const helpIdx = raw.indexOf("@help");
            const helpPrefix = (helpIdx >= 0 ? raw.substring(0, helpIdx) : "") + "@help ";
            items.push(new TranslatableItem({
              id: "b" + bi + "-help-inline",
              type: "help", original: val.trim(), context: "",
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: helpPrefix,
            }));
          }
          break;

        case 'param':
          param = val.trim(); cmd = ''; arg = '';
          seenParams[param] = { lineIndex: li, hadText: false };
          break;

        case 'command':
          cmd = val.trim(); param = ''; arg = '';
          break;

        case 'arg':
          arg = val.trim();
          seenArgs[arg] = { lineIndex: li, hadText: false };
          break;

        case 'text': {
          // Mark parent as having @text
          if (param && seenParams[param] !== undefined) seenParams[param].hadText = true;
          if (arg && seenArgs[arg] !== undefined) seenArgs[arg].hadText = true;

          if (val.trim()) {
            const ctx = cmd ? `command: ${cmd}` : arg ? `arg: ${arg}` : param ? `param: ${param}` : '';
            const idx = raw.indexOf('@text');
            items.push(new TranslatableItem({
              id: `b${bi}-text-l${li}`, type: 'text', original: val.trim(), context: ctx,
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: raw.substring(0, idx) + '@text ',
            }));
          }
          break;
        }

        case 'desc': {
          const trimVal = val.trim();
          if (trimVal) {
            const next = li + 1 < lines.length ? this._stripPrefix(lines[li + 1]).trim() : '';
            if (next && next.startsWith('@')) {
              const idx = raw.indexOf('@desc');
              items.push(new TranslatableItem({
                id: `b${bi}-desc-l${li}`, type: 'desc', original: trimVal,
                context: param ? `param: ${param}` : cmd ? `command: ${cmd}` : '',
                blockIndex: bi, isMultiLine: false, lineIndex: li,
                prefix: raw.substring(0, idx) + '@desc ',
              }));
            } else {
              inDescFor = param || cmd; dLines = []; dStart = li + 1;
              dLines.push(raw.substring(0, raw.indexOf('@desc')) + trimVal);
            }
          } else {
            inDescFor = param || cmd; dLines = []; dStart = li + 1;
          }
          break;
        }

        case 'option': {
          if (val.trim()) {
            const optVal = val.trim();
            seenOptions.push({ text: optVal, lineIndex: li, hadValue: false, paramName: param });
            const idx = raw.indexOf('@option');
            items.push(new TranslatableItem({
              id: `b${bi}-option-l${li}`, type: 'option', original: optVal,
              context: param ? `param: ${param}` : '',
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: raw.substring(0, idx) + '@option ',
            }));
          }
          break;
        }

        case 'value': {
          if (val.trim()) {
            // Mark the most recent option without a value as having one
            for (let vi = seenOptions.length - 1; vi >= 0; vi--) {
              if (!seenOptions[vi].hadValue) {
                seenOptions[vi].hadValue = true;
                break;
              }
            }
            const ctx = param ? `param: ${param}` : '';
            const idx = raw.indexOf('@value');
            items.push(new TranslatableItem({
              id: `b${bi}-value-l${li}`, type: 'value', original: val.trim(),
              context: ctx,
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: raw.substring(0, idx) + '@value ',
            }));
          }
          break;
        }
        case 'on': {
          if (val.trim()) {
            const idx = raw.indexOf('@on');
            items.push(new TranslatableItem({
              id: `b${bi}-on-l${li}`, type: 'on', original: val.trim(),
              context: param ? `param: ${param}` : '',
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: raw.substring(0, idx) + '@on ',
            }));
          }
          break;
        }

        case 'off': {
          if (val.trim()) {
            const idx = raw.indexOf('@off');
            items.push(new TranslatableItem({
              id: `b${bi}-off-l${li}`, type: 'off', original: val.trim(),
              context: param ? `param: ${param}` : '',
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: raw.substring(0, idx) + '@off ',
            }));
          }
          break;
        }
        case 'default': {
          if (val.trim()) {
            const ctx = cmd ? `command: ${cmd}` : arg ? `arg: ${arg}` : param ? `param: ${param}` : '';
            const idx = raw.indexOf('@default');
            items.push(new TranslatableItem({
              id: `b${bi}-default-l${li}`, type: 'default', original: val.trim(),
              context: ctx,
              blockIndex: bi, isMultiLine: false, lineIndex: li,
              prefix: raw.substring(0, idx) + '@default ',
            }));
          }
          break;
        }
      }
    }

    flushHelp();
    flushDesc();

    // ── Add synthetic @text for @param/@arg entries lacking @text ──
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
        }));
      }
    }
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
        }));
      }
    }

    // ── Add synthetic @value for @option entries lacking @value ──
    for (const opt of seenOptions) {
      if (!opt.hadValue && opt.text) {
        const ctx = opt.paramName ? `param: ${opt.paramName}` : '';
        items.push(new TranslatableItem({
          id: `b${bi}-synvalue-${opt.text}`,
          type: 'value',
          original: opt.text,
          context: ctx,
          blockIndex: bi,
          isMultiLine: false,
          isSynthetic: true,
          insertAfterLine: opt.lineIndex,
          lineIndex: opt.lineIndex + 0.5,
          prefix: null,
        }));
      }
    }

    return items;
  }

  exportBlocks(blocks, translations) {
    let result = blocks.map(b => this._exportBlock(b, translations)).join('\n\n');
    if (!/\n \*\/$/.test(result)) result += '\n */';
    return result;
  }

  _exportBlock(block, translations) {
    if (!block.items || block.items.length === 0) return block.raw;

    const rawLines = block.raw.split('\n');

    // Separate synthetic items from regular ones
    const synItems = [];
    const regItems = [];

    for (const item of block.items) {
      if (item.isSynthetic) {
        // Synthetic @value always exported (fallback to original if no translation)
        if (item.type === 'value') {
          synItems.push(item);
        } else if (translations.has(item.id) && translations.get(item.id).trim()) {
          synItems.push(item);
        }
      } else if (translations.has(item.id) && translations.get(item.id).trim()) {
        regItems.push(item);
      }
    }

    // Process regular items (replacements) in reverse line order
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
        const delta = newL.length - (e - s + 1);
        rawLines.splice(s, e - s + 1, ...newL);
        this._adjustLines(regItems, s, e, delta);
        // Also adjust synthetic insert positions
        this._adjustInsertLines(synItems, s, e, delta);
      } else {
        rawLines[item.lineIndex] = item.prefix + trans;
      }
    }

    // Process synthetic items (insert @text/@value lines) in reverse insertAfterLine order
    synItems.sort((a, b) => b.insertAfterLine - a.insertAfterLine);

    for (const item of synItems) {
      const trans = translations.get(item.id) || item.original;
      const prefix = this._getInsertPrefix(rawLines, item.insertAfterLine);
      const tag = item.type === 'value' ? '@value' : '@text';
      const newLine = `${prefix}${tag} ${trans}`;
      // Insert the line right after the @param/@arg/@option line
      rawLines.splice(item.insertAfterLine + 1, 0, newLine);
    }

    return rawLines.join('\n');
  }

  /** Derive a suitable comment prefix for a newly inserted line */
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

  /** Adjust insertAfterLine offsets after a multi-line splice */
  _adjustInsertLines(items, start, end, delta) {
    for (const item of items) {
      if (item.insertAfterLine > end) {
        item.insertAfterLine += delta;
      }
    }
  }

  _adjustLines(items, start, end, delta) {
    for (const item of items) {
      if (item.isMultiLine) {
        if (item.lineRange[0] > end) { item.lineRange[0] += delta; item.lineRange[1] += delta; }
      } else {
        if (item.lineIndex > end) item.lineIndex += delta;
      }
    }
  }
}

class RMMZCommentBlock {
  constructor({ type, name, lang, raw, inner, start, end }) {
    this.type = type; this.name = name; this.lang = lang || ""; this.raw = raw;
    this.inner = inner; this.start = start; this.end = end;
    this.items = [];
  }
}

class TranslatableItem {
  constructor({ id, type, original, context, blockIndex, isMultiLine, lineIndex, lineRange, prefix, prefixLines, isSynthetic, insertAfterLine }) {
    this.id = id; this.type = type; this.original = original;
    this.translation = ''; this.context = context; this.blockIndex = blockIndex;
    this.isMultiLine = isMultiLine; this.lineIndex = lineIndex;
    this.lineRange = lineRange; this.prefix = prefix;
    this.prefixLines = prefixLines || [];
    this.isSynthetic = isSynthetic || false;
    this.insertAfterLine = insertAfterLine !== undefined ? insertAfterLine : -1;
  }

  get groupLabel() {
    if (this.isSynthetic && this.type !== 'value') return '追加 @text';
    if (this.isSynthetic && this.type === 'value') return '追加 @value';
    switch (this.type) {
      case 'help': return '帮助文本 (@help)';
      case 'plugindesc': return '插件描述 (@plugindesc)';
      case 'author': return '作者 (@author)';
      case 'text': return '显示名 (@text)';
      case 'desc': return '描述 (@desc)';
      case 'option': return '选项 (@option)';
      case 'value': return '选项值 (@value)';
      case 'default': return '默认值 (@default)';
      case 'on': return '开启文字 (@on)';
      case 'off': return '关闭文字 (@off)';
      default: return this.type;
    }
  }
}





