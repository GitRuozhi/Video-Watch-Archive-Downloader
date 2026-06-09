# R34Video 批量下载脚本交接摘要

本文用于下一个 Agent 快速接手。不要把它当作完整变更日志；这里只保留关键版本更新、设计决策和当前注意点。

---

## 当前最新版本

**最新输出版本：v3.8**

文件名：

```text
R34Video批量下载_v3.8_href与data参数页码读取.user.js
R34Video批量下载_v3.8_href与data参数页码读取.txt
R34Video批量下载_v3.8_href与data参数页码读取_js打包.zip
```

v3.8 基于用户上传的 **v3.6** 后续推进，并吸收 v3.7 页数显示逻辑。

---

## 版本更新线

### v3.1：原始版本

原始能力：

- 批量采集视频。
- 自动跳页。
- 解析视频直链。
- 浏览器下载。
- 导出直链文本。
- 导出 YT-DLP 命令。
- 保存元信息 JSON。
- 已看视频自动入队。

---

### v3.2：性能和自动下载增强

核心改动：

- `persistState()` 增加防抖，减少频繁 `GM_setValue()`。
- 增加并行解析：
  - 默认 `2x`
  - 最大 `8x`
  - 超过 8 自动改为 8
- 高级选项增加“并行”输入。
- 增加 UI 节点缓存，减少重复 `getElementById()`。
- 减少重复解析：
  - `flashvars`
  - `JSON-LD`
  - `meta`
  - 页面 HTML
- 在“已看视频自动入队”后增加：
  - `入队自动下载`
  - 默认不勾选
- 自动下载只下载刚刚自动入队的当前视频，不下载整个队列。

未做：

- 用户明确要求不需要中断解析循环，所以没有加入中断逻辑。

---

### v3.3：子页面 / 伪跳转监听

解决问题：

- R34Video 点击视频时不一定真实跳转。
- 可能是 AJAX 子页面 + `history.pushState()`。
- userscript 不会重新执行 `main()`，导致自动入队失效。

新增监听：

- `click` 捕获：记录用户点了哪个视频。
- `MutationObserver`：监听子视频页 / 弹窗 / 播放器 DOM。
- `history.pushState` hook。
- `history.replaceState` hook。
- `popstate`：前进 / 后退。
- `hashchange`。
- `load` / `pageshow`。
- URL 轮询兜底。

核心设计：

```text
所有监听只上报“页面可能变了”
统一等待约 1 秒
再判断当前视频项
避免重复触发
```

新增逻辑：

- `scheduleWatchedPageCheck()`
- `runWatchedPageCheck()`
- `detectCurrentWatchedPostUrl()`
- `queueWatchedVideo()`

---

### v3.4：元信息优先下载 + 设置跨标签页同步

核心改动：

- 元信息 `.meta.json` 也改用 `GM_download`。
- 下载顺序改为：

```text
先下载 .meta.json
再下载视频本体
```

- 如果元信息下载失败，不继续下载视频本体。
- 增加 `GM_addValueChangeListener`。
- 使用独立设置存储：

```js
const SETTINGS_KEY = 'r34v_bulk_downloader_settings_v3';
```

设计分工：

```text
SETTINGS_KEY：同步设置，立即保存
STORE_KEY：保存队列、日志、任务状态，防抖保存，不跨标签页实时同步
```

同步的设置包括：

- 自动入队
- 入队自动下载
- 并行数
- 最大页数
- 清晰度
- 下载方式
- 文件名选项
- 高级选项展开状态

明确不做：

- 不用 `GM_addValueChangeListener` 同步队列。
- 原因：队列状态高频且复杂，多标签页同步容易互相覆盖。

---

### v3.5：循环采集、提交统计、按钮统一

核心改动：

- 采集多页到最后一页时：
  - 自动跳回第一页。
  - 检查采集项是否重复。
  - 如果有重复，停止采集。
  - 如果没有重复，继续采集。
- 顶部统计改为：

```text
已捕获　已解析　已提交　已下载
```

含义：

- `已提交`：视频本体已提交给 `GM_download`。
- `已下载`：元信息 JSON 和视频本体都完成回调。

新增下载状态字段：

```js
metaDownloadDone
videoDownloadSubmitted
videoDownloadDone
metaDownloadedAt
videoSubmittedAt
videoDownloadedAt
```

按钮样式：

- 面板按钮统一为 `r34v-panel-button`。
- 清除队列、采集当前页、采集多页、开始下载、高级选项样式统一。

---

### v3.6：用户上传的当前基础版本

用户后续上传了 `R34Video批量下载-3.6.txt`。

v3.6 描述为：

```text
批量下载、自动下载、自动跳页、保存元信息，支持YT-dlp，并行解析，监听子页面，跨标签页同步设置，循环采集与下载统计
```

后续 v3.7、v3.8 都是在用户上传的 v3.6 基础上处理页数显示和分页识别问题。

---

### v3.7：高级选项显示已采集 x/y 页

用户需求：

