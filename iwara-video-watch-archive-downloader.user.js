// ==UserScript==
// @name         Iwara Video Watch Archive Downloader
// @namespace    https://github.com/GitRuozhi
// @license      MIT
// @version      0.1
// @description  Lightweight Iwara browser helper for collecting visible video links, reading page download links, and downloading videos with Iwara-style metadata.
// @author       GitRuozhi
// @match        https://www.iwara.tv/*
// @match        https://iwara.tv/*
// @grant        GM_download
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_deleteValue
// @grant        GM_addValueChangeListener
// @connect      iwara.tv
// @connect      www.iwara.tv
// @connect      files.iwara.tv
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const STORE_KEY = 'iwara_light_downloader_state_v1';
  const SETTINGS_KEY = 'iwara_light_downloader_settings_v1';
  const PANEL_ID = 'iwara-light-panel';

  const CONFIG = {
    DOWNLOAD_CONCURRENCY: 2,
    DOWNLOAD_DELAY_MS: 900,
    ROUTE_CHECK_MS: 700,
    RETRY_LIMIT: 1,
    MEDIA_EXTENSIONS: ['.mp4', '.webm', '.m4v', '.mov'],
  };

  const STATUS = {
    PENDING: 'pending',
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
    quality: 'best',
    exportMode: EXPORT_MODE.DIRECT,
    keepId: true,
    keepTitle: true,
    keepOriginal: true,
    downloadMetadata: true,
    advancedOpen: false,
  };

  const state = {
    tasks: [],
    seen: {},
    settings: { ...DEFAULT_SETTINGS },
    downloading: false,
    downloadStopRequested: false,
    activeDownloads: 0,
    logLines: [],
  };

  const ui = {};
  let persistTimer = 0;
  let applyingRemoteSettings = false;
  let lastRoute = '';
  let routeTimer = 0;

  const css = `
    #${PANEL_ID} {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      width: 360px;
      max-width: calc(100vw - 32px);
      color: #f3f4f6;
      background: #15171c;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 8px;
      box-shadow: 0 16px 42px rgba(0,0,0,.42);
      font: 13px/1.4 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    #${PANEL_ID} * { box-sizing: border-box; }
    #${PANEL_ID} button,
    #${PANEL_ID} select,
    #${PANEL_ID} input {
      font: inherit;
    }
    #${PANEL_ID} .iwara-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      cursor: move;
      border-bottom: 1px solid rgba(255,255,255,.12);
      user-select: none;
    }
    #${PANEL_ID} .iwara-title {
      font-weight: 700;
      letter-spacing: 0;
    }
    #${PANEL_ID} .iwara-stats {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 10px 12px 6px;
    }
    #${PANEL_ID} .iwara-stat {
      min-width: 0;
      padding: 6px;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 6px;
      color: #cbd5e1;
      text-align: center;
      background: rgba(255,255,255,.05);
    }
    #${PANEL_ID} .iwara-stat strong {
      display: block;
      margin-top: 2px;
      color: #fff;
      font-size: 15px;
    }
    #${PANEL_ID} .iwara-actions,
    #${PANEL_ID} .iwara-options {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      padding: 6px 12px;
    }
    #${PANEL_ID} .iwara-panel-button {
      min-height: 30px;
      padding: 5px 7px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 6px;
      color: #f9fafb;
      background: #2a2f3a;
      cursor: pointer;
    }
    #${PANEL_ID} .iwara-panel-button:hover { background: #374151; }
    #${PANEL_ID} .iwara-panel-button:disabled {
      opacity: .5;
      cursor: not-allowed;
    }
    #${PANEL_ID} .iwara-advanced {
      display: none;
      padding: 4px 12px 8px;
      border-top: 1px solid rgba(255,255,255,.08);
    }
    #${PANEL_ID}.iwara-advanced-open .iwara-advanced { display: block; }
    #${PANEL_ID} .iwara-option-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 6px;
    }
    #${PANEL_ID} label {
      display: flex;
      align-items: center;
      gap: 5px;
      min-width: 0;
      color: #d1d5db;
      white-space: nowrap;
    }
    #${PANEL_ID} select {
      width: 100%;
      min-height: 28px;
      border: 1px solid rgba(255,255,255,.16);
      border-radius: 6px;
      color: #f9fafb;
      background: #111827;
    }
    #${PANEL_ID} .iwara-log {
      min-height: 82px;
      max-height: 150px;
      margin: 6px 12px 12px;
      padding: 8px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      color: #cbd5e1;
      background: #0b0f16;
      border: 1px solid rgba(255,255,255,.12);
      border-radius: 6px;
    }
  `;

  async function main() {
    restoreState();
    loadSettingsNow();
    injectStyle();
    createPanel();
    cacheUi();
    bindUi();
    bindSettingsSync();
    bindRouteWatcher();
    updateUi('Iwara 助手已加载。下载链接未出现时，请先展开页面自带下载区域。');
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
      <div class="iwara-head">
        <span class="iwara-title">Iwara 下载助手</span>
        <button type="button" id="iwara-more" class="iwara-panel-button" title="高级选项">高级</button>
      </div>
      <div class="iwara-stats">
        <span class="iwara-stat" title="已入队">队列<strong id="iwara-captured">0</strong></span>
        <span class="iwara-stat" title="已解析">解析<strong id="iwara-resolved">0</strong></span>
        <span class="iwara-stat" title="已提交">提交<strong id="iwara-submitted">0</strong></span>
        <span class="iwara-stat" title="已完成">完成<strong id="iwara-downloaded">0</strong></span>
      </div>
      <div class="iwara-actions">
        <button type="button" id="iwara-current" class="iwara-panel-button" title="采集并解析当前视频页">当前页</button>
        <button type="button" id="iwara-visible" class="iwara-panel-button" title="采集当前页面可见视频链接">可见链接</button>
        <button type="button" id="iwara-download" class="iwara-panel-button" title="开始下载已解析视频">下载</button>
        <button type="button" id="iwara-clear" class="iwara-panel-button" title="清空队列">清空</button>
      </div>
      <div class="iwara-advanced" id="iwara-advanced">
        <div class="iwara-option-row">
          <label title="选择下载链接质量"><span>质量</span><select id="iwara-quality">
            <option value="best">最佳</option>
            <option value="source">Source</option>
            <option value="1080">1080p</option>
            <option value="720">720p</option>
            <option value="540">540p</option>
            <option value="360">360p</option>
          </select></label>
          <label title="下载或导出方式"><span>模式</span><select id="iwara-export-mode">
            <option value="direct">浏览器下载</option>
            <option value="links">导出链接</option>
            <option value="ytdlp">导出 YT-DLP</option>
          </select></label>
        </div>
        <div class="iwara-option-row">
          <label title="下载视频前保存作品元信息 JSON"><input type="checkbox" id="iwara-download-metadata">下载作品元信息</label>
          <label title="文件名包含作品 ID"><input type="checkbox" id="iwara-keep-id">保留 ID</label>
        </div>
        <div class="iwara-option-row">
          <label title="文件名包含标题"><input type="checkbox" id="iwara-keep-title">保留标题</label>
          <label title="文件名包含原始文件名"><input type="checkbox" id="iwara-keep-original">保留原名</label>
        </div>
      </div>
      <div class="iwara-log" id="iwara-log"></div>
    `;
    document.body.appendChild(panel);
    ui.panel = panel;
    makeDraggable(panel);
  }

  function cacheUi() {
    [
      'iwara-captured',
      'iwara-resolved',
      'iwara-submitted',
      'iwara-downloaded',
      'iwara-current',
      'iwara-visible',
      'iwara-download',
      'iwara-clear',
      'iwara-more',
      'iwara-quality',
      'iwara-export-mode',
      'iwara-download-metadata',
      'iwara-keep-id',
      'iwara-keep-title',
      'iwara-keep-original',
      'iwara-log',
    ].forEach((id) => {
      ui[id] = document.getElementById(id);
    });
  }

  function uiById(id) {
    return ui[id] || document.getElementById(id);
  }

  function bindUi() {
    uiById('iwara-current').addEventListener('click', addCurrentVideoPage);
    uiById('iwara-visible').addEventListener('click', collectVisibleVideoLinks);
    uiById('iwara-download').addEventListener('click', startDownloads);
    uiById('iwara-clear').addEventListener('click', clearTasks);
    uiById('iwara-more').addEventListener('click', toggleAdvancedOptions);
    ['iwara-quality', 'iwara-export-mode'].forEach((id) => {
      uiById(id).addEventListener('change', saveSettingsFromUi);
    });
    ['iwara-download-metadata', 'iwara-keep-id', 'iwara-keep-title', 'iwara-keep-original'].forEach((id) => {
      uiById(id).addEventListener('change', saveSettingsFromUi);
    });
    applySettingsToUi();
  }

  async function addCurrentVideoPage() {
    if (!isVideoPage(location.href)) {
      addLog('当前页面不是 Iwara 视频播放页。');
      updateUi();
      return false;
    }

    const currentUrl = normalizeUrl(location.href);
    const added = addTask(currentUrl);
    const task = findTaskByPostUrl(currentUrl);
    if (added) addLog('当前视频已入队。');
    if (task) resolveTaskFromCurrentDocument(task);
    persistState();
    updateUi();
    return added;
  }

  function collectVisibleVideoLinks() {
    const urls = extractPostUrls(document, location.href);
    let added = 0;
    urls.forEach((url) => {
      if (addTask(url)) added += 1;
    });

    if (added) {
      addLog(`已采集当前页面可见视频链接：${added} 个。请打开具体视频页解析页面下载链接。`);
    } else if (urls.length) {
      addLog('当前页面可见视频链接都已在队列中。');
    } else {
      addLog('当前页面没有找到可见 Iwara 视频链接。');
    }
    persistState();
    updateUi();
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
      metadata: emptyIwaraMetadata(normalized, id),
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
      capturedAt: new Date().toISOString(),
    };

    state.seen[key] = true;
    state.tasks.push(task);
    persistState();
    return true;
  }

  function resolveTaskFromCurrentDocument(task) {
    if (!task || normalizeUrl(task.postUrl) !== normalizeUrl(location.href)) {
      addLog('只能解析当前打开的视频页。');
      return;
    }

    const resolved = resolveVideoFromCurrentDocument();
    task.title = resolved.title || task.title;
    task.postId = resolved.id || task.postId || extractPostId(location.href);
    task.availableQualities = resolved.availableQualities;
    task.metadata = resolved.metadata;
    task.capturedAt = task.capturedAt || new Date().toISOString();
    applyQualitySelection(task);

    if (task.videoUrl) {
      task.status = STATUS.READY;
      task.error = '';
      updateTaskFilename(task);
      addLog(`当前页解析完成：${task.title || task.postId || task.videoUrl}`);
    } else {
      task.status = STATUS.PENDING;
      task.error = '页面内没有可用下载链接';
      addLog('未找到页面内下载链接。请先展开 Iwara 页面自带下载区域，再点“当前页”。');
    }
  }

  function resolveVideoFromCurrentDocument() {
    const id = extractPostId(location.href);
    const meta = extractIwaraMetadata(document, location.href);
    const qualities = extractQualitySources(document, location.href);
    const selected = selectQuality(qualities, state.settings.quality);
    meta.selectedQuality = selected ? selected.label : '';
    meta.availableQualities = qualities;
    meta.videoUrl = selected ? selected.url : '';
    meta.originalFilename = selected ? filenameFromUrl(selected.url) : '';

    return {
      id: meta.id || id,
      title: meta.title || '',
      videoUrl: selected ? selected.url : '',
      selectedQuality: selected ? selected.label : '',
      availableQualities: qualities,
      metadata: meta,
    };
  }

  function extractQualitySources(doc, baseUrl) {
    const sources = [];
    const addSource = (rawUrl, labelText, source, filenameHint) => {
      const url = safeUrl(rawUrl, baseUrl);
      if (!url || !isLikelyVideoDownloadUrl(url.href, labelText)) return;
      const label = normalizeQualityLabel(labelText) || qualityFromUrl(url.href) || 'unknown';
      sources.push({
        label,
        height: qualityHeight(label),
        url: url.href,
        source,
        filename: filenameHint || filenameFromUrl(url.href),
      });
    };

    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const href = anchor.getAttribute('href');
      const signal = [
        anchor.textContent,
        anchor.getAttribute('title'),
        anchor.getAttribute('aria-label'),
        anchor.getAttribute('download'),
        anchor.getAttribute('data-quality'),
        anchor.getAttribute('data-resolution'),
      ].filter(Boolean).join(' ');
      if (!looksLikeDownloadSignal(signal) && !isDirectMediaUrl(href)) return;
      addSource(href, signal, 'download-link', anchor.getAttribute('download') || '');
    });

    doc.querySelectorAll('video source[src], video[src], source[type*="video"][src]').forEach((el) => {
      addSource(el.getAttribute('src') || el.src || el.currentSrc, el.getAttribute('label') || el.getAttribute('res') || '', 'player', '');
    });

    const html = doc.documentElement.innerHTML;
    const htmlUrls = Array.from(html.matchAll(/https?:\/\/[^"'<>\\\s]+?\.(?:mp4|webm|m4v|mov)(?:\?[^"'<>\\\s]*)?/gi))
      .map((match) => decodeHtmlEntities(match[0]));
    htmlUrls.forEach((url) => addSource(url, qualityFromUrl(url), 'html', ''));

    return dedupeQualities(sources).sort((a, b) => b.height - a.height);
  }

  function extractIwaraMetadata(doc, baseUrl) {
    const metaTags = extractMetaTags(doc);
    const id = extractPostId(baseUrl);
    const title = extractTitle(doc, metaTags);
    const author = extractAuthor(doc);
    const timestamps = extractTimestamps(doc);

    return {
      id,
      title,
      description: extractDescription(doc, metaTags),
      authorName: author.name,
      authorUsername: author.username,
      authorUrl: author.url,
      tags: extractTags(doc),
      createdAt: timestamps.createdAt,
      updatedAt: timestamps.updatedAt,
      views: extractCountText(doc, /views?|观看|播放/i),
      likes: extractCountText(doc, /likes?|喜欢|赞/i),
      comments: extractCountText(doc, /comments?|评论/i),
      thumbnailUrl: metaTags['og:image'] || metaTags['twitter:image'] || '',
      rating: extractRating(doc),
      pageUrl: normalizeUrl(baseUrl),
      capturedAt: new Date().toISOString(),
      selectedQuality: '',
      availableQualities: [],
      videoUrl: '',
      originalFilename: '',
      filename: '',
      downloadMetadataRequested: false,
      videoDownloadDone: false,
      metaDownloadDone: false,
    };
  }

  function emptyIwaraMetadata(pageUrl, id) {
    return {
      id: id || '',
      title: '',
      description: '',
      authorName: '',
      authorUsername: '',
      authorUrl: '',
      tags: [],
      createdAt: '',
      updatedAt: '',
      views: '',
      likes: '',
      comments: '',
      thumbnailUrl: '',
      rating: '',
      pageUrl: normalizeUrl(pageUrl),
      capturedAt: new Date().toISOString(),
      selectedQuality: '',
      availableQualities: [],
      videoUrl: '',
      originalFilename: '',
      filename: '',
      downloadMetadataRequested: false,
      videoDownloadDone: false,
      metaDownloadDone: false,
    };
  }

  function extractTitle(doc, metaTags) {
    const candidates = [
      textOf(doc.querySelector('h1')),
      metaTags['og:title'],
      metaTags['twitter:title'],
      doc.title.replace(/\s*\|\s*Iwara\s*$/i, ''),
    ];
    return normalizeWhitespace(candidates.find(Boolean) || '');
  }

  function extractDescription(doc, metaTags) {
    const metaDescription = metaTags['description'] || metaTags['og:description'] || metaTags['twitter:description'] || '';
    const candidates = [
      '[data-testid*="description" i]',
      '[class*="description" i]',
      '[class*="body" i]',
      'article',
    ];
    for (const selector of candidates) {
      const value = normalizeWhitespace(textOf(doc.querySelector(selector)));
      if (value && value.length > 8 && value !== extractTitle(doc, metaTags)) return value;
    }
    return normalizeWhitespace(metaDescription);
  }

  function extractAuthor(doc) {
    const anchors = Array.from(doc.querySelectorAll('a[href*="/profile/"]'));
    const picked = anchors
      .map((anchor) => ({
        text: normalizeWhitespace(anchor.textContent),
        url: safeUrl(anchor.getAttribute('href'), location.href),
      }))
      .filter((item) => item.text && item.url)
      .find((item) => !/videos?|likes?|following|followers/i.test(item.text));

    if (!picked) return { name: '', username: '', url: '' };
    const pathname = picked.url.pathname.replace(/\/+$/, '');
    const username = decodeURIComponent(pathname.split('/').pop() || '');
    return {
      name: picked.text,
      username,
      url: picked.url.href,
    };
  }

  function extractTags(doc) {
    const tags = [];
    doc.querySelectorAll('a[href*="/search"], a[href*="/tag"], a[href*="tags="], a[href*="tag="]').forEach((anchor) => {
      const text = normalizeWhitespace(anchor.textContent).replace(/^#/, '');
      if (!text || text.length > 80) return;
      if (/^(search|tags?|more)$/i.test(text)) return;
      tags.push(text);
    });
    return unique(tags);
  }

  function extractTimestamps(doc) {
    const timeEls = Array.from(doc.querySelectorAll('time[datetime]'));
    const first = timeEls[0] && timeEls[0].getAttribute('datetime') || '';
    const second = timeEls[1] && timeEls[1].getAttribute('datetime') || '';
    const text = normalizeWhitespace(doc.body && doc.body.textContent);
    return {
      createdAt: first || textNearLabelText(text, /(?:created|uploaded|发布|上传)\s*:?\s*([0-9][0-9T:.\-\s/Z]+)/i),
      updatedAt: second || textNearLabelText(text, /(?:updated|修改|更新)\s*:?\s*([0-9][0-9T:.\-\s/Z]+)/i),
    };
  }

  function extractCountText(doc, labelPattern) {
    const nodes = Array.from(doc.querySelectorAll('span, div, button, a')).slice(0, 600);
    for (const node of nodes) {
      const text = normalizeWhitespace(node.textContent);
      if (!text || text.length > 80 || !labelPattern.test(text)) continue;
      const match = text.match(/([\d,.]+[kKmM万]*)/);
      if (match) return match[1];
    }
    return '';
  }

  function extractRating(doc) {
    const text = normalizeWhitespace(doc.body && doc.body.textContent);
    const match = text.match(/\b(ecchi|safe|general|r-?18|rating\s*:?\s*[a-z0-9-]+)/i);
    return match ? normalizeWhitespace(match[0]) : '';
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

  function extractPostUrls(doc, baseUrl) {
    const urls = new Set();
    doc.querySelectorAll('a[href]').forEach((anchor) => {
      const url = safeUrl(anchor.getAttribute('href'), baseUrl);
      if (!url || !isIwaraOrigin(url) || !isVideoPage(url.href)) return;
      urls.add(normalizeUrl(url.href));
    });
    return Array.from(urls);
  }

  function isIwaraOrigin(url) {
    return /^https:\/\/(?:www\.)?iwara\.tv$/i.test(url.origin);
  }

  function startDownloads() {
    if (state.downloading) {
      stopDownloads();
      return;
    }
    saveSettingsFromUi();
    if (state.settings.exportMode !== EXPORT_MODE.DIRECT) {
      saveOutputFiles();
      return;
    }
    state.downloadStopRequested = false;
    state.downloading = true;
    addLog('浏览器下载队列已开始。');
    persistState();
    updateUi();
    pumpDownloads();
  }

  function stopDownloads() {
    state.downloading = false;
    state.downloadStopRequested = true;
    addLog('已请求停止下载。正在进行的浏览器下载可能仍会完成。');
    persistState();
    updateUi();
  }

  function pumpDownloads() {
    if (!state.downloading || state.downloadStopRequested) return;

    while (state.activeDownloads < CONFIG.DOWNLOAD_CONCURRENCY) {
      const task = nextDownloadTask();
      if (!task) break;
      downloadTask(task);
    }

    if (state.activeDownloads === 0 && !nextDownloadTask()) {
      state.downloading = false;
      state.downloadStopRequested = false;
      addLog('浏览器下载队列已结束。');
      persistState();
      updateUi();
    }
  }

  function nextDownloadTask() {
    return state.tasks.find((task) => (
      task.status === STATUS.READY ||
      (task.status === STATUS.FAILED && task.videoUrl && task.retries <= CONFIG.RETRY_LIMIT)
    ));
  }

  function downloadTask(task) {
    task.status = STATUS.DOWNLOADING;
    task.error = '';
    task.downloadMetadataRequested = Boolean(state.settings.downloadMetadata);
    task.metaDownloadDone = false;
    task.videoDownloadSubmitted = false;
    task.videoDownloadDone = false;
    task.metaDownloadedAt = '';
    task.videoSubmittedAt = '';
    task.videoDownloadedAt = '';
    state.activeDownloads += 1;
    persistState();
    updateUi();

    if (!task.downloadMetadataRequested) {
      addLog(`提交视频下载：${task.filename}`);
      downloadVideoForTask(task);
      return;
    }

    addLog(`先下载作品元信息：${replaceExtension(task.filename, '.meta.json')}`);
    downloadMetaForTask(task)
      .then(() => {
        task.metaDownloadDone = true;
        task.metaDownloadedAt = new Date().toISOString();
        persistState();
        updateUi();
        addLog(`元信息完成：${replaceExtension(task.filename, '.meta.json')}`);
        addLog(`提交视频下载：${task.filename}`);
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
      onerror: (error) => finishDownload(task, false, error && (error.error || error.details || error.toString())),
      ontimeout: () => finishDownload(task, false, 'Download timed out'),
    });
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
      addLog(errorText ? `下载完成：${task.filename}; ${errorText}` : `下载完成：${task.filename}`);
    } else {
      task.retries += 1;
      task.status = STATUS.FAILED;
      task.error = errorText || 'Download failed';
      addLog(`下载失败：${task.filename} - ${task.error}`);
    }

    state.activeDownloads = Math.max(0, state.activeDownloads - 1);
    persistState();
    updateUi();
    if (state.downloading && !state.downloadStopRequested) {
      setTimeout(pumpDownloads, CONFIG.DOWNLOAD_DELAY_MS);
    }
  }

  function saveOutputFiles() {
    const stamp = timestampForFile();
    const mainText = buildExportText();
    const metaText = buildMetaJsonl();
    if (!mainText && !metaText) {
      addLog('没有已解析的视频可导出。');
      updateUi();
      return;
    }

    if (mainText) {
      const name = state.settings.exportMode === EXPORT_MODE.YTDLP
        ? `iwara-ytdlp-${stamp}.txt`
        : `iwara-links-${stamp}.txt`;
      downloadTextFile(name, mainText, 'text/plain');
    }

    if (metaText) {
      downloadTextFile(`iwara-meta-${stamp}.jsonl`, metaText, 'application/json');
    }

    addLog(state.settings.exportMode === EXPORT_MODE.YTDLP ? 'YT-DLP 文件已导出。' : '直链文件已导出。');
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
      id: task.postId || task.metadata.id || '',
      title: task.title || task.metadata.title || '',
      description: task.metadata.description || '',
      authorName: task.metadata.authorName || '',
      authorUsername: task.metadata.authorUsername || '',
      authorUrl: task.metadata.authorUrl || '',
      tags: Array.isArray(task.metadata.tags) ? task.metadata.tags : [],
      createdAt: task.metadata.createdAt || '',
      updatedAt: task.metadata.updatedAt || '',
      views: task.metadata.views || '',
      likes: task.metadata.likes || '',
      comments: task.metadata.comments || '',
      thumbnailUrl: task.metadata.thumbnailUrl || '',
      rating: task.metadata.rating || '',
      pageUrl: task.postUrl,
      capturedAt: task.capturedAt,
      selectedQuality: task.selectedQuality,
      availableQualities: task.availableQualities,
      videoUrl: task.videoUrl,
      originalFilename: task.originalFilename,
      filename: task.filename,
      downloadMetadataRequested: Boolean(task.downloadMetadataRequested),
      videoDownloadDone: Boolean(task.videoDownloadDone),
      metaDownloadDone: Boolean(task.metaDownloadDone),
    };
  }

  function clearTasks() {
    if (state.downloading) {
      addLog('请先停止下载，再清空队列。');
      updateUi();
      return;
    }

    state.tasks = [];
    state.seen = {};
    state.downloading = false;
    state.downloadStopRequested = false;
    state.activeDownloads = 0;
    state.logLines = [];
    GM_deleteValue(STORE_KEY);
    addLog('队列已清空。');
    updateUi();
  }

  function applyQualitySelection(task) {
    if (!Array.isArray(task.availableQualities) || !task.availableQualities.length) {
      task.videoUrl = '';
      task.selectedQuality = '';
      task.originalFilename = '';
      return;
    }
    const selected = selectQuality(task.availableQualities, state.settings.quality);
    if (!selected) return;
    task.videoUrl = selected.url;
    task.selectedQuality = selected.label;
    task.requestedQuality = state.settings.quality;
    task.originalFilename = selected.filename || filenameFromUrl(selected.url);
    task.metadata.videoUrl = selected.url;
    task.metadata.selectedQuality = selected.label;
    task.metadata.originalFilename = task.originalFilename;
  }

  function updateTaskFilename(task) {
    task.filename = buildFilename(task);
    task.metadata.filename = task.filename;
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
    if (!uiById('iwara-captured')) return;
    if (statusText) addLog(statusText);
    const stats = getStats();
    setText('iwara-captured', stats.captured);
    setText('iwara-resolved', stats.resolved);
    setText('iwara-submitted', stats.submitted);
    setText('iwara-downloaded', stats.downloaded);

    const logEl = uiById('iwara-log');
    logEl.textContent = state.logLines.slice(-80).join('\n');
    logEl.scrollTop = logEl.scrollHeight;

    ui.panel.classList.toggle('iwara-advanced-open', Boolean(state.settings.advancedOpen));
    uiById('iwara-download').disabled = !state.downloading && !state.tasks.some((task) => task.videoUrl);
    uiById('iwara-download').textContent = state.downloading ? '停止' : '下载';
    uiById('iwara-more').textContent = state.settings.advancedOpen ? '收起' : '高级';
  }

  function getStats() {
    const captured = state.tasks.length;
    const ready = state.tasks.filter((task) => Boolean(task.videoUrl)).length;
    const failed = state.tasks.filter((task) => task.status === STATUS.FAILED && !task.videoUrl).length;
    const submitted = state.tasks.filter((task) => Boolean(task.videoDownloadSubmitted)).length;
    const downloaded = state.tasks.filter((task) => task.status === STATUS.DONE).length;
    return {
      captured,
      resolved: ready + failed,
      submitted,
      downloaded,
    };
  }

  function toggleAdvancedOptions() {
    state.settings.advancedOpen = !state.settings.advancedOpen;
    saveSettingsNow();
    updateUi();
  }

  function applySettingsToUi() {
    uiById('iwara-quality').value = state.settings.quality;
    uiById('iwara-export-mode').value = state.settings.exportMode;
    uiById('iwara-download-metadata').checked = state.settings.downloadMetadata;
    uiById('iwara-keep-id').checked = state.settings.keepId;
    uiById('iwara-keep-title').checked = state.settings.keepTitle;
    uiById('iwara-keep-original').checked = state.settings.keepOriginal;
  }

  function saveSettingsFromUi() {
    state.settings.quality = uiById('iwara-quality').value;
    state.settings.exportMode = uiById('iwara-export-mode').value;
    state.settings.downloadMetadata = uiById('iwara-download-metadata').checked;
    state.settings.keepId = uiById('iwara-keep-id').checked;
    state.settings.keepTitle = uiById('iwara-keep-title').checked;
    state.settings.keepOriginal = uiById('iwara-keep-original').checked;
    state.tasks.forEach((task) => {
      applyQualitySelection(task);
      if (task.videoUrl) updateTaskFilename(task);
    });
    saveSettingsNow();
    persistState();
    updateUi();
  }

  function normalizeSettings(settings) {
    const source = settings && typeof settings === 'object' ? settings : {};
    const merged = { ...DEFAULT_SETTINGS, ...source };
    if (!['best', 'source', '1080', '720', '540', '360'].includes(merged.quality)) merged.quality = DEFAULT_SETTINGS.quality;
    if (!Object.values(EXPORT_MODE).includes(merged.exportMode)) merged.exportMode = DEFAULT_SETTINGS.exportMode;
    merged.keepId = Boolean(merged.keepId);
    merged.keepTitle = Boolean(merged.keepTitle);
    merged.keepOriginal = Boolean(merged.keepOriginal);
    merged.downloadMetadata = Boolean(merged.downloadMetadata);
    merged.advancedOpen = Boolean(merged.advancedOpen);
    return merged;
  }

  function saveSettingsNow() {
    if (applyingRemoteSettings) return;
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
      updateUi();
      applyingRemoteSettings = false;
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
    state.downloading = false;
    state.downloadStopRequested = false;
    state.activeDownloads = 0;
    state.logLines = Array.isArray(saved.logLines) ? saved.logLines.slice(-80) : [];
    state.tasks.forEach((task) => {
      task.metadata = normalizeRestoredMetadata(task);
      task.availableQualities = Array.isArray(task.availableQualities) ? task.availableQualities : [];
      if (task.status === STATUS.DOWNLOADING) task.status = task.videoUrl ? STATUS.READY : STATUS.PENDING;
      task.downloadMetadataRequested = Boolean(task.downloadMetadataRequested);
      task.metaDownloadDone = Boolean(task.metaDownloadDone);
      task.videoDownloadSubmitted = Boolean(task.videoDownloadSubmitted || task.status === STATUS.DONE);
      task.videoDownloadDone = Boolean(task.videoDownloadDone || task.status === STATUS.DONE);
      task.metaDownloadedAt = task.metaDownloadedAt || '';
      task.videoSubmittedAt = task.videoSubmittedAt || '';
      task.videoDownloadedAt = task.videoDownloadedAt || '';
    });
  }

  function normalizeRestoredMetadata(task) {
    const base = emptyIwaraMetadata(task.postUrl || location.href, task.postId || '');
    const source = task.metadata && typeof task.metadata === 'object' ? task.metadata : {};
    const restored = {};
    Object.keys(base).forEach((key) => {
      restored[key] = Object.prototype.hasOwnProperty.call(source, key) ? source[key] : base[key];
    });
    restored.tags = Array.isArray(restored.tags) ? restored.tags : [];
    restored.availableQualities = Array.isArray(restored.availableQualities) ? restored.availableQualities : [];
    return restored;
  }

  function persistState() {
    clearTimeout(persistTimer);
    persistTimer = setTimeout(persistStateNow, 250);
  }

  function persistStateNow() {
    state.settings = normalizeSettings(state.settings);
    const snapshot = {
      tasks: state.tasks,
      seen: state.seen,
      settings: state.settings,
      logLines: state.logLines.slice(-80),
    };
    GM_setValue(STORE_KEY, JSON.stringify(snapshot));
  }

  function bindRouteWatcher() {
    lastRoute = normalizeUrl(location.href);
    const rawPushState = history.pushState;
    const rawReplaceState = history.replaceState;
    history.pushState = function (...args) {
      const result = rawPushState.apply(this, args);
      scheduleRouteCheck();
      return result;
    };
    history.replaceState = function (...args) {
      const result = rawReplaceState.apply(this, args);
      scheduleRouteCheck();
      return result;
    };
    window.addEventListener('popstate', scheduleRouteCheck);
  }

  function scheduleRouteCheck() {
    clearTimeout(routeTimer);
    routeTimer = setTimeout(() => {
      const current = normalizeUrl(location.href);
      if (current === lastRoute) return;
      lastRoute = current;
      updateUi(isVideoPage(current) ? '已进入视频页。展开下载区域后可点“当前页”解析。' : '页面已切换。');
    }, CONFIG.ROUTE_CHECK_MS);
  }

  function isVideoPage(url) {
    try {
      const parsed = new URL(url, location.href);
      return /^\/videos?\/[a-z0-9]+(?:\/|$)/i.test(parsed.pathname);
    } catch (_) {
      return false;
    }
  }

  function extractPostId(url) {
    try {
      const parsed = new URL(url, location.href);
      const match = parsed.pathname.match(/^\/videos?\/([a-z0-9]+)(?:\/|$)/i);
      return match ? match[1] : '';
    } catch (_) {
      return '';
    }
  }

  function findTaskByPostUrl(postUrl) {
    const normalized = normalizeUrl(postUrl);
    return state.tasks.find((task) => normalizeUrl(task.postUrl) === normalized) || null;
  }

  function selectQuality(qualities, requested) {
    if (!qualities.length) return null;
    const sorted = qualities.slice().sort((a, b) => b.height - a.height);
    if (requested === 'best') return sorted[0];
    if (requested === 'source') return sorted.find((item) => /source/i.test(item.label)) || sorted[0];
    const requestedHeight = qualityHeight(requested);
    return sorted.find((item) => item.height === requestedHeight) || sorted[0];
  }

  function dedupeQualities(sources) {
    const byUrl = {};
    sources.forEach((source) => {
      if (!source.url) return;
      if (!byUrl[source.url] || source.height > byUrl[source.url].height) byUrl[source.url] = source;
    });
    return Object.values(byUrl);
  }

  function looksLikeDownloadSignal(value) {
    return /\b(download|source|original|mp4|webm|m4v|mov|360p?|540p?|720p?|1080p?|2160p?|4k)\b/i.test(String(value || ''));
  }

  function isLikelyVideoDownloadUrl(url, labelText) {
    if (isDirectMediaUrl(url)) return true;
    try {
      const parsed = new URL(url, location.href);
      if (/\/videos?\//i.test(parsed.pathname)) return false;
      if (/files\.iwara\.tv$/i.test(parsed.hostname) && !/\.(?:jpg|jpeg|png|webp|gif)(?:\?|$)/i.test(parsed.pathname)) return true;
      return looksLikeDownloadSignal(labelText) && !isIwaraOrigin(parsed);
    } catch (_) {
      return false;
    }
  }

  function isDirectMediaUrl(url) {
    const lower = decodeURIComponent(String(url || '')).toLowerCase();
    return CONFIG.MEDIA_EXTENSIONS.some((ext) => lower.includes(ext));
  }

  function normalizeQualityLabel(value) {
    const text = normalizeWhitespace(value);
    if (!text) return '';
    if (/\bsource\b/i.test(text)) return 'Source';
    const match = text.match(/(\d{3,4})\s*p?/i);
    return match ? `${match[1]}p` : '';
  }

  function qualityFromUrl(url) {
    const decoded = decodeURIComponent(String(url || ''));
    if (/\bsource\b/i.test(decoded)) return 'Source';
    const match = decoded.match(/(?:^|[^\d])(\d{3,4})p?(?:[^\d]|$)/i);
    return match ? `${match[1]}p` : '';
  }

  function qualityHeight(label) {
    if (/source/i.test(String(label || ''))) return 100000;
    const match = String(label || '').match(/(\d{3,4})/);
    return match ? Number(match[1]) : 0;
  }

  function safeUrl(value, baseUrl) {
    if (!value) return null;
    const decoded = decodeHtmlEntities(String(value).trim());
    if (!decoded || decoded.startsWith('javascript:') || decoded.startsWith('data:')) return null;
    try {
      return new URL(decoded, baseUrl || location.href);
    } catch (_) {
      return null;
    }
  }

  function normalizeUrl(url) {
    const parsed = new URL(url, location.href);
    parsed.hash = '';
    return parsed.href;
  }

  function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = String(value || '');
    return textarea.value;
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function textOf(node) {
    return node ? normalizeWhitespace(node.textContent || node.getAttribute('content') || '') : '';
  }

  function textNearLabelText(text, pattern) {
    const match = String(text || '').match(pattern);
    return match ? normalizeWhitespace(match[1]) : '';
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function sanitizeFilename(value) {
    return normalizeWhitespace(value)
      .replace(/[\\/:*?"<>|]+/g, '_')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .slice(0, 180);
  }

  function truncateFilename(value, maxLength) {
    return value.length > maxLength ? value.slice(0, maxLength).replace(/[. _-]+$/g, '') : value;
  }

  function filenameFromUrl(url) {
    try {
      const pathname = new URL(url, location.href).pathname.replace(/\/$/, '');
      const name = decodeURIComponent(pathname.split('/').pop() || '');
      return sanitizeFilename(name);
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
    return extensionFromFilename(filenameFromUrl(url)) || '.mp4';
  }

  function replaceExtension(filename, extension) {
    return `${stripExtension(filename)}${extension}`;
  }

  function shellQuote(value) {
    return `'${String(value || '').replace(/'/g, "'\\''")}'`;
  }

  function downloadTextFile(filename, text, mime) {
    const blob = new Blob([text], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function timestampForFile() {
    const pad = (value) => String(value).padStart(2, '0');
    const now = new Date();
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
      '-',
      pad(now.getHours()),
      pad(now.getMinutes()),
      pad(now.getSeconds()),
    ].join('');
  }

  function addLog(text) {
    const time = new Date().toLocaleTimeString();
    state.logLines.push(`[${time}] ${text}`);
    if (state.logLines.length > 80) state.logLines.shift();
  }

  function setText(id, value) {
    const el = uiById(id);
    if (el) el.textContent = String(value);
  }

  function shortHash(value) {
    let hash = 0;
    const text = String(value || '');
    for (let i = 0; i < text.length; i += 1) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36);
  }

  function messageOf(error) {
    return error && (error.message || error.error || error.details || String(error)) || 'Unknown error';
  }

  function makeDraggable(panel) {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let startRight = 0;
    let startBottom = 0;
    const head = panel.querySelector('.iwara-head');
    head.addEventListener('mousedown', (event) => {
      if (event.target.closest('button, input, select, a')) return;
      dragging = true;
      startX = event.clientX;
      startY = event.clientY;
      const rect = panel.getBoundingClientRect();
      startRight = window.innerWidth - rect.right;
      startBottom = window.innerHeight - rect.bottom;
      event.preventDefault();
    });
    window.addEventListener('mousemove', (event) => {
      if (!dragging) return;
      const nextRight = Math.max(8, startRight - (event.clientX - startX));
      const nextBottom = Math.max(8, startBottom - (event.clientY - startY));
      panel.style.right = `${Math.min(nextRight, window.innerWidth - 80)}px`;
      panel.style.bottom = `${Math.min(nextBottom, window.innerHeight - 60)}px`;
    });
    window.addEventListener('mouseup', () => {
      dragging = false;
    });
  }

  window.addEventListener('beforeunload', persistStateNow);
  main().catch((error) => {
    console.error('[Iwara Downloader]', error);
  });
}());
