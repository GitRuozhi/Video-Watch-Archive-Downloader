const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const SCRIPTS = [
  'r34-video-watch-archive-downloader.user.js',
  'r34-video-watch-archive-downloader.zh.user.js',
];
const STALE_DATE = '2020-01-02T03:04:05.000Z';
const FRESH_DATE = '2026-10-06T11:55:00.000Z';

function makeDocument(html) {
  return {
    documentElement: { innerHTML: html, outerHTML: html },
    title: '',
    createElement(tagName) {
      if (String(tagName).toLowerCase() === 'textarea') {
        return { innerHTML: '', get value() { return this.innerHTML; }, set value(value) { this.innerHTML = value; } };
      }
      return { innerHTML: '', textContent: '', value: '' };
    },
    querySelectorAll() { return []; },
    querySelector() { return null; },
  };
}

class FakeDOMParser {
  parseFromString(html) {
    return makeDocument(html);
  }
}

function loadScript({
  script,
  gmRequest,
  locationHref = 'https://example.test/current-page',
  documentHtml = '',
  now = () => new Date('2026-10-06T12:00:00.000Z'),
} = {}) {
  script = script || SCRIPTS[0];
  const source = fs.readFileSync(path.join(ROOT, script), 'utf8');
  const startupMarker = "window.addEventListener('beforeunload', persistStateNow);";
  const closureMarker = '})();';
  const startupAt = source.lastIndexOf(startupMarker);
  const closureAt = source.lastIndexOf(closureMarker);
  assert.notEqual(startupAt, -1, 'R34 bootstrap marker should exist');
  assert.ok(closureAt > startupAt, 'R34 terminal IIFE close should follow bootstrap marker');

  const hook = `
  const testOutputFiles = [];
  const scheduledWatchChecks = [];
  saveSettingsFromUi = () => {};
  persistState = () => {};
  updateUi = () => {};
  addLog = () => {};
  delay = async () => {};
  scheduleWatchedPageCheck = (source) => scheduledWatchChecks.push(source);
  downloadTextFile = (filename, text, mime) => testOutputFiles.push({ filename, text, mime });
  window.__r34ExportRefreshTest = {
    state,
    EXPORT_MODE,
    CONFIG,
    watchedPage,
    scheduledWatchChecks,
    outputFiles: testOutputFiles,
    startDownloads,
    runWatchedPageCheck,
    exportResolvedTasks,
    refreshTasksForExport,
    saveOutputFiles,
    setTasks(tasks) { state.tasks = tasks; },
    setMode(mode) { state.settings.exportMode = mode; },
    setWatchedPostUrl(url) { detectCurrentWatchedPostUrl = () => url; },
  };
`;
  const instrumented = source.slice(0, startupAt) + hook + source.slice(closureAt);
  const window = { addEventListener() {}, setTimeout, clearTimeout };
  const context = vm.createContext({
    window,
    document: makeDocument(documentHtml),
    location: { href: locationHref },
    navigator: { userAgent: 'R34 export refresh regression test' },
    DOMParser: FakeDOMParser,
    GM_xmlhttpRequest: gmRequest || (() => { throw new Error('Unexpected request'); }),
    URL,
    Blob,
    Date: class extends Date {
      constructor(...args) { super(...(args.length ? args : [now()])); }
      static now() { return now().getTime(); }
    },
    setTimeout,
    clearTimeout,
    console,
  });
  vm.runInContext(instrumented, context, { filename: script });
  return window.__r34ExportRefreshTest;
}

function staleTask(id, overrides = {}) {
  const postUrl = `https://example.test/video/${id}`;
  const oldUrl = `https://cdn.example.test/old-${id}.mp4?signature=old-${id}`;
  return {
    postUrl,
    videoUrl: oldUrl,
    status: 'ready',
    resolvedAt: STALE_DATE,
    capturedAt: STALE_DATE,
    originalFilename: `old-${id}.mp4`,
    selectedQuality: '720p',
    availableQualities: [{ label: '720p', url: oldUrl }],
    filename: `old-${id}.mp4`,
    metadata: { id, videoUrl: oldUrl, downloadUrl: oldUrl, title: `Fixture ${id}` },
    ...overrides,
  };
}

function responseFor(videoUrl) {
  return `<!doctype html><script>var flashvars = { video_url: '${videoUrl}', video_id: '12345', video_title: 'Local fixture' };</script>`;
}

function responseAdapter(routes, { defer = false } = {}) {
  const calls = [];
  const pending = [];
  const handler = (options) => {
    calls.push(options.url);
    const response = routes.get(options.url);
    if (defer) {
      pending.push(() => options.onload(response || { status: 404, responseText: '' }));
    } else {
      queueMicrotask(() => options.onload(response || { status: 404, responseText: '' }));
    }
  };
  return { handler, calls, pending };
}

