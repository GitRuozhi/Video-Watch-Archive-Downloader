# R34 Video Watch Archive Downloader

用于 `rule34video.com` 的 Tampermonkey 油猴脚本，支持已看视频自动归档、批量采集、导出和下载视频。同步正式发布 **Iwara Video Watch Archive Downloader**，功能及用法见 [Iwara 版本介绍](Intro_Iwara_ZH.MD)。

当前源码版本：R34 和 Iwara 均为 **v5.1**。

英文说明见 [README.md](README.md)。

## 安装

请从 SleazyFork 安装：

- 英文版：https://sleazyfork.org/scripts/581996-r34-video-watch-archive-downloader
- 中文版：https://sleazyfork.org/scripts/581999-r34-video-watch-archive-downloader-zh

打开项目页后点击安装即可使用。GitHub 仓库只保留源码和发布素材，主要供开发者查看、对比和维护。

测试本地源码时，在油猴编辑器中用对应 `.user.js` 文件的内容替换现有脚本，保存并刷新网站标签页。本地改动可能尚未发布；请更新原脚本以保留它保存的队列。

## 功能

- 维护英文和中文两个 UI 脚本，功能逻辑保持一致。
- 自动记录已观看视频，支持真实页面、AJAX 页面和伪跳转页面。
- 支持搜索页、上传者页、用户页、收藏页等列表页采集。
- 解析视频直链和可用清晰度。
- 清晰度可选：最佳、8K、4K、1080p、720p、480p、360p。
- 浏览器下载模式可选择先保存元信息 JSON，再提交视频下载。
- 可导出直链 TXT、YT-DLP 命令 TXT、为每条视频保存 Referer 和 User-Agent 的 IDM EF2，以及元信息 JSONL。
- 文件名可配置 ID、标题、原文件名三部分。
- 悬浮面板显示队列中、下载中、已成功和已失败统计。

## 导入 IDM

1. 更新油猴脚本，采集视频并等待链接解析完成。
2. 打开高级选项，将下载模式设为 **IDM**，点击 **开始下载**。R34 请等待链接刷新结束并生成新的导出文件。
3. 在 IDM 中选择 **任务 → 导入 → 从 IDM 导出文件**，打开保存的 `r34video-idm-*.ef2` 或 `iwara-idm-*.ef2`。

请选择 **从 IDM 导出文件**，不要选择 **从文本文件**。每条 EF2 记录只有一个视频下载地址，作品页和浏览器 User-Agent 分别保存在请求头字段里。旧版 v4.8 的 TXT 每行包含两个网址，IDM 的文本导入会扫描所有网址，可能把作品页也加入下载队列并下载成 HTML，而没有保存对应的 Referer。请用新版重新导出旧文件。

**直链文本 / 链接 TXT** 模式仍只输出网址，不带请求头。带签名的视频链接应尽快导入；链接过期后需要重新解析并导出。EF2 不导出浏览器登录 Cookie；若服务器仍返回 HTML，请检查资源是否需要登录，以及 IDM 的浏览器集成设置。

R34 导出前会刷新没有解析时间、或解析时间已超过十分钟的缓存链接。十分钟是脚本的刷新策略，不代表服务器令牌的有效期。刷新失败时保留作品页以便重试，但不导出旧媒体地址。更新脚本会保留现有队列，请重新生成文件，不要继续使用旧 EF2/TXT。

如果网站访问需要电脑现有的系统代理，请在 IDM 中选择 **下载 → 选项 → 代理服务器 → 使用系统设置**，然后重新启动队列。浏览器能访问网站时，IDM 的直接连接仍可能卡住。

