// ============================================================================
// Text2Frame 标签数据库 — English Only
// ============================================================================

/**
 * @typedef {Object} TagEntry
 * @property {string}  id        - Unique identifier
 * @property {string}  name      - English tag text (displayed in pill)
 * @property {string}  category  - Category key: 'window'|'flow'|'varswitch'|'screen'|'data'|'picture'
 * @property {string}  desc      - English description
 * @property {string[]} params    - Parameter placeholder names (for auto-selection)
 * @property {string}  example   - Usage example
 * @property {boolean} paired    - Whether this is a paired tag (needs closing tag)
 * @property {string}  [closeTag]- Closing tag text (only for paired tags)
 * @property {string}  [insertText] - Custom insertion text (overrides name)
 */

const CATEGORIES = [
  { id: 'window',    label: '窗口设定',  icon: '⊞' },
  { id: 'flow',      label: '流程控制',     icon: '↗' },
  { id: 'varswitch', label: '变量与开关', icon: '⚙' },
  { id: 'screen',    label: '画面与音效',   icon: '♪' },
  { id: 'data',      label: '数据与物品',     icon: '◆' },
  { id: 'picture',   label: '图片与高级', icon: '🖼' },
];

const TAGS = [
  // ─── Window Settings ───────────────────────────────────────────────────
  {
    id: 'face',
    name: '<Face: FileName>',
    category: 'window',
    desc: '指定显示的脸图文件名。',
    params: ['FileName'],
    example: '<Face: Actor1>',
    paired: false,
  },
  {
    id: 'background',
    name: '<Background: Window/Dim/Transparent>',
    category: 'window',
    desc: '设置对话框背景样式。',
    params: ['Window/Dim/Transparent'],
    example: '<Background: Window>',
    paired: false,
  },
  {
    id: 'position',
    name: '<Position: Top/Middle/Bottom>',
    category: 'window',
    desc: '设置对话框在屏幕上的位置。',
    params: ['Top/Middle/Bottom'],
    example: '<Position: Middle>',
    paired: false,
  },
  {
    id: 'name',
    name: '<Name: ○○○○>',
    category: 'window',
    desc: '显示指定文本的名称框。',
    params: ['○○○○'],
    example: '<Name: Hero>',
    paired: false,
  },

  // ─── Flow Control ────────────────────────────────────────────────────
  {
    id: 'showchoices',
    name: '<ShowChoices>',
    category: 'flow',
    desc: '开始选择肢分支。',
    params: [],
    example: '<ShowChoices>',
    paired: false,
  },
  {
    id: 'when',
    name: '<When: Choice>',
    category: 'flow',
    desc: '定义单个选择肢选项。',
    params: ['Choice'],
    example: '<When: Yes>',
    paired: false,
  },
  {
    id: 'if',
    name: '<If: Switch[n], ON/OFF>',
    category: 'flow',
    desc: '条件分支——根据开关状态判断。',
    params: ['Switch[n], ON/OFF'],
    example: '<If: Switch[1], ON>',
    paired: false,
  },
  {
    id: 'else',
    name: '<Else>',
    category: 'flow',
    desc: '条件分支的否则分支。',
    params: [],
    example: '<Else>',
    paired: false,
  },
  {
    id: 'end',
    name: '<End>',
    category: 'flow',
    desc: '结束代码块（选择肢、条件、战斗等）。',
    params: [],
    example: '<End>',
    paired: false,
  },
  {
    id: 'loop',
    name: '<Loop>',
    category: 'flow',
    desc: '开始循环代码块。',
    params: [],
    example: '<Loop>',
    paired: false,
  },
  {
    id: 'repeatabove',
    name: '<RepeatAbove>',
    category: 'flow',
    desc: '返回当前循环的开头。',
    params: [],
    example: '<RepeatAbove>',
    paired: false,
  },
  {
    id: 'breakloop',
    name: '<BreakLoop>',
    category: 'flow',
    desc: '跳出当前循环。',
    params: [],
    example: '<BreakLoop>',
    paired: false,
  },
  {
    id: 'battleprocessing',
    name: '<BattleProcessing: n>',
    category: 'flow',
    desc: '开始指定敌群的战斗。',
    params: ['n'],
    example: '<BattleProcessing: 5>',
    paired: false,
  },
  {
    id: 'ifwin',
    name: '<IfWin>',
    category: 'flow',
    desc: '战斗胜利分支。',
    params: [],
    example: '<IfWin>',
    paired: false,
  },
  {
    id: 'iflose',
    name: '<IfLose>',
    category: 'flow',
    desc: '战斗失败分支。',
    params: [],
    example: '<IfLose>',
    paired: false,
  },
  {
    id: 'label',
    name: '<Label: Text>',
    category: 'flow',
    desc: '设置跳转标签。',
    params: ['Text'],
    example: '<Label: Start>',
    paired: false,
  },
  {
    id: 'jumptolabel',
    name: '<JumpToLabel: Text>',
    category: 'flow',
    desc: '跳转到指定标签。',
    params: ['Text'],
    example: '<JumpToLabel: Start>',
    paired: false,
  },
  {
    id: 'commonevent',
    name: '<CommonEvent: n>',
    category: 'flow',
    desc: '插入指定ID的公共事件。',
    params: ['n'],
    example: '<CommonEvent: 3>',
    paired: false,
  },

  // ─── Variables & Switches ─────────────────────────────────────────────
  {
    id: 'switch',
    name: '<Switch: n, ON/OFF>',
    category: 'varswitch',
    desc: '打开或关闭一个开关。',
    params: ['n, ON/OFF'],
    example: '<Switch: 1, ON>',
    paired: false,
  },
  {
    id: 'selfswitch',
    name: '<SelfSwitch: A, ON/OFF>',
    category: 'varswitch',
    desc: '打开或关闭一个独立开关。',
    params: ['A, ON/OFF'],
    example: '<SelfSwitch: A, ON>',
    paired: false,
  },
  {
    id: 'set',
    name: '<Set: n, value>',
    category: 'varswitch',
    desc: '设置变量为指定值。',
    params: ['n, value'],
    example: '<Set: 1, 10>',
    paired: false,
  },
  {
    id: 'add',
    name: '<Add: n, value>',
    category: 'varswitch',
    desc: '为变量增加指定值。',
    params: ['n, value'],
    example: '<Add: 1, 5>',
    paired: false,
  },
  {
    id: 'sub',
    name: '<Sub: n, value>',
    category: 'varswitch',
    desc: '为变量减去指定值。',
    params: ['n, value'],
    example: '<Sub: 1, 3>',
    paired: false,
  },
  {
    id: 'mul',
    name: '<Mul: n, value>',
    category: 'varswitch',
    desc: '将变量乘以指定值。',
    params: ['n, value'],
    example: '<Mul: 1, 2>',
    paired: false,
  },
  {
    id: 'div',
    name: '<Div: n, value>',
    category: 'varswitch',
    desc: '将变量除以指定值。',
    params: ['n, value'],
    example: '<Div: 1, 2>',
    paired: false,
  },
  {
    id: 'mod',
    name: '<Mod: n, value>',
    category: 'varswitch',
    desc: '将变量设为除法的余数。',
    params: ['n, value'],
    example: '<Mod: 1, 3>',
    paired: false,
  },

  // ─── Screen & Audio ────────────────────────────────────────────────
  {
    id: 'wait',
    name: '<Wait: Frames>',
    category: 'screen',
    desc: '暂停执行指定帧数（60帧≈1秒）。',
    params: ['Frames'],
    example: '<Wait: 60>',
    paired: false,
  },
  {
    id: 'fadeout',
    name: '<FadeOut>',
    category: 'screen',
    desc: '画面淡出至黑色。',
    params: [],
    example: '<FadeOut>',
    paired: false,
  },
  {
    id: 'fadein',
    name: '<FadeIn>',
    category: 'screen',
    desc: '画面从黑色淡入。',
    params: [],
    example: '<FadeIn>',
    paired: false,
  },
  {
    id: 'tintscreen',
    name: '<TintScreen: Duration[n], ColorTone[r][g][b][gry]>',
    category: 'screen',
    desc: '在指定帧数内将画面色调变更为指定颜色。',
    params: ['Duration[n], ColorTone[r][g][b][gry]'],
    example: '<TintScreen: 60, ColorTone[68][68][68][0]>',
    paired: false,
  },
  {
    id: 'flashscreen',
    name: '<FlashScreen: r, g, b, intensity, frames>',
    category: 'screen',
    desc: '用指定颜色闪烁画面。',
    params: ['r, g, b, intensity, frames'],
    example: '<FlashScreen: 255, 255, 255, 100, 30>',
    paired: false,
  },
  {
    id: 'shakescreen',
    name: '<ShakeScreen: power, speed, frames>',
    category: 'screen',
    desc: '震动画面。',
    params: ['power, speed, frames'],
    example: '<ShakeScreen: 5, 6, 60>',
    paired: false,
  },
  {
    id: 'playbgm',
    name: '<PlayBGM: name, vol, pitch, pan>',
    category: 'screen',
    desc: '播放BGM。',
    params: ['name, vol, pitch, pan'],
    example: '<PlayBGM: Battle1, 90, 100, 0>',
    paired: false,
  },
  {
    id: 'fadeoutbgm',
    name: '<FadeoutBGM: sec>',
    category: 'screen',
    desc: '在指定秒数内淡出当前BGM。',
    params: ['sec'],
    example: '<FadeoutBGM: 2>',
    paired: false,
  },
  {
    id: 'playbgs',
    name: '<PlayBGS: name, vol, pitch, pan>',
    category: 'screen',
    desc: '播放BGS。',
    params: ['name, vol, pitch, pan'],
    example: '<PlayBGS: Rain, 80, 100, 0>',
    paired: false,
  },
  {
    id: 'fadeoutbgs',
    name: '<FadeoutBGS: sec>',
    category: 'screen',
    desc: '在指定秒数内淡出当前BGS。',
    params: ['sec'],
    example: '<FadeoutBGS: 2>',
    paired: false,
  },
  {
    id: 'playme',
    name: '<PlayME: name, vol, pitch, pan>',
    category: 'screen',
    desc: '播放ME。',
    params: ['name, vol, pitch, pan'],
    example: '<PlayME: Fanfare1, 100, 100, 0>',
    paired: false,
  },
  {
    id: 'playse',
    name: '<PlaySE: name, vol, pitch, pan>',
    category: 'screen',
    desc: '播放SE。',
    params: ['name, vol, pitch, pan'],
    example: '<PlaySE: Attack1, 80, 100, 0>',
    paired: false,
  },
  {
    id: 'stopse',
    name: '<StopSE>',
    category: 'screen',
    desc: '停止所有SE播放。',
    params: [],
    example: '<StopSE>',
    paired: false,
  },

  // ─── Data & Items ────────────────────────────────────────────────────
  {
    id: 'changegold',
    name: '<ChangeGold: Increase/Decrease, amount>',
    category: 'data',
    desc: '增加或减少队伍的金币。',
    params: ['Increase/Decrease, amount'],
    example: '<ChangeGold: Increase, 500>',
    paired: false,
  },
  {
    id: 'changeitems',
    name: '<ChangeItems: id, Increase/Decrease, amount>',
    category: 'data',
    desc: '增加或减少指定物品的数量。',
    params: ['id, Increase/Decrease, amount'],
    example: '<ChangeItems: 1, Increase, 2>',
    paired: false,
  },
  {
    id: 'changeweapons',
    name: '<ChangeWeapons: id, Increase/Decrease, amount>',
    category: 'data',
    desc: '增加或减少指定武器的数量。',
    params: ['id, Increase/Decrease, amount'],
    example: '<ChangeWeapons: 1, Increase, 1>',
    paired: false,
  },
  {
    id: 'changearmors',
    name: '<ChangeArmors: id, Increase/Decrease, amount>',
    category: 'data',
    desc: '增加或减少指定防具的数量。',
    params: ['id, Increase/Decrease, amount'],
    example: '<ChangeArmors: 1, Increase, 1>',
    paired: false,
  },

  // ─── Pictures & Advanced ────────────────────────────────────────────
  {
    id: 'showpicture',
    name: '<ShowPicture: n, name, Scale[w][h]>',
    category: 'picture',
    desc: '在屏幕上显示图片。',
    params: ['n, name, Scale[w][h]'],
    example: '<ShowPicture: 1, Castle, Scale[100][100]>',
    paired: false,
  },
  {
    id: 'movepicture',
    name: '<MovePicture: n, Position[org][x][y]>',
    category: 'picture',
    desc: '移动图片到指定位置。',
    params: ['n, Position[org][x][y]'],
    example: '<MovePicture: 1, Position[0][200][300]>',
    paired: false,
  },
  {
    id: 'rotatepicture',
    name: '<RotatePicture: n, speed>',
    category: 'picture',
    desc: '以指定速度旋转图片。',
    params: ['n, speed'],
    example: '<RotatePicture: 1, 3>',
    paired: false,
  },
  {
    id: 'tintpicture',
    name: '<TintPicture: n, Duration[n], ColorTone[r][g][b][gry]>',
    category: 'picture',
    desc: '改变指定图片的色调。',
    params: ['n, Duration[n], ColorTone[r][g][b][gry]'],
    example: '<TintPicture: 1, 60, ColorTone[-68][-68][-68][0]>',
    paired: false,
  },
  {
    id: 'erasepicture',
    name: '<ErasePicture: n>',
    category: 'picture',
    desc: '从屏幕消除指定图片。',
    params: ['n'],
    example: '<ErasePicture: 1>',
    paired: false,
  },
  {
    id: 'transferplayer',
    name: '<TransferPlayer: Direct[id][x][y], dir, fade>',
    category: 'picture',
    desc: '将玩家传送到另一地图或位置。',
    params: ['Direct[id][x][y], dir, fade'],
    example: '<TransferPlayer: Direct[3][15][10], Retain, Black>',
    paired: false,
  },
  {
    id: 'script',
    name: '<script>',
    category: 'picture',
    desc: '嵌入 JavaScript 代码片段（成对标签）。',
    params: [],
    example: '<script></script>',
    paired: true,
    closeTag: '</script>',
    insertText: '<script>\n\t\n</script>',
  },
  {
    id: 'comment',
    name: '<comment>',
    category: 'picture',
    desc: '注释块（成对标签）。',
    params: [],
    example: '<comment></comment>',
    paired: true,
    closeTag: '</comment>',
    insertText: '<comment>\n\t\n</comment>',
  },
  {
    id: 'opensavescreen',
    name: '<OpenSaveScreen>',
    category: 'picture',
    desc: '打开存档画面。',
    params: [],
    example: '<OpenSaveScreen>',
    paired: false,
  },
];

