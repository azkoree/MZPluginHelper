//=============================================================================
// SceneGlossary_JSON_Loader.js
//
// 桥接插件：让 SceneGlossary 通过 UniqueDataLoader 从 JSON 文件加载词典条目
// 而非占用数据库物品/武器/防具的槽位。
//
// Version 1.0.0 2024/06/23 初版
//=============================================================================

/*:zh
 * @plugindesc SceneGlossary × UniqueDataLoader 桥接插件，从 JSON 文件加载词典条目 (v1.0.0)
 * @target MZ
 * @author Codex
 * @base PluginCommonBase
 * @orderAfter PluginCommonBase
 * @orderAfter SceneGlossary
 * @orderAfter UniqueDataLoader
 *
 * @param UniqueGlobalVariable
 * @text UniqueDataLoader 全局变量名
 * @desc UniqueDataLoader 插件中设置的全局变量名称。必须保持一致。
 * @default $dataUniques
 *
 * @param PropertyName
 * @text JSON 属性名
 * @desc UniqueDataLoader 数据列表中对应的属性名，用于获取词典条目数组。
 * @default glossary
 *
 * @param AlwaysObtained
 * @text 条目始终视为已获取
 * @type boolean
 * @desc 启用后，JSON 条目始终在词典列表中显示，不依赖背包持有。
 * @default true
 *
 *
 *
 * @help
 * ============================================================================
 * SceneGlossary_JSON_Loader.js
 * ============================================================================
 *
 * 【用途】
 * 本插件作为 SceneGlossary.js 和 UniqueDataLoader.js 之间的桥接层。
 * 通过 UniqueDataLoader 加载外部的 JSON 词典文件，将条目注入到
 * SceneGlossary 的条目列表中，无需在 RPG Maker 数据库（物品/武器/防具）
 * 中创建任何条目。
 *
 * 【依赖关系】
 * 必须按以下顺序加载插件：
 *   1. PluginCommonBase.js（必须）
 *   2. UniqueDataLoader.js
 *   3. SceneGlossary.js
 *   4. SceneGlossary_JSON_Loader.js（本插件，放在最后）
 *
 * 【使用方法】
 * 1. 将本插件加入插件管理，放在 UniqueDataLoader 和 SceneGlossary 下方。
 * 2. 在 UniqueDataLoader 中设置数据列表：
 *      - 属性名（PropertyName）：glossary（与插件参数保持一致）
 *      - JSON 文件名（JsonFileName）：GlossaryData（无需扩展名）
 * 3. 在 data/ 文件夹下创建 GlossaryData.json。
 *
 * 【JSON 文件格式】
 * 每个条目的字段结构与 RMMZ 数据库物品对应，note 字段直接写
 * SceneGlossary 支持的备注标签（与在数据库编辑器中写备注完全一致）：
 *
 * [
 *   {
 *     "id": 10001,
 *     "name": "条目名称",
 *     "iconIndex": 0,
 *     "itypeId": 4,
 *     "note": "<SGDescription:说明文字>\n<SGCategory:分类>\n<SGType:1>"
 *   }
 * ]
 * 
 * 【解锁条目】
 * $gameParty.gainGlossaryById(10001)  #解锁单个条目
 * $gameParty.gainGlossaryByIds([10001, 10002, 10003])  #解锁多个条目
 * $gameParty.loseGlossaryById(10001)  #丢弃单个条目
 * $gameParty.hasGlossaryById(10001)  #是否解锁了某个条目
 * $gameParty.loseGlossaryByIds([10001, 10002, 10003])  #丢弃多个条目
 *
 * 【支持的备注标签（在 note 中使用）】
 * 以下所有 SceneGlossary 原生支持的标签均自动生效：
 *
 *   <SGDescription:xxx>           // 说明文
 *   <SGDescription2:xxx>          // 第2页说明文（最多99页）
 *   <SG共通説明:xxx>              // 共用说明文
 *   <SG未入手説明:xxx>            // 未入手时的说明文
 *   <SGCategory:xxx>              // 所属分类
 *   <SGType:n>                    // 用语种类编号
 *   <SGPicture:filename>          // 图片文件名
 *   <SGPicturePosition:text>      // 图片显示位置（top/bottom/text）
 *   <SGTextPosition:100>          // 文本显示位置
 *   <SGPicturePriority:top>       // 图片优先级
 *   <SGPictureScale:0.5>          // 图片放大率
 *   <SGPictureAlign:right>        // 图片对齐
 *   <SGピクチャX:100>             // 图片 X 坐标修正
 *   <SGピクチャY:100>             // 图片 Y 坐标修正
 *   <SG追加1ピクチャ:file,x,y>    // 附加图片（最多99个）
 *   <SGManual>                    // 排除自动注册
 *   <SGNoCollect>                 // 排除收集率
 *   <SG表示順:5>                  // 显示顺序
 *   <SGページ番号不要>            // 不显示页码
 *   <SGNoPageNum>                 // 同上
 *   <SG用語閲覧スイッチ:1>        // 打开时指定开关 ON
 *   <SGViewingSwitch:1>           // 同上
 *   <SG表示スイッチ2:1>           // 开关控制第2页显示
 *   <SGTextColorChange:1,10>      // 开关控制文字颜色
 *
 * 【提示】
 * - id 建议使用 10000 以上的数值，避免与数据库物品 ID 冲突。
 * - itypeId = 4 对应"隐藏物品A"，SceneGlossary 默认仅对隐藏物品生效。
 *   itypeId = 3 对应"隐藏物品B"，同样可用。
 * - iconIndex 为 0 表示无图标，可在数据库 iconset 中查询。
 * - 如果加载的 JSON 条目与实际数据库条目 id 重复，以 JSON 条目为准（会被覆盖）。
 *
 * 【参数说明】
 * - "条目始终视为已获取" 启用时，JSON 中的条目始终在词典中显示
 *   （相当于默认已收集）。关闭后则需要通过插件命令
 *   GLOSSARY_GAIN_ALL 或自动注册来获取。
 */

