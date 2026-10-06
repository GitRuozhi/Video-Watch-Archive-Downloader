#!/usr/bin/env node
'use strict';

// Real Edge UI regression coverage for both R34 language builds. All pages,
// resolver responses, and download URLs are synthetic and served on loopback.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '../..');
const OUTPUT_DIR = path.join(ROOT, '.git', 'idm-verification', 'r34-browser-ui');
const STORE_KEY = 'r34v_bulk_downloader_state_v2';
const SCRIPTS = [
  { file: 'r34-video-watch-archive-downloader.user.js', language: 'en' },
  { file: 'r34-video-watch-archive-downloader.zh.user.js', language: 'zh' },
];
const IDS = ['101', '102', '103', '104', '105', '106'];
const OLD_IDS = IDS.slice(0, 5);
const STALE_DATE = '2020-01-02T03:04:05.000Z';

function taskFor(id, baseUrl, fresh) {
  const postUrl = `${baseUrl}/video/${id}`;
  const videoUrl = `${baseUrl}/media/${fresh ? 'fresh' : 'old'}-${id}.mp4?signature=${fresh ? 'fresh' : 'legacy'}-${id}`;
  return {
    postUrl,
    videoUrl,
    status: 'ready',
    resolvedAt: fresh ? new Date().toISOString() : (id === '101' ? undefined : STALE_DATE),
    capturedAt: STALE_DATE,
    title: `Safe browser fixture ${id}`,
    postId: id,
    originalFilename: `${fresh ? 'fresh' : 'old'}-${id}.mp4`,
    selectedQuality: '720p',
    requestedQuality: 'best',
    availableQualities: [{ label: '720p', url: videoUrl, height: 720, hd: true }],
    filename: `fixture-${id}.mp4`,
    metadata: { id, title: `Safe browser fixture ${id}`, videoUrl, downloadUrl: videoUrl, postUrl },
    retries: 0,
    error: '',
    downloadMetadataRequested: false,
    metaDownloadDone: false,
    videoDownloadSubmitted: false,
    videoDownloadDone: false,
    finalFailureCounted: false,
  };
}

function fixtureState(baseUrl, { allStale = false } = {}) {
  const tasks = IDS.map((id) => taskFor(id, baseUrl, !allStale && id === '106'));
  return {
    tasks,
    seen: Object.fromEntries(tasks.map((task) => [task.postUrl, true])),
    settings: {
      maxPages: 10,
      resolveConcurrency: 8,
      quality: 'best',
      exportMode: 'idm',
      keepId: true,
      keepTitle: true,
      keepOriginal: true,
      autoQueueSingle: false,
      autoDownloadSingle: false,
      downloadMetadata: false,
      advancedOpen: true,
    },
    stats: { currentPage: 1, pagesCollected: 0, totalPages: 0 },
    collection: { active: false, stopped: false, startUrl: '', lastUrl: '', wrapCount: 0 },
    downloadStats: { success: 0, failed: 0 },
    logLines: [],
  };
}

function safeHtml(id, directUrl) {
  return `<!doctype html><meta charset="utf-8"><title>Local safe fixture ${id}</title>`
    + `<h1>Safe synthetic video page ${id}</h1>`
    + `<script>var flashvars = { video_url: '${directUrl}', video_id: '${id}', video_title: 'Safe synthetic fixture ${id}' };</script>`;
}

function fixtureServer() {
  const state = { status: 200, delayMs: 450, calls: [] };
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    state.calls.push(url.pathname);
    if (url.pathname.startsWith('/video/')) {
      const id = url.pathname.slice('/video/'.length);
      if (!IDS.includes(id)) {
        res.writeHead(404).end('unknown safe fixture');
        return;
      }
      setTimeout(() => {
        if (state.status !== 200) {
          res.writeHead(state.status, { 'content-type': 'text/plain' }).end('synthetic resolver failure');
          return;
        }
        const directUrl = `http://127.0.0.1:${server.address().port}/media/fresh-${id}.mp4?signature=fresh-${id}`;
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(safeHtml(id, directUrl));
      }, state.delayMs);
      return;
    }
    if (url.pathname === '/fixture') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(
        '<!doctype html><meta charset="utf-8"><title>Local R34 export test fixture</title><h1>Safe local fixture</h1>'
      );
      return;
    }
    res.writeHead(404).end('not found');
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve({ server, state, port: server.address().port }));
  });
}

function makePlaywrightPath() {
  const fromArg = process.argv[2];
  const fromEnv = process.env.R34_PLAYWRIGHT_PATH;
  return fromArg || fromEnv || 'playwright';
}

