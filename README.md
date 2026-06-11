# R34 Video Watch Archive Downloader

Tampermonkey userscript for archiving watched videos and batch downloading videos from `rule34video.com`.

Current release: **v4.6**.

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
- Floating panel with Queue, Active, Success, and Failed statistics.

## Source Files

- `r34-video-watch-archive-downloader.user.js`: English userscript.
- `r34-video-watch-archive-downloader.zh.user.js`: Chinese userscript.
- `Intro.MD` / `Intro_ZH.MD`: SleazyFork release introduction text.
- `Intro01_EN.png` / `Intro02_ZH.png`: release screenshots.
- `Agent.md`: short maintenance notes for coding agents.

## Release Notes

### v4.6

- Refactored the download flow and added manual retry for failed tasks.
- Added live download progress display.
- Improved log output.

### v4.5

- Retried video downloads reuse already saved metadata JSON instead of saving duplicate metadata files.
- Unified watched-video auto download with the normal queue downloader.
- Completed downloads are removed from the queue immediately while failed items stay in the queue.
- Added retry-count logs for automatic retries and an Again button for retrying failed queue items.
- Changed the top counters to Queue, Active, Success, and Failed.
- Renamed Clear to Init; initialization clears the queue and counters without changing settings.
- Added a lightweight progress box below the action buttons from `GM_download.onprogress` with percent, compact size, speed, and ETA.
- Renamed the running download action to Stop send to clarify that active browser downloads are not cancelled.
- Restored active downloads after a page reload are marked as final failures to avoid automatic duplicate submissions.
- Added a download-round summary log with success and failed counts.
- Updated both English and Chinese userscripts to 4.5.

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
