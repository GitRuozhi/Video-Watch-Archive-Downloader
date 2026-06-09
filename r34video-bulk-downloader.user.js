// ==UserScript==
// @name         R34Video Bulk Downloader
// @namespace    https://rule34video.com/
// @version      1.0.0
// @description  Batch collect, export, and download directly accessible videos from rule34video.com result pages.
// @author       Codex
// @match        https://rule34video.com/*
// @grant        GM_xmlhttpRequest
// @grant        GM_download
// @grant        GM_setClipboard
// @connect      rule34video.com
// @connect      *
// @run-at       document-idle
// ==/UserScript==

(function () {
  'use strict';

  const CONFIG = {
    MAX_PAGES: 10,
    DOWNLOAD_CONCURRENCY: 2,
    REQUEST_DELAY_MS: 800,
    DOWNLOAD_DELAY_MS: 1200,
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

  const state = {
    posts: new Map(),
    tasks: [],
    fetching: false,
    downloading: false,
    paused: false,
    activeDownloads: 0,
    logLines: [],
  };

  const css = `
    #r34v-bulk-panel {
      position: fixed;
      right: 16px;
      bottom: 16px;
      z-index: 2147483647;
      width: 360px;
      max-width: calc(100vw - 32px);
      color: #e8edf2;
      background: #161b22;
      border: 1px solid #30363d;
      border-radius: 8px;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.42);
      font: 13px/1.45 Arial, Helvetica, sans-serif;
    }
    #r34v-bulk-panel.r34v-minimized .r34v-body {
      display: none;
    }
    #r34v-bulk-panel button,
    #r34v-bulk-panel textarea {
      font: inherit;
    }
    #r34v-bulk-panel button {
      cursor: pointer;
      border: 1px solid #3b434d;
      border-radius: 6px;
      padding: 7px 9px;
      color: #e8edf2;
      background: #242b34;
    }
    #r34v-bulk-panel button:hover {
      background: #303846;
    }
    #r34v-bulk-panel button:disabled {
      cursor: not-allowed;
      opacity: 0.55;
    }
    #r34v-bulk-panel .r34v-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 10px 12px;
      border-bottom: 1px solid #30363d;
      user-select: none;
    }
    #r34v-bulk-panel .r34v-title {
      min-width: 0;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    #r34v-bulk-panel .r34v-head-actions {
      display: flex;
      gap: 6px;
    }
    #r34v-bulk-panel .r34v-head-actions button {
      width: 30px;
      height: 28px;
      padding: 0;
    }
    #r34v-bulk-panel .r34v-body {
      padding: 12px;
    }
    #r34v-bulk-panel .r34v-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }
    #r34v-bulk-panel .r34v-wide {
      grid-column: 1 / -1;
    }
    #r34v-bulk-panel .r34v-stats {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 6px;
      margin: 10px 0;
    }
    #r34v-bulk-panel .r34v-stat {
      padding: 7px 6px;
      border: 1px solid #30363d;
      border-radius: 6px;
      background: #0d1117;
      text-align: center;
    }
    #r34v-bulk-panel .r34v-stat strong {
      display: block;
      font-size: 16px;
      line-height: 1.2;
    }
    #r34v-bulk-panel .r34v-stat span {
      display: block;
      color: #9aa4af;
      font-size: 11px;
    }
    #r34v-bulk-panel .r34v-progress {
      height: 8px;
      overflow: hidden;
      border-radius: 999px;
      background: #0d1117;
      border: 1px solid #30363d;
      margin: 8px 0;
    }
    #r34v-bulk-panel .r34v-progress > div {
      height: 100%;
      width: 0;
      background: #2f81f7;
      transition: width 160ms ease;
    }
    #r34v-bulk-panel .r34v-status,
    #r34v-bulk-panel .r34v-log {
      color: #b8c0ca;
      overflow-wrap: anywhere;
    }
    #r34v-bulk-panel .r34v-status {
      min-height: 20px;
      margin: 8px 0;
    }
    #r34v-bulk-panel .r34v-log {
      max-height: 92px;
      overflow: auto;
      padding: 8px;
      border: 1px solid #30363d;
      border-radius: 6px;
      background: #0d1117;
      white-space: pre-wrap;
    }
    #r34v-export-box {
      display: none;
      width: 100%;
      height: 130px;
      box-sizing: border-box;
      margin-top: 10px;
      padding: 8px;
      resize: vertical;
      color: #dbe4ec;
      background: #0d1117;
      border: 1px solid #30363d;
      border-radius: 6px;
    }
  `;

  function main() {
    injectStyle();
    createPanel();
    addLog('Ready. Open a search or tag result page, then collect videos.');
    updateUi();
  }

  function injectStyle() {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
  }

  function createPanel() {
    const panel = document.createElement('section');
    panel.id = 'r34v-bulk-panel';
    panel.innerHTML = `
      <div class="r34v-head">
        <div class="r34v-title">R34Video Bulk Downloader</div>
        <div class="r34v-head-actions">
          <button type="button" id="r34v-minimize" title="Minimize">_</button>
          <button type="button" id="r34v-clear" title="Clear collected tasks">x</button>
        </div>
      </div>
      <div class="r34v-body">
        <div class="r34v-grid">
          <button type="button" id="r34v-fetch-page">抓取本页</button>
          <button type="button" id="r34v-fetch-pages">抓取最多 10 页</button>
          <button type="button" id="r34v-download">开始下载</button>
          <button type="button" id="r34v-pause">暂停</button>
          <button type="button" id="r34v-export">导出链接</button>
          <button type="button" id="r34v-copy">复制导出</button>
        </div>
        <div class="r34v-stats">
          <div class="r34v-stat"><strong id="r34v-total">0</strong><span>总数</span></div>
          <div class="r34v-stat"><strong id="r34v-ready">0</strong><span>就绪</span></div>
          <div class="r34v-stat"><strong id="r34v-done">0</strong><span>完成</span></div>
          <div class="r34v-stat"><strong id="r34v-failed">0</strong><span>失败</span></div>
        </div>
        <div class="r34v-progress"><div id="r34v-progress-bar"></div></div>
        <div class="r34v-status" id="r34v-status"></div>
        <div class="r34v-log" id="r34v-log"></div>
        <textarea id="r34v-export-box" readonly></textarea>
      </div>
    `;
    document.body.appendChild(panel);

    byId('r34v-fetch-page').addEventListener('click', () => collectPages(1));
    byId('r34v-fetch-pages').addEventListener('click', () => collectPages(CONFIG.MAX_PAGES));
    byId('r34v-download').addEventListener('click', startDownloads);
    byId('r34v-pause').addEventListener('click', togglePause);
    byId('r34v-export').addEventListener('click', showExport);
    byId('r34v-copy').addEventListener('click', copyExport);
    byId('r34v-clear').addEventListener('click', clearTasks);
    byId('r34v-minimize').addEventListener('click', () => panel.classList.toggle('r34v-minimized'));
  }

  async function collectPages(maxPages) {
    if (state.fetching) return;
    state.fetching = true;
    updateUi('Collecting page links...');

    try {
      let pageUrl = location.href;
      const visitedPages = new Set();

      for (let pageIndex = 1; pageIndex <= maxPages && pageUrl; pageIndex += 1) {
        if (visitedPages.has(normalizeUrl(pageUrl))) break;
        visitedPages.add(normalizeUrl(pageUrl));

        updateUi(`Fetching result page ${pageIndex}/${maxPages}`);
        const html = pageIndex === 1 ? document.documentElement.outerHTML : await requestText(pageUrl);
        const doc = parseHtml(html);
        const postUrls = extractPostUrls(doc, pageUrl);
        let added = 0;

        postUrls.forEach((postUrl) => {
          if (!state.posts.has(postUrl)) {
            const task = createTask(postUrl);
            state.posts.set(postUrl, task);
            state.tasks.push(task);
            added += 1;
          }
        });

        addLog(`Page ${pageIndex}: found ${postUrls.length}, added ${added}.`);
        updateUi(`Resolving videos from page ${pageIndex}...`);
        await resolvePendingTasks();

        if (pageIndex >= maxPages) break;
        pageUrl = findNextPageUrl(doc, pageUrl, visitedPages);
        if (pageUrl) await delay(CONFIG.REQUEST_DELAY_MS);
      }

      updateUi('Collect finished.');
    } catch (error) {
      addLog(`Collect failed: ${messageOf(error)}`);
      updateUi('Collect failed.');
    } finally {
      state.fetching = false;
      updateUi();
    }
  }

  function createTask(postUrl) {
    return {
      postUrl,
      videoUrl: '',
      title: '',
      postId: extractPostId(postUrl),
      filename: '',
      status: STATUS.PENDING,
      error: '',
      retries: 0,
    };
  }

  async function resolvePendingTasks() {
    const targets = state.tasks.filter((task) => task.status === STATUS.PENDING);
    for (const task of targets) {
      task.status = STATUS.FETCHING;
      task.error = '';
      updateUi(`Resolving ${task.postUrl}`);

      try {
        const html = await requestText(task.postUrl);
        const doc = parseHtml(html);
        const videoUrl = extractVideoUrl(doc, task.postUrl);
        if (!videoUrl) throw new Error('No direct video URL found');

        task.videoUrl = videoUrl;
        task.title = extractTitle(doc);
        task.postId = task.postId || extractPostIdFromDocument(doc) || shortHash(task.postUrl);
        task.filename = buildFilename(task);
        task.status = STATUS.READY;
      } catch (error) {
        task.status = STATUS.FAILED;
        task.error = messageOf(error);
        addLog(`Resolve failed: ${task.postUrl} - ${task.error}`);
      }

      updateUi();
      await delay(CONFIG.REQUEST_DELAY_MS);
    }
  }

  function extractPostUrls(doc, baseUrl) {
    const urls = new Set();
    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const mediaExtPattern = /\.(mp4|webm|m4v|mov)(?:[?#].*)?$/i;

    anchors.forEach((anchor) => {
      const rawHref = anchor.getAttribute('href');
      const absolute = safeUrl(rawHref, baseUrl);
      if (!absolute || absolute.origin !== location.origin) return;
      if (mediaExtPattern.test(absolute.pathname)) return;

      const text = `${rawHref || ''} ${anchor.textContent || ''} ${anchor.title || ''}`.toLowerCase();
      const path = absolute.pathname.toLowerCase();
      const looksLikeVideoPost =
        /\/video\/|\/videos\/|\/post\/|\/view\//.test(path) ||
        /(?:^|[?&])id=\d+/.test(absolute.search) ||
        /\b(video|watch|view)\b/.test(text);

      if (looksLikeVideoPost && !isNavigationUrl(absolute)) {
        urls.add(normalizeUrl(absolute.href));
      }
    });

    return Array.from(urls);
  }

  function extractVideoUrl(doc, baseUrl) {
    const directSelectors = [
      'video source[src]',
      'video[src]',
      'source[type*="video"][src]',
      'a[href$=".mp4"]',
      'a[href$=".webm"]',
      'a[href$=".m4v"]',
      'a[href$=".mov"]',
    ];

    for (const selector of directSelectors) {
      const el = doc.querySelector(selector);
      const url = safeUrl(el && (el.getAttribute('src') || el.getAttribute('href')), baseUrl);
      if (url && isMediaUrl(url.href)) return url.href;
    }

    const candidates = [];
    const attrs = ['src', 'href', 'data-src', 'data-video', 'data-file', 'content'];
    doc.querySelectorAll('*').forEach((el) => {
      attrs.forEach((attr) => {
        const value = el.getAttribute(attr);
        if (!value) return;
        const url = safeUrl(value, baseUrl);
        if (url && isMediaUrl(url.href)) candidates.push(url.href);
      });
    });

    const htmlCandidates = Array.from(doc.documentElement.innerHTML.matchAll(/https?:\/\/[^"'<>\\\s]+?\.(?:mp4|webm|m4v|mov)(?:\?[^"'<>\\\s]*)?/gi))
      .map((match) => decodeHtmlEntities(match[0]));

    return Array.from(new Set([...candidates, ...htmlCandidates])).find(isMediaUrl) || '';
  }

  function findNextPageUrl(doc, baseUrl, visitedPages) {
    const relNext = doc.querySelector('a[rel="next"][href]');
    const relNextUrl = safeUrl(relNext && relNext.getAttribute('href'), baseUrl);
    if (relNextUrl && !visitedPages.has(normalizeUrl(relNextUrl.href))) return relNextUrl.href;

    const anchors = Array.from(doc.querySelectorAll('a[href]'));
    const nextByText = anchors.find((anchor) => {
      const text = (anchor.textContent || '').trim().toLowerCase();
      return ['next', 'next >', '>', '下一页', '下页', 'older'].includes(text);
    });
    const nextTextUrl = safeUrl(nextByText && nextByText.getAttribute('href'), baseUrl);
    if (nextTextUrl && !visitedPages.has(normalizeUrl(nextTextUrl.href))) return nextTextUrl.href;

    const current = new URL(baseUrl, location.href);
    const numericNext = inferNextPageUrl(current);
    if (numericNext && !visitedPages.has(normalizeUrl(numericNext))) return numericNext;

    return '';
  }

  function inferNextPageUrl(current) {
    const params = current.searchParams;
    const names = ['page', 'p', 'pid'];
    for (const name of names) {
      if (!params.has(name)) continue;
      const value = Number(params.get(name));
      if (!Number.isFinite(value)) continue;
      params.set(name, String(value + 1));
      return current.href;
    }

    if (/\/page\/\d+\/?$/i.test(current.pathname)) {
      current.pathname = current.pathname.replace(/\/page\/(\d+)\/?$/i, (_, page) => `/page/${Number(page) + 1}/`);
      return current.href;
    }

    return '';
  }

  function startDownloads() {
    if (state.downloading) return;
    state.downloading = true;
    state.paused = false;
    addLog('Download queue started.');
    updateUi();
    pumpDownloads();
  }

  function togglePause() {
    state.paused = !state.paused;
    addLog(state.paused ? 'Download queue paused.' : 'Download queue resumed.');
    updateUi();
    if (!state.paused) pumpDownloads();
  }

  function pumpDownloads() {
    if (!state.downloading || state.paused) return;

    while (state.activeDownloads < CONFIG.DOWNLOAD_CONCURRENCY) {
      const task = nextDownloadTask();
      if (!task) break;
      downloadTask(task);
    }

    if (state.activeDownloads === 0 && !nextDownloadTask()) {
      state.downloading = false;
      updateUi('Download queue finished.');
    }
  }

  function nextDownloadTask() {
    return state.tasks.find((task) => task.status === STATUS.READY || (task.status === STATUS.FAILED && task.videoUrl && task.retries <= CONFIG.RETRY_LIMIT));
  }

  function downloadTask(task) {
    task.status = STATUS.DOWNLOADING;
    task.error = '';
    state.activeDownloads += 1;
    updateUi(`Downloading ${task.filename}`);

    GM_download({
      url: task.videoUrl,
      name: task.filename,
      saveAs: false,
      onload: () => finishDownload(task, true),
      onerror: (error) => finishDownload(task, false, error && (error.error || error.details || error.toString())),
      ontimeout: () => finishDownload(task, false, 'Download timed out'),
    });
  }

  function finishDownload(task, ok, errorText) {
    if (ok) {
      task.status = STATUS.DONE;
      addLog(`Done: ${task.filename}`);
    } else {
      task.retries += 1;
      task.status = STATUS.FAILED;
      task.error = errorText || 'Download failed';
      addLog(`Download failed: ${task.filename} - ${task.error}`);
    }

    state.activeDownloads = Math.max(0, state.activeDownloads - 1);
    updateUi();
    setTimeout(pumpDownloads, CONFIG.DOWNLOAD_DELAY_MS);
  }

  function showExport() {
    const box = byId('r34v-export-box');
    box.value = buildExportText();
    box.style.display = 'block';
    box.focus();
    box.select();
    updateUi('Export generated.');
  }

  function copyExport() {
    const text = buildExportText();
    if (!text) {
      updateUi('No ready video links to copy.');
      return;
    }

    GM_setClipboard(text, 'text');
    const box = byId('r34v-export-box');
    box.value = text;
    box.style.display = 'block';
    updateUi('Export copied to clipboard.');
  }

  function buildExportText() {
    return state.tasks
      .filter((task) => task.videoUrl)
      .map((task) => `${task.filename || buildFilename(task)}\t${task.videoUrl}\t${task.postUrl}`)
      .join('\n');
  }

  function clearTasks() {
    if (state.downloading || state.fetching) {
      updateUi('Stop current work before clearing.');
      return;
    }

    state.posts.clear();
    state.tasks = [];
    state.logLines = [];
    const box = byId('r34v-export-box');
    box.value = '';
    box.style.display = 'none';
    addLog('Cleared.');
    updateUi();
  }

  function updateUi(statusText) {
    const total = state.tasks.length;
    const ready = countByStatus(STATUS.READY);
    const done = countByStatus(STATUS.DONE);
    const failed = countByStatus(STATUS.FAILED);
    const resolvedTotal = total ? state.tasks.filter((task) => task.videoUrl || task.status === STATUS.FAILED).length : 0;
    const progress = total ? Math.round(((done + failed) / total) * 100) : 0;

    setText('r34v-total', total);
    setText('r34v-ready', ready);
    setText('r34v-done', done);
    setText('r34v-failed', failed);
    byId('r34v-progress-bar').style.width = `${progress}%`;
    setText('r34v-status', statusText || defaultStatus(total, ready, done, failed, resolvedTotal));
    setText('r34v-log', state.logLines.slice(-8).join('\n'));

    byId('r34v-fetch-page').disabled = state.fetching;
    byId('r34v-fetch-pages').disabled = state.fetching;
    byId('r34v-download').disabled = state.downloading || !state.tasks.some((task) => task.status === STATUS.READY);
    byId('r34v-pause').disabled = !state.downloading;
    byId('r34v-pause').textContent = state.paused ? '继续' : '暂停';
    byId('r34v-export').disabled = !state.tasks.some((task) => task.videoUrl);
    byId('r34v-copy').disabled = !state.tasks.some((task) => task.videoUrl);
  }

  function defaultStatus(total, ready, done, failed, resolvedTotal) {
    if (state.fetching) return `Fetching... resolved ${resolvedTotal}/${total}`;
    if (state.downloading) return `Downloading... active ${state.activeDownloads}, done ${done}, failed ${failed}`;
    if (!total) return 'No tasks collected.';
    return `Ready ${ready}, done ${done}, failed ${failed}.`;
  }

  function countByStatus(status) {
    return state.tasks.filter((task) => task.status === status).length;
  }

  function addLog(text) {
    const time = new Date().toLocaleTimeString();
    state.logLines.push(`[${time}] ${text}`);
    if (state.logLines.length > 80) state.logLines.shift();
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

  function parseHtml(html) {
    return new DOMParser().parseFromString(html, 'text/html');
  }

  function extractTitle(doc) {
    const selectors = ['h1', '.title', '[itemprop="name"]', 'meta[property="og:title"]', 'title'];
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
      const idParam = parsed.searchParams.get('id') || parsed.searchParams.get('video') || parsed.searchParams.get('v');
      if (idParam && /^\d+$/.test(idParam)) return idParam;

      const match = parsed.pathname.match(/(?:video|videos|post|view|watch)[/-](\d+)/i) || parsed.pathname.match(/(\d{3,})(?:\/)?$/);
      return match ? match[1] : '';
    } catch (_) {
      return '';
    }
  }

  function extractPostIdFromDocument(doc) {
    const canonical = doc.querySelector('link[rel="canonical"][href]');
    return extractPostId(canonical && canonical.getAttribute('href'));
  }

  function buildFilename(task) {
    const ext = extensionFromUrl(task.videoUrl) || '.mp4';
    const id = task.postId || shortHash(task.videoUrl || task.postUrl);
    const title = sanitizeFilename(task.title);
    const base = title ? `${id} - ${title}` : id;
    return `${truncateFilename(base, 150)}${ext}`;
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

  function extensionFromUrl(url) {
    try {
      const pathname = new URL(url, location.href).pathname;
      const match = pathname.match(/\.(mp4|webm|m4v|mov)$/i);
      return match ? `.${match[1].toLowerCase()}` : '';
    } catch (_) {
      return '';
    }
  }

  function isMediaUrl(url) {
    const lower = decodeURIComponent(String(url)).toLowerCase();
    return CONFIG.MEDIA_EXTENSIONS.some((extension) => lower.includes(extension));
  }

  function isNavigationUrl(url) {
    const path = url.pathname.toLowerCase();
    return /\/(?:login|signup|register|contact|privacy|terms|tags|categories|models|channels)\/?$/.test(path);
  }

  function normalizeUrl(url) {
    const parsed = new URL(url, location.href);
    parsed.hash = '';
    return parsed.href;
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

  function decodeHtmlEntities(value) {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = value;
    return textarea.value;
  }

  function normalizeWhitespace(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
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
    byId(id).textContent = String(value);
  }

  main();
})();
