# Iwara Video Watch Archive Downloader 中文版

![R34 Video Watch Archive Downloader _ ZH](https://raw.githubusercontent.com/GitRuozhi/Video-Watch-Archive-Downloader/master/Intro02_ZH.png)

轻量插件。 Iwara 视频批量下载，观看视频自动归档下载。支持同步下载简介、Tag等作品元信息。支持浏览器直接下载、链接导出、YT-DLP下载命令导出。


## 介绍

- Iwara 视频批量下载

- 已看视频并自动进入队列。

- 2个语言，英文和中文。

- 支持搜索页、上传者页、用户页、收藏页等列表页采集。

- 支持4种下载方式，浏览器直接下载、链接导出、IDM EF2 导入、YT-DLP下载命令导出。

- 面板默认出现在视窗右下角，可以收缩为小按钮，可以鼠标拖动。

- 下载时显示进度

- 点击[采集当前页]可以将页面显示所有视频加入队列。

- 点击[采集多页]可以自动跳页，将多个页码的视频都加入队列。

- 点击[开始下载]将会以选定方式下载，使用[浏览器下载模式]时，浏览器自带下载器可能不会及时显示下载进度，完成后会一次性显示下载完成。

- 点击[再来一次]将会重置已失败项目并再次开始下载。

- 支持高级选项

- IDM ：“任务 → 导入 → 从 IDM 导出文件”导入保存的 `.ef2`，为每条视频保留 Referer 和浏览器 User-Agent。

- IDM ：注意带签名链接长时间未使用会过期；EF2 不包含登录 Cookie。

- 启用“元信息”后，会在下载视频前保存 Iwara 元信息 JSON。导出模式同时保存元信息 JSONL。可获取的元信息包括标题、简介、标签、上传者、上传日期、缩略图和文件信息。


GitHub：[Video-Watch-Archive-Downloader](https://github.com/GitRuozhi/Video-Watch-Archive-Downloader/)

## 更新日志

V5.1：

- 修复了 IDM 相关问题：EF2 为每条视频保留 Referer 和 User-Agent，补齐末尾 CRLF；R34 导出前刷新旧链接，失败时保留作品页供重试，不再输出旧地址。

- 正式发布 Iwara Video Watch Archive Downloader 。
