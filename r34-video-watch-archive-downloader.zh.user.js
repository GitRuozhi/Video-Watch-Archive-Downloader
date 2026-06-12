// ==UserScript==
// @name         R34 Video Watch Archive Downloader _ ZH
// @namespace    https://github.com/GitRuozhi
// @license      MIT
// @version      4.7
// @description  Rule34video视频批量下载，观看视频自动归档下载。支持同步下载简介、Tag等作品元信息。支持浏览器直接下载、链接导出、YT-DLP下载命令导出。
// @author       GitRuozhi
// @match        https://rule34video.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @connect      rule34video.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORE_KEY = 'r34v_bulk_downloader_state_v2';
  const SETTINGS_KEY = 'r34v_bulk_downloader_settings_v3';
  const PANEL_ID = 'r34v-bulk-panel';

  const CONFIG = {
    DEFAULT_MAX_PAGES: 10,
    DEFAULT_RESOLVE_CONCURRENCY: 2,
    MAX_RESOLVE_CONCURRENCY: 8,
    DOWNLOAD_CONCURRENCY: 2,
    REQUEST_DELAY_MS: 700,
    DOWNLOAD_DELAY_MS: 900,
    PAGE_WAIT_MS: 12000,
    WATCHED_PAGE_DELAY_MS: 1000,
    WATCHED_CLICK_VALID_MS: 20000,
    WATCHED_DUPLICATE_MS: 1500,
    ROUTE_POLL_MS: 500,
    RETRY_LIMIT: 1,
    MEDIA_EXTENSIONS: ['.mp4', '.webm', '.m4v', '.mov'],
  };

  const STATUS = {
    PENDING: 'pending',
    FETCHING: 'fetching',
    READY: 'ready',
    DOWNLOADING: 'downloading',
    DONE: 'done',
    FAILED: 'failed',
  };

  const EXPORT_MODE = {
    DIRECT: 'direct',
    LINKS: 'links',
    YTDLP: 'ytdlp',
  };

  const DEFAULT_SETTINGS = {
    maxPages: CONFIG.DEFAULT_MAX_PAGES,
    resolveConcurrency: CONFIG.DEFAULT_RESOLVE_CONCURRENCY,
    quality: 'best',
    exportMode: EXPORT_MODE.DIRECT,
    keepId: true,
    keepTitle: true,
    keepOriginal: true,
    autoQueueSingle: true,
    autoDownloadSingle: false,
    downloadMetadata: true,
    advancedOpen: false,
  };

  const state = {
    tasks: [],
    seen: {},
    settings: { ...DEFAULT_SETTINGS },
    stats: {
      currentPage: 1,
      pagesCollected: 0,
      totalPages: 0,
    },
    collection: {
      active: false,
      stopped: false,
      startUrl: '',
      lastUrl: '',
      checkDuplicatesAfterWrap: false,
      wrapCount: 0,
    },
    fetching: false,
    downloading: false,
    downloadStopRequested: false,
    activeDownloads: 0,
    downloadRound: { success: 0 },
    downloadStats: { success: 0, failed: 0 },
    logLines: [],
  };

  const ui = {};
  let persistTimer = 0;
  let persistDirty = false;
  let applyingRemoteSettings = false;
  let autoDownloadTimer = 0;

  const watchedPage = {
    bound: false,
    domObserver: null,
    timer: 0,
    processing: false,
    rerunRequested: false,
    lastSource: '',
    lastClickedUrl: '',
    lastClickedAt: 0,
    lastObservedHref: '',
    routePollTimer: 0,
    lastItemKey: '',
    lastHandledAt: 0,
  };

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
    #${PANEL_ID}.r34v-minimized {
      width: auto;
      min-width: 0;
      background: rgba(0, 0, 0, 0.66);
    }
    #${PANEL_ID}.r34v-minimized .r34v-body,
    #${PANEL_ID}.r34v-minimized .r34v-stat,
    #${PANEL_ID}.r34v-minimized .r34v-spacer {
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
    #${PANEL_ID} .r34v-head {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px;
      cursor: move;
      user-select: none;
    }
    #${PANEL_ID} .r34v-toggle {
      width: 28px;
      min-width: 28px;
      padding: 0;
    }
    #${PANEL_ID} .r34v-body {
      padding: 0 5px 5px;
    }
    #${PANEL_ID} .r34v-row {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 4px;
    }
    #${PANEL_ID} .r34v-row:last-child {
      margin-bottom: 0;
    }
    #${PANEL_ID} .r34v-stat {
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: #d8d8d8;
    }
    #${PANEL_ID} .r34v-stat strong {
      color: #fff;
      font-weight: 700;
    }
    #${PANEL_ID} .r34v-spacer {
      flex: 1 1 auto;
    }
    #${PANEL_ID} .r34v-panel-button {
      min-width: 86px;
    }
    #${PANEL_ID} .r34v-main-button {
      min-width: 86px;
    }
    #${PANEL_ID} .r34v-advanced {
      display: none;
    }
    #${PANEL_ID}.r34v-advanced-open .r34v-advanced {
      display: block;
    }
    #${PANEL_ID} .r34v-max-pages,
    #${PANEL_ID} .r34v-concurrency {
      width: 25px;
      text-align: center;
    }
    #${PANEL_ID} .r34v-log {
      height: 150px;
      overflow: auto;
      padding: 5px;
      color: #d8d8d8;
      background: rgba(0, 0, 0, 0.34);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      font-family: Arial, Helvetica, sans-serif;
    }
    #${PANEL_ID} .r34v-progress {
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
    #${PANEL_ID} .r34v-download-mode {
      width: 80px;
    }
    #${PANEL_ID} .r34v-quality {
      width: 64px;
    }
  `;

  async function main() {
    restoreState();
    loadSettingsNow();
    injectStyle();
    createPanel();
    makeDraggable(ui.panel);
    bindSettings();
    bindSettingsSync();
    bindWatchedPageListeners();
    addLog('就绪。');
    updateUi();
    scheduleWatchedPageCheck('initial-load');
    scheduleAutoDownload('initial-load', CONFIG.WATCHED_PAGE_DELAY_MS);

    if (state.collection.active && !state.collection.stopped) {
      addLog('页面切换后恢复未完成的采集。');
      setTimeout(() => collectCurrentThenAdvance(true), 500);
    }
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createPanel() {
    const panel = document.createElement('section');
    panel.id = PANEL_ID;
    panel.innerHTML = `
      <div class="r34v-head">
        <span class="r34v-stat" title="已解析的项目">队列<strong id="r34v-captured">0</strong>　</span>
        <span class="r34v-stat" title="当前正在下载">下载<strong id="r34v-resolved">0</strong>　</span>
        <span class="r34v-stat" title="累计成功下载">成功<strong id="r34v-submitted">0</strong>　</span>
        <span class="r34v-stat" title="累计最终失败">失败<strong id="r34v-downloaded">0</strong>　</span>
        <span class="r34v-spacer"></span>
        <button type="button" id="r34v-toggle" class="r34v-toggle" title="展开面板/收缩面板">_</button>
      </div>
      <div class="r34v-body">
        <div class="r34v-row">
        <button type="button" id="r34v-clear" class="r34v-panel-button" title="清空队列、页数、日志和统计，不修改设置">初始化</button>
          <button type="button" id="r34v-collect-current" class="r34v-panel-button" title="采集当前页面">采集当前页</button>
          <button type="button" id="r34v-collect-toggle" class="r34v-panel-button" title="采集多个列表页">采集多页</button>
        </div>
        <div class="r34v-row">
          <button type="button" id="r34v-download" class="r34v-panel-button" title="提交队列下载/停止提交下载">开始下载</button>
          <button type="button" id="r34v-retry-failed" class="r34v-panel-button" title="重置失败任务后重新开始队列">再来一次</button>
          <button type="button" id="r34v-advanced-toggle" class="r34v-panel-button" title="显示或隐藏高级选项">高级选项</button>
        </div>
        <div class="r34v-progress" id="r34v-progress"></div>
        <div class="r34v-advanced" id="r34v-advanced">


        <div class="r34v-row">
            <span title="已完成采集的页数/查询到总页数">已采集 <strong id="r34v-pages-collected">0</strong>/<strong id="r34v-total-pages">0</strong> 页</span>
         </div>
          <div class="r34v-row">
            <label title="自动将已观看视频加入队列"><input type="checkbox" id="r34v-auto-queue">已看视频自动入队</label>
            <label title="入队后自动启动队列下载"><input type="checkbox" id="r34v-auto-download">自动下载</label>
            <label title="视频前先保存作品元信息 JSON"><input type="checkbox" id="r34v-download-metadata">下载作品元信息</label>
          </div>

          <div class="r34v-row">
            <label>下载并行
              <input id="r34v-resolve-concurrency" class="r34v-concurrency" type="number" min="1" max="8" step="1">
            </label>
            <span>一次性采集页数</span>
            <input id="r34v-max-pages" class="r34v-max-pages" type="number" min="1" max="64" step="1">
            <span></span>
          </div>
          <div class="r34v-row">
            <label>下载方式
              <select id="r34v-export-mode" class="r34v-download-mode">
                <option value="direct">浏览器</option>
                <option value="links">直链文本</option>
                <option value="ytdlp">YT-DLP</option>
              </select>
            </label>
            <label>清晰度
              <select id="r34v-quality" class="r34v-quality">
                <option value="best">最佳</option>
                <option value="4320p">8K</option>
                <option value="2160p">4K</option>
                <option value="1080p">1080p</option>
                <option value="720p">720p</option>
                <option value="480p">480p</option>
                <option value="360p">360p</option>
              </select>
            </label>
          </div>
          <div class="r34v-row">
            <span>文件名：</span>
            <label><input type="checkbox" id="r34v-keep-id">Id</label>
            <label><input type="checkbox" id="r34v-keep-title">标题</label>
            <label><input type="checkbox" id="r34v-keep-original">原文件名</label>
          </div>
          <div class="r34v-log" id="r34v-log"></div>
        </div>
      </div>
    `;
    document.body.appendChild(panel);
    cacheUi();

    uiById('r34v-collect-current').addEventListener('click', () => collectCurrentOnly());
    uiById('r34v-collect-toggle').addEventListener('click', togglePageCollection);
    uiById('r34v-download').addEventListener('click', () => startDownloads());
    uiById('r34v-retry-failed').addEventListener('click', retryFailedDownloads);
    uiById('r34v-clear').addEventListener('click', clearTasks);
    uiById('r34v-advanced-toggle').addEventListener('click', toggleAdvancedOptions);
    uiById('r34v-toggle').addEventListener('click', () => {
      panel.classList.toggle('r34v-minimized');
      uiById('r34v-toggle').textContent = panel.classList.contains('r34v-minimized') ? '+' : '_';
    });
  }

  function cacheUi() {
    [
      PANEL_ID,
      'r34v-captured',
      'r34v-resolved',
      'r34v-submitted',
      'r34v-downloaded',
      'r34v-toggle',
      'r34v-clear',
      'r34v-collect-current',
      'r34v-collect-toggle',
      'r34v-download',
      'r34v-retry-failed',
      'r34v-advanced-toggle',
      'r34v-auto-queue',
      'r34v-auto-download',
      'r34v-download-metadata',
      'r34v-resolve-concurrency',
      'r34v-pages-collected',
      'r34v-total-pages',
      'r34v-max-pages',
      'r34v-export-mode',
      'r34v-quality',
      'r34v-keep-id',
      'r34v-keep-title',
      'r34v-keep-original',
      'r34v-log',
      'r34v-progress',
    ].forEach((id) => {
      ui[id] = byId(id);
    });
    ui.panel = ui[PANEL_ID];
  }

  function uiById(id) {
    return ui[id] || byId(id);
  }

  function bindSettings() {
    applySettingsToUi();

    [
      'r34v-max-pages',
      'r34v-resolve-concurrency',
      'r34v-quality',
      'r34v-export-mode',
      'r34v-keep-id',
      'r34v-keep-title',
      'r34v-keep-original',
      'r34v-auto-queue',
      'r34v-auto-download',
      'r34v-download-metadata',
    ].forEach((id) => uiById(id).addEventListener('change', saveSettingsFromUi));
    uiById('r34v-resolve-concurrency').addEventListener('input', clampResolveConcurrencyInput);
  }

  function applySettingsToUi() {
    if (!uiById('r34v-max-pages')) return;
    uiById('r34v-max-pages').value = String(state.settings.maxPages);
    uiById('r34v-resolve-concurrency').value = String(state.settings.resolveConcurrency);
    uiById('r34v-quality').value = state.settings.quality;
    uiById('r34v-export-mode').value = state.settings.exportMode;
    uiById('r34v-keep-id').checked = state.settings.keepId;
    uiById('r34v-keep-title').checked = state.settings.keepTitle;
    uiById('r34v-keep-original').checked = state.settings.keepOriginal;
    uiById('r34v-auto-queue').checked = state.settings.autoQueueSingle;
    uiById('r34v-auto-download').checked = state.settings.autoDownloadSingle;
    uiById('r34v-download-metadata').checked = state.settings.downloadMetadata;
  }

  function clampResolveConcurrencyInput() {
    const input = uiById('r34v-resolve-concurrency');
    const value = Number(input.value);
    if (Number.isFinite(value) && value > CONFIG.MAX_RESOLVE_CONCURRENCY) {
      input.value = String(CONFIG.MAX_RESOLVE_CONCURRENCY);
    }
  }

  function saveSettingsFromUi() {
    if (applyingRemoteSettings) return;
    const maxPages = clampInt(uiById('r34v-max-pages').value, 1, 999, CONFIG.DEFAULT_MAX_PAGES);
    const resolveConcurrency = clampInt(
      uiById('r34v-resolve-concurrency').value,
      1,
      CONFIG.MAX_RESOLVE_CONCURRENCY,
      CONFIG.DEFAULT_RESOLVE_CONCURRENCY
    );

    state.settings.maxPages = maxPages;
    state.settings.resolveConcurrency = resolveConcurrency;
    state.settings.quality = uiById('r34v-quality').value;
    state.settings.exportMode = uiById('r34v-export-mode').value;
    state.settings.keepId = uiById('r34v-keep-id').checked;
    state.settings.keepTitle = uiById('r34v-keep-title').checked;
    state.settings.keepOriginal = uiById('r34v-keep-original').checked;
    state.settings.autoQueueSingle = uiById('r34v-auto-queue').checked;
    state.settings.autoDownloadSingle = uiById('r34v-auto-download').checked;
    state.settings.downloadMetadata = uiById('r34v-download-metadata').checked;

    uiById('r34v-max-pages').value = String(maxPages);
    uiById('r34v-resolve-concurrency').value = String(resolveConcurrency);

    state.tasks.forEach((task) => {
      applyQualitySelection(task);
      updateTaskFilename(task);
    });
    saveSettingsNow();
    persistState();
    if (state.settings.autoQueueSingle) {
      scheduleWatchedPageCheck('settings');
    }
    if (state.settings.autoDownloadSingle) {
      scheduleAutoDownload('settings');
    }
    updateUi();
  }

  function toggleAdvancedOptions() {
    state.settings.advancedOpen = !state.settings.advancedOpen;
    saveSettingsNow();
    persistState();
    updateUi();
  }

  function bindWatchedPageListeners() {
    if (watchedPage.bound) return;
    watchedPage.bound = true;
    watchedPage.lastObservedHref = normalizeUrl(location.href);

    document.addEventListener('click', handleWatchedPageClick, true);
    bindHistoryChangeCapture();
    bindWatchedDomObserver();

    window.addEventListener('load', () => scheduleWatchedPageCheck('load'));
    window.addEventListener('pageshow', () => scheduleWatchedPageCheck('pageshow'));
    window.addEventListener('popstate', () => scheduleWatchedPageCheck('popstate'));
    window.addEventListener('hashchange', () => scheduleWatchedPageCheck('hashchange'));

    watchedPage.routePollTimer = setInterval(() => {
      const current = normalizeUrl(location.href);
      if (current === watchedPage.lastObservedHref) return;
      watchedPage.lastObservedHref = current;
      scheduleWatchedPageCheck('url-poll');
    }, CONFIG.ROUTE_POLL_MS);
  }

  function handleWatchedPageClick(event) {
    const target = event.target;
    const anchor = target && target.closest ? target.closest('a[href*="/video/"]') : null;
    if (!anchor || isPanelNode(anchor)) return;

    const url = safeUrl(anchor.getAttribute('href'), location.href);
    if (!url || !isVideoPage(url.href)) return;

    watchedPage.lastClickedUrl = normalizeUrl(url.href);
    watchedPage.lastClickedAt = Date.now();
    scheduleWatchedPageCheck('click');
  }

  function bindHistoryChangeCapture() {
    const rawPushState = history.pushState;
    const rawReplaceState = history.replaceState;

    history.pushState = function (...args) {
      const result = rawPushState.apply(this, args);
      watchedPage.lastObservedHref = normalizeUrl(location.href);
      scheduleWatchedPageCheck('pushState');
      return result;
    };

    history.replaceState = function (...args) {
      const result = rawReplaceState.apply(this, args);
      watchedPage.lastObservedHref = normalizeUrl(location.href);
      scheduleWatchedPageCheck('replaceState');
      return result;
    };
  }

  function bindWatchedDomObserver() {
    if (watchedPage.domObserver) return;

    watchedPage.domObserver = new MutationObserver((mutations) => {
      if (!mutations.some(isRelevantPageMutation)) return;
      scheduleWatchedPageCheck('dom');
    });

    watchedPage.domObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  function isRelevantPageMutation(mutation) {
    if (isPanelNode(mutation.target)) return false;

    const nodes = Array.from(mutation.addedNodes || []).concat(Array.from(mutation.removedNodes || []));
    if (!nodes.length) return true;

    return nodes.some((node) => {
      if (isPanelNode(node)) return false;
      if (node.nodeType !== Node.ELEMENT_NODE) return false;
      if (node.matches && node.matches('a[download], style, script')) return false;
      return true;
    });
  }

  function isPanelNode(node) {
    if (!node) return false;
    const element = node.nodeType === Node.ELEMENT_NODE ? node : node.parentElement;
    if (!element) return false;
    if (element.id === PANEL_ID) return true;
    return Boolean(element.closest && element.closest(`#${PANEL_ID}`));
  }

  function scheduleWatchedPageCheck(source, delayMs = CONFIG.WATCHED_PAGE_DELAY_MS) {
    watchedPage.lastSource = source || watchedPage.lastSource || 'watch';
    clearTimeout(watchedPage.timer);
    watchedPage.timer = setTimeout(() => {
      runWatchedPageCheck(watchedPage.lastSource);
    }, delayMs);
  }

  async function runWatchedPageCheck(source) {
    if (!state.settings.autoQueueSingle) return;

    if (watchedPage.processing) {
      watchedPage.rerunRequested = true;
      return;
    }

    watchedPage.processing = true;
    watchedPage.rerunRequested = false;

    try {
      const postUrl = detectCurrentWatchedPostUrl();
      if (!postUrl) {
        watchedPage.lastItemKey = '';
        return;
      }

      const normalized = normalizeUrl(postUrl);
      const itemKey = watchedItemKey(normalized);
      const now = Date.now();

      if (itemKey && itemKey === watchedPage.lastItemKey && now - watchedPage.lastHandledAt < CONFIG.WATCHED_DUPLICATE_MS) {
        return;
      }

      if (itemKey && itemKey === watchedPage.lastItemKey) {
        return;
      }

      watchedPage.lastItemKey = itemKey;
      watchedPage.lastHandledAt = now;
      await queueWatchedVideo(normalized, source || 'watch');
    } catch (error) {
      addLog(`自动入队检查失败：${messageOf(error)}`);
      updateUi();
    } finally {
      watchedPage.processing = false;
      if (watchedPage.rerunRequested) {
        watchedPage.rerunRequested = false;
        scheduleWatchedPageCheck('rerun');
      }
    }
  }

  function detectCurrentWatchedPostUrl() {
    if (isVideoPage(location.href)) return normalizeUrl(location.href);

    if (isRecentClickedVideo() && hasInlineVideoSignal()) {
      return watchedPage.lastClickedUrl;
    }

    const canonical = document.querySelector('link[rel="canonical"][href]');
    if (canonical && isVideoPage(canonical.href) && hasInlineVideoSignal()) {
      return normalizeUrl(canonical.href);
    }

    const activeLink = document.querySelector([
      '[class*="popup"] a[href*="/video/"]',
      '[class*="modal"] a[href*="/video/"]',
      '[id*="popup"] a[href*="/video/"]',
      '[id*="modal"] a[href*="/video/"]',
      '[class*="player"] a[href*="/video/"]',
      '[id*="player"] a[href*="/video/"]',
    ].join(','));

    if (activeLink && isVideoPage(activeLink.href) && hasInlineVideoSignal()) {
      return normalizeUrl(activeLink.href);
    }

    return '';
  }

  function isRecentClickedVideo() {
    return Boolean(
      watchedPage.lastClickedUrl &&
      isVideoPage(watchedPage.lastClickedUrl) &&
      Date.now() - watchedPage.lastClickedAt <= CONFIG.WATCHED_CLICK_VALID_MS
    );
  }

  function hasInlineVideoSignal() {
    if (document.querySelector('video[src], video source[src], source[type*="video"][src]')) return true;
    if (document.documentElement && /\bvar\s+flashvars\s*=/i.test(document.documentElement.innerHTML)) return true;

    const roots = document.querySelectorAll([
      '[class*="popup"]',
      '[class*="modal"]',
      '[class*="overlay"]',
      '[id*="popup"]',
      '[id*="modal"]',
      '[id*="overlay"]',
      '[class*="player"]',
      '[id*="player"]',
    ].join(','));

    return Array.from(roots).some((root) => {
      if (isPanelNode(root)) return false;
      return Boolean(root.querySelector('video, source[type*="video"], a[href*="/video/"], [class*="video"], [id*="video"]'));
    });
  }

  function watchedItemKey(postUrl) {
    const id = extractPostId(postUrl);
    return id ? `id:${id}` : normalizeUrl(postUrl);
  }

  async function queueWatchedVideo(postUrl, source) {
    const normalized = normalizeUrl(postUrl);
    const wasAdded = addTask(normalized);
    const task = findTaskByPostUrl(normalized);

    if (!task) return false;

    if (wasAdded) {
      addLog(`已自动加入已看视频（${source}）：${normalized}`);
    }

    if (task.status === STATUS.PENDING) {
      await resolvePendingTasks([normalized]);
    }

    const resolvedTask = findTaskByPostUrl(normalized);
    if (!resolvedTask) return wasAdded;

    if (state.settings.autoDownloadSingle && resolvedTask.status === STATUS.READY && resolvedTask.videoUrl) {
      scheduleAutoDownload(`watched-${source}`, CONFIG.WATCHED_PAGE_DELAY_MS);
    }

    persistState();
    updateUi();
    return wasAdded;
  }

  async function collectCurrentOnly() {
    if (state.fetching) return;
    state.collection.active = false;
    state.collection.stopped = true;
    await collectCurrentPageVideos();
    scheduleAutoDownload('current-collection');
    persistState();
  }

  async function startPageCollection() {
    if (state.fetching) return;
    saveSettingsFromUi();
    state.collection.active = true;
    state.collection.stopped = false;
    state.collection.startUrl = normalizeUrl(location.href);
    state.collection.lastUrl = normalizeUrl(location.href);
    state.collection.checkDuplicatesAfterWrap = false;
    state.collection.wrapCount = 0;
    state.stats.currentPage = 1;
    state.stats.pagesCollected = 0;
    state.stats.totalPages = totalPageNumber(document);
    persistState();
    await collectCurrentThenAdvance(false);
  }

  function togglePageCollection() {
    if (state.collection.active || state.fetching) {
      stopCollection();
      return;
    }
    startPageCollection();
  }

  function stopCollection() {
    state.collection.active = false;
    state.collection.stopped = true;
    state.fetching = false;
    addLog('已停止。');
    persistState();
    updateUi();
  }

  async function collectCurrentThenAdvance(restored) {
    if (!state.collection.active || state.collection.stopped || state.fetching) return;
    const collectResult = await collectCurrentPageVideos();
    if (!state.collection.active || state.collection.stopped) return;

    if (state.collection.checkDuplicatesAfterWrap) {
      state.collection.checkDuplicatesAfterWrap = false;
      if (collectResult && collectResult.duplicates > 0) {
        state.collection.active = false;
        state.collection.stopped = true;
        addLog(`回到第一页后发现重复项目：${collectResult.duplicates}。采集已停止。`);
        scheduleAutoDownload('collection-finished');
        persistState();
        persistStateNow();
        updateUi('采集已停止：回到第一页后发现重复项目。');
        return;
      }
      addLog('回到第一页后未发现重复项目，继续采集。');
    }

    if (state.stats.currentPage >= state.settings.maxPages) {
      state.collection.active = false;
      addLog(`已达到最大采集页数：${state.settings.maxPages}。`);
      scheduleAutoDownload('collection-finished');
      persistState();
      updateUi('采集完成。');
      return;
    }

    let nextLink = findNextPageLink(document);
    let wrappedToFirst = false;
    if (!nextLink) {
      nextLink = findFirstPageLink(document);
      if (!nextLink) {
        state.collection.active = false;
        addLog('没有找到下一页或第一页链接。');
        scheduleAutoDownload('collection-finished');
        persistState();
        updateUi('采集完成。');
        return;
      }
      wrappedToFirst = true;
      state.collection.checkDuplicatesAfterWrap = true;
      state.collection.wrapCount = (state.collection.wrapCount || 0) + 1;
    }

    state.stats.currentPage += 1;
    state.collection.lastUrl = normalizeUrl(location.href);
    persistState();
    persistStateNow();
    addLog(wrappedToFirst
      ? `已到末页，跳回第一页（${state.stats.currentPage}/${state.settings.maxPages}）。`
      : `正在点击下一页（${state.stats.currentPage}/${state.settings.maxPages}）。`);
    updateUi(wrappedToFirst ? '正在跳回第一页...' : '正在等待下一页...');
    await clickNextAndContinue(nextLink, restored);
  }

  async function clickNextAndContinue(link) {
    const oldSignature = pageSignature();
    const oldHref = location.href;
    link.click();

    const changed = await waitForPageChange(oldSignature, oldHref);
    if (!changed) {
      addLog('点击下一页后列表未在超时前变化。');
      state.collection.active = false;
      scheduleAutoDownload('collection-finished');
      persistState();
      updateUi('采集已停止。');
      return;
    }

    await delay(CONFIG.REQUEST_DELAY_MS);
    collectCurrentThenAdvance(false);
  }

  async function collectCurrentPageVideos() {
    const result = { found: 0, added: 0, duplicates: 0, failed: false };
    if (state.fetching) return result;
    state.fetching = true;
    saveSettingsFromUi();
    updateUi('正在采集当前页...');

    try {
      if (isVideoPage(location.href)) {
        const added = await addCurrentVideoPage();
        result.found = 1;
        result.added = added ? 1 : 0;
        result.duplicates = added ? 0 : 1;
      } else {
        const urls = extractPostUrls(document, location.href);
        let added = 0;
        urls.forEach((url) => {
          if (addTask(url)) added += 1;
        });
        result.found = urls.length;
        result.added = added;
        result.duplicates = Math.max(0, urls.length - added);
        addLog(`第 ${state.stats.currentPage} 页：发现 ${urls.length} 个，新增 ${added} 个，重复 ${result.duplicates} 个。`);
      }

      await resolvePendingTasks();
      markPageCollected();
      updateUi('当前页采集完成。');
    } catch (error) {
      result.failed = true;
      addLog(`采集失败：${messageOf(error)}`);
      updateUi('采集失败。');
    } finally {
      state.fetching = false;
      persistState();
      updateUi();
    }
    return result;
  }

  async function addCurrentVideoPage() {
    if (!isVideoPage(location.href)) return false;
    const currentUrl = normalizeUrl(location.href);
    const added = addTask(currentUrl);
    if (added) addLog('当前视频已加入队列。');
    await resolvePendingTasks([currentUrl]);

    persistState();
    updateUi();
    return added;
  }

  function findTaskByPostUrl(postUrl) {
    const normalized = normalizeUrl(postUrl);
    return state.tasks.find((task) => normalizeUrl(task.postUrl) === normalized) || null;
  }

  function addTask(postUrl) {
    const normalized = normalizeUrl(postUrl);
    const id = extractPostId(normalized);
    const key = id ? `id:${id}` : normalized;
    if (state.seen[key]) return false;

    const task = {
      key,
      postUrl: normalized,
      videoUrl: '',
      title: '',
      postId: id,
      filename: '',
      originalFilename: '',
      selectedQuality: '',
      requestedQuality: state.settings.quality,
      availableQualities: [],
      metadata: {},
      status: STATUS.PENDING,
      error: '',
      retries: 0,
      downloadMetadataRequested: false,
      metaDownloadDone: false,
      videoDownloadSubmitted: false,
      videoDownloadDone: false,
      metaDownloadedAt: '',
      videoSubmittedAt: '',
      videoDownloadedAt: '',
      videoBytesLoaded: 0,
      videoBytesTotal: 0,
      videoProgressAt: '',
      videoSpeedBps: 0,
      finalFailureCounted: false,
      capturedAt: new Date().toISOString(),
    };

    state.seen[key] = true;
    state.tasks.push(task);
    persistState();
    return true;
  }

  async function resolvePendingTasks(onlyUrls) {
    const only = onlyUrls ? new Set(onlyUrls.map(normalizeUrl)) : null;
    const targets = state.tasks.filter((task) => task.status === STATUS.PENDING && (!only || only.has(normalizeUrl(task.postUrl))));
    if (!targets.length) return;

    const concurrency = clampInt(
      state.settings.resolveConcurrency,
      1,
      CONFIG.MAX_RESOLVE_CONCURRENCY,
      CONFIG.DEFAULT_RESOLVE_CONCURRENCY
    );
    let cursor = 0;

    async function worker() {
      while (cursor < targets.length) {
        const task = targets[cursor];
        cursor += 1;
        await resolveOneTask(task);
        await delay(CONFIG.REQUEST_DELAY_MS);
      }
    }

    await Promise.all(
      Array.from({ length: Math.min(concurrency, targets.length) }, () => worker())
    );
  }

  async function resolveOneTask(task) {
    task.status = STATUS.FETCHING;
    task.error = '';
    persistState();
    updateUi(`Resolving ${task.postUrl}`);

    try {
      const html = normalizeUrl(task.postUrl) === normalizeUrl(location.href)
        ? document.documentElement.outerHTML
        : await requestText(task.postUrl);
      const doc = parseHtml(html);
      const resolved = resolveVideoFromDocument(doc, task.postUrl);
      if (!resolved.videoUrl) throw new Error('未找到视频直链');

      task.videoUrl = resolved.videoUrl;
      task.title = resolved.title || task.title || extractTitle(doc);
      task.postId = resolved.id || task.postId || extractPostIdFromDocument(doc) || shortHash(task.postUrl);
      task.originalFilename = filenameFromUrl(task.videoUrl);
      task.selectedQuality = resolved.selectedQuality;
      task.requestedQuality = state.settings.quality;
      task.availableQualities = resolved.availableQualities;
      task.metadata = resolved.metadata;
      task.capturedAt = task.capturedAt || new Date().toISOString();
      updateTaskFilename(task);
      task.status = STATUS.READY;

      if (state.settings.quality !== 'best' && task.selectedQuality !== state.settings.quality) {
        addLog(`清晰度降级：${task.postId} ${displayQuality(state.settings.quality)} -> ${displayQuality(task.selectedQuality) || '可用最佳'}。`);
      }
    } catch (error) {
      task.status = STATUS.FAILED;
      task.error = messageOf(error);
      addLog(`解析失败：${task.postUrl} - ${task.error}`);
    }

    persistState();
    updateUi();
  }

  function resolveVideoFromDocument(doc, baseUrl) {
    const html = doc.documentElement.innerHTML;
    const flashvars = extractFlashvarsFromHtml(html);
    const jsonLdItems = extractJsonLd(doc);
    const meta = extractMetaTags(doc);
    const context = { doc, baseUrl, html, flashvars, jsonLdItems, meta };
    const qualities = extractQualitySources(context);
    const selected = selectQuality(qualities, state.settings.quality);
    const metadata = extractMetadata(context, qualities, selected);

    return {
      id: metadata.id || extractPostId(baseUrl),
      title: metadata.title || '',
      videoUrl: selected ? selected.url : '',
      selectedQuality: selected ? selected.label : '',
      availableQualities: qualities,
      metadata,
    };
  }

  function extractFlashvarsFromHtml(html) {
    const start = html.search(/\bvar\s+flashvars\s*=/i);
    if (start < 0) return {};

    const slice = html.slice(start, Math.min(html.length, start + 20000));
    const objectStart = slice.indexOf('{');
    if (objectStart < 0) return {};

    let depth = 0;
    let quote = '';
    let escaped = false;
    let end = -1;
    for (let i = objectStart; i < slice.length; i += 1) {
      const ch = slice[i];
      if (quote) {
        if (escaped) {
          escaped = false;
        } else if (ch === '\\') {
          escaped = true;
        } else if (ch === quote) {
          quote = '';
        }
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
      } else if (ch === '{') {
        depth += 1;
      } else if (ch === '}') {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    if (end < 0) return {};

    const objectText = slice.slice(objectStart + 1, end);
    const result = {};
    const pairRe = /([A-Za-z0-9_]+)\s*:\s*('(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|[^,\n\r}]+)/g;
    let match;
    while ((match = pairRe.exec(objectText))) {
      result[match[1]] = parseJsValue(match[2]);
    }
    return result;
  }

  function parseJsValue(value) {
    const trimmed = String(value || '').trim();
    if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
      return decodeJsString(trimmed.slice(1, -1));
    }
    if (trimmed === 'true') return true;
    if (trimmed === 'false') return false;
    return decodeHtmlEntities(trimmed);
  }

  function decodeJsString(value) {
    return String(value)
      .replace(/\\\//g, '/')
      .replace(/\\'/g, "'")
      .replace(/\\"/g, '"')
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t')
      .replace(/\\u([0-9a-f]{4})/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  function extractQualitySources(context) {
    const { doc, baseUrl, flashvars, jsonLdItems, html } = context;
    const sources = [];

    Object.keys(flashvars).forEach((key) => {
      if (!/^video(?:_alt)?_url\d*$/i.test(key) && key !== 'video_url') return;
      const url = safeUrl(flashvars[key], baseUrl);
      if (!url || !isMediaUrl(url.href)) return;
      const textKey = `${key}_text`;
      const label = normalizeQualityLabel(flashvars[textKey]) || qualityFromUrl(url.href) || 'unknown';
      const hdKey = `${key}_hd`;
      sources.push({
        label,
        height: qualityHeight(label),
        url: url.href,
        source: 'flashvars',
        hd: Boolean(flashvars[hdKey]),
      });
    });

    const directSelectors = [
      'video source[src]',
      'video[src]',
      'source[type*="video"][src]',
      'a[href*=".mp4"]',
      'a[href*=".webm"]',
      'a[href*=".m4v"]',
      'a[href*=".mov"]',
    ];
    directSelectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((el) => {
        const url = safeUrl(el.getAttribute('src') || el.getAttribute('href'), baseUrl);
        if (!url || !isMediaUrl(url.href)) return;
        const label = normalizeQualityLabel(el.textContent) || qualityFromUrl(url.href) || 'unknown';
        sources.push({
          label,
          height: qualityHeight(label),
          url: url.href,
          source: 'dom',
          hd: qualityHeight(label) >= 720,
        });
      });
    });

    jsonLdItems.forEach((item) => {
      const contentUrl = safeUrl(item.contentUrl, baseUrl);
      if (!contentUrl || !isMediaUrl(contentUrl.href)) return;
      const label = qualityFromUrl(contentUrl.href) || 'unknown';
      sources.push({
        label,
        height: qualityHeight(label),
        url: contentUrl.href,
        source: 'jsonld',
        hd: qualityHeight(label) >= 720,
      });
    });

    const htmlUrls = Array.from(html.matchAll(/https?:\/\/[^"'<>\\\s]+?\.(?:mp4|webm|m4v|mov)(?:\/)?(?:\?[^"'<>\\\s]*)?/gi))
      .map((match) => decodeHtmlEntities(match[0]));
    htmlUrls.forEach((rawUrl) => {
      const url = safeUrl(rawUrl, baseUrl);
      if (!url || !isMediaUrl(url.href)) return;
      const label = qualityFromUrl(url.href) || 'unknown';
      sources.push({
        label,
        height: qualityHeight(label),
        url: url.href,
        source: 'html',
        hd: qualityHeight(label) >= 720,
      });
    });

    return dedupeQualities(sources).sort((a, b) => b.height - a.height);
  }

  function dedupeQualities(sources) {
    const byUrl = {};
    sources.forEach((source) => {
      if (!source.url) return;
      if (!byUrl[source.url] || source.height > byUrl[source.url].height) byUrl[source.url] = source;
    });
    return Object.values(byUrl);
  }

  function selectQuality(qualities, requested) {
    if (!qualities.length) return null;
    const sorted = qualities.slice().sort((a, b) => b.height - a.height);
    if (requested === 'best') return sorted[0];
    const requestedHeight = qualityHeight(requested);
    return sorted.find((item) => item.height === requestedHeight) || sorted[0];
  }

  function extractMetadata(context, qualities, selected) {
    const { doc, baseUrl, flashvars, jsonLdItems, meta } = context;
    const videoObject = jsonLdItems.find((item) => String(item['@type'] || '').toLowerCase() === 'videoobject') || {};
    const pageTitle = extractTitle(doc);
    const id = String(flashvars.video_id || extractPostId(baseUrl) || '').trim();
    const title = normalizeWhitespace(flashvars.video_title || videoObject.name || pageTitle);

    return {
      id,
      title,
      pageUrl: normalizeUrl(baseUrl),
      capturedAt: new Date().toISOString(),
      selectedQuality: selected ? selected.label : '',
      requestedQuality: state.settings.quality,
      availableQualities: qualities,
      videoUrl: selected ? selected.url : '',
      originalFilename: selected ? filenameFromUrl(selected.url) : '',
      categories: unique(splitList(flashvars.video_categories).concat(extractPillTexts(doc, /\/categories\//i))),
      tags: unique(splitList(flashvars.video_tags).concat(extractPillTexts(doc, /\/tags\//i))),
      uploader: extractUploader(doc),
      models: unique(splitList(flashvars.video_models).concat(extractPillTexts(doc, /\/models\//i))),
      duration: videoObject.duration || textNearLabel(doc, /duration|时长/i),
      uploadDate: videoObject.uploadDate || textNearLabel(doc, /added|date|上传/i),
      views: extractInteractionCount(videoObject, 'WatchAction') || textNearLabel(doc, /views|播放/i),
      likes: extractInteractionCount(videoObject, 'LikeAction') || '',
      rating: textNearLabel(doc, /rating|评分/i),
      thumbnailUrl: videoObject.thumbnailUrl || meta['og:image'] || flashvars.preview_url || '',
      jsonLd: videoObject,
      meta,
    };
  }

  function extractJsonLd(doc) {
    const items = [];
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((script) => {
      try {
        const parsed = JSON.parse(script.textContent || '{}');
        if (Array.isArray(parsed)) items.push(...parsed);
        else items.push(parsed);
      } catch (_) {
        // Ignore malformed JSON-LD.
      }
    });
    return items;
  }

  function extractMetaTags(doc) {
    const result = {};
    doc.querySelectorAll('meta').forEach((el) => {
      const key = el.getAttribute('property') || el.getAttribute('name');
      const value = el.getAttribute('content');
      if (key && value) result[key] = value;
    });
    return result;
  }

  function extractInteractionCount(videoObject, actionName) {
    const list = Array.isArray(videoObject.interactionStatistic)
      ? videoObject.interactionStatistic
      : videoObject.interactionStatistic ? [videoObject.interactionStatistic] : [];
    const item = list.find((entry) => String(entry.interactionType || '').includes(actionName));
    return item ? String(item.userInteractionCount || '') : '';
  }

  function extractPillTexts(doc, hrefPattern) {
    const values = [];
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      if (!hrefPattern.test(anchor.getAttribute('href') || '')) return;
      const text = normalizeWhitespace(anchor.textContent);
      if (text && !/^all\b/i.test(text)) values.push(text);
    });
    return unique(values);
  }

  function extractUploader(doc) {
    const label = Array.from(doc.querySelectorAll('.label, dt, .info .title')).find((el) => /uploaded by|uploader|上传/i.test(el.textContent || ''));
    if (label) {
      const sibling = label.nextElementSibling;
      const text = normalizeWhitespace(sibling && sibling.textContent);
      if (text) return text;
    }

    const candidates = Array.from(doc.querySelectorAll('a[href*="/members/"], a[href*="/users/"], a[href*="/profile/"]'))
      .map((el) => normalizeWhitespace(el.textContent))
      .filter(Boolean);
    return candidates[0] || '';
  }

  function textNearLabel(doc, pattern) {
    const nodes = Array.from(doc.querySelectorAll('.label, dt, span, div')).filter((el) => pattern.test(el.textContent || ''));
    for (const node of nodes) {
      const next = node.nextElementSibling;
      const text = normalizeWhitespace(next && next.textContent);
      if (text && text.length < 100) return text;
    }
    return '';
  }

  function extractPostUrls(doc, baseUrl) {
    const urls = new Set();
    const selectors = [
      '.thumbs .item a[href*="/video/"]',
      '.js-open-popup[href*="/video/"]',
      'a[href*="/video/"]',
    ];
    selectors.forEach((selector) => {
      doc.querySelectorAll(selector).forEach((anchor) => {
        const url = safeUrl(anchor.getAttribute('href'), baseUrl);
        if (!url || url.origin !== location.origin || !isVideoPage(url.href)) return;
        urls.add(normalizeUrl(url.href));
      });
    });
    return Array.from(urls);
  }

  function findNextPageLink(doc) {
    const paginationRoots = Array.from(doc.querySelectorAll('[id*="pagination"], .pagination, .page, .paging'));
    const roots = paginationRoots.length ? paginationRoots : [doc];
    const links = roots.flatMap((root) => Array.from(root.querySelectorAll('a[href]')));
    const currentNumber = currentPageNumber(doc) || state.stats.currentPage;

    const numeric = links
      .map((link) => ({ link, num: Number(normalizeWhitespace(link.textContent)) }))
      .filter((item) => Number.isFinite(item.num) && item.num > currentNumber)
      .sort((a, b) => a.num - b.num)[0];
    if (numeric) return numeric.link;

    const relNext = doc.querySelector('a[rel="next"][href]');
    if (relNext) return relNext;

    return links.find((link) => /^(next|>|next\s*>|older|下一页|下页)$/i.test(normalizeWhitespace(link.textContent))) || null;
  }

  function findFirstPageLink(doc) {
    const relFirst = doc.querySelector('a[rel="first"][href]');
    if (relFirst) return relFirst;

    const paginationRoots = Array.from(doc.querySelectorAll('[id*="pagination"], .pagination, .page, .paging'));
    const roots = paginationRoots.length ? paginationRoots : [doc];
    const links = roots.flatMap((root) => Array.from(root.querySelectorAll('a[href]')));

    const numeric = links
      .map((link) => ({ link, num: Number(normalizeWhitespace(link.textContent)) }))
      .filter((item) => Number.isFinite(item.num) && item.num === 1)
      .sort((a, b) => a.link.href.length - b.link.href.length)[0];
    if (numeric) return numeric.link;

    return links.find((link) => /^(first|<<|<\s*<|首页|第一页)$/i.test(normalizeWhitespace(link.textContent))) || null;
  }

  function currentPageNumber(doc) {
    const active = doc.querySelector('[id*="pagination"] .active, .pagination .active, .page .active, .paging .active');
    if (!active) return 0;

    const activeLink = active.matches && active.matches('a') ? active : active.querySelector && active.querySelector('a');
    if (activeLink) {
      const fromData = pageNumberFromDataParameters(activeLink.getAttribute('data-parameters'));
      if (fromData > 0) return fromData;

      const fromHref = pageNumberFromHref(activeLink.getAttribute('href'));
      if (fromHref > 0) return fromHref;
    }

    const value = Number(normalizeWhitespace(active.textContent));
    return Number.isFinite(value) && value > 0 ? value : 0;
  }

  function totalPageNumber(doc) {
    const numbers = paginationPageNumbers(doc);
    const current = currentPageNumber(doc);
    if (current > 0) numbers.push(current);

    const text = normalizeWhitespace(Array.from(doc.querySelectorAll('[id*="pagination"], .pagination, .page, .paging'))
      .map((node) => node.textContent)
      .join(' '));
    const totalMatch = text.match(/(?:of|共|\/|total)\s*(\d{1,6})(?:\s*页|\s*pages?)?/i)
      || text.match(/(?:page|第)\s*\d{1,6}\s*(?:of|\/|共)\s*(\d{1,6})/i);
    if (totalMatch) numbers.push(Number(totalMatch[1]));

    const max = numbers.filter((value) => Number.isFinite(value) && value > 0).sort((a, b) => b - a)[0] || 0;
    if (max > 0) return max;

    if (!isVideoPage(location.href) && extractPostUrls(doc, location.href).length > 0) return 1;
    return 0;
  }

  function paginationPageNumbers(doc) {
    const roots = paginationRoots(doc);
    const numbers = [];

    roots.forEach((root) => {
      root.querySelectorAll('a, span, li, strong, em, b').forEach((node) => {
        const text = normalizeWhitespace(node.textContent);
        if (/^\d{1,6}$/.test(text)) numbers.push(Number(text));

        const dataParams = node.getAttribute && node.getAttribute('data-parameters');
        const dataNumber = pageNumberFromDataParameters(dataParams);
        if (dataNumber > 0) numbers.push(dataNumber);

        const href = node.getAttribute && node.getAttribute('href');
        const hrefNumber = pageNumberFromHref(href);
        if (hrefNumber > 0) numbers.push(hrefNumber);
      });
    });

    return numbers;
  }

  function paginationRoots(doc) {
    const roots = Array.from(doc.querySelectorAll('[id*="pagination"], .pagination, .page, .paging'));
    return roots.length ? roots : [];
  }

  function pageNumberFromDataParameters(value) {
    const text = String(value || '');
    if (!text) return 0;

    const patterns = [
      /(?:^|[;,&])from_videos\s*:\s*0*(\d{1,6})(?=$|[;,&])/i,
      /(?:^|[;,&])from_albums\s*:\s*0*(\d{1,6})(?=$|[;,&])/i,
      /(?:^|[;,&])from\s*:\s*0*(\d{1,6})(?=$|[;,&])/i,
      /(?:^|[;,&])page\s*:\s*0*(\d{1,6})(?=$|[;,&])/i,
      /(?:^|[;,&])p\s*:\s*0*(\d{1,6})(?=$|[;,&])/i,
    ];

    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (!match) continue;

      const number = Number(match[1]);
      if (Number.isFinite(number) && number > 0) return number;
    }

    return 0;
  }

  function pageNumberFromHref(href) {
    if (!href) return 0;
    try {
      const parsed = new URL(href, location.href);

      const pageParamKeys = ['page', 'p', 'pg'];
      for (const key of pageParamKeys) {
        const value = parsed.searchParams.get(key);
        if (/^\d{1,6}$/.test(value || '')) return Number(value);
      }

      const dataParamKeys = ['from_videos', 'from_albums', 'from'];
      for (const key of dataParamKeys) {
        const value = parsed.searchParams.get(key);
        if (/^\d{1,6}$/.test(value || '')) return Number(value);
      }

      const explicitPathMatch = parsed.pathname.match(/(?:\/page\/|\/p\/)(\d{1,6})(?:\/|$)/i);
      if (explicitPathMatch) return Number(explicitPathMatch[1]);

      if (isNonPaginationProfileUrl(parsed)) return 0;

      const trailingMatch = parsed.pathname.match(/\/(\d{1,6})\/?$/);
      if (!trailingMatch) return 0;

      const pageNumber = Number(trailingMatch[1]);
      if (!Number.isFinite(pageNumber) || pageNumber <= 0) return 0;
      if (!looksLikeSamePaginationBase(parsed)) return 0;

      return pageNumber;
    } catch (_) {
      // Ignore invalid pagination URLs.
    }
    return 0;
  }

  function isNonPaginationProfileUrl(parsed) {
    const path = parsed.pathname || '';
    if (/^\/members\/\d+\/?$/i.test(path)) return true;
    if (/^\/users\/\d+\/?$/i.test(path)) return true;
    if (/^\/profile\/\d+\/?$/i.test(path)) return true;

    const hash = String(parsed.hash || '').replace(/^#/, '');
    if (/^(videos|albums|favorites|favourites|comments|playlists|channels)$/i.test(hash)) return true;

    return false;
  }

  function looksLikeSamePaginationBase(parsed) {
    try {
      const current = new URL(location.href);
      if (parsed.origin !== current.origin) return false;

      const targetBase = stripTrailingPageNumber(parsed.pathname);
      const currentBase = stripTrailingPageNumber(current.pathname);

      return targetBase === currentBase;
    } catch (_) {
      return false;
    }
  }

  function stripTrailingPageNumber(pathname) {
    return String(pathname || '')
      .replace(/\/\d{1,6}\/?$/, '/')
      .replace(/\/+/g, '/')
      .replace(/\/+$|^$/g, '/') || '/';
  }

  function refreshTotalPagesFromDocument() {
    state.stats.totalPages = totalPageNumber(document);
  }

  function markPageCollected() {
    const current = Math.max(0, Number(state.stats.pagesCollected) || 0);
    const total = totalPages() || Math.max(0, Number(state.settings.maxPages) || 0);
    const next = current + 1;
    state.stats.pagesCollected = total ? Math.min(next, total) : next;
  }

  function waitForPageChange(oldSignature, oldHref) {
    return new Promise((resolve) => {
      let done = false;
      const finish = (value) => {
        if (done) return;
        done = true;
        observer.disconnect();
        clearInterval(interval);
        clearTimeout(timeout);
        resolve(value);
      };

      const changed = () => location.href !== oldHref || pageSignature() !== oldSignature;
      const observer = new MutationObserver(() => {
        if (changed()) finish(true);
      });
      observer.observe(document.body, { childList: true, subtree: true });
      const interval = setInterval(() => {
        if (changed()) finish(true);
      }, 250);
      const timeout = setTimeout(() => finish(changed()), CONFIG.PAGE_WAIT_MS);
    });
  }

  function pageSignature() {
    return extractPostUrls(document, location.href).join('|') || normalizeWhitespace(document.title);
  }

  function scheduleAutoDownload(reason, delayMs = 0) {
    if (!state.settings.autoDownloadSingle) return;
    clearTimeout(autoDownloadTimer);
    autoDownloadTimer = setTimeout(() => {
      autoDownloadTimer = 0;
      if (!state.settings.autoDownloadSingle || state.downloading || state.fetching || state.collection.active) return;
      if (!state.tasks.some(isDownloadableTask)) return;
      startDownloads('auto');
    }, delayMs);
  }

  function startDownloads(source = 'manual') {
    if (state.downloading) {
      if (source === 'manual') stopDownloads();
      return;
    }
    saveSettingsFromUi();
    if (state.settings.exportMode !== EXPORT_MODE.DIRECT) {
      saveOutputFiles();
      return;
    }
    state.downloadStopRequested = false;
    state.downloading = true;
    state.downloadRound = { success: 0 };
    addLog('浏览器下载队列已开始。');
    persistState();
    updateUi();
    pumpDownloads();
  }

  function retryFailedDownloads() {
    if (state.downloading || state.fetching || state.collection.active) return;
    saveSettingsFromUi();
    const retryCount = resetFailedTasksForRetry();
    if (!retryCount) {
      addLog('没有失败下载需要重试。');
      updateUi();
      return;
    }
    addLog(`重新下载失败项：${retryCount}。`);
    persistState();
    updateUi();
    startDownloads('retry');
  }

  function stopDownloads() {
    state.downloading = false;
    state.downloadStopRequested = true;
    addLog('已停止继续提交队列，正在下载的任务可能仍会在浏览器中继续。');
    persistState();
    updateUi();
  }

  function pumpDownloads() {
    if (!state.downloading || state.downloadStopRequested) return;

    while (state.activeDownloads < CONFIG.DOWNLOAD_CONCURRENCY) {
      const task = nextDownloadTask({ logRetry: true });
      if (!task) break;
      downloadTask(task);
    }

    if (state.activeDownloads === 0 && !nextDownloadTask()) {
      finishDownloadRound();
    }
  }

  function nextDownloadTask(options = {}) {
    const task = state.tasks.find((item) => (
      item.status === STATUS.READY ||
      (item.status === STATUS.FAILED && item.videoUrl && item.retries <= CONFIG.RETRY_LIMIT)
    ));
    if (task && options.logRetry && task.status === STATUS.FAILED) {
      addLog(`自动重试 ${task.retries}/${CONFIG.RETRY_LIMIT}：${task.filename}`);
    }
    return task;
  }

  function isDownloadableTask(task) {
    return Boolean(task && task.videoUrl && (
      task.status === STATUS.READY ||
      (task.status === STATUS.FAILED && task.videoUrl && task.retries <= CONFIG.RETRY_LIMIT)
    ));
  }

  function downloadTask(task) {
    task.status = STATUS.DOWNLOADING;
    task.error = '';
    task.downloadMetadataRequested = Boolean(state.settings.downloadMetadata);
    task.videoDownloadSubmitted = false;
    task.videoDownloadDone = false;
    task.videoSubmittedAt = '';
    task.videoDownloadedAt = '';
    state.activeDownloads += 1;
    persistState();
    updateUi();

    if (!task.downloadMetadataRequested || task.metaDownloadDone) {
      addLog(`正在提交视频：${task.filename}`);
      downloadVideoForTask(task);
      return;
    }

    addLog(`先下载元信息：${replaceExtension(task.filename, '.meta.json')}`);
    downloadMetaForTask(task)
      .then(() => {
        task.metaDownloadDone = true;
        task.metaDownloadedAt = new Date().toISOString();
        persistState();
        updateUi();
        addLog(`元信息完成：${replaceExtension(task.filename, '.meta.json')}`);
        addLog(`正在提交视频：${task.filename}`);
        downloadVideoForTask(task);
      })
      .catch((error) => {
        finishDownload(task, false, `元信息下载失败：${messageOf(error)}`);
      });
  }

  function downloadMetaForTask(task) {
    const metaName = replaceExtension(task.filename, '.meta.json');
    const metaText = JSON.stringify(buildTaskMetadata(task), null, 2);
    return downloadTextFileByGM(metaName, metaText, 'application/json');
  }

  function downloadVideoForTask(task) {
    resetDownloadProgress(task);
    task.videoDownloadSubmitted = true;
    task.videoSubmittedAt = new Date().toISOString();
    persistState();
    updateUi();

    GM_download({
      url: task.videoUrl,
      name: task.filename,
      saveAs: false,
      onload: () => {
        task.videoDownloadDone = true;
        task.videoDownloadedAt = new Date().toISOString();
        finishDownload(task, isTaskDownloadComplete(task));
      },
      onprogress: (event) => updateVideoProgress(task, event),
      onerror: (error) => finishDownload(task, false, error && (error.error || error.details || error.toString())),
      ontimeout: () => finishDownload(task, false, 'Download timed out'),
    });
  }

  function resetDownloadProgress(task) {
    task.videoBytesLoaded = 0;
    task.videoBytesTotal = 0;
    task.videoProgressAt = '';
    task.videoSpeedBps = 0;
  }

  function countFinalFailure(task) {
    if (task.finalFailureCounted) return;
    state.downloadStats.failed += 1;
    task.finalFailureCounted = true;
  }

  function updateVideoProgress(task, event) {
    const now = Date.now();
    const loaded = Math.max(0, Number(event && event.loaded) || 0);
    const rawTotal = Math.max(0, Number(event && event.total) || 0);
    const total = event && event.lengthComputable === false ? 0 : rawTotal;
    const previousLoaded = Math.max(0, Number(task.videoBytesLoaded) || 0);
    const previousAt = Number(task.videoProgressAt) || 0;

    if (previousAt && loaded >= previousLoaded) {
      const seconds = (now - previousAt) / 1000;
      if (seconds > 0) {
        task.videoSpeedBps = (loaded - previousLoaded) / seconds;
      }
    }

    task.videoBytesLoaded = loaded;
    task.videoBytesTotal = total;
    task.videoProgressAt = now;
    updateUi();
  }

  function buildActiveProgressLines() {
    return state.tasks
      .filter((task) => task.status === STATUS.DOWNLOADING && task.videoDownloadSubmitted)
      .map(buildProgressLine);
  }

  function buildProgressLine(task) {
    const loaded = Math.max(0, Number(task.videoBytesLoaded) || 0);
    const total = Math.max(0, Number(task.videoBytesTotal) || 0);
    const speed = Math.max(0, Number(task.videoSpeedBps) || 0);
    const percent = total ? `${Math.min(100, Math.floor((loaded / total) * 100))}%` : '--%';
    const totalText = total ? formatCompactBytes(total) : '?';
    const eta = total && speed > 0 ? formatCompactEta((total - loaded) / speed) : '--:--';
    return `${compactFilename(task.filename, 11)}|${percent}|${formatCompactBytes(loaded)}/${totalText}|${formatCompactSpeed(speed)}|${eta}`;
  }

  function formatCompactBytes(bytes) {
    const value = Math.max(0, Number(bytes) || 0);
    if (value >= 1073741824) return `${Math.round(value / 1073741824)}G`;
    if (value >= 1048576) return `${Math.round(value / 1048576)}M`;
    if (value >= 1024) return `${Math.round(value / 1024)}K`;
    return `${Math.round(value)}B`;
  }

  function formatCompactSpeed(bytesPerSecond) {
    return `${formatCompactBytes(bytesPerSecond)}/s`;
  }

  function formatCompactEta(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return '--:--';
    const total = Math.ceil(seconds);
    const minutes = Math.floor(total / 60);
    const remainder = total % 60;
    return `${minutes}:${String(remainder).padStart(2, '0')}`;
  }

  function compactFilename(filename, maxLength) {
    const text = String(filename || '');
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(1, maxLength - 3))}...`;
  }

  function isTaskDownloadComplete(task) {
    return Boolean(task.videoDownloadDone && (!task.downloadMetadataRequested || task.metaDownloadDone));
  }

  function downloadTextFileByGM(filename, text, mime) {
    return new Promise((resolve, reject) => {
      const blob = new Blob([text], { type: `${mime};charset=utf-8` });
      const url = URL.createObjectURL(blob);
      const cleanup = () => setTimeout(() => URL.revokeObjectURL(url), 1000);

      GM_download({
        url,
        name: filename,
        saveAs: false,
        onload: () => {
          cleanup();
          resolve();
        },
        onerror: (error) => {
          cleanup();
          reject(new Error(error && (error.error || error.details || error.toString()) || 'Download failed'));
        },
        ontimeout: () => {
          cleanup();
          reject(new Error('Download timed out'));
        },
      });
    });
  }

  function finishDownload(task, ok, errorText) {
    if (ok) {
      task.status = STATUS.DONE;
      addLog(errorText ? `下载完成：${task.filename}；${errorText}` : `下载完成：${task.filename}`);
      state.downloadRound.success += 1;
      state.downloadStats.success += 1;
      removeCompletedTask(task);
    } else {
      task.retries += 1;
      task.status = STATUS.FAILED;
      task.error = errorText || '下载失败';
      if (task.retries > CONFIG.RETRY_LIMIT) countFinalFailure(task);
      addLog(`下载失败：${task.filename} - ${task.error}`);
    }

    state.activeDownloads = Math.max(0, state.activeDownloads - 1);
    persistState();
    updateUi();
    if (state.downloading && !state.downloadStopRequested) {
      setTimeout(pumpDownloads, CONFIG.DOWNLOAD_DELAY_MS);
    }
  }

  function finishDownloadRound() {
    const doneCount = state.downloadRound.success || 0;
    const failedCount = state.tasks.filter((task) => task.status === STATUS.FAILED && task.videoUrl).length;

    state.downloading = false;
    state.downloadStopRequested = false;
    addLog(`下载轮次完成：成功 ${doneCount}，失败 ${failedCount}。`);
    persistState();
    updateUi();
  }

  function removeCompletedTask(task) {
    const index = state.tasks.indexOf(task);
    if (index >= 0) state.tasks.splice(index, 1);
    rebuildSeenFromTasks();
  }

  function rebuildSeenFromTasks() {
    state.seen = {};
    state.tasks.forEach((task) => {
      state.seen[task.key || (task.postId ? `id:${task.postId}` : normalizeUrl(task.postUrl))] = true;
    });
  }

  function resetFailedTasksForRetry() {
    let count = 0;
    state.tasks.forEach((task) => {
      if (task.status !== STATUS.FAILED || !task.videoUrl) return;
      task.status = STATUS.READY;
      task.retries = 0;
      task.error = '';
      task.videoDownloadSubmitted = false;
      task.videoDownloadDone = false;
      task.videoSubmittedAt = '';
      task.videoDownloadedAt = '';
      resetDownloadProgress(task);
      task.finalFailureCounted = false;
      count += 1;
    });
    return count;
  }

  function saveOutputFiles() {
    const stamp = timestampForFile();
    const mainText = buildExportText();
    const metaText = buildMetaJsonl();
    if (!mainText && !metaText) {
      addLog('没有已解析的视频可输出。');
      updateUi();
      return;
    }

    if (mainText) {
      const name = state.settings.exportMode === EXPORT_MODE.YTDLP
        ? `r34video-ytdlp-${stamp}.txt`
        : `r34video-links-${stamp}.txt`;
      downloadTextFile(name, mainText, 'text/plain');
    }

    if (metaText) {
      downloadTextFile(`r34video-meta-${stamp}.jsonl`, metaText, 'application/json');
    }

    addLog(state.settings.exportMode === EXPORT_MODE.YTDLP ? 'YT-DLP 输出文件已保存。' : '直链输出文件已保存。');
    updateUi();
  }

  function buildExportText() {
    const ready = state.tasks.filter((task) => task.videoUrl);
    if (state.settings.exportMode === EXPORT_MODE.YTDLP) {
      return ready.map((task) => `yt-dlp -o ${shellQuote(task.filename)} ${shellQuote(task.videoUrl)}`).join('\n');
    }
    return ready.map((task) => task.videoUrl).join('\n');
  }

  function buildMetaJsonl() {
    return state.tasks
      .filter((task) => task.videoUrl)
      .map((task) => JSON.stringify(buildTaskMetadata(task)))
      .join('\n');
  }

  function buildTaskMetadata(task) {
    return {
      ...task.metadata,
      id: task.postId || task.metadata.id || '',
      title: task.title || task.metadata.title || '',
      pageUrl: task.postUrl,
      capturedAt: task.capturedAt,
      selectedQuality: task.selectedQuality,
      requestedQuality: task.requestedQuality,
      availableQualities: task.availableQualities,
      videoUrl: task.videoUrl,
      originalFilename: task.originalFilename,
      filename: task.filename,
      status: task.status,
      error: task.error,
      downloadMetadataRequested: Boolean(task.downloadMetadataRequested),
      metaDownloadDone: Boolean(task.metaDownloadDone),
      videoDownloadSubmitted: Boolean(task.videoDownloadSubmitted),
      videoDownloadDone: Boolean(task.videoDownloadDone),
      metaDownloadedAt: task.metaDownloadedAt || '',
      videoSubmittedAt: task.videoSubmittedAt || '',
      videoDownloadedAt: task.videoDownloadedAt || '',
    };
  }

  function clearTasks() {
    if (state.downloading || state.fetching || state.collection.active) {
      addLog('请先停止当前任务再初始化。');
      updateUi();
      return;
    }

    state.tasks = [];
    state.seen = {};
    state.stats = { currentPage: 1, pagesCollected: 0, totalPages: 0 };
    state.collection = { active: false, stopped: true, startUrl: '', lastUrl: '', checkDuplicatesAfterWrap: false, wrapCount: 0 };
    state.downloading = false;
    state.downloadStopRequested = false;
    state.activeDownloads = 0;
    state.downloadRound = { success: 0 };
    state.downloadStats = { success: 0, failed: 0 };
    state.logLines = [];
    clearTimeout(autoDownloadTimer);
    autoDownloadTimer = 0;
    GM_deleteValue(STORE_KEY);
    addLog('已初始化。');
    updateUi();
  }

  function updateTaskFilename(task) {
    task.filename = buildFilename(task);
    task.metadata.filename = task.filename;
    task.metadata.originalFilename = task.originalFilename;
  }

  function applyQualitySelection(task) {
    if (!Array.isArray(task.availableQualities) || !task.availableQualities.length) return;
    const selected = selectQuality(task.availableQualities, state.settings.quality);
    if (!selected) return;
    task.videoUrl = selected.url;
    task.selectedQuality = selected.label;
    task.requestedQuality = state.settings.quality;
    task.originalFilename = filenameFromUrl(selected.url);
    task.metadata.videoUrl = selected.url;
    task.metadata.selectedQuality = selected.label;
    task.metadata.requestedQuality = state.settings.quality;
    task.metadata.originalFilename = task.originalFilename;
  }

  function buildFilename(task) {
    const ext = extensionFromUrl(task.videoUrl) || extensionFromFilename(task.originalFilename) || '.mp4';
    const id = sanitizeFilename(task.postId || task.metadata.id || '');
    const title = sanitizeFilename(task.title || task.metadata.title || '');
    const original = sanitizeFilename(stripExtension(task.originalFilename || filenameFromUrl(task.videoUrl)));

    const parts = [];
    if (state.settings.keepId && id) parts.push(id);
    if (state.settings.keepTitle && title) parts.push(title);
    if (state.settings.keepOriginal && original && !parts.includes(original)) parts.push(original);

    const fallback = id || shortHash(task.videoUrl || task.postUrl);
    const base = parts.length ? parts.join('_') : fallback;
    return `${truncateFilename(base, 170)}${ext}`;
  }

  function updateUi(statusText) {
    if (!uiById('r34v-captured')) return;
    if (statusText) addLog(statusText);
    refreshTotalPagesFromDocument();
    const parseStats = getParseStats();

    setText('r34v-captured', parseStats.captured);
    setText('r34v-resolved', parseStats.resolved);
    setText('r34v-submitted', parseStats.submitted);
    setText('r34v-downloaded', parseStats.downloaded);
    setText('r34v-pages-collected', pagesCollected());
    setText('r34v-total-pages', totalPages());

    const logEl = uiById('r34v-log');
    logEl.textContent = state.logLines.slice(-80).join('\n');
    logEl.scrollTop = logEl.scrollHeight;

    const progressEl = uiById('r34v-progress');
    const progressLines = buildActiveProgressLines();
    progressEl.textContent = progressLines.join('\n');
    progressEl.style.display = progressLines.length ? 'block' : 'none';

    ui.panel.classList.toggle('r34v-advanced-open', Boolean(state.settings.advancedOpen));
    uiById('r34v-collect-current').disabled = state.fetching || state.collection.active;
    uiById('r34v-collect-toggle').disabled = state.fetching && !state.collection.active;
    uiById('r34v-collect-toggle').textContent = state.collection.active ? '停止采集' : '采集多页';
    uiById('r34v-clear').disabled = state.fetching || state.downloading || state.collection.active;
    const downloadDisabled = state.downloading
      ? false
      : (state.settings.autoDownloadSingle || state.activeDownloads > 0 || !state.tasks.some((task) => task.videoUrl));
    uiById('r34v-download').disabled = downloadDisabled;
    uiById('r34v-download').textContent = state.downloading ? '停止提交' : '开始下载';
    uiById('r34v-download').title = state.downloading
      ? '停止继续提交新下载，已提交到浏览器的下载可能继续'
      : '开始提交队列下载';
    uiById('r34v-retry-failed').disabled = state.downloading || state.fetching || state.collection.active || !state.tasks.some((task) => task.status === STATUS.FAILED);
    uiById('r34v-advanced-toggle').textContent = state.settings.advancedOpen ? '收起选项' : '高级选项';
  }

  function getParseStats() {
    const queue = state.tasks.filter((task) => Boolean(task.videoUrl)).length;
    const active = Math.max(
      Math.max(0, Number(state.activeDownloads) || 0),
      state.tasks.filter((task) => task.status === STATUS.DOWNLOADING).length
    );
    const success = Math.max(0, Number(state.downloadStats.success) || 0);
    const failed = Math.max(0, Number(state.downloadStats.failed) || 0);
    return {
      captured: queue,
      success,
      failed,
      resolved: active,
      submitted: success,
      downloaded: failed,
    };
  }

  function pagesCollected() {
    return Math.max(0, Number(state.stats.pagesCollected) || 0);
  }

  function totalPages() {
    return Math.max(0, Number(state.stats.totalPages) || 0);
  }

  function normalizeSettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const merged = { ...DEFAULT_SETTINGS, ...source };
    merged.maxPages = clampInt(merged.maxPages, 1, 999, CONFIG.DEFAULT_MAX_PAGES);
    merged.resolveConcurrency = clampInt(
      merged.resolveConcurrency,
      1,
      CONFIG.MAX_RESOLVE_CONCURRENCY,
      CONFIG.DEFAULT_RESOLVE_CONCURRENCY
    );
    merged.keepId = Boolean(merged.keepId);
    merged.keepTitle = Boolean(merged.keepTitle);
    merged.keepOriginal = Boolean(merged.keepOriginal);
    merged.autoQueueSingle = Boolean(merged.autoQueueSingle);
    merged.autoDownloadSingle = Boolean(merged.autoDownloadSingle);
    merged.downloadMetadata = Boolean(merged.downloadMetadata);
    merged.advancedOpen = Boolean(merged.advancedOpen);
    if (!Object.values(EXPORT_MODE).includes(merged.exportMode)) merged.exportMode = DEFAULT_SETTINGS.exportMode;
    if (!['best', '4320p', '2160p', '1080p', '720p', '480p', '360p'].includes(merged.quality)) {
      merged.quality = DEFAULT_SETTINGS.quality;
    }
    return merged;
  }

  function saveSettingsNow() {
    GM_setValue(SETTINGS_KEY, JSON.stringify(normalizeSettings(state.settings)));
  }

  function loadSettingsNow() {
    let saved = null;
    try {
      saved = GM_getValue(SETTINGS_KEY, null);
      if (typeof saved === 'string') saved = JSON.parse(saved);
    } catch (_) {
      saved = null;
    }
    if (!saved || typeof saved !== 'object') return;
    state.settings = normalizeSettings({ ...state.settings, ...saved });
  }

  function bindSettingsSync() {
    if (typeof GM_addValueChangeListener !== 'function') return;

    GM_addValueChangeListener(SETTINGS_KEY, (_key, _oldValue, newValue, remote) => {
      if (!remote) return;

      let parsed = null;
      try {
        parsed = typeof newValue === 'string' ? JSON.parse(newValue) : newValue;
      } catch (_) {
        parsed = null;
      }
      if (!parsed || typeof parsed !== 'object') return;

      applyingRemoteSettings = true;
      state.settings = normalizeSettings({ ...state.settings, ...parsed });
      applySettingsToUi();
      state.tasks.forEach((task) => {
        applyQualitySelection(task);
        updateTaskFilename(task);
      });
      applyingRemoteSettings = false;

      addLog('设置已从其他标签页同步。');
      if (state.settings.autoQueueSingle) {
        scheduleWatchedPageCheck('settings-sync');
      }
      if (state.settings.autoDownloadSingle) {
        scheduleAutoDownload('settings-sync');
      }
      updateUi();
    });
  }

  function restoreState() {
    let saved = null;
    try {
      saved = GM_getValue(STORE_KEY, null);
      if (typeof saved === 'string') saved = JSON.parse(saved);
    } catch (_) {
      saved = null;
    }
    if (!saved || typeof saved !== 'object') return;

    state.tasks = Array.isArray(saved.tasks) ? saved.tasks : [];
    state.seen = saved.seen && typeof saved.seen === 'object' ? saved.seen : {};
    state.settings = normalizeSettings(saved.settings || state.settings);
    const savedStats = saved.stats && typeof saved.stats === 'object' ? saved.stats : {};
    state.stats.currentPage = Math.max(1, Number(savedStats.currentPage) || 1);
    state.stats.pagesCollected = Math.max(0, Number(savedStats.pagesCollected) || 0);
    state.stats.totalPages = Math.max(0, Number(savedStats.totalPages) || 0);
    state.collection = { ...state.collection, ...(saved.collection || {}) };
    const hasSavedDownloadStats = Boolean(saved.downloadStats && typeof saved.downloadStats === 'object');
    const savedDownloadStats = hasSavedDownloadStats ? saved.downloadStats : {};
    state.downloadStats.success = Math.max(0, Number(savedDownloadStats.success) || 0);
    state.downloadStats.failed = Math.max(0, Number(savedDownloadStats.failed) || 0);
    state.downloadStopRequested = false;
    state.downloading = false;
    state.activeDownloads = 0;
    state.logLines = Array.isArray(saved.logLines) ? saved.logLines.slice(-80) : [];
    state.tasks.forEach((task) => {
      const restoredDownloading = task.status === STATUS.DOWNLOADING;
      if (task.status === STATUS.FETCHING) task.status = STATUS.PENDING;
      if (restoredDownloading) {
        if (task.videoUrl) {
          task.status = STATUS.FAILED;
          task.error = 'Page reloaded during active download; previous browser download may still finish.';
          task.retries = CONFIG.RETRY_LIMIT + 1;
          task.videoDownloadSubmitted = false;
          task.videoDownloadDone = false;
          resetDownloadProgress(task);
          countFinalFailure(task);
        } else {
          task.status = STATUS.PENDING;
        }
      }
      task.metadata = task.metadata || {};
      task.availableQualities = task.availableQualities || [];
      const hadMetaDownloadDone = Object.prototype.hasOwnProperty.call(task, 'metaDownloadDone');
      const requestedMetadata = Object.prototype.hasOwnProperty.call(task, 'downloadMetadataRequested')
        ? Boolean(task.downloadMetadataRequested)
        : true;
      task.downloadMetadataRequested = requestedMetadata;
      task.metaDownloadDone = Boolean(task.metaDownloadDone || (!hadMetaDownloadDone && task.status === STATUS.DONE && requestedMetadata));
      task.videoDownloadSubmitted = Boolean(task.videoDownloadSubmitted || task.status === STATUS.DONE);
      task.videoDownloadDone = Boolean(task.videoDownloadDone || task.status === STATUS.DONE);
      task.metaDownloadedAt = task.metaDownloadedAt || '';
      task.videoSubmittedAt = task.videoSubmittedAt || '';
      task.videoDownloadedAt = task.videoDownloadedAt || '';
      task.videoBytesLoaded = Math.max(0, Number(task.videoBytesLoaded) || 0);
      task.videoBytesTotal = Math.max(0, Number(task.videoBytesTotal) || 0);
      task.videoProgressAt = task.videoProgressAt || '';
      task.videoSpeedBps = Math.max(0, Number(task.videoSpeedBps) || 0);
      task.finalFailureCounted = Boolean(
        task.finalFailureCounted ||
        (!hasSavedDownloadStats && task.status === STATUS.FAILED && task.videoUrl && task.retries > CONFIG.RETRY_LIMIT)
      );
    });
    state.tasks = state.tasks.filter((task) => task.status !== STATUS.DONE);
    if (!hasSavedDownloadStats) {
      state.downloadStats.failed = state.tasks.filter((task) => task.finalFailureCounted).length;
    }
    rebuildSeenFromTasks();
  }

  function persistState() {
    persistDirty = true;
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistStateNow, 250);
  }

  function persistStateNow() {
    if (!persistDirty) return;
    persistDirty = false;
    clearTimeout(persistTimer);
    state.settings = normalizeSettings(state.settings);
    const snapshot = {
      tasks: state.tasks,
      seen: state.seen,
      settings: state.settings,
      stats: state.stats,
      collection: state.collection,
      downloadStats: state.downloadStats,
      logLines: state.logLines.slice(-80),
    };
    GM_setValue(STORE_KEY, JSON.stringify(snapshot));
  }

  function requestText(url) {
    return new Promise((resolve, reject) => {
      GM_xmlhttpRequest({
        method: 'GET',
        url,
        timeout: 30000,
        headers: {
          Accept: 'text/html,application/xhtml+xml,application/xml,text/plain,*/*',
        },
        onload: (response) => {
          if (response.status >= 200 && response.status < 300) {
            resolve(response.responseText || '');
          } else {
            reject(new Error(`HTTP ${response.status}`));
          }
        },
        onerror: (error) => reject(new Error(error && error.error ? error.error : 'Request failed')),
        ontimeout: () => reject(new Error('Request timed out')),
      });
    });
  }

  function makeDraggable(panel) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let left = 0;
    let top = 0;
    const head = panel.querySelector('.r34v-head');

    head.addEventListener('mousedown', (event) => {
      if (event.target.tagName === 'BUTTON') return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const rect = panel.getBoundingClientRect();
      left = rect.left;
      top = rect.top;
      panel.style.left = `${left}px`;
      panel.style.top = `${top}px`;
      panel.style.right = 'auto';
      panel.style.bottom = 'auto';
      event.preventDefault();
    });

    document.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      panel.style.left = `${left + event.clientX - startX}px`;
      panel.style.top = `${top + event.clientY - startY}px`;
    });

    document.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function isVideoPage(url) {
    try {
      const parsed = new URL(url, location.href);
      return /^\/video\/\d+\//i.test(parsed.pathname);
    } catch (_) {
      return false;
    }
  }

  function extractTitle(doc) {
    const selectors = ['h1', '.headline h1', '.title', '[itemprop="name"]', 'meta[property="og:title"]', 'title'];
    for (const selector of selectors) {
      const el = doc.querySelector(selector);
      const value = el && (el.getAttribute('content') || el.textContent || '');
      const cleaned = normalizeWhitespace(value);
      if (cleaned) return cleaned.replace(/\s*-\s*Rule34Video\s*$/i, '');
    }
    return '';
  }

  function extractPostId(url) {
    try {
      const parsed = new URL(url, location.href);
      const match = parsed.pathname.match(/\/video\/(\d+)\//i) || parsed.pathname.match(/(\d{3,})(?:\/)?$/);
      return match ? match[1] : '';
    } catch (_) {
      return '';
    }
  }

  function extractPostIdFromDocument(doc) {
    const canonical = doc.querySelector('link[rel="canonical"][href]');
    return extractPostId(canonical && canonical.getAttribute('href'));
  }

  function normalizeQualityLabel(value) {
    const text = normalizeWhitespace(value);
    if (/\b8k\b/i.test(text)) return '4320p';
    if (/\b4k\b/i.test(text)) return '2160p';
    const match = text.match(/(\d{3,4})\s*p/i);
    return match ? `${match[1]}p` : '';
  }

  function qualityFromUrl(url) {
    const decoded = decodeURIComponent(String(url || ''));
    if (/(?:^|[_\-/])8k(?:[_\-.\/]|$)/i.test(decoded)) return '4320p';
    if (/(?:^|[_\-/])4k(?:[_\-.\/]|$)/i.test(decoded)) return '2160p';
    const match = decoded.match(/[_-](\d{3,4})p?\.|\/(\d{3,4})p?\//i);
    return match ? `${match[1] || match[2]}p` : '';
  }

  function qualityHeight(label) {
    if (!label || label === 'unknown') return 0;
    if (String(label).toLowerCase() === '8k') return 4320;
    if (String(label).toLowerCase() === '4k') return 2160;
    const match = String(label).match(/(\d{3,4})/);
    return match ? Number(match[1]) : 0;
  }

  function displayQuality(label) {
    if (label === '4320p') return '8K';
    if (label === '2160p') return '4K';
    return label || '';
  }

  function splitList(value) {
    return unique(String(value || '').split(',').map((item) => normalizeWhitespace(item)).filter(Boolean));
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function isMediaUrl(url) {
    const lower = decodeURIComponent(String(url || '')).toLowerCase();
    return CONFIG.MEDIA_EXTENSIONS.some((extension) => lower.includes(extension));
  }

  function normalizeUrl(url) {
    const parsed = new URL(url, location.href);
    parsed.hash = '';
    return parsed.href;
  }

  function safeUrl(value, baseUrl) {
    if (value == null) return null;
    const decoded = decodeHtmlEntities(String(value)).trim();
    if (!decoded) return null;
    try {
      const parsed = new URL(decoded, baseUrl || location.href);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
      return parsed;
    } catch (_) {
      return null;
    }
  }

  function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function sanitizeFilename(value) {
    return normalizeWhitespace(value)
      .replace(/[\\/:*?"<>|]/g, '_')
      .replace(/[\u0000-\u001f\u007f]/g, '')
      .replace(/\.+$/g, '')
      .trim();
  }

  function truncateFilename(value, maxLength) {
    return value.length > maxLength ? value.slice(0, maxLength).trim() : value;
  }

  function filenameFromUrl(url) {
    try {
      const pathname = new URL(url, location.href).pathname.replace(/\/$/, '');
      return decodeURIComponent(pathname.split('/').pop() || '');
    } catch (_) {
      return '';
    }
  }

  function stripExtension(filename) {
    return String(filename || '').replace(/\.(mp4|webm|m4v|mov)$/i, '');
  }

  function extensionFromFilename(filename) {
    const match = String(filename || '').match(/\.(mp4|webm|m4v|mov)$/i);
    return match ? match[0].toLowerCase() : '';
  }

  function extensionFromUrl(url) {
    return extensionFromFilename(filenameFromUrl(url));
  }

  function replaceExtension(filename, extension) {
    return String(filename || 'metadata.json').replace(/\.[^.]+$/, '') + extension;
  }

  function shellQuote(value) {
    return `"${String(value || '').replace(/(["\\$`])/g, '\\$1')}"`;
  }

  function downloadTextFile(filename, text, mime) {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      anchor.remove();
    }, 1000);
  }

  function timestampForFile() {
    return new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  }

  function clampInt(value, min, max, fallback) {
    const number = Number(value);
    if (!Number.isFinite(number)) return fallback;
    return Math.max(min, Math.min(max, Math.floor(number)));
  }

  function addLog(text) {
    const time = new Date().toLocaleTimeString();
    state.logLines.push(`[${time}] ${text}`);
    if (state.logLines.length > 80) state.logLines.shift();
  }

  function shortHash(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0).toString(36);
  }

  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  function messageOf(error) {
    return error && error.message ? error.message : String(error || 'Unknown error');
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    const el = uiById(id);
    if (el) el.textContent = String(value);
  }

  window.addEventListener('beforeunload', persistStateNow);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', main);
  } else {
    main();
  }
})();
