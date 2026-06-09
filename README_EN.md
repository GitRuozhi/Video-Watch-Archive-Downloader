# R34Video Bulk Downloader

Tampermonkey userscript for collecting, exporting, and downloading videos from `rule34video.com`.

Current release: **v3.8**.

Chinese documentation: [README.md](README.md).

## Install

1. Install Tampermonkey or another userscript manager.
2. Open `r34video-bulk-downloader.user.js`.
3. Create a new userscript and paste the file contents, or install it from the raw GitHub URL.
4. Open a supported `rule34video.com` page.

## Features

- Collect videos from search, uploader, user, favorites, and other list pages.
- Continue multi-page collection across real page reloads.
- Detect AJAX / pseudo-navigation video pages and queue watched videos.
- Parse direct video URLs and available quality variants.
- Select quality: best, 8K, 4K, 1080p, 720p, 480p, or 360p.
- Browser download mode saves metadata JSON before submitting the video download.
- Export direct-link TXT and metadata JSONL.
- Export YT-DLP command TXT and metadata JSONL.
- Configurable filename parts: ID, title, and original filename.
- Floating panel with queue, parse, submit, and download statistics.

## Notes

- Browser downloads are handled by `GM_download`. Stopping the queue prevents new downloads from being submitted, but downloads already submitted to the browser or userscript manager may continue.
- `Old/`, `Reference/`, and `Test/` are local material folders and are not uploaded to GitHub.
- Root-level `Agent.md` is for AI agents. `README.md` is for human readers.

## Main File

Use this file as the canonical script:

```text
r34video-bulk-downloader.user.js
```
