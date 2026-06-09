# R34Video 批量下载脚本变更整理（v3.1 → v3.4）

本文整理本轮对话中围绕 `R34Video批量下载` userscript 的问题分析、设计决策和实际落地修改。

---

## 1. 基线版本

原始脚本版本为：

```js
// @name         R34Video批量下载
// @version      3.1
// @description  批量下载、自动下载、自动跳页、保存元信息，支持YT-dlp
```

原始能力包括：

- 采集当前页视频。
- 多页采集。
- 自动解析视频直链。
- 浏览器下载。
- 导出直链文本。
- 导出 YT-DLP 命令。
- 保存元信息 JSON。
- 自动跳页。
- 已看视频自动入队。
- 基础状态持久化。

---

## 2. 初始代码审视结论

最初审视时指出的主要问题：

### 2.1 状态保存过于频繁

原脚本中多处直接调用 `persistState()`，例如：

- 每加入一个任务保存一次。
- 每个任务解析前后保存。
- 每个下载状态变化保存。
- UI 更新和日志变化间接触发状态保存。

这在批量采集、批量解析时会造成频繁 `GM_setValue()` 写入。

### 2.2 视频解析是串行的

原来的 `resolvePendingTasks()` 使用 `for...of + await`，一个视频解析完才解析下一个。  
优点是稳定，缺点是批量解析速度较慢。

### 2.3 UI 节点重复查询

`updateUi()` 中大量使用 `document.getElementById()`。  
单次开销不大，但在解析、下载、日志刷新的高频场景下属于重复工作。

### 2.4 页面解析存在重复工作

`flashvars`、`JSON-LD`、`meta`、页面 HTML 正则扫描在多个函数中重复执行。  
建议统一构造解析上下文，减少重复扫描。

### 2.5 拖拽逻辑可优化但不是核心瓶颈

曾讨论过将 `mousedown/mousemove/mouseup` 改为 Pointer Events，并限制面板不被拖出屏幕。  
该项属于交互增强，不是本轮核心落地项。

---

## 3. v3.2：性能、并行、UI 缓存和单视频自动下载

v3.2 的核心目标是优化性能和加入更细的自动下载控制。

---

### 3.1 增加 `persistState()` 防抖

新增防抖保存机制：

- 普通状态变化不再立即写入。
- 通过定时器延迟写入。
- 关键节点仍可强制落盘。

设计意图：

```text
频繁变化的队列状态 → 防抖保存
关键状态切换 / 页面卸载 → 立即保存
```

收益：

- 减少 `GM_setValue()` 写入次数。
- 降低批量解析和批量下载时的存储压力。
- 避免 UI 高频更新时连带大量持久化操作。

---

### 3.2 增加并行解析功能

新增并行解析能力：

- 默认并行数：`2`
- 最大并行数：`8`
- 用户可手动输入。
- 如果输入超过 `8`，自动改回 `8`。
- 如果输入非法，回退到默认值。

高级选项中新增类似：

```text
并行 [2]x
```

设计原则：

```text
解析并发提高速度
但并发上限限制为 8，避免过度请求站点
```

注意：  
这里的并行是“解析视频页面并提取直链”的并行，不是视频下载并行。

---

### 3.3 不加入“中断解析循环”

用户明确要求：

```text
不需要中断循环
```

因此没有加入解析过程中的主动中断检查，也没有实现 `GM_xmlhttpRequest.abort()` 取消请求。

保留行为：

- 采集停止按钮仍控制采集状态。
- 已经进入解析队列的任务不做强行中断。

---

### 3.4 增加 UI 节点缓存

新增 UI 节点缓存机制，例如：

```js
const ui = {};
```

创建面板后缓存常用节点：

- 捕获数
- 解析数
- 下载数
- 页数
- 日志区域
- 采集按钮
- 下载按钮
- 清除按钮
- 高级选项按钮
- 自动入队复选框
- 自动下载复选框
- 并行数输入框

目的：

- 减少 `updateUi()` 中重复 `getElementById()`。
- 让 UI 更新逻辑更集中。
- 降低 ID 改动时维护成本。

---

### 3.5 减少重复解析

引入解析上下文思路，把以下内容集中准备：

- 当前文档对象 `doc`
- 页面 HTML
- `flashvars`
- `JSON-LD`
- `meta`
- 基础 URL

