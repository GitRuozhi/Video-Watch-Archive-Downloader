#!/usr/bin/env node
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const OUTPUT_DIR = path.join(ROOT, '.git', 'idm-verification');
const USER_AGENT = 'IDM-Export-Verification/1.0';
const VARIANTS = [
  { script: 'r34-video-watch-archive-downloader.user.js', key: 'r34-en' },
  { script: 'r34-video-watch-archive-downloader.zh.user.js', key: 'r34-zh' },
  { script: 'iwara-video-watch-archive-downloader.user.js', key: 'iwara-en' },
  { script: 'iwara-video-watch-archive-downloader.zh.user.js', key: 'iwara-zh' },
];

function parseArgs(argv) {
  const options = {
    mediaFile: '',
    selfTest: argv.includes('--self-test'),
    exportOnly: argv.includes('--export-only'),
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--media-file') {
      if (!argv[index + 1]) throw new Error('--media-file requires a path');
      options.mediaFile = path.resolve(argv[++index]);
    } else if (argv[index] !== '--self-test' && argv[index] !== '--export-only') {
      throw new Error(`Unknown argument: ${argv[index]}`);
    }
  }
  return options;
}

function mp4Box(type, payload) {
  const body = Buffer.from(payload);
  const header = Buffer.alloc(8);
  header.writeUInt32BE(header.length + body.length, 0);
  header.write(type, 4, 4, 'ascii');
  return Buffer.concat([header, body]);
}

function makeFixture() {
  // A deterministic binary MP4-shaped fixture. It is only a transport test payload,
  // not a playable video and contains no user media.
  const ftyp = mp4Box('ftyp', Buffer.from('isom\0\0\x02\0isomiso2mp41', 'binary'));
  const mdat = mp4Box('mdat', Buffer.from('IDM-EF2 local verification fixture\0', 'utf8'));
  return Buffer.concat([ftyp, mdat]);
}

function loadUserscript(scriptPath) {
  const source = fs.readFileSync(scriptPath, 'utf8');
  const startupMarker = "window.addEventListener('beforeunload', persistStateNow);";
  const startupAt = source.lastIndexOf(startupMarker);
  const isIwara = path.basename(scriptPath).startsWith('iwara-');
  const closure = isIwara ? '}());' : '})();';
  const closureAt = source.lastIndexOf(closure);
  if (startupAt < 0 || closureAt <= startupAt) {
    throw new Error(`Could not find userscript bootstrap to suppress: ${scriptPath}`);
  }

  const hook = `
    window.__idmVerificationHook = {
      state,
      buildExportText,
      setTasks(tasks) { state.tasks = tasks; },
      setMode(mode) { state.settings.exportMode = mode; },
    };
`;
  const instrumented = source.slice(0, startupAt) + hook + source.slice(closureAt);
  const window = { addEventListener() {} };
  const context = vm.createContext({
    window,
    document: {},
    location: { href: 'http://127.0.0.1/' },
    navigator: { userAgent: USER_AGENT },
    URL,
    Blob,
    console,
    setTimeout,
    clearTimeout,
    setInterval,
    clearInterval,
  });
  vm.runInContext(instrumented, context, { filename: path.basename(scriptPath) });
  return window.__idmVerificationHook;
}

function makeTasks(variantKey, baseUrl) {
  return [1, 2].map((item) => {
    const name = `${variantKey}-${item}`;
    const signature = `sig-${variantKey}-${item}-a%2Fb`;
    return {
      postUrl: `${baseUrl}/page/${name}?pageKey=${encodeURIComponent(`page-${variantKey}-${item}`)}`,
      videoUrl: `${baseUrl}/media/${name}.mp4?token=${encodeURIComponent(signature)}&expires=179000000${item}`,
      filename: `${name}.mp4`,
      videoUrlName: name,
    };
  });
}

function writeEf2Files(baseUrl) {
  const ef2Files = [];
  for (const variant of VARIANTS) {
    const tasks = makeTasks(variant.key, baseUrl);
    const hook = loadUserscript(path.join(ROOT, variant.script));
    hook.setTasks(tasks);
    hook.setMode('idm');
    const ef2Text = hook.buildExportText();
    const ef2Path = path.join(OUTPUT_DIR, `${variant.script.replace(/\.user\.js$/, '')}.ef2`);
    fs.writeFileSync(ef2Path, ef2Text, { encoding: 'utf8' });
    ef2Files.push(ef2Path);
  }
  return ef2Files;
}

