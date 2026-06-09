# R34Video 观看归档下载+自动批量下载

用于 `rule34video.com` 的 Tampermonkey 油猴脚本，支持自动记录已看视频、批量采集、导出和下载视频。

当前版本：**v4.1**。

英文主说明见 [README.md](README.md)。

## 安装

1. 安装 Tampermonkey 或其他用户脚本管理器。
2. 打开英文主脚本 `r34video-watch-archive-downloader.user.js`，或中文脚本 `r34video-watch-archive-downloader.zh.user.js`。
3. 新建用户脚本并粘贴文件内容，或通过 GitHub raw 地址安装。
4. 打开支持的 `rule34video.com` 页面使用。

## 功能

- 维护英文主版本和中文版本，英文版界面不含中文。
- 支持搜索页、上传者页、用户页、收藏页等列表页采集。
- 支持真实翻页后的持久续跑。
- 支持 AJAX / 伪跳转视频页监听，并自动入队已点开的视频。
- 支持已看视频入队后自动下载。
- 解析视频直链和可用清晰度。
- 清晰度可选：最佳、8K、4K、1080p、720p、480p、360p。
- 浏览器下载模式会先保存元信息 JSON，再提交视频下载。
- 可导出直链 TXT 和元信息 JSONL。
- 可导出 YT-DLP 命令 TXT 和元信息 JSONL。
- 文件名可配置 ID、标题、原文件名三部分。
- 悬浮面板显示队列、解析、提交和下载统计。

## 注意

- 浏览器下载由 `GM_download` 处理。停止下载队列只能阻止继续提交新任务，已经提交给浏览器或脚本管理器的下载可能仍会继续。
- `Old/`、`Reference/`、`Test/` 是本地资料目录，不上传到 GitHub。
- 根目录 `Agent.md` 是给智能体看的项目说明，`README.md` 是给人类看的说明。

## 脚本文件

英文主版本：

```text
r34video-watch-archive-downloader.user.js
```

中文版本：

```text
r34video-watch-archive-downloader.zh.user.js
```
