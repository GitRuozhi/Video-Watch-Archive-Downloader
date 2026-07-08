// ==UserScript==
// @name         Iwara Video Watch Archive Downloader _ ZH
// @namespace    https://github.com/GitRuozhi
// @license      MIT
// @version      4.7
// @description  Iwara 视频批量下载，观看视频自动归档下载。支持同步下载简介、Tag等作品元信息。支持浏览器直接下载、链接导出、YT-DLP下载命令导出。
// @author       GitRuozhi
// @match        https://www.iwara.tv/*
// @match        https://iwara.tv/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @connect      iwara.tv
// @connect      www.iwara.tv
// @connect      api.iwara.tv
// @connect      apiq.iwara.tv
// @connect      files.iwara.tv
// @connect      filesq.iwara.tv
// @connect      i.iwara.tv
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const TEXT = {
  "description": "Iwara 视频批量下载，观看视频自动归档下载。支持 Iwara 元信息 JSON、浏览器直接下载、链接导出和 YT-DLP 命令导出。",
  "queueTitle": "已解析出视频链接的队列项目",
  "activeTitle": "当前页面正在提交的下载",
  "successTitle": "本次初始化后成功下载总数",
  "failedTitle": "本次初始化后最终失败总数",
  "queue": "队列",
  "active": "下载中",
  "success": "成功",
  "failed": "失败",
  "toggleTitle": "展开或收起面板",
  "init": "初始化",
  "initTitle": "清空队列、页数、日志和计数，不修改设置",
  "current": "当前页",
  "currentTitle": "采集当前页面视频",
  "multi": "多页采集",
  "multiTitle": "跨多个列表页采集视频",
  "pagesButton": "采集多页",
  "start": "开始下载",
  "startTitle": "开始提交队列；运行时只停止继续提交，不取消浏览器已接收的下载",
  "stop": "停止",
  "stopCollect": "停止采集",
  "stopSend": "停止提交",
  "stopSendTitle": "停止提交新下载；浏览器中已经开始的下载可能继续",
  "again": "再来一次",
  "againTitle": "重置失败项目并重新开始队列",
  "more": "高级",
  "moreTitle": "显示或隐藏高级选项",
  "collected": "已采集",
  "pages": "页",
  "autoQueue": "自动入队",
  "autoQueueTitle": "自动将已观看视频加入队列",
  "autoDL": "自动下载",
  "autoDLTitle": "入队后自动开始下载",
  "meta": "元信息",
  "metaTitle": "下载视频前保存 Iwara 元信息 JSON",
  "threads": "线程",
  "threadsTitle": "解析视频信息的并发数",
  "pagesLimit": "页数",
  "pagesLimitTitle": "一次最多采集页数",
  "mode": "模式",
  "modeTitle": "下载或导出方式",
  "browser": "浏览器",
  "linksTxt": "链接 TXT",
  "ytdlp": "YT-DLP",
  "quality": "质量",
  "qualityTitle": "首选 Iwara 质量",
  "filename": "文件名：",
  "id": "ID",
  "idTitle": "文件名包含视频 ID",
  "title": "标题",
  "titleTitle": "文件名包含标题",
  "original": "原名",
  "originalTitle": "文件名包含原始文件名",
  "loaded": "Iwara 下载助手已加载。",
  "settingsSynced": "设置已从其他标签同步。",
  "pageCollected": "当前页采集完成。",
  "collectNoVideos": "当前页面没有找到 Iwara 视频链接。",
  "collectAdded": "本页采集视频数：",
  "collectStoppedDuplicate": "回到第一页后发现重复项目：",
  "collectStopped": "采集已停止。",
  "collectionFinished": "采集完成。",
  "collectNextFailed": "跳转下一页失败。",
  "restoredCollection": "页面变化后恢复多页采集。",
  "autoQueued": "已自动加入观看视频",
  "autoCheckFailed": "自动入队检查失败：",
  "resolveStart": "开始解析队列项目：",
  "resolving": "正在解析 ",
  "resolveDone": "解析完成：",
  "qualityCount": " 个质量",
  "resolveFailed": "解析失败：",
  "noDirectUrl": "没有找到可下载的 Iwara 视频源",
  "externalVideo": "外部视频不能直接下载",
  "qualityFallback": "质量降级：",
  "apiFallbackFailed": "Iwara API 补充解析失败：",
  "fileUrlFailed": "Iwara fileUrl 解析失败：",
  "downloadStarted": "浏览器下载队列已开始。",
  "downloadStopped": "已停止继续提交。浏览器中已开始的下载可能继续。",
  "noFailed": "没有可重试的失败项目。",
  "retrying": "重试失败项目：",
  "metadataFirst": "先保存元信息：",
  "metadataDone": "元信息完成：",
  "downloadSubmit": "下载：",
  "downloadDone": "下载完成：",
  "downloadFailed": "下载失败：",
  "roundFinished": "下载轮次结束：",
  "noResolved": "没有已解析的视频可导出。",
  "linksSaved": "直链导出文件已保存。",
  "ytdlpSaved": "YT-DLP 导出文件已保存。",
  "initDone": "队列已初始化。",
  "busyInit": "运行中不能初始化。",
  "activeReload": "页面刷新时任务仍在下载；浏览器中的上一次下载可能继续。",
  "privateOrDenied": "视频私有、隐藏、不可用或需要权限。",
  "apiStatus": "Iwara API 返回状态 ",
  "sizeB": "B",
  "sizeKB": "KB",
  "sizeMB": "MB",
  "sizeGB": "GB",
  "etaUnknown": "--"
};
  const SCRIPT_VERSION = '4.7';
  const STORE_KEY = 'iwara_video_watch_archive_downloader_state_v1';
  const SETTINGS_KEY = 'iwara_video_watch_archive_downloader_settings_v1';
  const PANEL_ID = 'iwara-watch-archive-downloader-panel';
  const API_HOSTS = ['apiq.iwara.tv', 'api.iwara.tv'];
  const FILE_VERSION_SALT = 'mSvL05GfEmeEmsEYfGCnVpEjYgTJraJN';
  const CONFIG = { DEFAULT_MAX_PAGES: 10, DEFAULT_RESOLVE_CONCURRENCY: 2, MAX_RESOLVE_CONCURRENCY: 8, DOWNLOAD_CONCURRENCY: 2, REQUEST_DELAY_MS: 700, DOWNLOAD_DELAY_MS: 900, PAGE_WAIT_MS: 12000, WATCHED_PAGE_DELAY_MS: 1300, WATCHED_CLICK_VALID_MS: 20000, WATCHED_DUPLICATE_MS: 1500, ROUTE_POLL_MS: 500, RETRY_LIMIT: 1, MEDIA_EXTENSIONS: ['.mp4', '.webm', '.m4v', '.mov'], QUALITY_PRIORITY: { Source: 100, '540': 99, '360': 98, preview: 1, unknown: 0 } };
  const STATUS = { PENDING: 'pending', FETCHING: 'fetching', READY: 'ready', DOWNLOADING: 'downloading', DONE: 'done', FAILED: 'failed' };
  const EXPORT_MODE = { DIRECT: 'direct', LINKS: 'links', YTDLP: 'ytdlp' };
  const DEFAULT_SETTINGS = { maxPages: CONFIG.DEFAULT_MAX_PAGES, resolveConcurrency: CONFIG.DEFAULT_RESOLVE_CONCURRENCY, quality: 'best', exportMode: EXPORT_MODE.DIRECT, keepId: true, keepTitle: true, keepOriginal: true, autoQueueSingle: true, autoDownloadSingle: false, downloadMetadata: true, advancedOpen: false };
  const state = { tasks: [], seen: {}, settings: { ...DEFAULT_SETTINGS }, stats: { currentPage: 1, pagesCollected: 0, totalPages: 0 }, collection: { active: false, stopped: false, startUrl: '', lastUrl: '', checkDuplicatesAfterWrap: false, wrapCount: 0 }, fetching: false, downloading: false, downloadStopRequested: false, activeDownloads: 0, downloadRound: { success: 0 }, downloadStats: { success: 0, failed: 0 }, logLines: [] };
  const ui = {}; let persistTimer = 0; let persistDirty = false; let applyingRemoteSettings = false; let autoDownloadTimer = 0;
  const watchedPage = { bound: false, domObserver: null, timer: 0, processing: false, rerunRequested: false, lastSource: '', lastClickedUrl: '', lastClickedAt: 0, lastObservedHref: '', routePollTimer: 0, lastItemKey: '', lastHandledAt: 0 };
  const css = `
    #${PANEL_ID} {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      width: 300px;
      max-width: 300px;
      color: #f2f2f2;
      background: rgba(0, 0, 0, 0.66);
      border: none;
      border-radius: 0;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.55);
      font: 14px/1.45 Arial, Helvetica, sans-serif;
      backdrop-filter: blur(2px);
    }
    #${PANEL_ID}.iwara-minimized {
      width: auto;
      min-width: 0;
      background: rgba(0, 0, 0, 0.66);
    }
    #${PANEL_ID}.iwara-minimized .iwara-body,
    #${PANEL_ID}.iwara-minimized .iwara-stat,
    #${PANEL_ID}.iwara-minimized .iwara-spacer {
      display: none;
    }
    #${PANEL_ID} * {
      box-sizing: border-box;
      font-size: 14px;
      font-family: Arial, Helvetica, sans-serif;
    }
    #${PANEL_ID} button,
    #${PANEL_ID} input,
    #${PANEL_ID} select,
    #${PANEL_ID} option,
    #${PANEL_ID} textarea,
    #${PANEL_ID} span,
    #${PANEL_ID} label,
    #${PANEL_ID} strong {
      font-size: 14px;
      font-family: Arial, Helvetica, sans-serif;
    }
    #${PANEL_ID} button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 28px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.28);
      border-radius: 0;
      padding: 3px 8px;
      color: #e8e8e8;
      background: rgba(0, 0, 0, 0.24);
      white-space: nowrap;
      line-height: 1.2;
    }
    #${PANEL_ID} button:hover {
      border-color: rgba(255, 255, 255, 0.72);
      color: #fff;
    }
    #${PANEL_ID} button:disabled {
      cursor: not-allowed;
      opacity: 0.48;
    }
    #${PANEL_ID} input,
    #${PANEL_ID} select {
      min-height: 24px;
      color: #fff;
      background: transparent;
      border: none;
      border-bottom: 1px solid #fff;
      border-radius: 0;
      padding: 0 3px;
      outline: none;
      text-align: center;
    }
    #${PANEL_ID} select option {
      color: #111;
      background: #fff;
      font-size: 14px;
      font-family: Arial, Helvetica, sans-serif;
    }
    #${PANEL_ID} input[type="number"] {
      -moz-appearance: textfield;
    }
    #${PANEL_ID} input[type="number"]::-webkit-outer-spin-button,
    #${PANEL_ID} input[type="number"]::-webkit-inner-spin-button {
      -webkit-appearance: none;
      margin: 0;
    }
    #${PANEL_ID} label {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      white-space: nowrap;
    }
    #${PANEL_ID} input[type="checkbox"] {
      min-height: auto;
      width: 14px;
      height: 14px;
      margin: 0;
      padding: 0;
    }
    #${PANEL_ID} .iwara-head {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      cursor: move;
      user-select: none;
    }
    #${PANEL_ID} .iwara-toggle {
      width: 28px;
      min-width: 28px;
      padding: 0;
    }
    #${PANEL_ID} .iwara-body {
      padding: 0 5px 5px;
    }
    #${PANEL_ID} .iwara-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 4px;
    }
    #${PANEL_ID} .iwara-row:last-child {
      margin-bottom: 0;
    }
    #${PANEL_ID} .iwara-stat {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #d8d8d8;
    }
    #${PANEL_ID} .iwara-stat strong {
      color: #fff;
      font-weight: 700;
    }
    #${PANEL_ID} .iwara-spacer {
      flex: 1 1 auto;
    }
    #${PANEL_ID} .iwara-panel-button {
      min-width: 86px;
    }
    #${PANEL_ID} .iwara-advanced {
      display: none;
    }
    #${PANEL_ID}.iwara-advanced-open .iwara-advanced {
      display: block;
    }
    #${PANEL_ID} .iwara-max-pages,
    #${PANEL_ID} .iwara-concurrency {
      width: 25px;
      text-align: center;
    }
    #${PANEL_ID} .iwara-log {
      height: 150px;
      overflow: auto;
      padding: 5px;
      color: #d8d8d8;
      background: rgba(0, 0, 0, 0.34);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: Arial, Helvetica, sans-serif;
    }
    #${PANEL_ID} .iwara-progress {
      display: none;
      max-height: 52px;
      overflow: hidden;
      padding: 4px 5px;
      margin-top: 4px;
      color: #d8d8d8;
      background: rgba(0, 0, 0, 0.34);
      white-space: pre;
      font-family: Arial, Helvetica, sans-serif;
    }
    #${PANEL_ID} .iwara-download-mode {
      width: 80px;
    }
    #${PANEL_ID} .iwara-quality {
      width: 64px;
    }
  `;

  async function main() { injectStyle(); restoreState(); loadSettingsNow(); createPanel(); applySettingsToUi(); bindSettings(); bindSettingsSync(); bindWatchedPageListeners(); makeDraggable(byId(PANEL_ID)); refreshTotalPagesFromDocument(); updateUi(TEXT.loaded); if (state.collection.active && !state.collection.stopped) { addLog(TEXT.restoredCollection); setTimeout(() => collectCurrentThenAdvance(true), 500); } scheduleAutoDownload('initial-load', CONFIG.WATCHED_PAGE_DELAY_MS); }
  function injectStyle() { if (byId(PANEL_ID + '-style')) return; const style = document.createElement('style'); style.id = PANEL_ID + '-style'; style.textContent = css; document.head.appendChild(style); }
  function createPanel() { const panel = document.createElement('section'); panel.id = PANEL_ID; panel.innerHTML = ['<div class="iwara-head"><span class="iwara-stat" title="' + escAttr(TEXT.queueTitle) + '">' + escHtml(TEXT.queue) + '<strong id="iwara-captured">0</strong></span><span class="iwara-stat" title="' + escAttr(TEXT.activeTitle) + '">' + escHtml(TEXT.active) + '<strong id="iwara-resolved">0</strong></span><span class="iwara-stat" title="' + escAttr(TEXT.successTitle) + '">' + escHtml(TEXT.success) + '<strong id="iwara-submitted">0</strong></span><span class="iwara-stat" title="' + escAttr(TEXT.failedTitle) + '">' + escHtml(TEXT.failed) + '<strong id="iwara-downloaded">0</strong></span><span class="iwara-spacer"></span><button type="button" id="iwara-toggle" class="iwara-toggle" title="' + escAttr(TEXT.toggleTitle) + '">_</button></div>', '<div class="iwara-body"><div class="iwara-row"><button type="button" id="iwara-clear" class="iwara-panel-button" title="' + escAttr(TEXT.initTitle) + '">' + escHtml(TEXT.init) + '</button><button type="button" id="iwara-collect-current" class="iwara-panel-button" title="' + escAttr(TEXT.currentTitle) + '">' + escHtml(TEXT.current) + '</button><button type="button" id="iwara-collect-toggle" class="iwara-panel-button" title="' + escAttr(TEXT.multiTitle) + '">' + escHtml(TEXT.multi) + '</button></div>', '<div class="iwara-row"><button type="button" id="iwara-download" class="iwara-panel-button" title="' + escAttr(TEXT.startTitle) + '">' + escHtml(TEXT.start) + '</button><button type="button" id="iwara-retry-failed" class="iwara-panel-button" title="' + escAttr(TEXT.againTitle) + '">' + escHtml(TEXT.again) + '</button><button type="button" id="iwara-advanced-toggle" class="iwara-panel-button" title="' + escAttr(TEXT.moreTitle) + '">' + escHtml(TEXT.more) + '</button></div><div class="iwara-progress" id="iwara-progress"></div><div class="iwara-advanced" id="iwara-advanced">', '<div class="iwara-row"><span>' + escHtml(TEXT.collected) + ' <strong id="iwara-pages-collected">0</strong>/<strong id="iwara-total-pages">0</strong> ' + escHtml(TEXT.pages) + '</span></div>', '<div class="iwara-row"><label title="' + escAttr(TEXT.autoQueueTitle) + '"><input type="checkbox" id="iwara-auto-queue">' + escHtml(TEXT.autoQueue) + '</label><label title="' + escAttr(TEXT.autoDLTitle) + '"><input type="checkbox" id="iwara-auto-download">' + escHtml(TEXT.autoDL) + '</label><label title="' + escAttr(TEXT.metaTitle) + '"><input type="checkbox" id="iwara-download-metadata">' + escHtml(TEXT.meta) + '</label></div>', '<div class="iwara-row"><label title="' + escAttr(TEXT.threadsTitle) + '">' + escHtml(TEXT.threads) + '<input id="iwara-resolve-concurrency" class="iwara-concurrency" type="number" min="1" max="8" step="1"></label><span title="' + escAttr(TEXT.pagesLimitTitle) + '">' + escHtml(TEXT.pagesLimit) + '</span><input id="iwara-max-pages" class="iwara-max-pages" type="number" min="1" max="64" step="1"></div>', '<div class="iwara-row"><label title="' + escAttr(TEXT.modeTitle) + '">' + escHtml(TEXT.mode) + '<select id="iwara-export-mode" class="iwara-download-mode"><option value="direct">' + escHtml(TEXT.browser) + '</option><option value="links">' + escHtml(TEXT.linksTxt) + '</option><option value="ytdlp">' + escHtml(TEXT.ytdlp) + '</option></select></label><label title="' + escAttr(TEXT.qualityTitle) + '">' + escHtml(TEXT.quality) + '<select id="iwara-quality" class="iwara-quality"><option value="best">Best</option><option value="Source">Source</option><option value="540">540</option><option value="360">360</option><option value="preview">preview</option></select></label></div>', '<div class="iwara-row"><span>' + escHtml(TEXT.filename) + '</span><label title="' + escAttr(TEXT.idTitle) + '"><input type="checkbox" id="iwara-keep-id">' + escHtml(TEXT.id) + '</label><label title="' + escAttr(TEXT.titleTitle) + '"><input type="checkbox" id="iwara-keep-title">' + escHtml(TEXT.title) + '</label><label title="' + escAttr(TEXT.originalTitle) + '"><input type="checkbox" id="iwara-keep-original">' + escHtml(TEXT.original) + '</label></div><div class="iwara-log" id="iwara-log"></div></div></div>'].join(''); document.body.appendChild(panel); cacheUi(); uiById('iwara-collect-current').addEventListener('click', () => collectCurrentOnly()); uiById('iwara-collect-toggle').addEventListener('click', togglePageCollection); uiById('iwara-download').addEventListener('click', () => startDownloads()); uiById('iwara-retry-failed').addEventListener('click', retryFailedDownloads); uiById('iwara-clear').addEventListener('click', clearTasks); uiById('iwara-advanced-toggle').addEventListener('click', toggleAdvancedOptions); uiById('iwara-toggle').addEventListener('click', () => { panel.classList.toggle('iwara-minimized'); uiById('iwara-toggle').textContent = panel.classList.contains('iwara-minimized') ? '+' : '_'; }); }
  function cacheUi() { ['iwara-captured','iwara-resolved','iwara-submitted','iwara-downloaded','iwara-pages-collected','iwara-total-pages','iwara-collect-current','iwara-collect-toggle','iwara-download','iwara-retry-failed','iwara-clear','iwara-advanced','iwara-progress','iwara-log','iwara-auto-queue','iwara-auto-download','iwara-download-metadata','iwara-resolve-concurrency','iwara-max-pages','iwara-export-mode','iwara-quality','iwara-keep-id','iwara-keep-title','iwara-keep-original'].forEach((id) => { ui[id] = byId(id); }); }
  function uiById(id) { return ui[id] || byId(id); }
  function bindSettings() { ['iwara-max-pages','iwara-quality','iwara-export-mode','iwara-keep-id','iwara-keep-title','iwara-keep-original','iwara-auto-queue','iwara-auto-download','iwara-download-metadata'].forEach((id) => uiById(id).addEventListener('change', saveSettingsFromUi)); uiById('iwara-resolve-concurrency').addEventListener('input', clampResolveConcurrencyInput); }
  function applySettingsToUi() { uiById('iwara-max-pages').value = state.settings.maxPages; uiById('iwara-quality').value = state.settings.quality; uiById('iwara-export-mode').value = state.settings.exportMode; uiById('iwara-keep-id').checked = state.settings.keepId; uiById('iwara-keep-title').checked = state.settings.keepTitle; uiById('iwara-keep-original').checked = state.settings.keepOriginal; uiById('iwara-auto-queue').checked = state.settings.autoQueueSingle; uiById('iwara-auto-download').checked = state.settings.autoDownloadSingle; uiById('iwara-download-metadata').checked = state.settings.downloadMetadata; uiById('iwara-resolve-concurrency').value = state.settings.resolveConcurrency; const panel = byId(PANEL_ID); if (panel) panel.classList.toggle('iwara-advanced-open', state.settings.advancedOpen); }
  function clampResolveConcurrencyInput() { const input = uiById('iwara-resolve-concurrency'); input.value = clampInt(input.value, 1, CONFIG.MAX_RESOLVE_CONCURRENCY, CONFIG.DEFAULT_RESOLVE_CONCURRENCY); saveSettingsFromUi(); }
  function saveSettingsFromUi() { if (applyingRemoteSettings) return; state.settings.maxPages = clampInt(uiById('iwara-max-pages').value, 1, 64, CONFIG.DEFAULT_MAX_PAGES); state.settings.resolveConcurrency = clampInt(uiById('iwara-resolve-concurrency').value, 1, CONFIG.MAX_RESOLVE_CONCURRENCY, CONFIG.DEFAULT_RESOLVE_CONCURRENCY); state.settings.quality = uiById('iwara-quality').value; state.settings.exportMode = uiById('iwara-export-mode').value; state.settings.keepId = uiById('iwara-keep-id').checked; state.settings.keepTitle = uiById('iwara-keep-title').checked; state.settings.keepOriginal = uiById('iwara-keep-original').checked; state.settings.autoQueueSingle = uiById('iwara-auto-queue').checked; state.settings.autoDownloadSingle = uiById('iwara-auto-download').checked; state.settings.downloadMetadata = uiById('iwara-download-metadata').checked; saveSettingsNow(); persistState(); updateUi(); if (state.settings.autoDownloadSingle) scheduleAutoDownload('settings'); }
  function toggleAdvancedOptions() { state.settings.advancedOpen = !state.settings.advancedOpen; const panel = byId(PANEL_ID); if (panel) panel.classList.toggle('iwara-advanced-open', state.settings.advancedOpen); saveSettingsNow(); updateUi(); }
  function bindWatchedPageListeners() { if (watchedPage.bound) return; watchedPage.bound = true; watchedPage.lastObservedHref = normalizeUrl(location.href); document.addEventListener('click', handleWatchedPageClick, true); bindHistoryChangeCapture(); bindWatchedDomObserver(); window.addEventListener('load', () => scheduleWatchedPageCheck('load')); window.addEventListener('pageshow', () => scheduleWatchedPageCheck('pageshow')); window.addEventListener('popstate', () => scheduleWatchedPageCheck('popstate')); window.addEventListener('hashchange', () => scheduleWatchedPageCheck('hashchange')); watchedPage.routePollTimer = setInterval(() => { const current = normalizeUrl(location.href); if (current === watchedPage.lastObservedHref) return; watchedPage.lastObservedHref = current; scheduleWatchedPageCheck('url-poll'); }, CONFIG.ROUTE_POLL_MS); }
  function handleWatchedPageClick(event) { const anchor = event.target && event.target.closest ? event.target.closest('a[href*="/video/"]') : null; if (!anchor || isPanelNode(anchor)) return; const url = safeUrl(anchor.getAttribute('href'), location.href); if (!url || !isVideoPage(url.href)) return; watchedPage.lastClickedUrl = normalizeUrl(url.href); watchedPage.lastClickedAt = Date.now(); scheduleWatchedPageCheck('click'); }
  function bindHistoryChangeCapture() { const rawPushState = history.pushState; const rawReplaceState = history.replaceState; history.pushState = function (...args) { const result = rawPushState.apply(this, args); watchedPage.lastObservedHref = normalizeUrl(location.href); scheduleWatchedPageCheck('pushState'); return result; }; history.replaceState = function (...args) { const result = rawReplaceState.apply(this, args); watchedPage.lastObservedHref = normalizeUrl(location.href); scheduleWatchedPageCheck('replaceState'); return result; }; }
  function bindWatchedDomObserver() { if (watchedPage.domObserver) return; watchedPage.domObserver = new MutationObserver((mutations) => { if (!mutations.some(isRelevantPageMutation)) return; scheduleWatchedPageCheck('dom'); }); watchedPage.domObserver.observe(document.body, { childList: true, subtree: true }); }
  function isRelevantPageMutation(mutation) { if (isPanelNode(mutation.target)) return false; const nodes = Array.from(mutation.addedNodes || []).concat(Array.from(mutation.removedNodes || [])); if (!nodes.length) return true; return nodes.some((node) => node.nodeType === Node.ELEMENT_NODE && !isPanelNode(node) && !(node.matches && node.matches('style,script'))); }
  function isPanelNode(node) { const element = node && (node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement); return Boolean(element && (element.id === PANEL_ID || (element.closest && element.closest('#' + PANEL_ID)))); }
  function scheduleWatchedPageCheck(source, delayMs = CONFIG.WATCHED_PAGE_DELAY_MS) { watchedPage.lastSource = source || watchedPage.lastSource || 'watch'; clearTimeout(watchedPage.timer); watchedPage.timer = setTimeout(() => runWatchedPageCheck(watchedPage.lastSource), delayMs); }
  async function runWatchedPageCheck(source) { if (!state.settings.autoQueueSingle) return; if (watchedPage.processing) { watchedPage.rerunRequested = true; return; } watchedPage.processing = true; watchedPage.rerunRequested = false; try { const postUrl = detectCurrentWatchedPostUrl(); if (!postUrl) { watchedPage.lastItemKey = ''; return; } const normalized = normalizeUrl(postUrl); const itemKey = watchedItemKey(normalized); const now = Date.now(); if (itemKey && itemKey === watchedPage.lastItemKey && now - watchedPage.lastHandledAt < CONFIG.WATCHED_DUPLICATE_MS) return; if (itemKey && itemKey === watchedPage.lastItemKey) return; watchedPage.lastItemKey = itemKey; watchedPage.lastHandledAt = now; await queueWatchedVideo(normalized, source || 'watch'); } catch (error) { addLog(TEXT.autoCheckFailed + messageOf(error)); updateUi(); } finally { watchedPage.processing = false; if (watchedPage.rerunRequested) { watchedPage.rerunRequested = false; scheduleWatchedPageCheck('rerun'); } } }
  function detectCurrentWatchedPostUrl() { if (isVideoPage(location.href) && hasInlineVideoSignal()) return normalizeUrl(location.href); if (isRecentClickedVideo() && hasInlineVideoSignal()) return watchedPage.lastClickedUrl; const canonical = document.querySelector('link[rel="canonical"][href]'); if (canonical && isVideoPage(canonical.href) && hasInlineVideoSignal()) return normalizeUrl(canonical.href); const activeLink = document.querySelector('[class*="modal"] a[href*="/video/"],[class*="player"] a[href*="/video/"],[id*="modal"] a[href*="/video/"],[id*="player"] a[href*="/video/"]'); if (activeLink && isVideoPage(activeLink.href) && hasInlineVideoSignal()) return normalizeUrl(activeLink.href); return ''; }
  function isRecentClickedVideo() { return Boolean(watchedPage.lastClickedUrl && isVideoPage(watchedPage.lastClickedUrl) && Date.now() - watchedPage.lastClickedAt <= CONFIG.WATCHED_CLICK_VALID_MS); }
  function hasInlineVideoSignal() { return Boolean(document.querySelector('video,source[type*="video"],[class*="video"],[id*="video"]')); }
  function watchedItemKey(postUrl) { const id = extractPostId(postUrl); return id ? 'id:' + id : normalizeUrl(postUrl); }
  async function queueWatchedVideo(postUrl, source) { const normalized = normalizeUrl(postUrl); const wasAdded = addTask(normalized); const task = findTaskByPostUrl(normalized); if (!task) return false; if (wasAdded) addLog(TEXT.autoQueued + ' (' + source + '): ' + normalized); if (task.status === STATUS.PENDING) await resolvePendingTasks([normalized]); const resolvedTask = findTaskByPostUrl(normalized); if (resolvedTask && state.settings.autoDownloadSingle && resolvedTask.status === STATUS.READY && resolvedTask.videoUrl) scheduleAutoDownload('watched-' + source, CONFIG.WATCHED_PAGE_DELAY_MS); persistState(); updateUi(); return wasAdded; }
  async function collectCurrentOnly() { if (state.fetching) return; state.collection.active = false; state.collection.stopped = true; await collectCurrentPageVideos(); scheduleAutoDownload('current-collection'); persistState(); }
  async function startPageCollection() { if (state.fetching) return; saveSettingsFromUi(); state.collection = { active: true, stopped: false, startUrl: normalizeUrl(location.href), lastUrl: normalizeUrl(location.href), checkDuplicatesAfterWrap: false, wrapCount: 0 }; state.stats.currentPage = 1; state.stats.pagesCollected = 0; state.stats.totalPages = totalPageNumber(document); persistState(); await collectCurrentThenAdvance(false); }
  function togglePageCollection() { if (state.collection.active || state.fetching) stopCollection(); else startPageCollection(); }
  function stopCollection() { state.collection.active = false; state.collection.stopped = true; addLog(TEXT.collectStopped); persistState(); updateUi(); }
  async function collectCurrentThenAdvance(restored) { if (!state.collection.active || state.collection.stopped || state.fetching) return; const result = await collectCurrentPageVideos(); if (!state.collection.active || state.collection.stopped) return; if (state.collection.checkDuplicatesAfterWrap) { state.collection.checkDuplicatesAfterWrap = false; if (result && result.duplicates > 0) { state.collection.active = false; state.collection.stopped = true; addLog(TEXT.collectStoppedDuplicate + result.duplicates + '.'); scheduleAutoDownload('collection-finished'); persistState(); updateUi(); return; } } const maxPages = Math.max(1, Number(state.settings.maxPages) || CONFIG.DEFAULT_MAX_PAGES); if (state.stats.pagesCollected >= maxPages) { state.collection.active = false; state.collection.stopped = true; addLog(TEXT.collectionFinished); scheduleAutoDownload('collection-finished'); persistState(); updateUi(); return; } const next = findNextPageLink(document); if (!next) { const first = findFirstPageLink(document); if (first && state.collection.wrapCount < 1) { state.collection.checkDuplicatesAfterWrap = true; state.collection.wrapCount += 1; await clickNextAndContinue(first); return; } state.collection.active = false; state.collection.stopped = true; addLog(TEXT.collectionFinished); scheduleAutoDownload('collection-finished'); persistState(); updateUi(); return; } await clickNextAndContinue(next); }
  async function clickNextAndContinue(link) { const oldSignature = pageSignature(); const oldHref = location.href; link.click(); const changed = await waitForPageChange(oldSignature, oldHref); if (!changed) { state.collection.active = false; state.collection.stopped = true; addLog(TEXT.collectNextFailed); scheduleAutoDownload('collection-finished'); persistState(); updateUi(); return; } state.collection.lastUrl = normalizeUrl(location.href); setTimeout(() => collectCurrentThenAdvance(false), CONFIG.REQUEST_DELAY_MS); }
  async function collectCurrentPageVideos() { if (state.fetching) return { added: 0, duplicates: 0 }; state.fetching = true; updateUi(); try { refreshTotalPagesFromDocument(); const urls = extractPostUrls(document, location.href); if (isVideoPage(location.href)) urls.unshift(normalizeUrl(location.href)); let added = 0; let duplicates = 0; unique(urls).forEach((url) => { if (addTask(url)) added += 1; else duplicates += 1; }); markPageCollected(); addLog(urls.length ? TEXT.collectAdded + added + ' (' + duplicates + ' dup).' : TEXT.collectNoVideos); await resolvePendingTasks(urls); updateUi(TEXT.pageCollected); return { added, duplicates }; } finally { state.fetching = false; persistState(); updateUi(); } }
  function findTaskByPostUrl(postUrl) { const normalized = normalizeUrl(postUrl); return state.tasks.find((task) => task.postUrl === normalized); }
  function addTask(postUrl) { const normalized = normalizeUrl(postUrl); const key = watchedItemKey(normalized); if (state.seen[key] || findTaskByPostUrl(normalized)) return false; const id = extractPostId(normalized); const task = { postUrl: normalized, postId: id, status: STATUS.PENDING, infoType: 'init', title: '', videoUrl: '', selectedQuality: '', availableQualities: [], originalFilename: '', filename: '', requestedQuality: state.settings.quality, metadata: emptyIwaraMetadata(normalized, id), error: '', retries: 0, capturedAt: new Date().toISOString(), finalFailureCounted: false, downloadMetadataRequested: false, metaDownloadDone: false, videoDownloadSubmitted: false, videoDownloadDone: false, metaDownloadedAt: '', videoSubmittedAt: '', videoDownloadedAt: '', videoBytesLoaded: 0, videoBytesTotal: 0, videoProgressAt: '', videoSpeedBps: 0 }; state.tasks.push(task); state.seen[key] = true; persistState(); updateUi(); return true; }
  async function resolvePendingTasks(onlyUrls) { const only = onlyUrls ? new Set(onlyUrls.map(normalizeUrl)) : null; const pending = state.tasks.filter((task) => task.status === STATUS.PENDING && (!only || only.has(task.postUrl))); if (!pending.length) return; addLog(TEXT.resolveStart + pending.length); let index = 0; async function worker() { while (index < pending.length) { const task = pending[index++]; await resolveOneTask(task); await delay(CONFIG.REQUEST_DELAY_MS); } } const count = Math.min(state.settings.resolveConcurrency, pending.length); await Promise.all(Array.from({ length: count }, worker)); }
  async function resolveOneTask(task) { task.status = STATUS.FETCHING; task.error = ''; persistState(); updateUi(TEXT.resolving + task.postUrl); try { const doc = normalizeUrl(location.href) === task.postUrl ? document : parseHtml(await requestText(task.postUrl)); const resolved = await resolveIwaraVideo(doc, task.postUrl); if (!resolved.videoUrl) { if (resolved.metadata && resolved.metadata.external) throw new Error(TEXT.externalVideo); throw new Error(TEXT.noDirectUrl); } task.postId = resolved.id || task.postId || extractPostId(task.postUrl); task.title = resolved.title || task.title || ''; task.infoType = 'full'; task.videoUrl = resolved.videoUrl; task.selectedQuality = resolved.selectedQuality; task.availableQualities = resolved.availableQualities; task.metadata = resolved.metadata; task.originalFilename = resolved.metadata.fileName || filenameFromUrl(task.videoUrl); task.requestedQuality = state.settings.quality; updateTaskFilename(task); task.status = STATUS.READY; addLog(TEXT.resolveDone + task.postId + ' ' + (task.selectedQuality || 'Best') + ' (' + task.availableQualities.length + TEXT.qualityCount + ').'); if (state.settings.quality !== 'best' && normalizeQualityName(task.selectedQuality) !== normalizeQualityName(state.settings.quality)) addLog(TEXT.qualityFallback + task.postId + ' ' + state.settings.quality + ' -> ' + (task.selectedQuality || 'Best')); } catch (error) { task.status = STATUS.FAILED; task.infoType = 'fail'; task.error = messageOf(error); task.metadata = { ...emptyIwaraMetadata(task.postUrl, task.postId), ...task.metadata, infoType: 'fail', error: task.error }; addLog(TEXT.resolveFailed + task.postUrl + ' - ' + task.error); } persistState(); updateUi(); }
  async function resolveIwaraVideo(doc, baseUrl) { const domMeta = extractIwaraMetadataFromDocument(doc, baseUrl); let qualities = extractQualitySourcesFromDocument(doc, baseUrl); let apiMeta = null; let apiQualities = []; const id = domMeta.id || extractPostId(baseUrl); if (id && (!qualities.length || !domMeta.raw || !domMeta.raw.id)) { try { const api = await fetchIwaraApiVideo(id); apiMeta = metadataFromApi(api, baseUrl); if (api && api.fileUrl && !api.embedUrl) apiQualities = await fetchIwaraFileSources(api.fileUrl, api.file && api.file.name, api.file && api.file.size); } catch (error) { addLog(TEXT.apiFallbackFailed + id + ' - ' + messageOf(error)); } } qualities = dedupeQualities(qualities.concat(apiQualities)).sort((a, b) => b.priority - a.priority); const selected = selectQuality(qualities, state.settings.quality); const meta = mergeIwaraMetadata(domMeta, apiMeta, selected, qualities, baseUrl); return { id: meta.id || id, title: meta.title || '', videoUrl: selected ? selected.url : '', selectedQuality: selected ? selected.name : '', availableQualities: qualities, metadata: meta }; }
  function extractQualitySourcesFromDocument(doc, baseUrl) { const sources = []; const addSource = (rawUrl, labelText, source, attrs) => { const url = safeUrl(rawUrl, baseUrl); if (!url || !isDownloadCandidateUrl(url.href)) return; const text = [labelText, attrs && attrs.title, attrs && attrs.aria, attrs && attrs.download, attrs && attrs.fileName, url.href].filter(Boolean).join(' '); const name = normalizeQualityName(text); const downloadUrl = url.href; sources.push({ name, label: name, priority: qualityPriority(name), url: downloadUrl, viewUrl: downloadUrl, downloadUrl, source, mimeType: attrs && attrs.mimeType || '', fileName: attrs && attrs.fileName || filenameFromUrl(downloadUrl), size: attrs && attrs.size || 0 }); }; doc.querySelectorAll('video[src],video source[src],source[type*="video"][src]').forEach((el) => addSource(el.getAttribute('src') || el.src || el.currentSrc, el.getAttribute('label') || el.getAttribute('res') || el.getAttribute('title') || '', 'player', { mimeType: el.getAttribute('type') || '' })); doc.querySelectorAll('a[href]').forEach((anchor) => { const href = anchor.getAttribute('href'); const signal = [anchor.textContent, anchor.getAttribute('aria-label'), anchor.getAttribute('title'), anchor.getAttribute('download'), anchor.getAttribute('data-quality'), anchor.closest('[class*="download"],[id*="download"]') ? 'download' : ''].filter(Boolean).join(' '); addSource(href, signal, anchor.closest('[class*="download"],[id*="download"]') ? 'download-link' : 'link', { title: anchor.getAttribute('title') || '', aria: anchor.getAttribute('aria-label') || '', download: anchor.getAttribute('download') || '', fileName: anchor.getAttribute('download') || '' }); }); ['meta[property="og:video"][content]','meta[property="og:video:url"][content]','meta[name="twitter:player:stream"][content]'].forEach((selector) => doc.querySelectorAll(selector).forEach((el) => addSource(el.getAttribute('content'), selector, 'meta', {}))); extractJsonLd(doc).forEach((item) => addSource(item.contentUrl || item.url, item.name || '', 'jsonld', {})); extractEmbeddedMediaUrls(doc.documentElement.innerHTML).forEach((raw) => addSource(raw, raw, 'html', {})); return dedupeQualities(sources).sort((a, b) => b.priority - a.priority); }
  function extractEmbeddedMediaUrls(source) {
    const html = typeof source === 'string' ? source : (source && source.documentElement ? source.documentElement.innerHTML : '');
    const urls = [];
    const mediaRe = /(?:https?:)?\/\/[^"'<>\\\s]+?(?:\.(?:mp4|webm|m4v|mov)(?:\?[^"'<>\\\s]*)?|(?:filesq?|i)\.iwara\.tv[^"'<>\\\s]*)/gi;
    let match;
    while ((match = mediaRe.exec(html))) urls.push(normalizeProtocolUrl(match[0].replace(/\\\//g, '/')));
    const keyRe = /(?:fileUrl|downloadUrl|src|view|download)["'\s:=>]+((?:https?:)?\/\/[^"'<>\\\s]+)/gi;
    while ((match = keyRe.exec(html))) urls.push(normalizeProtocolUrl(match[1].replace(/\\\//g, '/')));
    return Array.from(new Set(urls)).filter(isDownloadCandidateUrl);
  }
  async function fetchIwaraApiVideo(id) { let lastError = null; for (const host of API_HOSTS) { try { const response = await requestJson('https://' + host + '/video/' + encodeURIComponent(id), await iwaraRequestHeaders()); if (response && response.id) return response; if (response && response.message) lastError = new Error(response.message); } catch (error) { lastError = error; } } throw lastError || new Error(TEXT.privateOrDenied); }
  async function fetchIwaraFileSources(fileUrl, fileName, size) { try { const normalizedFileUrl = normalizeProtocolUrl(fileUrl); const headers = await iwaraRequestHeaders(normalizedFileUrl); const version = await getIwaraXVersion(normalizedFileUrl); if (version) headers['X-Version'] = version; const items = await requestJson(normalizedFileUrl, headers); if (!Array.isArray(items)) return []; return items.map((item) => qualitySourceFromApiItem(item, normalizedFileUrl, fileName, size)).filter(Boolean); } catch (error) { addLog(TEXT.fileUrlFailed + messageOf(error)); return []; } }
  function qualitySourceFromApiItem(item, baseUrl, fallbackFileName, fallbackSize) { const src = item && item.src || {}; const downloadUrl = normalizeProtocolUrl(src.download || src.view || '', baseUrl); const viewUrl = normalizeProtocolUrl(src.view || src.download || '', baseUrl); const url = downloadUrl || viewUrl; if (!url) return null; const name = normalizeQualityName(item.name || url) || 'unknown'; return { name, label: name, priority: qualityPriority(name), url, viewUrl: viewUrl || url, downloadUrl: downloadUrl || url, source: 'api-fileUrl', mimeType: item.type || '', fileName: item.filename || fallbackFileName || filenameFromUrl(url), size: Number(item.size || fallbackSize || 0) || 0, raw: item }; }
  async function getIwaraXVersion(fileUrl) { try { const url = new URL(fileUrl, location.href); const fileId = url.pathname.split('/').filter(Boolean).pop() || ''; const expires = url.searchParams.get('expires') || ''; if (!fileId || !expires || !crypto || !crypto.subtle) return ''; const data = new TextEncoder().encode([fileId, expires, FILE_VERSION_SALT].join('_')); const hash = await crypto.subtle.digest('SHA-1', data); return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join(''); } catch (_) { return ''; } }
  async function iwaraRequestHeaders() { const headers = { Accept: 'application/json', Referer: location.origin.replace(/\/$/, '') + '/', 'X-Site': location.hostname }; try { const token = localStorage.getItem('accessToken'); if (token) headers.Authorization = 'Bearer ' + token; } catch (_) {} return headers; }
  function extractIwaraMetadataFromDocument(doc, baseUrl) { const meta = extractMetaTags(doc); const id = extractPostId(baseUrl) || extractPostId(meta['og:url'] || ''); const title = extractTitle(doc, meta); const user = extractUser(doc, baseUrl); const description = extractDescription(doc, meta); return { ...emptyIwaraMetadata(baseUrl, id), infoType: 'partial', title, description, tags: extractTags(doc), thumbnailUrl: meta['og:image'] || meta['twitter:image'] || extractPoster(doc, baseUrl), userId: user.userId, username: user.username, displayName: user.displayName, userUrl: user.userUrl, createdAt: extractDate(doc), uploadTime: timestampFromDate(extractDate(doc)), commentCount: extractCountText(doc, /comments?|评论/i), raw: {}, meta }; }
  function metadataFromApi(raw, baseUrl) { const user = raw && raw.user || {}; const tags = normalizeApiTags(raw && raw.tags); const file = raw && raw.file || {}; const createdAt = raw && raw.createdAt || ''; return { ...emptyIwaraMetadata(baseUrl, raw && raw.id || extractPostId(baseUrl)), infoType: raw && raw.fileUrl && !raw.embedUrl ? 'full' : 'partial', title: raw && raw.title || '', description: raw && raw.body || '', createdAt, updatedAt: raw && raw.updatedAt || '', uploadTime: timestampFromDate(createdAt), tags, liked: Boolean(raw && raw.liked), private: Boolean(raw && raw.private), unlisted: Boolean(raw && raw.unlisted), external: Boolean(raw && raw.embedUrl), externalUrl: raw && raw.embedUrl || '', fileName: file.name || '', fileSize: Number(file.size || 0) || 0, mimeType: file.type || '', thumbnailUrl: raw && (raw.thumbnail || raw.thumbnailUrl || raw.preview) || '', userId: user.id || '', username: user.username || '', displayName: user.name || '', userUrl: user.username ? absoluteIwaraUrl('/profile/' + user.username) : '', following: Boolean(user.following), friend: Boolean(user.friend), commentCount: countValue(raw && (raw.numComments || raw.commentCount)), raw: raw || {}, meta: {} }; }
  function mergeIwaraMetadata(domMeta, apiMeta, selected, qualities, baseUrl) { const merged = { ...emptyIwaraMetadata(baseUrl, domMeta.id || apiMeta && apiMeta.id || extractPostId(baseUrl)), ...domMeta }; if (apiMeta) { Object.keys(apiMeta).forEach((key) => { if (key === 'tags') merged.tags = apiMeta.tags.length ? apiMeta.tags : merged.tags; else if (key === 'raw') merged.raw = apiMeta.raw || merged.raw; else if (key === 'meta') merged.meta = { ...(merged.meta || {}), ...(apiMeta.meta || {}) }; else if (apiMeta[key] !== '' && apiMeta[key] !== false && !(Array.isArray(apiMeta[key]) && !apiMeta[key].length)) merged[key] = apiMeta[key]; }); } merged.pageUrl = normalizeUrl(baseUrl); merged.capturedAt = merged.capturedAt || new Date().toISOString(); merged.scriptVersion = SCRIPT_VERSION; merged.availableQualities = qualities; merged.downloadQuality = selected ? selected.name : ''; merged.selectedQuality = selected ? selected.name : ''; merged.requestedQuality = state.settings.quality; merged.downloadUrl = selected ? selected.url : ''; merged.videoUrl = selected ? selected.url : ''; merged.fileName = merged.fileName || (selected && selected.fileName) || (selected ? filenameFromUrl(selected.url) : ''); merged.fileSize = Number(merged.fileSize || (selected && selected.size) || 0) || 0; merged.mimeType = merged.mimeType || (selected && selected.mimeType) || ''; merged.infoType = selected ? 'full' : (merged.external ? 'fail' : merged.infoType || 'partial'); return merged; }
  function emptyIwaraMetadata(pageUrl, id) { return { infoType: 'init', id: id || '', title: '', description: '', createdAt: '', updatedAt: '', uploadTime: 0, tags: [], liked: false, private: false, unlisted: false, external: false, externalUrl: '', fileName: '', fileSize: 0, mimeType: '', downloadQuality: '', selectedQuality: '', requestedQuality: '', downloadUrl: '', videoUrl: '', thumbnailUrl: '', userId: '', username: '', displayName: '', userUrl: '', following: false, friend: false, commentCount: '', pageUrl: normalizeUrl(pageUrl || location.href), capturedAt: new Date().toISOString(), scriptVersion: SCRIPT_VERSION, availableQualities: [], raw: {}, meta: {}, downloadFilename: '', error: '' }; }
  function selectQuality(qualities, requested) { if (!qualities.length) return null; const sorted = qualities.slice().sort((a, b) => b.priority - a.priority); if (requested === 'best') return sorted[0]; const wanted = normalizeQualityName(requested); return sorted.find((item) => normalizeQualityName(item.name) === wanted) || sorted[0]; }
  function normalizeQualityName(value) {
    const text = normalizeWhitespace(value);
    if (!text) return 'unknown';
    if (/\b(source|original)\b/i.test(text)) return 'Source';
    if (/\bpreview\b/i.test(text)) return 'preview';
    if (/(^|\D)540(p)?(\D|$)/i.test(text)) return '540';
    if (/(^|\D)360(p)?(\D|$)/i.test(text)) return '360';
    const match = text.match(/(^|\D)(\d{3,4})(p)?(\D|$)/i);
    return match ? match[2] : 'unknown';
  }
  function qualityPriority(name) { return CONFIG.QUALITY_PRIORITY[normalizeQualityName(name)] || 0; }
  function dedupeQualities(sources) { const byUrl = {}; sources.forEach((source) => { if (!source || !source.url) return; const key = source.url; if (!byUrl[key] || source.priority > byUrl[key].priority) byUrl[key] = source; }); return Object.values(byUrl); }
  function scheduleAutoDownload(reason, delayMs = 0) { if (!state.settings.autoDownloadSingle) return; clearTimeout(autoDownloadTimer); autoDownloadTimer = setTimeout(() => { autoDownloadTimer = 0; if (!state.settings.autoDownloadSingle || state.downloading || state.fetching || state.collection.active) return; if (!state.tasks.some(isDownloadableTask)) return; startDownloads('auto'); }, delayMs); }
  function startDownloads(source = 'manual') { if (state.downloading) { if (source === 'manual') stopDownloads(); return; } if (state.settings.exportMode !== EXPORT_MODE.DIRECT) { saveOutputFiles(); return; } if (!state.tasks.some(isDownloadableTask)) return; state.downloadStopRequested = false; state.downloading = true; state.downloadRound = { success: 0 }; addLog(TEXT.downloadStarted); updateUi(); pumpDownloads(); }
  function retryFailedDownloads() { if (state.downloading || state.fetching || state.collection.active) return; const retryCount = resetFailedTasksForRetry(); if (!retryCount) { addLog(TEXT.noFailed); updateUi(); return; } addLog(TEXT.retrying + retryCount + '.'); persistState(); updateUi(); startDownloads('retry'); }
  function stopDownloads() { state.downloadStopRequested = true; addLog(TEXT.downloadStopped); persistState(); updateUi(); if (state.activeDownloads === 0) finishDownloadRound(); }
  function pumpDownloads() { if (!state.downloading || state.downloadStopRequested) return; while (state.activeDownloads < CONFIG.DOWNLOAD_CONCURRENCY) { const task = nextDownloadTask({ logRetry: true }); if (!task) break; downloadTask(task); } if (state.activeDownloads === 0 && !nextDownloadTask()) finishDownloadRound(); updateUi(); }
  function nextDownloadTask(options = {}) { const task = state.tasks.find((item) => item.status === STATUS.READY || (item.status === STATUS.FAILED && item.videoUrl && item.retries <= CONFIG.RETRY_LIMIT)); if (task && options.logRetry && task.status === STATUS.FAILED) addLog(TEXT.retrying + task.filename + ' #' + task.retries); return task; }
  function isDownloadableTask(task) { return Boolean(task && task.videoUrl && (task.status === STATUS.READY || (task.status === STATUS.FAILED && task.retries <= CONFIG.RETRY_LIMIT))); }
  function downloadTask(task) { task.status = STATUS.DOWNLOADING; task.downloadMetadataRequested = Boolean(state.settings.downloadMetadata); task.videoDownloadSubmitted = false; task.videoDownloadDone = false; resetDownloadProgress(task); state.activeDownloads += 1; persistState(); updateUi(); if (!task.downloadMetadataRequested || task.metaDownloadDone) { downloadVideoForTask(task); return; } addLog(TEXT.metadataFirst + replaceExtension(task.filename, '.meta.json')); downloadMetaForTask(task).then(() => { task.metaDownloadDone = true; task.metaDownloadedAt = new Date().toISOString(); addLog(TEXT.metadataDone + replaceExtension(task.filename, '.meta.json')); persistState(); downloadVideoForTask(task); }).catch((error) => finishDownload(task, false, 'Meta download failed: ' + messageOf(error))); }
  function downloadMetaForTask(task) { return downloadTextFileByGM(replaceExtension(task.filename, '.meta.json'), JSON.stringify(buildTaskMetadata(task), null, 2), 'application/json'); }
  function downloadVideoForTask(task) { addLog(TEXT.downloadSubmit + task.filename); task.videoDownloadSubmitted = true; task.videoSubmittedAt = new Date().toISOString(); persistState(); updateUi(); GM_download({ url: task.videoUrl, name: task.filename, saveAs: false, onprogress: (event) => updateVideoProgress(task, event), onload: () => { task.videoDownloadDone = true; task.videoDownloadedAt = new Date().toISOString(); finishDownload(task, true); }, onerror: (error) => finishDownload(task, false, error && (error.error || error.details || error.toString()) || 'Download failed'), ontimeout: () => finishDownload(task, false, 'Download timed out') }); }
  function resetDownloadProgress(task) { task.videoBytesLoaded = 0; task.videoBytesTotal = 0; task.videoProgressAt = ''; task.videoSpeedBps = 0; }
  function countFinalFailure(task) { if (task.finalFailureCounted) return; task.finalFailureCounted = true; state.downloadStats.failed += 1; }
  function updateVideoProgress(task, event) { const now = Date.now(); const loaded = Math.max(0, Number(event && event.loaded) || 0); const rawTotal = Math.max(0, Number(event && event.total) || 0); const total = event && event.lengthComputable === false ? 0 : rawTotal; const previousLoaded = Math.max(0, Number(task.videoBytesLoaded) || 0); const previousAt = Number(task.videoProgressAt) || 0; if (previousAt && loaded >= previousLoaded) { const seconds = (now - previousAt) / 1000; if (seconds > 0) task.videoSpeedBps = (loaded - previousLoaded) / seconds; } task.videoBytesLoaded = loaded; task.videoBytesTotal = total; task.videoProgressAt = now; updateUi(); }
  function finishDownload(task, ok, errorText) { if (ok && isTaskDownloadComplete(task)) { task.status = STATUS.DONE; task.error = ''; addLog(TEXT.downloadDone + task.filename); state.downloadRound.success += 1; state.downloadStats.success += 1; removeCompletedTask(task); } else { task.retries += 1; task.status = STATUS.FAILED; task.error = errorText || 'Download failed'; if (task.retries > CONFIG.RETRY_LIMIT) countFinalFailure(task); addLog(TEXT.downloadFailed + task.filename + ' - ' + task.error); } state.activeDownloads = Math.max(0, state.activeDownloads - 1); persistState(); updateUi(); if (state.downloading && !state.downloadStopRequested) setTimeout(pumpDownloads, CONFIG.DOWNLOAD_DELAY_MS); else if (state.activeDownloads === 0 && state.downloading) finishDownloadRound(); }
  function isTaskDownloadComplete(task) { return Boolean(task.videoDownloadDone && (!task.downloadMetadataRequested || task.metaDownloadDone)); }
  function finishDownloadRound() { const doneCount = state.downloadRound.success || 0; const failedCount = state.tasks.filter((task) => task.status === STATUS.FAILED && task.videoUrl).length; const notDownloadedCount = countNotDownloadedTasks(); state.downloading = false; state.downloadStopRequested = false; addLog(TEXT.roundFinished + 'success ' + doneCount + ', failed ' + failedCount + ', not downloaded ' + notDownloadedCount + '.'); persistState(); updateUi(); }
  function countNotDownloadedTasks() { return state.tasks.filter((task) => task.status === STATUS.READY || (task.status === STATUS.FAILED && task.videoUrl && task.retries <= CONFIG.RETRY_LIMIT)).length; }
  function removeCompletedTask(task) { const index = state.tasks.indexOf(task); if (index >= 0) state.tasks.splice(index, 1); rebuildSeenFromTasks(); }
  function rebuildSeenFromTasks() { state.seen = {}; state.tasks.forEach((task) => { state.seen[watchedItemKey(task.postUrl)] = true; }); }
  function resetFailedTasksForRetry() { let count = 0; state.tasks.forEach((task) => { if (task.status !== STATUS.FAILED || !task.videoUrl) return; task.status = STATUS.READY; task.error = ''; task.retries = 0; task.finalFailureCounted = false; task.videoDownloadSubmitted = false; task.videoDownloadDone = false; task.videoSubmittedAt = ''; task.videoDownloadedAt = ''; resetDownloadProgress(task); count += 1; }); return count; }
  function saveOutputFiles() { const mainText = buildExportText(); const metaText = buildMetaJsonl(); if (!mainText && !metaText) { addLog(TEXT.noResolved); updateUi(); return; } const stamp = timestampForFile(); if (mainText) downloadTextFile(state.settings.exportMode === EXPORT_MODE.YTDLP ? 'iwara-ytdlp-' + stamp + '.txt' : 'iwara-links-' + stamp + '.txt', mainText, 'text/plain'); if (metaText) downloadTextFile('iwara-meta-' + stamp + '.jsonl', metaText, 'application/json'); addLog(state.settings.exportMode === EXPORT_MODE.YTDLP ? TEXT.ytdlpSaved : TEXT.linksSaved); updateUi(); }
  function buildExportText() { const ready = state.tasks.filter((task) => task.videoUrl); if (state.settings.exportMode === EXPORT_MODE.YTDLP) return ready.map((task) => 'yt-dlp -o ' + shellQuote(task.filename) + ' ' + shellQuote(task.videoUrl)).join('\n'); return ready.map((task) => task.videoUrl).join('\n'); }
  function buildMetaJsonl() { return state.tasks.filter((task) => task.videoUrl).map((task) => JSON.stringify(buildTaskMetadata(task))).join('\n'); }
  function buildTaskMetadata(task) { const meta = { ...emptyIwaraMetadata(task.postUrl, task.postId), ...task.metadata }; meta.id = task.postId || meta.id || ''; meta.title = task.title || meta.title || ''; meta.pageUrl = task.postUrl; meta.downloadUrl = task.videoUrl; meta.videoUrl = task.videoUrl; meta.downloadQuality = task.selectedQuality || meta.downloadQuality || ''; meta.selectedQuality = task.selectedQuality || meta.selectedQuality || ''; meta.requestedQuality = task.requestedQuality || state.settings.quality; meta.availableQualities = task.availableQualities || meta.availableQualities || []; meta.fileName = task.originalFilename || meta.fileName || filenameFromUrl(task.videoUrl); meta.downloadFilename = task.filename; meta.scriptVersion = SCRIPT_VERSION; meta.downloadMetadataRequested = Boolean(task.downloadMetadataRequested); meta.metaDownloadDone = Boolean(task.metaDownloadDone); meta.videoDownloadSubmitted = Boolean(task.videoDownloadSubmitted); meta.videoDownloadDone = Boolean(task.videoDownloadDone); meta.metaDownloadedAt = task.metaDownloadedAt || ''; meta.videoSubmittedAt = task.videoSubmittedAt || ''; meta.videoDownloadedAt = task.videoDownloadedAt || ''; meta.error = task.error || meta.error || ''; return meta; }
  function clearTasks() { if (state.downloading || state.fetching || state.collection.active) { addLog(TEXT.busyInit); updateUi(); return; } state.tasks = []; state.seen = {}; state.stats = { currentPage: 1, pagesCollected: 0, totalPages: totalPageNumber(document) }; state.collection = { active: false, stopped: true, startUrl: '', lastUrl: '', checkDuplicatesAfterWrap: false, wrapCount: 0 }; state.downloading = false; state.downloadStopRequested = false; state.activeDownloads = 0; state.downloadRound = { success: 0 }; state.downloadStats = { success: 0, failed: 0 }; state.logLines = []; clearTimeout(autoDownloadTimer); autoDownloadTimer = 0; addLog(TEXT.initDone); persistState(); updateUi(); }
  function updateTaskFilename(task) { task.filename = buildFilename(task); task.metadata.downloadFilename = task.filename; task.metadata.fileName = task.metadata.fileName || task.originalFilename; }
  function buildFilename(task) { const ext = extensionFromUrl(task.videoUrl) || extensionFromFilename(task.originalFilename) || '.mp4'; const id = sanitizeFilename(task.postId || task.metadata.id || ''); const title = sanitizeFilename(task.title || task.metadata.title || ''); const original = sanitizeFilename(stripExtension(task.originalFilename || task.metadata.fileName || filenameFromUrl(task.videoUrl))); const parts = []; if (state.settings.keepId && id) parts.push(id); if (state.settings.keepTitle && title) parts.push(title); if (state.settings.keepOriginal && original && !parts.includes(original)) parts.push(original); const fallback = id || shortHash(task.videoUrl || task.postUrl); const base = parts.length ? parts.join('_') : fallback; return truncateFilename(base || 'iwara-video', 170) + ext; }
  function updateUi(statusText) { if (!uiById('iwara-captured')) return; if (statusText) addLog(statusText); refreshTotalPagesFromDocument(); const stats = getParseStats(); setText('iwara-captured', stats.captured); setText('iwara-resolved', stats.resolved); setText('iwara-submitted', stats.submitted); setText('iwara-downloaded', stats.downloaded); setText('iwara-pages-collected', pagesCollected()); setText('iwara-total-pages', totalPages()); const log = uiById('iwara-log'); if (log) { log.textContent = state.logLines.slice(-80).join('\n'); log.scrollTop = log.scrollHeight; } const progress = uiById('iwara-progress'); if (progress) { const progressLines = buildActiveProgressLines(); progress.textContent = progressLines.join('\n'); progress.style.display = progressLines.length ? 'block' : 'none'; } if (!uiById('iwara-download')) return; const panel = byId(PANEL_ID); if (panel) panel.classList.toggle('iwara-advanced-open', Boolean(state.settings.advancedOpen)); uiById('iwara-collect-current').disabled = state.fetching || state.collection.active; uiById('iwara-collect-toggle').disabled = state.fetching && !state.collection.active; uiById('iwara-collect-toggle').textContent = state.collection.active ? TEXT.stopCollect : TEXT.pagesButton; uiById('iwara-clear').disabled = state.fetching || state.downloading || state.collection.active; const downloadDisabled = state.downloading ? false : (state.settings.autoDownloadSingle || state.activeDownloads > 0 || !state.tasks.some((task) => task.videoUrl)); uiById('iwara-download').disabled = downloadDisabled; uiById('iwara-download').textContent = state.downloading ? TEXT.stopSend : TEXT.start; uiById('iwara-download').title = state.downloading ? TEXT.stopSendTitle : TEXT.startTitle; uiById('iwara-retry-failed').disabled = state.downloading || state.fetching || state.collection.active || !state.tasks.some((task) => task.status === STATUS.FAILED); uiById('iwara-advanced-toggle').textContent = state.settings.advancedOpen ? '收起选项' : TEXT.more; }
  function getParseStats() { return { captured: state.tasks.filter((task) => Boolean(task.videoUrl)).length, resolved: Math.max(0, Number(state.activeDownloads) || 0), submitted: Math.max(0, Number(state.downloadStats.success) || 0), downloaded: Math.max(0, Number(state.downloadStats.failed) || 0) }; }
  function pagesCollected() { return Math.max(0, Number(state.stats.pagesCollected) || 0); }
  function totalPages() { return Math.max(0, Number(state.stats.totalPages) || 0); }
  function buildActiveProgressLines() { return state.tasks.filter((task) => task.status === STATUS.DOWNLOADING && task.videoBytesLoaded).map(buildProgressLine); }
  function buildProgressLine(task) { const loaded = Number(task.videoBytesLoaded) || 0; const total = Number(task.videoBytesTotal) || 0; const pct = total ? Math.min(100, loaded / total * 100).toFixed(1) + '%' : ''; const speed = formatCompactSpeed(Number(task.videoSpeedBps) || 0); const eta = total && task.videoSpeedBps ? formatCompactEta((total - loaded) / task.videoSpeedBps) : TEXT.etaUnknown; return [compactFilename(task.filename, 11), pct, formatCompactBytes(loaded) + (total ? '/' + formatCompactBytes(total) : ''), speed, eta].filter(Boolean).join(' '); }
  function formatCompactBytes(bytes) { const units = [TEXT.sizeB, TEXT.sizeKB, TEXT.sizeMB, TEXT.sizeGB]; let value = Math.max(0, Number(bytes) || 0); let index = 0; while (value >= 1024 && index < units.length - 1) { value /= 1024; index += 1; } return (index ? value.toFixed(value >= 10 ? 1 : 2) : String(Math.round(value))) + units[index]; }
  function formatCompactSpeed(bytesPerSecond) { return bytesPerSecond ? formatCompactBytes(bytesPerSecond) + '/s' : ''; }
  function formatCompactEta(seconds) { if (!Number.isFinite(seconds) || seconds <= 0) return TEXT.etaUnknown; if (seconds < 60) return Math.ceil(seconds) + 's'; const minutes = Math.floor(seconds / 60); const rest = Math.ceil(seconds % 60); return minutes + 'm' + String(rest).padStart(2, '0') + 's'; }
  function compactFilename(filename, maxLength) { const text = String(filename || ''); return text.length > maxLength ? text.slice(0, maxLength - 3) + '...' : text; }
  function normalizeSettings(settings) { const source = settings && typeof settings === 'object' ? settings : {}; const merged = { ...DEFAULT_SETTINGS, ...source }; merged.maxPages = clampInt(merged.maxPages, 1, 64, DEFAULT_SETTINGS.maxPages); merged.resolveConcurrency = clampInt(merged.resolveConcurrency, 1, CONFIG.MAX_RESOLVE_CONCURRENCY, DEFAULT_SETTINGS.resolveConcurrency); if (!['best','Source','540','360','preview'].includes(merged.quality)) merged.quality = DEFAULT_SETTINGS.quality; if (!Object.values(EXPORT_MODE).includes(merged.exportMode)) merged.exportMode = DEFAULT_SETTINGS.exportMode; merged.keepId = Boolean(merged.keepId); merged.keepTitle = Boolean(merged.keepTitle); merged.keepOriginal = Boolean(merged.keepOriginal); merged.autoQueueSingle = Boolean(merged.autoQueueSingle); merged.autoDownloadSingle = Boolean(merged.autoDownloadSingle); merged.downloadMetadata = Boolean(merged.downloadMetadata); merged.advancedOpen = Boolean(merged.advancedOpen); return merged; }
  function saveSettingsNow() { GM_setValue(SETTINGS_KEY, state.settings); }
  function loadSettingsNow() { state.settings = normalizeSettings(GM_getValue(SETTINGS_KEY, DEFAULT_SETTINGS)); }
  function bindSettingsSync() { if (typeof GM_addValueChangeListener !== 'function') return; GM_addValueChangeListener(SETTINGS_KEY, (_name, _oldValue, newValue, remote) => { if (!remote) return; applyingRemoteSettings = true; state.settings = normalizeSettings(newValue); applySettingsToUi(); applyingRemoteSettings = false; addLog(TEXT.settingsSynced); if (state.settings.autoDownloadSingle) scheduleAutoDownload('settings-sync'); updateUi(); }); }
  function restoreState() { let saved = null; try { saved = GM_getValue(STORE_KEY, null); if (typeof saved === 'string') saved = JSON.parse(saved); } catch (_) { saved = null; } if (!saved || typeof saved !== 'object') return; state.tasks = Array.isArray(saved.tasks) ? saved.tasks : []; state.seen = saved.seen && typeof saved.seen === 'object' ? saved.seen : {}; state.settings = normalizeSettings(saved.settings || state.settings); const savedStats = saved.stats && typeof saved.stats === 'object' ? saved.stats : {}; state.stats.currentPage = Math.max(1, Number(savedStats.currentPage) || 1); state.stats.pagesCollected = Math.max(0, Number(savedStats.pagesCollected) || 0); state.stats.totalPages = Math.max(0, Number(savedStats.totalPages) || 0); state.collection = { ...state.collection, ...(saved.collection || {}) }; const hasSavedDownloadStats = Boolean(saved.downloadStats && typeof saved.downloadStats === 'object'); const savedDownloadStats = hasSavedDownloadStats ? saved.downloadStats : {}; state.downloadStats.success = Math.max(0, Number(savedDownloadStats.success) || 0); state.downloadStats.failed = Math.max(0, Number(savedDownloadStats.failed) || 0); state.downloadStopRequested = false; state.downloading = false; state.activeDownloads = 0; state.logLines = Array.isArray(saved.logLines) ? saved.logLines.slice(-80) : []; state.tasks.forEach((task) => { const restoredDownloading = task.status === STATUS.DOWNLOADING; if (task.status === STATUS.FETCHING) task.status = STATUS.PENDING; if (restoredDownloading) { if (task.videoUrl) { task.status = STATUS.FAILED; task.error = TEXT.activeReload; task.retries = CONFIG.RETRY_LIMIT + 1; task.videoDownloadSubmitted = false; task.videoDownloadDone = false; resetDownloadProgress(task); countFinalFailure(task); } else { task.status = STATUS.PENDING; } } task.metadata = { ...emptyIwaraMetadata(task.postUrl, task.postId), ...(task.metadata || {}) }; task.availableQualities = Array.isArray(task.availableQualities) ? task.availableQualities : []; const hadMetaDownloadDone = Object.prototype.hasOwnProperty.call(task, 'metaDownloadDone'); const requestedMetadata = Object.prototype.hasOwnProperty.call(task, 'downloadMetadataRequested') ? Boolean(task.downloadMetadataRequested) : true; task.downloadMetadataRequested = requestedMetadata; task.metaDownloadDone = Boolean(task.metaDownloadDone || (!hadMetaDownloadDone && task.status === STATUS.DONE && requestedMetadata)); task.videoDownloadSubmitted = Boolean(task.videoDownloadSubmitted || task.status === STATUS.DONE); task.videoDownloadDone = Boolean(task.videoDownloadDone || task.status === STATUS.DONE); task.metaDownloadedAt = task.metaDownloadedAt || ''; task.videoSubmittedAt = task.videoSubmittedAt || ''; task.videoDownloadedAt = task.videoDownloadedAt || ''; task.videoBytesLoaded = Math.max(0, Number(task.videoBytesLoaded) || 0); task.videoBytesTotal = Math.max(0, Number(task.videoBytesTotal) || 0); task.videoProgressAt = Math.max(0, Number(task.videoProgressAt) || 0); task.videoSpeedBps = Math.max(0, Number(task.videoSpeedBps) || 0); task.retries = Math.max(0, Number(task.retries) || 0); task.finalFailureCounted = Boolean(task.finalFailureCounted || (!hasSavedDownloadStats && task.status === STATUS.FAILED && task.videoUrl && task.retries > CONFIG.RETRY_LIMIT)); }); state.tasks = state.tasks.filter((task) => task.status !== STATUS.DONE); if (!hasSavedDownloadStats) state.downloadStats.failed = state.tasks.filter((task) => task.finalFailureCounted).length; rebuildSeenFromTasks(); }
  function persistState() { persistDirty = true; clearTimeout(persistTimer); persistTimer = setTimeout(persistStateNow, 250); }
  function persistStateNow() { if (!persistDirty && persistTimer) return; persistDirty = false; clearTimeout(persistTimer); persistTimer = 0; state.settings = normalizeSettings(state.settings); GM_setValue(STORE_KEY, { tasks: state.tasks, seen: state.seen, settings: state.settings, stats: state.stats, collection: state.collection, downloadStats: state.downloadStats, logLines: state.logLines.slice(-80) }); }
  function requestText(url) { return gmRequest(url).then((response) => response.text); }
  function requestJson(url, headers) { return gmRequest(url, { headers }).then((response) => { try { return JSON.parse(response.text || 'null'); } catch (error) { throw new Error('Invalid JSON from ' + url); } }); }
  function gmRequest(url, options = {}) { return new Promise((resolve, reject) => { GM_xmlhttpRequest({ method: options.method || 'GET', url, headers: options.headers || { Accept: 'text/html,application/json;q=0.9,*/*;q=0.8' }, responseType: 'text', timeout: options.timeout || 30000, onload: (response) => { if (response.status >= 200 && response.status < 300) resolve({ text: response.responseText || '', status: response.status, finalUrl: response.finalUrl || url }); else reject(new Error((response.status === 401 || response.status === 403 || response.status === 404) ? TEXT.privateOrDenied : TEXT.apiStatus + response.status)); }, onerror: (error) => reject(error), ontimeout: () => reject(new Error('Request timed out')) }); }); }
  function parseHtml(html) { return new DOMParser().parseFromString(html, 'text/html'); }
  function isVideoPage(url) { try { const parsed = new URL(url, location.href); return /^\/video\/[A-Za-z0-9_-]+(?:\/[^/?#]*)?\/?$/i.test(parsed.pathname); } catch (_) { return false; } }
  function extractPostId(url) { try { const parsed = new URL(url, location.href); const match = parsed.pathname.match(/^\/video\/([A-Za-z0-9_-]+)/i); return match ? match[1] : ''; } catch (_) { return ''; } }
  function extractPostUrls(doc, baseUrl) { const urls = new Set(); doc.querySelectorAll('a[href*="/video/"]').forEach((anchor) => { if (isPanelNode(anchor)) return; const url = safeUrl(anchor.getAttribute('href'), baseUrl); if (!url || !sameIwaraSite(url, location) || !isVideoPage(url.href)) return; urls.add(normalizeUrl(url.href)); }); return Array.from(urls); }
  function findNextPageLink(doc) { const roots = paginationRoots(doc); const links = (roots.length ? roots : [doc]).flatMap((root) => Array.from(root.querySelectorAll('a[href],button'))); const current = currentPageNumber(doc) || state.stats.currentPage; const numeric = links.map((link) => ({ link, num: Number(normalizeWhitespace(link.textContent)) })).filter((item) => Number.isFinite(item.num) && item.num > current).sort((a, b) => a.num - b.num)[0]; if (numeric) return numeric.link; const relNext = doc.querySelector('a[rel="next"][href]'); if (relNext) return relNext; return links.find((link) => /^(next|>|next\s*>|older|下一页)$/i.test(normalizeWhitespace(link.textContent))) || null; }
  function findFirstPageLink(doc) { const relFirst = doc.querySelector('a[rel="first"][href]'); if (relFirst) return relFirst; const roots = paginationRoots(doc); const links = (roots.length ? roots : [doc]).flatMap((root) => Array.from(root.querySelectorAll('a[href]'))); const numeric = links.map((link) => ({ link, num: Number(normalizeWhitespace(link.textContent)) })).filter((item) => Number.isFinite(item.num) && item.num === 1).sort((a, b) => a.link.href.length - b.link.href.length)[0]; return numeric ? numeric.link : null; }
  function currentPageNumber(doc) { const active = doc.querySelector('[aria-current="page"],[id*="pagination"] .active,.pagination .active,.page .active,.paging .active'); if (!active) return pageNumberFromHref(location.href) || 1; const href = active.getAttribute && active.getAttribute('href'); return pageNumberFromHref(href) || Number(normalizeWhitespace(active.textContent)) || 1; }
  function totalPageNumber(doc) { const numbers = paginationPageNumbers(doc); const current = currentPageNumber(doc); if (current > 0) numbers.push(current); const max = numbers.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => b - a)[0] || 0; if (max > 0) return max; return !isVideoPage(location.href) && extractPostUrls(doc, location.href).length ? 1 : 0; }
  function paginationPageNumbers(doc) { const numbers = []; paginationRoots(doc).forEach((root) => root.querySelectorAll('a,span,li,strong,em,b,button').forEach((node) => { const text = normalizeWhitespace(node.textContent); if (/^\d{1,6}$/.test(text)) numbers.push(Number(text)); const href = node.getAttribute && node.getAttribute('href'); const hrefNumber = pageNumberFromHref(href); if (hrefNumber > 0) numbers.push(hrefNumber); })); return numbers; }
  function paginationRoots(doc) { const roots = Array.from(doc.querySelectorAll('nav[aria-label*="pagination" i],[id*="pagination"],.pagination,.page,.paging,[class*="pagination"]')); return roots.length ? roots : []; }
  function pageNumberFromHref(href) { if (!href) return 0; try { const parsed = new URL(href, location.href); for (const key of ['page','p','pg']) { const value = parsed.searchParams.get(key); if (/^\d{1,6}$/.test(value || '')) return Number(value); } const match = parsed.pathname.match(/(?:\/page\/|\/p\/)(\d{1,6})(?:\/|$)/i); return match ? Number(match[1]) : 0; } catch (_) { return 0; } }
  function refreshTotalPagesFromDocument() { state.stats.totalPages = totalPageNumber(document); }
  function markPageCollected() { const next = pagesCollected() + 1; const total = totalPages() || Math.max(0, Number(state.settings.maxPages) || 0); state.stats.pagesCollected = total ? Math.min(next, total) : next; }
  function waitForPageChange(oldSignature, oldHref) { return new Promise((resolve) => { let done = false; const finish = (value) => { if (done) return; done = true; observer.disconnect(); clearInterval(interval); clearTimeout(timeout); resolve(value); }; const changed = () => location.href !== oldHref || pageSignature() !== oldSignature; const observer = new MutationObserver(() => { if (changed()) finish(true); }); observer.observe(document.body, { childList: true, subtree: true }); const interval = setInterval(() => { if (changed()) finish(true); }, 250); const timeout = setTimeout(() => finish(false), CONFIG.PAGE_WAIT_MS); }); }
  function pageSignature() { return extractPostUrls(document, location.href).join('|') || normalizeWhitespace(document.title); }
  function extractTitle(doc, meta) { for (const selector of ['h1','[class*="title"] h1','[class*="video"] [class*="title"]','meta[property="og:title"]','title']) { const el = doc.querySelector(selector); const value = el && (el.getAttribute('content') || el.textContent || ''); const cleaned = normalizeWhitespace(value).replace(/\s*[|-]\s*Iwara\s*$/i, ''); if (cleaned) return cleaned; } return meta && meta['og:title'] || ''; }
  function extractDescription(doc, meta) { const metaText = meta['og:description'] || meta.description || meta['twitter:description'] || ''; if (normalizeWhitespace(metaText)) return normalizeWhitespace(metaText); for (const selector of ['[class*="description"]','[class*="body"]','article p']) { const el = doc.querySelector(selector); const text = normalizeWhitespace(el && el.textContent); if (text && text.length > 10) return text; } return ''; }
  function extractUser(doc, baseUrl) { const result = { userId: '', username: '', displayName: '', userUrl: '' }; const links = Array.from(doc.querySelectorAll('a[href*="/profile/"],a[href*="/users/"]')); for (const link of links) { const text = normalizeWhitespace(link.textContent); const url = safeUrl(link.getAttribute('href'), baseUrl); if (!url || !text) continue; result.userUrl = url.href; const parts = url.pathname.split('/').filter(Boolean); result.username = parts[1] || text; result.displayName = text; break; } return result; }
  function extractTags(doc) { const values = []; doc.querySelectorAll('a[href*="/search"],a[href*="/tag"],a[href*="tags="]').forEach((anchor) => { const text = normalizeWhitespace(anchor.textContent).replace(/^#/, ''); if (text && text.length < 80 && !/^all$/i.test(text)) values.push(text); }); return unique(values); }
  function extractPoster(doc, baseUrl) { const video = doc.querySelector('video[poster]'); const url = video && safeUrl(video.getAttribute('poster'), baseUrl); return url ? url.href : ''; }
  function extractDate(doc) { const time = doc.querySelector('time[datetime]'); if (time) return time.getAttribute('datetime') || ''; const text = normalizeWhitespace(doc.body && doc.body.textContent); const match = text.match(/\b\d{4}[-/]\d{1,2}[-/]\d{1,2}\b/); return match ? match[0] : ''; }
  function extractCountText(doc, pattern) { const nodes = Array.from(doc.querySelectorAll('span,div,a,button')).filter((el) => pattern.test(el.textContent || '')); for (const node of nodes) { const text = normalizeWhitespace(node.textContent); const match = text.match(/([\d,.]+\s*[KMB]?)/i); if (match) return match[1]; } return ''; }
  function countValue(value) { if (value == null || value === '') return ''; return String(value); }
  function normalizeApiTags(tags) { if (!Array.isArray(tags)) return []; return unique(tags.map((tag) => typeof tag === 'string' ? tag : (tag && (tag.id || tag.name || tag.tag || tag.label)) || '').map(normalizeWhitespace).filter(Boolean)); }
  function extractJsonLd(doc) { const items = []; doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => { try { const parsed = JSON.parse(script.textContent || '{}'); if (Array.isArray(parsed)) items.push(...parsed); else items.push(parsed); } catch (_) {} }); return items; }
  function extractMetaTags(doc) { const result = {}; doc.querySelectorAll('meta').forEach((el) => { const key = el.getAttribute('property') || el.getAttribute('name'); const value = el.getAttribute('content'); if (key && value) result[key] = value; }); return result; }
  function isDownloadCandidateUrl(url) { const lower = decodeURIComponent(String(url || '')).toLowerCase(); if (/^https?:\/\/(?:filesq?|i)\.iwara\.tv\b/i.test(lower)) return true; return CONFIG.MEDIA_EXTENSIONS.some((ext) => lower.includes(ext)); }
  function sameIwaraSite(a, b) { const ah = String(a.hostname || '').replace(/^www\./, ''); const bh = String(b.hostname || '').replace(/^www\./, ''); return ah === bh && /(^|\.)iwara\.tv$/i.test(ah); }
  function normalizeProtocolUrl(value, baseUrl) { const raw = String(value || '').trim(); const url = safeUrl(raw.startsWith('//') ? location.protocol + raw : raw, baseUrl || location.href); return url ? url.href : ''; }
  function absoluteIwaraUrl(path) { return location.origin.replace(/\/$/, '') + path; }
  function safeUrl(value, baseUrl) { if (value == null) return null; const decoded = decodeHtmlEntities(String(value)).trim(); if (!decoded) return null; try { const parsed = new URL(decoded, baseUrl || location.href); if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null; return parsed; } catch (_) { return null; } }
  function normalizeUrl(url) { const parsed = new URL(url, location.href); parsed.hash = ''; return parsed.href; }
  function decodeHtmlEntities(value) { const textarea = document.createElement('textarea'); textarea.innerHTML = value; return textarea.value; }
  function normalizeWhitespace(value) { return String(value || '').replace(/\s+/g, ' ').trim(); }
  function unique(values) { return Array.from(new Set(values.filter(Boolean))); }
  function sanitizeFilename(value) { return normalizeWhitespace(value).replace(/[\\/:*?"<>|]/g, '_').replace(/[\x00-\x1f\x7f]/g, '').replace(/\.+$/g, '').trim(); }
  function truncateFilename(value, maxLength) { return value.length > maxLength ? value.slice(0, maxLength).trim() : value; }
  function filenameFromUrl(url) { try { const pathname = new URL(url, location.href).pathname.replace(/\/$/, ''); return decodeURIComponent(pathname.split('/').pop() || ''); } catch (_) { return ''; } }
  function stripExtension(filename) { return String(filename || '').replace(/\.(mp4|webm|m4v|mov)$/i, ''); }
  function extensionFromFilename(filename) { const match = String(filename || '').match(/\.(mp4|webm|m4v|mov)$/i); return match ? match[0].toLowerCase() : ''; }
  function extensionFromUrl(url) { return extensionFromFilename(filenameFromUrl(url)); }
  function replaceExtension(filename, extension) { return String(filename || 'metadata.json').replace(/\.[^.]+$/, '') + extension; }
  function timestampFromDate(value) { const time = Date.parse(value || ''); return Number.isFinite(time) ? time : 0; }
  function shellQuote(value) { return '"' + String(value || '').replace(/["\\$]/g, '\\$&') + '"'; }
  function downloadTextFile(filename, text, mime) { const blob = new Blob([text], { type: mime || 'text/plain' }); const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = filename; document.body.appendChild(anchor); anchor.click(); anchor.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
  function downloadTextFileByGM(filename, text, mime) { return new Promise((resolve, reject) => { const blob = new Blob([text], { type: mime || 'text/plain' }); const url = URL.createObjectURL(blob); const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 1000); GM_download({ url, name: filename, saveAs: false, onload: () => { cleanup(); resolve(); }, onerror: (error) => { cleanup(); reject(new Error(error && (error.error || error.details || error.toString()) || 'Download failed')); }, ontimeout: () => { cleanup(); reject(new Error('Download timed out')); } }); }); }
  function timestampForFile() { const d = new Date(); const pad = (n) => String(n).padStart(2, '0'); return d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '-' + pad(d.getHours()) + pad(d.getMinutes()) + pad(d.getSeconds()); }
  function clampInt(value, min, max, fallback) { const number = Number(value); if (!Number.isFinite(number)) return fallback; return Math.max(min, Math.min(max, Math.round(number))); }
  function addLog(text) { if (!text) return; const stamp = new Date().toLocaleTimeString(); state.logLines.push('[' + stamp + '] ' + text); if (state.logLines.length > 120) state.logLines.splice(0, state.logLines.length - 120); }
  function shortHash(value) { let hash = 0; String(value || '').split('').forEach((char) => { hash = ((hash << 5) - hash + char.charCodeAt(0)) | 0; }); return Math.abs(hash).toString(36); }
  function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
  function messageOf(error) { return error && (error.message || error.error || error.details || String(error)) || 'Unknown error'; }
  function byId(id) { return document.getElementById(id); }
  function setText(id, value) { const el = uiById(id); if (el) el.textContent = String(value); }
  function escHtml(value) { return String(value || '').replace(/[&<>]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch])); }
  function escAttr(value) { return escHtml(value).replace(/"/g, '&quot;'); }
  function makeDraggable(panel) { if (!panel) return; const head = panel.querySelector('.iwara-head'); if (!head) return; let dragging = false; let startX = 0; let startY = 0; let startRight = 0; let startBottom = 0; head.addEventListener('mousedown', (event) => { if (event.target.tagName === 'BUTTON') return; dragging = true; startX = event.clientX; startY = event.clientY; const rect = panel.getBoundingClientRect(); startRight = window.innerWidth - rect.right; startBottom = window.innerHeight - rect.bottom; event.preventDefault(); }); document.addEventListener('mousemove', (event) => { if (!dragging) return; panel.style.right = Math.max(0, startRight - (event.clientX - startX)) + 'px'; panel.style.bottom = Math.max(0, startBottom - (event.clientY - startY)) + 'px'; }); document.addEventListener('mouseup', () => { dragging = false; }); }
  window.addEventListener('beforeunload', persistStateNow);
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', main); else main();
}());
