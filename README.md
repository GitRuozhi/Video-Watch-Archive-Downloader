# R34Video Watch Archive Downloader

Tampermonkey userscript for archiving watched videos and batch downloading videos from `rule34video.com`.

Current release: **v4.2**.

Chinese documentation: [README_ZH.md](README_ZH.md).

## Install

1. Install Tampermonkey or another userscript manager.
2. Open `r34video-watch-archive-downloader.user.js`.
3. Create a new userscript and paste the file contents, or install it from the raw GitHub URL.
4. Open a supported `rule34video.com` page.

## Features

- Primary English userscript with no Chinese UI text.
- Compact English UI labels for the narrow floating panel.
- Separate Chinese userscript for Chinese UI users.
- Automatically queue watched videos from real pages, AJAX pages, and pseudo-navigation.
- Optional auto-download for newly queued watched videos.
- Collect videos from search, uploader, user, favorites, and other list pages.
- Continue multi-page collection across real page reloads.
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

## Script Files

English primary version:

```text
r34video-watch-archive-downloader.user.js
```

Chinese version:

```text
r34video-watch-archive-downloader.zh.user.js
```