然后传给：

- `extractQualitySources()`
- `extractMetadata()`
- 其他解析函数

设计思路：

```text
每个视频页面只做一次基础解析
后续函数复用 context
```

收益：

- 减少重复读取 `documentElement.innerHTML`。
- 减少重复解析 JSON-LD。
- 减少重复扫描 meta 标签。
- 让解析代码结构更清晰。

---

### 3.6 增加“入队自动下载”复选框

在“已看视频自动入队”之后新增复选框：

```text
入队自动下载
```

默认：

```text
不勾选
```

触发条件：

```text
已看视频自动入队启用
+
当前刚看的视频被自动入队并解析成功
+
入队自动下载启用
```

关键约束：

```text
只下载刚才已看的那个视频
不要下载队列中的其他视频
```

因此不能调用原来的：

```js
startDownloads();
```

因为 `startDownloads()` 的语义是下载整个 READY 队列。

v3.2 引入单任务自动下载入口：

```text
startSingleAutoDownload(...)
```

该入口只处理指定视频任务，不拉起整个下载队列。

---

## 4. `.js` 文件无法下载的问题

对话中出现 `.js` 文件无法下载，但 `.txt` 和其他文件正常的问题。

判断原因：

- `.js` 文件可能被浏览器、系统安全策略、下载管理器或平台文件层识别为可执行脚本。
- `.txt` 和 `.zip` 通常不会触发同样限制。

解决方式：

1. 下载 `.txt`，手动改名为 `.user.js`。
2. 下载 `.zip`，解压得到 `.user.js`。
3. 在 Tampermonkey 新建脚本后粘贴 `.txt` 内容。

此问题不是脚本逻辑问题，而是文件下载安全策略问题。

---

## 5. 子页面 / 当前页生成视频页的问题分析

用户观察到：

```text
点击视频时没有打开新标签页
而是在当前页面生成了子视频页
脚本没有捕捉到
```

进一步观察到：

```text
生成子页面时地址栏也变了
```

结论：

这是典型的：

```text
History API 伪跳转 / SPA 路由 / PJAX 导航
```

站点可能执行了类似：

```js
history.pushState({}, '', '/video/123456/title-slug/');
```

或：

```js
history.replaceState({}, '', '/video/123456/title-slug/');
```

同时通过 AJAX 加载视频详情并插入当前页面。

---

### 5.1 真实跳转与伪跳转区别

真实跳转：

```text
点击视频
→ 浏览器请求 /video/123456/
→ 整个 document 重新加载
→ userscript 重新执行 main()
```

伪跳转：

```text
点击视频
→ 网站 JS 阻止默认跳转
→ AJAX 加载视频详情
→ 插入当前页面
→ history.pushState 修改地址栏
→ document 没有重新加载
→ userscript 不会重新执行 main()
```

原脚本只在 `main()` 启动时判断当前 URL 是否是视频页，所以无法捕捉这种子页面。

---

### 5.2 讨论过的监听类型

本轮讨论过以下监听方式的区别：

| 监听方式 | 主要作用 | 局限 |
|---|---|---|
| `click` 捕获 | 记录用户点了哪个视频链接 | 不知道子页面是否加载完成 |
| `MutationObserver` | 监听 DOM 是否插入视频详情 | 单独使用容易被广告、懒加载误触发 |
| `history.pushState` hook | 捕捉 JS 修改地址栏 | 不知道 DOM 是否已经加载完成 |
| `history.replaceState` hook | 捕捉 JS 替换地址栏 | 同上 |
| `popstate` | 捕捉浏览器后退 / 前进 | `pushState()` 本身不会触发它 |
| `hashchange` | 捕捉 hash 变化 | 只适用于 hash 路由 |
| `load` / `pageshow` | 捕捉真实刷新或 bfcache 恢复 | 不适合 AJAX 子页面 |
| URL 轮询 | 兜底发现地址栏变化 | 有轻微轮询成本 |

最终结论：

```text
单一监听不够
需要统一调度
```

---

## 6. v3.3：统一页面变化监听与子页面捕捉

v3.3 的目标是解决：

```text
点击、DOM、地址栏、刷新、前进、后退变化后
等待约 1 秒
判断当前视频项是否与上一个重复
不重复则触发自动入队和自动下载
```