IDM 的[文本导入说明](https://www.internetdownloadmanager.com/support/import_downloads.html)介绍了网址扫描行为。[ef2 项目文档](https://github.com/MotooriKashin/ef2#readme)也提供了 EF2 格式示例；本脚本只使用标准的 Referer 和 User-Agent 字段。

## 源码文件

- `r34-video-watch-archive-downloader.user.js`：英文脚本。
- `r34-video-watch-archive-downloader.zh.user.js`：中文脚本。
- `iwara-video-watch-archive-downloader.user.js`：Iwara 英文脚本。
- `iwara-video-watch-archive-downloader.zh.user.js`：Iwara 中文脚本。
- `Intro.MD` / `Intro_ZH.MD`：SleazyFork 发布介绍文本。
- `Intro_Iwara.MD` / `Intro_Iwara_ZH.MD`：Iwara 英文及中文发布介绍。
- `Intro01_EN.png` / `Intro02_ZH.png`：发布截图。
- `Agent.md`：给编程智能体看的简短维护说明。

## 验证

运行无依赖回归测试：`node --test tests/idm-export.test.cjs tests/r34-export-refresh.test.cjs`。刷新测试使用虚构页面和模拟 GM 请求，覆盖 R34 中英文版本的旧缓存、部分失败、当前页刷新、失败重试和重复点击。需要本机 HTTP 测试资源时，运行 `node tests/manual/idm-test-server.cjs`；它会打印 `.git/idm-verification` 中的 EF2 和 manifest 路径。服务只监听 `127.0.0.1`，收到匹配的 Referer 和 User-Agent 才返回媒体。可用 `--media-file path/to/sample.mp4` 指定可播放样本，或用 `--self-test` 在没有 IDM 时验证 HTTP 和 Range 处理。

可选浏览器检查：`node tests/manual/r34-export-browser.cjs`，需要 Playwright，也可把其模块路径作为第一个参数。2026-10-07 在隔离的无头 Edge 中运行两份完整 R34 脚本，通过本地 HTML 和 GM API 模拟操作实际面板：刷新五条旧链接、导出全部六条记录；六条刷新全部失败后，点击“再来一次”成功重试。EF2 和 JSONL 均捕获为真实浏览器下载文件。这项检查验证浏览器 UI 和模拟请求，没有使用真实油猴扩展或 R34 实站。

2026-10-06 使用 IDM **6.43.12** 完成原生导入验证：四个脚本的八条受保护测试视频全部导入并下载，SHA256 与源文件一致。旧 TXT 产生了十六个候选项，其中八个是 HTML 作品页，且没有保留导出的请求头。实测还发现，记录的结束行必须带末尾 CRLF，否则 IDM 会遗漏最后一条视频；回归测试已覆盖这个要求，包括单视频导出。这些检查验证导入格式和请求头，不代表已验证真实网站的登录态或过期链接。

同日另做了 Iwara 传输检查：在 Node VM 中调用仓库的解析和导出函数处理两条公开、一般级视频，IDM 成功下载两份 Source MP4（1440p/60fps 和 1080p/60fps，总计约 430 MiB），均通过 FFmpeg 完整音视频解码。此环境需要让 IDM 使用现有系统代理。这项检查没有操作油猴浏览器面板，也未覆盖需登录或私密视频、过期链接及 Rule34Video 实站下载。

## 更新记录

### v5.1

- 修复了 IDM 相关问题：使用 EF2 保存每条视频的 Referer 和 User-Agent，补齐末尾 CRLF 以完整导入记录；R34 导出前刷新旧链接，失败时保留作品页供重试。
- 正式发布 **Iwara Video Watch Archive Downloader** 中英文版本，新增独立介绍文档。两个站点的脚本统一使用版本号 5.1。

### v4.8

- 新增使用 URL\tReferer TXT 的初版 IDM 导出模式。该格式未能可靠关联 Referer，已在 v5.1 替换。

### v4.7

- 加强安全校验。
- 新增 Iwara 初版。
- 将 Iwara 元信息中的 `scriptVersion` 与油猴脚本发布版本保持一致。

### v4.6

- 重构了下载逻辑，支持手动重试已失败任务。
- 增加了下载进度显示。
- 优化日志显示。

### v4.5

- 视频下载重试时复用已经保存成功的元信息 JSON，不再重复保存元信息文件。
- 已看视频自动下载统一改走普通队列下载器。
- 下载成功的任务立即从队列移除，失败项留在队列中。
- 自动重试增加重试次数日志，并新增“再来一次”按钮用于重试失败项。
- 顶部统计调整为队列中、下载中、已成功、已失败。
- “清除队列”改为“初始化”，只清理队列和统计数字，不修改设置。
- 视频本体下载增加按钮下方的 `GM_download.onprogress` 轻量进度框，显示百分比、紧凑大小、速度和剩余时间。
- 运行中的下载按钮改为“停止提交”，说明只停止继续提交，不取消浏览器中已提交的下载。
- 刷新页面后，原本下载中的任务标记为最终失败，避免自动重复提交。
- 下载轮次结束时增加成功、失败数量汇总日志。
- 英文和中文两个脚本版本号同步更新到 4.5。

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