// Helper: get tags by category
function getTagsByCategory(catId) {
  return TAGS.filter(t => t.category === catId);
}

// Helper: get category info
function getCategoryInfo(catId) {
  return CATEGORIES.find(c => c.id === catId);
}

// ============================================================================
// Preset Templates (模板片段)
// ============================================================================

/**
 * @typedef {Object} TemplateEntry
 * @property {string}  id       - Unique identifier
 * @property {string}  name     - Display name
 * @property {string}  category - Category key (for filtering) or 'all' / 'custom'
 * @property {string}  content  - Text content to insert
 */

const PRESET_TEMPLATES = [
  {
    id: 'simple_dialogue',
    name: '简单对话',
    category: 'window',
    content: '<Name: >\n<Face: >\n台词',
  },
  {
    id: 'choice_branch',
    name: '分支选择',
    category: 'flow',
    content: '<ShowChoices>\n<When: >\n\t处理\n<When: >\n\t处理\n<End>',
  },
  {
    id: 'battle_encounter',
    name: '战斗遭遇',
    category: 'flow',
    content: '<BattleProcessing: >\n<IfWin>\n\t胜利时处理\n<IfLose>\n\t败北时处理\n<End>',
  },
  {
    id: 'transfer_scene',
    name: '场所移动',
    category: 'picture',
    content: '<FadeOut>\n<TransferPlayer: Direct[][][], Retain, Black>\n<FadeIn>',
  },
  {
    id: 'condition_branch',
    name: '条件分支',
    category: 'flow',
    content: '<If: Switch[], >\n\t条件成立时\n<Else>\n\t条件不成立时\n<End>',
  },
  {
    id: 'loop_block',
    name: '循环',
    category: 'flow',
    content: '<Loop>\n\t重复处理\n<RepeatAbove>',
  },
  {
    id: 'picture_effect',
    name: '图片演出',
    category: 'picture',
    content: '<ShowPicture: , , Scale[100][100]>\n<Wait: 60>\n<ErasePicture: >',
  },
];

// ─── Custom Templates (stored in localStorage) ────────────────────

const CUSTOM_TEMPLATES_KEY = 't2f_custom_templates';

function loadCustomTemplates() {
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('Failed to load custom templates:', e);
    return [];
  }
}

function saveCustomTemplates(templates) {
  try {
    localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(templates));
    return true;
  } catch (e) {
    console.warn('Failed to save custom templates:', e);
    return false;
  }
}

function addCustomTemplate(name, content) {
  const templates = loadCustomTemplates();
  const id = 'custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  templates.push({ id, name, category: 'custom', content });
  saveCustomTemplates(templates);
  return id;
}

function deleteCustomTemplate(id) {
  let templates = loadCustomTemplates();
  templates = templates.filter(t => t.id !== id);
  saveCustomTemplates(templates);
}