---

### 6.1 新增统一页面变化调度器

新增类似 `watchedPage` 的状态对象，用于记录：

- 是否已绑定监听
- DOM observer
- 延迟检查 timer
- 是否正在处理
- 是否需要补跑一次
- 最近点击的视频 URL
- 最近点击时间
- 最近观察到的地址栏
- 上一个已处理的视频 key
- 上一次处理时间

核心原则：

```text
所有监听只报告“页面可能变了”
真正入队只由统一检查函数执行
```

避免一次点击同时触发：

- click
- pushState
- DOM mutation
- URL poll

从而导致重复入队。

---

### 6.2 增加 1 秒延迟检查

新增类似配置：

```js
WATCHED_PAGE_DELAY_MS: 1000
```

任何监听源触发后，都进入统一调度：

```text
scheduleWatchedPageCheck(source)
```

约 1 秒后执行检查。

目的：

- 等待 AJAX 子页面加载完成。
- 等待播放器 DOM 插入完成。
- 等待地址栏变更完成。
- 避免半成品 DOM 被提前解析。

---

### 6.3 监听范围

v3.3 覆盖以下场景：

```text
click        用户点击视频链接
DOM          子页面 / 弹窗 / 播放器插入
pushState    地址栏被 JS 改成视频页
replaceState 地址栏被 JS 替换
popstate     浏览器后退 / 前进
hashchange   hash 地址变化
load         刷新 / 真实加载完成
pageshow     bfcache 恢复
url-poll     兜底检测地址栏变化
```

---

### 6.4 当前视频项识别

检测当前视频 URL 时，优先级大致为：

1. 当前 `location.href` 已经是 `/video/数字/`。
2. 最近点击过视频链接，并且页面出现视频信号。
3. `canonical` 指向视频页，并且页面出现视频信号。
4. popup / modal / player 容器中存在视频链接。

设计原则：

```text
地址栏变化可以作为重要信号
但不要只依赖地址栏
也不要只依赖 video 标签
```

---

### 6.5 去重逻辑

为当前视频生成 key：

```text
优先使用 video id
否则使用 normalized URL
```

如果当前 key 与上一个已处理 key 相同，则不重复入队。

这样可以避免一次页面变化被多个监听源反复触发。

---

### 6.6 自动下载仍然只下载当前视频

v3.3 继续保持 v3.2 的原则：

```text
自动入队后，如果启用入队自动下载
只下载当前刚识别的视频
不下载整个队列
```

因此仍使用单任务下载入口，而不是 `startDownloads()`。

---

## 7. 下载进度问题的讨论

用户提到：

```text
网页下载没有显示进度条
只在下载完了跳出来一下
不知道有没有下载
```

分析结论：

原下载逻辑主要依赖 `GM_download()`，通常只有：

- `onload`
- `onerror`
- `ontimeout`

不一定能稳定提供实时进度。

讨论过两种方案：

### 7.1 使用 `GM_download.onprogress`

改动小，但不同 userscript 管理器 / 浏览器环境支持不稳定。

### 7.2 使用 `GM_xmlhttpRequest + Blob`

可以稳定拿到进度，但缺点是大视频会先进入内存再保存，内存压力较大。

本轮最终没有把下载进度条作为主要落地功能。  
该项属于后续可选增强。

---

## 8. 元信息 JSON 偶尔丢失的问题

用户反馈：

```text
有的时候本体视频下载下来了，但是 json 没有
```

原因分析：

原逻辑是：

```text
视频本体：GM_download
元信息 JSON：网页 <a download> 模拟点击
```

即两者下载机制不同。

JSON 丢失的可能原因：

- 浏览器拦截连续自动下载。
- `<a download>` 没有可靠成功 / 失败回调。
- 多个 JSON 文件短时间连续触发下载。
- 文件名或下载策略被浏览器限制。
- 脚本无法确认 JSON 是否真正保存成功。

结论：

```text
JSON 应该也改用 GM_download
并且需要有成功 / 失败回调
```

---

## 9. v3.4：元信息优先下载 + 跨标签页设置同步

v3.4 的两个明确需求：

1. 视频元信息 JSON 也用 `GM_download`，并且先下载 JSON，再下载视频本体。
2. 使用 `GM_addValueChangeListener` 同步跨标签页设置，但不要用它同步队列。