function createEntries(baseUrl) {
  const entries = new Map();
  const manifestEntries = [];
  for (const variant of VARIANTS) {
    const tasks = makeTasks(variant.key, baseUrl);
    const ef2Path = path.join(OUTPUT_DIR, `${variant.script.replace(/\.user\.js$/, '')}.ef2`);
    for (const task of tasks) {
      const videoUrl = new URL(task.videoUrl);
      const pageUrl = new URL(task.postUrl);
      entries.set(videoUrl.pathname, {
        mediaUrl: task.videoUrl,
        referer: task.postUrl,
        signature: new URLSearchParams(videoUrl.search).get('token'),
        pagePath: pageUrl.pathname,
        pageKey: pageUrl.searchParams.get('pageKey'),
        variant: variant.key,
      });
      manifestEntries.push({ mediaUrl: task.videoUrl, referer: task.postUrl, variant: variant.key });
    }
    manifestEntries.push({
      variant: variant.key,
      scriptPath: path.join(ROOT, variant.script),
      ef2Path,
      recordCount: tasks.length,
    });
  }

  const legacyPath = path.join(OUTPUT_DIR, 'legacy-url-tab-referer.txt');
  const legacyLines = manifestEntries
    .filter((entry) => entry.mediaUrl)
    .map((entry) => `${entry.mediaUrl}\t${entry.referer}`);
  fs.writeFileSync(legacyPath, legacyLines.join('\r\n'), { encoding: 'utf8' });
  const ef2Files = writeEf2Files(baseUrl);
  return { entries, manifestEntries, legacyPath, ef2Files };
}

function regenerateFromManifest() {
  const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
  if (!fs.existsSync(manifestPath)) throw new Error(`Cannot export without an existing manifest: ${manifestPath}`);
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const baseUrl = new URL(manifest.baseUrl);
  if (manifest.bindAddress !== '127.0.0.1' || baseUrl.hostname !== '127.0.0.1' || !Array.isArray(manifest.entries)) {
    throw new Error('Existing manifest is not a valid loopback verification manifest');
  }
  const expectedMedia = new Set(manifest.entries.map((entry) => entry.mediaUrl));
  for (const variant of VARIANTS) {
    for (const task of makeTasks(variant.key, manifest.baseUrl)) {
      if (!expectedMedia.has(task.videoUrl)) {
        throw new Error(`Manifest does not match current test URLs for ${variant.key}`);
      }
    }
  }
  const ef2Files = writeEf2Files(manifest.baseUrl);
  return {
    ready: true,
    exportOnly: true,
    baseUrl: manifest.baseUrl,
    manifestPath,
    ef2Files,
    entryCount: manifest.entries.length,
  };
}

function rangeForHeader(rangeHeader, size) {
  if (!rangeHeader) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) return { invalid: true };
  let start;
  let end;
  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (suffixLength <= 0) return { invalid: true };
    start = Math.max(0, size - suffixLength);
    end = size - 1;
  } else {
    start = Number(match[1]);
    end = match[2] ? Number(match[2]) : size - 1;
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) return { invalid: true };
  return { start, end: Math.min(end, size - 1) };
}

function startServer(options = {}) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const media = options.mediaFile
    ? fs.readFileSync(options.mediaFile)
    : makeFixture();
  if (!media.length) throw new Error('The media fixture must not be empty');
  const mediaHash = crypto.createHash('sha256').update(media).digest('hex');
  const logPath = path.join(OUTPUT_DIR, 'requests.jsonl');
  fs.writeFileSync(logPath, '', { encoding: 'utf8' });

  const server = http.createServer();
  server.on('clientError', (_error, socket) => socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n'));

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.removeListener('error', reject);
      const address = server.address();
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const { entries, manifestEntries, legacyPath } = createEntries(baseUrl);

      server.on('request', (req, res) => {
        const requestUrl = new URL(req.url, baseUrl);
        const pathname = requestUrl.pathname;
        const referer = req.headers.referer || '';
        const userAgent = req.headers['user-agent'] || '';
        let matched = false;
        let status = 404;
        let headers = {};
        let body = Buffer.from('Not found', 'utf8');

        if (pathname === '/health') {
          status = 200;
          headers = { 'Content-Type': 'application/json; charset=utf-8' };
          body = Buffer.from(JSON.stringify({ ok: true, bind: '127.0.0.1', port: address.port }), 'utf8');
          matched = true;
        } else if (pathname.startsWith('/page/')) {
          status = 200;
          headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
          body = Buffer.from(`<!doctype html><meta charset="utf-8"><title>Local IDM test page</title><p>Verification page ${pathname}</p>`, 'utf8');
          matched = true;
        } else if (entries.has(pathname)) {
          const entry = entries.get(pathname);
          matched = referer === entry.referer
            && userAgent === USER_AGENT
            && requestUrl.searchParams.get('token') === entry.signature;
          if (matched) {
            const range = rangeForHeader(req.headers.range, media.length);
            headers = {
              'Accept-Ranges': 'bytes',
              'Cache-Control': 'no-store',
              'Content-Type': 'video/mp4',
              ETag: `"${mediaHash}"`,
            };
            if (range && range.invalid) {
              status = 416;
              headers['Content-Range'] = `bytes */${media.length}`;
              body = Buffer.alloc(0);
            } else if (range) {
              status = 206;
              body = media.subarray(range.start, range.end + 1);
              headers['Content-Range'] = `bytes ${range.start}-${range.end}/${media.length}`;
              headers['Content-Length'] = String(body.length);
            } else {
              status = 200;
              body = media;
              headers['Content-Length'] = String(body.length);
            }
          } else {
            status = 403;
            headers = { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' };
            body = Buffer.from('<!doctype html><meta charset="utf-8"><title>Missing request headers</title><p>Referer or User-Agent did not match.</p>', 'utf8');
          }
        }

        const logLine = {
          method: req.method,
          path: `${pathname}${requestUrl.search}`,
          referer,
          userAgent,
          matched,
          status,
          range: req.headers.range || '',
        };
        fs.appendFileSync(logPath, `${JSON.stringify(logLine)}\n`, { encoding: 'utf8' });
        res.writeHead(status, headers);
        if (req.method === 'HEAD') res.end();
        else res.end(body);
      });

      const manifestPath = path.join(OUTPUT_DIR, 'manifest.json');
      const manifest = {
        baseUrl,
        bindAddress: '127.0.0.1',
        port: address.port,
        expectedUserAgent: USER_AGENT,
        media: {
          sha256: mediaHash,
          bytes: media.length,
          contentType: 'video/mp4',
          source: options.mediaFile || 'built-in binary fixture (transport test only)',
        },
        files: {
          ef2: manifestEntries.filter((entry) => entry.ef2Path).map((entry) => entry.ef2Path),
          legacyTxt: legacyPath,
          requestsJsonl: logPath,
        },
        entries: manifestEntries.filter((entry) => entry.mediaUrl),
      };
      fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: 'utf8' });
      resolve({ server, manifest, manifestPath });
    });
  });
}