function success(videoUrl) {
  return { status: 200, responseText: responseFor(videoUrl) };
}

function outputContaining(api, extension) {
  return api.outputFiles.filter((file) => file.filename.endsWith(extension));
}

for (const SCRIPT of SCRIPTS) {
test(`${SCRIPT}: export refreshes legacy tasks without resolvedAt and expired cached tasks`, async () => {
  const legacy = staleTask('101', { resolvedAt: undefined });
  const expired = staleTask('102');
  const unresolved = staleTask('103', { videoUrl: '', status: 'pending', resolvedAt: '' });
  const freshOne = 'https://cdn.example.test/new-101.mp4?token=fixture-a';
  const freshTwo = 'https://cdn.example.test/new-102.mp4?token=fixture-b';
  const freshThree = 'https://cdn.example.test/new-103.mp4?token=fixture-c';
  const gm = responseAdapter(new Map([
    [legacy.postUrl, success(freshOne)],
    [expired.postUrl, success(freshTwo)],
    [unresolved.postUrl, success(freshThree)],
  ]));
  const api = loadScript({ script: SCRIPT, gmRequest: gm.handler });
  api.setTasks([legacy, expired, unresolved]);
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  assert.deepEqual(gm.calls.sort(), [legacy.postUrl, expired.postUrl, unresolved.postUrl].sort());
  assert.equal(legacy.videoUrl, freshOne, JSON.stringify({ calls: gm.calls, status: legacy.status, error: legacy.error }));
  assert.equal(expired.videoUrl, freshTwo);
  assert.equal(unresolved.videoUrl, freshThree);
  for (const task of [legacy, expired, unresolved]) {
    assert.ok(Number.isFinite(Date.parse(task.resolvedAt)), 'successful refresh should set an ISO timestamp');
    assert.equal(new Date(task.resolvedAt).toISOString(), task.resolvedAt);
  }
  const ef2 = outputContaining(api, '.ef2');
  assert.equal(ef2.length, 1);
  assert.ok(ef2[0].text.includes(freshOne));
  assert.ok(ef2[0].text.includes(freshTwo));
  assert.ok(ef2[0].text.includes(freshThree));
  assert.ok(!ef2[0].text.includes('old-101.mp4'));
  assert.ok(!ef2[0].text.includes('old-102.mp4'));
});

test(`${SCRIPT}: refresh failure removes stale URLs from EF2 and JSONL, and a later export can retry`, async () => {
  const task = staleTask('201');
  const refreshedUrl = 'https://cdn.example.test/retry-201.mp4?token=second-attempt';
  let shouldFail = true;
  const gm = responseAdapter(new Map([[task.postUrl, success(refreshedUrl)]]));
  const api = loadScript({
    script: SCRIPT,
    gmRequest(options) {
      if (shouldFail) {
        gm.calls.push(options.url);
        queueMicrotask(() => options.onload({ status: 503, responseText: '' }));
      } else {
        gm.handler(options);
      }
    },
  });
  api.setTasks([task]);
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  assert.equal(task.videoUrl, '', 'failed refresh must not retain the old signed link');
  assert.equal(task.status, 'failed');
  assert.equal(task.postUrl, 'https://example.test/video/201');
  assert.equal(outputContaining(api, '.ef2').length, 0);
  assert.equal(outputContaining(api, '.jsonl').length, 0);
  assert.equal(api.outputFiles.some((file) => file.text.includes('old-201.mp4')), false);

  shouldFail = false;
  await api.startDownloads('manual');
  assert.equal(task.videoUrl, refreshedUrl, 'the retained post URL should allow a subsequent retry');
  assert.equal(outputContaining(api, '.ef2').length, 1);
  assert.ok(outputContaining(api, '.ef2')[0].text.includes(refreshedUrl));
});

test(`${SCRIPT}: export leaves fresh cached URLs untouched and does not resolve them again`, async () => {
  const cachedUrl = 'https://cdn.example.test/fresh-301.mp4?signature=still-valid';
  const task = staleTask('301', {
    videoUrl: cachedUrl,
    resolvedAt: FRESH_DATE,
    selectedQuality: '1080p',
    availableQualities: [{ label: '1080p', url: cachedUrl }],
    metadata: { id: '301', videoUrl: cachedUrl, downloadUrl: cachedUrl, title: 'Fresh fixture' },
  });
  const gm = responseAdapter(new Map());
  const api = loadScript({ script: SCRIPT, gmRequest: gm.handler });
  api.setTasks([task]);
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  assert.deepEqual(gm.calls, []);
  assert.equal(task.videoUrl, cachedUrl);
  assert.equal(task.resolvedAt, FRESH_DATE);
  assert.equal(outputContaining(api, '.ef2').length, 1);
  assert.ok(outputContaining(api, '.ef2')[0].text.includes(cachedUrl));
});

test(`${SCRIPT}: export ignores a repeated click while an export refresh is in flight`, async () => {
  const task = staleTask('401', { resolvedAt: undefined });
  const freshUrl = 'https://cdn.example.test/fresh-401.mp4?token=one-request';
  const gm = responseAdapter(new Map([[task.postUrl, success(freshUrl)]]), { defer: true });
  const api = loadScript({ script: SCRIPT, gmRequest: gm.handler });
  api.setTasks([task]);
  api.setMode(api.EXPORT_MODE.IDM);

  const first = api.startDownloads('manual');
  assert.equal(api.state.exporting, true, 'export lock should be set before the first asynchronous request');
  const second = api.startDownloads('manual');
  assert.equal(gm.calls.length, 1, 'second click must not submit another refresh request');
  gm.pending.forEach((complete) => complete());
  await Promise.all([first, second]);

  assert.equal(gm.calls.length, 1);
  assert.equal(outputContaining(api, '.ef2').length, 1);
  assert.equal(api.state.exporting, false, 'export lock should clear after completion');
});

test(`${SCRIPT}: export waits for any FETCHING task before writing files`, async () => {
  const freshUrl = 'https://cdn.example.test/fresh-901.mp4?token=ready';
  const resolvedUrl = 'https://cdn.example.test/refreshed-902.mp4?token=after-fetch';
  const readyTask = staleTask('901', {
    videoUrl: freshUrl,
    resolvedAt: FRESH_DATE,
    metadata: { id: '901', videoUrl: freshUrl, downloadUrl: freshUrl, title: 'Ready fixture' },
  });
  const fetchingTask = staleTask('902', { videoUrl: '', resolvedAt: '', status: 'fetching' });
  const gm = responseAdapter(new Map([[fetchingTask.postUrl, success(resolvedUrl)]]));
  const api = loadScript({ script: SCRIPT, gmRequest: gm.handler });
  api.setTasks([readyTask, fetchingTask]);
  api.state.fetching = false;
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  assert.deepEqual(gm.calls, [], 'export should not refresh while a resolver owns a task');
  assert.equal(api.outputFiles.length, 0, 'do not write a partial export of only the fresh READY task');

  fetchingTask.status = 'ready';
  await api.startDownloads('manual');
  assert.deepEqual(gm.calls, [fetchingTask.postUrl]);
  assert.equal(fetchingTask.videoUrl, resolvedUrl);
  const ef2 = outputContaining(api, '.ef2');
  assert.equal(ef2.length, 1);
  assert.ok(ef2[0].text.includes(freshUrl));
  assert.ok(ef2[0].text.includes(resolvedUrl));
});

test(`${SCRIPT}: watched check defers during export without marking the item, then queues after export`, async () => {
  const postUrl = 'https://example.test/video/910/fixture';
  const freshUrl = 'https://cdn.example.test/watched-910.mp4?token=queued';
  const gm = responseAdapter(new Map([[postUrl, success(freshUrl)]]));
  const api = loadScript({ script: SCRIPT, gmRequest: gm.handler });
  api.setWatchedPostUrl(postUrl);
  api.setMode(api.EXPORT_MODE.IDM);
  api.state.exporting = true;

  await api.runWatchedPageCheck('fixture-watch');

  assert.deepEqual(Array.from(api.scheduledWatchChecks), ['fixture-watch']);
  assert.equal(api.watchedPage.lastItemKey, '', 'deferred watch should not consume the dedupe key');
  assert.equal(api.state.tasks.length, 0);
  assert.deepEqual(gm.calls, [], 'deferred watch should not start a resolver request');

  api.state.exporting = false;
  await api.runWatchedPageCheck('fixture-watch');

  assert.equal(api.state.tasks.length, 1);
  assert.equal(api.state.tasks[0].postUrl, postUrl);
  assert.equal(api.state.tasks[0].videoUrl, freshUrl);
  assert.equal(api.state.tasks[0].status, 'ready');
  assert.equal(api.watchedPage.lastItemKey, 'id:910');
  assert.deepEqual(gm.calls, [postUrl]);
});

test(`${SCRIPT}: mixed refresh results omit failed stale URLs from EF2 and JSONL`, async () => {
  const goodTask = staleTask('501');
  const failedTask = staleTask('502');
  const newUrl = 'https://cdn.example.test/new-501.mp4?token=mixed-success';
  const gm = responseAdapter(new Map([
    [goodTask.postUrl, success(newUrl)],
    [failedTask.postUrl, { status: 503, responseText: '' }],
  ]));
  const api = loadScript({ script: SCRIPT, gmRequest: gm.handler });
  api.setTasks([goodTask, failedTask]);
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  const ef2 = outputContaining(api, '.ef2');
  const jsonl = outputContaining(api, '.jsonl');
  assert.equal(ef2.length, 1);
  assert.equal(jsonl.length, 1);
  assert.ok(ef2[0].text.includes(newUrl));
  assert.ok(!ef2[0].text.includes('old-501.mp4'));
  assert.ok(!ef2[0].text.includes('old-502.mp4'));
  assert.ok(!jsonl[0].text.includes('old-501.mp4'));
  assert.ok(!jsonl[0].text.includes('old-502.mp4'));
  const metadata = jsonl[0].text.split('\n').filter(Boolean).map((line) => JSON.parse(line));
  assert.equal(metadata.length, 1);
  assert.equal(metadata[0].videoUrl, newUrl);
});

test(`${SCRIPT}: exact ten-minute boundary and future timestamps are refreshed`, async () => {
  const atBoundary = staleTask('601', { resolvedAt: '2026-10-06T11:50:00.000Z' });
  const inFuture = staleTask('602', { resolvedAt: '2026-10-06T12:01:00.000Z' });
  const boundaryUrl = 'https://cdn.example.test/new-601.mp4?token=boundary';
  const futureUrl = 'https://cdn.example.test/new-602.mp4?token=future';
  const gm = responseAdapter(new Map([
    [atBoundary.postUrl, success(boundaryUrl)],
    [inFuture.postUrl, success(futureUrl)],
  ]));
  const api = loadScript({ script: SCRIPT, gmRequest: gm.handler });
  api.setTasks([atBoundary, inFuture]);
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  assert.deepEqual(gm.calls.sort(), [atBoundary.postUrl, inFuture.postUrl].sort());
  assert.equal(atBoundary.videoUrl, boundaryUrl);
  assert.equal(inFuture.videoUrl, futureUrl);
});

test(`${SCRIPT}: export force-fetches even when the task page is the current document`, async () => {
  const postUrl = 'https://example.test/video/701';
  const staleUrl = 'https://cdn.example.test/from-document.mp4?token=stale';
  const freshUrl = 'https://cdn.example.test/from-request.mp4?token=fresh';
  const task = staleTask('701', { postUrl });
  const gm = responseAdapter(new Map([[postUrl, success(freshUrl)]]));
  const api = loadScript({
    script: SCRIPT,
    gmRequest: gm.handler,
    locationHref: postUrl,
    documentHtml: responseFor(staleUrl),
  });
  api.setTasks([task]);
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  assert.deepEqual(gm.calls, [postUrl], 'export should use GM request, not cached current-page HTML');
  assert.equal(task.videoUrl, freshUrl);
  assert.ok(outputContaining(api, '.ef2')[0].text.includes(freshUrl));
  assert.ok(!outputContaining(api, '.ef2')[0].text.includes(staleUrl));
});

test(`${SCRIPT}: expired DONE task refreshes but remains complete`, async () => {
  const task = staleTask('801', { status: 'done', resolvedAt: STALE_DATE });
  const freshUrl = 'https://cdn.example.test/done-801.mp4?token=refreshed';
  const gm = responseAdapter(new Map([[task.postUrl, success(freshUrl)]]));
  const api = loadScript({ script: SCRIPT, gmRequest: gm.handler });
  api.setTasks([task]);
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  assert.deepEqual(gm.calls, [task.postUrl]);
  assert.equal(task.videoUrl, freshUrl);
  assert.equal(task.status, 'done', 'a refreshed completed task must not return to the direct download queue');
  assert.ok(outputContaining(api, '.ef2')[0].text.includes(freshUrl));
});

test(`${SCRIPT}: failed DONE refresh clears its URL, remains complete, and retries next export`, async () => {
  const task = staleTask('802', { status: 'done', resolvedAt: STALE_DATE });
  const freshUrl = 'https://cdn.example.test/done-802.mp4?token=retry';
  let fail = true;
  const gm = responseAdapter(new Map([[task.postUrl, success(freshUrl)]]));
  const api = loadScript({
    script: SCRIPT,
    gmRequest(options) {
      if (fail) {
        gm.calls.push(options.url);
        queueMicrotask(() => options.onload({ status: 503, responseText: '' }));
      } else {
        gm.handler(options);
      }
    },
  });
  api.setTasks([task]);
  api.setMode(api.EXPORT_MODE.IDM);

  await api.startDownloads('manual');

  assert.equal(task.videoUrl, '');
  assert.equal(task.status, 'done');
  assert.equal(outputContaining(api, '.ef2').length, 0);
  assert.equal(api.outputFiles.some((file) => file.text.includes('old-802.mp4')), false);

  fail = false;
  await api.startDownloads('manual');
  assert.equal(gm.calls.length, 2, 'the next export should retry the retained completed task URL');
  assert.equal(task.videoUrl, freshUrl);
  assert.equal(task.status, 'done');
  assert.ok(outputContaining(api, '.ef2')[0].text.includes(freshUrl));
});
}
