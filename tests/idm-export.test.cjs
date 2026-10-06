const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..');
const CASES = [
  { file: 'r34-video-watch-archive-downloader.user.js', prefix: 'r34video' },
  { file: 'r34-video-watch-archive-downloader.zh.user.js', prefix: 'r34video' },
  { file: 'iwara-video-watch-archive-downloader.user.js', prefix: 'iwara' },
  { file: 'iwara-video-watch-archive-downloader.zh.user.js', prefix: 'iwara' },
];

function loadScript(file, { userAgent = 'Regression Test Agent/1.0', locationHref = 'https://example.test/current-page?view=1' } = {}) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const isIwara = file.startsWith('iwara-');
  const closure = isIwara ? '}());' : '})();';
  const startupMarker = "window.addEventListener('beforeunload', persistStateNow);";
  const startupAt = source.lastIndexOf(startupMarker);
  const closureAt = source.lastIndexOf(closure);
  assert.notEqual(startupAt, -1, `${file} should retain the beforeunload bootstrap marker`);
  assert.ok(closureAt > startupAt, `${file} should have a terminal IIFE close after startup`);

  const hook = `
  window.__idmExportTest = (() => {
    const downloads = [];
    const logs = [];
    downloadTextFile = (filename, text, mime) => downloads.push({ filename, text, mime });
    buildMetaJsonl = () => '';
    addLog = (message) => logs.push(message);
    updateUi = () => {};
    timestampForFile = () => 'TESTSTAMP';
    return {
      state,
      EXPORT_MODE,
      STORE_KEY,
      SETTINGS_KEY,
      extractPostUrls,
      downloads,
      logs,
      buildExportText,
      saveOutputFiles,
      setTasks(tasks) { state.tasks = tasks; },
      setMode(mode) { state.settings.exportMode = mode; },
    };
  })();
`;
  const instrumented = source.slice(0, startupAt) + hook + source.slice(closureAt);
  const window = {
    addEventListener() {},
    setTimeout,
    clearTimeout,
  };
  const context = vm.createContext({
    window,
    document: {
      createElement() {
        return { innerHTML: '', get value() { return this.innerHTML; } };
      },
    },
    location: new URL(locationHref),
    navigator: { userAgent },
    Node: { ELEMENT_NODE: 1 },
    URL,
    Blob,
    setTimeout,
    clearTimeout,
    console,
  });
  vm.runInContext(instrumented, context, { filename: file });
  return window.__idmExportTest;
}

function removeRequiredFinalCrlf(value) {
  assert.ok(value.endsWith('\r\n'), 'every nonempty EF2 file should end with CRLF');
  return value.slice(0, -2);
}

function parseEf2(text) {
  assert.ok(text.length > 0, 'parseEf2 expects at least one record');
  const content = removeRequiredFinalCrlf(text);
  const withoutCrlf = content.replace(/\r\n/g, '');
  assert.ok(!withoutCrlf.includes('\r') && !withoutCrlf.includes('\n'), 'EF2 records should use CRLF only');
  const lines = content.split('\r\n');
  const records = [];
  for (let index = 0; index < lines.length;) {
    assert.equal(lines[index], '<', 'each EF2 record should begin with <');
    const url = lines[index + 1];
    assert.ok(url, 'each record should contain a media URL');
    const record = { url, referer: '', userAgent: '' };
    index += 2;
    while (index < lines.length && lines[index] !== '>') {
      const header = lines[index++];
      if (/^referer:/i.test(header)) record.referer = header.slice(header.indexOf(':') + 1).trim();
      else if (/^user-agent:/i.test(header)) record.userAgent = header.slice(header.indexOf(':') + 1).trim();
      else assert.fail(`unexpected EF2 header line: ${header}`);
    }
    assert.equal(lines[index], '>', 'each EF2 record should end with >');
    records.push(record);
    index += 1;
  }
  return records;
}