async function selfTest(manifest) {
  const entry = manifest.entries[0];
  const goodHeaders = { referer: entry.referer, 'user-agent': manifest.expectedUserAgent };
  const headResponse = await fetch(entry.mediaUrl, { method: 'HEAD', headers: goodHeaders });
  if (headResponse.status !== 200 || headResponse.headers.get('content-type') !== 'video/mp4') {
    throw new Error(`Valid HEAD request failed: ${headResponse.status}`);
  }
  const goodResponse = await fetch(entry.mediaUrl, { headers: goodHeaders });
  const goodBytes = Buffer.from(await goodResponse.arrayBuffer());
  if (goodResponse.status !== 200 || crypto.createHash('sha256').update(goodBytes).digest('hex') !== manifest.media.sha256) {
    throw new Error(`Valid GET did not return the fixture: ${goodResponse.status}`);
  }
  const rangeResponse = await fetch(entry.mediaUrl, {
    method: 'GET',
    headers: { ...goodHeaders, range: 'bytes=0-7' },
  });
  if (rangeResponse.status !== 206 || (await rangeResponse.arrayBuffer()).byteLength !== Math.min(8, manifest.media.bytes)) {
    throw new Error(`Valid Range request failed: ${rangeResponse.status}`);
  }
  const missingResponse = await fetch(entry.mediaUrl);
  const missingType = missingResponse.headers.get('content-type') || '';
  const missingBody = await missingResponse.text();
  if (missingResponse.status !== 403 || !missingType.startsWith('text/html') || !missingBody.includes('Referer or User-Agent')) {
    throw new Error(`Missing-header request did not produce the expected HTML error: ${missingResponse.status}`);
  }
  return { validHead: 200, validGet: 200, validRange: 206, missingHeaders: 403, missingContentType: missingType };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.exportOnly) {
    process.stdout.write(`${JSON.stringify(regenerateFromManifest())}\n`);
    return;
  }
  const { server, manifest, manifestPath } = await startServer(options);
  const output = {
    ready: true,
    baseUrl: manifest.baseUrl,
    port: manifest.port,
    manifestPath,
    ef2Files: manifest.files.ef2,
    legacyTxt: manifest.files.legacyTxt,
    requestLog: manifest.files.requestsJsonl,
    mediaSha256: manifest.media.sha256,
    mediaBytes: manifest.media.bytes,
    entryCount: manifest.entries.length,
  };

  if (options.selfTest) {
    try {
      output.selfTest = await selfTest(manifest);
      process.stdout.write(`${JSON.stringify(output)}\n`);
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
      return;
    } catch (error) {
      await new Promise((resolve) => server.close(() => resolve()));
      throw error;
    }
  }

  process.stdout.write(`${JSON.stringify(output)}\n`);
  const close = () => server.close(() => process.exit(0));
  process.once('SIGINT', close);
  process.once('SIGTERM', close);
}

main().catch((error) => {
  process.stderr.write(`idm-test-server: ${error.stack || error}\n`);
  process.exitCode = 1;
});
