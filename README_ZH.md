# R34 Video Watch Archive Downloader

用于 `rule34video.com` 的 Tampermonkey 油猴脚本，支持已看视频自动归档、批量采集、导出和下载视频。

当前版本：**v4.4**。

英文说明见 [README.md](README.md)。

## 安装

请从 SleazyFork 安装：

- 英文版：https://sleazyfork.org/scripts/581996-r34-video-watch-archive-downloader
- 中文版：https://sleazyfork.org/scripts/581999-r34-video-watch-archive-downloader-zh

打开项目页后点击安装即可使用。GitHub 仓库只保留源码和发布素材，主要供开发者查看、对比和维护。

## 功能

- 维护英文和中文两个 UI 脚本，功能逻辑保持一致。
- 自动记录已观看视频，支持真实页面、AJAX 页面和伪跳转页面。
- 支持搜索页、上传者页、用户页、收藏页等列表页采集。
- 解析视频直链和可用清晰度。
- 清晰度可选：最佳、8K、4K、1080p、720p、480p、360p。
- 浏览器下载模式可选择先保存元信息 JSON，再提交视频下载。
- 可导出直链 TXT、YT-DLP 命令 TXT 和元信息 JSONL。
- 文件名可配置 ID、标题、原文件名三部分。
- 悬浮面板显示队列、解析、提交和下载统计。

## 源码文件

- `r34-video-watch-archive-downloader.user.js`：英文脚本。
- `r34-video-watch-archive-downloader.zh.user.js`：中文脚本。
- `Introduction_R34 Video Watch Archive Downloader.txt`：SleazyFork 发布介绍文本。
- `It01_EN.png` / `It02_ZH.png`：发布截图。
- `Agent.md`：给编程智能体看的简短维护说明。

## 更新记录

### v4.4

- 在高级选项中新增默认开启的“下载作品元信息”复选框。
- 浏览器下载模式可关闭元信息 JSON 下载，只下载视频本体。
- 关闭元信息下载时，视频下载完成即计为任务完成。
- 英文和中文两个脚本版本号同步更新到 4.4。

### v4.3

- 改进英文版紧凑采集按钮文案。
- 将两个脚本的一次性采集页数输入上限同步限制为 64。
- 清理未使用函数、无效自动下载分支和冗余持久化统计值。
- 将 `Agent.md` 替换为简练的维护说明，供编程智能体阅读。