---

### 9.1 元信息 JSON 改用 `GM_download`

v3.4 不再用网页 `<a download>` 保存元信息 JSON。

改为：

```text
.meta.json → GM_download
视频本体 → GM_download
```

---

### 9.2 下载顺序改为“元信息优先”

下载顺序改为：

```text
先下载 .meta.json
↓
JSON 下载成功
↓
再下载视频本体
```

如果 JSON 下载失败：

```text
不继续下载视频本体
记录 Meta download failed
任务进入失败状态或记录错误
```

设计目的：

- 避免视频已经下载但 JSON 丢失。
- 让元信息保存成功变成视频下载的前置条件。
- 让失败有明确日志，而不是静默丢失。

---

### 9.3 设置和队列拆分

v3.4 引入设置专用存储：

```js
const SETTINGS_KEY = 'r34v_bulk_downloader_settings_v3';
```

原有队列状态仍使用：

```js
const STORE_KEY = 'r34v_bulk_downloader_state_v2';
```

两者分工：

| 存储 | 内容 | 保存方式 | 是否跨标签页监听 |
|---|---|---|---|
| `SETTINGS_KEY` | 用户设置 | 立即保存 | 是 |
| `STORE_KEY` | 队列、任务、日志、采集状态 | 防抖保存 | 否 |

---

### 9.4 为什么设置要立即保存

设置包括：

- 已看视频自动入队
- 入队自动下载
- 并行数
- 最大页数
- 清晰度
- 下载方式
- 文件名选项
- 高级选项展开状态

这些属于低频、明确的用户操作。

规则：

```text
设置项不走防抖
复选框一变就立即 GM_setValue
```

解决的问题：

```text
旧标签页刚勾选自动下载
新标签页马上打开
新标签页能读到最新设置
```

---

### 9.5 使用 `GM_addValueChangeListener` 同步设置

v3.4 新增授权：

```js
// @grant GM_addValueChangeListener
```

它只监听 `SETTINGS_KEY`。

作用：

```text
A 标签页改设置
B 标签页不刷新也能同步复选框和设置
```

同步内容：

- 自动入队
- 入队自动下载
- 并行数
- 最大页数
- 清晰度
- 下载方式
- 文件名选项
- 高级选项展开状态

---

### 9.6 不使用 GM 同步队列

明确不使用 `GM_addValueChangeListener` 同步队列。

原因：

队列是复杂高频状态，包含：

- `tasks`
- `seen`
- `stats`
- `logLines`
- `collection`
- 下载中状态
- 解析中状态
- 成功 / 失败状态
- active downloads

队列存在状态流转：

```text
pending → fetching → ready → downloading → done / failed
```

如果跨标签页实时同步队列，容易出现旧页面覆盖新页面状态的问题。

例如：

```text
A 页把 task1 标记为 done
B 页内存里的 task1 还是 ready
B 页稍后保存队列
task1 又被覆盖回 ready
```

最终设计：

```text
设置：跨标签页同步
队列：不跨标签页实时同步
```

---

## 10. 防抖与 GM 同步的最终分工

本轮明确了防抖和 GM 同步并不冲突，但必须分工。

### 10.1 设置不防抖

```text
SETTINGS_KEY
立即 GM_setValue
GM_addValueChangeListener 同步
```

适用数据：

- 复选框
- 并行数
- 清晰度
- 下载方式
- 文件名选项

### 10.2 队列继续防抖

```text
STORE_KEY
防抖 GM_setValue
不做 GM_addValueChangeListener 实时同步
```

适用数据：

- 任务队列
- 日志
- 状态统计
- 采集状态
- 下载状态

---

## 11. 各版本变更汇总

| 版本 | 主要目标 | 核心改动 |
|---|---|---|
| v3.1 | 原始版本 | 批量采集、解析、下载、导出、保存元信息 |
| v3.2 | 性能与自动下载 | 防抖保存、并行解析、UI 缓存、解析缓存、入队自动下载 |
| v3.3 | 子页面监听 | click / DOM / 地址栏 / 前进后退 / 刷新监听，1 秒延迟检查，去重入队 |
| v3.4 | 下载可靠性与设置同步 | 元信息 JSON 用 GM_download 且先于视频下载；GM 同步设置但不同步队列 |