for (const { file, prefix } of CASES) {
  test(`${file}: IDM export writes associated EF2 records and preserves signed URLs`, () => {
    const api = loadScript(file);
    const tasks = [
      {
        videoUrl: 'https://cdn.example.test/a.mp4?token=a%2Fb&expires=1780000000',
        postUrl: 'https://site.example.test/video/a?from=watch',
        filename: 'a.mp4',
      },
      {
        videoUrl: 'https://cdn.example.test/b.mp4?signature=x%3Dy&key=two',
        postUrl: 'https://site.example.test/video/b',
        filename: 'b.mp4',
      },
      { videoUrl: '', postUrl: 'https://site.example.test/video/unresolved' },
    ];
    api.setTasks(tasks);
    api.setMode(api.EXPORT_MODE.IDM);

    const output = api.buildExportText();
    const records = parseEf2(output);
    assert.equal(records.length, 2, 'only resolved media tasks should create records');
    assert.deepEqual(records.map(({ url, referer }) => ({ url, referer })), [
      { url: tasks[0].videoUrl, referer: tasks[0].postUrl },
      { url: tasks[1].videoUrl, referer: tasks[1].postUrl },
    ]);
    assert.ok(records.every((item) => item.userAgent === 'Regression Test Agent/1.0'));
    assert.ok(!output.includes('video/unresolved'));
    assert.equal((output.match(/https:\/\//g) || []).length, 4, 'the referring pages should be headers, not extra download records');

    api.saveOutputFiles();
    assert.equal(api.downloads.length, 1);
    assert.match(api.downloads[0].filename, new RegExp(`^${prefix}-idm-.+\\.ef2$`));
    assert.equal(api.downloads[0].mime, 'text/plain');
    assert.equal(api.downloads[0].text, output);
  });

  test(`${file}: IDM fields strip controls, fall back to the current page, and allow an empty UA`, () => {
    const api = loadScript(file, { userAgent: '\r\n' });
    const task = {
      videoUrl: 'https://cdn.example.test/file.mp4?sig=abc&part=1',
      postUrl: ' \r\nhttps://site.example.test/video/clean\t\u0000 ',
      filename: 'file.mp4',
    };
    api.setTasks([task]);
    api.setMode(api.EXPORT_MODE.IDM);
    const output = api.buildExportText();
    assert.deepEqual(parseEf2(output), [{
      url: task.videoUrl,
      referer: 'https://site.example.test/video/clean',
      userAgent: '',
    }]);
    assert.ok(output.endsWith('\r\n'), 'single-record EF2 output should end with CRLF');
    assert.ok(!/[\u0000-\u001f\u007f]/.test(output.replace(/\r\n/g, '')));

    task.postUrl = '';
    assert.deepEqual(parseEf2(api.buildExportText()), [{
      url: task.videoUrl,
      referer: 'https://example.test/current-page?view=1',
      userAgent: '',
    }]);
  });

  test(`${file}: malicious user agent newlines cannot inject another EF2 record`, () => {
    const api = loadScript(file, {
      userAgent: 'SafeAgent/1\r\n>\r\n<\r\nhttps://attacker.example/payload\r\nreferer: https://attacker.example/',
    });
    api.setTasks([{ videoUrl: 'https://cdn.example.test/only.mp4?signature=s', postUrl: 'https://site.example.test/video/only' }]);
    api.setMode(api.EXPORT_MODE.IDM);
    const output = api.buildExportText();
    const records = parseEf2(output);
    assert.equal(records.length, 1);
    assert.equal(records[0].url, 'https://cdn.example.test/only.mp4?signature=s');
    assert.equal(records[0].referer, 'https://site.example.test/video/only');
    assert.ok(!/[\u0000-\u001f\u007f]/.test(output.replace(/\r\n/g, '')));
  });

  test(`${file}: empty IDM queue creates no file and existing TXT export modes keep their format`, () => {
    const api = loadScript(file);
    api.setTasks([{ videoUrl: '', postUrl: 'https://site.example.test/video/unresolved' }]);
    api.setMode(api.EXPORT_MODE.IDM);
    assert.equal(api.buildExportText(), '');
    assert.equal(api.buildExportText().endsWith('\r\n'), false, 'empty EF2 output should stay empty');
    api.saveOutputFiles();
    assert.equal(api.downloads.length, 0);

    const tasks = [
      { videoUrl: 'https://cdn.example.test/a.mp4?token=1', postUrl: 'https://site.example.test/a', filename: 'a.mp4' },
      { videoUrl: 'https://cdn.example.test/b.mp4?token=2', postUrl: 'https://site.example.test/b', filename: 'b.mp4' },
    ];
    api.setTasks(tasks);
    api.setMode(api.EXPORT_MODE.LINKS);
    assert.equal(api.buildExportText(), tasks.map((task) => task.videoUrl).join('\n'));
    api.setMode(api.EXPORT_MODE.YTDLP);
    assert.equal(
      api.buildExportText(),
      tasks.map((task) => `yt-dlp -o "${task.filename}" "${task.videoUrl}"`).join('\n')
    );
  });

  {
    const isIwara = file.startsWith('iwara-');
    const domains = isIwara ? ['iwara.tv', 'iwara.ai'] : ['rule34video.com', 'rule34gen.com'];
    test(`${file}: both supported domains share the existing queue keys and collect their video pages`, () => {
      const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
      for (const domain of domains) {
        for (const prefix of ['', 'www.']) {
          const host = prefix + domain;
          assert.ok(source.includes(`// @match        https://${host}/*`));
          const api = loadScript(file, { locationHref: `https://${host}/` });
          assert.equal(api.STORE_KEY, isIwara ? 'iwara_video_watch_archive_downloader_state_v1' : 'r34v_bulk_downloader_state_v2');
          assert.equal(api.SETTINGS_KEY, isIwara ? 'iwara_video_watch_archive_downloader_settings_v1' : 'r34v_bulk_downloader_settings_v3');
          const urls = [
            '/video/123/fixture/',
            `https://${domain}/video/124/fixture/`,
            `https://${domains.find((other) => other !== domain)}/video/125/fixture/`,
            `https://${domain}.example.test/video/126/fixture/`,
          ];
          const doc = { querySelectorAll: () => urls.map((href) => ({ nodeType: 1, getAttribute: () => href, closest: () => null })) };
          assert.deepEqual(Array.from(api.extractPostUrls(doc, `https://${host}/`)), [
            `https://${host}/video/123/fixture/`,
            `https://${domain}/video/124/fixture/`,
          ]);
          api.setTasks([{ videoUrl: 'https://cdn.example.test/fixture.mp4', postUrl: `https://${host}/video/123/fixture/` }]);
          api.setMode(api.EXPORT_MODE.IDM);
          assert.equal(parseEf2(api.buildExportText())[0].referer, `https://${host}/video/123/fixture/`);
        }
      }
    });
  }
}
