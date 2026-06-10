# R34 Video Watch Archive Downloader

Tampermonkey userscript for archiving watched videos and batch downloading videos from `rule34video.com`.

Current release: **v4.4**.

Chinese documentation: [README_ZH.md](README_ZH.md).

## Install

Install from SleazyFork:

- English: https://sleazyfork.org/scripts/581996-r34-video-watch-archive-downloader
- Chinese: https://sleazyfork.org/scripts/581999-r34-video-watch-archive-downloader-zh

Open the project page and click install. This GitHub repository keeps the source code and release assets for development and review.

## Features

- English and Chinese UI scripts with matching behavior.
- Automatically queue watched videos from real pages, AJAX pages, and pseudo-navigation.
- Collect videos from search, uploader, user, favorites, and other list pages.
- Resolve direct video URLs and available quality variants.
- Choose quality: best, 8K, 4K, 1080p, 720p, 480p, or 360p.
- Browser download mode can optionally save metadata JSON before submitting the video download.
- Export direct-link TXT, YT-DLP command TXT, and metadata JSONL.
- Configure filename parts: ID, title, and original filename.
- Floating panel with queue, parse, submit, and download statistics.

## Source Files

- `r34-video-watch-archive-downloader.user.js`: English userscript.
- `r34-video-watch-archive-downloader.zh.user.js`: Chinese userscript.
- `Introduction_R34 Video Watch Archive Downloader.txt`: SleazyFork release introduction text.
- `It01_EN.png` / `It02_ZH.png`: release screenshots.
- `Agent.md`: short maintenance notes for coding agents.

## Release Notes

### v4.4

- Added a default-on metadata download checkbox in advanced options.
- Allowed browser download mode to skip metadata JSON and download only the video.
- Counted video-only downloads as complete when the video finishes.
- Updated both English and Chinese userscripts to 4.4.

### v4.3

- Improved compact English collection labels.
- Limited the max-pages input to 64 in both userscripts.
- Removed unused helpers, dead auto-download wiring, and redundant persisted parse statistics.
- Replaced `Agent.md` with concise maintenance notes for coding agents.