---

## 12. 最终架构概览

最终建议架构如下：

```text
启动 main()
├── restoreState()
│   └── 恢复队列、日志、采集状态
│
├── loadSettingsNow()
│   └── 从 SETTINGS_KEY 读取最新设置
│
├── createPanel()
├── cacheUi()
├── applySettingsToUi()
├── bindSettings()
├── bindSettingsSync()
│   └── GM_addValueChangeListener 同步跨标签页设置
│
├── bindWatchedPageListeners()
│   ├── click
│   ├── MutationObserver
│   ├── pushState / replaceState
│   ├── popstate
│   ├── hashchange
│   ├── load / pageshow
│   └── URL poll
│
└── 如果当前是视频页
    └── scheduleWatchedPageCheck()
```

自动入队流程：

```text
页面变化
↓
scheduleWatchedPageCheck()
↓
等待约 1 秒
↓
detectCurrentWatchedPostUrl()
↓
生成 watched item key
↓
与上一次处理项比较
↓
不重复则 queueWatchedVideo()
↓
resolvePendingTasks()
↓
如果启用入队自动下载
只下载当前视频
```

下载流程：

```text
开始下载指定 task
↓
先 GM_download 保存 .meta.json
↓
meta 成功
↓
再 GM_download 保存视频本体
↓
视频成功
↓
任务标记 done
```

设置同步流程：

```text
A 标签页修改设置
↓
saveSettingsNow()
↓
GM_setValue(SETTINGS_KEY)
↓
B 标签页 GM_addValueChangeListener 收到 remote change
↓
B 标签页更新 state.settings
↓
B 标签页 applySettingsToUi()
```

---

## 13. 保留或未落地的讨论项

以下内容在对话中讨论过，但未作为 v3.2-v3.4 核心落地项：

### 13.1 拖拽改 Pointer Events

讨论过优势：

- 支持鼠标、触摸、手写笔。
- 可使用 `setPointerCapture()`。
- 可限制面板不拖出视口。

但该项不是核心问题，未作为主要版本目标。

### 13.2 下载进度条

讨论过：

- `GM_download.onprogress`
- `GM_xmlhttpRequest + Blob`

但因兼容性和大文件内存占用问题，本轮未作为核心落地功能。

### 13.3 队列跨标签页统一管理

讨论过但不建议当前实现。

如果未来要做，需要“单主标签页”机制：

```text
只有一个标签页负责下载和队列状态
其他标签页只发送入队请求
```

本轮明确不使用 `GM_addValueChangeListener` 同步队列。

---

## 14. 当前行为摘要

当前 v3.4 预期行为：

- 勾选设置后，其他已打开标签页会同步设置。
- 新标签页打开时会读取最新设置。
- 自动入队可以识别真实视频页、子页面、pushState 伪跳转、前进后退。
- 页面变化后等待约 1 秒再判断。
- 同一个视频项不会被重复自动入队。
- 入队自动下载只下载当前刚识别的视频。
- 队列中的其他视频不会因为自动下载被一起下载。
- 元信息 JSON 使用 `GM_download`。
- 下载顺序是先 JSON 后视频。
- 队列状态不做跨标签页实时同步。
- 任务、日志、队列仍使用防抖保存。

---

## 15. 注意事项

1. `.js` 文件可能被浏览器或平台下载策略拦截。  
   可使用 `.txt` 改名或 `.zip` 解压。

2. `GM_addValueChangeListener` 主要依赖 userscript 管理器支持。  
   Tampermonkey 通常支持。

3. `GM_download` 的实际下载行为仍受浏览器和 userscript 管理器限制。

4. 自动下载功能应只用于你有权保存的内容，不应用于绕过访问控制、付费墙或版权限制。

5. 队列不同步是设计选择，不是遗漏。  
   目的是避免多个标签页互相覆盖任务状态。

---

## 16. 后续可选增强

如果继续推进，可考虑：

- 增加下载进度显示。
- 增加“元信息下载失败是否仍下载视频”的设置。
- 增加单主标签页队列管理。
- 增加任务导入 / 导出。
- 增加失败任务重试面板。
- 增加拖拽位置持久化。
- 增加 Pointer Events 拖拽。
- 增加下载完成通知。
- 增加每页独立队列与全局队列切换。
