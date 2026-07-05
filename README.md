# MZPluginHelper

一些自用的方便写长文本+备注标签的工具，适用于游戏文本量大，被默认编辑器制约了创作体验和效率的开发者

只是提升创作效率，不会对游戏文件进行直接修改。

本来只想写一两个，但因为越来越多所以就整合到一个仓库内了……

基本上都是看一眼就会的东西，所以不过多教学了。

## 介绍

**[PluginDescEditor](https://github.com/azkoree/MZPluginHelper/tree/main/PluginDescEditor)**

可以导入并手动替换插件帮助和参数，主要为执着于手工翻译插件的人提供。另外本工具不会直接对插件本身进行修改。

**[Notehelper](https://github.com/azkoree/MZPluginHelper/tree/main/Notehelper)**

便利化输入备注文本的编辑器，可以导入并识别插件帮助中的标签，点击插入

**[GlossaryEditor](https://github.com/azkoree/MZPluginHelper/tree/main/GlossaryEditor)**

为[SceneGlossary.js](https://github.com/triacontane/RPGMakerMV/tree/mz_master/SceneGlossary.js)提供了导入外部json的支持，并可以可视化编辑词典json文件。使用前**先下载json文件夹里的两个文件**，一个是必须的addon插件，一个是json文件示例，具体用法请看插件说明

**[ItemInfoEditor](https://github.com/azkoree/MZPluginHelper/tree/main/ItemInfoEditor)**

编辑GF_3_ItemInfoWindow格式的道具描述信息。这是付费插件

[购买链接](https://ifdian.net/item/2503fca611c311efbfb652540025c377)

**[Text2FrameEditor](https://github.com/azkoree/MZPluginHelper/tree/main/Text2FrameEditor)**

[Text2Frame](https://github.com/yktsr/Text2Frame-MV)插件格式的文本编辑器，可以将txt转换为事件命令，具体用法请务必看原插件的readme！（可以直接在本文件夹下插件本体）

**[DBManager](https://github.com/azkoree/MZPluginHelper/tree/main/DBManager)**

丐中丐的数据库编辑器，类似官方工具导出的表格形式。请谨慎使用，以免出现无法预料的后果。。

**[DatabaseNoter](https://github.com/azkoree/MZPluginHelper/tree/main/DatabaseNoter)**

只改备注的编辑器，两个框里的备注在导出时会合到一起，如果使用备注来设定属性，可以试一试

**[StoryPlanner](https://github.com/azkoree/MZPluginHelper/tree/main/StoryPlanner)**

做得跟mz事件编辑器差不多的演出规划工具，我也不知道有什么用，大概只是好玩。。

## 本地使用

直接把想用的工具文件夹下载下来，然后运行index.html就行。至于为什么不打包，因为我不会。。。