function waitForCondition(page, expression, message) {
  return page.waitForFunction(expression, null, { timeout: 12000 }).catch((error) => {
    throw new Error(`${message}: ${error.message}`);
  });
}

function collectDownloadEvents(page, expectedCount, timeoutMs = 12000) {
  return new Promise((resolve, reject) => {
    const events = [];
    const timer = setTimeout(() => finish(new Error(`Expected ${expectedCount} browser downloads, got ${events.length}`)), timeoutMs);
    const onDownload = (download) => {
      events.push(download);
      if (events.length === expectedCount) finish(null);
    };
    function finish(error) {
      clearTimeout(timer);
      page.off('download', onDownload);
      if (error) reject(error);
      else resolve(events);
    }
    page.on('download', onDownload);
  });
}

async function runScript(browser, playwright, serverInfo, scriptInfo) {
  const { state: serverState, port } = serverInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const initialResolverCallCount = serverState.calls.filter((url) => url.startsWith('/video/')).length;
  const storage = fixtureState(baseUrl);
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  const consoleErrors = [];
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  await context.route('**/*', async (route) => {
    const target = new URL(route.request().url());
    if (target.protocol === 'http:' && target.hostname === '127.0.0.1' && target.port === String(port)) {
      await route.continue();
    } else {
      await route.abort('blockedbyclient');
      throw new Error(`Blocked non-local browser request: ${target.href}`);
    }
  });
  await page.addInitScript(({ key, initial }) => {
    const values = new Map([[key, JSON.stringify(initial)]]);
    const listeners = new Map();
    let nextListener = 1;
    window.__gmCalls = [];
    window.GM_getValue = (name, fallback) => values.has(name) ? values.get(name) : fallback;
    window.GM_setValue = (name, value) => {
      const previous = values.get(name);
      values.set(name, value);
      for (const listener of listeners.get(name) || []) listener(name, previous, value, false);
    };
    window.GM_deleteValue = (name) => values.delete(name);
    window.GM_addValueChangeListener = (name, callback) => {
      const list = listeners.get(name) || [];
      list.push(callback);
      listeners.set(name, list);
      return nextListener++;
    };
    window.GM_xmlhttpRequest = (options) => {
      window.__gmCalls.push(options.url);
      fetch(options.url, { method: options.method || 'GET', headers: options.headers || {} })
        .then(async (response) => options.onload({ status: response.status, responseText: await response.text() }))
        .catch((error) => options.onerror({ error: error.message }));
    };
    window.GM_download = () => { throw new Error('Synthetic export test must not call GM_download'); };
  }, { key: STORE_KEY, initial: storage });

  try {
    await page.goto(`${baseUrl}/fixture?language=${scriptInfo.language}`, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.addScriptTag({ path: path.join(ROOT, scriptInfo.file) });
    await page.locator('#r34v-bulk-panel').waitFor({ state: 'attached', timeout: 8000 });
    const downloadButton = page.locator('#r34v-download');
    await page.locator('#r34v-export-mode').waitFor({ state: 'visible', timeout: 5000 });
    assert.equal(await page.locator('#r34v-export-mode').inputValue(), 'idm', `${scriptInfo.language}: saved IDM mode restored`);
    assert.equal(await page.locator('#r34v-quality').inputValue(), 'best', `${scriptInfo.language}: quality control rendered`);
    assert.equal(await page.locator('#r34v-auto-queue').isChecked(), false, `${scriptInfo.language}: auto queue disabled`);
    assert.equal(await page.locator('#r34v-auto-download').isChecked(), false, `${scriptInfo.language}: auto download disabled`);
    assert.equal(await page.locator('#r34v-bulk-panel').evaluate((el) => el.classList.contains('r34v-advanced-open')), true);
    const initialShot = path.join(OUTPUT_DIR, `${scriptInfo.language}-ready.png`);
    await page.screenshot({ path: initialShot, fullPage: true });

    const outputEvents = [];
    const firstDownloads = collectDownloadEvents(page, 2);
    await downloadButton.click();
    await waitForCondition(page, () => window.__gmCalls && window.__gmCalls.length >= 1, 'first refresh request should start');
    assert.equal(await downloadButton.isDisabled(), true, 'Start is disabled during refresh');
    for (const id of ['r34v-clear', 'r34v-collect-current', 'r34v-collect-toggle', 'r34v-export-mode', 'r34v-quality']) {
      assert.equal(await page.locator(`#${id}`).isDisabled(), true, `${id} is disabled during refresh`);
    }
    await page.screenshot({ path: path.join(OUTPUT_DIR, `${scriptInfo.language}-refreshing.png`), fullPage: true });
    for (const [index, event] of (await firstDownloads).entries()) {
      const destination = path.join(OUTPUT_DIR, `${scriptInfo.language}-captured-${index + 1}-${event.suggestedFilename()}`);
      await event.saveAs(destination);
      const text = fs.readFileSync(destination, 'utf8');
      outputEvents.push({ filename: event.suggestedFilename(), eventUrl: event.url(), path: destination, text });
    }
    await waitForCondition(page, () => !document.querySelector('#r34v-download').disabled, 'controls should recover after successful refresh');
    assert.equal((await page.evaluate(() => window.__gmCalls)).length, 5, 'only five stale URLs were refreshed');
    assert.equal(serverState.calls.filter((url) => url.startsWith('/video/')).length - initialResolverCallCount, 5, 'GM shim made exactly five local resolver requests');
    assert.equal(await page.locator('#r34v-quality').isDisabled(), false, 'quality control is enabled after refresh');
    assert.equal(await page.locator('#r34v-export-mode').isDisabled(), false, 'export mode is enabled after refresh');

    assert.equal(outputEvents.length, 2, 'one click must emit EF2 and JSONL downloads');
    const ef2 = outputEvents.find((item) => item.filename.endsWith('.ef2'));
    const jsonl = outputEvents.find((item) => item.filename.endsWith('.jsonl'));
    assert.ok(ef2, 'EF2 download was captured from browser');
    assert.ok(jsonl, 'JSONL metadata download was captured from browser');
    assert.equal((ef2.text.match(/fresh-\d+\.mp4/g) || []).length, 6, 'EF2 contains all six fresh links');
    assert.equal(jsonl.text.split('\n').filter(Boolean).length, 6, 'JSONL contains six metadata rows');
    for (const id of IDS) {
      assert.ok(ef2.text.includes(`fresh-${id}.mp4?signature=fresh-${id}`), `EF2 contains fresh URL ${id}`);
      assert.ok(jsonl.text.includes(`fresh-${id}.mp4?signature=fresh-${id}`), `JSONL contains fresh URL ${id}`);
    }
    for (const id of OLD_IDS) {
      assert.ok(!ef2.text.includes(`old-${id}.mp4`), `EF2 excludes stale URL ${id}`);
      assert.ok(!jsonl.text.includes(`old-${id}.mp4`), `JSONL excludes stale URL ${id}`);
    }

    // Fresh links do not request again. Force them stale through a clean reload,
    // then exercise a complete 503 round and a successful retry in the same UI.
    serverState.status = 503;
    serverState.delayMs = 120;
    const failureStorage = fixtureState(baseUrl, { allStale: true });
    // New context keeps the failed-response scenario isolated and restores the
    // exact persisted legacy state via its GM shim.
    await context.close();
    const failureResult = await runFailureRetry(browser, serverInfo, scriptInfo, failureStorage);
    return {
      language: scriptInfo.language,
      script: scriptInfo.file,
      initialScreenshot: path.basename(initialShot),
      refreshScreenshot: `${scriptInfo.language}-refreshing.png`,
      downloads: outputEvents.map(({ filename, eventUrl, path: filepath, text }) => ({
        filename,
        eventUrl,
        file: path.relative(OUTPUT_DIR, filepath),
        bytes: Buffer.byteLength(text),
        preview: text.slice(0, 30),
      })),
      successfulResolutionRequests: 5,
      failedRoundRequests: failureResult.failedRoundRequests,
      retryRoundRequests: failureResult.retryRoundRequests,
      consoleErrors,
    };
  } catch (error) {
    if (!context.pages().every((p) => p.isClosed())) await context.close().catch(() => {});
    throw error;
  }
}

async function runFailureRetry(browser, serverInfo, scriptInfo, storage) {
  const { port, state: serverState } = serverInfo;
  const baseUrl = `http://127.0.0.1:${port}`;
  const context = await browser.newContext({ acceptDownloads: true });
  const page = await context.newPage();
  await context.route('**/*', async (route) => {
    const target = new URL(route.request().url());
    if (target.protocol === 'http:' && target.hostname === '127.0.0.1' && target.port === String(port)) await route.continue();
    else await route.abort('blockedbyclient');
  });
  await page.addInitScript(({ key, initial }) => {
    const values = new Map([[key, JSON.stringify(initial)]]);
    const listeners = new Map();
    window.__gmCalls = [];
    window.GM_getValue = (name, fallback) => values.has(name) ? values.get(name) : fallback;
    window.GM_setValue = (name, value) => values.set(name, value);
    window.GM_deleteValue = (name) => values.delete(name);
    window.GM_addValueChangeListener = (name, callback) => {
      const list = listeners.get(name) || [];
      list.push(callback);
      listeners.set(name, list);
      return list.length;
    };
    window.GM_xmlhttpRequest = (options) => {
      window.__gmCalls.push(options.url);
      fetch(options.url, { method: options.method || 'GET', headers: options.headers || {} })
        .then(async (response) => options.onload({ status: response.status, responseText: await response.text() }))
        .catch((error) => options.onerror({ error: error.message }));
    };
    window.GM_download = () => { throw new Error('Unexpected GM_download'); };
  }, { key: STORE_KEY, initial: storage });

  try {
    await page.goto(`${baseUrl}/fixture?language=${scriptInfo.language}&scenario=retry`, { waitUntil: 'domcontentloaded', timeout: 8000 });
    await page.addScriptTag({ path: path.join(ROOT, scriptInfo.file) });
    const button = page.locator('#r34v-download');
    await button.waitFor({ state: 'visible', timeout: 8000 });
    let unexpectedDownload = false;
    page.on('download', () => { unexpectedDownload = true; });
    const priorCallCount = serverState.calls.filter((url) => url.startsWith('/video/')).length;
    await button.click();
    await waitForCondition(page, () => window.__gmCalls.length === 6, '503 export should refresh all six stale URLs');
    await waitForCondition(page, () => !document.querySelector('#r34v-download').disabled, 'start button should be retryable after failure');
    await page.waitForTimeout(250);
    assert.equal(unexpectedDownload, false, '503 failure must not emit downloads');
    const failedCalls = await page.evaluate(() => window.__gmCalls.slice());
    assert.equal(failedCalls.length, 6);
    assert.equal(await button.isDisabled(), false, 'Start can be clicked after a failed export');
    const retryButton = page.locator('#r34v-retry-failed');
    assert.equal(await retryButton.isDisabled(), false, 'Again can be clicked after failed refresh');
    assert.equal(serverState.calls.filter((url) => url.startsWith('/video/')).length - priorCallCount, 6);

    serverState.status = 200;
    const downloadEvents = collectDownloadEvents(page, 2);
    await retryButton.click();
    const events = await downloadEvents;
    const texts = [];
    for (const [index, event] of events.entries()) {
      const file = path.join(OUTPUT_DIR, `${scriptInfo.language}-retry-${index + 1}-${event.suggestedFilename()}`);
      await event.saveAs(file);
      texts.push({ filename: event.suggestedFilename(), text: fs.readFileSync(file, 'utf8') });
    }
    await waitForCondition(page, () => !document.querySelector('#r34v-download').disabled, 'retry export should finish');
    assert.equal((await page.evaluate(() => window.__gmCalls)).length, 12, 'Again retried all six links');
    assert.ok(texts.find((item) => item.filename.endsWith('.ef2'))?.text.includes('fresh-101.mp4'));
    assert.ok(texts.find((item) => item.filename.endsWith('.jsonl'))?.text.includes('fresh-106.mp4'));
    return { failedRoundRequests: failedCalls.length, retryRoundRequests: 6 };
  } finally {
    await context.close();
  }
}

async function main() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const playwrightPath = makePlaywrightPath();
  let playwright;
  try {
    playwright = require(playwrightPath);
  } catch (error) {
    throw new Error(`Playwright unavailable at ${playwrightPath}. Pass its module path or set R34_PLAYWRIGHT_PATH. ${error.message}`);
  }
  const serverInfo = await fixtureServer();
  let browser;
  const results = [];
  try {
    browser = await playwright.chromium.launch({ channel: 'msedge', headless: true, timeout: 15000 });
    for (const scriptInfo of SCRIPTS) results.push(await runScript(browser, playwright, serverInfo, scriptInfo));
  } finally {
    if (browser) await browser.close();
    await new Promise((resolve) => serverInfo.server.close(resolve));
  }
  const report = {
    generatedAt: new Date().toISOString(),
    browser: 'Microsoft Edge via Playwright channel=msedge, headless=true',
    scope: 'Real browser UI execution of both complete userscript IIFEs with a local GM API shim and synthetic 127.0.0.1 HTML fixtures; not a real Tampermonkey extension and not the R34 site.',
    networkPolicy: 'Browser requests allowed only to the temporary 127.0.0.1 fixture server; no real sites or external hosts are accessed.',
    results,
  };
  fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main().catch((error) => {
  const failure = { generatedAt: new Date().toISOString(), ok: false, error: error.stack || error.message };
  try { fs.writeFileSync(path.join(OUTPUT_DIR, 'report.json'), `${JSON.stringify(failure, null, 2)}\n`); } catch (_) { /* preserve the original test error */ }
  process.stderr.write(`${failure.error}\n`);
  process.exitCode = 1;
});