(() => {
    'use strict';
    const script = document.currentScript;
    const param  = PluginManagerEx.createParameter(script);

    // ============================================================================
    // 内部变量
    // ============================================================================

    // 模块级缓存：存放从 JSON 解析出的虚拟物品对象
    let _jsonGlossaryItems = null;

    // 标记字段：用于识别 JSON 来源的条目
    const JSON_FLAG = '_isJsonGlossary';

    // ============================================================================
    // 工具函数
    // ============================================================================

    /**
     * 检查条目是否为 JSON 来源的虚拟物品
     */
    function isJsonItem(item) {
        return item && item[JSON_FLAG] === true;
    }

    /**
     * 从 JSON 条目创建虚拟物品对象
     * 结构模仿 RMMZ $dataItems 中的一条数据，
     * 关键是 note 字段，SceneGlossary 通过 getMetaValues 解析它。
     */
    function createVirtualItem(entry) {
        var item = {
            id: entry.id,
            name: String(entry.name || ''),
            iconIndex: Number(entry.iconIndex) || 0,
            description: String(entry.description || ''),
            itypeId: Number(entry.itypeId) || 4,
            price: Number(entry.price) || 0,
            note: String(entry.note || ''),
            meta: {},
            effects: [],
            animations: [],
            // 标记这是 JSON 来源
            [JSON_FLAG]: true
        };
        // 解析 note 中的 <tag:value> 标签到 meta 对象
        // （RMMZ 加载数据库时自动做这一步，但我们是手动构造的虚拟物品，必须自己调用）
        DataManager.extractMetadata(item);
        return item;
    }

    /**
     * 从 UniqueDataLoader 加载的全局变量中构建虚拟物品列表
     */
    function buildJsonItems() {
        _jsonGlossaryItems = null;
        const globalObj = window[param.UniqueGlobalVariable];
        if (!globalObj) {
            console.warn('SceneGlossary_JSON_Loader: 全局变量 ' + param.UniqueGlobalVariable + ' 不存在。' +
                '请确认 UniqueDataLoader 已正确配置。');
            return;
        }
        const data = globalObj[param.PropertyName];
        if (!Array.isArray(data)) {
            console.warn('SceneGlossary_JSON_Loader: ' + param.UniqueGlobalVariable + '.' +
                param.PropertyName + ' 不是有效数组。请检查 JSON 文件格式。');
            return;
        }
        _jsonGlossaryItems = data.map(function(entry) {
            return createVirtualItem(entry);
        });
        console.log('SceneGlossary_JSON_Loader: 已加载 ' + _jsonGlossaryItems.length + ' 条 JSON 词典条目。');
    }

    // ============================================================================
    // Hook: 在 UniqueDataLoader 加载完成后初始化
    // ============================================================================

    const _Scene_Boot_onUniqueDataLoad = Scene_Boot.prototype.onUniqueDataLoad;
    Scene_Boot.prototype.onUniqueDataLoad = function() {
        _Scene_Boot_onUniqueDataLoad.apply(this, arguments);
        buildJsonItems();
    };

    // ============================================================================
    // Hook: Game_Party.prototype 相关函数
    // ============================================================================

    /**
     * 检查 JSON 条目的"持有"状态
     */
    Game_Party.prototype.hasJsonGlossaryItem = function(item) {
        if (!isJsonItem(item)) return false;
        if (param.AlwaysObtained) return true;
        return this._jsonGlossaryObtained && !!this._jsonGlossaryObtained[item.id];
    };

    /**
     * 初始化 JSON 词典持有记录
     */
    const _Game_Party_initialize = Game_Party.prototype.initialize;
    Game_Party.prototype.initialize = function() {
        _Game_Party_initialize.apply(this, arguments);
        this._jsonGlossaryObtained = {};
    };

    /**
     * Hook hasItem — 让 JSON 条目的持有检查走独立的记录
     */
    const _Game_Party_hasItem = Game_Party.prototype.hasItem;
    Game_Party.prototype.hasItem = function(item) {
        if (isJsonItem(item)) {
            return this.hasJsonGlossaryItem(item);
        }
        return _Game_Party_hasItem.apply(this, arguments);
    };

    /**
     * Hook hasGlossary — 让 JSON 条目的词典可见性走独立记录
     */
    const _Game_Party_hasGlossary = Game_Party.prototype.hasGlossary;
    Game_Party.prototype.hasGlossary = function(item) {
        if (isJsonItem(item)) {
            return this.hasJsonGlossaryItem(item);
        }
        return _Game_Party_hasGlossary.apply(this, arguments);
    };

    /**
     * Hook gainGlossary — 对 JSON 条目写入独立持有记录
     */
    const _Game_Party_gainGlossary = Game_Party.prototype.gainGlossary;
    Game_Party.prototype.gainGlossary = function(item) {
        if (isJsonItem(item)) {
            if (!this._jsonGlossaryObtained) {
                this._jsonGlossaryObtained = {};
            }
            this._jsonGlossaryObtained[item.id] = true;
            return;
        }
        _Game_Party_gainGlossary.apply(this, arguments);
    };

    /**
     * Hook loseGlossary — 对 JSON 条目从独立持有记录中移除
     */
    const _Game_Party_loseGlossary = Game_Party.prototype.loseGlossary;
    Game_Party.prototype.loseGlossary = function(item) {
        if (isJsonItem(item)) {
            if (this._jsonGlossaryObtained) {
                delete this._jsonGlossaryObtained[item.id];
            }
            return;
        }
        _Game_Party_loseGlossary.apply(this, arguments);
    };

    // ============================================================================
    // Hook: SceneGlossary 的条目列表构建
    // ============================================================================

    /**
     * 将 JSON 条目注入到 glossary 主列表中
     */
    const _Game_Party_getAllGlossaryList = Game_Party.prototype.getAllGlossaryList;
    Game_Party.prototype.getAllGlossaryList = function(needTypeCheck, needHavingCheck, categoryName) {
        const list = _Game_Party_getAllGlossaryList.apply(this, arguments);
        if (!_jsonGlossaryItems) return list;

        _jsonGlossaryItems.forEach(function(item) {
            // 必须是合法的词典条目（有 SGDescription 标签）
            if (!this.isGlossaryItem(item)) return;
            // 类型过滤（如果启用）
            if (needTypeCheck && !this.isSameGlossaryType(item)) return;
            // 分类过滤（如果指定）
            if (categoryName && !this.hasGlossaryCategory(item, categoryName)) return;
            // 防止与数据库条目重复 ID
            const exists = list.some(function(ex) { return ex.id === item.id; });
            if (exists) return;
            list.push(item);
        }, this);
        return list;
    };

    /**
     * 将 JSON 条目注入到隐藏词典列表（自动注册用）
     */
    const _Game_Party_getAllHiddenGlossaryList = Game_Party.prototype.getAllHiddenGlossaryList;
    Game_Party.prototype.getAllHiddenGlossaryList = function() {
        const list = _Game_Party_getAllHiddenGlossaryList.apply(this, arguments);
        if (!_jsonGlossaryItems) return list;

        _jsonGlossaryItems.forEach(function(item) {
            if (this.isGlossaryHiddenItem(item)) {
                const exists = list.some(function(ex) { return ex.id === item.id; });
                if (exists) return;
                list.push(item);
            }
        }, this);
        return list;
    };

    // ============================================================================
    // ============================================================================
    // Hook: 条目列表颜色
    // ============================================================================

    /**
     * 修正 SceneGlossary 的 bug：getGlossaryColorIndex 在已查看条目且无
     * TextColorChange 标签时未返回实际颜色，导致 TextColorManager.textColor(undefined)。
     * 此处兜底使用插件参数 DefaultListColor。
     */
    const _Window_GlossaryList_getGlossaryColorIndex = Window_GlossaryList.prototype.getGlossaryColorIndex;
    Window_GlossaryList.prototype.getGlossaryColorIndex = function(item) {
        var index = _Window_GlossaryList_getGlossaryColorIndex.apply(this, arguments);
        if (index === undefined) {
            return Number(param.DefaultListColor) || 0;
        }
        return index;
    };

    // ============================================================================
    // 脚本接口：通过 ID 获取/丢弃 JSON 词典条目
    // ============================================================================

    /**
     * 在 _jsonGlossaryItems 中按 ID 查找虚拟物品对象
     */
    function _findJsonGlossaryItem(id) {
        if (!_jsonGlossaryItems) return null;
        for (var i = 0; i < _jsonGlossaryItems.length; i++) {
            if (_jsonGlossaryItems[i].id === id) return _jsonGlossaryItems[i];
        }
        return null;
    }

    /**
     * 通过 ID 获取单个词典条目
     * 事件脚本用法：\.gainGlossaryById(10001)
     */
    Game_Party.prototype.gainGlossaryById = function(id) {
        var item = _findJsonGlossaryItem(id);
        if (item) this.gainGlossary(item);
    };

    /**
     * 通过 ID 丢弃单个词典条目
     * 事件脚本用法：\.loseGlossaryById(10001)
     */
    Game_Party.prototype.loseGlossaryById = function(id) {
        var item = _findJsonGlossaryItem(id);
        if (item) this.loseGlossary(item);
    };

    /**
     * 通过 ID 检查条目是否已获取
     * 事件脚本用法：\.hasGlossaryById(10001)
     */
    Game_Party.prototype.hasGlossaryById = function(id) {
        if (param.AlwaysObtained) return true;
        var item = _findJsonGlossaryItem(id);
        return item ? this.hasJsonGlossaryItem(item) : false;
    };

    /**
     * 批量获取多个词典条目
     * 事件脚本用法：\.gainGlossaryByIds([10001, 10002, 10003])
     */
    Game_Party.prototype.gainGlossaryByIds = function(ids) {
        for (var i = 0; i < ids.length; i++) {
            this.gainGlossaryById(ids[i]);
        }
    };

    /**
     * 批量丢弃多个词典条目
     * 事件脚本用法：\.loseGlossaryByIds([10001, 10002, 10003])
     */
    Game_Party.prototype.loseGlossaryByIds = function(ids) {
        for (var i = 0; i < ids.length; i++) {
            this.loseGlossaryById(ids[i]);
        }
    };

    /**
     * 获取所有 JSON 词典条目总数
     * 事件脚本用法：.getJsonGlossaryCount()
     */
    Game_Party.prototype.getJsonGlossaryCount = function() {
        return _jsonGlossaryItems ? _jsonGlossaryItems.length : 0;
    };

    // 日志输出
    // ============================================================================

    console.log('SceneGlossary_JSON_Loader: 桥接插件已加载。' +
        '全局变量 = ' + param.UniqueGlobalVariable +
        ', 属性名 = ' + param.PropertyName +
        ', 始终已获取 = ' + param.AlwaysObtained);
})();






