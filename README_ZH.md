# Video Watch Archive Downloader

[English](README.md)

本项目提供两个独立的 Tampermonkey 油猴脚本系列。R34 支持 `rule34video.com` 和 `rule34gen.com`；Iwara 支持 `iwara.tv` 和 `iwara.ai`。两个系列目前均为 **5.1**，提供英文和中文脚本。

| 系列 | 支持站点 | English | 中文 |
| --- | --- | --- | --- |
| R34 | `rule34video.com`、`rule34gen.com` | [Install](https://sleazyfork.org/zh-CN/scripts/581996-r34-video-watch-archive-downloader) | [安装](https://sleazyfork.org/zh-CN/scripts/581999-r34-video-watch-archive-downloader-zh) |
| Iwara | `iwara.tv`、`iwara.ai` | [Install](https://sleazyfork.org/zh-CN/scripts/599005-iwara-video-watch-archive-downloader) | [安装](https://sleazyfork.org/zh-CN/scripts/599006-iwara-video-watch-archive-downloader-zh) |

详细功能请见 [R34 英文介绍](Intro.MD)、[R34 中文介绍](Intro_ZH.MD)、[Iwara 英文介绍](Intro_Iwara.MD) 和 [Iwara 中文介绍](Intro_Iwara_ZH.MD)。

## 安装

先安装 Tampermonkey 浏览器扩展，再从上表选择对应站点和语言的脚本。同一系列安装一种语言即可；同时使用 R34 和 Iwara 时，分别安装这两个脚本。

## 功能

两个系列都支持已看视频自动进入队列、采集当前页或多个列表页，并可使用浏览器下载或导出链接、IDM EF2、YT-DLP 命令和元信息 JSONL。悬浮面板显示队列与下载进度，并可重试失败任务。

清晰度选项因系列而异：

- R34：最佳、8K、4K、1080p、720p、480p 和 360p。
- Iwara：最佳、Source、540、360 和 preview。

## 使用

安装对应站点和语言的脚本。在支持的网站上，点击**采集当前页**或**采集多页**加入视频，选择下载方式后点击**开始下载**。点击**再来一次**可重试失败项目；点击**初始化**会清空队列和统计数据，不修改设置。

## IDM EF2

选择 **IDM** 模式并点击**开始下载**，保存 `.ef2` 文件。在 IDM 中选择**任务 → 导入 → 从 IDM 导出文件**。每条视频记录都包含作品页 Referer 和浏览器 User-Agent。EF2 不包含浏览器登录 Cookie。签名视频链接可能过期，请及时导入。R34 导出前会刷新较旧或未解析的链接，刷新失败的链接不会写入导出文件。

## 5.1 版本更新

- 修复 IDM EF2 记录，保留 Referer 和 User-Agent，并补齐末尾 CRLF。
- R34 脚本新增 `rule34gen.com` 支持，Iwara 脚本新增 `iwara.ai` 支持。
- 正式发布 Iwara 英文和中文脚本。

## 测试

运行回归测试：`node --test tests/idm-export.test.cjs tests/r34-export-refresh.test.cjs`。

## 源码文件

- R34：[English](r34-video-watch-archive-downloader.user.js) / [中文](r34-video-watch-archive-downloader.zh.user.js)
- Iwara：[English](iwara-video-watch-archive-downloader.user.js) / [中文](iwara-video-watch-archive-downloader.zh.user.js)

## 界面截图

| R34 | Iwara |
| --- | --- |
| ![R34 下载面板](https://raw.githubusercontent.com/GitRuozhi/Video-Watch-Archive-Downloader/master/Intro02_ZH.png) | ![Iwara 下载面板](https://raw.githubusercontent.com/GitRuozhi/Video-Watch-Archive-Downloader/master/Intro_Iwara02.png) |

Iwara 截图中的视频画面、标题、账户头像及作品链接已模糊处理，两张截图均展示中文脚本面板。

GitHub：[Video-Watch-Archive-Downloader](https://github.com/GitRuozhi/Video-Watch-Archive-Downloader/)