```text
读取当前页面有多少页
显示在高级选项第一行：已采集 x/y 页
x 默认 0
采集完 1 页 +1
y 是当前页面读取到的页数
```

实现内容：

- 高级选项第一行改为：

```text
已采集 0/0 页
```

- 新增统计字段：

```js
pagesCollected
totalPages
```

- 开始采集多页时：
  - `pagesCollected = 0`
  - 从当前页面读取 `totalPages`
- 每成功采集一页：
  - `pagesCollected += 1`

问题：

- 最初页数读取主要依赖可见数字页码。
- 遇到 `01-09 … Last` 时，只读可见页码会误判为 9。
- 遇到会员页 `/members/353340/#videos` 时，不能把 `353340` 当作页码。

---

### v3.8：从 href 和 data-parameters 读取页码

解决问题：

不同页面分页结构不同。

#### 普通列表页

例如：

```text
https://rule34video.com/latest-updates/8472/
```

这里尾部 `8472` 是页码，可以从 `href` 读取。

#### 会员页 / AJAX 分页页

例如用户上传的 Rudy/Rydi 页面：

```text
https://rule34video.com/members/353340/#videos
```

这里 `353340` 是会员 ID，不是页码。

真正页码在分页按钮的：

```html
data-parameters="sort_by:;from_videos:18"
```

因此 v3.8 增加：

```js
pageNumberFromDataParameters()
pageNumberFromHref()
paginationRoots()
isNonPaginationProfileUrl()
looksLikeSamePaginationBase()
stripTrailingPageNumber()
```

支持读取：

```text
from_videos:18
from_albums:18
from:18
page:18
p:18
?page=8472
?p=8472
/ page /8472/
/p/8472/
/latest-updates/8472/
```

防止误判：

```text
/members/353340/#videos 不当作第 353340 页
/users/数字/
/profile/数字/
#videos
#albums
#favorites
#favourites
#comments
#playlists
#channels
```

当前页读取也增强：

- active 分页项可从 `data-parameters` 读取当前页。
- 其次从 `href` 读取。
- 最后从文本数字读取。

---

## 当前关键设计决策

### 1. 设置跨标签页同步，队列不同步

保留这个设计。

```text
设置：GM_addValueChangeListener 同步
队列：不实时同步
```

原因：

- 设置低频、简单，“最后写入者有效”。
- 队列高频、复杂，跨标签页同步容易互相覆盖任务状态。

---

### 2. 自动下载只下载当前自动入队的视频

不要调用 `startDownloads()` 来做入队自动下载。

应该继续使用单任务下载入口。

原因：

```text
startDownloads() 会下载整个 READY 队列
入队自动下载只应该下载刚刚看的那个视频
```

---

### 3. 页数读取不要盲目取 URL 最后数字

必须区分：

```text
/latest-updates/8472/       → 8472 是页码
/members/353340/#videos     → 353340 是会员 ID
```

会员页优先读：

```text
data-parameters="...from_videos:18"
```

---

### 4. 已下载计数必须严格

当前约定：

```text
metaDownloadDone && videoDownloadDone
```

两者都为 true，才算已下载。

仅视频提交给 GM 下载，不能算已下载。

---

## 当前已知限制 / 后续可选增强

### 1. GM 下载进度

讨论过，但未作为核心版本落地。

原因：

- `GM_download.onprogress` 支持不稳定。
- `GM_xmlhttpRequest + Blob` 可显示进度，但大文件会占内存。

可选方案：

- 在脚本内部维护“GM 任务表”。
- 显示 meta / video 当前 submitted、done、failed 状态。
- 不要试图读取 Tampermonkey 全局下载队列；没有标准 API。

---

### 2. 真正跨标签页队列

当前不做。

如果未来要做，需要“单主标签页”架构：

```text
一个主标签页负责队列和下载
其他标签页只发送入队请求
```

不要简单用 `GM_addValueChangeListener` 同步整个队列。

---

### 3. 拖拽逻辑

曾讨论过将鼠标事件改成 Pointer Events，但未落地。

可选增强：

- 支持触摸 / 手写笔。
- 限制面板不被拖出屏幕。
- 持久化面板位置。

---

## 下一个 Agent 接手建议

优先检查这些函数：

```js
readTotalPages()
paginationPageNumbers()
pageNumberFromDataParameters()
pageNumberFromHref()
currentPageNumber()
findNextPageLink()
findFirstPageLink()
collectCurrentThenAdvance()
collectCurrentPageVideos()
getParseStats()
downloadTask()
downloadMetaForTask()
downloadVideoForTask()
bindSettingsSync()
```

如果用户继续反馈页数不准，优先检查：

1. 分页区域是否在 `.pagination` / `[id*="pagination"]` 内。
2. Last 按钮是否有 `data-parameters`。
3. Last 按钮是否有 `href`。
4. 当前页 active 项是否有 `data-parameters`。
5. URL 是否被误判成资料页 ID。

如果用户反馈下载计数不准，优先检查：

1. `metaDownloadDone`
2. `videoDownloadSubmitted`
3. `videoDownloadDone`
4. `finishDownload()`
5. `getParseStats()`
